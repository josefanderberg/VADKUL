// ── Baskartstilar + kart-lägen (projektion/terräng/relief) ──────────────────
// Allt här är rena, kartinstans-oberoende byggstenar: stil-URL:er, statiska
// stil-specar och idempotenta på/av-hjälpare som V2Map kallar vid stilbyten.
// Ingen React, inget komponent-state — bara MapLibre-konfiguration.

import maplibregl from 'maplibre-gl';

// Två basstilar: standard vektor-karta (Voyager) och en raster-satellitvy
// (ESRI World Imagery). Vi växlar via map.setStyle(); markörer behålls eftersom
// de är DOM-element i container, inte en del av style-spec:en.
export const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
// Mörkt kartläge (CARTO Dark Matter) — direkt stil-URL, ingen transform behövs.
export const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const SATELLITE_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    // Glyf-endpoint (Cartos, samma som Voyager/Dark-stilarna) så multi-event-
    // prickarnas siffer-text kan renderas i GL även på den annars ren-raster
    // satellitstilen. Skulle endpointen blockeras (t.ex. corp-proxy) ritas pricken
    // ändå — bara siffran uteblir, ingen krasch.
    glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
    sources: {
        satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        },
        // Transparent etikett-overlay med ort- och landsnamn ovanpå satellit-bilden,
        // så man fortfarande ser var man är även när basbilden är fotorealistisk.
        labels: {
            type: 'raster',
            tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Labels &copy; Esri'
        }
    },
    layers: [
        { id: 'satellite', type: 'raster', source: 'satellite' },
        { id: 'labels', type: 'raster', source: 'labels' }
    ]
};

// Nöjesfältets land-färger. Utzoomat (nationell vy) är landet EN mörk grön ton;
// inzoomat, när grönska-lagren syns och landet får två gröna skalor, tonar
// bakgrunden till den ursprungliga ljusa paletten. THEMEPARK_LAND_COLOR (den
// mörka) delas av bootstrap-stilen och container-bakgrunden i V2Map — de ska
// matcha det UTZOOMADE läget eftersom kartan startar på zoom 5.
export const THEMEPARK_LAND_COLOR = '#5b9b3b';
const THEMEPARK_LAND_COLOR_NEAR = '#93c46c';
// Grönskan tonar i samma zoomintervall så den alltid ligger ett snäpp djupare
// än landet — annars inverteras hierarkin halvvägs i tonövergången.
const THEMEPARK_GREENERY_FAR = '#47822c';
const THEMEPARK_GREENERY_NEAR = '#7eb152';
// Zoomintervallet där land tonar mörk→ljus (nationell vy → stadsnivå).
const LAND_ZOOM_FAR = 6;
const LAND_ZOOM_NEAR = 10;

// Bootstrap-stil vid mount: kartan behöver en SYNKRON startstil för att rendera
// direkt, men förvald 'themepark' hämtas async (fetch + transform) → annars syns
// en startbild under tiden. Tidigare användes satellitstilen, men då blixtrade en
// satellitvy förbi innan nöjesfält laddat. Här är i stället bara en enfärgad
// bakgrund i nöjesfältets land-färg (samma som themeparkens 'background').
// Ingen nätverkshämtning → renderar omedelbart, och eftersom färgen matchar den
// kommande kartan blir bytet sömlöst (vägar/vatten/etiketter tonar bara in).
export const BOOTSTRAP_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
        { id: 'background', type: 'background', paint: { 'background-color': THEMEPARK_LAND_COLOR } }
    ]
};

