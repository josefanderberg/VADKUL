/**
 * Eventkortets SNÄPP-STOPP (Josef 2/9: "två nya sticky-positioner — när man
 * scrollar på kortet ska det stanna på tapp-höjden först, sen på taket innan
 * vi börjar scrolla inom själva kortet"). Rena funktioner över en lista
 * stopp i vh (stigande): kortets default-höjd (header + bildremsa), tapp-
 * höjden (bild + första beskrivningsraden) och taket. Hjulet tar ETT steg per
 * gest. Ett fingerdrag tar minst ett steg i dragets riktning och HOPPAR
 * VIDARE när det är tydligt att man vill längre (Josef 11/10: "om man slidar
 * längre upp så ska den hoppa upp 2 steg direkt ... som att bara slida ner
 * hela eventkortet hela vägen ner om man gör en mer längre dragning"): ett
 * stopp passeras när släppet nått SKIP_FRAC av vägen förbi det, och farten i
 * släppet räknas in (projicerat PROJ_MS framåt, högst MAX_PROJ_VH).
 */

/** Andel av avståndet till NÄSTA stopp som släppet måste ha passerat ett
 *  stopp med för att hoppa vidare (0,5 = närmaste stopp, det gamla läget). */
export const SKIP_FRAC = 0.25;
/** Så långt fram (ms) släppets fart projiceras. */
export const PROJ_MS = 100;
/** Tak för projektionen - ett vilt ryck ska inte flyga över hela arket. */
export const MAX_PROJ_VH = 15;

/** Släpphöjden med farten inräknad. velocity i vh/ms, positivt = uppåt. */
export function projectedHeight(h: number, velocity: number, maxProj = MAX_PROJ_VH): number {
    const proj = Math.max(-maxProj, Math.min(maxProj, velocity * PROJ_MS));
    return h + proj;
}

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

/** Släpp efter ett UPPÅT-drag som började på start och släpptes på h
 *  (gärna projicerad, se projectedHeight): första stoppet ovanför start -
 *  alltid minst ett steg upp (ett kort ryck avancerar) - och vidare till
 *  nästa så länge h passerat stoppet med SKIP_FRAC av gapet dit. Inget stopp
 *  ovanför start → högsta stoppet. */
export function snapUp(stops: number[], start: number, h: number, tolerance = 4): number {
    const above = stops.filter(s => s > start + tolerance);
    if (above.length === 0) return stops[stops.length - 1];
    let i = 0;
    while (i + 1 < above.length && h >= above[i] + SKIP_FRAC * (above[i + 1] - above[i])) i++;
    return above[i];
}

/** Släpp efter ett NEDÅT-drag: första stoppet nedanför start (minst ett
 *  steg ner), sedan vidare nedåt med samma SKIP_FRAC-regel. Under det lägsta
 *  stoppet väntar "stängt" (höjd 0): passerar h det lägsta stoppet med
 *  SKIP_FRAC av dess höjd stängs kortet. null = stäng. */
export function snapDown(stops: number[], start: number, h: number, tolerance = 4): number | null {
    const below = stops.filter(s => s < start - tolerance).reverse();
    if (below.length === 0) return null;
    const path = [...below, 0];
    let i = 0;
    while (i + 1 < path.length && h <= path[i] - SKIP_FRAC * (path[i] - path[i + 1])) i++;
    return i === path.length - 1 ? null : path[i];
}

/** Släpp efter ett LODRÄTT fingerdrag. edge = var sträcket mellan tid/plats
 *  och arrangören sitter (kortets höjd när sträcket ligger precis i skärm-
 *  kanten) - det är också kortets lägsta stopp, KOMPAKTLÄGET (Josef 30/9:
 *  "dra ner det så inte arrangören syns, men drar man ner så det sträcket
 *  mellan arrangören och tiden försvinner över kanten, så ska den
 *  försvinna"). Ordning:
 *  - uppåt → snapUp (minst ett stopp upp, hoppar vidare vid långt drag)
 *  - nedåt kortare än minPull → tillbaka dit gesten började (darr på fingret)
 *  - nedåt och sträcket har gått under kanten (h < edge) → null = stäng
 *  - annars snapDown (null = stäng: inget stopp under start, eller ett så
 *    långt drag att det passerat det lägsta stoppet)
 *  Riktning, darr och kanten avgörs av var fingret faktiskt släppte (h);
 *  vilket stopp man landar på av h med farten inräknad (velocity, vh/ms,
 *  positivt = uppåt). edge = null när kortet saknar sträcket (väljarlistan) -
 *  då avgör bara stoppen. */
export function snapRelease(
    stops: number[],
    start: number,
    h: number,
    edge: number | null,
    minPull = 6,
    tolerance = 4,
    velocity = 0,
): number | null {
    const hp = projectedHeight(h, velocity);
    if (h > start) return snapUp(stops, start, hp, tolerance);
    if (start - h < minPull) return start;
    if (edge !== null && h < edge) return null;
    return snapDown(stops, start, hp, tolerance);
}

/** Släppets fart (vh/ms, positivt = uppåt) ur dragets senaste höjdprov:
 *  bara prov från de sista windowMs räknas, så ett finger som stått still
 *  före släppet ger 0. */
export function releaseVelocity(
    samples: { t: number; h: number }[],
    now: number,
    windowMs = 80,
): number {
    const recent = samples.filter(s => now - s.t <= windowMs);
    if (recent.length < 2) return 0;
    const a = recent[0];
    const b = recent[recent.length - 1];
    const dt = b.t - a.t;
    return dt > 0 ? (b.h - a.h) / dt : 0;
}
