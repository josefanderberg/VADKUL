/**
 * KARTAN LUTAR SIG NÄRA INPÅ (#286, ägarbeslut 24/11 2026, Josef: "göra
 * kartan som i gta 6. alltså att kartan vinklas och bli 3d i slutet när man
 * är nära").
 *
 * Två delar, båda styrda av ZOOMEN och inget annat - det finns ingen knapp
 * (tilt-knappen är riven på ägarbeslut, se kart-ui-skillen), och användaren
 * lutar inte själv:
 *
 *  1. LUTNINGEN (`pitchForZoom`): plan karta upp till TILT_START_ZOOM, sedan
 *     en rak ramp upp till TILT_MAX_DEG vid TILT_FULL_ZOOM. Klienten sätter
 *     kurvans värde i VARJE bildruta av varje kamerarörelse (webben via
 *     MapLibres transformCameraUpdate), så lutningen glider med medan man
 *     nyper - Josef 24/11 efter första varvet med utjämning vid zoomstoppet:
 *     "ändrar vinkel samtidigt som man zoomar in så det blir mer smooth och
 *     lite tidigare längre upp". En stadslandning från en lutad kvartersvy
 *     blir plan av sig själv eftersom lutningen följer zoomen hela vägen.
 *
 *  2. 3D-HUSEN (`addBuilding3dLayer`): kaklens byggnader som fill-extrusion
 *     från BUILDING_3D_MIN_ZOOM, med höjden intonad över ett zoomsteg så husen
 *     reser sig i stället för att poppa upp. CARTO:s Protomaps-kakel bär
 *     `height` (meter) på ungefär var tredje byggnad (mätt 24/11: 185 av 355
 *     hus i centrala Göteborg, 64 av 218 i Växjö) och `min_height` på några
 *     få; resten får BUILDING_3D_FALLBACK_M. Punktfeaturen `address`
 *     (husnummer) ligger i samma source-layer och filtreras bort.
 *
 * Bor i kontraktet så appen får exakt samma kurva och samma hus när den tar
 * steget (egen ticket). Inget här får bero på MapLibre: stilen tas emot som
 * ett löst typat objekt, precis som i poiSigns.ts.
 */

/**
 * Zoomen där kartan börjar luta sig. Under den är den plan. 12 = där molnen
 * är helt borta (CLOUD_GONE_ZOOM) och utspridningen av brickorna slutar;
 * stadslandningen (~10,5) är plan. Var 14 i första varvet och 13 i andra -
 * Josef 24/11 (#288): "allt kan flyttas 1 zoomsteg längre ut/bort".
 */
export const TILT_START_ZOOM = 12;
/** Zoomen där lutningen nått sitt max. */
export const TILT_FULL_ZOOM = 14.5;
/** Största lutningen i grader. MapLibres tak är 60; 50 lämnar horisonten utanför bild. */
export const TILT_MAX_DEG = 50;

/**
 * Lutningen (grader) kartan ska ha på en given zoom. Rak ramp mellan start
 * och full zoom, klampad utanför. NaN/Infinity ger plan karta.
 */
export function pitchForZoom(zoom: number): number {
    if (!Number.isFinite(zoom)) return 0;
    if (zoom <= TILT_START_ZOOM) return 0;
    if (zoom >= TILT_FULL_ZOOM) return TILT_MAX_DEG;
    return ((zoom - TILT_START_ZOOM) / (TILT_FULL_ZOOM - TILT_START_ZOOM)) * TILT_MAX_DEG;
}

/**
 * Zoomen där 3D-husen börjar resa sig (höjden 0 där, full ett steg senare).
 * 13 = där Voyagers byggnadslager börjar; var 14 före #288.
 */
export const BUILDING_3D_MIN_ZOOM = 13;
/** Höjd i meter för hus utan `height` i kaklen - ett tvåvåningshus. */
export const BUILDING_3D_FALLBACK_M = 8;
/** Lagrets id i stilen. */
export const BUILDING_3D_LAYER_ID = 'vadkul-building-3d';
/** Väggfärgen: samma dämpade beige som nöjesfältets platta hus. */
export const BUILDING_3D_COLOR = '#d9d3c4';

export interface TiltStyleLayer {
    id: string;
    type?: string;
    source?: unknown;
    'source-layer'?: unknown;
    minzoom?: number;
    [key: string]: unknown;
}
export interface TiltStyle {
    layers?: TiltStyleLayer[];
}

/**
 * Bygg 3D-huslagret mot källan `source` (baskartans vektorkälla). Höjd och
 * sockel tonas in från 0 vid BUILDING_3D_MIN_ZOOM till kaklens värde ett
 * zoomsteg senare. Sockeln (`min_height`) används bara när huset har en höjd,
 * annars kan sockeln hamna över taket.
 */
export function building3dLayer(source: string): TiltStyleLayer {
    const height = ['coalesce', ['get', 'height'], BUILDING_3D_FALLBACK_M];
    const base = ['case', ['has', 'height'], ['coalesce', ['get', 'min_height'], 0], 0];
    return {
        id: BUILDING_3D_LAYER_ID,
        type: 'fill-extrusion',
        source,
        'source-layer': 'buildings',
        minzoom: BUILDING_3D_MIN_ZOOM,
        filter: ['all',
            ['match', ['get', 'kind'], ['building', 'building_part'], true, false],
            ['>=', ['coalesce', ['get', 'layer'], 0], 0],
        ],
        paint: {
            'fill-extrusion-color': BUILDING_3D_COLOR,
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'],
                BUILDING_3D_MIN_ZOOM, 0,
                BUILDING_3D_MIN_ZOOM + 1, height,
            ],
            'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'],
                BUILDING_3D_MIN_ZOOM, 0,
                BUILDING_3D_MIN_ZOOM + 1, base,
            ],
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true,
        },
    };
}

/**
 * Lägg 3D-husen i stilen: samma källa som stilens eget platta `building`-
 * lager, och FÖRE första symbol-lagret så vägar och ytor ligger på marken
 * under husen medan ortsnamn, skyltar och allt V2Map lägger till ritas
 * ovanpå. Returnerar false (och rör inget) om stilen saknar ett
 * byggnadslager att hämta källan ur eller redan har lagret.
 */
export function addBuilding3dLayer(style: TiltStyle): boolean {
    if (!style.layers) return false;
    if (style.layers.some(l => l.id === BUILDING_3D_LAYER_ID)) return false;
    const flat = style.layers.find(l => l['source-layer'] === 'buildings' && typeof l.source === 'string');
    if (!flat) return false;
    const layer = building3dLayer(flat.source as string);
    const firstSymbol = style.layers.findIndex(l => l.type === 'symbol');
    style.layers.splice(firstSymbol >= 0 ? firstSymbol : style.layers.length, 0, layer);
    return true;
}
