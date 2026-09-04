/**
 * Next.js __NEXT_DATA__ engine.
 *
 * Många Next.js-sajter (Visit Stockholm m.fl.) injektar all sin server-data
 * i en `<script id="__NEXT_DATA__" type="application/json">` i HTML:n.
 * Vi kan plocka events därifrån utan Puppeteer — bara fetch.
 *
 * Config:
 *   urls:        string[]            — sidor att hämta
 *   jsonPaths?:  string[]            — paths in i __NEXT_DATA__ där event-arrayer ligger.
 *                                      T.ex. ['props.pageProps.componentProps.events']
 *                                      Default: auto-discovery
 *   fieldMap?:                       — explicit fältmappning vid behov
 *   defaultCity?:                    — fallback om venue/city saknas
 *   userAgent?:
 *   timeoutMs?:
 *
 * Discovery-läge (utan jsonPaths): scanna hela __NEXT_DATA__ rekursivt efter
 * arrayer av objekt med title+date-fält.
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { cleanDescription } from '../../utils/text';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface NextjsDataConfig {
    urls: string[];
    jsonPaths?: string[];
    fieldMap?: {
        title?: string;
        startDate?: string;
        endDate?: string;
        url?: string;
        image?: string;
        venue?: string;
        city?: string;
        description?: string;
    };
    defaultCity?: string;
    userAgent?: string;
    timeoutMs?: number;
    /** Discovery-läge: bara logga vad vi hittade, returnera tom. */
    discoverOnly?: boolean;
}

async function fetchHtml(url: string, cfg: NextjsDataConfig, signal?: AbortSignal): Promise<string | null> {
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
            redirect: 'follow',
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? 20_000, label: url });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/** Plocka ut JSON-blocket ur __NEXT_DATA__. */
function extractNextData(html: string): any | null {
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
}

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

function isEventLike(item: any): boolean {
    if (!isObject(item)) return false;
    const keys = Object.keys(item).map((k) => k.toLowerCase());
    const hasTitle = keys.some((k) => /^(title|name|heading|headline|summary|navn)$/.test(k));
    const hasDate = keys.some((k) => /^(start_?date|date|start|when|dtstart|begins)$/.test(k));
    return hasTitle && hasDate;
}

/** Rekursivt leta upp ALLA event-liknande arrayer (inte bara första). */
function findAllEventArrays(obj: any, depth = 0, found: any[][] = []): any[][] {
    if (depth > 8 || obj == null) return found;
    if (Array.isArray(obj)) {
        if (obj.length > 0 && isEventLike(obj[0])) {
            found.push(obj);
            return found; // Stoppa här — inte rekursera in i en redan-upptäckt array
        }
        for (const item of obj) findAllEventArrays(item, depth + 1, found);
        return found;
    }
    if (isObject(obj)) {
        for (const v of Object.values(obj)) findAllEventArrays(v, depth + 1, found);
    }
    return found;
}

function pickField(item: any, alts: string[]): any {
    if (!isObject(item)) return undefined;
    for (const k of Object.keys(item)) {
        if (alts.includes(k.toLowerCase())) return item[k];
    }
    return undefined;
}

function pickImageString(v: any): string | undefined {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return pickImageString(v[0]);
    if (isObject(v)) {
        // Föredra större varianter om de finns
        const renditions = v.renditions;
        if (renditions && typeof renditions === 'object') {
            const pref = renditions.xlarge || renditions.large || renditions.medium || renditions.small;
            if (pref?.src) return pref.src;
        }
        return v.url || v.src || v.source_url || v.href;
    }
    return undefined;
}

function makeAbsoluteUrl(url: string | undefined, base: string): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    try { return new URL(url, base).toString(); } catch { return url; }
}

