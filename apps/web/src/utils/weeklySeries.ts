import type { LinkEvent } from '@/types';

/**
 * Veckoseriernas räkneläror på ETT ställe.
 *
 * Dokumentet lagrar seriens längd i VECKOR (`repeatWeeks`) — det gjorde det
 * redan innan rytmen fanns och fältet är typkollat i reglerna (1–52). Men
 * VECKOR är fel fråga att ställa användaren så fort rytmen är varannan vecka:
 * "8 veckor varannan vecka" är 4 gånger, och "4 veckor" är 2 gånger med en
 * tom vecka på slutet (sista tillfället ligger i vecka 3). Formuläret frågar
 * därför efter ANTAL GÅNGER och räknar om hit — så blir jämnt/ojämnt antal
 * veckor en fråga användaren aldrig behöver ha en åsikt om.
 */

/** Rytmen som heltal: 2 = varannan vecka. Allt annat (utelämnat, 1, skräp) = varje vecka. */
export function normalizeIntervalWeeks(v: number | null | undefined): number {
    return typeof v === 'number' && Number.isInteger(v) && v >= 2 ? v : 1;
}

/**
 * Hur många TILLFÄLLEN ryms i en serie på `weeks` veckor med given rytm.
 * null = tills vidare (fältet saknas), som alla serier före valet fanns.
 */
export function occurrencesForWeeks(
    weeks: number | null | undefined,
    intervalWeeks: number | null | undefined,
): number | null {
    if (typeof weeks !== 'number' || !Number.isFinite(weeks) || weeks < 1) return null;
    return Math.floor((Math.floor(weeks) - 1) / normalizeIntervalWeeks(intervalWeeks)) + 1;
}

/**
 * Omvänt: så många VECKOR måste `repeatWeeks` vara för att rymma `times`
 * tillfällen. Med varannan vecka blir det alltid ett ojämnt antal veckor —
 * sista veckan ÄR ett tillfälle, aldrig en tom mellanvecka.
 */
export function weeksForOccurrences(times: number, intervalWeeks: number | null | undefined): number {
    const n = Math.max(1, Math.floor(times));
    return (n - 1) * normalizeIntervalWeeks(intervalWeeks) + 1;
}

/**
 * Datumet för det sista tillfället i en serie som startar `start` och pågår
 * `times` gånger. Stegar med setDate (inte millisekunder) så sommartidsbytet
 * inte knuffar klockslaget en timme.
 */
export function seriesLastDate(start: Date, times: number, intervalWeeks: number | null | undefined): Date {
    const step = normalizeIntervalWeeks(intervalWeeks);
    const out = new Date(start);
    out.setDate(out.getDate() + (Math.max(1, Math.floor(times)) - 1) * step * 7);
    return out;
}

/**
 * Hur många tillfällen återstår FRÅN ett visst tillfälle till och med
 * seriens slut (tillfället självt inräknat). Används när ett tillfälle mitt i
 * serien redigeras: formulärets tid blir seriens nya start, så "antal gånger"
 * måste räknas om därifrån — annars förlängs serien varje gång man redigerar
 * den från ett senare tillfälle.
 */
export function occurrencesLeftFrom(
    occurrence: Date,
    endsAt: Date,
    intervalWeeks: number | null | undefined,
): number {
    const step = normalizeIntervalWeeks(intervalWeeks);
    const cursor = new Date(occurrence);
    let n = 1;
    // Bounded: reglerna tillåter max 52 veckor, alltså max 52 tillfällen.
    while (n < 52) {
        cursor.setDate(cursor.getDate() + step * 7);
        if (cursor.getTime() > endsAt.getTime()) break;
        n++;
    }
    return n;
}

type SeriesFields = Pick<LinkEvent, 'time' | 'repeatWeekly' | 'repeatWeeks' | 'repeatIntervalWeeks' | 'seriesEndsAt'>;

/**
 * Seriens slutdatum för ett event i handen. Utvecklade tillfällen bär
 * `seriesEndsAt` från expandWeekly (deras egen `time` är tillfällets, inte
 * seriens start — räknat därifrån hade serien sett längre ut för varje
 * tillfälle). Basdokumentet räknas fram ur repeatWeeks. null = tills vidare.
 */
export function seriesEndDate(e: SeriesFields): Date | null {
    if (!e.repeatWeekly) return null;
    if (e.seriesEndsAt) return e.seriesEndsAt;
    const times = occurrencesForWeeks(e.repeatWeeks, e.repeatIntervalWeeks);
    return times === null ? null : seriesLastDate(e.time, times, e.repeatIntervalWeeks);
}

/** "8 nov" — årtal bara när slutet ligger i ett annat år än nu. */
export function seriesDateLabel(d: Date, now: Date = new Date()): string {
    return d.toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
        ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    });
}

/**
 * Raden som står på eventet självt: "Varannan lördag · t.o.m. 8 nov" (eller
 * "· tills vidare"). null för allt som inte är en serie. Veckodagen tas ur
 * eventets egen tid — alla tillfällen i en serie delar veckodag.
 */
export function seriesLabel(e: SeriesFields, now: Date = new Date()): string | null {
    if (!e.repeatWeekly) return null;
    const weekday = e.time.toLocaleDateString('sv-SE', { weekday: 'long' });
    const rhythm = `${normalizeIntervalWeeks(e.repeatIntervalWeeks) === 2 ? 'Varannan' : 'Varje'} ${weekday}`;
    const end = seriesEndDate(e);
    return `${rhythm} · ${end ? `t.o.m. ${seriesDateLabel(end, now)}` : 'tills vidare'}`;
}

/** Kort variant till profilens serie-chip: "Varannan vecka" / "Varje vecka". */
export function seriesRhythmLabel(e: Pick<LinkEvent, 'repeatIntervalWeeks'>): string {
    return normalizeIntervalWeeks(e.repeatIntervalWeeks) === 2 ? 'Varannan vecka' : 'Varje vecka';
}
