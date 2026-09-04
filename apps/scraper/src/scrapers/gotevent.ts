/**
 * gotevent — Engine för Got Event (Göteborgs Stads evenemangs- och arenabolag):
 * Scandinavium, Ullevi, Gamla Ullevi, Valhalla, Frölundaborg m.fl.
 *
 * Upptäckt 2026-09-04 i källsvepet: gotevent.se/evenemang är en Vue-app
 * (Umbraco) vars lista hämtas med
 *
 *   POST https://gotevent.se/api/v2/event/GetEventsTeasers
 *   body { categories:[], arenas:[], dates:[], searchWord:"", skip:0, take:N }
 *   header x-language: sv
 *
 * Öppet, ingen auth. Svaret är .NET-serialiserat ($id/$values) med
 * totalHits + teaserCards. GET på samma route 404:ar och tom body 500:ar —
 * alla fält i bodyn måste med. Sitemap saknas (404) och sidans HTML bär
 * bara Vue-mallar, så API:t är enda vägen.
 *
 * Fältkvalitet (28 kort 2026-09-04):
 *   - eventStartDate   "2026-10-19T20:00:00.0000000" — LOKAL tid utan zon
 *   - dateSpan         "fredag 2 oktober, 2026, 19:30" | "24 oktober – 25 oktober, 2026"
 *                      | "Fotbollssäsongen 2026" (lag-sida, se nedan)
 *   - arena + arenaInfo{streetAddress, postalCode, city}   100 %
 *   - imageUrl         100 %, toPageUrl.url relativ (/evenemang/<slug>/)
 *
 * FÄLLA — lagsidor. Fotbolls-/hockeylagen ligger som EN teaser per lag
 * ("GAIS", "Frölunda HC i SHL") med nästa hemmamatch som eventStartDate och
 * dateSpan "Fotbollssäsongen 2026"/"Säsongen 2026/2027". Matcherna kommer
 * redan in via sport-motorerna (Allsvenskan, SHL …) med riktiga motståndare —
 * lagsidorna filtreras bort så de inte blir dubbletter med sämre titel.
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';
import { findFirstDateInText } from '../utils/swedishDate';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface GotEventConfig {
    /** Default https://gotevent.se */
    baseUrl?: string;
    defaultCity?: string;
    /** Hur många kort som begärs i ett anrop (default 100 — listan är ~30). */
    take?: number;
}

export interface GotEventTeaser {
    title?: string;
    body?: string | null;
    shortBody?: string | null;
    imageUrl?: string | null;
    toPageUrl?: { url?: string; text?: string } | null;
    dateSpan?: string | null;
    eventStartDate?: string | null;
    arena?: string | null;
    arenaInfo?: { streetAddress?: string; postalCode?: string; city?: string } | null;
}

/** Lag-/säsongssida snarare än ett enskilt event. Exporterad för test. */
export function isSeasonTeaser(t: GotEventTeaser): boolean {
    return /s[äa]songen\s+\d{4}/i.test(t.dateSpan || '');
}

/**
 * "2026-10-19T20:00:00.0000000" (lokal Stockholm-tid, ingen zon) → Date.
 * Samma konvention som hbgevent: new Date(y, m, d, h, mi) i processens
 * lokala zon. Exporterad för test.
 */
export function parseLocalIso(s: string | null | undefined): Date | null {
    const m = (s || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(d.getTime()) ? null : d;
}

/** Slutdatum ur "24 oktober – 25 oktober, 2026" (delen efter tankstrecket). */
function parseSpanEnd(span: string | null | undefined, now: Date): Date | undefined {
    const m = (span || '').match(/[–-]\s*(\d{1,2}\s+[a-zåäö]+),?\s*(\d{4})/i);
    if (!m) return undefined;
    const d = findFirstDateInText(`${m[1]} ${m[2]}`, now);
    return d || undefined;
}

/** Mappa ett teaser-kort → RawEvent. Exporterad för test. */
export function mapGotEventTeaser(
    t: GotEventTeaser,
    cfg: GotEventConfig,
    now: Date = new Date(),
): RawEvent | null {
    const title = t.title?.trim();
    const path = t.toPageUrl?.url?.trim();
    if (!title || !path) return null;
    if (isSeasonTeaser(t)) return null;

    const start = parseLocalIso(t.eventStartDate);
    if (!start) return null;
    const base = (cfg.baseUrl || 'https://gotevent.se').replace(/\/+$/, '');
    const url = /^https?:\/\//.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

    const end = parseSpanEnd(t.dateSpan, now);
    const hasTime = !/T00:00(:00)?/.test(t.eventStartDate || '');
    const desc = cleanDescription(t.shortBody || t.body || '') || undefined;
    const addr = t.arenaInfo?.streetAddress?.trim() || undefined;

    return {
        title,
        startDate: start,
        endDate: end && end > start ? end : undefined,
        url,
        venueName: t.arena?.trim() || undefined,
        address: addr,
        city: t.arenaInfo?.city?.trim() || cfg.defaultCity,
        description: desc,
        imageUrl: t.imageUrl || undefined,
        hasSpecificTime: hasTime ? true : undefined,
    };
}

export const gotEventEngine: Engine = async (config: GotEventConfig, ctx) => {
    const base = (config.baseUrl || 'https://gotevent.se').replace(/\/+$/, '');
    const take = config.take ?? 100;
    const body = { categories: [], arenas: [], dates: [], searchWord: '', skip: 0, take };
    let data: { totalHits?: number; teaserCards?: { $values?: GotEventTeaser[] } | GotEventTeaser[] };
    try {
        const res = await fetch(`${base}/api/v2/event/GetEventsTeasers`, {
            method: 'POST',
            headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json', 'x-language': 'sv' },
            body: JSON.stringify(body),
            signal: ctx.signal ?? AbortSignal.timeout(30_000),
        });
        if (!res.ok) { ctx.log(`Got Event HTTP ${res.status}`); return []; }
        // FÄLLA: svaret är DUBBELKODAT — en JSON-sträng som innehåller JSON
        // ("{\"$id\":\"1\",\"totalHits\":28,…}"). res.json() ger då en string.
        const parsed = await res.json();
        data = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } catch (e: any) {
        ctx.log(`Got Event fetch-fel: ${e?.message || e}`);
        return [];
    }
    const cards: GotEventTeaser[] = Array.isArray(data.teaserCards)
        ? data.teaserCards
        : (data.teaserCards?.$values ?? []);
    ctx.log(`Got Event: ${cards.length} kort (totalHits ${data.totalHits ?? '?'})`);

    const out: RawEvent[] = [];
    let seasons = 0;
    for (const t of cards) {
        if (isSeasonTeaser(t)) { seasons++; continue; }
        const ev = mapGotEventTeaser(t, config);
        if (ev) out.push(ev);
    }
    if (seasons) ctx.log(`Got Event: ${seasons} lagsidor (säsong) skippade — matcherna tas av sport-motorerna`);
    return out;
};
