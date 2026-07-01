'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Tags, Box, Globe, Mountain, Plus, X, Video, Send, Sun, Target, Crosshair, Maximize2, Zap, Sparkles, Snowflake, Lock, Users, Smile, Satellite, Flower2, Flag, Map as MapIcon, Moon, ChevronRight } from 'lucide-react';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import { isValidLatLng } from '../../utils/mapUtils';
import { sourceColor } from '../../utils/sources';
import { isFeatureOn, FEATURE_CHANGE_EVENT } from '../../lib/featureToggles';
import { isEventFeatured } from '../../services/linkEventService';
import toast from 'react-hot-toast';

// Två basstilar: standard vektor-karta (Voyager) och en raster-satellitvy
// (ESRI World Imagery). Vi växlar via map.setStyle(); markörer behålls eftersom
// de är DOM-element i container, inte en del av style-spec:en.
const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
// Mörkt kartläge (CARTO Dark Matter) — direkt stil-URL, ingen transform behövs.
const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
// Multi-event-grupper (flera event på samma koordinat, "sifferbrickan") OCH event
// som börjar inom 1 timme (orange border) ritas som lätt GL-prick BARA UNDER själva
// zoom-gesten (transient), så animationen inte laggar av tunga DOM-brickor. När
// zoomen är still byggs den fulla DOM-brickan som vanligt. Ingen zoom-tröskel, ingen
// clustering; individuella event och övriga DOM-renderingar är orörda.
const ONE_HOUR_MS = 60 * 60 * 1000;
// En grupp "börjar inom 1 timme" om något event startar i framtiden men inom en
// timme. Samma villkor som ger DOM-brickan dess orange ram.
function groupStartsWithinHour(group: LinkEvent[], nowMs: number): boolean {
    return group.some(e => e.time && e.time.getTime() > nowMs && e.time.getTime() - nowMs <= ONE_HOUR_MS);
}
const SATELLITE_STYLE: maplibregl.StyleSpecification = {
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

// Bootstrap-stil vid mount: kartan behöver en SYNKRON startstil för att rendera
// direkt, men förvald 'themepark' hämtas async (fetch + transform) → annars syns
// en startbild under tiden. Tidigare användes satellitstilen, men då blixtrade en
// satellitvy förbi innan nöjesfält laddat. Här är i stället bara en enfärgad
// bakgrund i nöjesfältets land-färg (#93c46c, samma som themeparkens 'background').
// Ingen nätverkshämtning → renderar omedelbart, och eftersom färgen matchar den
// kommande kartan blir bytet sömlöst (vägar/vatten/etiketter tonar bara in).
const BOOTSTRAP_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#93c46c' } }
    ]
};

