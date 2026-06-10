/**
 * hembygd.ts — Hela Sveriges Hembygdsförbund-nätverket via plattforms-API:t.
 *
 * En enda scraper täcker ~1988 hembygdsföreningar. Pipeline:
 *   1. /api/siteSearch/GetAllSites            → 26 regioner (parentSiteList)
 *   2. /api/siteSearch?region=<r>             → regionens föreningar (childSites)
 *      Vi behåller de med noFActivities>0 (övriga kan omöjligt ha framtida event).
 *   3. /api/<siteId>/activities               → förenings aktiviteter (array)
 *      Filtrera published && !archived && date >= idag.
 *
 * Datum "2026-06-13T13:00:00" tolkas som lokal Stockholmstid (samma konvention som
 * övriga scrapers). Koordinat: aktivitetens lat/long → annars föreningens →
 * annars geocoda location → annars 0. URL: www.hembygd.se/<siteId>?a=<id> (unik
 * nyckel som landar på föreningssidan; SPA:ns aktivitets-route saknar server-URL).
 *
 * Begränsa vid behov: HEMBYGD_MAX_SITES=<n> (smoke-test).
 */

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenue } from '../utils/venueCoordinates';

const BASE = 'https://www.hembygd.se';
const UA = 'Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36';
const MAX_SITES = process.env.HEMBYGD_MAX_SITES ? parseInt(process.env.HEMBYGD_MAX_SITES, 10) : Infinity;
const CONCURRENCY = 12;

interface Forening { siteId: string; name: string; lat: number; lng: number; region: string; }

async function fetchJson(url: string): Promise<any> {
    try {
        const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    }
}

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

/** Hämta alla föreningar (med ≥1 katalogaktivitet) över alla regioner. */
async function discoverForeningar(): Promise<Forening[]> {
    const all = await fetchJson(`${BASE}/api/siteSearch/GetAllSites`);
    const regions: string[] = (all?.parentSiteList || []).map((r: any) => r.siteId).filter(Boolean);
    const out: Forening[] = [];
    const perRegion = await mapPool(regions, 8, (r) => fetchJson(`${BASE}/api/siteSearch?region=${r}`));
    for (const rd of perRegion) {
        for (const c of rd?.childSites || []) {
            if ((c.noFActivities || 0) <= 0 || !c.siteId) continue;
            out.push({ siteId: c.siteId, name: c.name || c.siteId, lat: c.lat || 0, lng: c.lng || 0, region: c.regionName || 'Sverige' });
        }
    }
    return out;
}

export async function scrapeHembygd(): Promise<number> {
    console.log('[Hembygd] Upptäcker föreningar via plattforms-API…');
    let foreningar = await discoverForeningar();
    if (Number.isFinite(MAX_SITES)) foreningar = foreningar.slice(0, MAX_SITES);
    console.log(`[Hembygd] ${foreningar.length} föreningar med aktiviteter — hämtar events…`);

    const todayIso = new Date().toISOString().slice(0, 10);
    const geoCache = new Map<string, [number, number] | null>();
    let saved = 0, scanned = 0, withEvents = 0;

    await mapPool(foreningar, CONCURRENCY, async (f) => {
        scanned++;
        if (scanned % 200 === 0) console.log(`[Hembygd] …${scanned}/${foreningar.length} föreningar, ${saved} events`);
        const acts = await fetchJson(`${BASE}/api/${f.siteId}/activities`);
        if (!Array.isArray(acts)) return;
        const future = acts.filter((a: any) => a?.published && !a?.archived && (a.date || '').slice(0, 10) >= todayIso && a.header);
        if (!future.length) return;
        withEvents++;

        for (const a of future) {
            try {
                const url = `${BASE}/${f.siteId}?a=${a.id}`;
                if (await eventExistsInDb(url)) continue;

                const when = new Date(a.date); // lokal Stockholmstid (ISO utan TZ)
                if (isNaN(when.getTime())) continue;
                const hasSpecificTime = !(when.getHours() === 0 && when.getMinutes() === 0);

                const location = (a.location || '').toString().trim();
                let lat = a.lat && a.lat !== 0 ? a.lat : f.lat;
                let lng = a.long && a.long !== 0 ? a.long : f.lng;
                if ((!lat || !lng) && location) {
                    const key = `${location}, Sverige`;
                    if (!geoCache.has(key)) geoCache.set(key, await geocodeVenue(key));
                    const c = geoCache.get(key);
                    if (c) { lat = c[0]; lng = c[1]; }
                }

                const description = (a.preamble || a.textContent || a.description || '').toString().replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

                await addEventToDb({
                    title: a.header.toString().trim(),
                    url,
                    time: when,
                    hasSpecificTime,
                    locationName: location ? `${location}, ${f.name}` : f.name,
                    lat: lat || 0,
                    lng: lng || 0,
                    hostName: f.name,
                    category: classifyEvent(a.header, description),
                    createdAt: new Date(),
                    coverImage: a.image || null,
                    price: a.isPaid ? (a.priceForNonMembers || '') : (a.isPaid === false ? 'Gratis' : ''),
                    description,
                    isLocationVerified: !!(lat && lng),
                });
                saved++;
            } catch (err) {
                console.error(`  [Hembygd] fel (${f.siteId}):`, (err as Error).message);
            }
        }
    });

    console.log(`[Hembygd] Klar — ${saved} events från ${withEvents} föreningar (av ${foreningar.length} skannade).`);
    return saved;
}
