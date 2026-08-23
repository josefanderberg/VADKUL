/**
 * JSON-LD engine — generisk extraktor av schema.org Event-objekt.
 *
 * En överraskande stor andel av eventsajter levererar strukturerad data via
 * `<script type="application/ld+json">`. Den här motorn:
 *   1. Hämtar en eller flera list-/kategori-URLs
 *   2. Plockar ut alla JSON-LD-block och rekurserar genom dem
 *   3. Mappar varje Event/MusicEvent/TheaterEvent/etc. till RawEvent
 *
 * Config (alla optional utom `urls`):
 *   urls:           string[]          — sidor att hämta
 *   acceptedTypes?: string[]          — vilka @types räknas som event (default: alla "*Event")
 *   userAgent?:     string            — custom UA (default: vanlig Chrome-UA)
 *   timeoutMs?:     number            — default 20000
 *   pathFilter?:    string            — kräv att event-URL innehåller denna substring
 *                                       (för att skilja artist-sidor från event-sidor)
 *   followItemListLinks?: boolean     — om sidan ger ItemList med separata event-länkar,
 *                                       följ dem för fullständig data (default false)
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import type { Browser } from 'puppeteer';

// Lazy import — puppeteer laddas bara om någon källa har useBrowser=true.
// Sparar startup-tid + minne för vanliga fetch-bara källor.
let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
    if (_browser) return _browser;
    const puppeteer = await import('puppeteer');
    _browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
    return _browser;
}
export async function closeJsonLdBrowser(): Promise<void> {
    if (_browser) { await _browser.close(); _browser = null; }
}

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// schema.org event-typer vi accepterar (alla *Event-subklasser)
export const DEFAULT_EVENT_TYPES = new Set([
    'Event', 'MusicEvent', 'TheaterEvent', 'ComedyEvent', 'DanceEvent',
    'Festival', 'ExhibitionEvent', 'EducationEvent', 'SportsEvent',
    'BusinessEvent', 'ChildrensEvent', 'LiteraryEvent', 'ScreeningEvent',
    'SocialEvent', 'VisualArtsEvent', 'FoodEvent',
]);

export interface JsonLdConfig {
    urls: string[];
    acceptedTypes?: string[];
    userAgent?: string;
    timeoutMs?: number;
    pathFilter?: string;
    followItemListLinks?: boolean;
    /**
     * Om true: använd Puppeteer för att hämta sidan så JS hinner rendera
     * JSON-LD innan vi läser den. Krävs för SPA:er (Visit Stockholm m.fl.)
     * som inte server-renderar event-strukturen. Mycket långsammare.
     */
    useBrowser?: boolean;
    /** Hur länge vi väntar efter networkidle2 (default 2500ms) */
    browserSettleMs?: number;
}

async function fetchPage(url: string, cfg: JsonLdConfig, signal?: AbortSignal): Promise<string | null> {
    if (cfg.useBrowser) return fetchRendered(url, cfg);
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? 20_000, label: url });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/** Hämta sida via Puppeteer för SPA:er — låt JS rendera innan vi läser HTML. */
async function fetchRendered(url: string, cfg: JsonLdConfig): Promise<string | null> {
    await domainLimiter.wait(url);
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent(cfg.userAgent ?? DEFAULT_UA);
        // Blockera bilder/fonter — vi vill bara HTML + JSON-LD
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: cfg.timeoutMs ?? 30000 });
        await new Promise((r) => setTimeout(r, cfg.browserSettleMs ?? 2500));
        return await page.content();
    } catch {
        return null;
    } finally {
        await page.close();
    }
}

/** Avkodar HTML-entiteter i attribut-inbäddad JSON (&amp; sist för korrekthet). */
function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

