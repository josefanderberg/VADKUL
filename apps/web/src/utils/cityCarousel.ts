/**
 * STADSKARUSELLEN (#268, Josef 21/11: "staden ska vara att man kan scrolla åt
 * sidorna" och "när man ser städer ser det som lite spelliknande"): stads-
 * valet är en rad brickor man drar i sidled, som banväljaren i ett spel.
 * Brickan i mitten är den valda - den är störst och lyser, grannarna krymper
 * och tonar ut ju längre från mitten de står.
 *
 * Här bor bara räkningen; mätningen och ritningen ligger i StartCityPicker.
 * REN.
 */

/** Minsta skala och täthet för en bricka långt från mitten (CSS:en läser
 *  fokus 0-1 och räknar själv, konstanterna låser bara testet mot den). */
export const TILE_MIN_SCALE = 0.8;
export const TILE_MIN_OPACITY = 0.55;

/**
 * Hur mycket en bricka är "i mitten": 1 när dess mitt står i radens mitt,
 * 0 när den står en hel brickbredd (spacing) bort eller mer. Mjukt avrundad
 * i båda ändar (smoothstep), så brickan inte börjar växa med ett ryck när
 * den glider in mot mitten.
 */
export function tileFocus(tileCenter: number, viewCenter: number, spacing: number): number {
    if (spacing <= 0) return 0;
    const t = 1 - Math.min(1, Math.abs(tileCenter - viewCenter) / spacing);
    return t * t * (3 - 2 * t);
}

/** Index för brickan närmast mitten. Lika nära → den tidigare vinner, så
 *  valet inte fladdrar mitt emellan två brickor. Tom rad → -1. */
export function focusedTile(tileCenters: readonly number[], viewCenter: number): number {
    let best = -1;
    let bestDist = Infinity;
    tileCenters.forEach((c, i) => {
        const d = Math.abs(c - viewCenter);
        if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
}

/** Scrolläget som ställer en bricka mitt i raden, hållet inom radens gränser. */
export function scrollLeftFor(tileCenter: number, viewWidth: number, scrollWidth: number): number {
    const max = Math.max(0, scrollWidth - viewWidth);
    return Math.min(max, Math.max(0, tileCenter - viewWidth / 2));
}

/** Ett steg åt sidan, stannar i ändarna. */
export function stepTile(current: number, delta: number, count: number): number {
    if (count <= 0) return -1;
    return Math.min(count - 1, Math.max(0, current + delta));
}
