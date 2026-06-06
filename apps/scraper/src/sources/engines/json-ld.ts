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

/** Plocka ut alla JSON-LD-block ur en HTML-sträng. */
export function extractJsonLdBlocks(html: string): any[] {
    const blocks: any[] = [];
    const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(html)) !== null) {
        try {
            blocks.push(JSON.parse(m[1].trim()));
        } catch {
            // Ignorera ogiltiga JSON-LD-block
        }
    }
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

export function jsonLdToRawEvent(node: any, baseUrl: string): RawEvent | null {
    if (!node.name || !node.startDate) return null;

    let url = pickUrl(node);
    if (url && url.startsWith('/')) {
        try { url = new URL(url, baseUrl).toString(); } catch { /* ignore */ }
    }
    if (!url) url = baseUrl;

    const startDate = new Date(node.startDate);
    if (isNaN(startDate.getTime())) return null;

    const endDate = node.endDate ? new Date(node.endDate) : undefined;
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
        price: node.offers?.price ? String(node.offers.price) : undefined,
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
