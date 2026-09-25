// ── Baskartstilen + kart-lägen (projektion/terräng) ─────────────────────────
// Allt här är rena, kartinstans-oberoende byggstenar: stil-URL:er, statiska
// stil-specar och idempotenta på/av-hjälpare som V2Map kallar. Ingen React,
// inget komponent-state — bara MapLibre-konfiguration.

import * as maplibregl from 'maplibre-gl';

// ── WORKER-FIXEN (prodstoppet 25/9 kväll) ───────────────────────────────────
// maplibre 6 laddar sin worker som en RIKTIG modulfil (maplibre-gl-worker.mjs,
// new Worker(new URL(..., import.meta.url))). Webpack/Next emitterar ALDRIG
// den filen ur node_modules-bundlen → webbläsaren 404:ar → Next svarar med
// HTML-sidan → "non-JavaScript MIME type text/html" + "Worker failed to load"
// → kartan kan inte tolka kakel. Därför hostar vi workern själva i public/
// (kopierad ur dist, versionsstämplat filnamn = cache-bust per uppgradering)
// och pekar maplibre dit INNAN första Map-instansen skapas — den här modulen
// importeras av båda kartvägarna (V2Map + CityMapHeroCanvas), så anropet här
// täcker allt.
//
// OBS KATALOG, inte ensam fil: workern importerar "./maplibre-gl-shared.mjs"
// RELATIVT — båda filerna måste ligga bredvid varandra under sina RIKTIGA
// namn (fällde första fixförsöket 25/9 kväll). Versionen bärs av mappnamnet
// i stället, så immutable-cachen förblir säker. maplibreWorker.test.ts låser
// att mappnamnet är paketets version och att BÅDA filerna är byte-identiska
// med paketets — en maplibre-bump utan ny kopia blir rött test, inte död
// karta i prod.
export const MAPLIBRE_WORKER_URL = '/maplibre/6.11.2/maplibre-gl-worker.mjs';
if (typeof window !== 'undefined') {
    maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);
}

// Voyager, den ljusa vektor-basen. Nöjesfälts-stilen byggs genom att
// transformera den (fetchAndTransformThemeParkStyle) — den här URL:en används
// direkt bara som reservväg om transformen inte går att hämta.
// VOYAGER-STILENS LICENSER — två stycken, med olika krav:
//
//   KODEN (style.json) är BSD 3-Clause:
//     Copyright (c) 2018, CartoDB Inc. All rights reserved.
//     Redistribution and use in source and binary forms, with or without
//     modification, are permitted provided that the above copyright notice,
//     this list of conditions and the following disclaimer are retained.
//     Varken CartoDB:s namn eller dess bidragsgivares får användas för att
//     rekommendera eller marknadsföra härledda produkter utan skriftligt
//     tillstånd. Programvaran tillhandahålls "AS IS", utan garantier.
//   Den notisen måste följa med i källkod/dokumentation — därav det här
//   blocket. Den behöver INTE synas i gränssnittet.
//
//   DESIGNEN (själva utseendet) ligger separat under CC-BY 4.0 och kräver
//   SYNLIG kredit till "CARTO" och "OpenMapTiles.org" i kartor som använder
//   stilen. Det är därför kartkrediten namnger båda — även på stadssidorna,
//   där vi sedan 20/9 renderar EGNA kakel och inte gör ett enda anrop till
//   CARTO. Vi slutade använda deras servrar, inte deras formgivning.
export const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// Nöjesfältets land-färger. Utzoomat (nationell vy) är landet EN mörk grön ton;
// inzoomat, när grönska-lagren syns och landet får två gröna skalor, tonar
// bakgrunden till den ursprungliga ljusa paletten. THEMEPARK_LAND_COLOR (den
// mörka) delas av bootstrap-stilen och container-bakgrunden i V2Map — de ska
// matcha det UTZOOMADE läget eftersom kartan startar på zoom 5.
export const THEMEPARK_LAND_COLOR = '#5b9b3b';
// Exporteras: stadssidornas kart-hero (zoom 11 ≥ LAND_ZOOM_NEAR) använder den
// ljusa tonen som väntplatta så GL-intoningen blir sömlös även där.
export const THEMEPARK_LAND_COLOR_NEAR = '#93c46c';
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

    // EGNA VEKTORKAKEL (20/9) — bara när NEXT_PUBLIC_VECTOR_TILES_URL är satt,
    // vilket den är enbart när scripts/render-city-maps.mjs kör. Stadssidornas
    // kartbilder får då INTE hämta kakel från CARTO: deras villkor tillåter
    // direktvisning till besökare (§9.c.i) men förbjuder att vi cachar
    // innehållet på vår server (§9.c.iii), och en förrenderad bild är just det.
    //
    // Att det GÅR beror på att Voyager-stilen är BSD-3-licensierad och skriven
    // mot det öppna OpenMapTiles-schemat (source-layers landcover, water,
    // transportation, place …). Samma stil mot egna kakel ur OSM-data ger
    // därför identiskt utseende. I DRIFT är den här raden inaktiv och
    // huvudkartan hämtar som vanligt direkt från CARTO — vilket är tillåtet.
    // Värdet får vara antingen en TileJSON-URL eller en kakel-mall med {z}/{x}/{y}.
    const egnaKakel = process.env.NEXT_PUBLIC_VECTOR_TILES_URL;
    if (egnaKakel && style.sources?.carto) {
        style.sources.carto = egnaKakel.includes('{z}')
            ? { type: 'vector', tiles: [egnaKakel], minzoom: 0, maxzoom: 14 }
            : { type: 'vector', url: egnaKakel };
    }

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
