/**
 * Marktäcket i nöjesfältsstilen när kartan är utzoomad (#203): skogen har
 * landets gröna, öppen mark och fält ljusare toner ur samma palett. Ren modul -
 * bara MapLibre-TYPER, inga webbläsar- eller kart-API:er, så insättningen i
 * stilen går att testa. Anropas av
 * components/v2/v2MapBaseStyles (fetchAndTransformThemeParkStyle).
 */
import type * as maplibregl from 'maplibre-gl';
import { deepTileTemplate } from './deepTiles';

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

// ── Djupare kakel i Sverige-vyn (#211) ───────────────────────────────────────
// Josef 13/11: "gärna mer av skogsområde och sjöar så långt utzoomat som det
// kan finnas med." Under zoom DEEP_MAX_ZOOM ritas vattnet och det grova
// marktäcket ur en andra källa som ger kaklen ETT ZOOMSTEG DJUPARE (utils/
// deepTiles: fyra barnkakel hopslagna till ett). Fler sjöar och skarpare kanter
// mellan skog, åker och öppen mark. Från zoom 6 har baskartans egna kakel samma
// data som den djupa källan visade strax under 6, så övergången syns inte - och
// den djupa källan används inte alls därifrån (inga hämtningar inzoomat).
// Baskartans eget vatten ligger kvar under, så sjöarna finns även om ett djupt
// kakel dröjer.
export const DEEP_SOURCE_ID = 'vadkul-far-deep';
export const DEEP_MAX_ZOOM = 6;
export const DEEP_WATER_LAYER_ID = 'water-far-deep';
export const DEEP_COARSE_LAYER_ID = 'landcover-far-coarse-deep';

// ── Skogens konturer längre ut (#211) ────────────────────────────────────────
// Josef 13/11 kväll: "eller ännu viktigare hade varit ifall det som är
// skogsområde. alltså de konturerna om de fortfarande sågs längre utzoomat."
// Konturerna han menar är Voyagers grönska (OSM-skogen i 'landuse'), som stilen
// tänder först vid zoom 7. Samma ytor ritas nu även under 7: ur baskartans
// kakel mellan DEEP_MAX_ZOOM och 7, och ur de djupare kaklen under det. Färgen
// är Voyager-lagrets EGEN (grönskans ton, ett snäpp djupare än landet), så
// inget byter färg vid zoom 7. Längst ut är skogen lite genomskinlig
// (FOREST_FAR_OPACITY), så Sverige-vyn inte blir en mörk matta: första
// versionen av #203 med heltäckande mörkgrön skog var "för mörkgrön".
// ERSÄTTER "skog ritas inte" från #203.
export const FOREST_LAYER_ID = 'forest-far';
export const FOREST_DEEP_LAYER_ID = 'forest-far-deep';
export const FOREST_FAR_OPACITY = 0.65;
const FOREST_FAR_OPACITY_ZOOM = 5;
// Voyagers eget grönskelager - färgen och startzoomen läses därifrån.
const VOYAGER_GREENERY_LAYER_ID = 'landcover';

export const COARSE_LAYER_ID = 'landcover-far-coarse';
export const DETAIL_LAYER_ID = 'landcover-far-detail';

// ── Färgerna: nöjesfältets egna gröna (Josef 13/11) ──────────────────────────
// Första versionen hade egna toner (skog mörkgrön #3d7a2a, åker gulgrön
// #b3c76a). Josef samma kväll: "för mörkgrön färg, och inte den ljusgulgröna på
// åkrarna", "det ska inte vara mörkare karta än innan" och "nyanserna eller den
// färg shemat vi hade innan på kartan. men alltså att detlajer ska synas längre
// utzoomat som nu."
// Därför bara toner som nöjesfältet redan hade (kopior ur v2MapBaseStyles,
// låsta av testet), och inget som är mörkare än landet:
//   - SKOG RITAS INTE. Den har landets egen gröna (#5b9b3b utzoomat) precis som
//     förut, och från zoom 7 Voyagers grönska precis som förut.
//   - öppen mark (gräs, hed, kalfjäll, sly): grönskans ljusa ton
//   - åker och äng: landets ljusa ton
//   - tätort, hällar och glaciär: bostadsytornas ton
// Alla tre är ljusare än landet utzoomat, så kartan blir aldrig mörkare än före
// #203. Det enda nya är att skog och öppen mark skiljs åt redan i Sverige-vyn.
export const LANDCOVER_COLORS = {
    oppenMark: '#7eb152', // = THEMEPARK_GREENERY_NEAR
    falt: '#93c46c', //      = THEMEPARK_LAND_COLOR_NEAR
    ljus: '#abcf84', //      = landuse_residential
} as const;
type Ton = keyof typeof LANDCOVER_COLORS;

