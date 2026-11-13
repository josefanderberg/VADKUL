/**
 * Marktäcket i nöjesfältsstilen när kartan är utzoomad (#203): skogen har
 * landets gröna, öppen mark och fält ljusare toner ur samma palett. Ren modul -
 * bara MapLibre-TYPER, inga webbläsar- eller kart-API:er, så insättningen i
 * stilen går att testa. Anropas av
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

// Skog i kakeldatan. Står här bara för att testet ska kunna låsa att den INTE
// ritas - landets gröna under är skogens färg.
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
    style.layers.splice(at, 0, coarse, detail);
}
