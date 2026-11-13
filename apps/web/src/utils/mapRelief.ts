/**
 * Reliefen i nöjesfältsstilen (#197): höjdfärger och skuggning när kartan är
 * utzoomad. Ren modul - bara MapLibre-TYPER, inga webbläsar- eller kart-API:er,
 * så insättningen i stilen går att testa. Anropas av
 * components/v2/v2MapBaseStyles (fetchAndTransformThemeParkStyle).
 */
import type * as maplibregl from 'maplibre-gl';

// ── Reliefen utzoomat (#197) ─────────────────────────────────────────────────
// Josef 13/11: "kan man få med mer av de detaljerna på höjdfärgerna/shade när
// man är mer utzoomad. så det ändå ser mer kuperat och detaljerat ut." Utan den
// är landet EN grön ton i Sverige-vyn. Två lager ur samma höjddata (samma
// nyckelfria terrarium-kakor som 3D-terrängen, men en egen källa - 3D-lägets
// källa tas bort när läget stängs av, och då får inga lager hänga på den):
//   - höjdfärger (color-relief): låglandet orört, kullar olivgröna, fjällen
//     brunaktiga och topparna ljusa
//   - skuggning (hillshade): ljus från nordväst, skuggan i landets mörka grönt
// Båda ligger under vatten, vägar och etiketter, är tydligast i Sverige-vyn och
// tonar ut mot stadsvyn. Lagren slutar vid RELIEF_MAX_ZOOM (= molnens gräns,
// CLOUD_GONE_ZOOM) så stadslandningen (~10,5) och stadssidornas kartor (11) ser
// ut precis som förut och inte hämtar ett enda höjdkakel.
export const RELIEF_DEM_ID = 'relief-dem';
export const RELIEF_MAX_ZOOM = 10;
// Höjdkaklens högsta zoom. Kaklen är 256 px, så kartzoom z hämtar kakel på
// z+1: Sverige-vyn (zoom 5-6) får full detalj ur z6-z7. Mellan 7 och 10, där
// reliefen tonar ut, förstoras z7-kaklen i stället för att nya hämtas - en
// utzoomning Stockholm -> Sverige gick från 83 till ungefär en tredjedel så
// många kakel (13/11, besökarnas mobildata).
export const RELIEF_DEM_MAX_ZOOM = 7;
const RELIEF_DEM_SOURCE: maplibregl.RasterDEMSourceSpecification = {
    type: 'raster-dem',
    tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: RELIEF_DEM_MAX_ZOOM,
    attribution: 'Elevation: Mapzen / AWS Terrain Tiles',
};

export function addZoomedOutRelief(style: maplibregl.StyleSpecification) {
    if (!style.layers || !style.sources) return;
    if (style.sources[RELIEF_DEM_ID]) return;
    style.sources[RELIEF_DEM_ID] = RELIEF_DEM_SOURCE;
    const colors: maplibregl.ColorReliefLayerSpecification = {
        id: 'relief-colors',
        type: 'color-relief',
        source: RELIEF_DEM_ID,
        maxzoom: RELIEF_MAX_ZOOM,
        paint: {
            'color-relief-color': [
                'interpolate', ['linear'], ['elevation'],
                0, 'rgba(91,155,59,0)',
                120, 'rgba(91,155,59,0)',
                300, 'rgba(126,150,62,0.35)',
                600, 'rgba(150,146,80,0.55)',
                900, 'rgba(158,132,96,0.7)',
                1300, 'rgba(196,184,166,0.85)',
                1800, 'rgba(238,238,232,0.95)',
            ],
            'color-relief-opacity': [
                'interpolate', ['linear'], ['zoom'],
                5, 0.9,
                8, 0.65,
                9.5, 0.2,
                RELIEF_MAX_ZOOM, 0,
            ],
        },
    };
    const shade: maplibregl.HillshadeLayerSpecification = {
        id: 'relief-shade',
        type: 'hillshade',
        source: RELIEF_DEM_ID,
        maxzoom: RELIEF_MAX_ZOOM,
        paint: {
            'hillshade-illumination-direction': 315,
            'hillshade-exaggeration': [
                'interpolate', ['linear'], ['zoom'],
                4, 0.6,
                8, 0.45,
                9.5, 0.15,
                RELIEF_MAX_ZOOM, 0,
            ],
            'hillshade-shadow-color': 'rgba(24,52,18,0.6)',
            'hillshade-highlight-color': 'rgba(255,255,236,0.28)',
            'hillshade-accent-color': 'rgba(30,58,22,0.35)',
        },
    };
    // Direkt under vattnet: över landets grönska (så skuggan faller på skogen
    // också), under vatten, vägar, byggnader och etiketter.
    const firstWater = style.layers.findIndex(l =>
        l.id === 'water' || l.id === 'waterway' || l.id === 'water_shadow'
        || ('source-layer' in l && (l['source-layer'] === 'water' || l['source-layer'] === 'waterway')));
    const at = firstWater >= 0 ? firstWater : Math.min(1, style.layers.length);
    style.layers.splice(at, 0, colors, shade);
}
