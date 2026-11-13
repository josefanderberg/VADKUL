/**
 * Marktäcket i nöjesfältsstilen när kartan är utzoomad (#203): skog mörk grön,
 * öppna fält ljusa. Ren modul - bara MapLibre-TYPER, inga webbläsar- eller
 * kart-API:er, så insättningen i stilen går att testa. Anropas av
 * components/v2/v2MapBaseStyles (fetchAndTransformThemeParkStyle).
 */
import type * as maplibregl from 'maplibre-gl';

// ── Skog och öppna fält utzoomat (#203) ──────────────────────────────────────
// Josef 13/11: "alltså när man är mycket utzoomad. det är inte bergen man ska
// se. utan det är vad som är skogsområde och öppna fält som ska vara synligt
// mer utzoomad." Ersätter reliefen från #197 (höjdfärger + skuggning ur
// terrarium-kakel), som läste önskemålet som höjd. Inga höjdkakel hämtas längre:
// allt ritas ur baskartans egna vektorkakel, som redan laddas.
//
// Två lager ur samma källa som resten av kartan (CARTO:s protomaps-kakel):
//   - GROVT (source-layer 'landcover', finns bara t.o.m. kakelzoom 7):
//     sammanslaget marktäcke för hela landet. Sverige-vyn (zoom 5) mätt 13/11:
//     skog 68 %, gräsmark/kalfjäll 19 %, åker 16 %. Voyager ritar aldrig lagret.
//   - DETALJ (source-layer 'landuse', OSM-ytor): glest på zoom 5-6 (åker 1-2 %)
//     men fullt från zoom 7 (Västergötland: skog 54 %, åker 8 %). Voyagers eget
//     grönskelager tar skog/gräs därifrån men aldrig åker.
// Grovt till zoom 7, korstoning till detalj 7-7,75 (båda finns i z7-kaklen, så
// åkrarna går från block till verkliga fält utan hopp), sedan uttonat till
// LANDCOVER_MAX_ZOOM. Stadslandningen (~10,5) och stadssidornas kartor (11)
// ser därför ut precis som förut.
export const LANDCOVER_MAX_ZOOM = 10;
// z8-kaklen saknar 'landcover'-lagret - lagret slutar där kaklen slutar.
export const LANDCOVER_COARSE_MAX_ZOOM = 8;
const CROSSFADE_FROM = 7;
const CROSSFADE_TO = 7.75;
const FADE_OUT_FROM = 8.5;

export const COARSE_LAYER_ID = 'landcover-far-coarse';
export const DETAIL_LAYER_ID = 'landcover-far-detail';

// Tonerna sitter i nöjesfältets gröna palett: skogen ett snäpp under landets
// utzoomade grön (#5b9b3b), fälten en ljus gulgrön, kalfjället ljust grönt -
// öppen mark, inte bruna berg.
export const LANDCOVER_COLORS = {
    skog: '#3d7a2a',
    sly: '#6f9f48',
    oppenMark: '#8db560',
    hall: '#b5bf98',
    falt: '#b3c76a',
    tatort: '#abcf84', // = landuse_residential i nöjesfältet
    glaciar: '#eef3ec',
} as const;
type Ton = keyof typeof LANDCOVER_COLORS;

// Ritordning: skogen underst, fälten ovanpå, så en åker som överlappar ett
// skogsblock alltid syns.
const ORDNING: Ton[] = ['skog', 'sly', 'oppenMark', 'hall', 'falt', 'tatort', 'glaciar'];

// kind -> ton per source-layer. Okända kinds ritas inte (landets grundton syns).
export const COARSE_KINDS: Record<string, Ton> = {
    forest: 'skog',
    scrub: 'sly',
    grassland: 'oppenMark',
    barren: 'hall',
    farmland: 'falt',
    urban_area: 'tatort',
    glacier: 'glaciar',
};
export const DETAIL_KINDS: Record<string, Ton> = {
    forest: 'skog',
    wood: 'skog',
    scrub: 'sly',
    grassland: 'oppenMark',
    heath: 'oppenMark',
    bare_rock: 'hall',
    farmland: 'falt',
    meadow: 'falt',
    glacier: 'glaciar',
};

