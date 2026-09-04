/**
 * Eventkortets SNÄPP-STOPP (Josef 2/9: "två nya sticky-positioner — när man
 * scrollar på kortet ska det stanna på tapp-höjden först, sen på taket innan
 * vi börjar scrolla inom själva kortet"). Rena funktioner över en lista
 * stopp i vh (stigande): kortets default-höjd (header + bildremsa), tapp-
 * höjden (bild + första beskrivningsraden) och taket. Hjulet tar ETT steg per
 * gest; ett fingerdrag landar på närmaste stopp i dragets riktning.
 */

/** Stopplista: sorterad stigande, utan dubbletter närmare än minGapVh
 *  (tapp-höjden kan sammanfalla med default eller taket för korta kort). */
export function sheetStops(values: number[], minGapVh = 4): number[] {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
        if (out.length === 0 || v - out[out.length - 1] > minGapVh) out.push(v);
    }
    return out;
}

/** Hjul uppåt: nästa stopp ovanför h (mer än tolerance ovanför, så ett
 *  läge strax under ett stopp inte räknas som "redan där"). Inget ovanför →
 *  högsta stoppet. */
export function nextStopAbove(stops: number[], h: number, tolerance = 4): number {
    for (const s of stops) if (s > h + tolerance) return s;
    return stops[stops.length - 1];
}

/** Hjul nedåt: nästa stopp nedanför h. null = inget kvar → stäng kortet. */
export function nextStopBelow(stops: number[], h: number, tolerance = 4): number | null {
    for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < h - tolerance) return stops[i];
    return null;
}

/** Släpp efter ett UPPÅT-drag som började på start och släpptes på h:
 *  närmaste stopp bland dem ovanför start — alltid minst ett steg upp (ett
 *  kort ryck avancerar), och drar man långt landar man där fingret släppte.
 *  Vid lika avstånd vinner det högre (dragets riktning). Inget stopp ovanför
 *  start → högsta stoppet. */
export function snapUp(stops: number[], start: number, h: number, tolerance = 4): number {
    const above = stops.filter(s => s > start + tolerance);
    if (above.length === 0) return stops[stops.length - 1];
    let best = above[0];
    for (const s of above) if (Math.abs(s - h) <= Math.abs(best - h)) best = s;
    return best;
}

/** Släpp efter ett NEDÅT-drag: närmaste stopp bland dem nedanför start —
 *  minst ett steg ner; vid lika vinner det lägre. null = inget stopp under
 *  start → stäng kortet. */
export function snapDown(stops: number[], start: number, h: number, tolerance = 4): number | null {
    const below = stops.filter(s => s < start - tolerance);
    if (below.length === 0) return null;
    let best = below[below.length - 1];
    for (let i = below.length - 1; i >= 0; i--) {
        if (Math.abs(below[i] - h) <= Math.abs(best - h)) best = below[i];
    }
    return best;
}