function itemToRawEvent(item: any, cfg: NextjsDataConfig, baseUrl: string): RawEvent | null {
    if (!isObject(item)) return null;

    const titleRaw = cfg.fieldMap?.title ? getPath(item, cfg.fieldMap.title) : pickField(item, ['title', 'name', 'heading']);
    const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';
    if (!title || title.length < 2) return null;

    const dateRaw = cfg.fieldMap?.startDate ? getPath(item, cfg.fieldMap.startDate) : pickField(item, ['startdate', 'start_date', 'date', 'start', 'when']);
    if (!dateRaw) return null;
    const startDate = new Date(String(dateRaw));
    if (isNaN(startDate.getTime())) return null;

    const endDateRaw = cfg.fieldMap?.endDate ? getPath(item, cfg.fieldMap.endDate) : pickField(item, ['enddate', 'end_date', 'end']);
    const endDate = endDateRaw ? new Date(String(endDateRaw)) : undefined;

    const urlRaw = cfg.fieldMap?.url ? getPath(item, cfg.fieldMap.url) : pickField(item, ['href', 'url', 'link', 'permalink']);
    const url = makeAbsoluteUrl(typeof urlRaw === 'string' ? urlRaw : undefined, baseUrl) || baseUrl;

    const imageRaw = cfg.fieldMap?.image ? getPath(item, cfg.fieldMap.image) : item.image;
    const imageUrl = makeAbsoluteUrl(pickImageString(imageRaw), baseUrl);

    const venueRaw = cfg.fieldMap?.venue ? getPath(item, cfg.fieldMap.venue) : pickField(item, ['venue', 'place', 'location']);
    let venueName: string | undefined;
    if (typeof venueRaw === 'string') venueName = venueRaw;
    else if (isObject(venueRaw)) venueName = venueRaw.name || venueRaw.title;
    // Fallback: address-fältet (Visit Stockholm har det)
    if (!venueName && typeof item.address === 'string') venueName = item.address;

    const cityRaw = cfg.fieldMap?.city ? getPath(item, cfg.fieldMap.city) : pickField(item, ['city', 'ort', 'town', 'kommun']);
    const city = typeof cityRaw === 'string' ? cityRaw : cfg.defaultCity;

    const descRaw = cfg.fieldMap?.description ? getPath(item, cfg.fieldMap.description) : pickField(item, ['description', 'excerpt', 'summary']);
    // cleanDescription strippar taggar OCH avkodar entities (&auml; → ä).
    const description = typeof descRaw === 'string' ? cleanDescription(descRaw) || undefined : undefined;

    return { title, startDate, endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined, url, venueName, city, description, imageUrl };
}

export const nextjsDataEngine = async (
    config: NextjsDataConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const events: RawEvent[] = [];
    const seenIds = new Set<string>();

    for (const url of config.urls) {
        ctx.log(`fetching ${url}`);
        const html = await fetchHtml(url, config, ctx.signal);
        if (!html) { ctx.log(`  fetch failed`); continue; }

        const data = extractNextData(html);
        if (!data) { ctx.log(`  no __NEXT_DATA__ block`); continue; }

        // Samla event-arrayer från explicit paths eller auto-discovery
        let arrays: any[][] = [];
        if (config.jsonPaths && config.jsonPaths.length > 0) {
            for (const p of config.jsonPaths) {
                const v = getPath(data, p);
                if (Array.isArray(v)) arrays.push(v);
            }
        } else {
            arrays = findAllEventArrays(data);
        }

        const totalItems = arrays.reduce((s, a) => s + a.length, 0);
        ctx.log(`  __NEXT_DATA__ ok, found ${arrays.length} event-array(s) with ${totalItems} items`);

        if (config.discoverOnly) continue;

        for (const arr of arrays) {
            for (const item of arr) {
                const ev = itemToRawEvent(item, config, url);
                if (!ev) continue;
                const dedupKey = ev.externalId || ev.url + '|' + ev.startDate.toISOString();
                if (seenIds.has(dedupKey)) continue;
                seenIds.add(dedupKey);
                events.push(ev);
            }
        }
    }

    return events;
};
