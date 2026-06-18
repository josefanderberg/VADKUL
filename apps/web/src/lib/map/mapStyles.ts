// ── Kartstilar & terräng/relief-lager ──────────────────────────────────────
// Basstilar (Voyager / satellit / mörkt / nöjesfält) samt de lager som slås
// på/av ovanpå basen: 3D-terräng, hillshade-relief, höjd-"zebra" och höjdkurvor.
// Allt utflyttat ur V2Map så komponenten bara anropar apply*-funktionerna.
import maplibregl from 'maplibre-gl';
import mlContour from 'maplibre-contour';
import { parseHex } from './brickaImage';

// Två basstilar: standard vektor-karta (Voyager) och en raster-satellitvy
// (ESRI World Imagery). Vi växlar via map.setStyle(); markörer behålls eftersom
// de är DOM-element i container, inte en del av style-spec:en.
export const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
// Mörkt kartläge (CARTO Dark Matter) — direkt stil-URL, ingen transform behövs.
export const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
export const SATELLITE_STYLE: maplibregl.StyleSpecification = {
    version: 8,
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

// "Nöjesfälts"-kartan: hämta Voyager-stilen och måla om den i en mild, naturlig
// palett (grönt land, blått vatten, dämpade byggnader/vägar) så den fungerar som
// en lugn bakgrund i stället för en gäll tivoli-look. Hämtas + transformeras en
// gång och cachas sedan i komponentens themeParkStyleRef.
export async function fetchAndTransformThemeParkStyle(): Promise<maplibregl.StyleSpecification> {
    const res = await fetch(STREETS_STYLE_URL);
    const style = await res.json() as maplibregl.StyleSpecification;

    if (style.layers) {
        style.layers = style.layers.map(layer => {
            if (!('paint' in layer) || !layer.paint) return layer;
            // Paint-spec:en är en strikt union per lagertyp men vi sätter
            // nycklarna dynamiskt utifrån lager-id — jobba mot en löst typad
            // kopia och casta tillbaka vid retur.
            const paint: Record<string, unknown> = { ...layer.paint };
            const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;

            // Palett: djupare naturliga toner — som satellitkartan fast
            // minimalistisk. Mörkare grönt land/grönska, mörkare blått vatten,
            // vita vägar som kontrast.
            // Land / Background
            if (layer.id === 'background') {
                paint['background-color'] = '#b9d49c'; // djupare grönt land
            }
            // Water
            else if (layer.id === 'water' || layer.id === 'water_shadow') {
                paint['fill-color'] = layer.id === 'water_shadow'
                    ? '#6fa3c9'
                    : '#7fb0d4'; // mörkare, mättat blått vatten
            }
            else if (layer.id === 'waterway') {
                paint['line-color'] = '#7fb0d4';
            }
            // Parker, skog, naturreservat, grön landuse
            else if (
                layer.id === 'landcover' ||
                layer.id.includes('park') ||
                layer.id.includes('forest') ||
                layer.id === 'landuse'
            ) {
                if (paint['fill-color']) {
                    paint['fill-color'] = '#9cbf7f'; // grönska, ett snäpp djupare än landet
                }
            }
            // Bostadsområden
            else if (layer.id === 'landuse_residential') {
                paint['fill-color'] = '#c6d8ab'; // något ljusare än landet, fortfarande grönt
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

// "Zebra"-höjder: ett color-relief-lager som färgar terrängen i ALTERNERANDE
// ljusa/mörka band per höjdsteg (en hypsometrisk skala lågt grönt → högt vitt,
// där varannan rand är mörkare). Draperas på 3D-terrängen så man tydligt ser
// höjderna som randiga nivåkurvor. Egen DEM-källa (samma keylessa terrarium-
// kakor → webbläsarens cache delar tiles med terräng-källan). Lager + källa
// läggs till lazy och tas bort när läget stängs av.
const ZEBRA_DEM_ID = 'zebra-dem';
const ZEBRA_LAYER_ID = 'elevation-zebra';
// Bygger color-relief-rampen. color-relief-color tar ['elevation'] (meter) som
// indata. Hårda band fås via PAR av stopp (platt färg + 1 m övergång) i ett
// interpolate — color-ramp stödjer interpolate säkert (step gör den inte alltid).
function buildElevationZebraRamp(): unknown[] {
    const BAND = 60;     // meter per rand
    const MAXE = 1900;   // ~Sveriges högsta (Kebnekaise ~2100 m) — täcker nästan allt
    const anchors: [number, string][] = [
        [0, '#2e7d32'],    // dalgrönt
        [200, '#7cb342'],  // ljusgrön
        [450, '#cddc39'],  // lime
        [700, '#ffee58'],  // gul
        [1000, '#ffa726'], // orange
        [1400, '#8d6e63'], // brun
        [1900, '#fafafa'], // snö
    ];
    // Allt i [r,g,b]-arrayer (parseHex) och bara HEX ut — mixHex ger rgb()-strängar
    // som inte kan blandas vidare, så vi interpolerar/mörkar själva här.
    const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const hypso = (e: number): number[] => {
        if (e <= anchors[0][0]) return parseHex(anchors[0][1]);
        for (let i = 1; i < anchors.length; i++) {
            if (e <= anchors[i][0]) {
                const [e0, c0] = anchors[i - 1];
                const [e1, c1] = anchors[i];
                const t = (e - e0) / (e1 - e0);
                const a = parseHex(c0), b = parseHex(c1);
                return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
            }
        }
        return parseHex(anchors[anchors.length - 1][1]);
    };
    const ramp: unknown[] = ['interpolate', ['linear'], ['elevation']];
    ramp.push(-2000, '#1e5e8a'); // hav/under 0 m → blått
    for (let i = 0; i * BAND <= MAXE; i++) {
        const e = i * BAND;
        const rgb = hypso(e);
        const shaded = i % 2 === 0 ? rgb : rgb.map((v) => v * 0.68); // varannan rand mörkare → zebra
        const col = toHex(shaded);
        ramp.push(e, col);            // bandets början
        ramp.push(e + BAND - 1, col); // platt rand → 1 m hård kant mot nästa band
    }
    return ramp;
}
export function applyElevationZebra(map: maplibregl.Map, on: boolean) {
    // Allt i try/catch: color-relief är ett nyare lager + DEM-källan kan vara i ett
    // mellanläge — ett fel här får inte stoppa terräng-/hull-uppsättningen.
    try {
        if (on) {
            if (!map.getSource(ZEBRA_DEM_ID)) map.addSource(ZEBRA_DEM_ID, TERRAIN_DEM_SOURCE);
            if (!map.getLayer(ZEBRA_LAYER_ID)) {
                map.addLayer({
                    id: ZEBRA_LAYER_ID,
                    type: 'color-relief',
                    source: ZEBRA_DEM_ID,
                    paint: {
                        'color-relief-color': buildElevationZebraRamp(),
                        'color-relief-opacity': 0.55,
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
            }
        } else {
            if (map.getLayer(ZEBRA_LAYER_ID)) map.removeLayer(ZEBRA_LAYER_ID);
            if (map.getSource(ZEBRA_DEM_ID)) map.removeSource(ZEBRA_DEM_ID);
        }
    } catch { /* color-relief saknas/ej redo — hoppa över zebra-lagret */ }
}

// Höjdkurvor (contour lines) för orienterings-stilen — via maplibre-contour.
// DemSource skapas en gång per session och registrerar sitt protokoll globalt.
let _contourDemSource: InstanceType<typeof mlContour.DemSource> | null = null;
function getContourDemSource() {
    if (!_contourDemSource) {
        _contourDemSource = new mlContour.DemSource({
            url: 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',
            encoding: 'terrarium',
            maxzoom: 13,
            worker: true,
            cacheSize: 100,
            id: 'vadkul-contour',
        });
        _contourDemSource.setupMaplibre(maplibregl);
    }
    return _contourDemSource;
}
const CONTOUR_SRC_ID = 'contour-src';
const CONTOUR_MINOR_ID = 'contour-minor';
const CONTOUR_MAJOR_ID = 'contour-major';
export function applyContours(map: maplibregl.Map, on: boolean) {
    if (on) {
        const src = getContourDemSource();
        if (!map.getSource(CONTOUR_SRC_ID)) {
            map.addSource(CONTOUR_SRC_ID, {
                type: 'vector',
                tiles: [src.contourProtocolUrl({
                    thresholds: {
                        // zoom: [minor-interval-m, major-interval-m]
                        9:  [200, 1000],
                        11: [100, 500],
                        13: [20,  100],
                        14: [10,  50],
                        15: [5,   20],
                    },
                    elevationKey: 'ele',
                    levelKey: 'level',
                    contourLayer: 'contours',
                    buffer: 1,
                })],
                minzoom: 9,
                maxzoom: 16,
            });
        }
        if (!map.getLayer(CONTOUR_MINOR_ID)) {
            map.addLayer({
                id: CONTOUR_MINOR_ID,
                type: 'line',
                source: CONTOUR_SRC_ID,
                'source-layer': 'contours',
                filter: ['==', ['get', 'level'], 0],
                paint: {
                    'line-color': '#b05a1a',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 0.9, 16, 1.3],
                    'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.45, 14, 0.65, 16, 0.75],
                },
            });
        }
        if (!map.getLayer(CONTOUR_MAJOR_ID)) {
            map.addLayer({
                id: CONTOUR_MAJOR_ID,
                type: 'line',
                source: CONTOUR_SRC_ID,
                'source-layer': 'contours',
                filter: ['==', ['get', 'level'], 1],
                paint: {
                    'line-color': '#7a3800',
                    'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.1, 14, 1.8, 16, 2.6],
                    'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 14, 0.9, 16, 1.0],
                },
            });
        }
    } else {
        if (map.getLayer(CONTOUR_MAJOR_ID)) map.removeLayer(CONTOUR_MAJOR_ID);
        if (map.getLayer(CONTOUR_MINOR_ID)) map.removeLayer(CONTOUR_MINOR_ID);
        if (map.getSource(CONTOUR_SRC_ID)) map.removeSource(CONTOUR_SRC_ID);
    }
}
