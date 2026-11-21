/**
 * ÅNGAN (#268, Josef 22/11: "den ska liksom avdunsta snabbt. inte flyga iväg
 * sådär" - ersätter rökmolnet från 21/11 som blåstes åt sidan): när man
 * trycker på tipset under stadsplattan löses det upp på stället. Själva
 * pillen tonas bort av CSS:en (.smoke-hint-blown i globals.css); här räknas
 * de små ångpuffarna som stiger ur den.
 *
 * Puffarna stiger RAKT UPP och driver högst några pixlar åt sidan. Sidan man
 * tryckte på avgör bara var upplösningen börjar: vågen går därifrån tvärs
 * över pillen. Allt slumpas med ett FAST frö: samma ånga varje gång, och
 * funktionen går att testa. REN.
 */

/** Åt vilket håll upplösningen går: 1 = från vänster åt höger, -1 = tvärtom. */
export type SmokeDir = 1 | -1;

export interface SmokePuff {
    /** Startläge, puffens mitt, i px från pillens övre vänstra hörn. */
    x: number;
    y: number;
    /** Diameter i px vid start. */
    size: number;
    /** Hur långt puffen driver (px). dx är högst SMOKE_DRIFT_MAX_PX, dy är
     *  alltid uppåt (negativt) - ånga stiger. */
    dx: number;
    dy: number;
    /** Slutskalan: puffen sväller medan den tunnas ut. */
    scale: number;
    /** Högsta tätheten, 0-1. */
    opacity: number;
    /** När puffen lossnar och hur länge den lever (ms). */
    delay: number;
    duration: number;
}

export const SMOKE_PUFF_COUNT = 10;
/** Vågens längd: sista puffen lossnar så här långt efter den första. */
export const SMOKE_WAVE_MS = 70;
/** Kortaste och längsta livslängden för en puff. Kort: det ska avdunsta,
 *  inte bli hängande. */
export const SMOKE_PUFF_MIN_MS = 260;
export const SMOKE_PUFF_MAX_MS = 440;
/** Pillens egen upplösning (CSS: --smoke-ms). */
export const SMOKE_BLOW_MS = 340;
/** När allt är borta och tipset kan avmonteras. */
/** Längsta sidodriften för en puff (px): den stiger, den flyger inte. */
export const SMOKE_DRIFT_MAX_PX = 8;
export const SMOKE_GONE_MS = SMOKE_WAVE_MS + SMOKE_PUFF_MAX_MS + 40;

/** Trycket avgör blåsets håll: vänstra halvan blåser åt höger och tvärtom.
 *  Tangentbordet (ingen punkt) blåser åt höger. REN. */
export function smokeDirFor(clickX: number | null, left: number, width: number): SmokeDir {
    if (clickX === null || width <= 0) return 1;
    return clickX - left <= width / 2 ? 1 : -1;
}

export function buildSmokePuffs(width: number, height: number, dir: SmokeDir, count = SMOKE_PUFF_COUNT, seed = 268): SmokePuff[] {
    let s = seed;
    const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    return Array.from({ length: count }, (_, i) => {
        // Jämnt utspridda längs pillen med lite skakning, så hela texten
        // löses upp och inget hål blir kvar.
        const along = (i + 0.15 + rand() * 0.7) / count;
        // 0 = sidan blåset kommer ifrån, 1 = läsidan.
        const fromWind = dir === 1 ? along : 1 - along;
        const size = Math.round(h * (0.7 + rand() * 0.6));
        // Ånga stiger: rakt upp, med en liten drift åt upplösningens håll.
        const drift = rand() * SMOKE_DRIFT_MAX_PX;
        const lift = -(12 + rand() * 20);
        return {
            x: Math.round(along * w),
            y: Math.round(h * (0.25 + rand() * 0.5)),
            size,
            dx: Math.round(dir * drift),
            dy: Math.round(lift),
            scale: +(1.3 + rand() * 0.7).toFixed(2),
            opacity: +(0.45 + rand() * 0.35).toFixed(2),
            delay: Math.round(fromWind * SMOKE_WAVE_MS),
            duration: Math.round(SMOKE_PUFF_MIN_MS + rand() * (SMOKE_PUFF_MAX_MS - SMOKE_PUFF_MIN_MS)),
        };
    });
}