// ── Åkrarna i Sverige-vyn: grönare (#211) ────────────────────────────────────
// Josef 13/11, om Sverige-vyn: "gör inte skåne så ljust. ha en grönare nyans."
// Åkermarken (Skåne, Västgötaslätten, Mälardalen) låg i landets LJUSA ton mot
// det mörka utzoomade landet och blev en blek fläck. Utzoomat får fälten därför
// en egen, grönare ton: fortfarande ljusare än landet (regeln från #203 står
// kvar - inget mörkare än landet) men mörkare och mättare än den ljusa tonen.
// Detaljlagret tonar sedan från den till den ljusa tonen i takt med att landet
// självt ljusnar inzoomat, så inget hoppar i korstoningen vid zoom 7.
// Det här är den ENDA tonen utanför nöjesfältets gamla palett.
export const LANDCOVER_FALT_FJARRAN = '#70ac48';

// Ritordning: fälten ovanpå den öppna marken, så en åker som överlappar en
// gräsyta alltid syns.
const ORDNING: Ton[] = ['oppenMark', 'falt', 'ljus'];

// Skog i kakeldatan. Marktäckeslagren ritar den INTE (landets gröna under är
// skogens färg där) - skogens konturer har egna lager, se FOREST_LAYER_ID.
export const FOREST_KINDS = ['forest', 'wood'] as const;

// kind -> ton per source-layer. Okända kinds och skog ritas inte (landets
// grundton syns).
export const COARSE_KINDS: Record<string, Ton> = {
    scrub: 'oppenMark',
    grassland: 'oppenMark',
    barren: 'ljus',
    farmland: 'falt',
    urban_area: 'ljus',
    glacier: 'ljus',
};
export const DETAIL_KINDS: Record<string, Ton> = {
    scrub: 'oppenMark',
    grassland: 'oppenMark',
    heath: 'oppenMark',
    bare_rock: 'ljus',
    farmland: 'falt',
    meadow: 'falt',
    glacier: 'ljus',
};

