/**
 * pro — Engine för PRO:s (Pensionärernas Riksorganisation) alla föreningsaktiviteter.
 *
 * pro.se är SiteVision; varje förening har en "vara-aktiviteter"-sida vars
 * aktivitetslista är en SiteVision WebApp med JSON-endpoint:
 *
 *   1. Föreningssidor: pro.se/sitemapindex.xml → sitemap<N>.xml.gz (gunzip!)
 *      → URL:er .../distrikt/<d>/kommun/<kommun>/<förening>/vara-aktiviteter (~970 st)
 *   2. Session: GET valfri sida → JSESSIONID-cookie (en session räcker för alla POST:ar)
 *   3. Per förening: GET sidan → `pageId: '4.<hex>'` ur HTML
 *      → POST pro.se/appresource/<pageId>/12.4d4eef20190100e8b7a784c7/activities
 *        body {"startsAfter":"<idag>","page":1,"pageSize":100} + cookien
 *      → { result: { totalCount, totalPages, activities: [{name, id, uri,
 *           location, startDate:{value:"2026-06-11",time:"10:00"}, endDate}] } }
 *
 * Portlet-id:t (12.4d4eef…) är KONSTANT över alla föreningar (delad mall) —
 * verifierat 2026-06-11 på Kalmar + Falköping; per-sida-fallback finns ändå.
 *
 * Serie-dedup: PRO-aktiviteter är ofta veckoåterkommande (Boule, gymnastik…)
 * med eget id per tillfälle. Vi behåller FÖRSTA kommande tillfället per
 * (förening, namn) — annars översvämmas kartan av repetitioner. (Samma skäl
 * som Korpen sköts upp; löst här på engine-nivå.)
 *
 * Kommunen ur URL-vägen blir geocoding-fallback; location.name (när satt) provas först.
 * Föreningens riktiga namn (med åäö) tas ur sidans <title>.
 *
 * Körs via registryt: `npm run sources -- --ids=pro [--dry-run]`
 * Smoke-test: config.maxSites begränsar antalet föreningar.
 */

import { gunzipSync } from 'zlib';
import { Engine, RawEvent } from '../sources/types';
import { mapPool } from '../utils/mapPool';

const SITE = 'https://pro.se';
const PORTLET_ID = '12.4d4eef20190100e8b7a784c7';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CONCURRENCY = 6;

async function fetchText(url: string): Promise<string | null> {
    try {
        const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25_000) });
        if (!r.ok) return null;
        return await r.text();
    } catch { return null; }
}

/** Sitemapparna är gzippade — hämta + gunzip + plocka vara-aktiviteter-URL:er. */
async function discoverForeningar(log: (m: string) => void): Promise<string[]> {
    const index = await fetchText(`${SITE}/sitemapindex.xml`);
    if (!index) { log('sitemapindex onåbar'); return []; }
    const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    const urls: string[] = [];
    for (const sm of sitemaps) {
        try {
            const r = await fetch(sm, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25_000) });
            if (!r.ok) continue;
            // .gz-filer KAN redan vara transport-uppackade av fetch (Content-Encoding) —
            // gunzip:a bara om magic bytes (1f 8b) faktiskt är gzip, annars är det ren XML.
            const buf = Buffer.from(await r.arrayBuffer());
            const xml = buf[0] === 0x1f && buf[1] === 0x8b
                ? gunzipSync(buf).toString('utf-8')
                : buf.toString('utf-8');
            for (const m of xml.matchAll(/<loc>([^<]*\/vara-aktiviteter)\/?<\/loc>/g)) urls.push(m[1]);
        } catch { /* nästa sitemap */ }
    }
    return [...new Set(urls)];
}

/** En JSESSIONID räcker för alla activities-POST:ar. */
async function bootCookie(url: string): Promise<string | null> {
    try {
        const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25_000) });
        const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
        return cookie || null;
    } catch { return null; }
}

/** "2026-06-11" + "10:00" → lokal Date. Exporterad för test. */
export function parseProDate(d: any): Date | null {
    const value = d?.value;
    if (!value) return null;
    const [y, mo, day] = value.split('-').map((n: string) => parseInt(n, 10));
    if (!y || !mo || !day) return null;
    const [hh, mm] = (d.time || '0:0').split(':').map((n: string) => parseInt(n, 10) || 0);
    return new Date(y, mo - 1, day, hh, mm);
}

