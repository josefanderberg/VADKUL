/**
 * naturskyddsforeningen.ts — Naturskyddsföreningens rikstäckande kalender.
 *
 * Som Svenska kyrkan: ETT nationellt endpoint aggregerar alla lokalavdelningars/
 * kretsars event. Decoupled WordPress + Next.js — backend är ett öppet GraphQL:
 *
 *   POST https://admin.naturskyddsforeningen.se/graphql
 *   query searchContent(string, context:"calendar", view:"grid", filters:{page:N})
 *        { totalCount maxPage result }
 *
 * Ingen auth/nyckel. Paginering: filters.page 1..maxPage (10/sida).
 * Varje result har redan koordinater + bild → minimal geocoding.
 *
 * Datum: URL-slugen slutar på "-YYYY-MM-DD" (renaste ISO-källan). timeString
 * "18.00–20.00" → starttid. dateString kan vara ett intervall ("15 april 2026–
 * 12 december 2026") så vi föredrar slug-datumet. Alla event är inrikes.
 *
 * Smoke-test: NSF_MAX_PAGES=<n>.
 */

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

const GRAPHQL = 'https://admin.naturskyddsforeningen.se/graphql';
const SITE = 'https://www.naturskyddsforeningen.se';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_PAGES = process.env.NSF_MAX_PAGES ? parseInt(process.env.NSF_MAX_PAGES, 10) : Infinity;
const PAGE_DELAY_MS = 250;

const QUERY =
    'query($s:String,$c:searchContext!,$v:searchView,$f:JSON){' +
    'searchContent(string:$s,context:$c,view:$v,filters:$f){totalCount maxPage result}}';

async function fetchPage(page: number): Promise<any | null> {
    try {
        const r = await fetch(GRAPHQL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': UA },
            body: JSON.stringify({ query: QUERY, variables: { s: '', c: 'calendar', v: 'grid', f: { page } } }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) { console.error(`  [Naturskydd] HTTP ${r.status} på sida ${page}`); return null; }
        const j = await r.json();
        return j?.data?.searchContent || null;
    } catch (err) {
        console.error('  [Naturskydd] fetch-fel:', (err as Error).message);
        return null;
    }
}

/** Plocka starttid ur "18.00–20.00" / "18:00" → {h,m} eller null (heldag). */
function parseStartTime(timeString: string): { h: number; m: number } | null {
    const m = (timeString || '').match(/(\d{1,2})[.:](\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    return { h, m: mi };
}

export async function scrapeNaturskyddsforeningen(): Promise<number> {
    console.log('[Naturskydd] Hämtar rikstäckande kalender via GraphQL…');
    const todayIso = new Date().toISOString().slice(0, 10);
    const geoCache = new Map<string, [number, number] | null>();
    let saved = 0, scanned = 0, page = 1, maxPage = 1;

    while (page <= maxPage && page <= MAX_PAGES) {
        const data = await fetchPage(page);
        if (!data || !Array.isArray(data.result)) break;
        maxPage = data.maxPage || maxPage;

        for (const e of data.result) {
            scanned++;
            try {
                const title = (e.title || '').toString().trim();
                const path = (e.url || '').toString();
                if (!title || !path) continue;

                // ISO-datum ur slugen (…-YYYY-MM-DD). Annars hoppa (intervall/oklart).
                const dm = path.match(/(\d{4})-(\d{2})-(\d{2})\/?$/);
                if (!dm) continue;
                const dateStr = `${dm[1]}-${dm[2]}-${dm[3]}`;
                if (dateStr < todayIso) continue;

                const t = parseStartTime(e.timeString || '');
                const hasSpecificTime = !!t;
                // Lokal Stockholmstid (ISO utan TZ tolkas som lokal, samma som övriga scrapers).
                const when = new Date(`${dateStr}T${t ? String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0') : '00:00'}:00`);
                if (isNaN(when.getTime())) continue;

                const url = `${SITE}${path.startsWith('/') ? path : '/' + path}`;
                if (await eventExistsInDb(url)) continue;

                const organizer = (e.organizer || 'Naturskyddsföreningen').toString().trim();
                const location = (e.location || '').toString().trim();

                let lat = e.coordinates?.lat || 0;
                let lng = e.coordinates?.lng || 0;
                if ((!lat || !lng) && location) {
                    if (!geoCache.has(location)) geoCache.set(location, await geocodeVenueSweden(location));
                    const c = geoCache.get(location);
                    if (c) { lat = c[0]; lng = c[1]; }
                }

                const description = (e.excerpt || '')
                    .toString().replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
                    .replace(/\[…\]|\[\.\.\.\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);

                await addEventToDb({
                    title,
                    url,
                    time: when,
                    hasSpecificTime,
                    locationName: location ? `${location}, ${organizer}` : organizer,
                    lat: lat || 0,
                    lng: lng || 0,
                    hostName: organizer,
                    category: classifyEvent(title, description),
                    createdAt: new Date(),
                    coverImage: e.image?.url || null,
                    price: '',
                    description,
                    isLocationVerified: !!(lat && lng),
                });
                saved++;
            } catch (err) {
                console.error('  [Naturskydd] event-fel:', (err as Error).message);
            }
        }

        if (page % 10 === 0) console.log(`[Naturskydd] …sida ${page}/${maxPage}, ${saved} sparade`);
        page++;
        if (page <= maxPage) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }

    console.log(`[Naturskydd] Klar — ${saved} nya event (${scanned} skannade, ${page - 1} sidor).`);
    return saved;
}

if (require.main === module) {
    scrapeNaturskyddsforeningen()
        .then((n) => { console.log(`Totalt sparat: ${n}`); process.exit(0); })
        .catch((e) => { console.error(e); process.exit(1); });
}