// match-uttrycken byggs ur tabellerna ovan. Typen kräver minst en gren på fast
// position, vilket en spridd lista inte kan visa - därav vägen via unknown.
// Formen valideras mot MapLibres stilspec i testet.
// `fjarran`: fälten i Sverige-vyns grönare ton (#211).
function farg(kinds: Record<string, Ton>, fjarran: boolean): maplibregl.ExpressionSpecification {
    const grenar = Object.entries(kinds).flatMap(([kind, ton]) =>
        [kind, fjarran && ton === 'falt' ? LANDCOVER_FALT_FJARRAN : LANDCOVER_COLORS[ton]]);
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
            'fill-color': farg(COARSE_KINDS, true),
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
            // Fälten börjar i Sverige-vyns grönare ton och ljusnar med landet.
            'fill-color': [
                'interpolate', ['linear'], ['zoom'],
                CROSSFADE_TO, farg(DETAIL_KINDS, true),
                LANDCOVER_MAX_ZOOM, farg(DETAIL_KINDS, false),
            ],
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
    const deep = addDeepSource(style, source);
    const forest = forestLayers(style, source, deep);
    if (!deep) {
        style.layers.splice(at, 0, ...forest, coarse, detail);
        return;
    }
    // Sverige-vyn tar marktäcket ur de djupare kaklen, baskartans egna tar vid
    // från DEEP_MAX_ZOOM (samma data, se ovan).
    const deepCoarse: maplibregl.FillLayerSpecification = {
        ...coarse,
        id: DEEP_COARSE_LAYER_ID,
        source: DEEP_SOURCE_ID,
        maxzoom: DEEP_MAX_ZOOM,
        paint: { 'fill-color': farg(COARSE_KINDS, true) },
    };
    coarse.minzoom = DEEP_MAX_ZOOM;
    // Skogen underst: fält och öppen mark ritas ovanpå.
    style.layers.splice(at, 0, ...forest, deepCoarse, coarse, detail);

    // De djupare sjöarna direkt ovanpå baskartans vatten, i samma färg.
    const waterAt = style.layers.findIndex(l => l.id === 'water');
    const water = (waterAt >= 0 ? style.layers[waterAt] : undefined) as maplibregl.FillLayerSpecification | undefined;
    if (!water || water.type !== 'fill') return;
    const waterColor = water.paint?.['fill-color'];
    const deepWater: maplibregl.FillLayerSpecification = {
        id: DEEP_WATER_LAYER_ID,
        type: 'fill',
        source: DEEP_SOURCE_ID,
        'source-layer': 'water',
        maxzoom: DEEP_MAX_ZOOM,
        paint: waterColor === undefined ? {} : { 'fill-color': waterColor },
    };
    style.layers.splice(waterAt + 1, 0, deepWater);
}

// Skogens konturer under den zoom där Voyagers eget grönskelager tänds.
// Hoppas över om stilen saknar lagret, dess färg eller dess startzoom - då
// finns inget att förlänga.
function forestLayers(
    style: maplibregl.StyleSpecification, source: string, deep: boolean,
): maplibregl.FillLayerSpecification[] {
    const voyager = style.layers.find(l => l.id === VOYAGER_GREENERY_LAYER_ID);
    if (!voyager || voyager.type !== 'fill' || voyager.minzoom === undefined) return [];
    const color = voyager.paint?.['fill-color'];
    if (color === undefined) return [];
    const until = voyager.minzoom;
    const layer = (id: string, from: string, zoom: { minzoom?: number; maxzoom: number }): maplibregl.FillLayerSpecification => ({
        id,
        type: 'fill',
        source: from,
        'source-layer': 'landuse',
        ...zoom,
        filter: ['in', ['get', 'kind'], ['literal', [...FOREST_KINDS]]],
        paint: {
            'fill-color': color,
            'fill-opacity': [
                'interpolate', ['linear'], ['zoom'],
                FOREST_FAR_OPACITY_ZOOM, FOREST_FAR_OPACITY,
                until, 1,
            ],
        },
    });
    if (!deep || until <= DEEP_MAX_ZOOM) return [layer(FOREST_LAYER_ID, source, { maxzoom: until })];
    return [
        layer(FOREST_DEEP_LAYER_ID, DEEP_SOURCE_ID, { maxzoom: DEEP_MAX_ZOOM }),
        layer(FOREST_LAYER_ID, source, { minzoom: DEEP_MAX_ZOOM, maxzoom: until }),
    ];
}

// Den djupa källan: baskartans egen kakelmall bakom vårt protokoll. Kräver att
// källan anger sina kakel direkt (`tiles`) - annars (TileJSON-url) hoppas den
// djupa källan över och Sverige-vyn ritas ur baskartans kakel som förut.
function addDeepSource(style: maplibregl.StyleSpecification, baseId: string): boolean {
    const base = style.sources[baseId];
    if (base?.type !== 'vector' || !base.tiles?.length) return false;
    style.sources[DEEP_SOURCE_ID] = {
        type: 'vector',
        tiles: base.tiles.map(deepTileTemplate),
        minzoom: 0,
        // Kakel z ger barnen på z+1: vid kartzoom 5-6 alltså z6-data.
        maxzoom: DEEP_MAX_ZOOM - 1,
    };
    return true;
}
