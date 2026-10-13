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
import { findFirstDateInText, rangeToStartText } from '../../utils/swedishDate';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { cleanDescription, decodeHtmlEntities } from '../../utils/text';
import { postalTown } from '../../utils/swedishAddress';

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
    /**
     * Venue-fallback för sajter som ÄR en enda spelplats (biograf, scen) —
     * samma som SitemapConfig.defaultVenue. Sätts bara när varken API:t eller
     * detaljsidan gav en plats. Utan den hamnade Panoras event utan plats och
     * (med tom defaultCity) på 0,0 — osynliga på kartan (78 av 79, 12/10).
     */
    defaultVenue?: string;
    /** Slå på `?_embed=1` — hämtar featured image + terms (kategorier) */
    embed?: boolean;
    /**
     * Om datum saknas i API-svaret, besök event-permalänken och hämta datumet
     * från renderad HTML. Långsammare men låser upp många kommunsajter där
     * content/excerpt är tomt i wp/v2 men datumet syns på sidan.
     */
    fetchDetailPage?: boolean;
    /**
     * Riktad datum-extraktion ur detaljsidans HTML: regex vars CAPTURE-GRUPP 1
     * pekar ut texten med eventdatumet (t.ex. JetEngine:s
     * jet-listing-dynamic-field-div på blacksheeparms). När satt används
     * ENBART regex-träffen — helsides-skanningen är avstängd, eftersom den
     * annars nappar på ovidkommande datum (öppettider i sidfoten m.m.).
     * Ingen träff ⇒ eventet får inget datum (hellre bortfall än fel dag).
     */
    detailDateRegex?: RegExp;
    /**
     * Riktad datum-extraktion ur API:ts content.rendered (CAPTURE-GRUPP 1 =
     * sidans egen datumruta) — för sajter där content renderar HELA sidan,
     * inklusive "Mer i kalendern"-puffar med ANDRA events datum. Örebro läns
     * museum 12/10: fritext-skanningen hoppade över passerade "fredag 7
     * augusti" och tog puffens "26 oktober" (14 av 19 event samma dag).
     * När satt är träffen ENDA datumkällan: varken fritext-skanningen eller
     * detaljsidans helsides-skanning körs (hellre bortfall än fel dag).
     * Se dateFromContentRegex för intervall och "Tid:"-etiketten.
     */
    contentDateRegex?: RegExp;
    /**
     * Detaljsidans EGET platsblock (wp-v2): regexar vars CAPTURE-GRUPP 1 pekar
     * ut platsnamnet resp. adressen, och för koordinater grupp 1+2 (lat, lng).
     * Adeprimo-temat på vemdalen.se: <h4 class="event-location-title">,
     * <p class="event-location-address"> och kartans "…&q=62.48,13.97".
     * Satt → detaljsidan hämtas för nya URL:er även när brödtexten gav en
     * fritextgissning, och blocket vinner över den. Postorten i adressen
     * ("846 94 Vemdalen") slår defaultCity. Utan blocket låg 28 Vemdalen/
     * Klövsjö-event på null-ön med locationName "Sverige" (12/10).
     */
    detailPlace?: WpDetailPlace;
}

export interface WpDetailPlace {
    venue?: RegExp;
    address?: RegExp;
    coords?: RegExp;
}

/**
 * Eventdatumet ur den utpekade datumrutan (WpRestConfig.contentDateRegex).
 * Intervall ("26–27 oktober") → startdagen, och etiketten "Tid:"/"Tider:"
 * mellan datum och klockslag tas bort så "Datum: onsdag 28 oktober Tid: kl.
 * 16.00" ger 16:00 i stället för ett heldagsevent. null utan träff.
 *
 * Årsvakt: rutan skriver oftast datum UTAN år, som gissas framåt från idag.
 * "22 augusti" i en post publicerad i maj 2026 blev då 2027-08-22 — ett
 * spök-event som dyker upp på kartan nästa sommar. Mer än ett år efter
 * publiceringen (`published`, WP:s post-datum) ⇒ gissningen slog fel ⇒ null.
 */