/** Plocka ut alla JSON-LD-block ur en HTML-sträng. */
export function extractJsonLdBlocks(html: string): any[] {
    const blocks: any[] = [];
    const push = (raw: string) => {
        const t = raw.trim();
        if (!t) return;
        try { blocks.push(JSON.parse(t)); } catch { /* Ignorera ogiltiga JSON-LD-block */ }
    };

    // 1. Standard: JSON i script-taggens textinnehåll.
    const bodyRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = bodyRe.exec(html)) !== null) push(m[1]);

    // 2. SSR-quirk (Nuxt/React, t.ex. goteborg.com): JSON ligger i ett
    //    children="..."-attribut, HTML-entity-kodat — textinnehållet är tomt
    //    så (1) missar det. Avkoda entiteter och parsa attributvärdet.
    const attrRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*\bchildren=["']([\s\S]*?)["']\s*\/?>/gi;
    while ((m = attrRe.exec(html)) !== null) push(decodeHtmlEntities(m[1]));

    return blocks;
}

/** Rekursivt gå igenom JSON-LD och samla alla event-objekt. */
export function collectEvents(node: any, accepted: Set<string>, out: any[]): void {
    if (!node) return;
    if (Array.isArray(node)) {
        node.forEach((n) => collectEvents(n, accepted, out));
        return;
    }
    if (typeof node !== 'object') return;

    // @graph: containerformat
    if (Array.isArray(node['@graph'])) collectEvents(node['@graph'], accepted, out);

    // ItemList: itemListElement -> array of ListItem -> item
    if (Array.isArray(node.itemListElement)) {
        for (const li of node.itemListElement) {
            collectEvents(li?.item ?? li, accepted, out);
        }
    }

    // Är detta själv ett event?
    const t = node['@type'];
    const types = Array.isArray(t) ? t : [t];
    if (types.some((x) => typeof x === 'string' && accepted.has(x))) {
        out.push(node);
    }
}

function pickImage(img: any): string | undefined {
    if (!img) return undefined;
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) return pickImage(img[0]);
    if (typeof img === 'object') return img.url || img.contentUrl;
    return undefined;
}

/**
 * Plockar pris ur schema.org offers. Hanterar:
 *   - enstaka Offer: { price }
 *   - AggregateOffer: { lowPrice, highPrice }
 *   - flera Offers (array): tar min–max → intervall
 * Returnerar en sträng: "Gratis", "150", eller "150–300" (utan valuta — webben
 * lägger på "kr"). undefined om inget pris hittas.
 */
function pickPrice(offers: any): string | undefined {
    if (!offers) return undefined;

    const nums: number[] = [];
    const collect = (o: any) => {
        if (!o || typeof o !== 'object') return;
        // AggregateOffer
        for (const key of ['lowPrice', 'highPrice', 'price']) {
            const v = o[key];
            if (v !== undefined && v !== null && v !== '') {
                const n = parseFloat(String(v).replace(',', '.'));
                if (!isNaN(n)) nums.push(n);
            }
        }
    };

    if (Array.isArray(offers)) offers.forEach(collect);
    else collect(offers);

    if (nums.length === 0) return undefined;

    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (min === 0 && max === 0) return 'Gratis';
    if (min === max) return String(min);
    return `${min}–${max}`;
}

function pickGeo(loc: any): [number, number] | undefined {
    const geo = loc?.geo;
    if (!geo) return undefined;
    const lat = parseFloat(geo.latitude);
    const lng = parseFloat(geo.longitude);
    if (isNaN(lat) || isNaN(lng)) return undefined;
    return [lat, lng];
}

function pickUrl(node: any): string {
    if (typeof node.url === 'string') return node.url;
    if (node.offers?.url && typeof node.offers.url === 'string') return node.offers.url;
    if (Array.isArray(node.offers) && node.offers[0]?.url) return node.offers[0].url;
    return '';
}

