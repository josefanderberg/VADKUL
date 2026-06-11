/**
 * naturskyddsforeningen — Engine för Naturskyddsföreningens rikstäckande kalender.
 *
 * Som Svenska kyrkan: ETT nationellt endpoint aggregerar alla lokalavdelningars/
 * kretsars event. Decoupled WordPress + Next.js — backend är ett öppet GraphQL:
 *
 *   POST https://admin.naturskyddsforeningen.se/graphql
 *   query searchContent(string, context:"calendar", view:"grid", filters:{page:N})
 *        { totalCount maxPage result }
 *
 * Ingen auth/nyckel. Paginering: filters.page 1..maxPage (10/sida). API:t saknar
 * datumfilter → vi hämtar alla sidor; runnern fönster-filtrerar.
 * Varje result har redan koordinater + bild → minimal geocoding.
 *
 * Datum: URL-slugen slutar på "-YYYY-MM-DD" (renaste ISO-källan). timeString
 * "18.00–20.00" → starttid. dateString kan vara ett intervall ("15 april 2026–
 * 12 december 2026") så vi föredrar slug-datumet. Alla event är inrikes.
 *
 * Körs via registryt: `npm run sources -- --ids=naturskyddsforeningen [--dry-run]`
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const GRAPHQL = 'https://admin.naturskyddsforeningen.se/graphql';
const SITE = 'https://www.naturskyddsforeningen.se';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_DELAY_MS = 250;
const SAFETY_PAGE_CAP = 200;   // 200×10 = 2000 event — långt över normal volym (~465)

const QUERY =
    'query($s:String,$c:searchContext!,$v:searchView,$f:JSON){' +
    'searchContent(string:$s,context:$c,view:$v,filters:$f){totalCount maxPage result}}';

async function fetchPage(page: number, log: (msg: string) => void): Promise<any | null> {
    try {
        const r = await fetch(GRAPHQL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': UA },
            body: JSON.stringify({ query: QUERY, variables: { s: '', c: 'calendar', v: 'grid', f: { page } } }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!r.ok) { log(`HTTP ${r.status} på sida ${page}`); return null; }
        const j = await r.json();
        return j?.data?.searchContent || null;
    } catch (err) {
        log(`fetch-fel: ${(err as Error).message}`);
        return null;
    }
}

/** Plocka starttid ur "18.00–20.00" / "18:00" → {h,m} eller null (heldag). Exporterad för test. */
export function parseStartTime(timeString: string): { h: number; m: number } | null {
    const m = (timeString || '').match(/(\d{1,2})[.:](\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    return { h, m: mi };
}

/**
 * Mappa ett GraphQL-result → RawEvent. null = hoppa över (saknar slug-datum/titel).
 * Exporterad för test.
 */
export function mapNsfEvent(e: any): RawEvent | null {
    const title = (e?.title || '').toString().trim();
    const path = (e?.url || '').toString();
    if (!title || !path) return null;

    // ISO-datum ur slugen (…-YYYY-MM-DD). Annars hoppa (intervall/oklart).
    const dm = path.match(/(\d{4})-(\d{2})-(\d{2})\/?$/);
    if (!dm) return null;
    const dateStr = `${dm[1]}-${dm[2]}-${dm[3]}`;

    const t = parseStartTime(e.timeString || '');
    // Lokal Stockholmstid (ISO utan TZ tolkas som lokal, samma som övriga engines).
    const startDate = new Date(`${dateStr}T${t ? String(t.h).padStart(2, '0') + ':' + String(t.m).padStart(2, '0') : '00:00'}:00`);
    if (isNaN(startDate.getTime())) return null;

    const organizer = (e.organizer || 'Naturskyddsföreningen').toString().trim();
    const location = (e.location || '').toString().trim();
    const lat = e.coordinates?.lat || 0;
    const lng = e.coordinates?.lng || 0;

    return {
        title,
        url: `${SITE}${path.startsWith('/') ? path : '/' + path}`,
        startDate,
        venueName: location ? `${location}, ${organizer}` : organizer,
        coords: lat && lng ? [lat, lng] : undefined,
        geocodeCandidates: location ? [location] : [],
        hostName: organizer,
        imageUrl: e.image?.url || undefined,
        description: cleanDescription(e.excerpt),
    };
}

export const naturskyddsforeningenEngine: Engine = async (_config, ctx) => {
    const events: RawEvent[] = [];
    let scanned = 0, page = 1, maxPage = 1;

    while (page <= maxPage && page <= SAFETY_PAGE_CAP) {
        const data = await fetchPage(page, ctx.log);
        if (!data || !Array.isArray(data.result)) break;
        maxPage = data.maxPage || maxPage;

        for (const e of data.result) {
            scanned++;
            const mapped = mapNsfEvent(e);
            if (mapped) events.push(mapped);
        }

        if (page % 10 === 0) ctx.log(`…sida ${page}/${maxPage}, ${events.length} kandidater`);
        page++;
        if (page <= maxPage) await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
    }

    ctx.log(`${page - 1} sidor, ${events.length} kandidater (${scanned} skannade)`);
    return events;
};