// "Nöjesfälts"-kartan: hämta Voyager-stilen och måla om den i en mild, naturlig
// palett (grönt land, blått vatten, dämpade byggnader/vägar) så den fungerar som
// en lugn bakgrund i stället för en gäll tivoli-look. Hämtas + transformeras en
// gång och cachas sedan i V2Maps themeParkStyleRef.
export async function fetchAndTransformThemeParkStyle(): Promise<maplibregl.StyleSpecification> {
    const res = await fetch(STREETS_STYLE_URL);
    const style = await res.json() as maplibregl.StyleSpecification;

    if (style.layers) {
        style.layers = style.layers.map(layer => {
            // Hav-/ocean-namn (Östersjön m.fl.) ligger som ETT label-lager per
            // angränsande land i källdatan → samma hav etiketteras på ~10 språk
            // (Östersjön / Itämeri / Ostsee / Østersøen …). Onödigt brus på en
            // Sverige-karta, så hav/ocean-namnen göms. Insjönamn (Vänern/Vättern,
            // eget watername_lake-lager) berörs INTE.
            if (layer.id === 'watername_ocean' || layer.id === 'watername_sea') {
                const baseLayout = ('layout' in layer && layer.layout) ? layer.layout : {};
                return { ...layer, layout: { ...baseLayout, visibility: 'none' as const } } as typeof layer;
            }
            if (!('paint' in layer) || !layer.paint) return layer;
            // Paint-spec:en är en strikt union per lagertyp men vi sätter
            // nycklarna dynamiskt utifrån lager-id — jobba mot en löst typad
            // kopia och casta tillbaka vid retur.
            const paint: Record<string, unknown> = { ...layer.paint };
            const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;

            // Palett: djupare naturliga toner — som satellitkartan fast
            // minimalistisk. Mörkare grönt land/grönska, mörkare blått vatten,
            // vita vägar som kontrast.
            // Land / Background — zoom-tonad: mörk enhetsgrön utzoomat, original-
            // ljus inzoomat när grönskan ger landet två gröna skalor.
            if (layer.id === 'background') {
                paint['background-color'] = [
                    'interpolate', ['linear'], ['zoom'],
                    LAND_ZOOM_FAR, THEMEPARK_LAND_COLOR,
                    LAND_ZOOM_NEAR, THEMEPARK_LAND_COLOR_NEAR
                ];
            }
            // Water
            else if (layer.id === 'water' || layer.id === 'water_shadow') {
                paint['fill-color'] = layer.id === 'water_shadow'
                    ? '#4278a4'
                    : '#4e8ab7'; // havsblått — mellanting mellan mellanblått och djupblått
            }
            else if (layer.id === 'waterway') {
                paint['line-color'] = '#4e8ab7';
            }
            // Parker, skog, naturreservat, grön landuse
            else if (
                layer.id === 'landcover' ||
                layer.id.includes('park') ||
                layer.id.includes('forest') ||
                layer.id === 'landuse'
            ) {
                if (paint['fill-color']) {
                    // Grönska, ett snäpp djupare än landet — följer landets zoom-ton.
                    paint['fill-color'] = [
                        'interpolate', ['linear'], ['zoom'],
                        LAND_ZOOM_FAR, THEMEPARK_GREENERY_FAR,
                        LAND_ZOOM_NEAR, THEMEPARK_GREENERY_NEAR
                    ];
                }
            }
            // Bostadsområden
            else if (layer.id === 'landuse_residential') {
                paint['fill-color'] = '#abcf84'; // något ljusare än landet, fortfarande grönt
            }
            // Byggnader
            else if (layer.id.includes('building')) {
                if (paint['fill-color']) {
                    paint['fill-color'] = '#d6d2c0'; // dämpad beige-grå
                }
            }
            // Vägar / transportation. Casing-lagren (kantlinjen runt vägbanan)
            // får en mjuk sandton så väghierarkin syns mot det vita.
            else if (sourceLayer === 'transportation') {
                if (paint['line-color']) {
                    paint['line-color'] = layer.id.includes('casing')
                        ? '#c9c3b2'
                        : '#ffffff'; // rena vita vägar
                }
            }

            return { ...layer, paint } as typeof layer;
        });
    }

    return style;
}

// Höjddata för 3D-terrängen. Keyless terrarium-kakor (samma anda som övriga
// källor — ingen API-nyckel). Den läggs BARA till när terräng-läget slås på och
// tas bort igen när det stängs av, så DEM-tiles inte ligger och tar minne i onödan.
// Tile-cachen (maxTileCacheSize på kartan) gäller även den här källan.
const TERRAIN_DEM_ID = 'terrain-dem';
const TERRAIN_DEM_SOURCE: maplibregl.RasterDEMSourceSpecification = {
    type: 'raster-dem',
    tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 13,
    attribution: 'Elevation: Mapzen / AWS Terrain Tiles'
};
const TERRAIN_EXAGGERATION = 1.4;

// Skifta klot-projektionen på/av. Nästan gratis — samma tiles, annan projektion.
export function applyProjection(map: maplibregl.Map, globe: boolean) {
    map.setProjection({ type: globe ? 'globe' : 'mercator' });
}

// Slå på/av 3D-terräng. DEM-källan läggs till lazy och tas bort när läget stängs
// av, så höjddatan inte ligger och äter minne när man kör platt.
export function applyTerrain(map: maplibregl.Map, on: boolean) {
    if (on) {
        if (!map.getSource(TERRAIN_DEM_ID)) map.addSource(TERRAIN_DEM_ID, TERRAIN_DEM_SOURCE);
        map.setTerrain({ source: TERRAIN_DEM_ID, exaggeration: TERRAIN_EXAGGERATION });
    } else {
        map.setTerrain(null);
        if (map.getSource(TERRAIN_DEM_ID)) map.removeSource(TERRAIN_DEM_ID);
    }
}

// "Orienterings"-kartan: ett platt hillshade-lager ovanpå den ljusa Voyager-
// basen som ritar ut höjdskillnaderna som skuggad relief — en topografisk
// "orienterings"-look. Använder samma keylessa DEM som 3D-terrängen, men under
// en EGEN käll-id så de två lägena inte tar bort varandras källa. Lager + källa
// läggs till lazy och tas bort när läget stängs av.
const HILLSHADE_DEM_ID = 'hillshade-dem';
const HILLSHADE_LAYER_ID = 'hillshade-relief';
export function applyHillshade(map: maplibregl.Map, on: boolean) {
    if (on) {
        if (!map.getSource(HILLSHADE_DEM_ID)) map.addSource(HILLSHADE_DEM_ID, TERRAIN_DEM_SOURCE);
        if (!map.getLayer(HILLSHADE_LAYER_ID)) {
            map.addLayer({
                id: HILLSHADE_LAYER_ID,
                type: 'hillshade',
                source: HILLSHADE_DEM_ID,
                paint: {
                    'hillshade-exaggeration': 0.65,
                    'hillshade-shadow-color': '#5b4636',
                    'hillshade-highlight-color': '#fffdf7',
                    'hillshade-accent-color': '#8a6d4a',
                    'hillshade-illumination-direction': 315
                }
            });
        }
    } else {
        if (map.getLayer(HILLSHADE_LAYER_ID)) map.removeLayer(HILLSHADE_LAYER_ID);
        if (map.getSource(HILLSHADE_DEM_ID)) map.removeSource(HILLSHADE_DEM_ID);
    }
}
