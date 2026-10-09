/**
 * Antal event per svensk kalenderdag — välkomstrutans "N event den närmaste
 * veckan i hela Sverige". Kartan laddar bara området runt sig (rutläget,
 * utils/eventTiles), så landets siffror kan inte räknas ur kartans data;
 * routen räknar dem i stället (/api/events/destinations?counts=day, ~1 kB).
 *
 * Ren modul: delas av routen och kartsidan.
 */
const STOCKHOLM_DAY = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }); // → 'ÅÅÅÅ-MM-DD'

export function stockholmDay(t: Date | number): string {
    return STOCKHOLM_DAY.format(t);
}

/** { 'ÅÅÅÅ-MM-DD': antal } ur destinations-rader (ISO-tid i `time`). */
export function countPerDay(rows: readonly { time?: unknown }[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) {
        const t = typeof r?.time === 'string' ? Date.parse(r.time) : NaN;
        if (!Number.isFinite(t)) continue;
        const day = stockholmDay(t);
        out[day] = (out[day] ?? 0) + 1;
    }
    return out;
}

/** Summan för `days` dagar från och med `from`s dag. Mitt på dagen räknas
 *  dagen fram, så sommartidsskiftet aldrig hoppar över eller dubblar ett dygn. */
export function sumDayCounts(perDay: Readonly<Record<string, number>>, from: Date, days: number): number {
    let n = 0;
    for (let i = 0; i < days; i++) {
        const d = new Date(from);
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() + i);
        n += perDay[stockholmDay(d)] ?? 0;
    }
    return n;
}
