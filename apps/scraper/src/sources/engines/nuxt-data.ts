/**
 * Nuxt 3 __NUXT_DATA__ engine.
 *
 * Nuxt 3 lagrar SSR-data i `<script id="__NUXT_DATA__" type="application/json">`
 * MEN i ett devalue-komprimerat format: top-level är en flat array där varje
 * objekt har integer-värden som pekar på andra index i samma array.
 *
 * Exempel:
 *   data[5] = {"id": 6, "date": 7, "title": 12, ...}
 *   data[6] = 15899                          ← id-värdet
 *   data[7] = "2021-01-20T15:26:40"          ← date-värdet
 *   data[12] = {"rendered": 13}              ← nästlad struktur
 *   data[13] = "title text"                  ← det riktiga titel-strängen
 *
 * Vi dereferenserar rekursivt för att rekonstruera den semantiska JSON:en.
 *
 * Config — samma som nextjs-data:
 *   urls, fieldMap, defaultCity, jsonPaths, discoverOnly, userAgent, timeoutMs
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { findFirstDateInText } from '../../utils/swedishDate';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface NuxtDataConfig {
    urls: string[];
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
    discoverOnly?: boolean;
}

async function fetchHtml(url: string, cfg: NuxtDataConfig): Promise<string | null> {
    await domainLimiter.wait(url);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), cfg.timeoutMs ?? 20000);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
            redirect: 'follow',
            signal: ac.signal,
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

function extractNuxtData(html: string): any[] | null {
    const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return null;
    try {
        const parsed = JSON.parse(m[1]);
        return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
}

function isObject(x: any): boolean {
    return x != null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Rekursivt dereferensa ett devalue-index. Cache:ar resultat för att hantera
 * cykliska referenser och undvika exponentiell tid.
 */
function deref(data: any[], idx: number, cache = new Map<number, any>()): any {
    if (cache.has(idx)) return cache.get(idx);
    if (idx < 0 || idx >= data.length) return undefined;

    const val = data[idx];

    // Primitiver returneras som är
    if (val == null || typeof val !== 'object') {
        cache.set(idx, val);
        return val;
    }

    // Array: dereferensa varje element
    if (Array.isArray(val)) {
        const out: any[] = [];
        cache.set(idx, out);
        for (const v of val) {
            out.push(typeof v === 'number' ? deref(data, v, cache) : v);
        }
        return out;
    }

    // Object: dereferensa varje fält
    const out: any = {};
    cache.set(idx, out);
    for (const [k, v] of Object.entries(val)) {
        out[k] = typeof v === 'number' ? deref(data, v, cache) : v;
    }
    return out;
}

/** Identifiera "event-shape" raw-objekt i datan (innan dereference). */
function isRawEventLike(item: any): boolean {
    if (!isObject(item)) return false;
    const keys = Object.keys(item).map((k) => k.toLowerCase());
    const hasTitle = keys.some((k) => /^(title|name|heading|headline)$/.test(k));
    const hasDate = keys.some((k) => /^(start_?date|date|start|when|dtstart)$/.test(k));
    // Filtrera bort metadata-objekt som råkar ha date+title
    // Riktiga event har också ofta id, link/href, eller content
    const hasIdentity = keys.some((k) => /^(id|link|href|url|slug|permalink)$/.test(k));
    return hasTitle && hasDate && hasIdentity;
}

function isObjectField(v: any): boolean {
    return v && typeof v === 'object';
}

function pickField(item: any, alts: string[]): any {
    if (!isObject(item)) return undefined;
    for (const k of Object.keys(item)) {
        if (alts.includes(k.toLowerCase())) return item[k];
    }
    return undefined;
}

function unwrapRendered(v: any): string | undefined {
    if (v == null) return undefined;
    if (typeof v === 'string') return v;
    if (isObject(v) && typeof v.rendered === 'string') return v.rendered;
    return undefined;
}

function pickImageString(v: any): string | undefined {
    if (!v) return undefined;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return pickImageString(v[0]);
    if (isObject(v)) return v.url || v.src || v.source_url || v.href;
    return undefined;
}

function makeAbsoluteUrl(url: string | undefined, base: string): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    try { return new URL(url, base).toString(); } catch { return url; }
}

