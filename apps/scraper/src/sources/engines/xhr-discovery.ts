/**
 * XHR-discovery engine — fångar interna API-anrop hos SPA:er.
 *
 * Många moderna sajter (Visit Stockholm, Göteborg & Co, Riksteatern) renderas
 * via JS. JSON-LD finns inte ens efter rendering — istället hämtar SPA:n
 * sina events från en intern JSON-endpoint. Den här motorn:
 *
 *   1. Öppnar sidan i Puppeteer
 *   2. Lyssnar på alla `response`-events
 *   3. Filtrerar fram JSON-svar som ser ut som event-listor
 *   4. Auto-mappar fält till RawEvent (eller använder explicit fieldMap)
 *
 * Två lägen:
 *   - DISCOVERY: utan `apiUrlPattern` → loggar alla kandidat-API:er
 *     (för manuell analys av nya sajter)
 *   - PRODUCTION: med `apiUrlPattern` + `fieldMap` → snäva träffar
 *
 * Config:
 *   url:           URL till sidan som ska laddas
 *   apiUrlPattern? regex för att filtrera vilka XHR-anrop som räknas
 *   jsonPath?:     dot-notation till event-array (t.ex. "data.items")
 *   fieldMap?:     explicit fältmappning för sajter med ovanliga struktur
 *   scrollToBottom? trigger lazy load
 *   waitMs?:       extra vänt efter rendering
 *   maxScrolls?:   antal gånger vi scrollar (för "load more"-mönster)
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import type { Browser, Page } from 'puppeteer';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Lazy-imported browser, delas mellan källor i samma körning
let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
    if (_browser) return _browser;
    const puppeteer = await import('puppeteer');
    _browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
    return _browser;
}
export async function closeXhrDiscoveryBrowser(): Promise<void> {
    if (_browser) { await _browser.close(); _browser = null; }
}

export interface XhrDiscoveryConfig {
    url: string;
    apiUrlPattern?: string;             // regex
    jsonPath?: string;                  // 'data.items.0.events' etc
    fieldMap?: {
        title?: string;
        startDate?: string;
        url?: string;
        image?: string;
        venue?: string;
        city?: string;
        description?: string;
    };
    scrollToBottom?: boolean;
    waitMs?: number;
    maxScrolls?: number;
    userAgent?: string;
    timeoutMs?: number;
    /** I discovery-läge: logga alla kandidatresponser och returnera tom array. */
    discoverOnly?: boolean;
    defaultCity?: string;
}

interface CapturedResponse {
    url: string;
    body: any;
}

/** Tolka dot-notation path, t.ex. "data.items" → obj.data.items. */
function getPath(obj: any, path: string): any {
    if (!path) return obj;
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = /^\d+$/.test(p) ? cur[parseInt(p, 10)] : cur[p];
    }
    return cur;
}

function isObject(x: any): boolean {
    return x != null && typeof x === 'object' && !Array.isArray(x);
}

/** Heuristik: ser det här ut som ett event-objekt? */
function isEventLike(item: any): boolean {
    if (!isObject(item)) return false;
    const keys = Object.keys(item).map((k) => k.toLowerCase());
    const hasTitle = keys.some((k) => /^(title|name|heading|headline|summary|navn|titel)$/.test(k));
    const hasDate = keys.some((k) => /^(start_?date|date|start|when|datetime|dtstart|begins)$/.test(k));
    return hasTitle && hasDate;
}

/** Rekursivt leta efter array av event-objekt. */
function findEventArray(obj: any, depth = 0): any[] | null {
    if (depth > 8 || obj == null) return null;
    if (Array.isArray(obj)) {
        if (obj.length > 0 && isEventLike(obj[0])) return obj;
        // Annars: titta in i första elementet
        if (obj.length > 0) return findEventArray(obj[0], depth + 1);
        return null;
    }
    if (!isObject(obj)) return null;
    for (const k of Object.keys(obj)) {
        const r = findEventArray(obj[k], depth + 1);
        if (r) return r;
    }
    return null;
}

/** Hämta ett fält case-insensitive från flera alternativ. */
function pickField(item: any, alternatives: string[]): any {
    if (!isObject(item)) return undefined;
    for (const k of Object.keys(item)) {
        if (alternatives.includes(k.toLowerCase())) return item[k];
    }
    return undefined;
}

function pickImageString(v: any): string | undefined {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return pickImageString(v[0]);
    if (isObject(v)) return v.url || v.src || v.source_url || v.href;
    return undefined;
}

