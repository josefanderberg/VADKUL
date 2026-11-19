/**
 * Kartans titlar runt brickorna - VAR en titel får stå och I VILKEN ORDNING
 * lägena provas. Delas av webben (components/v2/v2MapLabel + V2Map) och appen
 * (lib/etikettLagen + components/KartBrickor), #196, #204, #261, #262.
 *
 * Lägena (#196/#204): MapLibre-ankare + förskjutning i em av textstorleken,
 * relativt koordinaten (brickans spets). Första lediga vinner.
 *
 * TITLARNA VÄXER MOT MITTEN (#262, Josef 19/11: "prioritera så att titlarna
 * visas mot mitten av skärmen. så att inte 50% av alla titlar är utanför
 * kanten"): en bricka i vänstra delen av bilden provar först lägena som
 * sträcker sig åt höger (under utdragen åt höger, höger om kroppen, ovanför
 * utdragen åt höger), en i högra delen spegelvänt. I mittdelen gäller den
 * vanliga ordningen. "Under brickan först" (#196) står kvar överallt - i
 * kanterna är det bara under, utdragen inåt.
 *
 * Sidan räknas när kartan stannat och följer med brickan som egenskapen
 * `side` (TITLE_SIDE_PROP): 0 mitten, 1 vänster, 2 höger. Lagren väljer
 * ordning med ett match-uttryck på den.
 *
 * Ren modul: inga kart- eller webbläsar-API:er.
 */

/** MapLibres ankarnamn - sidan av texten som står på punkten. */
export type TitleAnchor =
    'top' | 'left' | 'right' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TitlePlacement = readonly [TitleAnchor, readonly [number, number]];

/** Den vanliga ordningen (mitten av bilden) - webbens LABEL_TITLE_PLACEMENTS sedan #204. */
export const TITLE_PLACEMENTS: readonly TitlePlacement[] = [
    ['top', [0, 0.35]],             // under brickan (föredras)
    ['left', [2.4, -2.5]],          // till höger om kroppen, i höjd med dess mitt
    ['right', [-2.4, -2.5]],        // till vänster om kroppen
    ['bottom', [0, -5.3]],          // ovanför brickan
    ['top-left', [-0.5, 0.35]],     // under, utdragen åt höger
    ['top-right', [0.5, 0.35]],     // under, utdragen åt vänster
    ['bottom-left', [-0.25, -5.3]], // ovanför, utdragen åt höger
    ['bottom-right', [0.25, -5.3]], // ovanför, utdragen åt vänster (fri från +N-pillen)
];

function läge(a: TitleAnchor): TitlePlacement {
    const p = TITLE_PLACEMENTS.find(([x]) => x === a);
    if (!p) throw new Error(`okänt läge ${a}`);
    return p;
}

/** Brickan står i vänstra delen: titeln växer åt höger, inåt. */
const INÅT_HÖGER: readonly TitlePlacement[] = (
    ['top-left', 'left', 'bottom-left', 'top', 'bottom', 'top-right', 'right', 'bottom-right'] as const
).map(läge);
/** Brickan står i högra delen: titeln växer åt vänster, inåt. */
const INÅT_VÄNSTER: readonly TitlePlacement[] = (
    ['top-right', 'right', 'bottom-right', 'top', 'bottom', 'top-left', 'left', 'bottom-left'] as const
).map(läge);

/** 0 = mitten, 1 = vänstra delen, 2 = högra delen. */
export type TitleSide = 0 | 1 | 2;
/** Egenskapen på kartans features som bär sidan. */
export const TITLE_SIDE_PROP = 'side';

/** Ordningen per sida, index = TitleSide. Alla har samma åtta lägen. */
export const TITLE_PLACEMENTS_BY_SIDE: readonly (readonly TitlePlacement[])[] = [
    TITLE_PLACEMENTS,
    INÅT_HÖGER,
    INÅT_VÄNSTER,
];

/**
 * Mittdelens halva bredd som andel av bildens bredd: bricktoppar inom
 * mittersta tredjedelen får den vanliga ordningen, utanför växer titeln inåt.
 */
export const TITLE_SIDE_CENTER_SHARE = 1 / 6;

/** Sidan för en bricka `dxPx` skärmpixlar från bildens mitt (öster positivt). */
export function titleSide(dxPx: number, viewportWidth: number): TitleSide {
    if (!Number.isFinite(dxPx) || !(viewportWidth > 0)) return 0;
    const gräns = viewportWidth * TITLE_SIDE_CENTER_SHARE;
    if (dxPx < -gräns) return 1;
    if (dxPx > gräns) return 2;
    return 0;
}

/**
 * Ett match-uttryck på sidan som väljer ett värde per sida (MapLibres
 * stilspråk, samma på webben och i appen). `värde` får sidans ordning.
 */
export function bySideExpression<T>(värde: (ordning: readonly TitlePlacement[]) => T): unknown[] {
    return [
        'match', ['coalesce', ['get', TITLE_SIDE_PROP], 0],
        1, värde(TITLE_PLACEMENTS_BY_SIDE[1]),
        2, värde(TITLE_PLACEMENTS_BY_SIDE[2]),
        värde(TITLE_PLACEMENTS_BY_SIDE[0]),
    ];
}