// match-uttrycken byggs ur tabellerna ovan. Typen kräver minst en gren på fast
// position, vilket en spridd lista inte kan visa - därav vägen via unknown.
// Formen valideras mot MapLibres stilspec i testet.
function farg(kinds: Record<string, Ton>): maplibregl.ExpressionSpecification {
    const grenar = Object.entries(kinds).flatMap(([kind, ton]) => [kind, LANDCOVER_COLORS[ton]]);
    return ['match', ['get', 'kind'], ...grenar, 'rgba(0,0,0,0)'] as unknown as maplibregl.ExpressionSpecification;
}
function sortering(kinds: Record<string, Ton>): maplibregl.ExpressionSpecification {
    const grenar = Object.entries(kinds).flatMap(([kind, ton]) => [kind, ORDNING.indexOf(ton)]);
    return ['match', ['get', 'kind'], ...grenar, 0] as unknown as maplibregl.ExpressionSpecification;
}
function filter(kinds: Record<string, Ton>): maplibregl.FilterSpecification {
    return ['in', ['get', 'kind'], ['literal', Object.keys(kinds)]];
}

// Baskartans vektorkälla: den som vattnet eller landuse ritas ur. Voyager har
// bytt namn på den förut ("carto" -> "protomaps"), så namnet hårdkodas inte.
function baseVectorSource(style: maplibregl.StyleSpecification): string | undefined {
    const lager = style.layers.find(l =>
        'source-layer' in l && (l['source-layer'] === 'landuse' || l['source-layer'] === 'water'));
    if (!lager || !('source' in lager) || typeof lager.source !== 'string') return undefined;
    return style.sources[lager.source]?.type === 'vector' ? lager.source : undefined;
}

export function addZoomedOutLandcover(style: maplibregl.StyleSpecification) {
    if (!style.layers || !style.sources) return;
    if (style.layers.some(l => l.id === COARSE_LAYER_ID || l.id === DETAIL_LAYER_ID)) return;
    const source = baseVectorSource(style);
    if (!source) return;

    const coarse: maplibregl.FillLayerSpecification = {
        id: COARSE_LAYER_ID,
        type: 'fill',
        source,
        'source-layer': 'landcover',
        maxzoom: LANDCOVER_COARSE_MAX_ZOOM,
        filter: filter(COARSE_KINDS),
        layout: { 'fill-sort-key': sortering(COARSE_KINDS) },
        paint: {
            'fill-color': farg(COARSE_KINDS),
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                CROSSFADE_FROM, 1,
                CROSSFADE_TO, 0,
            ],
        },
    };
    const detail: maplibregl.FillLayerSpecification = {
        id: DETAIL_LAYER_ID,
        type: 'fill',
        source,
        'source-layer': 'landuse',
        minzoom: CROSSFADE_FROM,
        maxzoom: LANDCOVER_MAX_ZOOM,
        filter: filter(DETAIL_KINDS),
        layout: { 'fill-sort-key': sortering(DETAIL_KINDS) },
        paint: {
            'fill-color': farg(DETAIL_KINDS),
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                CROSSFADE_FROM, 0,
                CROSSFADE_TO, 1,
                FADE_OUT_FROM, 1,
                LANDCOVER_MAX_ZOOM, 0,
            ],
        },
    };
    // Direkt under vattnet: över Voyagers grönska och bostadsytor (som annars
    // skulle rita sina egna toner ovanpå), under vatten, vägar och etiketter.
    const firstWater = style.layers.findIndex(l =>
        l.id === 'water' || l.id === 'waterway' || l.id === 'water_shadow'
        || ('source-layer' in l && (l['source-layer'] === 'water' || l['source-layer'] === 'waterway')));
    const at = firstWater >= 0 ? firstWater : Math.min(1, style.layers.length);
    style.layers.splice(at, 0, coarse, detail);
}