function itemToRawEvent(item: any, cfg: XhrDiscoveryConfig): RawEvent | null {
    if (!isObject(item)) return null;

    const titleRaw = cfg.fieldMap?.title
        ? getPath(item, cfg.fieldMap.title)
        : pickField(item, ['title', 'name', 'heading', 'headline', 'summary']);
    const title = typeof titleRaw === 'string' ? titleRaw.trim()
                : titleRaw?.rendered ? String(titleRaw.rendered).trim()
                : '';
    if (!title || title.length < 2) return null;

    const dateRaw = cfg.fieldMap?.startDate
        ? getPath(item, cfg.fieldMap.startDate)
        : pickField(item, ['startdate', 'start_date', 'date', 'start', 'when', 'datetime', 'dtstart', 'begins']);
    if (!dateRaw) return null;
    const startDate = new Date(String(dateRaw));
    if (isNaN(startDate.getTime())) return null;

    const urlRaw = cfg.fieldMap?.url
        ? getPath(item, cfg.fieldMap.url)
        : pickField(item, ['url', 'link', 'href', 'permalink', 'web_url']);
    const url = typeof urlRaw === 'string' ? urlRaw : '';

    const imageRaw = cfg.fieldMap?.image
        ? getPath(item, cfg.fieldMap.image)
        : (pickField(item, ['image', 'cover_image', 'thumbnail', 'photo', 'featured_image']) ?? item.images);
    const imageUrl = pickImageString(imageRaw);

    const venueRaw = cfg.fieldMap?.venue
        ? getPath(item, cfg.fieldMap.venue)
        : pickField(item, ['venue', 'place', 'location', 'plats']);
    let venueName: string | undefined;
    if (typeof venueRaw === 'string') venueName = venueRaw;
    else if (isObject(venueRaw)) venueName = venueRaw.name || venueRaw.title;

    const cityRaw = cfg.fieldMap?.city
        ? getPath(item, cfg.fieldMap.city)
        : pickField(item, ['city', 'ort', 'town', 'kommun']);
    const city = typeof cityRaw === 'string' ? cityRaw : (cfg.defaultCity);

    const descRaw = cfg.fieldMap?.description
        ? getPath(item, cfg.fieldMap.description)
        : pickField(item, ['description', 'excerpt', 'summary', 'text', 'body']);
    const description = typeof descRaw === 'string' ? descRaw.replace(/<[^>]+>/g, '').trim()
                       : descRaw?.rendered ? String(descRaw.rendered).replace(/<[^>]+>/g, '').trim()
                       : undefined;

    return { title, startDate, url: url || cfg.url, venueName, city, description, imageUrl };
}

async function performScrolls(page: Page, max: number): Promise<void> {
    for (let i = 0; i < max; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise((r) => setTimeout(r, 1500));
    }
}

export const xhrDiscoveryEngine = async (
    config: XhrDiscoveryConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    await domainLimiter.wait(config.url);
    const browser = await getBrowser();
    const page = await browser.newPage();
    const captured: CapturedResponse[] = [];

    try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent(config.userAgent ?? DEFAULT_UA);

        // Blockera tunga resurser (bilder/fonter/video) men inte XHR
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        // Fånga JSON-svar. I discovery-läge fångar vi även responses som inte
        // har "json" i content-type — många APIs returnerar JSON med felaktig
        // header (application/octet-stream, text/plain, etc.)
        page.on('response', async (resp) => {
            try {
                const url = resp.url();
                if (config.apiUrlPattern && !new RegExp(config.apiUrlPattern, 'i').test(url)) return;
                const ct = resp.headers()['content-type'] || '';
                const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
                // Skippa uppenbart icke-JSON
                if (['html', 'css', 'js', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'woff', 'woff2', 'ico'].includes(ext || '')) return;
                if (ct.startsWith('text/html') || ct.startsWith('text/css') || ct.startsWith('image/')) return;
                if (ct.startsWith('font/') || ct.startsWith('video/') || ct.startsWith('audio/')) return;

                const text = await resp.text();
                if (!text || text.length < 10) return;
                const trimmed = text.trimStart();
                if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;
                const body = JSON.parse(text);
                captured.push({ url, body });
            } catch {
                // ignorera trasig JSON eller race-conditions
            }
        });

        await page.goto(config.url, { waitUntil: 'networkidle2', timeout: config.timeoutMs ?? 30000 });
        if (config.scrollToBottom || config.maxScrolls) {
            await performScrolls(page, config.maxScrolls ?? 1);
        }
        if (config.waitMs) await new Promise((r) => setTimeout(r, config.waitMs));
    } catch (err) {
        ctx.log(`navigation error: ${(err as Error).message}`);
    } finally {
        await page.close();
    }

    ctx.log(`captured ${captured.length} JSON response(s)`);

    // Discovery-läge: rapportera vad vi såg, returnera tom array
    if (config.discoverOnly) {
        for (const c of captured) {
            const arr = findEventArray(c.body);
            const summary = arr
                ? `🎯 ${arr.length} event-like items`
                : `(no event-array found, keys=${isObject(c.body) ? Object.keys(c.body).slice(0, 6).join(',') : 'array/scalar'})`;
            ctx.log(`  ${summary}  ← ${c.url}`);
        }
        return [];
    }

    // Produktionsläge: extrahera events från första matchande svar
    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();
    for (const c of captured) {
        const arr = config.jsonPath ? getPath(c.body, config.jsonPath) : findEventArray(c.body);
        if (!Array.isArray(arr)) continue;
        for (const item of arr) {
            const ev = itemToRawEvent(item, config);
            if (!ev) continue;
            if (seenUrls.has(ev.url)) continue;
            seenUrls.add(ev.url);
            events.push(ev);
        }
    }
    return events;
};
