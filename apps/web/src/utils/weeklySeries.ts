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

// ── Dagsserier ──────────────────────────────────────────────────────────────
/**
 * Flera dagar i rad (22/9): en konstrunda lör+sön, en festival, en marknad
 * över helgen. Innan valet fanns lades sådant in som ett event per dag och
 * syntes som olika saker (Växjö Konstrunda 10+11 okt). Lagras som
 * `repeatDays` på ETT dokument, som veckoserierna. Taket är lågt med flit
 * (Josef 22/9: "oftast inte så många dagar efter varandra") och speglas i
 * Firestore-reglerna.
 */
export const MAX_REPEAT_DAYS = 14;

/** Antal dagar i en dagsserie (2-MAX_REPEAT_DAYS), annars null. */
export function normalizeRepeatDays(v: number | null | undefined): number | null {
    return typeof v === 'number' && Number.isInteger(v) && v >= 2 && v <= MAX_REPEAT_DAYS ? v : null;
}

/** Är eventet en serie av något slag (dagar i rad eller veckovis)? */
export function isSeriesEvent(e: Pick<LinkEvent, 'repeatWeekly' | 'repeatDays'>): boolean {
    return normalizeRepeatDays(e.repeatDays) !== null || !!e.repeatWeekly;
}

/** `d` plus `days` dagar, samma klockslag. setDate (inte millisekunder) så
 *  sommartidsbytet inte knuffar klockslaget en timme. */
export function addDays(d: Date, days: number): Date {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
}

/**
 * Formulärets rytmval: 1 = varje vecka, 2 = varannan vecka, 'daily' = varje
 * dag. Antalet ("hur många gånger/dagar") är separat.
 */
export type RepeatRhythm = 1 | 2 | 'daily';

type RepeatDocFields = Pick<LinkEvent, 'repeatWeekly' | 'repeatIntervalWeeks' | 'repeatWeeks' | 'repeatDays'>;

/**
 * Formulärets upprepningsval → dokumentets fält (stod förr som samma uttryck
 * på fyra ställen i sparandet). Dagsserier kräver ett antal: "tills vidare"
 * finns inte för dem, så null/skräp blir 2 dagar.
 */
export function seriesFieldsFor(enabled: boolean, rhythm: RepeatRhythm, times: number | null): RepeatDocFields {
    if (!enabled) return { repeatWeekly: false };
    if (rhythm === 'daily') {
        const n = typeof times === 'number' && Number.isFinite(times) ? Math.floor(times) : 2;
        return { repeatWeekly: false, repeatDays: Math.min(MAX_REPEAT_DAYS, Math.max(2, n)) };
    }
    return {
        repeatWeekly: true,
        repeatIntervalWeeks: rhythm === 2 ? 2 : undefined,
        repeatWeeks: times ? weeksForOccurrences(times, rhythm) : undefined,
    };
}

