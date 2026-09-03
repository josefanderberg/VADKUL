/**
 * cbis — Engine för Visit Groups CBIS-drivna destinationssajter (Drupal-modulen
 * cbis_product_list). Umeå/Karlskrona m.fl. kör samma plattform:
 *
 *   GET <baseUrl>/sv/api/cbis-product-list?nodeId=<N>&page=<P>
 *   → { totalCount, items: ["<div class=cbis-product-item>…</div>", …] }  (50/sida)
 *
 * Öppet utan cookies. items är SERVER-RENDERADE HTML-kort (ABF/HTMX-mönstret):
 *   .title                    → titel
 *   .cbis-date span           → "02 Jul" (svensk kortmånad, inget år → inferens)
 *   .cbis-event-arena span    → venue ("Döbelns park")
 *   a[href]                   → detaljsida (relativ)
 *   img[src]                  → bild (Drupal-styled derivat, funkar direkt)
 *
 * Detaljsidan saknar JSON-LD men har meta-description + klockslag i text →
 * hämtas för event i fönstret (throttlat, cap:at) så tid + beskrivning fylls.
 *
 * nodeId hittas genom att sniffa listsidans XHR (scratchpad/xhr-sniff.cjs) —
 * visitgavle.se probades 2026-07-02 men deras nod gav totalCount=0 (annan setup).
 */

import * as cheerio from 'cheerio';
import { Engine, RawEvent } from '../sources/types';
import { parseSwedishDate } from '../utils/swedishDate';
import { domainLimiter } from '../sources/rateLimiter';

import { cleanDescription, truncateAtBoundary, DEFAULT_DESCRIPTION_MAX } from '../utils/text';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface CbisConfig {
    baseUrl: string;          // t.ex. https://visitumea.se
    nodeId: number;           // list-nodens id (sniffas ur sajtens XHR)
    defaultCity: string;
    /** API-path — Umeå/Karlskrona kör '/sv/api/cbis-product-list' (default), Roslagen '/api/cbis-product-list'. */
    apiPath?: string;
    maxPages?: number;        // 50 kort/sida; default 8 (=400 kort)
    /** Hämta detaljsida för fönster-event → meta-desc + klockslag. Default true. */
    fetchDetailPage?: boolean;
    /** Max detaljside-fetchar per körning (throttlade). Default 120. */
    maxDetailFetches?: number;
}

async function getJson(url: string, signal?: AbortSignal): Promise<any | null> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'application/json' },
            signal: signal ?? AbortSignal.timeout(20_000),
        });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

/**
 * Parsa ett HTML-kort → RawEvent (utan detaljside-data). Exporterad för test.
 * Tema-varianter: Umeå (.title/.cbis-date/.cbis-event-arena), Karlskrona
 * (.card-title/.cbis-occasions med datumintervall/.card-text-beskrivning),
 * Kinda (.cbis-product-title/.cbis-occasions MED veckodagsprefix "ons 26 aug –
 * sön 06 sep 11:00"/beskrivning i bar <p> i .cbis-product-body) och Öland
 * (.body-title/.body-desc-text/.cbis-occasions med MÅNADEN FÖRE dagen:
 * "sep 02 - dec 16 16:00").
 */
/**
 * "ons 26 aug" → "26 aug". Kinda-temat prefixar datumet med veckodag, vilket
 * parseSwedishDate inte klarar. Exporterad för test.
 */
export function stripWeekday(s: string): string {
    return s.replace(/^(mån|tis|ons|tors?|fre|lör|sön)(dag)?\.?\s+/i, '').trim();
}

/**
 * "sep 02" → "02 sep". Öland-temat skriver månaden FÖRE dagen, vilket
 * parseSwedishDate (som kräver "DD månad") inte klarar. Lämnar strängen orörd
 * när den redan är dag-först. Exporterad för test.
 */
export function flipMonthFirst(s: string): string {
    const m = s.match(/^(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)[a-zåäö]*\.?\s+(\d{1,2})\b/i);
    return m ? `${m[2]} ${m[1]}${s.slice(m[0].length)}` : s;
}

export function parseCbisCard(cardHtml: string, cfg: CbisConfig, now: Date): RawEvent | null {
    const $ = cheerio.load(cardHtml);
    const title = ($('.title').first().text().trim()
        || $('.card-title').first().text().trim()
        || $('.cbis-product-title').first().text().trim()
        || $('.body-title').first().text().trim());
    const href = $('a[href]').first().attr('href') || '';
    if (!title || !href) return null;

    // Datum: enkelvärde ELLER intervall ("03 Jul - 13 Aug") → första datumet.
    const occText = ($('.cbis-date span').first().text().trim()
        || $('.cbis-occasions').first().text().replace(/\s+/g, ' ').trim());
    const dateText = flipMonthFirst(stripWeekday(occText.split(/\s*[-–]\s*/)[0].trim()));
    const startDate = parseSwedishDate(dateText, now);
    if (!startDate) return null;

    // Kinda-varianten lägger klockslaget sist i occasions-raden ("… 11:00").
    const clock = occText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    let hasClock = false;
    if (clock) { startDate.setHours(parseInt(clock[1], 10), parseInt(clock[2], 10), 0, 0); hasClock = true; }

    const venue = $('.cbis-event-arena span').first().text().trim() || undefined;
    const cardDesc = ($('.card-text').first().text() || $('.cbis-product-body p').first().text()
        || $('.body-desc-text').first().text())
        .replace(/\s+/g, ' ').trim();
    let imageUrl = $('img').first().attr('src') || undefined;

    let url: string;
    try { url = new URL(href, cfg.baseUrl).toString(); } catch { return null; }
    if (imageUrl) {
        try { imageUrl = new URL(imageUrl, cfg.baseUrl).toString(); } catch { imageUrl = undefined; }
    }

    return {
        title,
        url,
        startDate,
        venueName: venue,
        city: cfg.defaultCity,
        imageUrl,
        description: cardDesc.length >= 20 ? truncateAtBoundary(cardDesc, DEFAULT_DESCRIPTION_MAX) : undefined,
        // Kortdatumet saknar oftast klockslag → låt runnerns midnatts-heuristik
        // gälla tills detaljsidan ev. ger tid. Kinda-varianten bär det på kortet.
        hasSpecificTime: hasClock ? true : undefined,
    };
}

