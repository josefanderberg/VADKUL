/**
 * hembygd — Engine för hela Sveriges Hembygdsförbund-nätverket via plattforms-API:t.
 *
 * En enda engine täcker ~1988 hembygdsföreningar. Pipeline:
 *   1. /api/siteSearch/GetAllSites            → 26 regioner (parentSiteList)
 *   2. /api/siteSearch?region=<r>             → regionens föreningar (childSites)
 *      Vi behåller de med noFActivities>0 (övriga kan omöjligt ha framtida event).
 *   3. /api/<siteId>/activities               → förenings aktiviteter (array)
 *      Filtrera published && !archived && date >= fönsterstart.
 *
 * Datum "2026-06-13T13:00:00" tolkas som lokal Stockholmstid (samma konvention som
 * övriga engines). Koordinat: aktivitetens lat/long → annars föreningens → annars
 * geocode-kandidat "<location>, Sverige". URL: www.hembygd.se/<siteId>?a=<id>
 * (unik nyckel som landar på föreningssidan; SPA:ns aktivitets-route saknar server-URL).
 *
 * Körs via registryt: `npm run sources -- --ids=hembygd [--dry-run]`
 * Begränsa vid smoke-test: config.maxSites i registryt.
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const BASE = 'https://www.hembygd.se';
const UA = 'Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36';
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

/**
 * Mappa en aktivitet → RawEvent. null = hoppa över (opublicerad/arkiverad/ogiltig).
 * Exporterad för test.
 */
export function mapHembygdActivity(a: any, f: Forening): RawEvent | null {
    if (!a?.published || a?.archived || !a?.header) return null;

    const startDate = new Date(a.date);   // lokal Stockholmstid (ISO utan TZ)
    if (isNaN(startDate.getTime())) return null;

    const location = (a.location || '').toString().trim();
    const lat = a.lat && a.lat !== 0 ? a.lat : f.lat;
    const lng = a.long && a.long !== 0 ? a.long : f.lng;

    return {
        title: a.header.toString().trim(),
        url: `${BASE}/${f.siteId}?a=${a.id}`,
        startDate,
        venueName: location ? `${location}, ${f.name}` : f.name,
        coords: lat && lng ? [lat, lng] : undefined,
        geocodeCandidates: location ? [`${location}, Sverige`] : [],
        hostName: f.name,
        imageUrl: a.image || undefined,
        price: a.isPaid ? (a.priceForNonMembers || '') : (a.isPaid === false ? 'Gratis' : ''),
        description: cleanDescription(a.preamble || a.textContent || a.description),
    };
}

export const hembygdEngine: Engine = async (config, ctx) => {
    ctx.log('upptäcker föreningar via plattforms-API…');
    let foreningar = await discoverForeningar();
    const maxSites: number | undefined = config?.maxSites;
    if (maxSites) foreningar = foreningar.slice(0, maxSites);
    ctx.log(`${foreningar.length} föreningar med aktiviteter — hämtar events…`);

    const windowStartIso = ctx.windowStart.toISOString().slice(0, 10);
    const events: RawEvent[] = [];
    let scanned = 0, withEvents = 0;

    await mapPool(foreningar, CONCURRENCY, async (f) => {
        scanned++;
        if (scanned % 200 === 0) ctx.log(`…${scanned}/${foreningar.length} föreningar, ${events.length} kandidater`);
        const acts = await fetchJson(`${BASE}/api/${f.siteId}/activities`);
        if (!Array.isArray(acts)) return;

        // Grovfilter på datumsträngen (billigt) — runnern gör den exakta fönsterkollen.
        const upcoming = acts.filter((a: any) => (a?.date || '').slice(0, 10) >= windowStartIso);
        let added = 0;
        for (const a of upcoming) {
            const mapped = mapHembygdActivity(a, f);
            if (mapped) { events.push(mapped); added++; }
        }
        if (added > 0) withEvents++;
    });

    ctx.log(`${events.length} kandidater från ${withEvents} föreningar (av ${foreningar.length} skannade)`);
    return events;
};
