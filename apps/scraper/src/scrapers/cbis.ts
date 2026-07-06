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
 * Tema-varianter: Umeå (.title/.cbis-date/.cbis-event-arena) och Karlskrona
 * (.card-title/.cbis-occasions med datumintervall/.card-text-beskrivning).
 */
export function parseCbisCard(cardHtml: string, cfg: CbisConfig, now: Date): RawEvent | null {
    const $ = cheerio.load(cardHtml);
    const title = ($('.title').first().text().trim() || $('.card-title').first().text().trim());
    const href = $('a[href]').first().attr('href') || '';
    if (!title || !href) return null;

    // Datum: enkelvärde ELLER intervall ("03 Jul - 13 Aug") → första datumet.
    const dateText = ($('.cbis-date span').first().text().trim()
        || $('.cbis-occasions').first().text().replace(/\s+/g, ' ').trim())
        .split(/\s*[-–]\s*/)[0].trim();
    const startDate = parseSwedishDate(dateText, now);
    if (!startDate) return null;

    const venue = $('.cbis-event-arena span').first().text().trim() || undefined;
    const cardDesc = $('.card-text').first().text().replace(/\s+/g, ' ').trim();
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
        description: cardDesc.length >= 20 ? cardDesc.slice(0, 600) : undefined,
        // Kortdatumet saknar klockslag → låt runnerns midnatts-heuristik gälla
        // tills detaljsidan ev. ger tid.
    };
}

/** Meta-desc + första klockslag ur detaljsidan. Exporterad för test. */
export function applyCbisDetail(html: string, ev: RawEvent): void {
    const m = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]*)"/i)
        || html.match(/<meta[^>]+content="([^"]*)"[^>]+(?:property="og:description"|name="description")/i);
    if (m && m[1].trim().length >= 20 && !ev.description) {
        ev.description = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim().slice(0, 600);
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

    // Koordinat-join via /map-endpointen (Karlskrona har den, Umeå 404:ar):
    // [{ name, lat, lng }] — matcha på normaliserat namn. Exakta koordinater
    // slår venue-geokodning, så applicera när de finns.
    {
        await domainLimiter.wait(cfg.baseUrl);
        const mapData = await getJson(`${cfg.baseUrl}/sv/api/cbis-product-list/map?nodeId=${cfg.nodeId}`, ctx.signal);
        if (Array.isArray(mapData) && mapData.length) {
            const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
            const coordsByName = new Map<string, [number, number]>();
            for (const m of mapData) {
                const lat = Number(m?.lat), lng = Number(m?.lng);
                if (m?.name && !isNaN(lat) && !isNaN(lng)) coordsByName.set(norm(m.name), [lat, lng]);
            }
            let joined = 0;
            for (const ev of events) {
                if (ev.coords) continue;
                const hit = coordsByName.get(norm(ev.title));
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