export function dateFromContentRegex(html: string, re: RegExp, now: Date, published?: Date): Date | null {
    const m = html.match(re);
    if (!m?.[1]) return null;
    const text = rangeToStartText(decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ')))
        .replace(/\btid(?:er)?\s*:\s*/gi, ' ')
        .replace(/,/g, ' ');
    const date = findFirstDateInText(text, now);
    if (!date) return null;
    if (published && !isNaN(published.getTime()) && date.getTime() - published.getTime() > 365 * 86_400_000) return null;
    return date;
}

/**
 * Datumet ur detaljsidans utpekade fält (WpRestConfig.detailDateRegex):
 * capture-grupp 1 i FÖRSTA träffen, kommatecken → mellanslag så "Tor 29 okt,
 * 18:15" behåller klockslaget. Passerat datum med veckodag ("Sön 19 apr")
 * ger null via veckodagskontrollen i findFirstDateInText. null även när
 * regexen inte träffar — då hoppas eventet över.
 */
export function dateFromDetailRegex(html: string, re: RegExp, now: Date): Date | null {
    const m = html.match(re);
    if (!m?.[1]) return null;
    return findFirstDateInText(m[1].replace(/,/g, ' '), now);
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

/**
 * HTML → text som BEHÅLLER radbrytningarna: <br> och block-slut blir \n,
 * övriga taggar mellanslag. Platsregexarna stoppar på \n. Med allt hopslaget
 * till mellanslag åt "Plats: Ovikens gamla kyrka<br />Torsdag 8 oktober kl
 * 19.00" upp datumraden, geokodningen missade och eventet hamnade mitt i
 * Östersund i stället för i Oviken (community-kritik 2026-10-08).
 */
export function htmlToLines(html: string): string {
    return html
        .replace(/<br\s*\/?>|<\/(?:p|div|li|dd|dt|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/[^\S\n]+/g, ' ')
        .replace(/ *\n[\s]*/g, '\n')
        .trim();
}

/** Försök extrahera venue ur HTML — t.ex. <dl><dt>Plats</dt><dd>Trollsjön</dd></dl> */
export function findVenueInHtml(html: string): string | undefined {
    if (!html) return undefined;
    // <dt>Plats</dt><dd>X</dd>  — vanligt i kommun-event-sidor
    const dtdd = html.match(/<dt[^>]*>\s*(?:plats|var|venue)\s*<\/dt>\s*<dd[^>]*>([^<]{2,80})</i);
    if (dtdd) return dtdd[1].trim();
    // "Plats: X" i ren text
    const inline = htmlToLines(html).match(/\b(?:plats|var)\s*[:：]\s*([A-ZÅÄÖ][^.!?\n,]{2,60})/i);
    if (inline) return inline[1].trim();
    return undefined;
}

/**
 * Plats ur detaljsidans platsblock enligt WpRestConfig.detailPlace. Ren
 * funktion. Koordinater bara när båda talen är giltiga — runnern validerar
 * dessutom mot nordiska bounds. Ort ur adressens postnummer.
 */
export function placeFromDetailHtml(html: string, rx: WpDetailPlace):
    { venueName?: string; address?: string; city?: string; coords?: [number, number] } {
    const grab = (re?: RegExp): string | undefined => {
        const m = re ? html.match(re) : null;
        const v = m?.[1] ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
        return v || undefined;
    };
    const venueName = grab(rx.venue);
    const address = grab(rx.address);
    const city = postalTown(address) ?? undefined;
    const cm = rx.coords ? html.match(rx.coords) : null;
    const lat = cm ? parseFloat(cm[1]) : NaN;
    const lng = cm ? parseFloat(cm[2]) : NaN;
    return {
        ...(venueName ? { venueName } : {}),
        ...(address ? { address } : {}),
        ...(city ? { city } : {}),
        ...(Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { coords: [lat, lng] as [number, number] } : {}),
    };
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

// Full entitetsavkodning (svenska tecken, numeriska, dubbelkodade) — den lokala
// minitabellen som bara tog &amp;/&quot;/… lämnade &auml; m.fl. råa i texten.
const decodeEntities = decodeHtmlEntities;

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

export function tribeToRawEvent(e: any, defaultCity?: string): RawEvent | null {
    if (!e?.title || !e?.start_date) return null;
    const start = parseTribeDate(e.start_date);
    if (!start) return null;
    const end = parseTribeDate(e.end_date) || undefined;

    const venue = Array.isArray(e.venue) ? e.venue[0] : e.venue;
    // Ingen venue alls (Tribe ger då `venue: []`) → källans defaultCity. Förr
    // ignorerade tribe-varianten defaultCity helt: Gotlands Museum (Visby) och
    // Medley (Malmö) hamnade på null-ön som "Sverige" (12/10). Event MED venue
    // rörs inte — deras plats kommer som förut ur venue-objektet.
    const city = venue ? venue.city : (defaultCity || undefined);
    const coords: [number, number] | undefined =
        venue?.geo_lat && venue?.geo_lng
            ? [parseFloat(venue.geo_lat), parseFloat(venue.geo_lng)]
            : undefined;

    return {
        externalId: e.id ? String(e.id) : undefined,
        title: decodeEntities(String(e.title)).trim(),
        startDate: start,
        endDate: end || undefined,
        url: e.url || e.website || '',
        venueName: venue?.venue,
        city,
        address: venue?.address,
        coords,
        // cleanDescription strippar taggar OCH avkodar entities — den nakna
        // tag-strippen lämnade &auml; osv. råa i beskrivningen.
        description: e.description
            ? cleanDescription(e.description, 600) || undefined
            : (e.excerpt ? cleanDescription(e.excerpt, 600) || undefined : undefined),
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
/** Synlig brödtext ur HTML: bort med head/script/style/nav/footer + taggar. */
function visibleText(html: string): string {
    return html
        .replace(/<head[\s\S]*?<\/head>/i, ' ')
        .replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ');
}

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
const VENUE_FALSE_POSITIVES = /^(facebook|instagram|tiktok|youtube|spotify|datum|dat|tid|tider|plats|när|var|info|information|anmälan|pris|kostnad|avgift|ålder|sveriges|svenska|alla|nya|en|ett)$/i;
// Etikettord i början av kandidaten ("Dat" ur "Datum:", "Pris 160 kr") — ingen plats.
const VENUE_LABEL_START = /^(?:dat(?:um)?|tid(?:er)?|när|var|plats|info(?:rmation)?|anmälan|pris|kostnad|avgift|ålder|kl)(?!\p{L})/iu;

export function findVenueInText(text: string): string | undefined {
    if (!text) return undefined;
    const clean = htmlToLines(text);
    // "på Helsingborgs Konserthus", "vid Sofiero slott", "i Ångfärjeparken"
    const patterns = [
        /\bplats:\s*([A-ZÅÄÖ][^.!?\n]{2,40})/i, // "Plats: X" är starkast
        // Mellanslag, inte \s: frasen får inte fortsätta över en radbrytning.
        /\bpå +([A-ZÅÄÖ][\wåäöÅÄÖ&-]+(?: +[A-ZÅÄÖ][\wåäöÅÄÖ&-]+){0,3})/,
        /\bvid +([A-ZÅÄÖ][\wåäöÅÄÖ&-]+(?: +[A-ZÅÄÖ][\wåäöÅÄÖ&-]+){0,3})/,
    ];
    for (const p of patterns) {
        const m = clean.match(p);
        if (!m || !m[1]) continue;
        const candidate = m[1].trim().replace(/\s+(datum|tid|när)\b.*$/i, ''); // strip "Sofiero DATUM:"
        // Filtrera bort all-caps single-words (DATUM, TID), falska positiva, för kort
        if (candidate.length < 3 || candidate.length > 60) continue;
        if (/^[A-ZÅÄÖ]{2,}$/.test(candidate)) continue;
        if (VENUE_FALSE_POSITIVES.test(candidate)) continue;
        if (VENUE_LABEL_START.test(candidate)) continue;   // "Dat" (Visit Piteå 2026-09-04)
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

async function wpV2ToRawEvent(
    e: any,
    cfg: WpRestConfig,
    now: Date,
    signal?: AbortSignal,
    opts: { allowDetailFetch?: boolean } = {},
): Promise<RawEvent | null> {
    // WP REST HTML-enkodar titlar (&#038; &amp; &#8211;) — avkoda enligt encoding-guarden
    const title = e?.title?.rendered ? decodeEntities(String(e.title.rendered)).trim() : null;
    if (!title) return null;
    // WPML/Polylang levererar översättningar som EGNA poster i samma API —
    // Visit Piteå gav engelska dubbletter ("Knit and read at Öjebyn library").
    // Hoppa språkprefixade permalänkar när källans baseUrl inte själv är på det språket.
    const link = String(e.link ?? '');
    if (/\/(en|de|fi|no|da)\//i.test(link.replace(/^https?:\/\/[^/]+/, '')) && !/\/(en|de|fi|no|da)\/?$/i.test(cfg.baseUrl)) return null;

    // 1. Standardfält först
    const dateRaw = e.meta?.event_date || e.meta?.start_date || e.acf?.start_date;
    let start: Date | null = dateRaw ? new Date(dateRaw) : null;

    // 2. Om de saknas eller är publication date: scanna title + content + excerpt
    //    — eller BARA den utpekade datumrutan när contentDateRegex är satt.
    if (!start || isNaN(start.getTime()) || looksLikePublishDate(e.date, now)) {
        if (cfg.contentDateRegex) {
            const published = e.date ? new Date(e.date) : undefined;
            const own = dateFromContentRegex(String(e.content?.rendered || ''), cfg.contentDateRegex, now, published);
            if (own) start = own;
        } else {
            const haystack = [
                String(e.title?.rendered || ''),
                String(e.excerpt?.rendered || ''),
                String(e.content?.rendered || ''),
            ].join(' ');
            const scanned = findFirstDateInText(haystack, now);
            if (scanned) start = scanned;
        }
    }

    // 3. Sista utvägen: hämta event-permalänken som HTML och leta där
    //    (inte med contentDateRegex — rutan var enda datumkällan).
    let detailHtml: string | null = null;
    let detailVenue: string | undefined;
    if ((!start || isNaN(start.getTime())) && cfg.fetchDetailPage && e.link && !cfg.contentDateRegex) {
        detailHtml = await fetchDetailHtml(e.link, cfg, signal);
        if (detailHtml) {
            if (cfg.detailDateRegex) {
                // Riktad extraktion — skanna BARA utpekat element (se config-doc).
                const scanned = dateFromDetailRegex(detailHtml, cfg.detailDateRegex, now);
                if (scanned) start = scanned;
            } else {
                // SYNLIG text, inte rå HTML: <head> bär article:modified_time
                // (ISO) som annars vinner över eventets "2 oktober" i brödtexten
                // — så fick Visit Piteå 77 event på publiceringsdagen (2026-08-20).
                // Etiketterade rader ("Nästa tillfälle: Fredag, 2 oktober 21:00
                // Studio Acusticum") är säkrast och ger dessutom venue.
                const visible = visibleText(detailHtml);
                const labeled = visible.match(/(?:Nästa tillfälle|Nästa datum|Datum|När|Tid)\s*:\s*([^.]{0,120})/i);
                const fromLabel = labeled ? findFirstDateInText(labeled[1].replace(/,/g, ' '), now) : null;
                if (fromLabel) {
                    start = fromLabel;
                    const afterTime = labeled![1].match(/\d{1,2}[:.]\d{2}\s+([A-ZÅÄÖ][^|]{2,70}?)(?=\s+(?:Boka|Köp|Biljett|Läs mer|Priser|Fri entré|Mer info)|$)/);
                    if (afterTime?.[1]) detailVenue = afterTime[1].trim();
                } else {
                    const scanned = findFirstDateInText(visible, now);
                    if (scanned) start = scanned;
                }
            }
        }
    }

    if (!start || isNaN(start.getTime())) return null;

    // Description: excerpt om det är ett RIKTIGT (handskrivet) utdrag, annars
    // hela content. WP:s AUTO-excerpt är bara de första ~55 orden + "[…]"/"…"
    // — det gav 300+ beskrivningar som slutade i "…" (Visit Norrköping/
    // Eskilstuna, Norrköpings konstmuseum, revisionen 2026-09-03).
    // cleanDescription avkodar entities (WP:s rendered-HTML är alltid kodad)
    // och klipper vid ordgräns (DEFAULT_DESCRIPTION_MAX).
    const excerptRaw = String(e.excerpt?.rendered || '');
    const excerptIsAuto = /\[(?:…|\.\.\.|&hellip;)\]|(?:…|\.\.\.|&hellip;)\s*(?:<\/p>\s*)*$/i.test(excerptRaw);
    const excerpt = excerptRaw ? cleanDescription(excerptRaw) : '';
    const content = e.content?.rendered ? cleanDescription(e.content.rendered) : '';
    let description = excerpt && !(excerptIsAuto && content.length > excerpt.length)
        ? excerpt
        : (content || excerpt);

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
    let venueName = detailVenue
        || findVenueInText(String(e.content?.rendered || ''))
        || findVenueInText(String(e.excerpt?.rendered || ''))
        || (detailHtml ? findVenueInHtml(detailHtml) : undefined);
    // Ingen plats i API-texten → hämta detaljsidan (bara nya URL:er) och läs
    // "Plats:"/<dt>Plats</dt>. Visit Piteå: 59 av 114 event låg på stadens
    // mittpunkt fast sidan anger t.ex. Framnäs folkhögskola i Öjebyn (2026-09-04).
    // Med detailPlace hämtas sidan även när fritexten gav en gissning — blocket vinner.
    if ((!venueName || cfg.detailPlace) && cfg.fetchDetailPage && e.link && opts.allowDetailFetch !== false) {
        if (!detailHtml) detailHtml = await fetchDetailHtml(e.link, cfg, signal);
        if (detailHtml && !venueName) venueName = findVenueInHtml(detailHtml);
    }
    const place: ReturnType<typeof placeFromDetailHtml> =
        cfg.detailPlace && detailHtml ? placeFromDetailHtml(detailHtml, cfg.detailPlace) : {};

    // WP-termer ("konsert", "musik & underhållning") går till klassificeraren
    // via classifyHints — INTE in i beskrivningen (läckte som taggsoppa på korten).
    const termsHint = categoryFromTerms(e);

    return {
        externalId: e.id ? String(e.id) : undefined,
        title,
        startDate: start,
        url: e.link || cfg.baseUrl,
        venueName: place.venueName || venueName,
        city: place.city || cfg.defaultCity,
        ...(place.address ? { address: place.address } : {}),
        ...(place.coords ? { coords: place.coords } : {}),
        description,
        imageUrl,
        classifyHints: termsHint,
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
            ? items.map((it) => tribeToRawEvent(it, config.defaultCity)).filter((x): x is RawEvent => !!x)
            : (await Promise.all(items.map(async (it) => {
                // Detaljsida för plats bara för NYA URL:er (kända refreshas var 4:e körning).
                const link = it?.link ? String(it.link) : '';
                const known = !!link && !ctx.refreshKnown && !!ctx.isKnownUrl && await ctx.isKnownUrl(link);
                return wpV2ToRawEvent(it, config, ctx.windowStart, ctx.signal, { allowDetailFetch: !known });
            })))
                .filter((x): x is RawEvent => !!x);
        // En-venue-sajt: platsen sist, bara där API/detaljsida inte gav någon.
        if (config.defaultVenue) {
            for (const ev of evs) if (!ev.venueName) ev.venueName = config.defaultVenue;
        }
        results.push(...evs);

        if (items.length < pageSize) break; // sista sidan
    }

    return results;
};
