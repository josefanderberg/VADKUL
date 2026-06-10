/**
 * rodakorset.ts — Röda Korsets lokalföreningars kalendarium.
 *
 * Svenska Röda Korset kör Optimizely/EPiServer med en öppen Content Delivery API.
 * Alla lokalkretsars kalenderhändelser ligger som CalendarPage under
 * /ort/<region>/<kommun>/kalendarium/<slug>/ och listas i huvud-sitemapen.
 * Pipeline (à la Hembygd, men per-event istället för per-site):
 *
 *   1. sitemap.xml → alla /kalendarium/<slug>/-URL:er (~380)
 *   2. GET /api/episerver/v3.0/content?contentUrl=<url> → strukturerat event
 *      (öppet, ingen auth). Behåll status=Published, CalendarPage, framtida datum.
 *
 * startDateTime är ISO-8601 UTC ("2026-09-25T08:00:00Z") → new Date() ger rätt UTC
 * direkt (till skillnad från de TZ-lösa scrapern). Adress: addressLine1 + kommun
 * (ur URL:en) geocodas. Inrikes only. url = event-URL (unik dedup-nyckel).
 *
 * Smoke-test: RK_MAX_EVENTS=<n>.
 */

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

const SITE = 'https://www.rodakorset.se';
const API = `${SITE}/api/episerver/v3.0/content`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_EVENTS = process.env.RK_MAX_EVENTS ? parseInt(process.env.RK_MAX_EVENTS, 10) : Infinity;
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

const prop = (v: any): string => (v && typeof v === 'object' ? v.value : v) ?? '';

/** "ystads-kommun" → "Ystad" (gissning för geocoding-stad). */
function kommunFromUrl(url: string): string {
    const m = url.match(/\/ort\/[^/]+\/([^/]+?)(?:-kommun)?\//i);
    if (!m) return '';
    return m[1].replace(/-/g, ' ').replace(/s$/i, '').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function scrapeRodaKorset(): Promise<number> {
    console.log('[RödaKorset] Hämtar kalendarium-URL:er ur sitemap…');
    const urls = await discoverEventUrls();
    console.log(`[RödaKorset] ${urls.length} kalendarium-URL:er — hämtar via Content-API…`);

    const todayIso = new Date().toISOString().slice(0, 10);
    const geoCache = new Map<string, [number, number] | null>();
    let saved = 0, scanned = 0, future = 0;

    await mapPool(urls, CONCURRENCY, async (url) => {
        if (saved >= MAX_EVENTS) return;
        scanned++;
        try {
            if (await eventExistsInDb(url)) return;
            const c = await fetchContent(url);
            if (!c) return;

            const types: string[] = Array.isArray(c.contentType) ? c.contentType : [];
            if (!types.includes('CalendarPage')) return;
            if (prop(c.status) && prop(c.status) !== 'Published') return;

            const startIso = prop(c.startDateTime);
            if (!startIso || startIso.slice(0, 10) < todayIso) return;
            const when = new Date(startIso); // ISO UTC (Z) → korrekt
            if (isNaN(when.getTime())) return;
            future++;
            if (saved >= MAX_EVENTS) return;

            const title = (prop(c.heading) || c.name || '').toString().trim();
            if (!title) return;
            const hasSpecificTime = !(when.getUTCHours() === 0 && when.getUTCMinutes() === 0);

            const address = prop(c.addressLine1).toString().trim();
            const kommun = kommunFromUrl(url);
            const geoKey = [address, kommun].filter(Boolean).join(', ') || kommun;

            let lat = 0, lng = 0;
            if (geoKey) {
                if (!geoCache.has(geoKey)) geoCache.set(geoKey, await geocodeVenueSweden(geoKey));
                const hit = geoCache.get(geoKey);
                if (hit) { lat = hit[0]; lng = hit[1]; }
            }

            const description = prop(c.mainBody).toString()
                .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

            await addEventToDb({
                title,
                url,
                time: when,
                hasSpecificTime,
                locationName: address ? `${address}${kommun ? `, ${kommun}` : ''}` : (kommun ? `${kommun}, Röda Korset` : 'Röda Korset'),
                lat: lat || 0,
                lng: lng || 0,
                hostName: kommun ? `Röda Korset ${kommun}` : 'Röda Korset',
                category: classifyEvent(title, description),
                createdAt: new Date(),
                coverImage: null,
                price: '',
                description,
                isLocationVerified: !!(lat && lng),
            });
            saved++;
        } catch (err) {
            console.error('  [RödaKorset] event-fel:', (err as Error).message);
        }
    });

    console.log(`[RödaKorset] Klar — ${saved} nya event (${future} framtida av ${scanned} skannade).`);
    return saved;
}

if (require.main === module) {
    scrapeRodaKorset()
        .then((n) => { console.log(`Totalt sparat: ${n}`); process.exit(0); })
        .catch((e) => { console.error(e); process.exit(1); });
}
