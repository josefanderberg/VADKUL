/**
 * rodakorset — Engine för Röda Korsets lokalföreningars kalendarium.
 *
 * Svenska Röda Korset kör Optimizely/EPiServer med en öppen Content Delivery API.
 * Alla lokalkretsars kalenderhändelser ligger som CalendarPage under
 * /ort/<region>/<kommun>/kalendarium/<slug>/ och listas i huvud-sitemapen.
 * Pipeline (à la Hembygd, men per-event istället för per-site):
 *
 *   1. sitemap.xml → alla /kalendarium/<slug>/-URL:er (~380)
 *   2. GET /api/episerver/v3.0/content?contentUrl=<url> → strukturerat event
 *      (öppet, ingen auth). Behåll status=Published, CalendarPage.
 *
 * Kända URL:er (redan i DB) hoppas över FÖRE content-API-anropet via ctx.isKnownUrl
 * — sparar ~hundratals API-anrop per natt i steady state.
 *
 * startDateTime är ISO-8601 UTC ("2026-09-25T08:00:00Z") → new Date() ger rätt UTC
 * direkt. Adress: addressLine1 + kommun (ur URL:en) som geocode-kandidater.
 * Inrikes only. url = event-URL (unik dedup-nyckel).
 *
 * Körs via registryt: `npm run sources -- --ids=roda-korset [--dry-run]`
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const SITE = 'https://www.rodakorset.se';
const API = `${SITE}/api/episerver/v3.0/content`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CONCURRENCY = 10;

async function mapPool<T, R>(items: T[], limit: number, fn: (it: T) => Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) break;
            out[i] = await fn(items[i]);
        }
    }));
    return out;
}

/** Hämta alla kalendarium-event-URL:er ur sitemapen. */
async function discoverEventUrls(): Promise<string[]> {
    try {
        const r = await fetch(`${SITE}/sitemap.xml`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
        if (!r.ok) return [];
        const xml = await r.text();
        const urls = (xml.match(/https:\/\/[^<\s]*\/kalendarium\/[^<\s]+/gi) || [])
            .map((u) => u.trim())
            .filter((u, i, a) => a.indexOf(u) === i);
        return urls;
    } catch {
        return [];
    }
}

async function fetchContent(url: string): Promise<any | null> {
    try {
        const r = await fetch(`${API}?contentUrl=${encodeURIComponent(url)}`, {
            headers: { 'User-Agent': UA, accept: 'application/json' },
            signal: AbortSignal.timeout(15_000),
        });
        if (!r.ok) return null;
        const j = await r.json();
        return Array.isArray(j) ? j[0] : j;
    } catch {
        return null;
    }
}

/** EPiServer-properties är ibland {value}-wrappade. Exporterad för test. */
export const prop = (v: any): string => (v && typeof v === 'object' ? v.value : v) ?? '';

/** "ystads-kommun" → "Ystad" (gissning för geocoding-stad). Exporterad för test. */
export function kommunFromUrl(url: string): string {
    const m = url.match(/\/ort\/[^/]+\/([^/]+?)(?:-kommun)?\//i);
    if (!m) return '';
    return m[1].replace(/-/g, ' ').replace(/s$/i, '').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Mappa ett EPiServer-content-svar → RawEvent. null = hoppa över (fel typ/
 * opublicerat/ogiltigt). Exporterad för test.
 */
export function mapRkContent(url: string, c: any): RawEvent | null {
    if (!c) return null;
    const types: string[] = Array.isArray(c.contentType) ? c.contentType : [];
    if (!types.includes('CalendarPage')) return null;
    if (prop(c.status) && prop(c.status) !== 'Published') return null;

    const startIso = prop(c.startDateTime);
    if (!startIso) return null;
    const startDate = new Date(startIso);   // ISO UTC (Z) → korrekt
    if (isNaN(startDate.getTime())) return null;

    const title = (prop(c.heading) || c.name || '').toString().trim();
    if (!title) return null;

    const address = prop(c.addressLine1).toString().trim();
    const kommun = kommunFromUrl(url);

    return {
        title,
        url,
        startDate,
        venueName: address
            ? `${address}${kommun ? `, ${kommun}` : ''}`
            : (kommun ? `${kommun}, Röda Korset` : 'Röda Korset'),
        geocodeCandidates: [...new Set([[address, kommun].filter(Boolean).join(', '), kommun].filter(Boolean))],
        hostName: kommun ? `Röda Korset ${kommun}` : 'Röda Korset',
        description: cleanDescription(prop(c.mainBody)),
    };
}

export const rodaKorsetEngine: Engine = async (_config, ctx) => {
    const urls = await discoverEventUrls();
    ctx.log(`${urls.length} kalendarium-URL:er i sitemapen`);

    let skippedKnown = 0;
    const mapped = await mapPool(urls, CONCURRENCY, async (url): Promise<RawEvent | null> => {
        // Hoppa över event vi redan har — slipp content-API-anropet helt.
        if (ctx.isKnownUrl && (await ctx.isKnownUrl(url))) { skippedKnown++; return null; }
        const c = await fetchContent(url);
        return mapRkContent(url, c);
    });

    const events = mapped.filter((e): e is RawEvent => e !== null);
    ctx.log(`${events.length} kandidater (${skippedKnown} kända URL:er hoppade utan API-anrop)`);
    return events;
};