/**
 * Härled start/slut ur ett event-node. Föredrar direkt `startDate`. Saknas den
 * men `eventSchedule` finns (schema.org Schedule, ofta en array av veckovisa
 * körningar — t.ex. en teaterföreställning som spelas hela sommaren) väljer vi
 * det närmaste KOMMANDE Schedule-datumet (annars det sista). Ett event per node,
 * med nästa speltillfälle — samma "en RawEvent per URL"-modell som resten.
 * Additivt: triggar bara när direkt startDate saknas, så källor med startDate
 * påverkas inte.
 */
function resolveSchedule(node: any): { start?: string; end?: string } {
    // startDate som ARRAY (storateatern.se: alla speldatum i en lista) — behandla
    // som schema och välj nästa kommande. Tidigare blev `new Date(array)` Invalid
    // → text-fallback gav 21 konserter samma dag utan klockslag (2026-08-20).
    if (Array.isArray(node.startDate)) {
        const ends: any[] = Array.isArray(node.endDate) ? node.endDate : [];
        const occurrences = node.startDate.map((d: any, i: number) => ({ startDate: d, endDate: ends[i] }));
        return resolveSchedule({ eventSchedule: occurrences });
    }
    if (node.startDate) return { start: node.startDate, end: node.endDate };
    const sched = node.eventSchedule;
    if (!sched) return {};
    const arr = Array.isArray(sched) ? sched : [sched];
    const dated = arr
        .filter((s: any) => s && s.startDate)
        .map((s: any) => ({ start: String(s.startDate), end: s.endDate ? String(s.endDate) : undefined, t: new Date(s.startDate).getTime() }))
        .filter((s) => !isNaN(s.t))
        .sort((a, b) => a.t - b.t);
    if (dated.length === 0) return {};
    const now = Date.now();
    const pick = dated.find((s) => s.t >= now) ?? dated[dated.length - 1];
    return { start: pick.start, end: pick.end };
}

export function jsonLdToRawEvent(node: any, baseUrl: string): RawEvent | null {
    const sched = resolveSchedule(node);
    if (!node.name || !sched.start) return null;

    let url = pickUrl(node);
    if (url && url.startsWith('/')) {
        try { url = new URL(url, baseUrl).toString(); } catch { /* ignore */ }
    }
    if (!url) url = baseUrl;

    const startDate = new Date(sched.start);
    if (isNaN(startDate.getTime())) return null;

    const endDate = sched.end ? new Date(sched.end) : undefined;
    const loc = Array.isArray(node.location) ? node.location[0] : node.location;
    const address = loc?.address;

    return {
        externalId: node['@id'] || node.identifier,
        title: String(node.name).trim(),
        startDate,
        endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
        url,
        venueName: loc?.name,
        city: address?.addressLocality,
        address: address?.streetAddress,
        coords: pickGeo(loc),
        description: node.description ? String(node.description).trim() : undefined,
        imageUrl: pickImage(node.image),
        organizer: node.organizer?.name,
        price: pickPrice(node.offers),
    };
}

export const jsonLdEngine = async (
    config: JsonLdConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const accepted = new Set(config.acceptedTypes ?? DEFAULT_EVENT_TYPES);
    const seen = new Set<string>();
    const results: RawEvent[] = [];

    for (const url of config.urls) {
        ctx.log(`fetching ${url}`);
        const html = await fetchPage(url, config, ctx.signal);
        if (!html) {
            ctx.log(`  failed: no HTML`);
            continue;
        }

        const blocks = extractJsonLdBlocks(html);
        const nodes: any[] = [];
        for (const b of blocks) collectEvents(b, accepted, nodes);
        ctx.log(`  ${blocks.length} JSON-LD block(s), ${nodes.length} event node(s)`);

        for (const node of nodes) {
            const ev = jsonLdToRawEvent(node, url);
            if (!ev) continue;
            if (config.pathFilter && !ev.url.includes(config.pathFilter)) continue;
            if (seen.has(ev.url)) continue;
            seen.add(ev.url);
            results.push(ev);
        }
    }

    return results;
};