/** Sista tillfällets datum för formulärets val (förhandsvisningen "sista gången"). */
export function lastOccurrenceFor(start: Date, times: number, rhythm: RepeatRhythm): Date {
    return rhythm === 'daily'
        ? addDays(start, Math.max(1, Math.floor(times)) - 1)
        : seriesLastDate(start, times, rhythm);
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

type SeriesFields = Pick<LinkEvent, 'time' | 'repeatWeekly' | 'repeatWeeks' | 'repeatIntervalWeeks' | 'repeatDays' | 'seriesEndsAt'>;

/**
 * Seriens slutdatum för ett event i handen. Utvecklade tillfällen bär
 * `seriesEndsAt` från expandSeries (deras egen `time` är tillfällets, inte
 * seriens start — räknat därifrån hade serien sett längre ut för varje
 * tillfälle). Basdokumentet räknas fram ur repeatWeeks/repeatDays. null =
 * tills vidare (eller ingen serie).
 */
export function seriesEndDate(e: SeriesFields): Date | null {
    const days = normalizeRepeatDays(e.repeatDays);
    if (days !== null) return e.seriesEndsAt ?? addDays(e.time, days - 1);
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
    const days = normalizeRepeatDays(e.repeatDays);
    if (days !== null) {
        const start = dailySeriesStart(e)!;
        return `${days} dagar · ${dayRangeLabel(start, addDays(start, days - 1), now)}`;
    }
    if (!e.repeatWeekly) return null;
    const weekday = e.time.toLocaleDateString('sv-SE', { weekday: 'long' });
    const rhythm = `${normalizeIntervalWeeks(e.repeatIntervalWeeks) === 2 ? 'Varannan' : 'Varje'} ${weekday}`;
    const end = seriesEndDate(e);
    return `${rhythm} · ${end ? `t.o.m. ${seriesDateLabel(end, now)}` : 'tills vidare'}`;
}

/** Kort variant till profilens serie-chip: "2 dagar" / "Varannan vecka" / "Varje vecka". */
export function seriesRhythmLabel(e: Pick<LinkEvent, 'repeatIntervalWeeks' | 'repeatDays'>): string {
    const days = normalizeRepeatDays(e.repeatDays);
    if (days !== null) return `${days} dagar`;
    return normalizeIntervalWeeks(e.repeatIntervalWeeks) === 2 ? 'Varannan vecka' : 'Varje vecka';
}

/**
 * Dagsseriens FÖRSTA dag, även sett från ett utvecklat tillfälle (vars
 * `time` är dagens egen): räknas bakåt från seriesEndsAt. Används när man
 * redigerar från dag 2: då ska formuläret visa hela serien, inte krympa
 * den till "från och med idag". null för allt som inte är en dagsserie.
 */
export function dailySeriesStart(e: Pick<LinkEvent, 'time' | 'repeatDays' | 'seriesEndsAt'>): Date | null {
    const days = normalizeRepeatDays(e.repeatDays);
    if (days === null) return null;
    return e.seriesEndsAt ? addDays(e.seriesEndsAt, -(days - 1)) : e.time;
}

/**
 * "lör 10-sön 11 okt." (samma månad) eller "fre 30 okt.-sön 1 nov.".
 * Årtal bara när slutet ligger i ett annat år än nu.
 */
export function dayRangeLabel(start: Date, end: Date, now: Date = new Date()): string {
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const from = start.toLocaleDateString('sv-SE', sameMonth
        ? { weekday: 'short', day: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' });
    const to = end.toLocaleDateString('sv-SE', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        ...(end.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    });
    return `${from}-${to}`;
}

/**
 * Hur långt fram en veckoserie vecklas ut. Måste täcka hur långt man kan
 * bläddra framåt i dagvyn utan att bli absurt. Tolv veckor är ett kvartals
 * pubquiz, vilket räcker gott och håller nere antalet brickor på kartan.
 */
const WEEKLY_HORIZON_WEEKS = 12;

type SeriesBase = Pick<LinkEvent, 'id' | 'time' | 'repeatWeekly' | 'repeatWeeks' | 'repeatIntervalWeeks' | 'repeatDays'>;

/**
 * Veckla ut en serie (dagar i rad eller veckovis) till konkreta tillfällen.
 *
 * Serien lagras som EN regel på dokumentet; veckodag och klockslag kommer
 * från basens `time`. Här produceras tillfällena från och med `from` och
 * WEEKLY_HORIZON_WEEKS framåt (en dagsserie tar alltid slut långt innan).
 *
 * Varje tillfälle får ett EGET id ("<docId>__2026-08-13"): kartan, dedupen i
 * emit() och React-nycklarna kräver unika id, och med delat id hade bara ett
 * enda tillfälle ritats ut. Kopplingen tillbaka till dokumentet bär `seriesId`.
 *
 * Generisk så att stadssidan kan veckla ut sina egna lätta rader med samma
 * regler som kartan (utan att dra in hela linkEventService i sin bundle).
 */
export function expandSeries<T extends SeriesBase>(
    base: T,
    from: Date,
): (T & { id: string; time: Date; seriesId: string; seriesEndsAt?: Date })[] {
    const out: (T & { id: string; time: Date; seriesId: string; seriesEndsAt?: Date })[] = [];
    const horizon = addDays(from, WEEKLY_HORIZON_WEEKS * 7);

    // Slutet: en dagsserie tar slut efter repeatDays dagar. En begränsad
    // veckoserie (repeatWeeks) tar slut vid sista TILLFÄLLET, som med
    // varannan vecka-rytm kan ligga före sista veckan (8 veckor varannan
    // vecka = fjärde gången i vecka 7). Utan fältet rullar veckoserien tills
    // vidare, som alla serier gjorde innan valet fanns. En färdigspelad serie
    // ger [] och försvinner från kartan.
    const days = normalizeRepeatDays(base.repeatDays);
    let seriesEnd: Date | null;
    let stepDays: number;
    if (days !== null) {
        seriesEnd = addDays(base.time, days - 1);
        stepDays = 1;
    } else {
        const times = occurrencesForWeeks(base.repeatWeeks, base.repeatIntervalWeeks);
        seriesEnd = times === null ? null : seriesLastDate(base.time, times, base.repeatIntervalWeeks);
        // Rytmen (repeatIntervalWeeks 2 = varannan vecka) styr steget.
        // Utelämnad/ogiltig rytm = varje vecka (alla serier före 15/9).
        stepDays = 7 * normalizeIntervalWeeks(base.repeatIntervalWeeks);
    }
    if (seriesEnd && seriesEnd < horizon) horizon.setTime(seriesEnd.getTime());

    // Starta på basens tid och stega en period i taget fram till `from`:
    // serier som startade i våras ska börja vid nästa kommande tillfälle,
    // inte spamma kartan med varje passerat datum. Stegning från BASEN
    // bevarar pariteten, så en varannan vecka-serie hamnar aldrig på "fel"
    // vecka.
    const cursor = new Date(base.time);
    while (cursor < from) cursor.setDate(cursor.getDate() + stepDays);

    while (cursor <= horizon) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        out.push({
            ...base,
            id: `${base.id}__${y}-${m}-${d}`,
            seriesId: base.id,
            seriesEndsAt: seriesEnd ?? undefined,
            time: new Date(cursor),
        });
        cursor.setDate(cursor.getDate() + stepDays);
    }
    return out;
}
