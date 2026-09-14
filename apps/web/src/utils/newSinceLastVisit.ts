/**
 * "Nytt sedan sist" — logiken bakom bannern som hälsar ÅTERKOMMANDE besökare
 * med hur många nya event som dykt upp i vyn sedan förra besöket.
 *
 * Dag-precision hela vägen: aggregatet bär `firstSeen` som YYYY-MM-DD (UTC,
 * bara för event yngre än 14 dagar — scraperns utils/firstSeenExport), och
 * baslinjen är förra besökets UTC-dag. Ren strängjämförelse räcker (ISO-datum
 * sorterar lexikografiskt). Dag i stället för klockslag gör räkningen
 * medvetet KONSERVATIV: event först sedda SAMMA dag som förra besöket räknas
 * inte som nya — aggregatet bakas ~00:30, så de syntes med största
 * sannolikhet redan då. Hellre en för låg siffra än en banner som ljuger.
 *
 * Geo-/filtermåtten är avsiktligt INTE härinne: bannern räknar genom sidans
 * matchesFilter + inMapView, exakt som stadsrutan/areaCounts — aldrig ett
 * eget närhetsmått (se tom-promptens regel).
 */

/** Färre nya än så → ingen banner. "1 nytt event" säljer inget återbesök —
 *  samma resonemang som helgtips-pushens DIGEST_MIN_EVENTS. */
export const NEW_SINCE_MIN_COUNT = 3;

const STORAGE_KEY = 'vadkul_last_visit';

/** Först sedd EFTER baslinjedagen? (Bägge YYYY-MM-DD; saknas något → false.) */
export function isNewSince(firstSeen: string | undefined, baselineDay: string | null): boolean {
    if (!firstSeen || !baselineDay) return false;
    return firstSeen > baselineDay;
}

/**
 * Lagrad besöks-ISO → UTC-dag att jämföra firstSeen mot. null när inget
 * lagrat, oparsbart eller i framtiden (klockskev/manipulerat värde — en
 * framtida baslinje skulle tysta bannern för evigt).
 */
export function visitBaselineDay(storedIso: string | null, nowMs: number): string | null {
    if (!storedIso) return null;
    const t = Date.parse(storedIso);
    if (!Number.isFinite(t) || t > nowMs) return null;
    return new Date(t).toISOString().slice(0, 10);
}

let bootBaseline: string | null | undefined;

/**
 * Läs förra besökets baslinje och stämpla DETTA besök — EN gång per
 * sidladdning. Modulvariabeln är StrictMode-nätet: dubbelmonterade effekter
 * får samma svar i stället för att andra anropet läser stämpeln det första
 * just skrev (samma fälla som djuplänks-booten). localStorage kan saknas
 * eller kasta (SSR, privat läge) — då finns ingen baslinje och inget
 * stämplas: bannern uteblir tyst. Första besöket (inget lagrat) ger också
 * null — det finns inget "sist" att jämföra med, välkomstrutan är stjärnan.
 */
export function readAndStampVisit(nowMs: number = Date.now()): string | null {
    if (bootBaseline !== undefined) return bootBaseline;
    try {
        const prev = window.localStorage.getItem(STORAGE_KEY);
        bootBaseline = visitBaselineDay(prev, nowMs);
        window.localStorage.setItem(STORAGE_KEY, new Date(nowMs).toISOString());
    } catch {
        bootBaseline = null;
    }
    return bootBaseline;
}