/** Kommun-slug ur föreningens URL: .../kommun/<kommun>/... Exporterad för test. */
export function kommunFromUrl(url: string): string {
    const m = url.match(/\/kommun\/([^/]+)\//);
    return m ? m[1].replace(/-/g, ' ') : '';
}

/**
 * Föreningens riktiga namn (med åäö) ur sidans breadcrumb — sidtiteln är bara
 * "Våra aktiviteter". Breadcrumb-länken vars href är föreningens baspath har
 * namnet som text: <a href="/distrikt/…/pro-falkoping">PRO Falköping</a>.
 * Exporterad för test.
 */
export function foreningsNamn(html: string, foreningUrl: string): string {
    const path = foreningUrl.replace(/^https?:\/\/[^/]+/, '').replace(/\/vara-aktiviteter\/?$/, '');
    const m = html.match(new RegExp(`href="${path}"[^>]*>([^<]+)<`));
    return m?.[1]?.trim() || 'PRO';
}

/**
 * Administrativa möten är inte publika event: styrelse-/års-/medlemsmöten,
 * och allt från Samorganisationer (kommunala paraplyer utan egen verksamhet).
 */
const ADMIN_TITLE = /styrelsemöte|årsmöte|höstmöte|vårmöte|medlemsmöte|valberedning|samorg\b/i;

/**
 * API-aktivitet → RawEvent. hostName = föreningens riktiga namn (ur breadcrumben),
 * geocoding: location.name → kommun. Exporterad för test.
 */
export function mapProActivity(a: any, foreningUrl: string, foreningNamn: string): RawEvent | null {
    const title = (a?.name || '').toString().trim();
    if (!title || !a.uri) return null;
    if (ADMIN_TITLE.test(title) || /^samorganisation/i.test(foreningNamn)) return null;
    const startDate = parseProDate(a.startDate);
    if (!startDate) return null;

    const kommun = kommunFromUrl(foreningUrl);
    const locationName = (a.location?.name || a.location || '').toString().trim();
    const host = foreningNamn || 'PRO';

    return {
        title,
        url: `${SITE}${a.uri}`,
        externalId: a.id ? String(a.id) : undefined,
        startDate,
        endDate: parseProDate(a.endDate) ?? undefined,
        hasSpecificTime: !!a.startDate?.time && a.startDate.time !== '00:00',
        venueName: locationName || host,
        geocodeCandidates: [
            locationName && kommun ? `${locationName}, ${kommun}` : locationName,
            kommun,
        ].filter(Boolean) as string[],
        hostName: host,
        description: `${host}-aktivitet${locationName ? ` på ${locationName}` : ''}, ${kommun ? kommun[0].toUpperCase() + kommun.slice(1) : 'Sverige'}.`,
    };
}

/**
 * Serie-dedup: behåll första kommande tillfället per (förening, normaliserat namn).
 * Exporterad för test.
 */
export function dedupeSeries(events: RawEvent[]): RawEvent[] {
    const byKey = new Map<string, RawEvent>();
    for (const e of events) {
        const key = `${e.hostName}|${e.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
        const prev = byKey.get(key);
        if (!prev || e.startDate < prev.startDate) byKey.set(key, e);
    }
    return [...byKey.values()];
}

export const proEngine: Engine = async (config, ctx) => {
    let foreningar = await discoverForeningar(ctx.log);
    ctx.log(`${foreningar.length} föreningssidor i sitemapen`);
    const maxSites: number | undefined = config?.maxSites;
    if (maxSites) foreningar = foreningar.slice(0, maxSites);
    if (foreningar.length === 0) return [];

    const cookie = await bootCookie(foreningar[0]);
    if (!cookie) { ctx.log('kunde inte boota session (ingen cookie)'); return []; }

    const startsAfter = ctx.windowStart.toISOString().slice(0, 10);
    let scanned = 0, withEvents = 0, failedPages = 0;
    const all: RawEvent[] = [];

    await mapPool(foreningar, CONCURRENCY, async (url) => {
        scanned++;
        const html = await fetchText(url);
        if (!html) { failedPages++; return; }
        const pageId = html.match(/pageId: '(4\.[0-9a-f]+)'/)?.[1];
        // Fallback om mallen ändras: leta portlet-id i sidan
        const portlet = html.includes(PORTLET_ID)
            ? PORTLET_ID
            : html.match(/activity-list-advanced[^]{0,200}?svid(12_[0-9a-f]+)/)?.[1]?.replace('12_', '12.');
        if (!pageId || !portlet) { failedPages++; return; }

        const namn = foreningsNamn(html, url);
        const events: RawEvent[] = [];
        for (let page = 1, totalPages = 1; page <= totalPages && page <= 10; page++) {
            try {
                const r = await fetch(`${SITE}/appresource/${pageId}/${portlet}/activities`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', 'user-agent': UA, cookie },
                    body: JSON.stringify({ startsAfter, page, pageSize: 100 }),
                    signal: AbortSignal.timeout(25_000),
                });
                if (!r.ok) { failedPages++; break; }
                const data = (await r.json())?.result;
                if (!data) break;
                totalPages = Number(data.totalPages) || 1;
                for (const a of data.activities ?? []) {
                    const e = mapProActivity(a, url, namn);
                    if (e) events.push(e);
                }
            } catch { failedPages++; break; }
        }
        if (events.length) withEvents++;
        all.push(...dedupeSeries(events));
        if (scanned % 200 === 0) ctx.log(`…${scanned}/${foreningar.length} föreningar, ${all.length} aktiviteter`);
    });

    ctx.log(`${all.length} aktiviteter (serie-dedupade) från ${withEvents} föreningar (${failedPages} sidfel av ${scanned})`);
    return all;
};
