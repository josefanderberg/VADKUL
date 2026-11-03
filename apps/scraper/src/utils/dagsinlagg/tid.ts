/**
 * tid.ts - svensk väggtid utan beroenden. Dagsinlägget resonerar alltid i
 * Europe/Stockholm: "i dag", "i helgen" och "den här veckan" är svenska
 * dygn oavsett var jobbet råkar köra (minin står i Stockholm, vitest låser
 * TZ, men Intl-vägen gör det sant även annars). Samma recept som
 * apps/functions/src/utils/weekendDigest.ts.
 */

export const DAG_MS = 86_400_000;

const DATUM_FMT = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
});
const DELAR_FMT = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** 'YYYY-MM-DD' i Stockholm. */
export function stockholmDatum(at: Date | number): string {
    const p: Record<string, string> = {};
    DATUM_FMT.formatToParts(new Date(at)).forEach(d => { p[d.type] = d.value; });
    return `${p.year}-${p.month}-${p.day}`;
}

/** Europe/Stockholm-offset (ms) vid en tidpunkt, CET/CEST-säker. */
export function stockholmOffsetMs(at: Date): number {
    const p: Record<string, string> = {};
    DELAR_FMT.formatToParts(at).forEach(d => { p[d.type] = d.value; });
    const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return wallAsUtc - at.getTime();
}

/** UTC-tidpunkten för svensk midnatt på väggdatumet 'YYYY-MM-DD'. */
export function stockholmMidnatt(datum: string): Date {
    const [y, m, d] = datum.split('-').map(Number);
    let guess = Date.UTC(y, m - 1, d);
    for (let i = 0; i < 2; i++) guess = Date.UTC(y, m - 1, d) - stockholmOffsetMs(new Date(guess));
    return new Date(guess);
}

/** Veckodag i Stockholm: 0 = söndag ... 6 = lördag (som Date#getDay). */
export function stockholmVeckodag(at: Date | number): number {
    const datum = stockholmDatum(at);
    const [y, m, d] = datum.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

/** Väggdatumet n dagar från ett datum. */
export function plusDagar(datum: string, n: number): string {
    const [y, m, d] = datum.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

/** Antal hela dagar mellan två väggdatum (b - a). */
export function dagarMellan(a: string, b: string): number {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAG_MS);
}

/** [start, slut) i UTC för ett svenskt dygn. */
export function dygnet(datum: string): { start: Date; slut: Date } {
    return { start: stockholmMidnatt(datum), slut: stockholmMidnatt(plusDagar(datum, 1)) };
}

/**
 * Helgfönstret [fredag 00:00, måndag 00:00) svensk tid sett från `at`.
 * Mån-tor ger kommande helg, fre-sön innevarande (samma som helgpushen).
 */
export function helgen(at: Date | number): { start: Date; slut: Date; fredag: string } {
    const datum = stockholmDatum(at);
    const veckodag = stockholmVeckodag(at);
    const tillFredag = veckodag === 0 ? -2 : 5 - veckodag;
    const fredag = plusDagar(datum, tillFredag);
    return { start: stockholmMidnatt(fredag), slut: stockholmMidnatt(plusDagar(fredag, 3)), fredag };
}

/** Klockslag 'HH:MM' i Stockholm. */
export function stockholmKlockslag(at: Date | number): string {
    const p: Record<string, string> = {};
    DELAR_FMT.formatToParts(new Date(at)).forEach(d => { p[d.type] = d.value; });
    return `${p.hour}:${p.minute}`;
}

/** UTC-tidpunkt för ett klockslag 'HH:MM' på ett svenskt väggdatum. */
export function stockholmTid(datum: string, klockslag: string): Date {
    const [h, m] = klockslag.split(':').map(Number);
    return new Date(stockholmMidnatt(datum).getTime() + (h * 60 + m) * 60_000);
}
