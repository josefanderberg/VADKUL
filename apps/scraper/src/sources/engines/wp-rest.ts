/**
 * WordPress REST engine — strukturerade API:er som många sajter har gratis.
 *
 * Två varianter stöds:
 *   1. 'tribe' — The Events Calendar (extremt vanligt på WP-sajter med events)
 *                Endpoint: /wp-json/tribe/events/v1/events
 *   2. 'wp-v2' — Generisk custom post type via /wp-json/wp/v2/event
 *
 * The Events Calendar är guldstandarden: titel, datum, beskrivning, bild,
 * venue (med adress + koordinater), kategori — allt i ett anrop.
 *
 * Pagination: API:et stödjer `page` + `per_page`. Vi loopar tills tomt svar
 * eller `windowDays` har passerats.
 *
 * Config:
 *   baseUrl:    'https://www.kommun.se'
 *   variant?:   'tribe' | 'wp-v2'   default 'tribe'
 *   endpoint?:  override default endpoint
 *   pageSize?:  default 50
 *   maxPages?:  säkerhetsspärr, default 20
 *   userAgent?: custom UA
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { findFirstDateInText } from '../../utils/swedishDate';
import { fetchWithRetry } from '../../utils/fetchWithRetry';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface WpRestConfig {
    baseUrl: string;
    variant?: 'tribe' | 'wp-v2';
    endpoint?: string;
    pageSize?: number;
    maxPages?: number;
    userAgent?: string;
    timeoutMs?: number;
    /** Stad/ort som sätts på events när venue inte finns i datan. T.ex. "Helsingborg" */
    defaultCity?: string;
    /** Slå på `?_embed=1` — hämtar featured image + terms (kategorier) */
    embed?: boolean;
    /**
     * Om datum saknas i API-svaret, besök event-permalänken och hämta datumet
     * från renderad HTML. Långsammare men låser upp många kommunsajter där
     * content/excerpt är tomt i wp/v2 men datumet syns på sidan.
     */
    fetchDetailPage?: boolean;
}

function endpointFor(cfg: WpRestConfig): string {
    if (cfg.endpoint) return cfg.endpoint;
    return cfg.variant === 'wp-v2'
        ? '/wp-json/wp/v2/event'
        : '/wp-json/tribe/events/v1/events';
}

async function fetchJson(url: string, cfg: WpRestConfig, signal?: AbortSignal): Promise<any | null> {
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: { 'User-Agent': cfg.userAgent ?? DEFAULT_UA, 'Accept': 'application/json' },
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? 20_000, label: url });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/** Hämta event-detaljsidan som HTML — för att extrahera datum/venue när API:n saknar dem. */
async function fetchDetailHtml(url: string, cfg: WpRestConfig, signal?: AbortSignal): Promise<string | null> {
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
            redirect: 'follow',
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? 15_000, label: url });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/** Försök extrahera venue ur HTML — t.ex. <dl><dt>Plats</dt><dd>Trollsjön</dd></dl> */
function findVenueInHtml(html: string): string | undefined {
    if (!html) return undefined;
    // <dt>Plats</dt><dd>X</dd>  — vanligt i kommun-event-sidor
    const dtdd = html.match(/<dt[^>]*>\s*(?:plats|var|venue)\s*<\/dt>\s*<dd[^>]*>([^<]{2,80})</i);
    if (dtdd) return dtdd[1].trim();
    // "Plats: X" i ren text
    const inline = html.replace(/<[^>]+>/g, ' ').match(/\b(?:plats|var)\s*[:：]\s*([A-ZÅÄÖ][^.!?\n,]{2,60})/i);
    if (inline) return inline[1].trim();
    return undefined;
}