function itemToRawEvent(item: any, cfg: NuxtDataConfig, baseUrl: string): RawEvent | null {
    if (!isObject(item)) return null;

    const titleRaw = pickField(item, ['title', 'name', 'heading']);
    const title = unwrapRendered(titleRaw)?.trim();
    if (!title || title.length < 2) return null;

    const dateRaw = pickField(item, ['startdate', 'start_date', 'date', 'start', 'when']);
    const dateStr = typeof dateRaw === 'string' ? dateRaw : (isObjectField(dateRaw) ? (dateRaw as any).start || (dateRaw as any).date : undefined);
    let startDate = dateStr ? new Date(String(dateStr)) : null;

    // Fallback / förbättring: om datumet är >7 dagar i bakåt så är det
    // antagligen WP:s publish-date — scanna content/excerpt/information efter
    // riktigt event-datum i fritext.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (!startDate || isNaN(startDate.getTime()) || startDate < sevenDaysAgo) {
        const haystack = [
            unwrapRendered(pickField(item, ['title', 'name'])),
            unwrapRendered(pickField(item, ['content'])),
            unwrapRendered(pickField(item, ['excerpt'])),
            isObject(pickField(item, ['information'])) ? JSON.stringify(pickField(item, ['information'])) : undefined,
        ].filter(Boolean).join(' ');
        const scanned = findFirstDateInText(haystack);
        if (scanned) startDate = scanned;
    }
    if (!startDate || isNaN(startDate.getTime())) return null;

    const endStr = pickField(item, ['enddate', 'end_date', 'end']);
    const endDate = endStr ? new Date(String(endStr)) : undefined;

    const urlRaw = pickField(item, ['link', 'url', 'href', 'permalink']);
    const url = makeAbsoluteUrl(typeof urlRaw === 'string' ? urlRaw : undefined, baseUrl) || baseUrl;

    // Bilder: WP-style featured_media via _embedded eller direkt image-fält
    const embedded = pickField(item, ['_embedded']);
    let imageUrl: string | undefined;
    if (isObject(embedded) && Array.isArray((embedded as any)['wp:featuredmedia'])) {
        imageUrl = pickImageString((embedded as any)['wp:featuredmedia'][0]);
    }
    if (!imageUrl) {
        imageUrl = pickImageString(pickField(item, ['image', 'featured_image', 'thumbnail', 'cover_image']));
    }
    imageUrl = makeAbsoluteUrl(imageUrl, baseUrl);

    /** Säkerhetsnät: returnera bara string-värden för venue */
    const asString = (v: any): string | undefined => {
        if (v == null) return undefined;
        if (typeof v === 'string') return v.trim() || undefined;
        if (isObject(v)) {
            const candidate = v.rendered || v.name || v.title || v.label || v.text;
            return typeof candidate === 'string' ? candidate.trim() || undefined : undefined;
        }
        return undefined;
    };

    let venueName = asString(pickField(item, ['venue', 'place', 'location', 'plats']));
    // information-fält i vissa Nuxt-WP-feeder
    if (!venueName) {
        const info = pickField(item, ['information']);
        if (isObject(info)) {
            venueName = asString((info as any).venue) || asString((info as any).place) || asString((info as any).address);
        }
    }
    // _embedded.location från WP Tribe
    if (!venueName) {
        const embedded = pickField(item, ['_embedded']);
        if (isObject(embedded)) {
            const loc = (embedded as any).location;
            venueName = asString(Array.isArray(loc) ? loc[0] : loc);
        }
    }

    const cityRaw = pickField(item, ['city', 'ort', 'town', 'kommun']);
    const city = typeof cityRaw === 'string' ? cityRaw : cfg.defaultCity;

    const descRaw = pickField(item, ['description', 'excerpt', 'summary']);
    const description = unwrapRendered(descRaw)?.replace(/<[^>]+>/g, '').trim();

    return { title, startDate, endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined, url, venueName, city, description, imageUrl };
}

export const nuxtDataEngine = async (
    config: NuxtDataConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();

    for (const url of config.urls) {
        ctx.log(`fetching ${url}`);
        const html = await fetchHtml(url, config);
        if (!html) { ctx.log(`  fetch failed`); continue; }

        const data = extractNuxtData(html);
        if (!data) { ctx.log(`  no __NUXT_DATA__ block`); continue; }
        ctx.log(`  __NUXT_DATA__: ${data.length} items in flat array`);

        // Scan ALLA index, dereferensa varje objekt, filtrera event-like
        // (samma cache används för alla index så vi inte upprepar arbete)
        const cache = new Map<number, any>();
        let rawCandidates = 0;
        let derefedEvents = 0;

        for (let i = 0; i < data.length; i++) {
            const raw = data[i];
            if (!isRawEventLike(raw)) continue;
            rawCandidates++;
            const derefed = deref(data, i, cache);
            const ev = itemToRawEvent(derefed, config, url);
            if (!ev) continue;
            if (seenUrls.has(ev.url)) continue;
            seenUrls.add(ev.url);
            events.push(ev);
            derefedEvents++;
        }

        ctx.log(`  raw candidates: ${rawCandidates}, valid events: ${derefedEvents}`);
        if (config.discoverOnly && events.length > 0) {
            const sample = events[0];
            ctx.log(`  sample: "${sample.title}" @ ${sample.startDate.toISOString()} — ${sample.url}`);
        }
    }

    return config.discoverOnly ? [] : events;
};