// "Nöjesfälts"-kartan: hämta Voyager-stilen och måla om den i en mild, naturlig
// palett (grönt land, blått vatten, dämpade byggnader/vägar) så den fungerar som
// en lugn bakgrund i stället för en gäll tivoli-look. Hämtas + transformeras en
// gång och cachas sedan i komponentens themeParkStyleRef.
async function fetchAndTransformThemeParkStyle(): Promise<maplibregl.StyleSpecification> {
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
            // Land / Background
            if (layer.id === 'background') {
                paint['background-color'] = '#93c46c'; // mättat grästgrönt land (mörkare/grönare än förut) — dominerar utzoomat
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
                    paint['fill-color'] = '#7eb152'; // grönska, ett snäpp djupare än landet
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

// ── GL-markörer (prestanda) ────────────────────────────────────────────────
// Tusentals event som DOM-element gör att MapLibre måste skriva om transform på
// varje element varje frame → kartan laggar. Lösning: rendera de VANLIGA eventen
// som ETT GPU symbol-lager. Varje markör är en bild (nål-bricka + emoji) bakad en
// gång per unik emoji. DOM-brickor används bara för de få "speciella" (valt/
// sparat/eget/guld/grupp/inom-timme), som behöver rik interaktion/animation.
//
// Brickan är en enkel nål-droppe: en rundad kvadrat med tre runda hörn + en spets
// (roterad 45° så spetsen pekar rakt nedåt mot koordinaten). Mörk gradient + tunn
// ljus kant, med emojin centrerad i kroppen. Ingen separat nål/streck under —
// spetsen ÄR nålen. icon-anchor:'bottom' sätter spetsen ~pad ovanför nederkanten,
// dvs. i praktiken på koordinaten.
//
// makeBrickaImageData målar brickan i bodyColor (en kategori-/källfärg) när en
// sådan ges, annars den mörka standard-gradienten. "Stora" källor (PRO/Korpen/
// Svenska kyrkan) får numera ingen egen färg — de skiljs ut via opt-in-filtret.

// Hex → [r,g,b]. Stödjer både #rgb och #rrggbb.
function parseHex(h: string): [number, number, number] {
    const s = h.replace('#', '');
    const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
// Blanda två hex-färger (t = 0 → a, t = 1 → b) och returnera en rgb()-sträng.
function mixHex(a: string, b: string, t: number): string {
    const pa = parseHex(a), pb = parseHex(b);
    const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
    return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}
// En källfärgs brick-gradient (ljus → bas → mörk) som CSS-sträng för DOM-brickan.
function sourceGradientCss(color: string): string {
    return `linear-gradient(145deg, ${mixHex(color, '#ffffff', 0.22)} 0%, ${color} 55%, ${mixHex(color, '#000000', 0.32)} 100%)`;
}

function makeBrickaImageData(emoji: string, bodyColor?: string, selected = false, saved = false): { data: ImageData; pixelRatio: number } | null {
    if (typeof document === 'undefined') return null;
    const DPR = 2.5;
    const S = 40;          // brickans kropp (logiska px), nära DOM:ens 44
    const pad = 7;         // luft för kant + skugga
    const diag = S * Math.SQRT2;
    const W = Math.round(diag + pad * 2);
    const H = Math.round(diag + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(DPR, DPR);
    const cx = W / 2;
    const cy = H - pad - diag / 2; // kroppens mitt; spetsen hamnar ~pad ovanför nederkant

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4); // 45° medurs → det spetsiga hörnet (br) pekar nedåt
    const r = S / 2;
    const anyCtx = ctx as CanvasRenderingContext2D & {
        roundRect?: (x: number, y: number, w: number, h: number, radii: number[]) => void;
    };
    ctx.beginPath();
    if (typeof anyCtx.roundRect === 'function') {
        anyCtx.roundRect(-S / 2, -S / 2, S, S, [r, r, 0, r]); // tl, tr, br(=spets), bl
    } else {
        ctx.rect(-S / 2, -S / 2, S, S);
    }
    const grad = ctx.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2);
    // Sparad (gillad) bricka = ljus/vit kropp (matchar DOM-markörens vita bakgrund);
    // annars källans/kategorins färg eller mörk standard.
    const stops = saved
        ? ['#ffffff', '#f3f6fa', '#e3e9f1']
        : bodyColor
        ? [mixHex(bodyColor, '#ffffff', 0.22), bodyColor, mixHex(bodyColor, '#000000', 0.32)]
        : ['#344256', '#1e293b', '#16202e'];
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.55, stops[1]);
    grad.addColorStop(1, stops[2]);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Ram: vald = tydlig opak vit (markeringen man är "på"); sparad = ljusblå
    // (#5BA3CC, samma som DOM); annars svag vit kant för djup.
    ctx.lineWidth = selected ? 3.5 : saved ? 2.5 : 2;
    ctx.strokeStyle = selected ? '#ffffff' : saved ? '#5BA3CC' : 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.restore();

    // Emoji centrerad i kroppen (oroterad).
    ctx.font = `${Math.round(S * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);

    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: DPR };
}

// ── Brick-kroppens kategori-/källfärg ──────────────────────────────────────
// Bakgrunds-CSS för ETT events bricka i normaltillstånd. Stor källa (PRO/Korpen/
// Svenska kyrkan) → mörk standardbricka; övriga → sin kategoris markerHex-
// gradient. Delas av GL-lagret, DOM-synken, slideshow-cyclern och vald-grupp-
// bläddringen så bakgrunden ALLTID matchar det event som faktiskt visas i en
// multi-event-bricka (förr frös färgen på gruppens FÖRSTA event).
const BRICKA_DARK_BG = 'linear-gradient(145deg, #344256 0%, #1e293b 55%, #16202e 100%)';
function brickaBodyHex(ev: LinkEvent): string | null {
    if (sourceColor(ev.url || ev.id) !== null) return null; // stor källa → mörk
    const catKey = ev.category && EVENT_CATEGORIES[ev.category] ? ev.category : 'other';
    return (EVENT_CATEGORIES[catKey as EventCategoryType] as { markerHex?: string }).markerHex ?? null;
}
function brickaBodyBg(ev: LinkEvent): string {
    const hex = brickaBodyHex(ev);
    return hex ? sourceGradientCss(hex) : BRICKA_DARK_BG;
}

// En GL-markör-feature: punkt + vilken bakad bild + grupp-nyckel (för klick).
type PlainFeature = {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    // count = antal event i gruppen (>1 → "+N"-bricka i hörnet); 1 för enskilda.
    // color = kategorifärg (hex) för nål-pricken; mörk standard för stora källor.
    properties: { icon: string; key: string; count: number; color: string };
};

// ── "Skrapa fram"-markörer: tunbara konstanter ────────────────────────────────
// Vid laddning FÖRHANDSVISAS ALLA event (alla GL-brickor tända). Första trycket på
// kartan kollapsar till de N närmast trycket. Ingen hover längre — man TRYCKER: de
// REVEAL_NEAREST_COUNT närmaste brickorna kring trycket avslöjas och ligger KVAR
// (panorering byter inte urvalet) tills man trycker på nytt. Vid ett nytt tryck
// BYTS urvalet ut med en kugghjuls-effekt (se nedan). Ingen queryRenderedFeatures
// (den var det tunga som laggade): vi räknar avståndet själva (O(antal), kvadrerat
// + cos-lat-skalad longitud) och sätter feature-state direkt via nyckeln
// (promoteId 'key'). Aldrig fler än ~N synliga samtidigt = ingen lagg.
const REVEAL_NEAREST_COUNT = 50;      // antal markörer kring ett tap (de N närmaste)
const REVEAL_SEED_COUNT = 50;         // antal synliga efter första trycket när inget tap-ankare finns
// Vid start FÖRHANDSVISAS ALLA event (previewAllUntilTapRef). Första trycket på kartan
// kollapsar till de N närmast trycket — ingen tidsinställd blink längre.
// Övergång mellan två klickpunkter = en PARALLELL MIGRATION: de N brickorna "flyttar"
// sig mot klicket var och en i sin egen takt (olika hastigheter). Några skjuter fram
// och syns vid destinationen nästan direkt, andra släpar — jämn spridning längs vägen,
// alla landar till slut på de N närmast klicket. (Tidigare modeller: rigid marsch /
// bro som tänjdes ut + kollapsade — bägge kändes som "grova hopp"/"två varv".)
// RESA + INSUG: vid ett klick åker FÖRST en enda bricka mot punkten (RESA), sedan dras
// destinationens event in mot punkten en-och-en (INSUG). RESANS tid skalar LINJÄRT med
// hur långt man klickar på skärmen — kort hopp tar den MINDRE av de två tiderna, hopp
// över hela skärmen den STÖRRE (ordningen spelar ingen roll, koden tar min/max).
// OBS: vid 50/50 är resan nästan momentan — höj värdena för att se brickan "åka".
const REVEAL_STREAM_MS = 50;        // restid (ms) för KORT hopp (samma trakt) — lägre = snabbare
const REVEAL_STREAM_MS_MAX = 50;    // restid (ms) för LÅNGT hopp (hela skärmen) — högre = långsammare
// Antal samtidigt TÄNDA reveal-markörer ska normalt ligga ≤ seed (50) / ≤ N-kring-tap
// (50). Fler än så = något läcker (strandade brickor o.dyl.) → console.warn så man
// ser direkt att det behöver korrigeras. (Logg + ev. varning via reportRevealCount.)
const REVEAL_VISIBLE_WARN = 80;

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
function applyProjection(map: maplibregl.Map, globe: boolean) {
    map.setProjection({ type: globe ? 'globe' : 'mercator' });
}

// Slå på/av 3D-terräng. DEM-källan läggs till lazy och tas bort när läget stängs
// av, så höjddatan inte ligger och äter minne när man kör platt.
function applyTerrain(map: maplibregl.Map, on: boolean) {
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
function applyHillshade(map: maplibregl.Map, on: boolean) {
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

const GEM_THEMES: Record<string, {
    activeBg: string;
    inactiveBg: string;
    activeShadow: string;
    inactiveShadow: string;
    activeIconColor: string;
    inactiveIconColor: string;
}> = {
    findgame: { // Purple Amethyst
        activeBg: 'radial-gradient(circle at 30% 25%, #f3e8ff 0%, #c084fc 25%, #8b5cf6 55%, #6d28d9 85%, #4c1d95 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(243,232,255,0.25) 0%, rgba(192,132,252,0.15) 25%, rgba(139,92,246,0.08) 65%, rgba(109,40,217,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(139,92,246,0.5), 0 0 26px rgba(192,132,252,0.4), inset -3px -6px 14px rgba(76,29,149,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(139,92,246,0.05), inset -3px -5px 12px rgba(76,29,149,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#d8b4fe'
    },
    tilt: { // Cyan Topaz
        activeBg: 'radial-gradient(circle at 30% 25%, #e0f2fe 0%, #38bdf8 25%, #0284c7 55%, #0369a1 85%, #0c4a6e 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(224,242,254,0.25) 0%, rgba(56,189,248,0.15) 25%, rgba(2,132,199,0.08) 65%, rgba(3,105,161,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(2,132,199,0.5), 0 0 26px rgba(56,189,248,0.4), inset -3px -6px 14px rgba(12,74,110,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(2,132,199,0.05), inset -3px -5px 12px rgba(12,74,110,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#7dd3fc'
    },
    throw: { // Fire Opal (Orange)
        activeBg: 'radial-gradient(circle at 30% 25%, #ffedd5 0%, #fb923c 25%, #ea580c 55%, #c2410c 85%, #7c2d12 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(255,237,213,0.25) 0%, rgba(251,146,60,0.15) 25%, rgba(234,88,12,0.08) 65%, rgba(194,65,12,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(234,88,12,0.5), 0 0 26px rgba(251,146,60,0.4), inset -3px -6px 14px rgba(124,45,18,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(234,88,12,0.05), inset -3px -5px 12px rgba(124,45,18,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#ffb07c'
    },
    sun: { // Citrine/Sun Yellow
        activeBg: 'radial-gradient(circle at 30% 25%, #fef9c3 0%, #facc15 25%, #ca8a04 55%, #a16207 85%, #713f12 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(254,249,195,0.25) 0%, rgba(250,204,21,0.15) 25%, rgba(202,138,4,0.08) 65%, rgba(161,98,7,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(202,138,4,0.5), 0 0 26px rgba(250,204,21,0.4), inset -3px -6px 14px rgba(113,63,18,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(202,138,4,0.05), inset -3px -5px 12px rgba(113,63,18,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fef08a'
    },
    focus: { // Ruby Red
        activeBg: 'radial-gradient(circle at 30% 25%, #fee2e2 0%, #f87171 25%, #dc2626 55%, #b91c1c 85%, #7f1d1d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(254,226,226,0.25) 0%, rgba(248,113,113,0.15) 25%, rgba(220,38,38,0.08) 65%, rgba(185,28,28,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(220,38,38,0.5), 0 0 26px rgba(248,113,113,0.4), inset -3px -6px 14px rgba(127,29,29,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(220,38,38,0.05), inset -3px -5px 12px rgba(127,29,29,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fca5a5'
    },
    slingshot: { // Emerald Green
        activeBg: 'radial-gradient(circle at 30% 25%, #dcfce7 0%, #4ade80 25%, #16a34a 55%, #15803d 85%, #14532d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(220,252,231,0.25) 0%, rgba(74,222,128,0.15) 25%, rgba(22,163,74,0.08) 65%, rgba(21,128,61,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(22,163,74,0.5), 0 0 26px rgba(74,222,128,0.4), inset -3px -6px 14px rgba(20,83,45,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(22,163,74,0.05), inset -3px -5px 12px rgba(20,83,45,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#86efac'
    },
    faces: { // Rose Quartz (Pink)
        activeBg: 'radial-gradient(circle at 30% 25%, #fce7f3 0%, #f472b6 25%, #db2777 55%, #be185d 85%, #831843 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(252,231,243,0.25) 0%, rgba(244,114,182,0.15) 25%, rgba(219,39,119,0.08) 65%, rgba(190,24,93,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(219,39,119,0.5), 0 0 26px rgba(244,114,182,0.4), inset -3px -6px 14px rgba(131,24,67,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(219,39,119,0.05), inset -3px -5px 12px rgba(131,24,67,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fbcfe8'
    },
    bigCloud: { // Sapphire Blue
        activeBg: 'radial-gradient(circle at 30% 25%, #e0e7ff 0%, #818cf8 25%, #4f46e5 55%, #3730a3 85%, #1e1b4b 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(224,231,255,0.25) 0%, rgba(129,140,248,0.15) 25%, rgba(79,70,229,0.08) 65%, rgba(55,48,163,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(79,70,229,0.5), 0 0 26px rgba(129,140,248,0.4), inset -3px -6px 14px rgba(30,27,75,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(79,70,229,0.05), inset -3px -5px 12px rgba(30,27,75,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#c7d2fe'
    },
    fastThrow: { // Orange/Lightning Yellow
        activeBg: 'radial-gradient(circle at 30% 25%, #fffbeb 0%, #fbbf24 25%, #d97706 55%, #b45309 85%, #78350f 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(255,251,235,0.25) 0%, rgba(251,191,36,0.15) 25%, rgba(217,119,6,0.08) 65%, rgba(180,83,9,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(217,119,6,0.5), 0 0 26px rgba(251,191,36,0.4), inset -3px -6px 14px rgba(120,53,15,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(217,119,6,0.05), inset -3px -5px 12px rgba(120,53,15,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fde68a'
    },
    sparkle: { // Magenta/Purple Star
        activeBg: 'radial-gradient(circle at 30% 25%, #fae8ff 0%, #e879f9 25%, #c084fc 55%, #8b5cf6 85%, #4c1d95 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(250,232,255,0.25) 0%, rgba(232,121,249,0.15) 25%, rgba(192,132,252,0.08) 65%, rgba(139,92,246,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(139,92,246,0.5), 0 0 26px rgba(232,121,249,0.4), inset -3px -6px 14px rgba(76,29,149,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(139,92,246,0.05), inset -3px -5px 12px rgba(76,29,149,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#f5d0fe'
    },
    snowball: { // Frost/Light Blue
        activeBg: 'radial-gradient(circle at 30% 25%, #f0fdfa 0%, #2dd4bf 25%, #0d9488 55%, #0f766e 85%, #115e59 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,253,250,0.25) 0%, rgba(45,212,191,0.15) 25%, rgba(13,148,136,0.08) 65%, rgba(15,118,110,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(13,148,136,0.5), 0 0 26px rgba(45,212,191,0.4), inset -3px -6px 14px rgba(17,94,89,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(13,148,136,0.05), inset -3px -5px 12px rgba(17,94,89,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#99f6e4'
    },
    createEvent: { // Emerald/Jade Green
        activeBg: 'radial-gradient(circle at 30% 25%, #f0fdf4 0%, #4ade80 25%, #16a34a 55%, #15803d 85%, #14532d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,253,244,0.25) 0%, rgba(74,222,128,0.15) 25%, rgba(22,163,74,0.08) 65%, rgba(21,128,61,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(22,163,74,0.5), 0 0 26px rgba(74,222,128,0.4), inset -3px -6px 14px rgba(20,83,45,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(22,163,74,0.05), inset -3px -5px 12px rgba(20,83,45,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#bbf7d0'
    },
    multiplayer: { // Electric Purple/Blue
        activeBg: 'radial-gradient(circle at 30% 25%, #eff6ff 0%, #60a5fa 25%, #2563eb 55%, #1d4ed8 85%, #1e3a8a 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(239,246,255,0.25) 0%, rgba(96,165,250,0.15) 25%, rgba(37,99,235,0.08) 65%, rgba(29,78,216,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(37,99,235,0.5), 0 0 26px rgba(96,165,250,0.4), inset -3px -6px 14px rgba(29,78,216,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(37,99,235,0.05), inset -3px -5px 12px rgba(29,78,216,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#93c5fd'
    },
    record: { // Deep Crimson/Ruby
        activeBg: 'radial-gradient(circle at 30% 25%, #fff1f2 0%, #fb7185 25%, #e11d48 55%, #be123c 85%, #881337 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(255,241,242,0.25) 0%, rgba(251,113,133,0.15) 25%, rgba(225,29,72,0.08) 65%, rgba(190,18,60,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(225,29,72,0.5), 0 0 26px rgba(251,113,133,0.4), inset -3px -6px 14px rgba(136,19,55,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(225,29,72,0.05), inset -3px -5px 12px rgba(136,19,55,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fecdd3'
    },
    satellite: { // Blue/Sky Pearl
        activeBg: 'radial-gradient(circle at 30% 25%, #f0f9ff 0%, #38bdf8 25%, #0284c7 55%, #0369a1 85%, #075985 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,249,255,0.25) 0%, rgba(56,189,248,0.15) 25%, rgba(2,132,199,0.08) 65%, rgba(3,105,161,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(2,132,199,0.5), 0 0 26px rgba(56,189,248,0.4), inset -3px -6px 14px rgba(7,89,133,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(2,132,199,0.05), inset -3px -5px 12px rgba(7,89,133,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#bae6fd'
    },
    globe: { // Ocean Teal
        activeBg: 'radial-gradient(circle at 30% 25%, #f0fdfa 0%, #2dd4bf 25%, #0d9488 55%, #0f766e 85%, #115e59 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(240,253,250,0.25) 0%, rgba(45,212,191,0.15) 25%, rgba(13,148,136,0.08) 65%, rgba(15,118,110,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(13,148,136,0.5), 0 0 26px rgba(45,212,191,0.4), inset -3px -6px 14px rgba(17,94,89,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(13,148,136,0.05), inset -3px -5px 12px rgba(17,94,89,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#99f6e4'
    },
    terrain: { // Mountain Gold/Bronze
        activeBg: 'radial-gradient(circle at 30% 25%, #fef3c7 0%, #fbbf24 25%, #d97706 55%, #b45309 85%, #78350f 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(254,243,199,0.25) 0%, rgba(251,191,36,0.15) 25%, rgba(217,119,6,0.08) 65%, rgba(180,83,9,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(217,119,6,0.5), 0 0 26px rgba(251,191,36,0.4), inset -3px -6px 14px rgba(12,74,110,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(217,119,6,0.05), inset -3px -5px 12px rgba(12,74,110,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fde68a'
    },
    themepark: { // Candy Pink/Yellow (nöjesfält-knappen)
        activeBg: 'radial-gradient(circle at 30% 25%, #fdf2f8 0%, #f472b6 25%, #db2777 55%, #be185d 85%, #9d174d 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(253,242,248,0.25) 0%, rgba(244,114,182,0.15) 25%, rgba(219,39,119,0.08) 65%, rgba(157,23,77,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(219,39,119,0.5), 0 0 26px rgba(244,114,182,0.4), inset -3px -6px 14px rgba(157,23,77,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(219,39,119,0.05), inset -3px -5px 12px rgba(157,23,77,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#fbcfe8'
    },
    dark: { // Slate/Charcoal (mörkt läge)
        activeBg: 'radial-gradient(circle at 30% 25%, #94a3b8 0%, #475569 25%, #334155 55%, #1e293b 85%, #0f172a 100%)',
        inactiveBg: 'radial-gradient(circle at 30% 25%, rgba(148,163,184,0.25) 0%, rgba(71,85,105,0.15) 25%, rgba(51,65,85,0.08) 65%, rgba(30,41,59,0.05) 100%)',
        activeShadow: '0 8px 22px rgba(51,65,85,0.5), 0 0 26px rgba(71,85,105,0.4), inset -3px -6px 14px rgba(15,23,42,0.55), inset 0 4px 8px rgba(255,255,255,0.6)',
        inactiveShadow: '0 4px 10px rgba(51,65,85,0.05), inset -3px -5px 12px rgba(15,23,42,0.15), inset 0 3px 6px rgba(255,255,255,0.2)',
        activeIconColor: '#ffffff',
        inactiveIconColor: '#cbd5e1'
    }
};

type OrbState = 'active' | 'inactive' | 'locked' | 'capped';

const getGemStyles = (key: string, state: OrbState) => {
    const theme = GEM_THEMES[key];
    if (!theme) {
        const active = state === 'active';
        return {
            bg: active
                ? 'radial-gradient(circle at 32% 28%, #e6f4ff 0%, #7dc4ec 20%, #1d8ec9 55%, #006AA7 85%, #003d65 100%)'
                : 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.98) 0%, rgba(225,238,250,0.85) 25%, rgba(170,205,235,0.55) 65%, rgba(110,160,210,0.55) 100%)',
            shadow: active
                ? '0 8px 18px rgba(0,90,160,0.50), inset -3px -6px 14px rgba(0,40,80,0.55)'
                : '0 6px 14px rgba(60,90,140,0.30), inset -3px -5px 12px rgba(60,90,140,0.30)',
            iconColor: active ? '#ffffff' : '#006AA7',
            border: active ? '1px solid rgba(255,255,255,0.40)' : '1px solid rgba(255,255,255,0.75)'
        };
    }

    if (state === 'locked') {
        const recordTheme = GEM_THEMES['record'];
        return {
            bg: recordTheme.inactiveBg,
            shadow: recordTheme.inactiveShadow,
            iconColor: '#7c2d12',
            border: '1px solid rgba(255,235,180,0.65)'
        };
    }

    const active = state === 'active';
    return {
        bg: active ? theme.activeBg : theme.inactiveBg,
        shadow: active ? theme.activeShadow : theme.inactiveShadow,
        iconColor: active ? theme.activeIconColor : theme.inactiveIconColor,
        border: active ? '1px solid rgba(255,255,255,0.40)' : '1px solid rgba(255,255,255,0.25)'
    };
};

// Startvy: centrerad över mellersta Sverige (≈ Dalarna/Gävle) + mer inzoomad än
// hela landet, så man ser längre UPP i landet direkt (inte bara söder). (GPS flyger
// sedan dit man faktiskt står när den hunnit fram.) Tunbart: sänk lat = mer söderut,
// höj lat = längre upp, höj zoom = mer inzoomat.
const START_CENTER: [number, number] = [14.8, 59.0];
const START_ZOOM = 5.2;

interface V2MapProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    savedEventIds?: Set<string>;
    discardedEventIds?: Set<string>;
    cardExpanded?: boolean;
    onCenterChange?: (lat: number, lng: number) => void;
    onMapDrag?: () => void;
    /** True så fort första event-svaret från databasen kommit. Default true
     *  (bakåtkompat). */
    eventsLoaded?: boolean;
    /** Räknare som triggar att kameran flyger tillbaka TILL det valda eventet
     *  (recenter-knappen på eventkortet — vi går till eventet, eventet flyttas
     *  inte till oss). Varje ökning = ett anrop. */
    recenterTrigger?: number;
    /** Bumpas av zoom-knappen i Nästa-pillen → zooma IN på det valda eventet
     *  (vanliga val står still/zoomar inte; detta är den explicita inzoomningen). */
    zoomToEventTrigger?: number;
    /** Bumpas av zooma-ut-knappen i Nästa-pillen → zooma UT (samma center). */
    zoomOutTrigger?: number;
    /** Bumpas vid dagbyte. Då väljer sidan eventet närmast kartans mitt OCH vi
     *  låter bli att flytta kameran till det — vyn ska stå still vid dagbyte. */
    daySwitchNonce?: number;
    /** Bumpas vid intern kort-navigering (Nästa/Föregående/svep). Då står kameran
     *  kvar — vi panorerar/flyger INTE till eventet man bläddrar fram till. */
    navSelectNonce?: number;
    /** Skickar shop-flaggor uppåt så page.tsx kan gömma/visa knappar som inte
     *  bor i V2Map (t.ex. sol-knappen + fokus-knappen i EventCard, eller
     *  +-knappen i navbaren för att skapa event). Fyrar varje gång användaren
     *  togglar något relevant i shoppen. */
    onFeatureFlagsChange?: (flags: { sun: boolean; focus: boolean; createEvent: boolean; multiplayer: boolean }) => void;
    /** Triggas när användaren klickar på Multiplayer-badgen i shoppen och inte är
     *  inloggad — föräldern hanterar då navigation till /login så användaren kan
     *  registrera sig / skapa konto. */
    onActivateMultiplayer?: () => void;
    /** Fyrar när funktions-"väskan" (uppe till vänster) öppnas/stängs. Sidan
     *  använder det för att tillfälligt gömma poäng-brickan som annars ligger i
     *  samma vänsterkolumn och skulle krocka med utfällningen. */
    onFuncBagOpenChange?: (open: boolean) => void;
}

export default function V2Map({
    events,
    selectedEvent,
    onSelectEvent,
    savedEventIds = new Set(),
    discardedEventIds = new Set(),
    cardExpanded = false,
    onCenterChange,
    onMapDrag,
    eventsLoaded = true,
    recenterTrigger = 0,
    zoomToEventTrigger = 0,
    zoomOutTrigger = 0,
    daySwitchNonce = 0,
    navSelectNonce = 0,
    onFeatureFlagsChange,
    onActivateMultiplayer,
    onFuncBagOpenChange,
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string }>>(new Map());
    // Grupp-nycklar som någon gång visats som bricka via att vara markerade.
    // En gång avslöjad → brickan visas alltid direkt (ingen staggered kö), så
    // ett event man navigerat förbi inte faller tillbaka till nål.
    const revealedKeysRef = useRef<Set<string>>(new Set());
    // Nyckel → tidpunkt då markörens pop-in är klar. Panorerar man bort och
    // tillbaka ska brickor som redan ploppat visas DIREKT — inte ställa sig i
    // den utspridda pop-in-kön igen. (Markör-DOM:en rivs när den lämnar bild,
    // så minnet måste bo här och inte i markerData.)
    const poppedKeysRef = useRef<Map<string, number>>(new Map());
    // Minut-tick: "börjar inom 1 timme"-statusen (orange) räknas från Date.now()
    // i markör-synken — utan tick uppdateras den bara när man råkar flytta
    // kartan. Ticken låter statusen följa klockan.
    const [minuteTick, setMinuteTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setMinuteTick(t => t + 1), 60_000);
        return () => clearInterval(id);
    }, []);

    const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);
    // Klick på en MULTI-event-markör (grupp med >1 event) öppnar en lista (emoji +
    // titel + tid) så man kan välja vilket event i högen man vill öppna. null = ingen.
    const [groupList, setGroupList] = useState<LinkEvent[] | null>(null);
    // Geo-ankaret (lng/lat) för den klickade multi-event-brickan + dess projicerade
    // skärmposition. Listan placeras i brickans ÖVRE HÖGRA hörn och följer punkten
    // när kartan pannas/zoomas (uppdateras i updateCloudPosition på move/zoom).
    const [groupListAnchor, setGroupListAnchor] = useState<{ lng: number; lat: number } | null>(null);
    const groupListAnchorRef = useRef<{ lng: number; lat: number } | null>(null);
    groupListAnchorRef.current = groupListAnchor;
    const [groupListPos, setGroupListPos] = useState<{ x: number; y: number } | null>(null);
    // True medan användaren aktivt zoomar (zoomstart→zoomend). Under gesten ritas
    // multi-event-grupper som lätta GL-prickar; i vila som fulla DOM-brickor. De två
    // är ÖMSESIDIGT UTESLUTANDE — aldrig bägge synliga. Ref:en speglar staten så att
    // syncPlainLayer kan sätta rätt initial-synlighet på prick-lagren om stilen
    // laddas om mitt under en zoom.
    const [isZooming, setIsZooming] = useState<boolean>(false);
    const isZoomingRef = useRef<boolean>(false);
    // Default = 'themepark' ("Nöjesfält"-kartan). Satellit m.fl. går fortfarande att
    // välja i Funktioner-väskan, men nöjesfält är förvald vid varje sidladdning.
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'themepark' | 'dark' | 'orientering'>('themepark');
    const mapStyleRef = useRef(mapStyle);
    mapStyleRef.current = mapStyle;
    // Cache för den hämtade + mildrade nöjesfälts-stilen (Voyager-transform).
    const themeParkStyleRef = useRef<maplibregl.StyleSpecification | null>(null);
    // True om WebGL inte gick att initiera (t.ex. blockerad efter en tidigare
    // kontextförlust). Då visar vi en fallback-ruta i stället för att krascha.
    const [mapError, setMapError] = useState(false);

    // Två oberoende 3D-lägen — deklarerade tidigt så shop-flaggornas
    // isFeatureActive() kan läsa dem under render (annars TDZ-error). Mer
    // detaljer om hur de samverkar finns i kommentaren längre ned där
    // applyProjection/applyTerrain används.
    const [isGlobe, setIsGlobe] = useState(false);
    const [is3DTerrain, setIs3DTerrain] = useState(false);
    const isGlobeRef = useRef(isGlobe);
    isGlobeRef.current = isGlobe;
    const is3DTerrainRef = useRef(is3DTerrain);
    is3DTerrainRef.current = is3DTerrain;

    // Funktioner-shop: centrerad modal med ett grid av kort över befintliga
    // (och framtida) funktioner. Öppnas via +-knappen i höger-stacken. För
    // tillfället är "köp" mockat — klicket aktiverar funktionen direkt.
    const [shopOpen, setShopOpen] = useState(false);
    // Funktions-"väskan" uppe till vänster: fäller ut en inline-lista med
    // kart-funktioner (lutning, kasta, sol, fokus, slangbella). Separat från
    // shopOpen (hela funktioner-shoppen).
    const [funcBagOpen, setFuncBagOpen] = useState(false);
    // Lutning: tiltEnabled = "funktionen aktiverad" (på i väskan). Styr om
    // snabb-knappen under lager-knappen visas. (Själva kamera-lutningen sköttes
    // tidigare av en borttagen tilt-prop.)
    const [tiltEnabled, setTiltEnabled] = useState(false);

    // "Min plats": geolocation-knapp under lutnings-knappen. Position visas som
    // en pulserande blå punkt (egen maplibre-markör — överlever stilbyten).
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
    // Live-ref så reveal-seedet (callback med deps []) kan utgå från ANVÄNDARENS plats
    // i stället för kartmitten (annars hamnar default-eventen mitt i Sverige/Östersund).
    const userPosRef = useRef(userPos);
    userPosRef.current = userPos;
    const [locating, setLocating] = useState(false);
    const userPosMarkerRef = useRef<maplibregl.Marker | null>(null);
    const handleLocateMe = () => {
        if (locating) return;
        if (!('geolocation' in navigator)) {
            toast.error('Din webbläsare saknar platstjänster.');
            return;
        }

        const map = mapRef.current;
        if (!map) return;

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserPos(next);
                setLocating(false);
                map.flyTo({ center: [next.lng, next.lat], zoom: Math.max(map.getZoom(), 12), duration: 1200 });
            },
            (err) => {
                setLocating(false);
                toast.error(err.code === err.PERMISSION_DENIED
                    ? 'Platsåtkomst nekad — tillåt plats i webbläsaren för att hitta dig.'
                    : 'Kunde inte hämta din plats just nu.');
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
    };

    // Fokus-knappen (under funktions-knappen): centrera kartan på det valda
    // eventet om något är valt, annars passa in alla dagens event i vyn.
    // I gissningsläge flyger vi INTE till det valda (dolda) mål-eventet — det
    // skulle avslöja svaret — utan passar in alla event.
    const handleFocusClick = () => {
        const map = mapRef.current;
        if (!map) return;
        if (selectedEvent && isValidLatLng(selectedEvent.lat, selectedEvent.lng)) {
            map.flyTo({ center: [selectedEvent.lng!, selectedEvent.lat!], zoom: Math.max(map.getZoom(), 13), duration: 900 });
            return;
        }
        const pts = events.filter(e => isValidLatLng(e.lat, e.lng));
        if (pts.length === 0) return;
        const b = new maplibregl.LngLatBounds([pts[0].lng!, pts[0].lat!], [pts[0].lng!, pts[0].lat!]);
        pts.forEach(e => b.extend([e.lng!, e.lat!]));
        map.fitBounds(b, { padding: 80, maxZoom: 13, duration: 900 });
    };
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !userPos) return;
        if (!userPosMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'user-pos-dot';
            el.setAttribute('aria-label', 'Din plats');
            userPosMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([userPos.lng, userPos.lat])
                .addTo(map);
        } else {
            userPosMarkerRef.current.setLngLat([userPos.lng, userPos.lat]);
        }
    }, [userPos]);
    // Refs till knappen + den utfällda panelen så ett klick utanför båda
    // stänger väskan (panelen renderas via portal, därav två separata refs).
    const funcBagBtnRef = useRef<HTMLButtonElement>(null);
    const funcBagPanelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!funcBagOpen) return;
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            if (funcBagBtnRef.current?.contains(target)) return;
            if (funcBagPanelRef.current?.contains(target)) return;
            setFuncBagOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [funcBagOpen]);
    // Rapportera öppet/stängt uppåt så sidan kan gömma spel-knapparna (poäng +
    // Hitta event) medan väskan är utfälld — de delar vänsterkolumn.
    const onFuncBagOpenChangeRef = useRef(onFuncBagOpenChange);
    onFuncBagOpenChangeRef.current = onFuncBagOpenChange;
    useEffect(() => {
        onFuncBagOpenChangeRef.current?.(funcBagOpen);
    }, [funcBagOpen]);

    // Shop-flaggor: vilka funktioner som är "påslagna". Vissa funktioner har
    // egen state i V2Map (tilt/globe/terräng) — de hanteras separat nedan i
    // toggleFeature, för att shoppen ska ha en enda gemensam UI-modell. Övriga
    // (sol-knapp, fokus-knapp, kasta, slangbella, individuella ansikten,
    // inspelning) lever här. Sol/fokus skickas upp till page.tsx som styr
    // knapparnas synlighet i EventCard via onFeatureFlagsChange.
    type ShopFlags = {
        sun: boolean;
        focus: boolean;
        throw: boolean;
        slingshot: boolean;
        faces: boolean;
        bigCloud: boolean;
        fastThrow: boolean;
        sparkle: boolean;
        snowball: boolean;
        createEvent: boolean;
        multiplayer: boolean;
        record: boolean;
        flowers: boolean;
    };
    const [shopFlags, setShopFlags] = useState<ShopFlags>({
        // Defaults valda så att 5-aktiva-gränsen är respekterad redan från start.
        // Tilt/globe/terrain/satellit har egen state (inte i flags) — av dem är
        // bara satellit på som default, vilket ger 5 totalt:
        // satellit + sun + focus + throw + createEvent.
        // Nöjesfält (mapStyle='themepark') är förvald kartstil från start — allt
        // annat av. Satellit m.fl. kan väljas i Funktioner-väskan.
        sun: false,
        focus: false,
        throw: false,
        slingshot: false,
        faces: false,
        bigCloud: false,
        fastThrow: false,
        sparkle: false,
        snowball: false,
        createEvent: true,    // PÅ som default — att skapa event är en kärnfunktion
                              // (onboardingen lovar det). Kan stängas av i väskan.
        multiplayer: false,   // kräver konto-registrering
        record: false,        // låst tills "köpt"
        flowers: false        // av som default (kan slås på i funktions-popupen)
    });

    // Begränsningen borttagen: man kan aktivera hur många funktioner som helst samtidigt.
    const MAX_ACTIVE_FEATURES = 999;
    const COUNTED_FEATURE_KEYS = [
        'satellite', 'themepark', 'dark', 'orientering', 'globe', 'terrain',
        'sun', 'focus', 'throw', 'slingshot', 'faces',
        'bigCloud', 'fastThrow', 'sparkle', 'snowball',
        'createEvent'
    ];

    const onFeatureFlagsChangeRef = useRef(onFeatureFlagsChange);
    onFeatureFlagsChangeRef.current = onFeatureFlagsChange;
    useEffect(() => {
        onFeatureFlagsChangeRef.current?.({
            sun: shopFlags.sun,
            focus: shopFlags.focus,
            createEvent: shopFlags.createEvent,
            multiplayer: shopFlags.multiplayer
        });
    }, [shopFlags.sun, shopFlags.focus, shopFlags.createEvent, shopFlags.multiplayer]);

    const onActivateMultiplayerRef = useRef(onActivateMultiplayer);
    onActivateMultiplayerRef.current = onActivateMultiplayer;

    // Inkluderar tilt/globe/terräng/satellit i samma "is this feature active?"-
    // modell som övriga shop-flaggor, så master-toggle och kort-rendering kan
    // hanteras likadant. mapStyle är inte boolean → satellit-mappas via lik.
    const isFeatureActive = (key: string): boolean => {
        if (key === 'tilt') return tiltEnabled;
        if (key === 'globe') return isGlobe;
        if (key === 'terrain') return is3DTerrain;
        if (key === 'satellite') return mapStyle === 'satellite';
        if (key === 'themepark') return mapStyle === 'themepark';
        if (key === 'dark') return mapStyle === 'dark';
        if (key === 'orientering') return mapStyle === 'orientering';
        return (shopFlags as Record<string, boolean>)[key] ?? false;
    };
    const activeFeatureCount = COUNTED_FEATURE_KEYS.reduce(
        (n, k) => n + (isFeatureActive(k) ? 1 : 0),
        0
    );

    const setFeatureActive = (key: string, value: boolean) => {
        // 'record' är inte längre låst — den togglas som vilken annan flagga (faller
        // igenom till setShopFlags nedan). Multiplayer behåller sin egen logik.
        if (key === 'multiplayer') {
            if (value && !shopFlags.multiplayer) {
                onActivateMultiplayerRef.current?.();
                return;
            }
            setShopFlags(prev => ({ ...prev, multiplayer: value }));
            return;
        }
        if (key === 'tilt') {
            // Aktivera/avaktivera funktionen (styr knappens synlighet).
            setTiltEnabled(value);
            return;
        }
        if (key === 'globe') { setIsGlobe(value); return; }
        if (key === 'terrain') { setIs3DTerrain(value); return; }
        if (key === 'satellite') { setMapStyle(value ? 'satellite' : 'streets'); return; }
        if (key === 'themepark') { setMapStyle(value ? 'themepark' : 'streets'); return; }
        if (key === 'dark') { setMapStyle(value ? 'dark' : 'streets'); return; }
        if (key === 'orientering') { setMapStyle(value ? 'orientering' : 'streets'); return; }
        setShopFlags(prev => ({ ...prev, [key]: value }));
    };
    const toggleFeature = (key: string) => setFeatureActive(key, !isFeatureActive(key));
    const setAllFeatures = (value: boolean) => {
        if (!value) {
            // Avaktivera allting (utom record/multiplayer som har egen logik).
            setTiltEnabled(false);
            setIsGlobe(false);
            setIs3DTerrain(false);
            setMapStyle('streets');
            setShopFlags(prev => {
                const next = { ...prev };
                (Object.keys(next) as Array<keyof ShopFlags>).forEach(k => {
                    if (k !== 'record' && k !== 'multiplayer') next[k] = false;
                });
                return next;
            });
            return;
        }
        // Aktivera bara de första MAX_ACTIVE_FEATURES i COUNTED_FEATURE_KEYS-ordningen,
        // resten lämnas avaktiverade. (Användaren får sin "loadout" automatiskt.)
        const toActivate = new Set(COUNTED_FEATURE_KEYS.slice(0, MAX_ACTIVE_FEATURES));
        const want = (k: string) => toActivate.has(k);
        setTiltEnabled(want('tilt'));
        setIsGlobe(want('globe'));
        setIs3DTerrain(want('terrain'));
        setMapStyle(want('satellite') ? 'satellite' : 'streets');
        setShopFlags(prev => {
            const next = { ...prev };
            (Object.keys(next) as Array<keyof ShopFlags>).forEach(k => {
                if (k === 'record' || k === 'multiplayer') return;
                next[k] = want(k);
            });
            return next;
        });
    };

    // Två oberoende 3D-lägen som kan skiftas var för sig (och kombineras):
    //   isGlobe      — projicera kartan på ett klot (mercator ↔ globe). ~0 minne.
    //   is3DTerrain  — res upp höjder/berg ur kartan via en DEM-källa. Minnestungt,
    //                  därför läggs DEM-källan till/tas bort dynamiskt (se effekt).
    // Refs så att stil-omladdningen (setStyle nollställer projektion + custom-källor)
    // kan återställa rätt läge utan att bindas om.
    // (state + refs är deklarerade högre upp så shop-flaggorna kan läsa dem.)

    // Gissnings-streck (spelet): geo-ankaret i en ref + de projicerade skärm-
    // positionerna i state. Skärmpositionerna uppdateras varje kart-frame så
    // strecket sitter fast mellan gissningen och rätt svar medan kartan rör sig.

    // Spara undan callbacks i refs så map-event-handlers inte ständigt behöver bindas om
    const onSelectEventRef = useRef(onSelectEvent);
    onSelectEventRef.current = onSelectEvent;

    const onCenterChangeRef = useRef(onCenterChange);
    onCenterChangeRef.current = onCenterChange;

    const onMapDragRef = useRef(onMapDrag);
    onMapDragRef.current = onMapDrag;

    // Spel-läge + gissnings-callback i refs så markör-klickhanterare kan läsa
    // senaste värdet utan att bindas om.

    // ── Onboarding/intro ────────────────────────────────────────────────────
    // Knuffa användaren att testa Fokus-funktionen — men FÖRST när hen hämtat
    // tillbaka molnet via molnsymbolen (inte direkt när start-molnet stängs).
    // INGA lås — bara en "Ny funktion"-pil + blinkning som visar att det finns
    // nytt att prova.
    const [featureHint, setFeatureHint] = useState<'focus' | null>(null);
    // True när väskan öppnats medan ett tips var aktivt → då slutar "Ny funktion"-
    // pilen + lager-blinket (för gott för det tipset). Själva funktionsraden blinkar
    // dock kvar tills man klickat på den. Nollställs när ett NYTT tips dyker upp.
    const [hintAcknowledged, setHintAcknowledged] = useState(false);
    // Nytt tips → visa pilen igen.
    useEffect(() => { if (featureHint !== null) setHintAcknowledged(false); }, [featureHint]);
    // Öppnar väskan medan tipset är aktivt → kvittera (pilen/lager-blinket slutar).
    useEffect(() => { if (funcBagOpen && featureHint !== null) setHintAcknowledged(true); }, [funcBagOpen, featureHint]);
    // Recenter-knappen (vid "Idag") blinkar när Fokus AKTIVERATS (av→på), så man
    // ser vilken knapp man slog på. Slutar blinka när man klickat (centrerat).
    const [recenterToolBlink, setRecenterToolBlink] = useState(false);
    const prevFocusForBlinkRef = useRef(shopFlags.focus);
    useEffect(() => {
        if (shopFlags.focus && !prevFocusForBlinkRef.current) setRecenterToolBlink(true);
        prevFocusForBlinkRef.current = shopFlags.focus;
    }, [shopFlags.focus]);
    const prevRecenterRef = useRef(recenterTrigger);
    useEffect(() => {
        if (recenterTrigger !== prevRecenterRef.current) {
            prevRecenterRef.current = recenterTrigger;
            setRecenterToolBlink(false);
        }
    }, [recenterTrigger]);

    // Vattnade nålar (blommor): laddas från localStorage vid mount, sparas vid förändring.
    const [wateredKeys, setWateredKeys] = useState<Set<string>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem('vadkul_watered_markers');
                if (saved) return new Set(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load watered markers', e);
            }
        }
        return new Set();
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem('vadkul_watered_markers', JSON.stringify(Array.from(wateredKeys)));
            } catch (e) {
                console.error('Failed to save watered markers', e);
            }
        }
    }, [wateredKeys]);

    const [wateringKey, setWateringKey] = useState<string | null>(null);
    const wateringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Hanterar 1-sekunds timer för pågående vattning
    useEffect(() => {
        if (wateringTimeoutRef.current) {
            clearTimeout(wateringTimeoutRef.current);
            wateringTimeoutRef.current = null;
        }

        if (wateringKey) {
            wateringTimeoutRef.current = setTimeout(() => {
                setWateredKeys(prev => {
                    const next = new Set(prev);
                    next.add(wateringKey);
                    return next;
                });
                setWateringKey(null);
            }, 1000); // 1 sekund
        }

        return () => {
            if (wateringTimeoutRef.current) {
                clearTimeout(wateringTimeoutRef.current);
            }
        };
    }, [wateringKey]);

    // Blommor-funktionen: vattning startades tidigare när ett moln höll nära en
    // nål. Molnsystemet är borttaget → ingen vattning kan längre startas; effekten
    // avbryter bara ev. pågående vattning om funktionen stängs av.
    useEffect(() => {
        if (!shopFlags.flowers) {
            if (wateringKey !== null) setWateringKey(null);
            return;
        }
    }, [shopFlags.flowers, wateringKey]);

    // (Bildväxlingen för grupper med flera event på samma plats sköts av en
    //  desyncad cycler längre ner — se effekten efter visibleGroups.)

    // Gruppera events som ligger på (nästan) samma koord. ~11m precision (4 decimaler).
    const groups = useMemo(() => {
        const map = new Map<string, LinkEvent[]>();
        for (const evt of events) {
            if (!evt.lat || !evt.lng) continue;
            const key = `${evt.lat.toFixed(4)},${evt.lng.toFixed(4)}`;
            const bucket = map.get(key);
            if (bucket) bucket.push(evt); else map.set(key, [evt]);
        }
        return map;
    }, [events]);

    // Stabil ref till grupperna så GL-lagrets klick-handler (registreras en gång)
    // kan slå upp grupp utifrån feature-nyckeln.
    const groupsRef = useRef(groups);
    groupsRef.current = groups;


    // En grupp är "speciell" om den behöver den rika DOM-brickan (animationer,
    // sifferbricka, vattning, highlight). Övriga renderas billigt i GL-lagret.
    // Samma predikat används både för att VÄLJA DOM-grupper (visibleGroups) och
    // för att UTESLUTA dem ur GL-lagret — så ingen markör dubbelritas.
    const isSpecialGroup = useCallback((group: LinkEvent[], _key: string, nowMs: number): boolean => {
        // Det VALDA (öppnade) eventet är speciellt → DOM-markör med vit ram. Övriga
        // vanliga/multi/imminent/skapade/slängda hanteras via avslöjningen (GL-brickor).
        if (selectedEvent && group.some(e => e.id === selectedEvent.id)) return true;
        // OBS: gillade (sparade) event är INTE special. De ritas som vanliga GL-brickor
        // men med VIT kropp + force-tända (alltid reveal=1 via revealStickyRef) → de
        // förblir synliga vita överallt, oavsett avslöjning/viewport/vad som är valt.
        return false;
    }, [selectedEvent]);

    // DOM-markörer: BARA speciella grupper (få) inom skärmen (+20% marginal).
    // Valt/gissat/guld visas alltid, även utanför skärmen. Resten ritas i GL.
    const visibleGroups = useMemo(() => {
        if (!mapBounds) return [];
        const nowMs = Date.now();

        const lngSpan = mapBounds.getEast() - mapBounds.getWest();
        const latSpan = mapBounds.getNorth() - mapBounds.getSouth();
        const paddedBounds = new maplibregl.LngLatBounds(
            [mapBounds.getWest() - lngSpan * 0.2, mapBounds.getSouth() - latSpan * 0.2],
            [mapBounds.getEast() + lngSpan * 0.2, mapBounds.getNorth() + latSpan * 0.2]
        );
        const mustShow = (group: LinkEvent[]) =>
            !!selectedEvent && group.some(e => e.id === selectedEvent.id);

        const out: [string, LinkEvent[]][] = [];
        for (const entry of groups.entries()) {
            const [key, group] = entry;
            if (!isSpecialGroup(group, key, nowMs)) continue;
            if (mustShow(group)) { out.push(entry); continue; }
            // Multi-event-grupp ELLER "inom 1 timme" (orange) visas som GL-prickar under zoom
            // men vi håller dem kvar i DOM:en (med klassen 'hide-during-zoom') så att de döljs
            // via CSS under zoom i stället för att unmountas och remountas i React (vilket laggar).
            const rep = group[0];
            // Range-validering (inte bara falsy): en projicerad koordinat som
            // lat=6129956 får annars LngLatBounds.contains att kasta och
            // kraschar hela kartan.
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            if (paddedBounds.contains([rep.lng, rep.lat])) out.push(entry);
        }
        return out;
    }, [groups, mapBounds, selectedEvent, isSpecialGroup]);

    // GL-lagret: alla ICKE-speciella grupper (huvuddelen). Byggs som GeoJSON +
    // den uppsättning brick-bilder (emoji × ev. källfärg) som behöver bakas. Hela
    // världen ligger i källan — MapLibre kullar och avkrockar själv på GPU:n
    // (icon-allow-overlap false), så vi behöver ingen egen viewport-gallring här.
    // Event från en "stor" källa (PRO/Korpen/Svenska kyrkan) får standard mörk bricka;
    // alla övriga event färgas efter sin kategori.
    const plainData = useMemo(() => {
        const nowMs = Date.now();
        const features: PlainFeature[] = [];
        const icons = new Map<string, { emoji: string; color?: string; selected?: boolean; saved?: boolean }>();
        // Det VALDA eventet behålls i GL-lagret (utöver sin DOM-markör) så att brickan
        // man är "på" ALLTID syns. Eftersom det valda ALLTID är "special" ritas just
        // dess GL-bricka med sin riktiga look INBAKAD (vit ram = vald, vit kropp =
        // sparad) — annars täckte den kantlösa standard-GL-brickan DOM-markörens look
        // (anchor-glapp) → "ingen vit ram / ingen vit bakgrund".
        const savedCutoff = nowMs - 60 * 60 * 1000;
        const selId = selectedEvent?.id;
        for (const [key, group] of groups) {
            const isSel = selId != null && group.some(e => e.id === selId);
            const special = isSpecialGroup(group, key, nowMs);
            if (!isSel && special) continue;
            const rep = group[0];
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            const catKey = rep.category && EVENT_CATEGORIES[rep.category] ? rep.category : 'other';
            const emoji = rep.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');
            // Stor källa (PRO/Korpen/Svenska kyrkan) → ingen färg (mörk standard);
            // övriga → sin kategori-färg. Samma helper som DOM-brickan, så GL- och
            // DOM-färgen aldrig glider isär.
            const color = brickaBodyHex(rep) ?? undefined;
            // Vald bricka (isSel) → vit ram. ALLA gillade (framtida) event → vit kropp,
            // oavsett om de är valda — så de FÖRBLIR vita när man bläddrar vidare. Övriga
            // (reveal-brickorna) = normal look.
            const drawSel = isSel;
            const drawSav = group.some(e => savedEventIds.has(e.id) && e.time.getTime() >= savedCutoff);
            const baseIcon = color ? `bricka:${color}:${emoji}` : `bricka:${emoji}`;
            const iconId = `${baseIcon}${drawSel ? ':sel' : ''}${drawSav ? ':sav' : ''}`;
            if (!icons.has(iconId)) icons.set(iconId, { emoji, color, selected: drawSel, saved: drawSav });
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rep.lng!, rep.lat!] },
                properties: { icon: iconId, key, count: group.length, color: color ?? '#1e293b' },
            });
        }
        return { features, icons };
    }, [groups, isSpecialGroup, selectedEvent, savedEventIds]);
    const plainFeaturesRef = useRef<PlainFeature[]>([]);
    const usedIconsRef = useRef<Map<string, { emoji: string; color?: string; selected?: boolean; saved?: boolean }>>(new Map());
    // Nyckel = hela ikon-id:t (bricka:[färg:]emoji) så färgvarianter cachas separat.
    const bakedIconsRef = useRef<Map<string, { data: ImageData; pixelRatio: number }>>(new Map());

    // Lätta GL-prickar för multi-event-grupper UNDER zoom-gesten. I vila är listan
    // tom → DOM-brickorna ritar dem i stället (se visibleGroups). Egenskapen `count`
    // = antal event → ritas som GL-siffra ovanpå pricken. Inte viewport-gallrad —
    // billiga cirklar, hela landet ryms på GPU:n. Valt/gissat/guld hålls kvar som
    // DOM (mustShow) så deras rika kort/highlight funkar.
    const multiEventDotData = useMemo(() => {
        if (!isZooming) return [] as GeoJSON.Feature[];
        const nowMs = Date.now();
        const mustShow = (group: LinkEvent[]) =>
            !!selectedEvent && group.some(e => e.id === selectedEvent.id);
        const features: GeoJSON.Feature[] = [];
        for (const [key, group] of groups) {
            // Bara grupper som FAKTISKT är speciella (saved/userCreated/imminent…
            // = de som ritas som DOM-brickor i vila) ersätts av prickar under zoom.
            // Vanliga multi-event-grupper ligger numera i plain-events-lagret (dolda
            // → skrapas fram med penseln, precis som enskilda event) och ska INTE
            // poppa upp under zoom-gesten.
            if (!isSpecialGroup(group, key, nowMs)) continue;
            const imminent = groupStartsWithinHour(group, nowMs);
            // Multi-event-grupper OCH "inom 1 timme"-event (orange) blir prickar.
            if (group.length <= 1 && !imminent) continue;
            if (mustShow(group)) continue;            // valt/gissat/guld → alltid DOM
            const rep = group[0];
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rep.lng!, rep.lat!] },
                // imminent → orange prick; count > 1 → siffra ovanpå.
                properties: { key, count: group.length, imminent },
            });
        }
        return features;
    }, [groups, isZooming, selectedEvent, isSpecialGroup]);
    const multiEventDotFeaturesRef = useRef<GeoJSON.Feature[]>([]);

    // ── "Skrapa fram"-markörer (de N närmaste pekaren) ────────────────────────
    // GL-brickorna börjar dolda (icon-opacity 0 via feature-state 'reveal'). Bara
    // ~REVEAL_SEED_COUNT syns från start (närmast mitten); i övrigt visas de
    // REVEAL_NEAREST_COUNT grupper som är NÄRMAST pekaren och följer hovern. Vi
    // räknar avstånden själva (billigt) och sätter feature-state direkt via nyckeln
    // — ingen queryRenderedFeatures (det var det som laggade).
    const revealSeedRef = useRef<Set<string>>(new Set());                 // vilo-uppsättningen (vid start: ~10 nära mitten; efter tap: N närmast trycket)
    // Tap-utgångspunkt (mobil-vänligt): trycker man på tom karta sätts denna geo-
    // punkt och vilo-uppsättningen blir de N närmaste BRICKORNA kring trycket — de
    // ligger kvar tills man trycker på nytt (panorering flyttar dem INTE). null =
    // inget tap ännu → vilo-uppsättningen följer kartmitten som förr.
    const revealAnchorPtRef = useRef<{ lng: number; lat: number } | null>(null);
    // Brickor man KLICKAT på stannar avslöjade (de "klistras fast") — annars föll en
    // bricka tillbaka till dold GL när man avmarkerade/bläddrade vidare och såg ut att
    // försvinna. Den valda visas som vit-kantad DOM-markör; när den lämnar valt läge
    // håller denna uppsättning kvar den i GL-lagret. GL-motsvarighet till revealedKeysRef.
    const revealStickyRef = useRef<Set<string>>(new Set());
    const revealCoordsRef = useRef<{ key: string; lng: number; lat: number }[]>([]); // platt lista för avståndsberäkning
    const revealWrittenRef = useRef<Map<string, number>>(new Map());      // senast skrivet opacitetsvärde (skippa redundanta skrivningar)
    const revealRafRef = useRef<number | null>(null);
    const revealCleanupRef = useRef<null | (() => void)>(null);
    // Förhandsvisning vid start: ALLA event syns på kartan från början (ingen
    // tidsinställd blink). Vid FÖRSTA trycket på kartan kollapsar det till normal-
    // läget = de N närmast trycket, resten tonas bort. Sätts false vid det trycket.
    const previewAllUntilTapRef = useRef(true);
    // Ref-wrappers så funktionerna (definierade nedan) kan kallas från syncPlainLayer
    // / map-load utan att hamna i temporal-dead-zone.
    const ensureRevealPumpRef = useRef<() => void>(() => {});
    const reapplyAllRevealRef = useRef<() => void>(() => {});
    const recomputeRevealSeedRef = useRef<() => void>(() => {});
    // Startar "vandringen": avslöjningen glider event-för-event från förra trycket
    // till den nya platsen (toLng/toLat). Sätts nedan.
    const startRevealTravelRef = useRef<(toLng: number, toLat: number) => void>(() => {});
    const revealTweenRef = useRef<number | null>(null); // rAF-id för marschen
    const revealHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // (oanvänd nu; behålls för cleanup)
    // Klustrets FAKTISKA position just nu (geo). Uppdateras varje marsch-cykel. Vid
    // ett nytt klick startar marschen härifrån (inte från destinationen) så avbrutna
    // marscher fortsätter smidigt från där brickorna faktiskt står.
    const revealMarchPtRef = useRef<{ lng: number; lat: number } | null>(null);
    // Tidsfönster (performance.now-ms) då auto-recenter av kameran ska hoppas över.
    // Sätts av dagbyte + kort-navigering (Nästa/Föregående/svep) — INTE av kart-
    // klicket (där ska den valda brickan tvärtom få bli synlig via recenter).
    const suppressAutoRecenterUntilRef = useRef(0);

    // Installerar/uppdaterar GL-markörlagret: källa + bakade emoji-bilder + lager,
    // och pushar senaste datan. Idempotent — säker att kalla efter varje stilbyte
    // (setStyle rensar källor/bilder/lager, så de måste återinstalleras).
    const syncPlainLayer = useCallback(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        try {
            if (!map.getSource('plain-events')) {
                // promoteId: 'key' → feature-state kan adresseras via gruppnyckeln
                // (reveal-systemet sätter icon-opacity per markör).
                map.addSource('plain-events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'key' });
            }
            // Baka (eller återanvänd) bild för varje brick-variant (emoji × källfärg).
            usedIconsRef.current.forEach(({ emoji, color, selected, saved }, id) => {
                if (map.hasImage(id)) return;
                let baked = bakedIconsRef.current.get(id);
                if (!baked) {
                    const b = makeBrickaImageData(emoji, color, selected, saved);
                    if (b) { bakedIconsRef.current.set(id, b); baked = b; }
                }
                if (baked) map.addImage(id, baked.data, { pixelRatio: baked.pixelRatio });
            });
            // Brickorna: ALLA event syns på ALLA zoomnivåer (allow-overlap +
            // ignore-placement = ingen avkrockning) så man alltid ser var man kan
            // klicka — även i hela-Sverige-vyn. Det är ett GPU-lager, så även
            // tusentals brickor är billiga att rita.
            if (!map.getLayer('plain-events')) {
                map.addLayer({
                    id: 'plain-events',
                    type: 'symbol',
                    source: 'plain-events',
                    layout: {
                        'icon-image': ['get', 'icon'],
                        // Spetsen (nederkanten av bilden) på koordinaten.
                        'icon-anchor': 'bottom',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                        // Storlek matchad mot DOM-brickorna (~38px kropp) så enskilda
                        // GL-event och fler-event-grupper (DOM) ser lika stora ut.
                        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.78, 9, 0.9, 13, 0.98],
                        // Fler-event-brickor (count>1) ritas ÖVERST och hamnar först i
                        // queryRenderedFeatures — sort-key = antal event → ju fler, desto
                        // högre upp i staplingen (och lättast att träffa).
                        'symbol-sort-key': ['get', 'count'],
                        'symbol-z-order': 'auto',
                    },
                    paint: {
                        // Dold tills reveal-systemet tonar in den (feature-state 'reveal').
                        'icon-opacity': ['coalesce', ['feature-state', 'reveal'], 0],
                        'icon-opacity-transition': { duration: 0, delay: 0 },
                    },
                });
                // Lagret (om)skapades → feature-state är tomt (setStyle rensar det).
                // Glöm vad som skrivits och skriv om seed + ev. levande penseldrag.
                revealWrittenRef.current.clear();
                reapplyAllRevealRef.current();
                ensureRevealPumpRef.current();
            }
            // "+N"-badge för brickor med flera event (count > 1) — siffra uppe till
            // höger på brickan. Följer samma reveal-state som ikonen (men multi-event
            // hålls alltid tända, så badgen syns alltid). Kräver glyfer.
            if (!map.getLayer('plain-events-count')) {
                map.addLayer({
                    id: 'plain-events-count',
                    type: 'symbol',
                    source: 'plain-events',
                    layout: {
                        // Totalt antal event i gruppen (bara för count > 1).
                        'text-field': ['case', ['>', ['get', 'count'], 1], ['to-string', ['get', 'count']], ''],
                        'text-font': ['Open Sans Bold'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 13, 13],
                        'text-anchor': 'bottom',
                        'text-offset': [0.95, -1.5],
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                        // Samma stapling som brickan — fler-event-badgen överst.
                        'symbol-sort-key': ['get', 'count'],
                        'symbol-z-order': 'auto',
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#006AA7',
                        'text-halo-width': 2.4,
                        'text-opacity': ['coalesce', ['feature-state', 'reveal'], 0],
                        'text-opacity-transition': { duration: 0, delay: 0 },
                    },
                });
            }
            // Prick-lagret = "nål"-läget UNDER zoom-gesten (visas av showNeedles,
            // göms av showBricks). Vilar dolt — i vila syns brickorna. Cirklar
            // kräver inga glyph-/krock-beräkningar, så zoom-animationen blir billig.
            if (!map.getLayer('plain-events-dots')) {
                map.addLayer({
                    id: 'plain-events-dots',
                    type: 'circle',
                    source: 'plain-events',
                    layout: { 'visibility': 'none' },
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 3.5, 14, 4.5],
                        // Nål-pricken får eventets KATEGORIFÄRG (mörk standard för stora källor).
                        'circle-color': ['coalesce', ['get', 'color'], '#1e293b'],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.5,
                        // ALLA prickar fullt synliga (oberoende av reveal-state). Lagret
                        // visas BARA under zoom-gesten (visibility växlas av showNeedles/
                        // exitZooming) → då ska HELA Sveriges färgade prickar synas medan
                        // de fulla brickorna ännu inte hunnit ritas. (Förut följde de
                        // reveal-staten → bara de ~30 avslöjade prickarna syntes under zoom.)
                        'circle-opacity': 1,
                        'circle-stroke-opacity': 0.9,
                    },
                });
            }
            const src = map.getSource('plain-events') as maplibregl.GeoJSONSource | undefined;
            src?.setData({ type: 'FeatureCollection', features: plainFeaturesRef.current as unknown as GeoJSON.Feature[] });

            // Multi-event- & "inom 1 timme"-prickar. Egen lätt cirkel-källa/lager —
            // INGEN clustering. Svart fyllning (orange för "inom 1 timme"), liten
            // radie, vit kant. Siffran ritas av symbol-lagret nedan (egen GL-text).
            if (!map.getSource('multi-event-dots')) {
                map.addSource('multi-event-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            }
            if (!map.getLayer('multi-event-dots')) {
                map.addLayer({
                    id: 'multi-event-dots',
                    type: 'circle',
                    source: 'multi-event-dots',
                    // Synlig BARA under zoom-gesten (i vila ritar DOM-brickorna dem).
                    layout: { 'visibility': isZoomingRef.current ? 'visible' : 'none' },
                    paint: {
                        'circle-radius': 6,
                        // "Inom 1 timme" → orange (matchar DOM-brickans ram), annars svart.
                        'circle-color': ['case', ['get', 'imminent'], '#f97316', '#000000'],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.5,
                    },
                });
            }
            // Siffer-badge uppe till höger om pricken (antal event i gruppen). Kräver
            // glyfer (satellitstilen har fått ett glyf-endpoint). Blockeras fonten
            // visas pricken ändå, bara utan siffra.
            if (!map.getLayer('multi-event-dots-count')) {
                map.addLayer({
                    id: 'multi-event-dots-count',
                    type: 'symbol',
                    source: 'multi-event-dots',
                    layout: {
                        'visibility': isZoomingRef.current ? 'visible' : 'none',
                        // Siffra bara för fler-event-grupper; enstaka "inom 1 timme"
                        // (count = 1) får ingen "1"-text, bara den orange pricken.
                        'text-field': ['case', ['>', ['get', 'count'], 1], ['to-string', ['get', 'count']], ''],
                        'text-font': ['Open Sans Bold'],
                        'text-size': 11,
                        'text-anchor': 'bottom-left',
                        'text-offset': [0.5, -0.5],
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#000000',
                        'text-halo-width': 1.5,
                    },
                });
            }
            const multiSrc = map.getSource('multi-event-dots') as maplibregl.GeoJSONSource | undefined;
            multiSrc?.setData({ type: 'FeatureCollection', features: multiEventDotFeaturesRef.current });
            // Återuppta reveal-loopen så ev. köade/permanenta avslöjningar skrivs.
            ensureRevealPumpRef.current();
        } catch (err) {
            console.warn('Kunde inte synka GL-markörlagret', err);
        }
    }, []);
    const syncPlainLayerRef = useRef(syncPlainLayer);
    syncPlainLayerRef.current = syncPlainLayer;

    // Räkna hur många reveal-markörer som FAKTISKT är tända just nu (write-cachen,
    // op > 0.5) och logga. Fler än REVEAL_VISIBLE_WARN = något läcker (t.ex. strandade
    // brickor) → console.warn så det syns direkt i konsolen. Anropas vid settle-punkter
    // (marsch klar, vilo-reconcile, seed-omräkning).
    const reportRevealCount = useCallback((ctx: string) => {
        let lit = 0;
        revealWrittenRef.current.forEach(op => { if (op > 0.5) lit++; });
        if (lit > REVEAL_VISIBLE_WARN) {
            console.warn(`⚠️ [reveal] ${lit} eventmarkörer synliga (${ctx}) — över ${REVEAL_VISIBLE_WARN}, något behöver korrigeras`);
        } else {
            console.log(`[reveal] ${lit} eventmarkörer synliga (${ctx})`);
        }
    }, []);

    // ── Reveal/pensel-loopen ──────────────────────────────────────────────────
    // Skriv seed-markörerna (de ~10 alltid synliga) direkt — efter ett stilbyte
    // rensar setStyle feature-state, så de måste sättas på nytt.
    const reapplyAllReveal = useCallback(() => {
        const map = mapRef.current;
        if (!map || !map.getLayer('plain-events')) return;
        const light = (key: string) => {
            try { map.setFeatureState({ source: 'plain-events', id: key }, { reveal: 1 }); } catch { /* källan ej redo */ }
            revealWrittenRef.current.set(key, 1);
        };
        revealSeedRef.current.forEach(light);
        revealStickyRef.current.forEach(light); // klickade brickor stannar tända
    }, []);
    reapplyAllRevealRef.current = reapplyAllReveal;

    // Avslöjning sker BARA via vilo-uppsättningen (seed): de ~10 närmast mitten vid
    // start, eller de REVEAL_NEAREST_COUNT närmaste KRING SENASTE TAP. INGEN hover-
    // följning längre — markörerna tänds bara där man trycker (mobil-vänligt) och
    // ligger kvar. Engångsskrivning per recompute/tap (ingen rAF-loop i vila).
    const pumpReveal = useCallback(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded() || !map.getLayer('plain-events')) { revealRafRef.current = null; return; }
        const seed = revealSeedRef.current;
        const sticky = revealStickyRef.current;
        const written = revealWrittenRef.current;
        const writeOp = (key: string, op: number) => {
            const prev = written.get(key);
            if (prev === undefined ? op > 0.0001 : Math.abs(op - prev) > 0.004) {
                try { map.setFeatureState({ source: 'plain-events', id: key }, { reveal: op }); } catch { /* */ }
                written.set(key, op);
            }
        };
        // Tänd vilo-uppsättningen + klickade (sticky) brickor, släck allt annat.
        seed.forEach(k => writeOp(k, 1));
        sticky.forEach(k => writeOp(k, 1));
        written.forEach((op, k) => { if (op > 0 && !seed.has(k) && !sticky.has(k)) writeOp(k, 0); });
        revealRafRef.current = null;
        reportRevealCount('vila');
    }, [reportRevealCount]);
    const ensureRevealPump = useCallback(() => {
        if (revealRafRef.current == null) revealRafRef.current = requestAnimationFrame(pumpReveal);
    }, [pumpReveal]);
    ensureRevealPumpRef.current = ensureRevealPump;

    // De n närmaste brickorna (nycklar) till en geo-punkt. Billigt partiellt urval
    // (kvadrerat avstånd, longitud cos-lat-skalad) — ingen full sortering, ingen
    // queryRenderedFeatures. Används av vandringen nedan.
    const nearestKeysTo = useCallback((lng: number, lat: number, n: number): Set<string> => {
        const coords = revealCoordsRef.current;
        const kx = Math.cos(lat * Math.PI / 180);
        const bestKey: string[] = [];
        const bestD2: number[] = [];
        let worst = -Infinity, worstIdx = -1;
        for (let i = 0; i < coords.length; i++) {
            const c = coords[i];
            const dx = kx * (c.lng - lng), dy = c.lat - lat;
            const d2 = dx * dx + dy * dy;
            if (bestKey.length < n) {
                bestKey.push(c.key); bestD2.push(d2);
                if (d2 > worst) { worst = d2; worstIdx = bestKey.length - 1; }
            } else if (d2 < worst) {
                bestKey[worstIdx] = c.key; bestD2[worstIdx] = d2;
                worst = -Infinity;
                for (let j = 0; j < n; j++) if (bestD2[j] > worst) { worst = bestD2[j]; worstIdx = j; }
            }
        }
        return new Set(bestKey);
    }, []);

    // PARALLELL MIGRATION: vid ett tryck "flyttar" de N brickorna sig mot klickpunkten
    // var och en i SIN EGEN takt (parallella körfält på olika nivåer): några skjuter i
    // väg och dyker upp längst fram nästan direkt, andra kryper — så att de vid varje
    // ögonblick ligger jämnt utspridda längs hela vägen, och ALLA till slut hamnar på
    // destinationen (de N närmast klicket). Illusionen skapas genom att tända event
    // längs en KORRIDOR från→till: varje körfält har en plats-index som glider framåt
    // med olika hastighet, och tänder eventet vid sitt index.
    const startRevealTravel = useCallback((toLng: number, toLat: number) => {
        const map = mapRef.current;
        if (!map || !map.getLayer('plain-events')) return;
        // Starta där klustret FAKTISKT står (smidigt vid avbrott), annars förra
        // destinationen / min-position / kartmitt.
        const from = revealMarchPtRef.current ?? revealAnchorPtRef.current ?? userPosRef.current ?? map.getCenter();
        const fromLng = from.lng, fromLat = from.lat;
        // Destinations-ankaret sätts DIREKT (moveend-skydd + recompute-origin).
        revealAnchorPtRef.current = { lng: toLng, lat: toLat };
        // Avbryt ev. pågående migration.
        if (revealTweenRef.current != null) { cancelAnimationFrame(revealTweenRef.current); revealTweenRef.current = null; }
        if (revealHoldTimerRef.current) { clearTimeout(revealHoldTimerRef.current); revealHoldTimerRef.current = null; }
        const written = revealWrittenRef.current;
        const sticky = revealStickyRef.current;
        const writeOp = (key: string, op: number) => {
            const prev = written.get(key);
            if (prev === undefined ? op > 0.0001 : Math.abs(op - prev) > 0.004) {
                try { map.setFeatureState({ source: 'plain-events', id: key }, { reveal: op }); } catch { /* */ }
                written.set(key, op);
            }
        };
        // Skriver fram exakt `keep`-mängden. Strömmen anropar den med `forceAll` varje frame:
        // tänd de N nuvarande positionerna, släck övriga DIREKT. Det blir ändå lugnt eftersom
        // varje bricka antingen står still vid origin, redan landat på destinationen (stannar),
        // eller bara passerar några få kvantiserade mellanstopp. (minLifeMs/litAt är kvar som
        // generell möjlighet men används inte av ström-modellen.)
        const litAt = new Map<string, number>();
        const reconcileLit = (keep: Set<string>, now: number, minLifeMs: number, forceAll = false) => {
            keep.forEach(k => { writeOp(k, 1); litAt.set(k, now); }); // i körfält → håll tänd + fräsch
            written.forEach((op, k) => {
                if (op <= 0.5 || keep.has(k) || sticky.has(k)) return;   // redan släckt / aktiv / valt event
                if (forceAll || now - (litAt.get(k) ?? 0) >= minLifeMs) { writeOp(k, 0); litAt.delete(k); }
            });
        };

        const N = REVEAL_NEAREST_COUNT;
        // Slutläget = de N närmast klicket.
        const destArr = [...nearestKeysTo(toLng, toLat, N)];
        const destSet = new Set(destArr);

        const p0 = map.project([fromLng, fromLat]);
        const p1 = map.project([toLng, toLat]);
        const pxDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

        const finish = (now: number) => {
            revealTweenRef.current = null;
            reconcileLit(destSet, now, 0, true);   // hård settle: bara destinationen kvar
            revealSeedRef.current = destSet;
            revealMarchPtRef.current = { lng: toLng, lat: toLat };
            reportRevealCount('migration klar');
        };

        // TVÅ FASER, ingen korridor av mellanliggande event:
        //   1) RESA — EN bricka glider från origin mot klicket, accelererande (easeIn, som
        //      ett magnetiskt sug). Bara den brickan är tänd; fältet är annars släckt.
        //   2) INSUG — vid framme dras destinationens event in mot punkten, närmast först,
        //      i en snabb accelererande kaskad (en, sen flera) tills alla N står på plats.
        // Reslängden (TRAVEL_MS) skalar med klick-avståndet på skärmen: kort hopp → den
        // MINDRE tiden, hela skärmen → den STÖRRE (ordningen på konstanterna spelar ingen roll).
        const cv = map.getCanvas();
        const screenPx = Math.hypot(cv.clientWidth, cv.clientHeight) || 1;
        const distFrac = Math.min(1, pxDist / screenPx);   // 0 = samma punkt, 1 = hela skärmen

        // Samma plats / knappt något avstånd → inget att resa, settla destinationen direkt.
        if (pxDist < 40) { finish(performance.now()); return; }

        const lo = Math.min(REVEAL_STREAM_MS, REVEAL_STREAM_MS_MAX);
        const hi = Math.max(REVEAL_STREAM_MS, REVEAL_STREAM_MS_MAX);
        const TRAVEL_MS = lo + (hi - lo) * distFrac;   // restid (kort hopp → lo, långt → hi)
        const SETTLE_MS = 650;                         // magnetisk insugning av destinationen
        const start = performance.now();
        const tick = () => {
            const m = mapRef.current;
            if (!m || !m.getLayer('plain-events')) { revealTweenRef.current = null; return; }
            const now = performance.now();
            const elapsed = now - start;
            if (elapsed < TRAVEL_MS) {
                // FAS 1 — en bricka åker mot målet, accelererande (easeIn = magnetiskt sug).
                const p = elapsed / TRAVEL_MS;
                const e2 = p * p;
                const lng = fromLng + (toLng - fromLng) * e2;
                const lat = fromLat + (toLat - fromLat) * e2;
                reconcileLit(new Set(nearestKeysTo(lng, lat, 1)), now, 0, true);
                revealMarchPtRef.current = { lng, lat };
                revealTweenRef.current = requestAnimationFrame(tick);
                return;
            }
            // FAS 2 — destinationen dras in närmast-klicket-först, accelererande (easeOut).
            const sp = Math.min(1, (elapsed - TRAVEL_MS) / SETTLE_MS);
            const eased = 1 - (1 - sp) * (1 - sp);
            const k = Math.max(1, Math.round(N * eased));
            reconcileLit(new Set(destArr.slice(0, k)), now, 0, true);
            revealMarchPtRef.current = { lng: toLng, lat: toLat };
            if (sp >= 1) { finish(now); }
            else { revealTweenRef.current = requestAnimationFrame(tick); }
        };
        revealTweenRef.current = requestAnimationFrame(tick);
    }, [nearestKeysTo, reportRevealCount]);
    startRevealTravelRef.current = startRevealTravel;

    // Välj seed = de REVEAL_SEED_COUNT markörerna närmast KARTANS MITT just nu.
    // Körs vid dataändring OCH efter varje move/zoom (moveend) + på 'load', så det
    // alltid finns ~10 synliga där man landar (även efter flyg till min-position).
    // Avståndet skalar longitud med cos(latitud) så det blir rätt på svenska breddgrader.
    const recomputeRevealSeed = useCallback(() => {
        const map = mapRef.current;
        // Utgångspunkt: tap-ankaret om man tryckt på kartan (mobil-vänligt), annars
        // kartans mitt. Ett tap visar fler brickor (REVEAL_NEAREST_COUNT) och låser
        // dem — panorering reseedar inte (se moveend-handlern).
        const anchor = revealAnchorPtRef.current;
        const count = anchor ? REVEAL_NEAREST_COUNT : REVEAL_SEED_COUNT;
        // Utgångspunkt utan tap = ANVÄNDARENS plats (om GPS hunnit komma), annars
        // kartmitten. Så default-eventen visas där man är, inte mitt i Sverige.
        const origin = anchor ?? userPosRef.current ?? (map ? map.getCenter() : null);
        const coords = new Map<string, [number, number]>();
        for (const f of plainFeaturesRef.current) coords.set(f.properties.key, f.geometry.coordinates);
        const allKeys = [...coords.keys()];
        // FÖRHANDSVISNING (före första trycket): visa ALLA event, inte bara de N närmast.
        // Gäller bara i vila (inget tap-ankare); ett tap kollapsar till normal-läget.
        let newSeed: Set<string>;
        if (previewAllUntilTapRef.current && !anchor) {
            newSeed = new Set(allKeys);
        } else {
            if (origin && allKeys.length > count) {
                const cl = origin.lng, ca = origin.lat;
                const kx = Math.cos(ca * Math.PI / 180);
                const d2 = (p: [number, number]) => (kx * (p[0] - cl)) ** 2 + (p[1] - ca) ** 2;
                allKeys.sort((a, b) => d2(coords.get(a)!) - d2(coords.get(b)!));
            }
            newSeed = new Set(allKeys.slice(0, count));
        }
        // Göm gamla seed-nycklar som inte längre är seed (men aldrig klickade/sticky).
        if (map && map.getLayer('plain-events')) {
            revealSeedRef.current.forEach(k => {
                if (!newSeed.has(k) && !revealStickyRef.current.has(k)) {
                    try { map.setFeatureState({ source: 'plain-events', id: k }, { reveal: 0 }); } catch { /* */ }
                    revealWrittenRef.current.delete(k);
                }
            });
        }
        revealSeedRef.current = newSeed;
        reapplyAllRevealRef.current();
        ensureRevealPumpRef.current();
    }, []);
    recomputeRevealSeedRef.current = recomputeRevealSeed;

    // GPS-platsen kommer asynkront efter laddning. När den dyker upp (och man inte
    // redan tryckt på kartan) → flytta default-avslöjningen till användarens plats
    // i stället för kartmitten (Östersund/mitt-Sverige).
    useEffect(() => {
        if (userPos && !revealAnchorPtRef.current) recomputeRevealSeedRef.current();
    }, [userPos]);

    // Pusha ny GL-data när de icke-speciella grupperna ELLER multi-event-prickarna
    // ändras. Väntar på att stilen är redo (annars finns ingen källa att skriva till).
    useEffect(() => {
        plainFeaturesRef.current = plainData.features;
        usedIconsRef.current = plainData.icons;
        multiEventDotFeaturesRef.current = multiEventDotData;
        // Platt koord-lista för "de N närmaste pekaren" (slipper bygga om varje frame).
        revealCoordsRef.current = plainData.features.map(f => ({
            key: f.properties.key, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
        }));
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) {
            syncPlainLayerRef.current();
        } else {
            const h = () => syncPlainLayerRef.current();
            map.once('style.load', h);
            return () => { map.off('style.load', h); };
        }
    }, [plainData, multiEventDotData]);

    // Håll reveal-systemet i synk med datan: rensa bort nycklar som inte längre
    // finns (inkl. MapLibres interna feature-state, så en återanvänd nyckel börjar
    // dold) och välj om seed via recomputeRevealSeed.
    useEffect(() => {
        const present = new Set(plainData.features.map(f => f.properties.key));
        const map = mapRef.current;
        const hasLayer = !!(map && map.getLayer('plain-events'));
        const drop = (k: string) => { if (hasLayer) { try { map!.removeFeatureState({ source: 'plain-events', id: k }); } catch { /* */ } } };
        for (const k of [...revealSeedRef.current]) if (!present.has(k)) { revealSeedRef.current.delete(k); drop(k); }
        // Sticky-nycklar vars event helt försvunnit ur datan rensas; en VALD bricka
        // saknas tillfälligt i plainData (den är DOM medan den är vald) men finns kvar
        // i groups → behåll den så den tänds igen i GL när den avmarkeras.
        for (const k of [...revealStickyRef.current]) if (!groupsRef.current.has(k)) revealStickyRef.current.delete(k);
        for (const k of [...revealWrittenRef.current.keys()]) if (!present.has(k)) { revealWrittenRef.current.delete(k); drop(k); }
        recomputeRevealSeedRef.current();
    }, [plainData]);

    // Tvinga fram det VALDA eventets GL-bricka oavsett var den ligger (även när
    // den inte är bland de N närmaste senaste tappet, t.ex. efter Nästa till ett
    // event långt bort). revealStickyRef tänds i reapplyAllReveal/pumpReveal och
    // släcks aldrig av seed-omräkningen → brickan man är "på" syns alltid. DOM-
    // markören med vit ram ligger ovanpå; faller den bort syns ändå GL-brickan.
    useEffect(() => {
        const sticky = revealStickyRef.current;
        sticky.clear();
        if (selectedEvent) {
            for (const [key, group] of groupsRef.current) {
                if (group.some(e => e.id === selectedEvent.id)) { sticky.add(key); break; }
            }
        }
        // Gillade (framtida) event hålls ALLTID tända (force-reveal) så deras vita GL-
        // bricka syns överallt — oavsett avslöjning, viewport eller vad som är valt.
        {
            const savedCutoff = Date.now() - 60 * 60 * 1000;
            for (const [key, group] of groupsRef.current) {
                if (group.some(e => savedEventIds.has(e.id) && e.time.getTime() >= savedCutoff)) sticky.add(key);
            }
        }
        reapplyAllRevealRef.current();
    }, [selectedEvent, savedEventIds, groups]);

    // ── Desyncad bildväxling för grupper med flera event på samma plats ───────
    // Tidigare bytte ALLA sådana grupper emoji på exakt samma 1-sekunderstick
    // (en synkad DOM-skur) OCH det triggade en full omsynk av varenda markör.
    // Nu sprider vi ut det: en sub-tick var 200 ms, och varje grupp får en fast
    // fas-offset utifrån sin nyckel → varje grupp byter ~1 gång/sekund men vid
    // olika tidpunkter, och bytet rör BARA den gruppens emoji (ingen omsynk).
    const visibleGroupsRef = useRef(visibleGroups);
    visibleGroupsRef.current = visibleGroups;
    const selectedEventValRef = useRef(selectedEvent);
    selectedEventValRef.current = selectedEvent;
    const discardedEventIdsRef = useRef(discardedEventIds);
    discardedEventIdsRef.current = discardedEventIds;
    useEffect(() => {
        const STEPS = 5; // 5 × 200 ms ≈ 1 s per bildbyte och grupp
        const phaseForKey = (key: string) => {
            let h = 0;
            for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
            return h % STEPS;
        };
        let sub = 0;
        const id = setInterval(() => {
            sub++;
            const sel = selectedEventValRef.current;
            const disc = discardedEventIdsRef.current;
            for (const [key, group] of visibleGroupsRef.current) {
                if (group.length <= 1) continue;
                if (sel && group.some(e => e.id === sel.id)) continue; // valt sköts av synken
                const md = markersRef.current.get(key);
                if (!md) continue;
                const nonDiscarded = group.filter(e => !disc.has(e.id));
                if (nonDiscarded.length === 0) continue;
                const step = Math.floor((sub + phaseForKey(key)) / STEPS);
                const cur = nonDiscarded[step % nonDiscarded.length];
                // Uppdatera bara när den faktiskt visade gruppmedlemmen byts —
                // billigt, och klickmålet följer den som visas just nu.
                if (md.element.dataset.cycleId === cur.id) continue;
                md.element.dataset.cycleId = cur.id;
                const catKey = cur.category && EVENT_CATEGORIES[cur.category] ? cur.category : 'other';
                const emoji = cur.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');
                const emojiEl = md.element.querySelector('.pin-emoji');
                if (emojiEl && emojiEl.textContent !== emoji) emojiEl.textContent = emoji;
                // Låt brickans kropp följa det event som visas just nu — annars
                // frös färgen på gruppens första event. Fasta tillstånd (guld/
                // sparad) äger färgen och markeras med catCycle !== '1'.
                if (md.element.dataset.catCycle === '1') {
                    const bubble = md.element.querySelector('.pin-bubble') as HTMLElement | null;
                    if (bubble) bubble.style.background = brickaBodyBg(cur);
                }
                md.element.onclick = (e) => {
                    e.stopPropagation();
                    onSelectEventRef.current(cur);
                };
            }
        }, 200);
        return () => clearInterval(id);
    }, []);

    // Spårar ORDNINGEN man bläddrat genom den valda gruppen, så grupp-markörens
    // siffra speglar din position (Nästa → mindre, Bakåt → större). Nollställs
    // när man byter grupp. (Ett event som man går tillbaka till finns redan i
    // listan → ordningen ändras inte, men index/siffran följer det valda.)
    const visitedOrderRef = useRef<string[]>([]);
    const visitedGroupKeyRef = useRef<string | null>(null);
    useEffect(() => {
        const map = mapRef.current;
        if (!selectedEvent || selectedEvent.lat == null || selectedEvent.lng == null) {
            visitedOrderRef.current = [];
            visitedGroupKeyRef.current = null;
            setGroupList(null);
            setGroupListAnchor(null);
            return;
        }
        const gk = `${selectedEvent.lat.toFixed(4)},${selectedEvent.lng.toFixed(4)}`;
        if (gk !== visitedGroupKeyRef.current) {
            visitedGroupKeyRef.current = gk;
            visitedOrderRef.current = [selectedEvent.id];
        } else if (!visitedOrderRef.current.includes(selectedEvent.id)) {
            visitedOrderRef.current.push(selectedEvent.id);
        }

        // Öppna automatiskt multi-event-listan om det valda eventet ingår i en grupp med flera event
        const group = groups.get(gk);
        if (group && group.length > 1) {
            setGroupList(group);
            setGroupListAnchor({ lng: selectedEvent.lng, lat: selectedEvent.lat });
            if (map) {
                setGroupListPos(map.project([selectedEvent.lng, selectedEvent.lat]));
            }
        } else {
            setGroupList(null);
            setGroupListAnchor(null);
        }
    }, [selectedEvent, groups]);

    // 1. Initiera MapLibre kartan en gång
    useEffect(() => {
        if (!mapContainerRef.current) return;

        let map: maplibregl.Map;
        try {
        map = new maplibregl.Map({
            container: mapContainerRef.current,
            // Bootstrap-stil: en synkron enfärgad bakgrund i nöjesfältets land-färg
            // så kartan renderar direkt. mapStyle-effekten byter sedan till förvald
            // 'themepark' (async fetch + transform) efter mount. Bakgrundsfärgen
            // matchar themeparken → bytet syns inte som ett hopp (jfr. tidigare
            // satellit-bootstrap som blixtrade förbi en satellitvy).
            style: BOOTSTRAP_STYLE,
            // Startvy: södra Sverige (Skåne syns), mer inzoomad — se START_CENTER/_ZOOM.
            // Vid start finns ändå inga avslöjade event, så en tightare sydlig vy känns
            // mindre tom och landar nära där de flesta användarna faktiskt är.
            center: START_CENTER,
            zoom: START_ZOOM,
            // Hur långt man får zooma UT. Utan gräns kan man zooma ut till hela
            // världen (zoom 0) vilket kraschar appen — massor av tiles gör att
            // WebGL tappar renderingskontexten. 4 ≈ hela Sverige i bild: gott om
            // kontext men utan den minnestunga kontinent-/världsvyn som dödar GPU:n.
            minZoom: 4,
            // ── Minnestak för tile-cachen ──────────────────────────────────
            // Satellitvyn använder TVÅ raster-källor (bilder + etiketter). Varje
            // 256px-tile blir en GPU-textur (~256 KB). Utan tak växer cachen
            // obegränsat ju mer man pannar/zoomar ("ju mer av kartan man läser
            // in") → minnet drar iväg mot ~600 MB. Vi sätter ett hårt tak per
            // källa och behåller färre zoom-nivåer (default 5) så cachen trimmas
            // löpande i stället för att ackumulera.
            maxTileCacheSize: 80,
            maxTileCacheZoomLevels: 3,
            // Ladda inte om utgångna tiles i bakgrunden — sparar både nät och
            // minne (gamla texturer hålls inte kvar i väntan på refresh).
            refreshExpiredTiles: false,
            // Lägg INTE till default-attributionen automatiskt. På breda skärmar
            // renderas den som en utfälld textrad ("MapLibre | © CARTO …") längst
            // ner — vi vill i stället ha en egen i compact-läge (liten ⓘ-knapp) som
            // läggs till direkt efter init nedan.
            attributionControl: false
        });
        } catch (err) {
            // WebGL kunde inte initieras (ofta "blocked" efter en tidigare
            // kontextförlust). Krascha inte hela appen — visa fallback i stället.
            console.error('Kartan kunde inte initieras (WebGL)', err);
            setMapError(true);
            return;
        }

        mapRef.current = map;

        // Egen attribution: alltid compact (en liten ⓘ-knapp i hörnet i stället för
        // en utfälld textrad). Attributionen MÅSTE finnas kvar — CARTO och
        // OpenStreetMap kräver den juridiskt — men den behöver inte stå utfälld.
        map.addControl(new maplibregl.AttributionControl({ compact: true }));

        // MapLibre's compact-attribution öppnar sig SJÄLV ('maplibregl-compact-show'
        // + <details open>) varje gång compact-läget (åter)etableras under
        // inladdningen — vid första resizen och vid stilbytet bootstrap→themepark. En
        // engångs-collapse vinner därför en kapplöpning ibland och förlorar ibland. Vi
        // håller den hopfälld med en observer tills kartan blivit idle; därefter slutar
        // MapLibre toggla själv och användarens klick på ikonen får expandera den fritt.
        const attribEl = mapContainerRef.current?.querySelector('details.maplibregl-ctrl-attrib');
        let attribObserver: MutationObserver | null = null;
        if (attribEl instanceof HTMLDetailsElement) {
            const collapseAttrib = () => {
                if (attribEl.open || attribEl.classList.contains('maplibregl-compact-show')) {
                    attribEl.open = false;
                    attribEl.classList.remove('maplibregl-compact-show');
                }
            };
            collapseAttrib();
            attribObserver = new MutationObserver(collapseAttrib);
            attribObserver.observe(attribEl, { attributes: true, attributeFilter: ['open', 'class'] });
            map.once('idle', () => { attribObserver?.disconnect(); attribObserver = null; });
        }


        let glCanvas: HTMLCanvasElement | null = null;
        let onCtxLost: ((e: Event) => void) | null = null;
        let onCtxRestored: (() => void) | null = null;
        try {
            glCanvas = map.getCanvas();
            if (!glCanvas) {
                console.error('Kartan kunde inte hämta WebGL-canvas.');
                setMapError(true);
                return;
            }
            onCtxLost = (e: Event) => {
                e.preventDefault();
                console.error('WebGL-kontext förlorad, visar felsida.');
                setMapError(true);
            };
            onCtxRestored = () => { try { map.triggerRepaint(); } catch { /* noop */ } };
            glCanvas.addEventListener('webglcontextlost', onCtxLost as EventListener, false);
            glCanvas.addEventListener('webglcontextrestored', onCtxRestored as EventListener, false);
        } catch (postErr) {
            console.error('Krasch under kartinitiering (WebGL canvas):', postErr);
            setMapError(true);
            return;
        }

        // Zoom-klasshantering: under zoom-gesten fälls allt till nålar/prickar
        // (billigt), i vila visas brickorna. DOM-brickorna växlar via CSS-klassen;
        // GL-lagret växlar mellan symbol-lagret (brickor) och cirkel-lagret
        // (prickar). I vila syns ALLA brickor på alla zoomnivåer.
        const container = mapContainerRef.current;
        const setGlLayer = (id: string, visible: boolean) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        };
        const showNeedles = () => {
            container.classList.remove('map-state-full');
            container.classList.add('map-state-needle');
            setGlLayer('plain-events', false);
            setGlLayer('plain-events-dots', true);
        };
        const showBricks = () => {
            container.classList.remove('map-state-needle');
            container.classList.add('map-state-full');
            setGlLayer('plain-events', true);
            // Prickarna göms INTE här — då blir det ett tomt glapp medan symbol-lagret
            // (brickorna) placerar sina ikoner. De ligger kvar tills exitZooming, dvs
            // när zoomen tystnat OCH brickorna hunnit ritas. Så syns alltid något.
        };

        map.on('zoomstart', showNeedles);
        map.on('zoomend', showBricks);

        // ── Multi-event: prick UNDER zoom-gesten, DOM-bricka i vila ───────────────
        // VILO-läget är ALLTID DOM (isZooming=false). Vi förlitar oss INTE på att
        // 'zoomend' fyras (den kan missas vid avbrutna animationer → tidigare bugg där
        // brickorna försvann i vila). I stället: varje zoom-aktivitet markerar "zoomar"
        // + (om)startar en kort vilo-timer. När zoomen tystnat 180 ms → tillbaka till
        // DOM. Prick-lagrens synlighet växlas SYNKRONT (instant, ingen worker-runda)
        // så prick och DOM aldrig överlappar. Ren pan (idle-drift) fyrar inga zoom-
        // events → triggar aldrig prickläget.
        let zoomIdleTimer: ReturnType<typeof setTimeout> | null = null;
        // Göm nål-prickarna FÖRST när brickorna FAKTISKT ritats. 'idle' fyras när
        // kartan ritat klart allt som efterfrågats (ikoner bakade + symboler placerade)
        // — så prickarna kan aldrig försvinna INNAN brickorna syns. Fallback-timeout om
        // idle dröjer (långsamma tiles); hoppar om en ny zoom hunnit börja.
        const hideNeedleDotsWhenRendered = () => {
            const m = mapRef.current;
            if (!m) return;
            const finish = () => { if (!isZoomingRef.current) setGlLayer('plain-events-dots', false); };
            m.once('idle', finish);
            setTimeout(finish, 1500);
        };
        const exitZooming = () => {
            zoomIdleTimer = null;
            isZoomingRef.current = false;
            setGlLayer('plain-events', true);            // brickorna ska vara tända i vila
            setGlLayer('multi-event-dots', false);
            setGlLayer('multi-event-dots-count', false);
            setIsZooming(false);
            hideNeedleDotsWhenRendered();                // prickarna kvar tills brickorna ritats
        };
        const markZooming = () => {
            if (zoomIdleTimer) { clearTimeout(zoomIdleTimer); zoomIdleTimer = null; }
            if (!isZoomingRef.current) {
                isZoomingRef.current = true;
                setGlLayer('multi-event-dots', true);
                setGlLayer('multi-event-dots-count', true);
                setIsZooming(true);
            }
            // Auto-exit en kort stund efter SISTA zoom-aktiviteten (robust även om
            // 'zoomend' aldrig kommer) → vilo-läget faller alltid tillbaka till DOM.
            zoomIdleTimer = setTimeout(exitZooming, 180);
        };
        map.on('zoomstart', markZooming);
        map.on('zoom', markZooming);
        map.on('zoomend', markZooming);
        // Extra säkerhetsnät: när ALL rörelse (pan/zoom) lagt sig fyras 'moveend' →
        // tvinga tillbaka vilo-läget (DOM-brickor). Garanterar att isZooming aldrig
        // fastnar i true om en zoom-animation byts ut innan 180 ms-timern hann gå.
        // I vila är detta en no-op (redan false), så ingen flimmer/extra omritning.
        map.on('moveend', exitZooming);

        // GL-lager som är klickbara: brickorna (inzoomat) + prickarna (utzoomat) +
        // multi-event-prickarna. Klick på en multi-prick väljer gruppens första event
        // (onGlMarkerClick slår upp gruppen via feature-properties.key).
        const glHitLayers = ['plain-events', 'plain-events-dots', 'multi-event-dots'];
        const glLayersPresent = () => glHitLayers.filter(id => map.getLayer(id));

        map.on('click', (e) => {
            // FÖRHANDSVISNING → NORMAL: vid FÖRSTA trycket på kartan slutar vi visa
            // ALLA event och kollapsar till de N närmast trycket (resten tonas bort).
            // Ankaret sätts till trycket så recompute (och ev. startRevealTravel nedan,
            // vars from == to då → direkt-settle) ger samma N-uppsättning utan dubbel
            // animation. Ett tryck på en SYNLIG bricka (nu = valfri) väljer ändå eventet
            // via lager-handlern; mängden krymper till de närmaste.
            if (previewAllUntilTapRef.current) {
                previewAllUntilTapRef.current = false;
                revealAnchorPtRef.current = { lng: e.lngLat.lng, lat: e.lngLat.lat };
                recomputeRevealSeedRef.current();
            }
            // Klick på en SYNLIG GL-markör hanteras av lager-handlern nedan (väljer
            // eventet) — avmarkera/avslöja då inte. En DOLD bricka (icon-opacity 0)
            // är fortfarande träffbar i queryRenderedFeatures men ska INTE gå att
            // klicka direkt: första trycket på ett gömt område avslöjar bara. Vi
            // räknar därför bara hit på AVSLÖJADE plain-events-brickor som "markör".
            const layers = glLayersPresent();
            if (layers.length) {
                const hits = map.queryRenderedFeatures(e.point, { layers });
                const hitVisibleMarker = hits.some(h => {
                    if (h.layer.id === 'plain-events' || h.layer.id === 'plain-events-dots') {
                        const key = h.properties?.key as string | undefined;
                        // Faktiskt renderat tillstånd (ground truth), inte write-cachen —
                        // annars kunde en SYNLIG bricka råka klassas som dold → klicket
                        // gick till avslöjning/bro i stället för att öppna (brickan "försvann").
                        return !!key && ((map.getFeatureState({ source: 'plain-events', id: key }).reveal as number ?? 0) > 0.5);
                    }
                    return true; // andra lager (t.ex. multi-event-dots) — alltid klickbara
                });
                if (hitVisibleMarker) return;
            }
            // Tom karta-tap (eller bara dolda brickor under fingret) = ny utgångspunkt:
            // bron byter ut den avslöjade uppsättningen mot de N närmast klicket. Klick
            // PÅ tom karta (ej på en markör) STÄNGER också ev. öppet eventkort + listan.
            setGroupList(null);            // stäng ev. öppen multi-event-lista
            setGroupListAnchor(null);
            onSelectEventRef.current(null); // stäng eventkortet (klick utanför markör)
            startRevealTravelRef.current(e.lngLat.lng, e.lngLat.lat);
        });

        // GL-markör/prick klickad → välj eventet (eller gissa i spelläget). Handlern
        // registreras en gång; den matchar lagret så fort det (åter)installerats.
        const onGlMarkerClick = (e: maplibregl.MapLayerMouseEvent) => {
            // Plocka rätt bricka bland ALLA träffar under fingret — inte bara
            // features[0] (då snodde en dold/enskild granne klicket: den "döda
            // klick"-buggen). Två regler, i ordning:
            //   1) bara AVSLÖJADE brickor är valbara (dolda ska skrapas fram av det
            //      allmänna klicket, inte öppnas direkt) — multi-event-dots o.d. är
            //      alltid valbara.
            //   2) bland de valbara vinner den med FLEST event (count) — samma
            //      prioritet som z-staplingen, så en fler-event-bricka aldrig
            //      förlorar klicket till en enskild bricka som råkar ligga under.
            const candidates = (e.features ?? []).filter(f => {
                const lid = f.layer?.id;
                if (lid === 'plain-events' || lid === 'plain-events-dots') {
                    const k = f.properties?.key as string | undefined;
                    return !!k && ((map.getFeatureState({ source: 'plain-events', id: k }).reveal as number ?? 0) > 0.5);
                }
                return true;
            });
            // Bara dolda brickor under fingret → låt det allmänna klicket avslöja.
            if (candidates.length === 0) return;
            // Ikonens träffyta (omslutande kvadrat) är STÖRRE än den synliga romb-brickan,
            // så tätt packade brickor får överlappande hit-boxar. Välj den vars MITT
            // ligger närmast där man faktiskt tryckte → varje bricka går att peta på,
            // även i ett kluster. Brickan är botten-ankrad (kroppen sitter en bit OVANFÖR
            // geopunkten), så jämför mot en punkt en bit ned från brick-kroppen.
            const ANCHOR_LIFT_PX = 28;
            const qx = e.point.x, qy = e.point.y + ANCHOR_LIFT_PX;
            const ranked = candidates.map(f => {
                const c = (f.geometry as GeoJSON.Point | undefined)?.coordinates;
                const pp = c ? map.project([c[0], c[1]]) : null;
                const d = pp ? Math.hypot(pp.x - qx, pp.y - qy) : 1e9;
                return { f, d, count: Number(f.properties?.count) || 1 };
            });
            // Närmast vinner; ligger två i princip lika nära (≤3px) avgör flest event.
            ranked.sort((a, b) => (Math.abs(a.d - b.d) > 3 ? a.d - b.d : b.count - a.count));
            const key = ranked[0].f.properties?.key as string | undefined;
            const group = key ? groupsRef.current.get(key) : undefined;
            if (!group || group.length === 0) return;
            // FLERA event på samma plats → öppna en LISTA (emoji + titel + tid) så man
            // kan välja vilket. Ett enda event → öppna direkt.
            if (group.length > 1) {
                const rep = group.find(e => e.id === selectedEventValRef.current?.id) || group[0];
                // Ankra listan vid brickans geo-punkt (projiceras i updateCloudPosition).
                if (isValidLatLng(rep.lat, rep.lng)) {
                    setGroupListAnchor({ lng: rep.lng!, lat: rep.lat! });
                    setGroupListPos(map.project([rep.lng!, rep.lat!]));
                } else {
                    setGroupListAnchor(null);
                    setGroupListPos(null);
                }
                setGroupList(group);
                onSelectEventRef.current(rep);
                return;
            }
            setGroupList(null);
            setGroupListAnchor(null);
            onSelectEventRef.current(group[0]);
        };
        const setPointer = () => { const c = map.getCanvas(); if (c) c.style.cursor = 'pointer'; };
        const clearPointer = () => { const c = map.getCanvas(); if (c) c.style.cursor = ''; };
        glHitLayers.forEach(id => {
            map.on('click', id, onGlMarkerClick);
            map.on('mouseenter', id, setPointer);
            map.on('mouseleave', id, clearPointer);
        });

        map.on('drag', () => {
            if (onMapDragRef.current) {
                onMapDragRef.current();
            }
        });

        // Real-time projection updater: håller multi-event-listan fastnitad vid
        // sin brickas geo-punkt när kartan pannas/zoomas.
        const updateCloudPosition = () => {
            // Multi-event-listan: håll dess skärmposition fast vid brickans geo-punkt
            // när kartan pannas/zoomas, så den stannar i brickans övre högra hörn.
            const ga = groupListAnchorRef.current;
            if (ga) {
                const pos = map.project([ga.lng, ga.lat]);
                setGroupListPos((prev) =>
                    prev && Math.round(prev.x) === Math.round(pos.x) && Math.round(prev.y) === Math.round(pos.y)
                        ? prev : { x: pos.x, y: pos.y });
            }
        };

        map.on('move', updateCloudPosition);
        map.on('zoom', updateCloudPosition);

        // Uppdatera synliga bounds + center-callback. THROTTLAD: idle-driftens
        // panBy fyrar 'moveend' ~60fps och setMapBounds triggar marker-omsync —
        // kör därför som mest ~var 200ms (≈5x/sek) i stället för varje frame.
        let moveEndTimer: ReturnType<typeof setTimeout> | null = null;
        let moveEndLastAt = 0;
        const applyBounds = () => {
            moveEndLastAt = performance.now();
            setMapBounds(map.getBounds());
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
        };
        const handleMoveEnd = () => {
            const since = performance.now() - moveEndLastAt;
            if (since >= 200) {
                if (moveEndTimer) { clearTimeout(moveEndTimer); moveEndTimer = null; }
                applyBounds();
            } else if (!moveEndTimer) {
                moveEndTimer = setTimeout(() => { moveEndTimer = null; applyBounds(); }, 200 - since);
            }
        };

        map.on('moveend', handleMoveEnd);

        // Rapportera initialt läge
        map.once('load', () => {
            setMapBounds(map.getBounds());
            updateCloudPosition();
            // Installera GL-markörlagret + pusha första datan.
            syncPlainLayerRef.current();
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
            // Startvy: hämta användarens plats (platstjänst) men ZOOMA INTE in dit —
            // vi vill se HELA Sverige när sidan öppnas. Vi sätter bara userPos så den
            // blå plats-pricken visar var man är; kameran står kvar på standardvyn
            // (mitt-Sverige, zoom 5). Nekad/timeout → ingen prick, samma vy.
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => { /* nekad/timeout → ingen plats-prick, behåll Sverige-vyn */ },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
                );
            }
            // INGEN reseed på moveend. Avslöjningen drivs BARA av tryck (map 'click' →
            // startRevealTravel) + ett initialt seed nedan. Förut reseedade moveend till
            // "~10 närmast mitten" så fort kartan rörde sig — och moln-driften fyrar
            // moveend hela tiden → de 30 man klickat fram försvann och ersattes av ~10
            // nära mitten/min-position. Borttaget: panorering/drift ändrar inte urvalet.
            // Initialt: FÖRHANDSVISA alla event (previewAllUntilTapRef=true → seed =
            // alla nycklar). Vid första trycket kollapsar det till de N närmast trycket.
            recomputeRevealSeedRef.current();
        });

        return () => {
            if (attribObserver) attribObserver.disconnect();
            if (moveEndTimer) clearTimeout(moveEndTimer);
            if (zoomIdleTimer) clearTimeout(zoomIdleTimer);
            if (glCanvas && onCtxLost) glCanvas.removeEventListener('webglcontextlost', onCtxLost as EventListener);
            if (glCanvas && onCtxRestored) glCanvas.removeEventListener('webglcontextrestored', onCtxRestored as EventListener);
            // Reveal: lyssnare + rAF (vilo-skrivning + vandring).
            if (revealCleanupRef.current) { revealCleanupRef.current(); revealCleanupRef.current = null; }
            if (revealRafRef.current != null) { cancelAnimationFrame(revealRafRef.current); revealRafRef.current = null; }
            if (revealTweenRef.current != null) { cancelAnimationFrame(revealTweenRef.current); revealTweenRef.current = null; }
            if (revealHoldTimerRef.current) { clearTimeout(revealHoldTimerRef.current); revealHoldTimerRef.current = null; }
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Kör fn så snart kartans stil är redo (annars går addSource/setTerrain fel).
    const runWhenStyleReady = (fn: (map: maplibregl.Map) => void) => {
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) fn(map);
        else map.once('style.load', () => fn(map));
    };

    // Byt baskartan när användaren togglar satellit-knappen. Markörerna ligger som
    // DOM-element i container och påverkas inte av setStyle.
    useEffect(() => {
        // Spegla aktiv kartstil som klass på containern så markör-CSS:en kan
        // anpassa kontrast per stil (se .map-style-dark-reglerna).
        const container = mapContainerRef.current;
        if (container) {
            container.classList.remove('map-style-streets', 'map-style-satellite', 'map-style-themepark', 'map-style-dark', 'map-style-orientering');
            container.classList.add(`map-style-${mapStyle}`);
        }
        const map = mapRef.current;
        if (!map) return;
        // setStyle ersätter HELA stilen → projektionen nollställs och custom-källor
        // (DEM) försvinner. Återställ globe + terräng när nya stilen laddat klart.
        const afterLoad = () => {
            applyProjection(map, isGlobeRef.current);
            applyTerrain(map, is3DTerrainRef.current);
            // Orienterings-reliefen lever bara i den stilen; setStyle har redan
            // rensat ett ev. gammalt lager, så vi behöver bara lägga till det igen.
            applyHillshade(map, mapStyleRef.current === 'orientering');
            // setStyle rensade GL-markörlagret (källa/bilder/lager) — återinstallera.
            syncPlainLayerRef.current();
        };
        const applyStyle = (style: string | maplibregl.StyleSpecification) => {
            map.setStyle(style);
            map.once('style.load', afterLoad);
        };
        if (mapStyle === 'satellite') {
            applyStyle(SATELLITE_STYLE);
        } else if (mapStyle === 'themepark') {
            // Nöjesfälts-kartan: Voyager i en mildare, naturlig palett. Hämta +
            // transformera en gång, cacha sedan i themeParkStyleRef.
            if (themeParkStyleRef.current) {
                applyStyle(themeParkStyleRef.current);
            } else {
                fetchAndTransformThemeParkStyle()
                    .then(style => {
                        themeParkStyleRef.current = style;
                        // Användaren kan ha hunnit byta stil under hämtningen —
                        // applicera bara om nöjesfält fortfarande är valt.
                        if (mapStyleRef.current === 'themepark') applyStyle(style);
                    })
                    .catch(() => {
                        // Faller tillbaka till vanliga Voyager om hämtningen strular.
                        if (mapStyleRef.current === 'themepark') applyStyle(STREETS_STYLE_URL);
                    });
            }
        } else if (mapStyle === 'dark') {
            applyStyle(DARK_STYLE_URL);
        } else if (mapStyle === 'orientering') {
            // Ljus Voyager-bas + hillshade-relief (läggs på i afterLoad).
            applyStyle(STREETS_STYLE_URL);
        } else {
            applyStyle(STREETS_STYLE_URL);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapStyle]);

    // Globe-läge: skifta projektion mercator ↔ globe. Helt fristående toggle.
    useEffect(() => {
        runWhenStyleReady(map => applyProjection(map, isGlobe));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobe]);

    // 3D-terräng: fristående toggle. Lägger till/tar bort DEM-källan + terräng-mesh.
    useEffect(() => {
        runWhenStyleReady(map => applyTerrain(map, is3DTerrain));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is3DTerrain]);


    // Tidsstämpel som idle-driften ska hålla sig pausad till. Sätts av våra egna
    // programmatiska kamera-flytt (easeTo) så driften inte slåss mot centreringen.
    const driftSuppressUntilRef = useRef(0);

    // Mjuk idle-drift: när användaren inte rört kartan på en stund driver vi
    // den långsamt i sinus-bana så bilden lever. Pausas direkt vid interaktion
    // OCH under våra egna kamera-flytt (driftSuppressUntilRef).
    // Idle-driften AVSTÄNGD: användaren vill att kartan står still från start
    // (ingen intro-puls, ingen grunddrift). Flaggan (typad boolean så TS inte
    // flaggar resten som död kod) gör det lätt att återaktivera om vi vill.
    const IDLE_DRIFT_ENABLED: boolean = false;
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!IDLE_DRIFT_ENABLED) return;
        // Respektera prefers-reduced-motion OCH spara resurser: hoppa över hela
        // idle-driften om användaren bett om mindre rörelse. Driften kör en RAF
        // i all evighet + setState varje frame för moln-projektionen; i ett
        // framtida 3D-läge (globe/terräng) blir varje frame dessutom en omritning
        // av hela scenen, så det här är billig huvudvärk att slippa.
        if (typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        let raf = 0;
        let interactingUntil = 0;
        // startedAt nollställs ALDRIG efter init — vågens fas är kontinuerlig
        // över pauser så driften aldrig "snäpper" till en ny startposition när
        // den återupptas. Boost-envelopen löper bara på den initiala starten.
        const startedAt = performance.now();
        let last = { x: 0, y: 0 };
        // Tidpunkt då aktuell paus slutade. Används för att fade-ina drift-
        // amplituden över ~1s istället för att klippa in direkt — så man inte
        // ser ett "hack" precis efter att man släppt kartan.
        let resumeAt = startedAt;
        let wasPaused = false;
        const pause = () => { interactingUntil = performance.now() + 2500; };
        map.on('dragstart', pause);
        map.on('drag', pause);        // förläng pausen under HELA draget (annars motas långa drag av driften)
        map.on('zoomstart', pause);
        map.on('rotatestart', pause);
        map.on('pitchstart', pause);
        // Pausa direkt vid beröring (innan dragstart hinner fyras), så driften
        // aldrig slåss med att man börjar dra kartan.
        const canvas = map.getCanvasContainer();
        if (canvas) canvas.addEventListener('pointerdown', pause);
        const tick = (now: number) => {
            // Pausa driften i 3D-läge (globe/terräng): där tvingar varje panBy en
            // omritning av hela 3D-scenen (terräng-mesh m.m.) → klart dyrare än i
            // platt vy. 3D känns dessutom levande ändå. Den lilla grunddriften är
            // bara värd sin kostnad i den platta vyn.
            const isPaused = now < interactingUntil || now < driftSuppressUntilRef.current
                || document.hidden || isGlobeRef.current || is3DTerrainRef.current;
            if (!isPaused) {
                const t = (now - startedAt) / 1000;
                // Driften = ENBART en stor dämpad initial puls (intro-rörelsen i
                // början). Pulsen använder sin() → startar och oscillerar runt 0
                // (ingen kumulativ förskjutning) och dör ut på ~6s (τ=2.5).
                // DÄREFTER står kartan HELT STILLA — ingen konstant grunddrift mer.
                const pulse = Math.exp(-t / 2.5);
                // Initial puls — stora svep i tre frekvenser för chaotisk vind.
                const pulseX = (Math.sin(t * 0.85) * 70 + Math.sin(t * 0.42) * 50 + Math.sin(t * 1.30) * 30) * pulse;
                const pulseY = (Math.sin(t * 0.71) * 45 + Math.sin(t * 0.33) * 32 + Math.sin(t * 1.10) * 18) * pulse;
                const targetX = pulseX;
                const targetY = pulseY;
                // Första frame efter paus: synka last till vågens nuvarande
                // position så dx=0 → ingen abrupt panBy. Fasen löper vidare
                // under pausen, så vi tar bara vid där vi "skulle ha varit".
                if (wasPaused) {
                    last = { x: targetX, y: targetY };
                    resumeAt = now;
                    wasPaused = false;
                }
                // Fade-in efter återupptagning: 0 → 1 över 1s, ease-out.
                const sinceResume = (now - resumeAt) / 1000;
                const fade = Math.min(1, sinceResume / 1.0);
                const eased = 1 - Math.pow(1 - fade, 3);
                const dx = (targetX - last.x) * eased;
                const dy = (targetY - last.y) * eased;
                if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                    map.panBy([dx, dy], { duration: 0, animate: false });
                }
                // last följer vågen i fullt belopp så fasen är intakt; bara
                // applicerad delta dämpas under fade-in.
                last = { x: targetX, y: targetY };
            } else {
                wasPaused = true;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            map.off('dragstart', pause);
            map.off('drag', pause);
            map.off('zoomstart', pause);
            map.off('rotatestart', pause);
            map.off('pitchstart', pause);
            if (canvas) canvas.removeEventListener('pointerdown', pause);
        };
    }, []);

    // Vid val av event: stå kvar där användaren är. Klickar man på en markör som
    // redan syns i vyn flyttar vi INTE kameran alls (och zoomar definitivt inte in).
    // Bara om det valda eventet ligger UTANFÖR vyn (t.ex. valt via sök/sparat/delad
    // länk) panorerar vi dit så kortet inte pekar på något man inte ser — och då på
    // SAMMA zoomnivå (vi zoomar aldrig in). Recenter-/Fokus-knappen är separat.
    const recenterOnSelected = () => {
        const map = mapRef.current;
        if (!map) return;
        if (!selectedEvent || !selectedEvent.lat || !selectedEvent.lng) return;

        // Vi vill ALLTID se den valda eventbrickan (så man vet vilket event man är
        // på) — men utan att zooma in. Är brickan redan synlig i den ANVÄNDBARA ytan
        // (ovanför kortet i nederkant, under navbaren upptill) → stå still. Bara om
        // den är dold (bakom kortet eller helt utanför vyn) panorerar vi dit — och då
        // på SAMMA zoomnivå (aldrig inzoomning).
        const cont = map.getContainer();
        const h = cont.clientHeight, w = cont.clientWidth;
        const p = map.project([selectedEvent.lng, selectedEvent.lat]);
        // Hur stor del av nederkanten kortet ungefär täcker (utfällt täcker mer).
        const cardBottom = h * (cardExpanded ? 0.58 : 0.42);
        // Panorera bara UPP när brickan är dold BAKOM kortet (nederkanten) eller helt
        // utanför vyn — INTE nedåt bara för att den är nära toppen. Förut räknades
        // översta 12% som "dold" → en bricka nära navbaren hoppade nedåt vid klick
        // (det användaren märkte). topMargin=0 ⇒ inga down-hopp för synliga brickor.
        const visibleAboveCard =
            p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= (h - cardBottom);
        if (visibleAboveCard) return;

        // Dold → panorera så brickan hamnar i den synliga ytan ovanför kortet
        // (behåll nuvarande zoom, ingen inzoomning).
        const targetYRatio = cardExpanded ? 0.30 : 0.40;
        const yOffset = h * (targetYRatio - 0.5);
        driftSuppressUntilRef.current = performance.now() + 1500;
        map.easeTo({
            center: [selectedEvent.lng, selectedEvent.lat],
            zoom: map.getZoom(),
            offset: [0, yOffset],
            duration: 500
        });
    };

    // Dagbyte: stå still. När daySwitchNonce bumpas öppnar vi ett kort fönster där
    // val-effekten nedan INTE flyttar kameran (täcker både select-bytet och att
    // kortet öppnas direkt efteråt). Måste deklareras FÖRE val-effekten så den
    // hinner sätta fönstret innan val-effekten körs samma commit. Recenter-KNAPPEN
    // går via recenterOnSelected direkt och påverkas inte. (suppressAutoRecenterUntilRef
    // deklareras längre upp, vid reveal-refsen.)
    const prevDaySwitchNonceRef = useRef(daySwitchNonce);
    useEffect(() => {
        if (daySwitchNonce !== prevDaySwitchNonceRef.current) {
            prevDaySwitchNonceRef.current = daySwitchNonce;
            suppressAutoRecenterUntilRef.current = performance.now() + 1500;
        }
    }, [daySwitchNonce]);

    // Intern kort-navigering (Nästa/Föregående/svep): VISA markören man bläddrar till.
    // Vi undertrycker INTE recenter längre — val-effekten nedan kör recenterOnSelected
    // som panorerar fram det valda eventets bricka SÅ man ser vilket event man är på
    // (utan att zooma; står still om brickan redan syns ovanför kortet). Vi behåller
    // bara ref-spårningen så effekten inte loopar. De avslöjade brickorna ligger KVAR
    // där man klickade — navigering flyttar bara kameran, inte avslöjnings-urvalet.
    const prevNavSelectNonceRef = useRef(navSelectNonce);
    useEffect(() => {
        if (navSelectNonce !== prevNavSelectNonceRef.current) {
            prevNavSelectNonceRef.current = navSelectNonce;
        }
    }, [navSelectNonce]);


    // 2. Hantera kamera-panorering och zoomning vid val av event.
    useEffect(() => {
        // Dagbyte just nu → rör inte kameran (vyn ska stå still).
        if (performance.now() < suppressAutoRecenterUntilRef.current) return;
        recenterOnSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded]);

    // 2b. Zoom-knappen i Nästa-pillen: flyg till det valda eventet och zooma IN
    //     (vanliga val står still — detta är den explicita inzoomningen). Klicket i
    //     kortet byter samtidigt till nästa event, så vi landar inzoomade på det.
    //     Körs bara när triggern bumpas (inte vid varje val). Ligger EFTER val-
    //     effekten så dess flyTo vinner över ev. panorering där.
    const prevZoomToEventRef = useRef(zoomToEventTrigger);
    useEffect(() => {
        if (zoomToEventTrigger === prevZoomToEventRef.current) return;
        prevZoomToEventRef.current = zoomToEventTrigger;
        const map = mapRef.current;
        if (!map) return;
        if (!selectedEvent || !isValidLatLng(selectedEvent.lat, selectedEvent.lng)) return;
        const h = map.getContainer().clientHeight;
        const targetYRatio = cardExpanded ? 0.30 : 0.40;
        const yOffset = h * (targetYRatio - 0.5);
        driftSuppressUntilRef.current = performance.now() + 1500;
        // Zooma in LITE åt gången (+2 nivåer per klick) i stället för att hoppa
        // hela vägen in — klicka flera gånger för att komma närmare. Klampas vid
        // kartans maxzoom.
        map.flyTo({
            center: [selectedEvent.lng!, selectedEvent.lat!],
            zoom: Math.min(map.getMaxZoom(), map.getZoom() + 2),
            offset: [0, yOffset],
            duration: 600,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomToEventTrigger, selectedEvent, cardExpanded]);

    // 2c. Zooma-ut-knappen i Nästa-pillen: krymp kartvyn kring samma center
    //     (−2 nivåer per klick, klampad vid kartans minzoom). Spegelbild av
    //     inzoomningen ovan men utan att flyga till eventet.
    const prevZoomOutRef = useRef(zoomOutTrigger);
    useEffect(() => {
        if (zoomOutTrigger === prevZoomOutRef.current) return;
        prevZoomOutRef.current = zoomOutTrigger;
        const map = mapRef.current;
        if (!map) return;
        driftSuppressUntilRef.current = performance.now() + 1500;
        map.easeTo({
            zoom: Math.max(map.getMinZoom(), map.getZoom() - 2),
            duration: 600,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomOutTrigger]);


    // 3. Uppdatera markörer i DOM:en när data eller synliga gränser förändras
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const currentGroupKeys = new Set<string>();

        // Synka nya och befintliga markör-grupper som faktiskt syns på skärmen
        visibleGroups.forEach(([key, group], index) => {
            currentGroupKeys.add(key);

            const count = group.length;
            const inGroupSelected = group.find(e => e.id === selectedEvent?.id);
            const nonDiscarded = group.filter(e => !discardedEventIds.has(e.id));
            // Stabil representant. Själva bildväxlingen för multi-grupper sköts av
            // den desyncade cyclern ovan (rör bara emoji/klickmål, inte DOM-synken).
            const rep = inGroupSelected || nonDiscarded[0] || group[0];

            // I gissningsläge highlightas ALDRIG mål-eventet — annars skulle dess
            // markör lysa upp blå och avslöja var spelaren ska klicka.
            const isSelected = !!inGroupSelected;
            const isSaved = group.some(e => savedEventIds.has(e.id));
            const isDiscarded = group.every(e => discardedEventIds.has(e.id));

            // Något event i gruppen börjar inom 1 timme → nålhuvudet + pin-ramen
            // blir orange, så man enkelt ser vilka som är på gång nu.
            // (hasSpecificTime finns inte i webbdatan, så det villkoret nollade
            //  alltid detta — därför borttaget.)
            const nowMs = Date.now();
            const startsWithinHour = group.some(e =>
                e.time
                && e.time.getTime() > nowMs
                && e.time.getTime() - nowMs <= 60 * 60 * 1000
            );

            // Markera gruppen som "avslöjad" så fort den varit vald. Avslöjade
            // grupper visar brickan direkt även när de inte längre är valda.
            // (Guldmarkören + gissnings-brickan avslöjas också direkt — utan kö.)
            if (isSelected) revealedKeysRef.current.add(key);
            const isRevealed = revealedKeysRef.current.has(key);

            const isWatered = shopFlags.flowers && wateredKeys.has(key);
            const isWatering = shopFlags.flowers && wateringKey === key;

            // Event skapade direkt på VADKUL lyfts fram med en egen smaragdgrön
            // bricka (samma gröna som skapa-flödet) — de är sajtens kärna.
            // Gäller bara enskilda markörer; grupper cyklar genom flera event
            // och behåller därför standardutseendet.
            const isUserCreated = count === 1 && !!rep.userCreated;

            // Boostat ("featured") event: betald framlyftning. Bara enskilda
            // markörer (grupper cyklar och behåller standardutseende). Featured är
            // alltid också userCreated, så isSpecialGroup fångar redan brickan.
            const isFeatured = count === 1 && isEventFeatured(rep);

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // För multi-event-grupper använder vi ett stabilt 'multi'-värde så
            // att stateKey inte ändras varje slideshow-tick (annars rivs brickan
            // ner och byggs upp igen + pop-in-animationen återstartas). Själva
            // emoji-bytet sker kirurgiskt längre ner.
            const stateKeyCategory = count > 1 ? 'multi' : (rep.category ?? 'other');
            const stateKey = `${isSelected}:${isRevealed}:${isSaved}:${isDiscarded}:${count}:${stateKeyCategory}:${startsWithinHour}:${isWatered}:${isWatering}:${isUserCreated}:${isFeatured}`;

            let markerData = markersRef.current.get(key);

            if (!markerData) {
                const el = document.createElement('div');
                el.className = 'v2-custom-marker';
                // Tillgänglighet: markören är klickbar → gör den nåbar med
                // tangentbord (Tab + Enter/Mellanslag) och begriplig för
                // skärmläsare. aria-label sätts/uppdateras i stateKey-blocket.
                el.setAttribute('role', 'button');
                el.tabIndex = 0;
                el.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        el.click();
                    }
                });

                // 'bottom'-anchor: nålspetsen pekar på koordinaten.
                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'bottom',
                })
                .setLngLat([rep.lng!, rep.lat!])
                .addTo(map);

                markerData = { marker, element: el, lastStateKey: '' };
                markersRef.current.set(key, markerData);
            }

            // Uppdatera ENDAST om tillståndet faktiskt har förändrats
            if (markerData.lastStateKey !== stateKey) {
                markerData.lastStateKey = stateKey;

                const shouldHideDuringZoom = count > 1 || startsWithinHour;
                markerData.element.className = `v2-custom-marker${shouldHideDuringZoom ? ' hide-during-zoom' : ''}`;

                // Uppdatera z-index på elementet. Viktiga tillstånd ligger överst.
                // Multi-event-grupper (count > 1) prioriteras högt (900) så att deras
                // siffer-badge inte hamnar under eller blandas ihop med andra enskilda markörer.
                const zIndex = isSelected ? 1000
                    : count > 1 ? 900
                    : isFeatured ? 800
                    : isSaved ? 500
                    : isUserCreated ? 300
                    : isDiscarded ? -100 : 0;
                markerData.element.style.zIndex = String(zIndex);

                // Skärmläsar-etikett: vad är det här för markör?
                markerData.element.setAttribute('aria-label', count > 1
                    ? `${count} event vid ${rep.locationName || 'samma plats'}`
                    : rep.title);

                // Sätt eventlyssnare på klick. I gissningsläge är klicket en
                // gissning på hela gruppen i stället för ett vanligt val.
                markerData.element.onclick = (e) => {
                    e.stopPropagation();
                    if (count > 1) {
                        const map = mapRef.current;
                        if (map) {
                            if (isValidLatLng(rep.lat, rep.lng)) {
                                setGroupListAnchor({ lng: rep.lng!, lat: rep.lat! });
                                setGroupListPos(map.project([rep.lng!, rep.lat!]));
                            } else {
                                setGroupListAnchor(null);
                                setGroupListPos(null);
                            }
                        }
                        setGroupList(group);
                    }
                    // Ingen sticky (hopade en bricka per klick) — vald visas via DOM-markör.
                    onSelectEventRef.current(rep);
                };

                // Får denna grupps bricka byta kroppsfärg när slideshow-cyclern
                // växlar event? Ja för normala multi-grupper; nej när ett fast
                // tillstånd (guld/sparad) äger färgen eller det är en ensam bricka.
                markerData.element.dataset.catCycle = (count > 1 && !isSaved) ? '1' : '';

                // "Stor" källa (PRO/Korpen/Svenska kyrkan) exkluderas från
                // kategorifärgningen → standardmörk bricka; övriga får sin kategori-
                // färg. Speciella tillstånd (vald/guld/sparad) går alltid före nedan.
                const catKey = rep.category && EVENT_CATEGORIES[rep.category] ? rep.category : 'other';
                const catColorHex = brickaBodyHex(rep);

                // Nål-brickans utseende per tillstånd. Mörkgrå standardbricka med
                // mjuk gradient för djup; VADKUL-skapade event får en smaragdgrön
                // bricka (samma gröna som skapa-flödet); guld = rätt svar i spelet.
                // Prioritet: vald (blå) > guld > inom 1 timme (orange) > VADKUL-
                // skapad (grön) > sparad (ljusblå) > kategori-färg > standard (mörk).
                const pinBg = isFeatured
                    ? 'linear-gradient(145deg, #fde68a 0%, #f59e0b 52%, #b45309 100%)'
                    : isUserCreated
                    ? 'linear-gradient(145deg, #34d399 0%, #059669 55%, #047857 100%)'
                    : isSaved
                    ? 'linear-gradient(145deg, #ffffff 0%, #eef2f7 100%)'
                    : catColorHex
                    ? sourceGradientCss(catColorHex)
                    : BRICKA_DARK_BG;
                const pinBorder = isSelected
                    ? '3px solid #ffffff'
                    : isFeatured
                    ? '3px solid #fbbf24'
                    : isSaved
                    ? '2px solid #5BA3CC'
                    : startsWithinHour
                    ? '2px solid #f97316'
                    : isUserCreated
                    ? '2px solid rgba(255,255,255,0.45)'
                    : catColorHex
                    ? '2px solid rgba(255,255,255,0.55)'
                    : '2px solid rgba(255,255,255,0.25)';

                // Högpresterande CSS box-shadow. "Inom 1 timme" får en varm orange
                // gloria och VADKUL-skapade en mjuk grön — båda ska synas på avstånd.
                const pinShadow = isSelected
                    ? '0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)'
                    : isFeatured
                    ? '0 0 0 4px rgba(245,158,11,0.30), 0 6px 20px rgba(180,83,9,0.50)'
                    : startsWithinHour
                    ? '0 0 0 3px rgba(249,115,22,0.28), 0 6px 18px rgba(249,115,22,0.40)'
                    : isUserCreated
                    ? '0 0 0 3px rgba(16,185,129,0.25), 0 6px 18px rgba(5,150,105,0.45)'
                    : isSaved
                    ? '0 4px 10px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)';

                // Vald/guld-bricka växer på plats (transform-origin: bottom center →
                // spetsen stannar på koordinaten, ingen translateY som lyfter av den).
                // Multi-event-brickan krymps till single-event-storlek: DOM-brickans
                // kropp är 44px, GL-single-brickans 40px → 40/44 ≈ 0.91. Enda kvar-
                // varande skillnaden mot en single blir då siffer-badgen.
                // Vald bricka får BARA vit kant (se pinBorder) — den ska INTE bli större
                // eller skifta plats (scale 1.2 gjorde båda). Behåll normal storlek.
                const baseScale = count > 1 ? 0.91 : 1;
                const scaleStyle = `scale(${baseScale})`;
                const opacityStyle = isDiscarded ? 'opacity: 0.25; filter: grayscale(1);' : '';

                const emoji = rep.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');

                // Sifferbricka i hörnet för grupper; en liten prick för sparade enskilda.
                const countBadge = count > 1
                    ? `<div class="badge-count">${count > 99 ? '99+' : count}</div>`
                    : (isSaved ? '<div class="badge-saved"></div>' : '');

                // Boostat event: liten stjärn-badge i övre vänstra hörnet (undviker
                // sparad-pricken uppe till höger). Markerar betald framlyftning.
                const boostBadge = isFeatured
                    ? '<div style="position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:linear-gradient(145deg,#fde68a,#f59e0b);box-shadow:0 1px 4px rgba(180,83,9,0.6);display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;z-index:2;">⭐</div>'
                    : '';

                // Fördela uppdykandet så att alla markörer poppar in under totalt 4 sekunder (4000ms), men visa det valda direkt (0ms delay)
                const N = visibleGroups.length;
                const animDelay = isSelected ? 0 : (N > 1 ? (index / (N - 1)) * 4000 : 0);
                // Brickor som redan hunnit poppa (nyckelns pop-tid har passerat)
                // visas direkt när de kommer tillbaka i bild efter panorering —
                // de ställer sig inte i pop-in-kön igen.
                const popAt = poppedKeysRef.current.get(key);
                const alreadyPopped = popAt !== undefined && popAt <= Date.now();
                if (popAt === undefined) {
                    poppedKeysRef.current.set(key, Date.now() + Math.round(animDelay) + 450);
                }
                // Valt OCH redan avslöjat/poppat event visar brickan direkt utan kö-delay.
                const showImmediately = isSelected || isRevealed || alreadyPopped;
                const wrapperStyle = showImmediately ? 'opacity: 1 !important;' : '';
                // --pop-scale styr animationens slutvärde (se @keyframes marker-pop-in)
                // så multi-event-brickan landar på rätt storlek även efter pop-in.
                const pinAnimationStyle = showImmediately
                    ? `--pop-scale: ${baseScale}; animation: none !important; opacity: 1 !important; transform: ${scaleStyle} !important;`
                    : `--pop-scale: ${baseScale}; transform: ${scaleStyle}; animation-delay: ${Math.round(animDelay)}ms;`;

                const isWatered = shopFlags.flowers && wateredKeys.has(key);
                const isWatering = shopFlags.flowers && wateringKey === key;
                const flowersHtml = isWatered
                    ? `<div class="marker-flowers">
                           <span class="sprouting-flower anim-flower-1">🌸</span>
                           <span class="sprouting-flower anim-flower-2">🌼</span>
                           <span class="sprouting-flower anim-flower-3">🌱</span>
                       </div>`
                    : '';

                const isSparkleActive = isFeatureActive('sparkle');
                const isSnowballActive = isFeatureActive('snowball');

                let dropsHtml = '';
                if (isSparkleActive) {
                    dropsHtml = `
                        <span class="sparkle-drop">✨</span>
                        <span class="sparkle-drop">✨</span>
                        <span class="sparkle-drop">✨</span>
                    `;
                } else if (isSnowballActive) {
                    dropsHtml = `
                        <span class="snow-drop">❄️</span>
                        <span class="snow-drop">❄️</span>
                        <span class="snow-drop">❄️</span>
                    `;
                } else {
                    dropsHtml = `
                        <span class="rain-drop"></span>
                        <span class="rain-drop"></span>
                        <span class="rain-drop"></span>
                    `;
                }

                const wateringFeedbackHtml = isWatering
                    ? `<div class="watering-rain">
                           ${dropsHtml}
                       </div>
                       <svg class="watering-progress-svg" viewBox="0 0 36 36">
                           <path class="watering-progress-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                           <path class="watering-progress-fill" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" style="stroke: ${isSparkleActive ? '#f472b6' : isSnowballActive ? '#93c5fd' : '#38bdf8'}; filter: drop-shadow(0 0 3px ${isSparkleActive ? 'rgba(244,114,182,0.8)' : isSnowballActive ? 'rgba(147,197,253,0.8)' : 'rgba(56,189,248,0.8)'});" />
                       </svg>`
                    : '';

                markerData.element.innerHTML = `
                    <div class="custom-marker-wrapper" style="${opacityStyle}; ${wrapperStyle}">
                        <div class="pin-element" style="${pinAnimationStyle}">
                            <div class="pin-bubble${isWatering ? (isSparkleActive ? ' pin-bubble-watering-sparkle' : isSnowballActive ? ' pin-bubble-watering-snowball' : ' pin-bubble-watering') : ''}" style="background:${pinBg}; border:${pinBorder}; box-shadow: ${pinShadow};">
                                <div class="pin-emoji">${emoji}</div>
                            </div>
                            ${countBadge}
                            ${boostBadge}
                            ${wateringFeedbackHtml}
                        </div>
                        ${flowersHtml}
                    </div>
                `;
            }

            // Vald grupp med flera event: byt symbol till det event man tittar på,
            // och räkna ner siffran (kvar att bläddra till) medan man trycker
            // Nästa — kirurgiskt, utan att riva ner symbolen.
            if (inGroupSelected && count > 1) {
                const selCatKey = inGroupSelected.category && EVENT_CATEGORIES[inGroupSelected.category]
                    ? inGroupSelected.category : 'other';
                const selEmoji = inGroupSelected.emoji || (EVENT_CATEGORIES[selCatKey as EventCategoryType]?.emoji ?? '🎫');
                const emojiEl = markerData.element.querySelector('.pin-emoji');
                if (emojiEl && emojiEl.textContent !== selEmoji) emojiEl.textContent = selEmoji;
                // Brickans kropp följer det bläddrade eventet (samma skäl som i
                // cyclern). Fast tillstånd (sparad) äger färgen och rörs ej.
                if (!isSaved) {
                    const bubble = markerData.element.querySelector('.pin-bubble') as HTMLElement | null;
                    if (bubble) bubble.style.background = brickaBodyBg(inGroupSelected);
                }

                // Siffran = count − position i bläddrings-ordningen. Nästa → index
                // ökar → siffran minskar; Bakåt → index minskar → siffran ökar.
                const idx = visitedOrderRef.current.indexOf(inGroupSelected.id);
                const remaining = Math.min(count, Math.max(1, count - (idx >= 0 ? idx : 0)));
                const remStr = remaining > 99 ? '99+' : String(remaining);
                markerData.element.querySelectorAll('.badge-count').forEach((el) => {
                    if (el.textContent !== remStr) el.textContent = remStr;
                });
            }
        });

        // Ta bort gamla markörer som lämnat skärmen
        Array.from(markersRef.current.keys()).forEach(key => {
            if (!currentGroupKeys.has(key)) {
                const markerData = markersRef.current.get(key);
                if (markerData) {
                    markerData.marker.remove();
                    markersRef.current.delete(key);
                }
            }
        });
    // minuteTick håller "börjar inom 1 timme"-orangen i takt med klockan även
    // när kartan står helt stilla (stateKey ser till att DOM bara byggs om när
    // statusen faktiskt ändrats).
    }, [visibleGroups, selectedEvent, savedEventIds, discardedEventIds, wateredKeys, wateringKey, shopFlags, minuteTick]);

    // Bakgrunden bakom kartan syns vid snabb panorering (innan tiles laddat)
    // och som "rymd" bakom klotet — matcha aktiv kartstil så det aldrig
    // blixtrar ljusgrått på mörka kartor.
    const containerBg = mapStyle === 'dark' ? '#141414'
        : mapStyle === 'satellite' ? '#10181f'
        : mapStyle === 'themepark' ? '#93c46c'
        : mapStyle === 'orientering' ? '#efe9dc'
        : '#f1f5f9';

    return (
        <div className="absolute inset-0 z-0" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, background: containerBg }}>
            {/* Multi-event-lista: ankrad till den klickade brickans ÖVRE HÖGRA hörn på
                kartan och följer punkten när kartan pannas/zoomas. Saknas projicerad
                position (ogiltig koordinat) faller den tillbaka till top-center. */}
            {groupList && groupList.length > 0 && (() => {
                const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
                const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
                const W = Math.min(vw * 0.8, 300);          // listbredd (px)
                // Brickans ungefärliga storlek: nål-tippen sitter PÅ geo-punkten,
                // kroppen ~BRICK_H px upp och ~BRICK_W px bred (centrerad i x).
                const BRICK_W = 30, BRICK_H = 46, GAP = 6;
                const TOP_MARGIN = 70, BOTTOM_MARGIN = 12;     // håll listan under navbaren resp. ovan nederkanten
                const HEADER_H = 42, ROW_H = 52, MAX_ROWS = 5; // "inte så lång" → max ~5 rader synliga, resten scrollas
                const pos = groupListPos;
                // KORTARE maxhöjd + ungefärlig faktisk höjd (för klamp på skärmen).
                const listMaxH = Math.min(vh * 0.5, HEADER_H + MAX_ROWS * ROW_H);
                const contentH = Math.min(listMaxH, HEADER_H + groupList.length * ROW_H);
                // Listan relaterar HORISONTELLT till brickans övre högra hörn.
                const cornerX = pos ? pos.x + BRICK_W / 2 + GAP : vw / 2 - W / 2;
                const cornerY = pos ? pos.y - BRICK_H : TOP_MARGIN + contentH;
                const left = Math.max(8, Math.min(cornerX, vw - W - 8));
                // Vertikalt: helst OVANFÖR brickan (växer uppåt → "högre upp"), men klampa
                // så HELA boxen alltid syns (top ≥ TOP_MARGIN, bottom ≤ vh − margin). Då
                // ligger scrollporten på skärmen och in-container-scrollen blir användbar
                // (förut kunde toppen hamna utanför vyn → man nådde inte de nedersta).
                const top = Math.max(TOP_MARGIN, Math.min(cornerY - contentH, vh - contentH - BOTTOM_MARGIN));
                const style = { position: 'absolute' as const, left, top, width: W };
                // Platsens namn (alla event i gruppen delar koordinat → samma plats).
                const placeName = groupList[0]?.locationName?.trim() || 'Den här platsen';
                // "Nästa" stegar markeringen till nästa event i listan (wrap), listan
                // hålls öppen precis som vid radval så man kan bläddra vidare.
                const selIdx = groupList.findIndex(ev => ev.id === selectedEvent?.id);
                const goNextInList = () => onSelectEvent(groupList[(selIdx + 1) % groupList.length]);
                return (
                <div className="z-[1300] pointer-events-auto" style={style}>
                    <div className="flex flex-col rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/60 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200" style={{ maxHeight: listMaxH }}>
                        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-slate-200/70">
                            <div className="min-w-0 flex-1">
                                <span className="block text-sm font-black text-slate-800 truncate leading-tight">{placeName}</span>
                                <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">{groupList.length} event</span>
                            </div>
                            <button
                                type="button"
                                onClick={goNextInList}
                                aria-label="Nästa event här"
                                title="Nästa event här"
                                className="shrink-0 w-8 h-8 rounded-full bg-[#006AA7] text-white hover:bg-[#005590] active:scale-95 flex items-center justify-center transition-all"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setGroupList(null); setGroupListAnchor(null); }}
                                aria-label="Stäng listan"
                                className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-slate-100">
                            {groupList.map((ev) => {
                                const catKey = ev.category && EVENT_CATEGORIES[ev.category] ? ev.category : 'other';
                                const emoji = ev.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');
                                const tid = ev.time && ev.hasSpecificTime !== false
                                    ? new Date(ev.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                                    : '';
                                const isSel = selectedEvent?.id === ev.id;
                                return (
                                    <li key={ev.id}>
                                        <button
                                            type="button"
                                            // Radval STÄNGER INTE listan (man ska kunna bläddra flera event
                                            // på samma plats) — den stängs bara av kart-klicket. Markera
                                            // det valda eventet så man ser vilket man tittar på.
                                            onClick={() => onSelectEvent(ev)}
                                            // Vald rad = blå med vit kant (ring-inset, ingen layout-shift) —
                                            // samma "vald = vit-kantad" som markören på kartan, så man ser
                                            // vilket event man står på medan man bläddrar.
                                            className={`relative w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${isSel ? 'bg-[#006AA7] ring-2 ring-inset ring-white z-10' : 'hover:bg-slate-50 active:bg-slate-100'}`}
                                        >
                                            <span className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none ${isSel ? 'bg-white/20' : 'bg-slate-100'}`} aria-hidden>{emoji}</span>
                                            <span className="flex-1 min-w-0">
                                                <span className={`block font-bold text-sm truncate ${isSel ? 'text-white' : 'text-slate-800'}`}>{ev.title}</span>
                                                {tid && <span className={`block text-[11px] font-semibold tabular-nums ${isSel ? 'text-white/80' : 'text-slate-500'}`}>kl {tid}</span>}
                                            </span>
                                            <ChevronRight size={16} className={`shrink-0 ${isSel ? 'text-white' : 'text-slate-400'}`} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
                );
            })()}
            {/* CSS och Keyframes för en mjuk, progressiv animation */}
            <style>{`
                .v2-custom-marker {
                    background: none !important;
                    border: none !important;
                    cursor: pointer;
                    width: 44px;
                    height: 52px;
                }
                /* Tangentbordsfokus ska synas tydligt (markören saknar kant/
                   bakgrund så webbläsarens default-ring försvinner lätt). */
                .v2-custom-marker:focus-visible {
                    outline: 3px solid #006AA7;
                    outline-offset: 2px;
                    border-radius: 10px;
                }
                
                @keyframes marker-pop-in {
                    0% {
                        opacity: 0;
                        transform: scale(0.2) translateY(15px);
                    }
                    40% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 1;
                        /* --pop-scale (default 1) sätts per markör så multi-event-
                           brickan kan landa på samma storlek som single-event (annars
                           skulle animationens slutvärde tvinga tillbaka scale(1)). */
                        transform: scale(var(--pop-scale, 1)) translateY(0);
                    }
                }

                .custom-marker-wrapper {
                    position: relative;
                    width: 44px;
                    height: 52px;
                }
                .needle-element, .pin-element {
                    position: absolute;
                    transform-origin: bottom center;
                }
                .needle-element {
                    bottom: 5px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .pin-element {
                    top: 0;
                    left: 0;
                    width: 44px;
                    height: 52px;
                }
                .needle-dot {
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
                .needle-line {
                    width: 2px;
                    border-radius: 1px;
                    opacity: 0.8;
                }
                .pin-bubble {
                    width: 44px;
                    height: 44px;
                    border-radius: 50% 50% 0 50%;
                    transform: rotate(45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    position: relative;
                    transition: transform 0.18s ease, filter 0.18s ease;
                }
                /* Glansig topp-highlight ger brickan en kupad känsla — ligger
                   under emojin (.pin-emoji har z-index 1) och följer bubblans
                   rundning via border-radius: inherit. */
                .pin-bubble::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background: radial-gradient(circle at 30% 28%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 48%);
                    pointer-events: none;
                }
                .pin-emoji {
                    transform: rotate(-45deg);
                    font-size: 22px;
                    line-height: 1;
                    position: relative;
                    z-index: 1;
                    /* text-shadow i stället för drop-shadow-filter: samma djup men
                       en vanlig paint i stället för ett eget kompositlager per
                       markör — märkbart billigare med hundratals markörer. */
                    text-shadow: 0 1px 1.5px rgba(0,0,0,0.25);
                }
                /* Hover-lyft på enheter med riktig pekare (inte touch, annars
                   fastnar hover-läget efter tryck). Vattnings-pulsen är en
                   animation och vinner över hover-transformen — ingen krock. */
                @media (hover: hover) and (pointer: fine) {
                    .v2-custom-marker:hover .pin-bubble {
                        transform: rotate(45deg) scale(1.07);
                        filter: brightness(1.05);
                    }
                }
                .badge-count {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 4px;
                    background: #006AA7;
                    color: #fff;
                    font-size: 10px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    border-radius: 999px;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    z-index: 10;
                }
                .badge-saved {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 12px;
                    height: 12px;
                    background: #5BA3CC;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    z-index: 10;
                }
                .badge-needle-count {
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    min-width: 14px;
                    height: 14px;
                    padding: 0 2px;
                    background: #006AA7;
                    color: #fff;
                    font-size: 8px;
                    font-weight: 700;
                    font-variant-numeric: tabular-nums;
                    border-radius: 999px;
                    border: 1.5px solid #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    box-sizing: border-box;
                }

                /* ── Kontrast per kartstil ──────────────────────────────────
                   Mörka kartan: hårfin ljus gloria + djupare skugga så mörka
                   brickor och nålar inte smälter in i den nästan svarta
                   bakgrunden. (Klassen sätts på kartcontainern i mapStyle-
                   effekten.) */
                .map-style-dark .pin-element {
                    filter: drop-shadow(0 0 1.5px rgba(255,255,255,0.45)) drop-shadow(0 5px 12px rgba(0,0,0,0.8));
                }
                .map-style-dark .needle-dot {
                    box-shadow: 0 0 0 1px rgba(255,255,255,0.3), 0 1px 4px rgba(0,0,0,0.8);
                }
                .map-style-dark .needle-line {
                    opacity: 1;
                    filter: brightness(1.7);
                }

                /* ──────────────────────────────────────────────────────────
                   TILLSTÅNDS-KLASSER (Styrs av containerklassen)
                ────────────────────────────────────────────────────────── */

                /* 1. Zoom-läge: GL-massan fälls till billiga prickar. DOM-brickorna
                   är få (bara speciella event) och saknar separat nål, så de står
                   kvar som brickor även under zoom — utan att poppa in på nytt. */
                .map-state-needle .v2-custom-marker .pin-element {
                    display: block;
                }
                .map-state-needle .v2-custom-marker.hide-during-zoom {
                    display: none !important;
                }

                /* 2. Brick-läge (kartan står still): brickan poppar in. */
                .map-state-full .v2-custom-marker .pin-element {
                    display: block;
                    animation: marker-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                }

                /* Vattnade markörer / blommor */
                .marker-flowers {
                    position: absolute;
                    bottom: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 1.5px;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 20;
                    width: max-content;
                }
                .sprouting-flower {
                    font-size: 11px;
                    display: inline-block;
                    line-height: 1;
                    transform-origin: bottom center;
                    animation: flower-sprout 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both, flower-sway 2.5s ease-in-out infinite alternate;
                }
                .anim-flower-1 {
                    animation-delay: 0ms;
                }
                .anim-flower-2 {
                    animation-delay: 150ms;
                    font-size: 9px;
                }
                .anim-flower-3 {
                    animation-delay: 300ms;
                    font-size: 10px;
                }
                @keyframes flower-sprout {
                    0% {
                        transform: scale(0) translateY(8px);
                        opacity: 0;
                    }
                    100% {
                        transform: scale(1) translateY(0);
                        opacity: 1;
                    }
                }
                @keyframes flower-sway {
                    0% {
                        transform: rotate(-8deg);
                    }
                    100% {
                        transform: rotate(8deg);
                    }
                }

                /* Vattnings-feedback (regn, pulserande bubbla + förloppsindikator) */
                .watering-rain {
                    position: absolute;
                    top: -30px;
                    left: 0;
                    width: 44px;
                    height: 30px;
                    overflow: visible;
                    pointer-events: none;
                    z-index: 10;
                }
                .rain-drop {
                    position: absolute;
                    width: 2px;
                    height: 8px;
                    background: linear-gradient(to bottom, rgba(56, 189, 248, 0), rgba(56, 189, 248, 1));
                    border-radius: 999px;
                    opacity: 0;
                    animation: rain-fall-down 0.4s linear infinite;
                }
                .rain-drop:nth-child(1) {
                    left: 10px;
                    animation-delay: 0s;
                }
                .rain-drop:nth-child(2) {
                    left: 22px;
                    animation-delay: 0.12s;
                }
                .rain-drop:nth-child(3) {
                    left: 34px;
                    animation-delay: 0.24s;
                }
                @keyframes rain-fall-down {
                    0% {
                        transform: translateY(0) scaleY(1);
                        opacity: 0;
                    }
                    15% {
                        opacity: 0.9;
                    }
                    85% {
                        opacity: 0.9;
                        transform: translateY(28px) scaleY(1);
                    }
                    100% {
                        transform: translateY(32px) scaleY(0.1);
                        opacity: 0;
                    }
                }

                .watering-progress-svg {
                    position: absolute;
                    top: -4px;
                    left: -4px;
                    width: 52px;
                    height: 52px;
                    z-index: 5;
                    transform: rotate(-90deg);
                    pointer-events: none;
                }
                .watering-progress-bg {
                    fill: none;
                    stroke: rgba(56, 189, 248, 0.2);
                    stroke-width: 3.5;
                }
                .watering-progress-fill {
                    fill: none;
                    stroke: #38bdf8;
                    stroke-width: 3.5;
                    stroke-linecap: round;
                    stroke-dasharray: 100 100;
                    stroke-dashoffset: 100;
                    filter: drop-shadow(0 0 3px rgba(56, 189, 248, 0.8));
                    animation: fill-watering-progress 1.0s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                @keyframes fill-watering-progress {
                    to {
                        stroke-dashoffset: 0;
                    }
                }

                @keyframes bubble-watering-pulse {
                    0%, 100% {
                        transform: rotate(45deg) scale(1);
                    }
                    50% {
                        transform: rotate(45deg) scale(1.06);
                        box-shadow: 0 0 15px rgba(56, 189, 248, 0.6);
                    }
                }
                .pin-bubble-watering {
                    animation: bubble-watering-pulse 0.8s ease-in-out infinite;
                }

                /* Sparkles / Glitter-fall */
                .sparkle-drop {
                    position: absolute;
                    font-size: 14px;
                    opacity: 0;
                    pointer-events: none;
                    animation: sparkle-fall-down 0.5s linear infinite;
                }
                .sparkle-drop:nth-child(1) {
                    left: 6px;
                    animation-delay: 0s;
                }
                .sparkle-drop:nth-child(2) {
                    left: 20px;
                    animation-delay: 0.15s;
                }
                .sparkle-drop:nth-child(3) {
                    left: 32px;
                    animation-delay: 0.3s;
                }
                @keyframes sparkle-fall-down {
                    0% {
                        transform: translateY(0) scale(0) rotate(0deg);
                        opacity: 0;
                    }
                    15% {
                        opacity: 1;
                        transform: translateY(4px) scale(1.1) rotate(45deg);
                    }
                    85% {
                        opacity: 1;
                        transform: translateY(24px) scale(0.9) rotate(180deg);
                    }
                    100% {
                        transform: translateY(32px) scale(0) rotate(270deg);
                        opacity: 0;
                    }
                }

                /* Snowflakes / Snöfall */
                .snow-drop {
                    position: absolute;
                    font-size: 14px;
                    opacity: 0;
                    pointer-events: none;
                    animation: snow-fall-down 0.6s ease-in-out infinite;
                }
                .snow-drop:nth-child(1) {
                    left: 8px;
                    animation-delay: 0s;
                }
                .snow-drop:nth-child(2) {
                    left: 20px;
                    animation-delay: 0.18s;
                }
                .snow-drop:nth-child(3) {
                    left: 32px;
                    animation-delay: 0.36s;
                }
                @keyframes snow-fall-down {
                    0% {
                        transform: translateY(0) translateX(0) rotate(0deg);
                        opacity: 0;
                    }
                    15% {
                        opacity: 0.95;
                    }
                    85% {
                        opacity: 0.95;
                        transform: translateY(24px) translateX(-4px) rotate(180deg);
                    }
                    100% {
                        transform: translateY(32px) translateX(2px) rotate(360deg);
                        opacity: 0;
                    }
                }

                /* Custom bubble pulses for glitter & snow */
                @keyframes bubble-watering-sparkle-pulse {
                    0%, 100% {
                        transform: rotate(45deg) scale(1);
                    }
                    50% {
                        transform: rotate(45deg) scale(1.06);
                        box-shadow: 0 0 15px rgba(244, 114, 182, 0.75);
                    }
                }
                .pin-bubble-watering-sparkle {
                    animation: bubble-watering-sparkle-pulse 0.8s ease-in-out infinite;
                }

                @keyframes bubble-watering-snowball-pulse {
                    0%, 100% {
                        transform: rotate(45deg) scale(1);
                    }
                    50% {
                        transform: rotate(45deg) scale(1.06);
                        box-shadow: 0 0 15px rgba(147, 197, 253, 0.75);
                    }
                }
                .pin-bubble-watering-snowball {
                    animation: bubble-watering-snowball-pulse 0.8s ease-in-out infinite;
                }
            `}</style>
            <div ref={mapContainerRef} className="absolute inset-0 map-state-full" style={{ width: '100%', height: '100%' }} />

            {/* Fallback om WebGL inte gick att initiera (t.ex. blockerad efter en
                tidigare kontextförlust) — sidan kraschar inte, man kan ladda om. */}
            {mapError && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-slate-100 p-6 text-center">
                    <div className="max-w-sm">
                        <p className="text-base font-semibold text-slate-800">Kartan kunde inte laddas</p>
                        <p className="mt-1 text-sm text-slate-600">
                            Webbläsarens grafik (WebGL) är otillgänglig just nu. Ladda om sidan för att försöka igen.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 rounded-full bg-[#006AA7] px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[#005590] transition-colors"
                        >
                            Ladda om
                        </button>
                    </div>
                </div>
            )}
            {/* Funktions-"väskan" (under profilen, uppe till vänster): lager-ikonen
                fäller NER en bricka (crate) med funktioner man kan testa & köpa —
                som Worms-vapen fast funktioner. Spelet "Hitta event" ligger med här
                (inte i root) så allt är ett "filsystem" för användaren. Brickan
                renderas via portal till <body> så den garanterat ligger ÖVER allt
                annat (V2Map-roten är z-0). */}
            {(() => {
                type CrateItem = { key: string; label: string; desc: string; color: string; icon: React.ReactNode; locked?: boolean };
                const crateItems: CrateItem[] = [
                    // Popup-meny: symbol + namn + kort info. Varje funktion har en egen
                    // passande accent-färg på symbolen; aktiv rad tonas i samma färg.
                    // Upplåst överst: Satellit, Skapa event + kartstilarna Nöjesfält,
                    // Orientering & 3D-terräng. Resten är låsta.
                    { key: 'satellite', label: 'Satellit', desc: 'Byt mellan satellit- och vanlig karta', color: '#0d9488', icon: <Satellite size={20} /> },
                    { key: 'createEvent', label: 'Skapa event', desc: 'Skapa egna event på kartan', color: '#22c55e', icon: <Plus size={20} strokeWidth={2.5} /> },
                    { key: 'themepark', label: 'Nöjesfält', desc: 'Naturfärgad karta — som satellit fast minimalistisk', color: '#db2777', icon: <Sparkles size={20} /> },
                    { key: 'orientering', label: 'Orientering', desc: 'Topografisk karta som visar höjdskillnaderna i terrängen', color: '#a16207', icon: <Mountain size={20} /> },
                    { key: 'terrain', label: '3D-terräng', desc: 'Visa höjder & terräng i 3D', color: '#16a34a', icon: <Mountain size={20} /> },
                    // ── Låsta funktioner ────────────────────────────────────────
                    { key: 'dark', label: 'Mörkt läge', desc: 'Mörk karta — skön i mörker', color: '#475569', icon: <Moon size={20} />, locked: true },
                    { key: 'focus', label: 'Fokus', desc: 'Centrera kartan på molnet', color: '#2563eb', icon: <Target size={20} />, locked: true },
                    { key: 'throw', label: 'Kasta', desc: 'Dubbelklick: kameran följer molnet när du kastar', color: '#0ea5e9', icon: <Send size={20} />, locked: true },
                    { key: 'globe', label: 'Klot', desc: 'Visa kartan som en jordglob', color: '#0891b2', icon: <Globe size={20} />, locked: true },
                    { key: 'faces', label: 'Ansikten', desc: 'Molnen får ansikten & uttryck', color: '#ec4899', icon: <Smile size={20} />, locked: true },
                    { key: 'flowers', label: 'Blommor', desc: 'Vattna nålar så blommor växer', color: '#db2777', icon: <Flower2 size={20} />, locked: true },
                    { key: 'sun', label: 'Sol', desc: 'Sol-effekt som lyser upp kartan', color: '#f59e0b', icon: <Sun size={20} />, locked: true },
                    { key: 'slingshot', label: 'Slangbella', desc: 'Skjut iväg molnet med slangbella', color: '#ef4444', icon: <Crosshair size={20} />, locked: true },
                    { key: 'countries', label: 'Länder', desc: 'Visa länder på kartan', color: '#0284c7', icon: <MapIcon size={20} />, locked: true },
                    { key: 'bigCloud', label: 'Större moln', desc: 'Gör molnen större', color: '#64748b', icon: <Maximize2 size={20} />, locked: true },
                    { key: 'sparkle', label: 'Glitter', desc: 'Glitter runt molnen', color: '#a855f7', icon: <Sparkles size={20} />, locked: true },
                    { key: 'snowball', label: 'Snöboll', desc: 'Kasta snöbollar i stället', color: '#38bdf8', icon: <Snowflake size={20} />, locked: true },
                    { key: 'fastThrow', label: 'Snabbare kast', desc: 'Mer fart när du kastar molnen', color: '#f59e0b', icon: <Zap size={20} />, locked: true },
                    { key: 'golf', label: 'Golf', desc: 'Kommer snart', color: '#65a30d', icon: <Flag size={20} />, locked: true },
                    { key: 'multiplayer', label: 'Multiplayer', desc: 'Spela med andra (kräver konto)', color: '#6366f1', icon: <Users size={20} />, locked: true },
                    { key: 'record', label: 'Spela in', desc: 'Spela in din skärm', color: '#ef4444', icon: <Video size={20} />, locked: true }
                ];
                const isCrateActive = (it: CrateItem) => isFeatureActive(it.key);
                const activeBagCount = crateItems.reduce((n, it) => n + (isCrateActive(it) ? 1 : 0), 0);

                const handleCrate = (it: CrateItem) => {
                    // Klick på en tipsad funktion (t.ex. Fokus) → sluta blinka den.
                    setFeatureHint(h => h === it.key ? null : h);
                    toggleFeature(it.key);
                };

                return typeof document === 'undefined' ? null : createPortal(
                    <>
                        {/* Funktions-popup: liten meny-panel under lager-knappen. Varje rad =
                            symbol (i sin egen färg) + namn + kort info. Klick slår på/av;
                            aktiv rad tonas i funktionens färg + "PÅ"-bricka. Scrollbar om lång. */}
                        {funcBagOpen && (
                            <div
                                ref={funcBagPanelRef}
                                onClick={(e) => e.stopPropagation()}
                                className="fixed top-[118px] left-3 z-[1150] w-[270px] max-h-[68vh] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/60 p-1.5 pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
                            >
                                <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Funktioner
                                </div>
                                {crateItems.map((it) => {
                                    const active = isCrateActive(it);
                                    // Låst funktion (Golf) → går inte att aktivera (visas med hänglås).
                                    const locked = !!it.locked;
                                    const disabled = locked;
                                    // Den nya/tipsade funktionen får en blå glöd-ring i listan.
                                    const blinking = featureHint === it.key;
                                    return (
                                        <button
                                            key={it.key}
                                            type="button"
                                            onClick={disabled ? undefined : () => handleCrate(it)}
                                            disabled={disabled}
                                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-xl text-left transition-colors ${blinking ? 'feature-blink-blue' : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : active ? '' : 'hover:bg-slate-100 active:bg-slate-200'}`}
                                            style={active ? { background: `${it.color}14` } : undefined}
                                        >
                                            {/* Symbol-bricka — neutral/blek bakgrund, symbolen i sin egen
                                                passande färg. Aktiv: bakgrund + ring i samma färg. */}
                                            <span
                                                className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
                                                style={{
                                                    background: active ? `${it.color}24` : '#f8fafc',
                                                    border: `1px solid ${active ? it.color : '#e2e8f0'}`,
                                                    boxShadow: active ? `0 0 0 3px ${it.color}1f` : 'none',
                                                    color: it.color
                                                }}
                                            >
                                                {it.icon}
                                            </span>
                                            {/* Namn + kort info-text */}
                                            <span className="flex-1 min-w-0">
                                                {/* Grå text = ej öppnad/aktiverad än; svart = aktiverad (upplåst men inte testad).
                                                    Låsta rader behåller mörk text (hela raden tonas via opacity-40). */}
                                                <span className={`block text-sm font-bold leading-tight ${!locked && !active ? 'text-slate-400' : 'text-slate-800'}`}>{it.label}</span>
                                                <span className="block text-[11px] text-slate-500 leading-tight truncate">{it.desc}</span>
                                            </span>
                                            {/* Indikator: LÅST (hänglås) för låsta funktioner,
                                                annars PÅ i funktionens egen färg när aktiv. */}
                                            {locked ? (
                                                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide bg-slate-200 text-slate-500">
                                                    <Lock size={9} strokeWidth={3} /> LÅST
                                                </span>
                                            ) : active && (
                                                <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide" style={{ background: `${it.color}24`, color: it.color }}>PÅ</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Lager-knappen (Funktioner) — ALLTID synlig (top-[72px] left-4,
                            vänsterkolumnen under profilen). Klick öppnar/stänger
                            funktions-popupen. Onboarding: blinkar + visar en "Ny funktion"-
                            pil när det finns en ny funktion att upptäcka (featureHint). */}
                        {/* HIDDEN per Josef 2026-06-23 - test layout without these. Functions still wired. */}
                        {false && (
                        <div className="fixed top-[72px] left-4 z-[1151] pointer-events-auto">
                            {featureHint !== null && !funcBagOpen && !hintAcknowledged && (
                                <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex items-center gap-1 whitespace-nowrap pointer-events-none animate-in fade-in slide-in-from-right-1 duration-300">
                                    {/* "Ny funktion": VIT pärla där själva texten är urklippt
                                        (knockout via mask) → kartan bakom syns genom bokstäverna. */}
                                    {/* Blinket (box-shadow-ringen) ligger på en wrapper-<span>, INTE
                                        på <svg>: box-shadow på <svg> renderas buggigt i iOS Safari
                                        (ringen blir rektangulär och syns bara upp/ner, inte på
                                        sidorna). På ett HTML-element funkar den överallt — precis som
                                        de andra knapp-blinken. inline-flex gör att spanen sluter tätt
                                        runt SVG:n så ringen hugger pillerformen. */}
                                    <span className="feature-blink-white shrink-0 inline-flex rounded-[12px]">
                                        <svg width="118" height="24" viewBox="0 0 118 24" className="block" style={{ borderRadius: 12 }} aria-label="Ny funktion">
                                            <defs>
                                                <mask id="nyFunktionKnockout">
                                                    <rect width="118" height="24" rx="12" fill="white" />
                                                    <text x="59" y="12" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="900" letterSpacing="0.6" fill="black" style={{ fontFamily: 'var(--font-fredoka), system-ui, sans-serif' }}>NY FUNKTION</text>
                                                </mask>
                                            </defs>
                                            <rect width="118" height="24" rx="12" fill="#ffffff" mask="url(#nyFunktionKnockout)" />
                                        </svg>
                                    </span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))' }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                                </div>
                            )}
                            <button
                                ref={funcBagBtnRef}
                                type="button"
                                onClick={() => setFuncBagOpen(o => !o)}
                                aria-label="Funktioner"
                                title="Funktioner"
                                aria-expanded={funcBagOpen}
                                className={`relative h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors ${
                                    featureHint !== null && !funcBagOpen && !hintAcknowledged ? 'feature-blink-white' : ''
                                } ${
                                    funcBagOpen ? 'bg-[#006AA7] text-white border-white/30' : 'bg-white/90 text-slate-700 border-white/50 hover:bg-white'
                                }`}
                            >
                                <Tags size={20} />
                                {activeBagCount > 0 && !funcBagOpen && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#006AA7] text-white text-[10px] font-black flex items-center justify-center border border-white">
                                        {activeBagCount}
                                    </span>
                                )}
                            </button>
                        </div>
                        )}

                        {/* Fokus — direkt UNDER funktions-knappen (vänsterkolumnen,
                            top-[72px] + 40px + 8px = top-[120px]). Centrerar kartan på
                            det valda eventet, annars passas alla dagens event in i vyn.
                            Göms när väskan är öppen (panelen täcker annars knappen). */}
                        {/* HIDDEN per Josef 2026-06-23 - test layout without these. Functions still wired. */}
                        {false && !funcBagOpen && (
                            <div className="fixed top-[120px] left-4 z-[1151] pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handleFocusClick}
                                    aria-label="Fokus"
                                    title="Centrera kartan"
                                    className="h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors bg-white/90 text-slate-700 border-white/50 hover:bg-white"
                                >
                                    <Target size={20} />
                                </button>
                            </div>
                        )}

                        {/* Min plats — under Fokus i vänsterkolumnen (120 + 40 + 8 = 168).
                            Flyger till användarens position och visar en pulserande blå punkt. */}
                        {/* HIDDEN per Josef 2026-06-23 - test layout without these. Functions still wired. */}
                        {false && !funcBagOpen && (
                            <div className="fixed top-[168px] left-4 z-[1151] pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handleLocateMe}
                                    aria-label="Min plats"
                                    title="Visa min plats på kartan"
                                    disabled={locating}
                                    className={`h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors ${
                                        userPos ? 'bg-[#006AA7] text-white border-white/30' : 'bg-white/90 text-slate-700 border-white/50 hover:bg-white'
                                    } ${locating ? 'opacity-60' : ''}`}
                                >
                                    <Crosshair size={20} className={locating ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        )}
                    </>,
                    document.body
                );
            })()}
            {/* Funktioner-shop: clean dashboard-panel. Varje funktion ritas
                som en kristallkula (radial gradient + topp-glint) — aktiverade
                kulor glöder i brand-blått, övriga är klart glas. Max 5 kan vara
                aktiva samtidigt (räknare överst). Klick på backdrop eller X stänger. */}
            {shopOpen && (
                <div
                    className="absolute inset-0 z-[10500] flex items-center justify-center bg-slate-950/50 backdrop-blur-md p-4"
                    onClick={() => setShopOpen(false)}
                >
                    <div
                        className="rounded-3xl w-[min(88vw,440px)] max-h-[82vh] overflow-y-auto"
                        style={{
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(240, 246, 252, 0.5) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.45)',
                            backdropFilter: 'blur(24px)',
                            WebkitBackdropFilter: 'blur(24px)',
                            boxShadow: '0 30px 60px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.06)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex flex-col gap-0.5">
                                    <h2 className="text-[11px] font-bold text-slate-500 tracking-[0.20em] uppercase">Funktioner</h2>
                                    <div className="text-[10px] font-bold tracking-wide text-slate-400">
                                        Aktiva: <span className="text-[#006AA7]">{activeFeatureCount}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShopOpen(false)}
                                    aria-label="Stäng"
                                    className="h-7 w-7 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            {/* Master-toggle: snabbt sätta alla på / av. */}
                            <div className="flex gap-1.5 mb-4">
                                <button
                                    type="button"
                                    onClick={() => setAllFeatures(true)}
                                    className="flex-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full bg-[#006AA7] text-white hover:bg-[#005590] transition-colors"
                                    style={{ boxShadow: '0 2px 6px rgba(0,106,167,0.4)' }}
                                >
                                    Aktivera alla
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAllFeatures(false)}
                                    className="flex-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                                    style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}
                                >
                                    Töm
                                </button>
                            </div>
                            {/* Kategorier — varje funktion ritas som en kristallkula.
                                Småskala translateY + rotate-jitter per index så de
                                känns levande (lätt vinklat ljus, inte stelt rad). */}
                            {(() => {
                                type ShopCard = { key: string; label: string; icon?: React.ReactNode; isFaceBadge?: boolean; locked?: boolean };
                                const categories: Array<{ title: string; items: ShopCard[] }> = [
                                    { title: 'Karta', items: [
                                        { key: 'satellite', label: 'Satellit', icon: <Layers size={18} /> },
                                        { key: 'themepark', label: 'Nöjesfält', icon: <Sparkles size={18} /> },
                                        { key: 'dark', label: 'Mörkt läge', icon: <Moon size={18} /> },
                                        { key: 'tilt', label: 'Lutning', icon: <Box size={18} /> },
                                        { key: 'globe', label: 'Klot', icon: <Globe size={18} /> },
                                        { key: 'orientering', label: 'Orientering', icon: <Mountain size={18} /> },
                                        { key: 'terrain', label: 'Terräng', icon: <Mountain size={18} /> }
                                    ]},
                                    { title: 'Moln', items: [
                                        { key: 'sun', label: 'Sol', icon: <Sun size={18} /> },
                                        { key: 'focus', label: 'Fokus', icon: <Target size={18} /> },
                                        { key: 'throw', label: 'Kasta', icon: <Send size={18} /> },
                                        { key: 'slingshot', label: 'Slangbella', icon: <Crosshair size={18} /> },
                                        { key: 'faces', label: 'Ansikten', isFaceBadge: true }
                                    ]},
                                    { title: 'Moln-hyllan', items: [
                                        { key: 'bigCloud', label: 'Större moln', icon: <Maximize2 size={18} /> },
                                        { key: 'fastThrow', label: 'Snabbare kast', icon: <Zap size={18} /> },
                                        { key: 'sparkle', label: 'Glitter', icon: <Sparkles size={18} /> },
                                        { key: 'snowball', label: 'Snöboll', icon: <Snowflake size={18} /> }
                                    ]},
                                    { title: 'Kommunikation', items: [
                                        { key: 'createEvent', label: 'Skapa event', icon: <Plus size={20} strokeWidth={2.5} /> },
                                        { key: 'multiplayer', label: 'Multiplayer (kräver konto)', icon: <Users size={18} /> }
                                    ]},
                                    { title: 'Inspelning', items: [
                                        { key: 'record', label: 'Spela in', icon: <Video size={18} />, locked: true }
                                    ]}
                                ];
                                // Scattered-mönster: små offsets per index. Bryts i
                                // sektion så varje grupp har sin egen "korg-bädd".
                                const STAGGER_Y = [0, 5, -3, 4, -2, 6, -4, 3];
                                const ROTATE_DEG = [-3, 2, -1, 3, 0, -2, 1, -3];
                                return categories.map(cat => (
                                    <div key={cat.title} className="mb-4 last:mb-0">
                                        <div className="text-[9px] font-bold text-slate-400 tracking-[0.22em] uppercase mb-2.5 text-center">
                                            {cat.title}
                                        </div>
                                        <div className="flex flex-wrap justify-center gap-3 px-2 py-1">
                                            {cat.items.map((item, i) => {
                                                const active = isFeatureActive(item.key);
                                                const locked = !!item.locked;
                                                const state: OrbState = locked ? 'locked' : active ? 'active' : 'inactive';
                                                const offY = STAGGER_Y[i % STAGGER_Y.length];
                                                const rot = ROTATE_DEG[i % ROTATE_DEG.length];
                                                const styles = getGemStyles(item.key, state);
                                                const faceColor = styles.iconColor;
                                                return (
                                                    <button
                                                        key={item.key}
                                                        type="button"
                                                        onClick={locked ? undefined : () => toggleFeature(item.key)}
                                                        title={
                                                            state === 'locked' ? `${item.label} — Köp`
                                                            : state === 'active' ? `${item.label} — Aktiv, klicka för att stänga av`
                                                            : `${item.label} — Klicka för att aktivera`
                                                        }
                                                        aria-label={item.label}
                                                        className={`relative rounded-full flex items-center justify-center transition-all duration-200 ${
                                                            state === 'active' ? 'text-white hover:scale-110'
                                                            : state === 'locked' ? 'text-amber-900/70 cursor-pointer hover:scale-105'
                                                            : 'hover:scale-110 active:scale-95'
                                                        }`}
                                                        style={{
                                                            width: 56,
                                                            height: 56,
                                                            transform: `translateY(${offY}px) rotate(${rot}deg)`,
                                                            background: styles.bg,
                                                            border: styles.border,
                                                            boxShadow: styles.shadow,
                                                            color: styles.iconColor
                                                        }}
                                                    >
                                                        {/* Inre ikon */}
                                                        <div className="relative z-[2] flex items-center justify-center" style={{ transform: `rotate(${-rot}deg)` }}>
                                                            {item.isFaceBadge ? (
                                                                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                                                                    <circle cx="9" cy="10" r="1.7" fill={faceColor} />
                                                                    <circle cx="15" cy="10" r="1.7" fill={faceColor} />
                                                                    <path
                                                                        d="M 8 14.5 Q 12 17.5 16 14.5"
                                                                        stroke={faceColor}
                                                                        strokeWidth="1.7"
                                                                        strokeLinecap="round"
                                                                        fill="none"
                                                                    />
                                                                </svg>
                                                            ) : item.icon}
                                                        </div>
                                                        {/* Topp-glint — den klassiska glas-reflektionen
                                                            i övre vänstra hörnet som ger kulan karaktär. */}
                                                        <div
                                                            aria-hidden="true"
                                                            className="absolute pointer-events-none"
                                                            style={{
                                                                top: '11%',
                                                                left: '17%',
                                                                width: '40%',
                                                                height: '24%',
                                                                borderRadius: '50%',
                                                                background: 'radial-gradient(ellipse, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.55) 35%, rgba(255,255,255,0) 75%)',
                                                                transform: 'rotate(-22deg)',
                                                                filter: 'blur(0.3px)'
                                                            }}
                                                        />
                                                        {/* Sub-glint nere höger — en svag andra
                                                            reflektion för djup. */}
                                                        <div
                                                            aria-hidden="true"
                                                            className="absolute pointer-events-none"
                                                            style={{
                                                                bottom: '14%',
                                                                right: '20%',
                                                                width: '16%',
                                                                height: '10%',
                                                                borderRadius: '50%',
                                                                background: 'radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)'
                                                            }}
                                                        />
                                                        {state === 'locked' && (
                                                            <div
                                                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center z-[3]"
                                                                style={{
                                                                    background: '#d97706',
                                                                    border: '1.5px solid #fff7ed',
                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                                                                    transform: `rotate(${-rot}deg)`
                                                                }}
                                                            >
                                                                <Lock size={8} className="text-white" strokeWidth={3} />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                            <div className="mt-4 pt-3 border-t border-slate-200 text-center">
                                <button
                                    type="button"
                                    className="text-[11px] font-semibold text-[#006AA7] hover:underline tracking-wide"
                                >
                                    Uppgradera konto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
