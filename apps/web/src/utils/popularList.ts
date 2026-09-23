/**
 * popularList.ts — eventkortets 🔥 POPULÄRT-flik (Josef 23/9: "visa de
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

export function isPopularListed(e: PopularListCandidate, nowMs: number): boolean {
    return e.pop === true || (!!e.featuredUntil && e.featuredUntil.getTime() > nowMs);
}

export interface PopularDay<T> {
    /** 0 = idag, 1 = imorgon … (dayOffsetOf). */
    dayOffset: number;
    events: T[];
}

/**
 * Populära event från `fromDayOffset` och framåt, en post per dag (bara dagar
 * som har något), dagarna i ordning och eventen i tidsordning inom dagen.
 * Passerade (`isPast`) sorteras bort — listan är "vad kan jag gå på".
 */
export function popularDays<T extends PopularListCandidate>(
    events: readonly T[],
    fromDayOffset: number,
    now: Date,
    isPast: (e: T) => boolean,
): PopularDay<T>[] {
    const nowMs = now.getTime();
    const byDay = new Map<number, T[]>();
    for (const e of events) {
        if (!isPopularListed(e, nowMs) || isPast(e)) continue;
        const d = dayOffsetOf(e.time, now);
        if (d < fromDayOffset) continue;
        const list = byDay.get(d);
        if (list) list.push(e);
        else byDay.set(d, [e]);
    }
    return [...byDay.entries()]
        .sort(([a], [b]) => a - b)
        .map(([dayOffset, list]) => ({
            dayOffset,
            events: list.sort((a, b) => a.time.getTime() - b.time.getTime()),
        }));
}

/** Kapar dagarna till de första `limit` raderna (pagineringen) — dagar som
 *  inte får någon rad alls följer inte med, den sista kan komma halv. */
export function takeRows<T>(days: readonly { dayOffset: number; rows: T[] }[], limit: number): { dayOffset: number; rows: T[] }[] {
    const out: { dayOffset: number; rows: T[] }[] = [];
    let left = limit;
    for (const day of days) {
        if (left <= 0) break;
        const rows = day.rows.slice(0, left);
        out.push({ dayOffset: day.dayOffset, rows });
        left -= rows.length;
    }
    return out;
}