/** Meta-desc + första klockslag ur detaljsidan. Exporterad för test. */
export function applyCbisDetail(html: string, ev: RawEvent): void {
    const m = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]*)"/i)
        || html.match(/<meta[^>]+content="([^"]*)"[^>]+(?:property="og:description"|name="description")/i);
    if (m && m[1].trim().length >= 20 && !ev.description) {
        // cleanDescription: entitetsavkodning (alla, i rätt ordning — inte
        // &amp;-först som dubbelavkodar), whitespace, ordgräns-trunkering.
        ev.description = cleanDescription(m[1]);
    }
    // Första rimliga klockslag i brödtexten ("12:00 - 13:00" → 12:00)
    if (ev.startDate.getHours() === 0 && ev.startDate.getMinutes() === 0) {
        const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');
        const t = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
        if (t) {
            ev.startDate.setHours(parseInt(t[1], 10), parseInt(t[2], 10), 0, 0);
            ev.hasSpecificTime = true;
        }
    }
}

export const cbisEngine: Engine = async (config, ctx) => {
    const cfg = config as CbisConfig;
    const maxPages = cfg.maxPages ?? 8;
    const events: RawEvent[] = [];
    const now = new Date();

    const apiPath = cfg.apiPath ?? '/sv/api/cbis-product-list';
    let total = Infinity;
    for (let page = 0; page < maxPages && page * 50 < total; page++) {
        await domainLimiter.wait(cfg.baseUrl);
        const data = await getJson(`${cfg.baseUrl}${apiPath}?nodeId=${cfg.nodeId}&page=${page}`, ctx.signal);
        if (!data) { ctx.log(`cbis: sida ${page} gav inget svar`); break; }
        total = data.totalCount ?? 0;
        const items: string[] = data.items ?? [];
        if (items.length === 0) break;
        for (const card of items) {
            const ev = parseCbisCard(card, cfg, now);
            if (ev) events.push(ev);
        }
    }
    ctx.log(`cbis: ${events.length} kort parsade (totalCount=${total === Infinity ? '?' : total})`);

    // Koordinat-join via /map-endpointen (Karlskrona + Öland har den, Umeå 404:ar):
    // [{ name, url, lat, lng }] — matcha i första hand på URL (stabilt), i andra
    // hand på normaliserat namn. Exakta koordinater slår venue-geokodning, så
    // applicera när de finns.
    //
    // URL-joinen kom till 2026-08-31: på oland.se avvek många kort-titlar från
    // kartans namn (avslutande komma, &-entiteter) — namn-join gav 30/46,
    // URL-join 41/46. Resten föll tillbaka på ö-centroiden.
    {
        await domainLimiter.wait(cfg.baseUrl);
        const mapData = await getJson(`${cfg.baseUrl}/sv/api/cbis-product-list/map?nodeId=${cfg.nodeId}`, ctx.signal);
        if (Array.isArray(mapData) && mapData.length) {
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
            const normUrl = (s: string) => s.replace(/\/+$/, '').toLowerCase();
            const coordsByName = new Map<string, [number, number]>();
            const coordsByUrl = new Map<string, [number, number]>();
            for (const m of mapData) {
                const lat = Number(m?.lat), lng = Number(m?.lng);
                if (isNaN(lat) || isNaN(lng)) continue;
                if (m?.name) coordsByName.set(norm(m.name), [lat, lng]);
                if (m?.url) coordsByUrl.set(normUrl(String(m.url)), [lat, lng]);
            }
            let joined = 0;
            for (const ev of events) {
                if (ev.coords) continue;
                const hit = coordsByUrl.get(normUrl(ev.url)) ?? coordsByName.get(norm(ev.title));
                if (hit) { ev.coords = hit; joined++; }
            }
            ctx.log(`cbis: kart-join gav koordinater till ${joined}/${events.length} event`);
        }
    }

    // Detaljside-pass för fönster-event: meta-desc + klockslag.
    if (cfg.fetchDetailPage !== false) {
        const budget = cfg.maxDetailFetches ?? 120;
        let fetched = 0, filled = 0;
        for (const ev of events) {
            if (fetched >= budget) break;
            if (ev.startDate < ctx.windowStart || ev.startDate >= ctx.windowEnd) continue;
            await domainLimiter.wait(ev.url);
            fetched++;
            try {
                const res = await fetch(ev.url, { headers: { 'User-Agent': UA }, signal: ctx.signal ?? AbortSignal.timeout(20_000) });
                if (!res.ok) continue;
                applyCbisDetail(await res.text(), ev);
                filled++;
            } catch { /* detaljmiss är ok — kortdata räcker */ }
        }
        ctx.log(`cbis: ${fetched} detaljsidor hämtade, ${filled} berikade`);
    }

    return events;
};
