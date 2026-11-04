/**
 * KREDITDAGAR FÖR OUTNYTTJAD BOOST (ägarbeslut 4/11 2026, Josef: "de dagar
 * man inte förbrukar ... ska man ha återstående tid som man kan lägga på en
 * annan event när det eventet försvinner. Men man kan minst förlora en dag.
 * ... tänk på att man inte kan utnyttja det. Eventet måste vara slut innan
 * man får kreditdagar").
 *
 * Ren logik, testad utan Firebase (boostCredit.test.ts). Bor i kontraktet
 * så webbens serverdel (apps/web/src/server/boostCredit.ts, där avräkningen
 * och saldot boostCredits/{uid} sköts med Admin SDK:t) och functions räknar
 * lika. Bodde i apps/functions/src/utils t.o.m. 4/11 - avräkningen flyttade
 * till webbens API-routes samma dag eftersom nya Cloud Functions inte fick
 * anropsrättighet från deploy-kontot.
 *
 *  - localDayAfter: första millisekunden av nästa SVENSKA dygn efter en
 *    tidpunkt (servrarna kör i UTC - dygnsgränsen måste vara Stockholms,
 *    annars räknas ett lördagsevent kl 23 som söndag). Intl.DateTimeFormat
 *    med timeZone - finns i Node och i moderna Hermes; appen kallar den inte.
 *  - creditDaysFor: kreditdagarna för ETT kvitto när eventet varit. Boost-
 *    fönstret [from, until] jämförs med dygnet EFTER eventets sista dag:
 *    hela dagar som ligger efter det räknas, minus avgiften (CREDIT_FEE_DAYS:
 *    man förlorar alltid minst en dag). null = eventet har inte varit än -
 *    inget avräknas, frågan ställs igen nästa gång.
 *  - eventEndsAtMs: när eventet är slut: eventets egen tid, eller seriens
 *    sista tillfälle (speglar webbens utils/weeklySeries seriesEndDate).
 *    En "tills vidare"-serie tar aldrig slut och ger ingen kredit.
 *
 * Exploateringsskydd (här och i serverdelen): kredit först när eventet varit
 * (dygnet efter sista dagen), minst en dags avgift per avräkning, avräkningen
 * stämplas på kvittot (en gång), och den avräknade boosten klipps
 * (featuredUntil = nu) så ett ägarredigerat datum aldrig kan väcka den igen.
 * En kredit-boost kan själv ge kredit igen - med avgiften varje varv krymper
 * den, aldrig växer.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Dagar som alltid går förlorade vid en avräkning ("minst förlora en dag"). */
export const CREDIT_FEE_DAYS = 1;
export const STOCKHOLM = 'Europe/Stockholm';

function wallParts(ms: number, timeZone: string): Record<string, number> {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const out: Record<string, number> = {};
    for (const p of dtf.formatToParts(new Date(ms))) if (p.type !== 'literal') out[p.type] = Number(p.value);
    return out;
}

/** Tidszonens offset (ms) vid tidpunkten: väggklockan läst som UTC minus riktiga UTC. */
function tzOffsetMs(ms: number, timeZone: string): number {
    const p = wallParts(ms, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Första ms av nästa lokala dygn efter `ms` (Stockholm om inget annat sägs). */
export function localDayAfter(ms: number, timeZone = STOCKHOLM): number {
    const p = wallParts(ms, timeZone);
    // Date.UTC normaliserar dag+1 över månads-/årsskiften.
    const wall = Date.UTC(p.year, p.month - 1, p.day + 1, 0, 0, 0);
    const guess = wall - tzOffsetMs(wall, timeZone);
    return wall - tzOffsetMs(guess, timeZone);
}

export interface BoostWindow {
    /** När kvittots boostfönster började (nu, eller förra boostens slut vid förlängning). */
    fromMs: number;
    /** Kvittots featuredUntil. */
    untilMs: number;
}

/**
 * Kreditdagar för kvittot. null = eventet har inte varit än (avräkna inte).
 * Annars hela outnyttjade dagar efter eventets dygn, minus avgiften, aldrig
 * under noll.
 */
export function creditDaysFor(window: BoostWindow, eventEndsMs: number, nowMs: number, timeZone = STOCKHOLM): number | null {
    const dayAfter = localDayAfter(eventEndsMs, timeZone);
    if (nowMs < dayAfter) return null;
    const unusedMs = window.untilMs - Math.max(window.fromMs, dayAfter);
    if (unusedMs <= 0) return 0;
    return Math.max(0, Math.floor(unusedMs / DAY_MS) - CREDIT_FEE_DAYS);
}

// ── Seriens slut (port av webbens utils/weeklySeries) ───────────────────────

const MAX_REPEAT_DAYS = 14;

function normalizeIntervalWeeks(v: unknown): number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 2 ? v : 1;
}

function normalizeRepeatDays(v: unknown): number | null {
    return typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= MAX_REPEAT_DAYS ? v : null;
}

function occurrencesForWeeks(weeks: unknown, intervalWeeks: unknown): number | null {
    if (typeof weeks !== 'number' || !Number.isFinite(weeks) || weeks < 1) return null;
    return Math.floor((Math.floor(weeks) - 1) / normalizeIntervalWeeks(intervalWeeks)) + 1;
}

export interface SeriesDoc {
    timeMs: number;
    repeatWeekly?: unknown;
    repeatWeeks?: unknown;
    repeatIntervalWeeks?: unknown;
    repeatDays?: unknown;
    seriesEndsAtMs?: number | null;
}

/**
 * När eventet (eller seriens sista tillfälle) äger rum. null = serien går
 * tills vidare - den tar aldrig slut, ingen kredit. Veckosteget räknas i
 * hela dygn (7·24 h); en timmes sommartidsskillnad spelar ingen roll för
 * frågan "har sista tillfället varit".
 */
export function eventEndsAtMs(doc: SeriesDoc): number | null {
    const days = normalizeRepeatDays(doc.repeatDays);
    if (days !== null) return doc.seriesEndsAtMs ?? doc.timeMs + (days - 1) * DAY_MS;
    if (!doc.repeatWeekly) return doc.timeMs;
    if (doc.seriesEndsAtMs) return doc.seriesEndsAtMs;
    const times = occurrencesForWeeks(doc.repeatWeeks, doc.repeatIntervalWeeks);
    if (times === null) return null;
    return doc.timeMs + (Math.max(1, Math.floor(times)) - 1) * normalizeIntervalWeeks(doc.repeatIntervalWeeks) * 7 * DAY_MS;
}
