/**
 * popularList.ts — eventkortets listflikar: 🔥 POPULÄRT och ALLA (båda
 * dag för dag i kartans ruta, Josef 24/9). Ursprungligen Populärt-fliken (Josef 23/9: "visa de
 * populära där man är och kollar på kartan just nu … scrollar man vidare
 * nedåt ska den gå framåt till dagarna som kommer efter").
 *
 * Sidan skickar in eventen som redan ligger i kartans ruta och passerar
 * kartans filter; här avgörs vad som är populärt och hur listan delas i
 * dagar. Populärt = pipelinens pop-flagga eller en aktiv boost (boost-
 * löftet, se popularFilter). Användarskapade event har INGEN egen biljett
 * hit — 🔥-filtrets bypass för dem handlar om att inte gömma dem, inte om
 * att kalla dem populära.
 */
import { dayOffsetOf } from './viewportTour';

interface PopularListCandidate {
    time: Date;
    pop?: boolean;
    featuredUntil?: Date;
}

/** Listans horisont (Josef 24/9: "vi fokuserar mest på kommande månaden").
 *  Räknas från IDAG, inte från den visade dagen. */
export const LIST_HORIZON_DAYS = 30;

/**
 * Samma tidsfönster som listans flikar (Månaden · 🔥 Populärt): från den
 * visade dagen (aldrig före idag) och framåt inom LIST_HORIZON_DAYS,
 * passerade bort. Kategoriradens siffror räknar i samma fönster (Josef 7/10:
 * "22 populära … sen står det något annat samtidigt" - chippet räknade
 * dagen, fliken månaden och bannern veckan), så 🔥-chippet = Populärt-
 * fliken och kategorierna går ihop med Månaden.
 */
export function inListWindow<T extends { time: Date }>(
    e: T,
    fromDayOffset: number,
    now: Date,
    isPast: (e: T) => boolean,
): boolean {
    if (isPast(e)) return false;
    const d = dayOffsetOf(e.time, now);
    return d >= Math.max(0, fromDayOffset) && d < LIST_HORIZON_DAYS;
}

export function isPopularListed(e: PopularListCandidate, nowMs: number): boolean {
    return e.pop === true || (!!e.featuredUntil && e.featuredUntil.getTime() > nowMs);
}

export interface PopularDay<T> {
    /** 0 = idag, 1 = imorgon … (dayOffsetOf). */
    dayOffset: number;
    events: T[];
}

/**
 * Event från `fromDayOffset` och framåt, en post per dag (bara dagar som har
 * något), dagarna i ordning och eventen i tidsordning inom dagen. Passerade
 * (`isPast`) sorteras bort — listan är "vad kan jag gå på". `include` smalnar
 * urvalet (Populärt-fliken); utelämnad = alla (Alla-fliken, Josef 24/9).
 *
 * Lika klockslag skiljs på id (Josef 28/9: "eventen hoppar upp och nedåt").
 * Utan skiljenyckeln ärvde lika-tid-event KÄLLARRAYENS ordning (stabil sort),
 * och den byts flera gånger under de första sekunderna (dagens snapshot →
 * API-slicen → tidsfönstret → användarevent) — varje byte permuterade raderna
 * i kortets lista. Med id-nyckeln är ordningen densamma oavsett leveransordning,
 * och dubblettgrupperingen (groupDups, helt ordningsdriven) följer med.
 */
export function eventDays<T extends { time: Date; id?: string }>(
    events: readonly T[],
    fromDayOffset: number,
    now: Date,
    isPast: (e: T) => boolean,
    include: (e: T) => boolean = () => true,
): PopularDay<T>[] {
    const byDay = new Map<number, T[]>();
    for (const e of events) {
        if (!include(e) || isPast(e)) continue;
        const d = dayOffsetOf(e.time, now);
        if (d < fromDayOffset) continue;
        const list = byDay.get(d);
        if (list) list.push(e);
        else byDay.set(d, [e]);
    }
    const tie = (a: T, b: T) => {
        const ka = a.id ?? '', kb = b.id ?? '';
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    };
    return [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([dayOffset, list]) => ({
            dayOffset,
            events: list.sort((a, b) => a.time.getTime() - b.time.getTime() || tie(a, b)),
        }));
}

/** Populärt-fliken: eventDays smalnad till pop-flaggade/boostade. */
export function popularDays<T extends PopularListCandidate>(
    events: readonly T[],
    fromDayOffset: number,
    now: Date,
    isPast: (e: T) => boolean,
): PopularDay<T>[] {
    const nowMs = now.getTime();
    return eventDays(events, fromDayOffset, now, isPast, e => isPopularListed(e, nowMs));
}

/** Kapar dagarna till de första `limit` raderna (pagineringen) — dagar som
 *  inte får någon rad alls följer inte med, den sista kan komma halv.
 *  Dagens övriga fält (listans zoomring) följer med oförändrade. */
export function takeRows<D extends { rows: readonly unknown[] }>(days: readonly D[], limit: number): D[] {
    const out: D[] = [];
    let left = limit;
    for (const day of days) {
        if (left <= 0) break;
        const rows = day.rows.slice(0, left);
        out.push({ ...day, rows });
        left -= rows.length;
    }
    return out;
}
