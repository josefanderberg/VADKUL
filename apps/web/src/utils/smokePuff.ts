/**
 * RÖKMOLNET (#268, Josef 21/11: "det försvinner som ett rökmoln. alltså mjukt
 * blås med kraftfullt"): när man trycker på tipset under stadsplattan blåses
 * det bort. Själva pillen sveps iväg av CSS:en (.smoke-hint-blown i
 * globals.css); här räknas rökpuffarna som lossnar ur den.
 *
 * Blåset kommer från sidan man tryckte på, så puffarna närmast den sidan
 * lossnar först och vågen går tvärs över pillen. Allt slumpas med ett FAST
 * frö: samma moln varje gång, och funktionen går att testa. REN.
 */

/** Åt vilket håll det blåser: 1 = åt höger, -1 = åt vänster. */
export type SmokeDir = 1 | -1;

export interface SmokePuff {
    /** Startläge, puffens mitt, i px från pillens övre vänstra hörn. */
    x: number;
    y: number;
    /** Diameter i px vid start. */
    size: number;
    /** Hur långt puffen driver (px). dx har alltid blåsets tecken, dy är
     *  uppåt (negativt) för de flesta - rök stiger. */
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

export const SMOKE_PUFF_COUNT = 14;
/** Vågens längd: sista puffen lossnar så här långt efter den första. */
export const SMOKE_WAVE_MS = 160;
/** Kortaste och längsta livslängden för en puff. Röken ska hänga kvar en
 *  stund efter att pillen är borta - kortare än så blev det bara en blixt. */
export const SMOKE_PUFF_MIN_MS = 720;
export const SMOKE_PUFF_MAX_MS = 1150;
/** Pillens egen bortblåsning (CSS: --smoke-ms). */
export const SMOKE_BLOW_MS = 900;
/** När allt är borta och tipset kan avmonteras. */
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
        const size = Math.round(h * (0.9 + rand() * 0.9));
        // Lovart-puffarna har längst väg kvar genom pillen och driver längst.
        const reach = 70 + (1 - fromWind) * 46 + rand() * 54;
        const lift = -(8 + rand() * 30) + (rand() < 0.2 ? 14 : 0);
        return {
            x: Math.round(along * w),
            y: Math.round(h * (0.25 + rand() * 0.5)),
            size,
            dx: Math.round(dir * reach),
            dy: Math.round(lift),
            scale: +(1.7 + rand() * 1.3).toFixed(2),
            opacity: +(0.55 + rand() * 0.4).toFixed(2),
            delay: Math.round(fromWind * SMOKE_WAVE_MS),
            duration: Math.round(SMOKE_PUFF_MIN_MS + rand() * (SMOKE_PUFF_MAX_MS - SMOKE_PUFF_MIN_MS)),
        };
    });
}