/** Första matchande meta-tagg (property ELLER name) ur HTML, oavsett attribut-ordning. */
function metaContent(html: string, keys: string[]): string | undefined {
    for (const k of keys) {
        const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i'))
            || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${esc}["']`, 'i'));
        if (m && m[1].trim()) return m[1].trim();
    }
    return undefined;
}

const HTML_ENTITIES: Record<string, string> = {
    '&amp;': '&', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&apos;': "'",
    '&lt;': '<', '&gt;': '>', '&nbsp;': ' ',
};
function decodeEntities(s: string): string {
    return s.replace(/&(?:amp|quot|#0?39|apos|lt|gt|nbsp);/g, m => HTML_ENTITIES[m] ?? m);
}

/**
 * Beskrivning ur detalj-sidans meta-taggar. Kräver ≥20 tecken för att inte
 * fastna på generiska/tomma snuttar. Faller tillbaka twitter: → name=description.
 */
function findMetaDescription(html: string): string | undefined {
    const v = metaContent(html, ['og:description', 'twitter:description', 'description']);
    if (!v) return undefined;
    const d = decodeEntities(v).trim();
    return d.length >= 20 ? d : undefined;
}

/**
 * Bild ur detalj-sidans meta-taggar. VIKTIGT: og:image på DETALJSIDAN är
 * event-specifik — wp/v2-API:ts yoast-og är ofta en generisk delningsbild.
 */
function findMetaImage(html: string): string | undefined {
    const v = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
    if (!v) return undefined;
    const url = decodeEntities(v).trim();
    return /share-image|placeholder|default|logo/i.test(url) ? undefined : url;
}

/** Tolka Tribes datum-format ("2026-06-15 19:00:00" — lokal tid, ingen TZ). */
function parseTribeDate(s: string | undefined): Date | null {
    if (!s) return null;
    // ISO eller med space — försök båda
    const iso = s.includes('T') ? s : s.replace(' ', 'T');
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
}

function tribeToRawEvent(e: any): RawEvent | null {
    if (!e?.title || !e?.start_date) return null;
    const start = parseTribeDate(e.start_date);
    if (!start) return null;
    const end = parseTribeDate(e.end_date) || undefined;

    const venue = Array.isArray(e.venue) ? e.venue[0] : e.venue;
    const coords: [number, number] | undefined =
        venue?.geo_lat && venue?.geo_lng
            ? [parseFloat(venue.geo_lat), parseFloat(venue.geo_lng)]
            : undefined;

    return {
        externalId: e.id ? String(e.id) : undefined,
        title: String(e.title).trim(),
        startDate: start,
        endDate: end || undefined,
        url: e.url || e.website || '',
        venueName: venue?.venue,
        city: venue?.city,
        address: venue?.address,
        coords,
        description: e.description
            ? String(e.description).replace(/<[^>]+>/g, '').trim()
            : (e.excerpt ? String(e.excerpt).replace(/<[^>]+>/g, '').trim() : undefined),
        imageUrl: e.image?.url || (typeof e.image === 'string' ? e.image : undefined),
        organizer: Array.isArray(e.organizer) ? e.organizer[0]?.organizer : e.organizer?.organizer,
        category: Array.isArray(e.categories) && e.categories[0]?.name
            ? String(e.categories[0].name).toLowerCase()
            : undefined,
        price: e.cost,
    };
}

/**
 * Avgör om "datumet" från standard-fält bara är WP:s publication date.
 *
 * Heuristik: om `dateRaw` är inom 48h av nu OCH titeln/innehållet inte
 * uttryckligen säger "idag/imorgon", anta det är publication date och
 * leta efter ett RIKTIGT event-datum i content/title/excerpt istället.
 */
function looksLikePublishDate(dateRaw: string | undefined, now: Date): boolean {
    if (!dateRaw) return false;
    const d = new Date(dateRaw);
    if (isNaN(d.getTime())) return false;
    const ageMs = Math.abs(now.getTime() - d.getTime());
    return ageMs < 48 * 60 * 60 * 1000;
}

/**
 * Försök hitta venue-namn i fritext. Mönstren matchar svenska konstruktioner
 * som "på X.", "vid X.", "i X:". Konservativt — bättre att returnera null än
 * att gissa fel.
 */
// Vanliga falska positiva: nyckelord/sociala medier/all-caps-rubriker som
// vår venue-regex annars plockar upp.
const VENUE_FALSE_POSITIVES = /^(facebook|instagram|tiktok|youtube|spotify|datum|tid|plats|när|var|info|sveriges|svenska|alla|nya|en|ett)$/i;

function findVenueInText(text: string): string | undefined {
    if (!text) return undefined;
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    // "på Helsingborgs Konserthus", "vid Sofiero slott", "i Ångfärjeparken"
    const patterns = [
        /\bplats:\s*([A-ZÅÄÖ][^.!?\n]{2,40})/i, // "Plats: X" är starkast
        /\bpå\s+([A-ZÅÄÖ][\wåäöÅÄÖ&-]+(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&-]+){0,3})/,
        /\bvid\s+([A-ZÅÄÖ][\wåäöÅÄÖ&-]+(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&-]+){0,3})/,
    ];
    for (const p of patterns) {
        const m = clean.match(p);
        if (!m || !m[1]) continue;
        const candidate = m[1].trim().replace(/\s+(datum|tid|när)\b.*$/i, ''); // strip "Sofiero DATUM:"
        // Filtrera bort all-caps single-words (DATUM, TID), falska positiva, för kort
        if (candidate.length < 3 || candidate.length > 60) continue;
        if (/^[A-ZÅÄÖ]{2,}$/.test(candidate)) continue;
        if (VENUE_FALSE_POSITIVES.test(candidate)) continue;
        return candidate;
    }
    return undefined;
}

/**
 * Plocka kategori från embedded wp:term — om termens namn matchar en känd
 * event-kategori.
 */
function categoryFromTerms(e: any): string | undefined {
    const groups = e._embedded?.['wp:term'];
    if (!Array.isArray(groups)) return undefined;
    const names: string[] = [];
    for (const g of groups) {
        const items = Array.isArray(g) ? g : [g];
        for (const t of items) {
            if (t?.name) names.push(String(t.name).toLowerCase());
        }
    }
    return names.length > 0 ? names.join(' ') : undefined;
}

async function wpV2ToRawEvent(e: any, cfg: WpRestConfig, now: Date, signal?: AbortSignal): Promise<RawEvent | null> {
    const title = e?.title?.rendered ? String(e.title.rendered).trim() : null;
    if (!title) return null;

    // 1. Standardfält först
    const dateRaw = e.meta?.event_date || e.meta?.start_date || e.acf?.start_date;
    let start: Date | null = dateRaw ? new Date(dateRaw) : null;

    // 2. Om de saknas eller är publication date: scanna title + content + excerpt
    if (!start || isNaN(start.getTime()) || looksLikePublishDate(e.date, now)) {
        const haystack = [
            String(e.title?.rendered || ''),
            String(e.excerpt?.rendered || ''),
            String(e.content?.rendered || ''),
        ].join(' ');
        const scanned = findFirstDateInText(haystack, now);
        if (scanned) start = scanned;
    }

    // 3. Sista utvägen: hämta event-permalänken som HTML och leta där
    let detailHtml: string | null = null;
    if ((!start || isNaN(start.getTime())) && cfg.fetchDetailPage && e.link) {
        detailHtml = await fetchDetailHtml(e.link, cfg, signal);
        if (detailHtml) {
            const scanned = findFirstDateInText(detailHtml, now);
            if (scanned) start = scanned;
        }
    }

    if (!start || isNaN(start.getTime())) return null;

    // Description: föredra excerpt, annars första 600 tecken av content
    let description = e.excerpt?.rendered
        ? String(e.excerpt.rendered).replace(/<[^>]+>/g, '').trim()
        : (e.content?.rendered
            ? String(e.content.rendered).replace(/<[^>]+>/g, '').trim().slice(0, 600)
            : '');

    // Image: prefer _embed featuredmedia (full quality), annars fall tillbaka
    let imageUrl: string | undefined = e._embedded?.['wp:featuredmedia']?.[0]?.source_url
        || e.featured_media_url
        || undefined;

    // Detalj-sida-fallback: vissa wp-v2-källor (t.ex. Destination Uppsala) har
    // TOMT excerpt/content/featuredmedia i API:t — allt riktigt innehåll ligger
    // på HTML-sidan. När fetchDetailPage är på och beskrivning/bild saknas,
    // hämta sidan (återanvänd om redan hämtad för datum ovan) och plocka og:/
    // twitter:-taggar. Bara träffar för fält som FAKTISKT saknas → självbegränsande
    // (källor som redan får fälten från API:t gör inga extra HTTP-anrop).
    if (cfg.fetchDetailPage && e.link && (!description || !imageUrl)) {
        if (!detailHtml) detailHtml = await fetchDetailHtml(e.link, cfg, signal);
        if (detailHtml) {
            if (!description) description = findMetaDescription(detailHtml) ?? '';
            if (!imageUrl) imageUrl = findMetaImage(detailHtml);
        }
    }

    // Venue: leta i content → excerpt → HTML detalsida om vi redan hämtat den
    const venueName = findVenueInText(String(e.content?.rendered || ''))
        || findVenueInText(String(e.excerpt?.rendered || ''))
        || (detailHtml ? findVenueInHtml(detailHtml) : undefined);

    // Lägg in terms i description så classifyEvent i runnern fångar dem ("konsert", "musik" etc)
    const termsHint = categoryFromTerms(e);
    if (termsHint) description = `${description} ${termsHint}`.trim();

    return {
        externalId: e.id ? String(e.id) : undefined,
        title,
        startDate: start,
        url: e.link || cfg.baseUrl,
        venueName,
        city: cfg.defaultCity,
        description,
        imageUrl,
    };
}

export const wpRestEngine = async (
    config: WpRestConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const variant = config.variant ?? 'tribe';
    const endpoint = endpointFor(config);
    const pageSize = config.pageSize ?? 50;
    const maxPages = config.maxPages ?? 20;
    const results: RawEvent[] = [];

    // Tribe stödjer `start_date` som filter — be om bara fönster
    const startStr = ctx.windowStart.toISOString().slice(0, 10);
    const endStr = ctx.windowEnd.toISOString().slice(0, 10);

    // wp-v2: default på — vi behöver featured image + terms
    const useEmbed = variant === 'wp-v2' && (config.embed ?? true);

    for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams();
        params.set('per_page', String(pageSize));
        params.set('page', String(page));
        if (variant === 'tribe') {
            params.set('start_date', startStr);
            params.set('end_date', endStr);
        }
        if (useEmbed) params.set('_embed', '1');
        const url = `${config.baseUrl.replace(/\/$/, '')}${endpoint}?${params.toString()}`;

        ctx.log(`page ${page}: ${url}`);
        const data = await fetchJson(url, config, ctx.signal);
        if (!data) {
            ctx.log(`  no data — stopping`);
            break;
        }

        const items: any[] =
            variant === 'tribe'
                ? (Array.isArray(data.events) ? data.events : [])
                : (Array.isArray(data) ? data : []);

        if (items.length === 0) {
            ctx.log(`  empty page — stopping`);
            break;
        }

        // wp/v2 med fetchDetailPage gör många HTTP-anrop — gör dem parallellt
        // (domainLimiter throttles inom samma domän så detta är säkert)
        const evs = variant === 'tribe'
            ? items.map((it) => tribeToRawEvent(it)).filter((x): x is RawEvent => !!x)
            : (await Promise.all(items.map((it) => wpV2ToRawEvent(it, config, ctx.windowStart, ctx.signal))))
                .filter((x): x is RawEvent => !!x);
        results.push(...evs);

        if (items.length < pageSize) break; // sista sidan
    }

    return results;
};
