'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Box, Globe, Mountain, Plus, X, Video, Send, Sun, Target, Crosshair, Maximize2, Zap, Sparkles, Snowflake, Lock, Users, Gamepad2, Smile, Satellite, Flower2, Flag, Map as MapIcon, Moon, Disc3, Hexagon, Trophy } from 'lucide-react';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import { isValidLatLng } from '../../utils/mapUtils';
import { sourceColor } from '../../utils/sources';
import { isFeatureOn, FEATURE_CHANGE_EVENT } from '../../lib/featureToggles';
import { lngLatToCell, cellCornersLngLat, cellCenterLngLat, palette, hueForUid, regionsForBounds, regionForLngLat, lngLatToMerc, mercToLngLat, HEX_SIZE_MERC, REVIRET_WET_FILL, REVIRET_WET_EDGE } from '../../lib/reviret';
import { claimCells, subscribeTerritory, myReviretIdentity, type TerritoryCell } from '../../services/reviretService';
import { saveDailyScore, subscribeDailyLeaderboard, type LeaderboardEntry } from '../../services/leaderboardService';
import CloudPopup, { CloudExpression } from '../ui/CloudPopup';
import toast from 'react-hot-toast';

// Två basstilar: standard vektor-karta (Voyager) och en raster-satellitvy
// (ESRI World Imagery). Vi växlar via map.setStyle(); markörer behålls eftersom
// de är DOM-element i container, inte en del av style-spec:en.
const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
// Mörkt kartläge (CARTO Dark Matter) — direkt stil-URL, ingen transform behövs.
const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SATELLITE_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    // Satellitstilen är ren rasterbild och har inga glyfer av sig själv. Kluster-
    // räknaren (text-symbol) behöver ett glyf-endpoint — vi lånar Cartos (samma
    // som Voyager/Dark-stilarna) så "Open Sans Bold" finns på ALLA stilar.
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

// "Nöjesfälts"-kartan: hämta Voyager-stilen och måla om den i en mild, naturlig
// palett (grönt land, blått vatten, dämpade byggnader/vägar) så den fungerar som
// en lugn bakgrund i stället för en gäll tivoli-look. Hämtas + transformeras en
// gång och cachas sedan i komponentens themeParkStyleRef.
async function fetchAndTransformThemeParkStyle(): Promise<maplibregl.StyleSpecification> {
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
// "Stora" källor (PRO/Korpen/Svenska kyrkan) får en egen brick-färg via bodyColor
// — annars används den mörka standard-gradienten.

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

function makeBrickaImageData(emoji: string, bodyColor?: string): { data: ImageData; pixelRatio: number } | null {
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
    const stops = bodyColor
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
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.restore();

    // Emoji centrerad i kroppen (oroterad).
    ctx.font = `${Math.round(S * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);

    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: DPR };
}

// En GL-markör-feature: punkt + vilken bakad bild + grupp-nyckel (för klick).
type PlainFeature = {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { icon: string; key: string };
};

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

// ── Pinball / Flipper-läge ──────────────────────────────────────────────────
// Top-down flipperbana ovanpå kartan: varje event blir en rund "studsare"
// (bubbla), närliggande studsare flyter ihop (metaball), och en kula avfyras
// med slangbella. Träffar kulan en studsare öppnas det eventet. Kameran fryses
// medan läget är på, så fysiken kan köras i stabila skärm-pixlar (px/ms) och
// studsarna projiceras EN gång per avfyrning i stället för varje frame.
const PIN_GEO_MODE: boolean = true;
// Sveriges ungefärliga bbox (banan visar hela Sverige) + en något större ram
// som begränsar panorering så man inte glider iväg från landet, samt centrum.
const SWEDEN_BOUNDS: [[number, number], [number, number]] = [[10.0, 55.0], [24.6, 69.2]];
const SWEDEN_PAN_LIMIT: [[number, number], [number, number]] = [[2.0, 52.0], [33.0, 71.5]];
const SWEDEN_CENTER: [number, number] = [15.2, 62.4];
// Träffradie i SKÄRM-px (DOM-markörer är px-konstanta över zoom → naturligt
// zoom-oberoende). ~halva brickan (44px) + bollens radie.
const PIN_HIT_RADIUS_PX = 36;
const PIN_BASE_R = 18;           // px-radie för en ensam bubbla (fryst zoom)
const PIN_BUMPER_MAX_R = 46;     // tak så jättegrupper inte täcker halva banan
const PIN_BALL_R = 12;
// Zoom-skala för flippern: event-markörer, kula OCH kollisionsradie krymper när
// kartan är långt utzoomad. Annars är de px-konstanta → tätt packade markörer +
// stor träffradie = bollen studsar kaotiskt ("flippar ur") vid skott. 1.0 inzoomat
// (z>=10) ned till 0.35 utzoomat (z<=5).
function pinScaleForZoom(z: number): number {
    const t = Math.max(0, Math.min(1, (z - 5) / 5));
    return 0.35 + 0.65 * t;
}
// Inneslutna O-rullade rutor (flood-fill): celler i revirets bounding-box som inte
// är rullade och inte kan nå "utsidan" utan att korsa en rullad ruta. Används för
// att HELFYLLA hålen inuti ett revir man rullat runt. 6-grannar (pointy-top).
// Tak på bbox-ytan så en utspridd bana inte fryser tråden.
function computeInterior(rolled: Set<string>): Set<string> {
    const interior = new Set<string>();
    if (rolled.size < 6) return interior;
    let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const cell of rolled) {
        const c = cell.indexOf(',');
        const q = Number(cell.slice(0, c)), r = Number(cell.slice(c + 1));
        if (q < minQ) minQ = q; if (q > maxQ) maxQ = q;
        if (r < minR) minR = r; if (r > maxR) maxR = r;
    }
    minQ -= 1; maxQ += 1; minR -= 1; maxR += 1; // ram av "utsida" runt reviret
    if ((maxQ - minQ + 1) * (maxR - minR + 1) > 250000) return interior;
    const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
    const exterior = new Set<string>();
    const stack: number[][] = [];
    const seed = (q: number, r: number) => {
        const k = q + ',' + r;
        if (!rolled.has(k) && !exterior.has(k)) { exterior.add(k); stack.push([q, r]); }
    };
    for (let q = minQ; q <= maxQ; q++) { seed(q, minR); seed(q, maxR); }
    for (let r = minR; r <= maxR; r++) { seed(minQ, r); seed(maxQ, r); }
    while (stack.length) {
        const cur = stack.pop() as number[];
        const q = cur[0], r = cur[1];
        for (const nb of NB) {
            const nq = q + nb[0], nr = r + nb[1];
            if (nq < minQ || nq > maxQ || nr < minR || nr > maxR) continue;
            const k = nq + ',' + nr;
            if (rolled.has(k) || exterior.has(k)) continue;
            exterior.add(k); stack.push([nq, nr]);
        }
    }
    for (let q = minQ; q <= maxQ; q++) {
        for (let r = minR; r <= maxR; r++) {
            const k = q + ',' + r;
            if (!rolled.has(k) && !exterior.has(k)) interior.add(k);
        }
    }
    return interior;
}
// Konvex hull (monoton kedja) av [lng,lat]-punkter → få hörn. Används för att rita
// reviret som en SOLID MASSA när man är utzoomad: ~få projektioner per frame i
// stället för tusentals hexagoner.
function convexHull(pts: [number, number][]): [number, number][] {
    if (pts.length < 3) return pts.slice();
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower: [number, number][] = [];
    for (const pt of p) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
        lower.push(pt);
    }
    const upper: [number, number][] = [];
    for (let i = p.length - 1; i >= 0; i--) {
        const pt = p[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
        upper.push(pt);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
}
// "Pionjärsteg": rullade rutor i FRONTLINJEN — < 3 grannar i reviret (rullade ∪
// inneslutna). Rutor i ett tätt/säkrat område (>= 3 grannar) räknas INTE. Driver
// "steg ute"-mätaren: bara de framåtsträvande stegen, inte den redan säkrade massan.
function countPioneer(rolled: Set<string>, interior: Set<string>): number {
    const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
    let n = 0;
    for (const cell of rolled) {
        const c = cell.indexOf(',');
        const q = Number(cell.slice(0, c)), r = Number(cell.slice(c + 1));
        let nb = 0;
        for (const d of NB) {
            const k = (q + d[0]) + ',' + (r + d[1]);
            if (rolled.has(k) || interior.has(k)) { nb++; if (nb >= 3) break; }
        }
        if (nb < 3) n++;
    }
    return n;
}
// Under denna zoom ritas reviret som solid hull-massa (inga hexagoner) för fart.
const REV_DETAIL_ZOOM = 9;
// Flipperns zoom-gränser: inte zooma ut för långt (tråkigt/laggigt) och inte in
// så långt att satellit-rutorna tar slut ("map data not yet available").
const PIN_FLIP_MIN_ZOOM = 6;
const PIN_FLIP_MAX_ZOOM = 16;
const PIN_WALL = 14;             // banans sido-insteg från container-kanten
const PIN_TOP_RESERVE = 60;      // håll banan under navbaren/kategorichipsen
const PIN_BOTTOM_RESERVE = 72;   // håll banan ovanför EventCards verktygs-pill
const PIN_FRICTION = 1.0;        // /s — lägre än molnens 2.2 så kulan rullar längre
const PIN_RESTITUTION = 0.84;    // studs mot väggar + studsare
const PIN_BUMPER_KICK = 0.10;    // extra utåt-knuff (px/ms) vid studsar-träff
const PIN_DT_FIX = 1000 / 120;   // fast fysik-steg (8.33 ms) → inga tunnlingar
const PIN_DT_CAP = 50;           // tak på frame-delta in i ackumulatorn (flik-byte)
const PIN_STOP_V = 0.018;        // px/ms — under detta parkeras kulan
const PIN_HIT_COOLDOWN = 250;    // ms per studsare innan den kan öppna eventet igen
const PIN_LAUNCH_GAIN = 0.011;   // drag-px → px/ms
const PIN_MAX_V = 2.6;           // px/ms avfyrnings-tak
const PIN_MAX_FLIGHT_MS = 14000; // nödbroms: parkera kulan om den rullat för länge
const PIN_BODY_COLOR = '#1e293b'; // samma mörka palett som brickorna

interface PinBumper {
    key: string; group: LinkEvent[]; emoji: string;
    lat: number; lng: number;          // geo-koordinater för omprojektion när kameran följer bollen
    cx: number; cy: number; r: number; count: number;
    hitFlash: number; lastHit: number;
}
interface PinBall {
    x: number; y: number; vx: number; vy: number; r: number;
    alive: boolean; armed: boolean; lastHitKey: string | null;
}
interface PinBoard { minX: number; minY: number; maxX: number; maxY: number; }
interface PinGrid { near: (x: number, y: number) => PinBumper[]; }

// πr² = n·π·BASE_R²  ⇒  en sammanslagen grupp av N täcker exakt N ensam-areor
// (area-bevarande): det man ser ihopflutet är precis det kulan kan träffa.
const pinBumperRadius = (n: number) => Math.min(PIN_BUMPER_MAX_R, PIN_BASE_R * Math.sqrt(n));

// Projicerar varje grupp till en studsare. Sparar lat/lng så att screen-pos
// kan beräknas om varje frame när kameran följer bollen.
// OBS: MapLibre v5 returnerar canvas-pixlar (DPR-skalade) från map.project().
// Vi delar med dpr så vi får CSS-pixlar som matchar canvas-koordinaterna.
function buildPinBumpers(map: maplibregl.Map, groups: Map<string, LinkEvent[]>, board: PinBoard, dpr: number): PinBumper[] {
    const M = 80; // marginal: ta med studsare nära skärmkanten
    const out: PinBumper[] = [];
    for (const [key, group] of groups) {
        const rep = group[0];
        if (!rep || !isValidLatLng(rep.lat, rep.lng)) continue;
        const p = map.project([rep.lng!, rep.lat!]);
        // p är i canvas-pixlar (DPR-skalat) → dela med dpr för CSS-pixlar
        const cx = p.x / dpr, cy = p.y / dpr;
        if (cx < board.minX - M || cx > board.maxX + M || cy < board.minY - M || cy > board.maxY + M) continue;
        const catKey = (rep.category && EVENT_CATEGORIES[rep.category as EventCategoryType]) ? rep.category : 'other';
        const emoji = rep.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎟️');
        out.push({ key, group, emoji, lat: rep.lat!, lng: rep.lng!, cx, cy, r: pinBumperRadius(group.length), count: group.length, hitFlash: 0, lastHit: 0 });
    }
    return out;
}

// Likformigt rutnät för O(1)-kollision: kulan testas bara mot sin egen cell + 8
// grannar, oavsett hur många studsare banan har.
function buildPinGrid(bumpers: PinBumper[], cell: number): PinGrid {
    const buckets = new Map<string, PinBumper[]>();
    for (const b of bumpers) {
        const k = `${Math.floor(b.cx / cell)},${Math.floor(b.cy / cell)}`;
        const arr = buckets.get(k); if (arr) arr.push(b); else buckets.set(k, [b]);
    }
    return {
        near(x, y) {
            const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
            const out: PinBumper[] = [];
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                const arr = buckets.get(`${gx + dx},${gy + dy}`);
                if (arr) out.push(...arr);
            }
            return out;
        }
    };
}

// Ett fast fysik-steg: friktion → semi-implicit Euler → väggar → studsare.
// onHit anropas (debouncat per studsare) när kulan slår in i en bumper.
function stepPinball(ball: PinBall, board: PinBoard, grid: PinGrid, dt: number, nowMs: number, onHit: (b: PinBumper) => void) {
    const decay = Math.exp(-PIN_FRICTION * dt / 1000); // frame-rate-oberoende friktion
    ball.vx *= decay; ball.vy *= decay;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;

    // väggar
    if (ball.x - ball.r < board.minX) { ball.x = board.minX + ball.r; ball.vx = Math.abs(ball.vx) * PIN_RESTITUTION; }
    if (ball.x + ball.r > board.maxX) { ball.x = board.maxX - ball.r; ball.vx = -Math.abs(ball.vx) * PIN_RESTITUTION; }
    if (ball.y - ball.r < board.minY) { ball.y = board.minY + ball.r; ball.vy = Math.abs(ball.vy) * PIN_RESTITUTION; }
    if (ball.y + ball.r > board.maxY) { ball.y = board.maxY - ball.r; ball.vy = -Math.abs(ball.vy) * PIN_RESTITUTION; }

    // studsare (broadphase: bara kulans cell + 8 grannar)
    let touching: string | null = null;
    for (const b of grid.near(ball.x, ball.y)) {
        const dx = ball.x - b.cx, dy = ball.y - b.cy;
        const minD = ball.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const d = Math.max(1e-3, Math.sqrt(d2));
        const nx = dx / d, ny = dy / d;
        const overlap = minD - d;
        ball.x += nx * overlap; ball.y += ny * overlap; // de-överlappa
        const vDotN = ball.vx * nx + ball.vy * ny;
        if (vDotN < 0) { // reflektera bara om kulan närmar sig → ingen dubbelstuds-jitter
            ball.vx = (ball.vx - (1 + PIN_RESTITUTION) * vDotN * nx) + nx * PIN_BUMPER_KICK;
            ball.vy = (ball.vy - (1 + PIN_RESTITUTION) * vDotN * ny) + ny * PIN_BUMPER_KICK;
            b.hitFlash = 1;
            if (b.key !== ball.lastHitKey && nowMs - b.lastHit > PIN_HIT_COOLDOWN) { b.lastHit = nowMs; onHit(b); }
        }
        touching = b.key;
    }
    ball.lastHitKey = touching; // nollas när kulan lämnat alla studsare → kan träffa igen senare

    // hård fartgräns så upprepade kicks inte skenar
    const sp = Math.hypot(ball.vx, ball.vy);
    const cap = PIN_MAX_V * 1.4;
    if (sp > cap) { ball.vx = ball.vx / sp * cap; ball.vy = ball.vy / sp * cap; }
}

interface V2MapProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    savedEventIds?: Set<string>;
    discardedEventIds?: Set<string>;
    cardExpanded?: boolean;
    onCenterChange?: (lat: number, lng: number) => void;
    onMapDrag?: () => void;
    /** Bumps every time the sun button is pressed and the flash ends — V2Map
     *  spawns a new map-anchored cloud at the current view center. */
    sunCloudTrigger?: number;
    /** Räknare som visas i molnet. Skickas in från sidan så molnet ser hela
     *  datasetet, inte bara det dag-/sökfiltrerade. */
    cloudStats?: { today: number; tomorrow: number; week: number; withinHour: number; withinHours: number };
    /** True så fort första event-svaret från databasen kommit. Start-molnet
     *  väntar på detta innan det poppar fram, så det inte hinner visa "0 unika
     *  event idag" medan datan fortfarande laddas. Default true (bakåtkompat). */
    eventsLoaded?: boolean;
    /** Räknare som triggar att respektive moln snäpper tillbaka in på skärmen
     *  (används av återkallnings-knapparna jämte solen). Varje ökning = ett anrop. */
    recallMainTrigger?: number;
    recallSunTrigger?: number;
    /** Räknare som triggar att kameran flyger tillbaka TILL det valda eventet
     *  (recenter-knappen på eventkortet — vi går till eventet, eventet flyttas
     *  inte till oss). Varje ökning = ett anrop. */
    recenterTrigger?: number;
    /** Bumpas vid dagbyte. Då väljer sidan eventet närmast kartans mitt OCH vi
     *  låter bli att flytta kameran till det — vyn ska stå still vid dagbyte. */
    daySwitchNonce?: number;
    /** Skickar status om huruvida respektive molns ankare ligger utanför skärmen.
     *  Sidan använder det för att visa återkallnings-knappar jämte solen. */
    onCloudVisibilityChange?: (visibility: { main: boolean; sun: boolean }) => void;
    /** Fyrar när huvudmolnet hämtats tillbaka via molnsymbolen minst en gång
     *  (cloudRecalled). Sidan använder det för att sluta blinka molnsymbol-knappen
     *  efter att den använts. */
    onMainRecalledChange?: (recalled: boolean) => void;
    /** Onboarding: true när Fokus-verktyget (recenter-knappen vid "Idag") ska
     *  blinka för att visa att det är nytt — tills användaren klickat på det. */
    onFocusToolHint?: (blink: boolean) => void;
    /** True när båda molnen ligger på varandra → slangbella tillgänglig.
     *  Sidan fyller fokusknappen vit för att visa att läget är aktivt. */
    onSlingshotChange?: (active: boolean) => void;
    /** True när användaren tryckt på fokusknappen i ready-läge → gummibanden
     *  blir alltid synliga och nästa drag-release av ett moln avfyrar slangbellan
     *  i motsatt riktning mot dragget. */
    slingshotEngaged?: boolean;
    /** Fyrar när snärten avlossats så sidan kan avarma engaged-läget. */
    onSlingshotFired?: () => void;
    /** "Hitta eventet"-spel: när true är kartan i gissningsläge — markörklick blir
     *  en gissning (onGuess) i stället för ett vanligt val, det valda mål-eventet
     *  highlightas INTE (så det inte avslöjas) och kameran flyttas inte dit. */
    gameMode?: boolean;
    /** Anropas vid markörklick i gissningsläge med hela gruppen som klickades.
     *  Sidan avgör om mål-eventet finns i gruppen. */
    onGuess?: (group: LinkEvent[]) => void;
    /** Event-id som ska ritas som en guld-skimrande markör (det rätta svaret när
     *  rundan avslöjats). null = ingen guldmarkör. */
    goldEventId?: string | null;
    /** Event-id för markören man gissade på — hålls synlig (brickan visas direkt)
     *  efter avslöjet så man ser var man klickade. null = ingen. */
    guessedEventId?: string | null;
    /** Streck mellan gissningen (from) och rätt svar (to) som ritas efter en
     *  felgissning. När satt zoomar kartan ut så båda punkterna syns och en
     *  streckad linje + avståndsetikett ritas mellan dem. null = inget streck. */
    guessLine?: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; label: string } | null;
    /** True = luta kameran till en sidovy (3D-perspektiv); false = platt vy.
     *  Togglas av solknappen + tilt-knappen. */
    tilted?: boolean;
    /** Fyrar när man trycker på sol-molnet — sidan fäller tillbaka lutningen. */
    onSunCloudTap?: () => void;
    /** Togglar lutningen via tilt-knappen under satellit-knappen. */
    onToggleTilt?: () => void;
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
    /** "Hitta event"-spelet ligger numera som en funktion i väskan (inte i root).
     *  Sidan skickar in spelets tillstånd + start/stopp så väske-brickan kan styra det. */
    findGameActive?: boolean;
    canStartFindGame?: boolean;
    onStartFindGame?: () => void;
    onStopFindGame?: () => void;
    /** Pinball/Flipper-läge: kartan blir en top-down flipperbana. Eventen blir
     *  runda studsare (närliggande flyter ihop), en kula avfyras med slangbella
     *  och det event kulan träffar öppnas. Kameran fryses medan läget är på.
     *  Togglas från funktionsväskan (som "Hitta event"). */
    pinballMode?: boolean;
    canStartPinball?: boolean;
    onStartPinball?: () => void;
    onStopPinball?: () => void;
    /** Anropas när kulan slår in i en studsare — sidan öppnar då gruppens event. */
    onPinballHit?: (group: LinkEvent[]) => void;
    /** Fyrar varje gång kulan avfyras (för skott-räknare/HUD). */
    onPinballLaunch?: () => void;
    /** Spelarens valda Reviret-färg (färgton 0–359), null = standard per uid. */
    myReviretHue?: number | null;
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
    sunCloudTrigger = 0,
    cloudStats,
    eventsLoaded = true,
    recallMainTrigger = 0,
    recallSunTrigger = 0,
    recenterTrigger = 0,
    daySwitchNonce = 0,
    onCloudVisibilityChange,
    onMainRecalledChange,
    onFocusToolHint,
    onSlingshotChange,
    slingshotEngaged = false,
    onSlingshotFired,
    gameMode = false,
    onGuess,
    goldEventId = null,
    guessedEventId = null,
    guessLine = null,
    tilted = false,
    onSunCloudTap,
    onToggleTilt,
    onFeatureFlagsChange,
    onActivateMultiplayer,
    onFuncBagOpenChange,
    findGameActive = false,
    canStartFindGame = false,
    onStartFindGame,
    onStopFindGame,
    pinballMode = false,
    canStartPinball = false,
    onStartPinball,
    onStopPinball,
    onPinballHit,
    onPinballLaunch,
    myReviretHue = null
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string; lastPinballMode: boolean }>>(new Map());
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
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'themepark' | 'dark' | 'orientering'>('satellite');
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
    // Lutning har TVÅ nivåer:
    //   tiltEnabled — "funktionen aktiverad" (på i väskan). Styr om snabb-knappen
    //                 under lager-knappen visas.
    //   tilted (prop) — själva kamera-lutningen på/av.
    // Snabb-knappen togglar BARA kameran (tilted) — funktionen förblir aktiverad
    // och knappen ligger kvar. Bara att stänga av Lutning i väskan döljer knappen
    // (rensar tiltEnabled). Kamera-lutning via valfri väg (väska/sol/knapp)
    // markerar funktionen som aktiverad.
    const [tiltEnabled, setTiltEnabled] = useState(false);
    useEffect(() => { if (tilted) setTiltEnabled(true); }, [tilted]);

    // "Min plats": geolocation-knapp under lutnings-knappen. Position visas som
    // en pulserande blå punkt (egen maplibre-markör — överlever stilbyten).
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
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

        if (pinballMode) {
            const ballM = pinGeoBallRef.current;
            if (!ballM) return;
            const ballLL = ballM.getLngLat();
            const mapCenter = map.getCenter();
            // Kolla om kartans centrum redan är nära kulan (inom ~150-200 meter)
            const isFocused = Math.abs(mapCenter.lng - ballLL.lng) < 0.002 && Math.abs(mapCenter.lat - ballLL.lat) < 0.002;

            if (isFocused) {
                // Teleportera kulan till användarens GPS-position!
                setLocating(true);
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setUserPos(next);
                        setLocating(false);
                        ballM.setLngLat([next.lng, next.lat]);
                        toast.success('Kulan har teleporterats till din position!');
                        map.flyTo({ center: [next.lng, next.lat], zoom: Math.max(map.getZoom(), 14), duration: 1000 });
                    },
                    (err) => {
                        setLocating(false);
                        toast.error('Kunde inte hämta din plats för teleportering.');
                    },
                    { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
                );
            } else {
                // Fokusera kartan på kulan
                map.flyTo({ center: [ballLL.lng, ballLL.lat], zoom: Math.max(map.getZoom(), 14), duration: 1000 });
            }
            return;
        }

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
        if (!gameMode && !pinballMode && selectedEvent && isValidLatLng(selectedEvent.lat, selectedEvent.lng)) {
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
        // Bara Satellit (mapStyle='satellite') är aktiv från start — allt annat av.
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
            // Aktivera/avaktivera funktionen (styr knappens synlighet) och
            // luta/fäll kameran därefter.
            setTiltEnabled(value);
            if (tilted !== value) onToggleTilt?.();
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
            if (tilted) onToggleTilt?.();
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
        if (tilted !== want('tilt')) onToggleTilt?.();
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
    const guessLineRef = useRef(guessLine);
    guessLineRef.current = guessLine;
    const [guessLineScreen, setGuessLineScreen] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

    // Spara undan callbacks i refs så map-event-handlers inte ständigt behöver bindas om
    const onSelectEventRef = useRef(onSelectEvent);
    onSelectEventRef.current = onSelectEvent;

    const onCenterChangeRef = useRef(onCenterChange);
    onCenterChangeRef.current = onCenterChange;

    const onMapDragRef = useRef(onMapDrag);
    onMapDragRef.current = onMapDrag;

    // Spel-läge + gissnings-callback i refs så markör-klickhanterare kan läsa
    // senaste värdet utan att bindas om.
    const gameModeRef = useRef(gameMode);
    gameModeRef.current = gameMode;
    const onGuessRef = useRef(onGuess);
    onGuessRef.current = onGuess;

    // Molnen (info-molnet + sol-molnet) och alla deras effekter — ansikten,
    // kasta, slangbella, sol-tilt, vattning. Välkomstmolnet visar dagens event-
    // info ("X unika event idag" + "N börjar inom en timme"). De extra effekterna
    // (ansikten/kasta/slangbella) är fortfarande var för sig gate:ade av
    // shop-togglarna (isFeatureActive(...)), så de slås inte på automatiskt.
    const CLOUDS_ENABLED: boolean = true;

    // Cloud popup geographic map anchor state and projection variables
    // Solves request: anchor cloud to a position on map, move with map
    const [cloudAnchor, setCloudAnchor] = useState<{ lat: number; lng: number }>({ lat: 58.0257, lng: 14.4664 });
    const [cloudAnchorPos, setCloudAnchorPos] = useState<{ x: number; y: number } | null>(null);
    const [showCloud, setShowCloud] = useState(true);
    // True när molnet hämtats tillbaka via molnsymbolen minst en gång. Då ska det
    // INTE komma tillbaka som start-molnet med text, utan som det runda molnet med
    // ett leende (clicked-läget). Start-visningen (false) visar texten.
    const [cloudRecalled, setCloudRecalled] = useState(false);

    const showCloudRef = useRef(showCloud);
    showCloudRef.current = showCloud;

    const cloudAnchorRef = useRef(cloudAnchor);
    cloudAnchorRef.current = cloudAnchor;

    const cloudAnchorPosRef = useRef(cloudAnchorPos);
    cloudAnchorPosRef.current = cloudAnchorPos;

    // Sun-cloud state — a second cloud that spawns at the current map center
    // whenever the sun-flash animation finishes. Behaves identically to the
    // main cloud: anchored to geo coordinates, follows map pan/zoom, persists
    // off-screen until the user dismisses it.
    const [sunCloudAnchor, setSunCloudAnchor] = useState<{ lat: number; lng: number } | null>(null);
    const [sunCloudAnchorPos, setSunCloudAnchorPos] = useState<{ x: number; y: number } | null>(null);
    const [sunCloudId, setSunCloudId] = useState(0);
    // Skalan som sun-molnet visas i. Det är förankrat i kartan: när man zoomar
    // in växer det (2x per zoom-nivå), zoomar man ut krymper det — likt ett
    // objekt på kartan. Vid skapande sätts skalan utifrån nuvarande zoom.
    const [sunCloudScale, setSunCloudScale] = useState(1);
    const sunCloudCreationZoomRef = useRef<number>(8);
    const SUN_CLOUD_BASE_SCALE = 0.7; // lite mindre än huvudmolnet vid skapande
    // Gemensamt max-storlekstak för BÅDA molnen: när man zoomar in slutar molnet
    // växa vid den här skalan, så en stor blur-tung moln-SVG inte får kartan att
    // lagga. Skickas till CloudPopup (maxScale) och kapar även sol-molnets eget
    // zoom-skalningsläge nedan. Molnen krymper fortfarande fritt när man zoomar ut.
    const CLOUD_MAX_SCALE = 2.5;

    const sunCloudAnchorRef = useRef(sunCloudAnchor);
    sunCloudAnchorRef.current = sunCloudAnchor;
    const sunCloudAnchorPosRef = useRef(sunCloudAnchorPos);
    sunCloudAnchorPosRef.current = sunCloudAnchorPos;

    // Tilt-status i ref så hjälpare som depthAtPoint (anropad senare från
    // CloudPopups glide-tick) kan läsa senaste värdet utan att bindas om.
    const tiltedRef = useRef(tilted);
    tiltedRef.current = tilted;



    // Perspektiv-skalning i lutad vy: ett moln som ligger längre bort från
    // kameran (högre upp på skärmen i 3D-vyn) ritas mindre och kastas
    // svagare (mer friktion under glidet) så det inte flyger ut över kanten.
    // Ratio = skärm-pixlar-per-meter vid molnets nuvarande punkt jämfört med
    // kartans centrum. Pitch=0 → ratio = 1 överallt (ingen skalning/dämpning).
    // depthAtPoint får skärmpunkten och projicerar via map.unproject så det
    // funkar för molnets LIVE-position (ankare + drag/glid-offset), inte
    // bara dess geografiska ankarpunkt.
    const depthAtPoint = (screenX: number, screenY: number): number => {
        if (!tiltedRef.current) return 1;
        const map = mapRef.current;
        if (!map) return 1;
        const center = map.getCenter();
        const dlat = 0.0008;
        const c1 = map.project([center.lng, center.lat]);
        const c2 = map.project([center.lng, center.lat + dlat]);
        const cScale = Math.hypot(c2.x - c1.x, c2.y - c1.y);
        if (!isFinite(cScale) || cScale < 1e-4) return 1;
        const ll = map.unproject([screenX, screenY]);
        const a1 = map.project([ll.lng, ll.lat]);
        const a2 = map.project([ll.lng, ll.lat + dlat]);
        const aScale = Math.hypot(a2.x - a1.x, a2.y - a1.y);
        if (!isFinite(aScale)) return 1;
        return Math.min(Math.max(aScale / cScale, 0.3), 1.5);
    };
    const depthAtPointRef = useRef(depthAtPoint);
    depthAtPointRef.current = depthAtPoint;

    // Camera-follow: tapping ett moln pinnar det vid en skärmpunkt. Båda molnen
    // kan följas samtidigt — och kartan får dras fritt även medan de följs (panna
    // under molnen). När man kastar ett följt moln glider kameran med, och båda
    // pinnade moln stannar kvar på sina skärmpunkter hela vägen.
    const [mainFollowing, setMainFollowing] = useState(false);
    const [sunFollowing, setSunFollowing] = useState(false);
    const mainFollowingRef = useRef(mainFollowing);
    mainFollowingRef.current = mainFollowing;
    const sunFollowingRef = useRef(sunFollowing);
    sunFollowingRef.current = sunFollowing;
    // Skärmpunkten ett följt moln är fastpinnat vid. Geo-ankaret härleds från
    // den punkten varje frame så molnet stannar vid samma pixel medan kameran rör sig.
    const mainFollowPtRef = useRef<{ x: number; y: number } | null>(null);
    const sunFollowPtRef = useRef<{ x: number; y: number } | null>(null);

    // Off-screen-status för respektive moln. När geo-ankaret hamnar utanför
    // viewporten visar sidan en återkallnings-knapp jämte solen.
    const [mainOffScreen, setMainOffScreen] = useState(false);
    const [sunOffScreen, setSunOffScreen] = useState(false);
    const mainOffScreenRef = useRef(mainOffScreen);
    mainOffScreenRef.current = mainOffScreen;
    const sunOffScreenRef = useRef(sunOffScreen);
    sunOffScreenRef.current = sunOffScreen;

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
    // Tipsa om Fokus när molnet hämtats tillbaka (cloudRecalled) — inte när man
    // bara stängt start-molnet. Aktiverar INGET automatiskt; bara ett tips.
    useEffect(() => {
        if (cloudRecalled) setFeatureHint('focus');
    }, [cloudRecalled]);
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
    const onFocusToolHintRef = useRef(onFocusToolHint);
    onFocusToolHintRef.current = onFocusToolHint;
    useEffect(() => { onFocusToolHintRef.current?.(recenterToolBlink); }, [recenterToolBlink]);

    // Slangbella: aktiv när båda molnen ligger på (nästan) varandra på skärmen.
    const [slingshotActive, setSlingshotActive] = useState(false);
    const slingshotActiveRef = useRef(slingshotActive);
    slingshotActiveRef.current = slingshotActive;
    // Live drag-offset per moln, så slangbella-gummibanden hänger med molnet
    // när användaren drar i det. Nollställs när dragget släpps.
    const [mainLiveOffset, setMainLiveOffset] = useState({ x: 0, y: 0 });
    const [sunLiveOffset, setSunLiveOffset] = useState({ x: 0, y: 0 });


    // Perspektiv-skala per moln, beräknat på molnets LIVE skärmpunkt (ankare +
    // drag/glid-offset). Pitch=0 → alltid 1. I lutad vy: molnet uppåt på
    // skärmen (in i horisonten) → ratio < 1 → ritas mindre. Eftersom useMemo
    // beror på live-offsetten uppdateras skalan automatiskt även mitt under
    // glidet — molnet krymper smidigt när det glider in i djupet.
    const mainPerspectiveScale = useMemo(() => {
        if (!tilted || !cloudAnchorPos) return 1;
        return depthAtPoint(cloudAnchorPos.x + mainLiveOffset.x, cloudAnchorPos.y + mainLiveOffset.y);
    }, [tilted, cloudAnchorPos, mainLiveOffset]);
    const sunPerspectiveScale = useMemo(() => {
        if (!tilted || !sunCloudAnchorPos) return 1;
        return depthAtPoint(sunCloudAnchorPos.x + sunLiveOffset.x, sunCloudAnchorPos.y + sunLiveOffset.y);
    }, [tilted, sunCloudAnchorPos, sunLiveOffset]);

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

    // Kollar om något av molnen är i närheten av någon nål (baserat på skärmpixlar!) och sätter igång vattning
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Blommor-funktionen avstängd → ingen vattning startas (avbryt ev. pågående).
        if (!shopFlags.flowers) {
            if (wateringKey !== null) setWateringKey(null);
            return;
        }

        const liveCloudScreenCoords: { x: number; y: number }[] = [];

        // 1. Live position för huvudmolnet
        if (showCloud && cloudAnchorPos) {
            liveCloudScreenCoords.push({
                x: cloudAnchorPos.x + mainLiveOffset.x,
                y: cloudAnchorPos.y + mainLiveOffset.y
            });
        }

        // 2. Live position för solmolnet
        if (sunCloudAnchor && sunCloudAnchorPos) {
            liveCloudScreenCoords.push({
                x: sunCloudAnchorPos.x + sunLiveOffset.x,
                y: sunCloudAnchorPos.y + sunLiveOffset.y
            });
        }

        if (liveCloudScreenCoords.length === 0) {
            if (wateringKey !== null) {
                setWateringKey(null);
            }
            return;
        }

        let closestKey: string | null = null;
        let closestDist = Infinity;

        events.forEach(evt => {
            if (!evt.lat || !evt.lng) return;
            const key = `${evt.lat.toFixed(4)},${evt.lng.toFixed(4)}`;
            if (wateredKeys.has(key)) return;

            try {
                // Projektion till skärmkoordinater för att få samma avståndsbedömning oavsett zoom
                const pos = map.project([evt.lng, evt.lat]);

                for (const cloudPos of liveCloudScreenCoords) {
                    const dx = pos.x - cloudPos.x;
                    const dy = pos.y - cloudPos.y;
                    const dist = Math.hypot(dx, dy);

                    // Tröskel: 85 skärmpixlar (mycket enklare och mer intuitivt!)
                    if (dist < 85) {
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestKey = key;
                        }
                    }
                }
            } catch (e) {
                // ignorera
            }
        });

        if (closestKey !== wateringKey) {
            setWateringKey(closestKey);
        }
    }, [
        events,
        showCloud,
        cloudAnchorPos,
        mainLiveOffset,
        sunCloudAnchor,
        sunCloudAnchorPos,
        sunLiveOffset,
        wateredKeys,
        wateringKey,
        shopFlags.flowers
    ]);

    // Molnens nuvarande moods (rapporterade av respektive CloudPopup) + en
    // "incoming"-stämpel per moln. När man drar ett moln med en min över det
    // andra molnet får det andra molnet samma min.
    const [mainMood, setMainMood] = useState<CloudExpression | null>(null);
    const [sunMood, setSunMood] = useState<CloudExpression | null>(null);
    const mainMoodRef = useRef(mainMood); mainMoodRef.current = mainMood;
    const sunMoodRef = useRef(sunMood); sunMoodRef.current = sunMood;
    const [mainIncomingMood, setMainIncomingMood] = useState<{ mood: CloudExpression | null; nonce: number }>({ mood: null, nonce: 0 });
    const [sunIncomingMood, setSunIncomingMood] = useState<{ mood: CloudExpression | null; nonce: number }>({ mood: null, nonce: 0 });
    const slingshotEngagedRef = useRef(slingshotEngaged);
    slingshotEngagedRef.current = slingshotEngaged;
    // Snapshot av båda molns skärmpositioner i samma sekund slangbellan armas.
    // Används vid avfyrning för att räkna ut pull-vektorn (current - origin) och
    // avgöra vilket moln som är "projektilen" (det som flyttats längst).
    const engageSnapshotRef = useRef<{ main: { x: number; y: number } | null; sun: { x: number; y: number } | null }>({ main: null, sun: null });
    useEffect(() => {
        if (slingshotEngaged) {
            engageSnapshotRef.current = {
                main: cloudAnchorPosRef.current ? { ...cloudAnchorPosRef.current } : null,
                sun: sunCloudAnchorPosRef.current ? { ...sunCloudAnchorPosRef.current } : null,
            };
        } else {
            engageSnapshotRef.current = { main: null, sun: null };
        }
    }, [slingshotEngaged]);

    const baseZoomRef = useRef<number>(8);

    // Live glide-snapshot från respektive moln. CloudPopup skriver hit varje
    // glid-frame och nollar när molnet stannat. Används av fokus-knappen för
    // att kunna "jaga" ett moln som fortfarande är i rörelse — utan detta
    // läser vi det gamla ankaret (där molnet kastades ifrån) eftersom det inte
    // commitas förrän glidet är slut.
    const mainGlideStateRef = useRef<{ sp: { x: number; y: number }; vx: number; vy: number } | null>(null);
    const sunGlideStateRef = useRef<{ sp: { x: number; y: number }; vx: number; vy: number } | null>(null);

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

    const geoGridRef = useRef<Map<string, { key: string; group: LinkEvent[]; mx: number; my: number }[]>>(new Map());
    const GEO_GRID_CELL_SIZE = 100000; // 100 km celler

    useEffect(() => {
        const grid = new Map<string, { key: string; group: LinkEvent[]; mx: number; my: number }[]>();
        for (const [key, group] of groups.entries()) {
            const rep = group[0];
            if (rep && typeof rep.lng === 'number' && typeof rep.lat === 'number') {
                const m = lngLatToMerc(rep.lng, rep.lat);
                const gx = Math.floor(m.x / GEO_GRID_CELL_SIZE);
                const gy = Math.floor(m.y / GEO_GRID_CELL_SIZE);
                const gkey = `${gx},${gy}`;
                let list = grid.get(gkey);
                if (!list) {
                    list = [];
                    grid.set(gkey, list);
                }
                list.push({ key, group, mx: m.x, my: m.y });
            }
        }
        geoGridRef.current = grid;
    }, [groups]);

    // ── Pinball / Flipper-läge: refs, helpers och pekar-hanterare ─────────────
    // All fysik/rendering bor i refs (ingen React-setState i rAF-loopen). Loopen
    // + render-funktionerna lever inuti livscykel-effekten längre ned och läser
    // dessa refs varje frame; pekar-hanterarna här muterar dem.
    const pinballModeRef = useRef(pinballMode);
    pinballModeRef.current = pinballMode;
    // Spelarens valda färgton, läst live i aimLoop (så färgbyte i profilen slår
    // igenom direkt utan att starta om flipper-effekten).
    const myReviretHueRef = useRef(myReviretHue);
    myReviretHueRef.current = myReviretHue;
    const onPinballHitRef = useRef(onPinballHit);
    onPinballHitRef.current = onPinballHit;
    const onPinballLaunchRef = useRef(onPinballLaunch);
    onPinballLaunchRef.current = onPinballLaunch;

    const pinCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const pinBallRef = useRef<PinBall | null>(null);
    const pinBumpersRef = useRef<PinBumper[]>([]);
    const pinGridRef = useRef<PinGrid>({ near: () => [] });
    const pinBoardRef = useRef<PinBoard>({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    const pinPadRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const pinPullRef = useRef<{ x: number; y: number } | null>(null);
    const pinAimingRef = useRef(false);
    const pinSizeRef = useRef<{ W: number; H: number; dpr: number }>({ W: 0, H: 0, dpr: 1 });
    const pinRafRef = useRef(0);
    const pinAccRef = useRef(0);
    const pinLastTRef = useRef(0);
    const pinFlightStartRef = useRef(0);
    // Flytta/Skjut-läge: true = kartan är fri att panorera/zooma (DEFAULT), false = skjut-läge
    const [pinMoveMode, setPinMoveMode] = useState(true);
    const pinMoveModeRef = useRef(true);
    pinMoveModeRef.current = pinMoveMode;
    // Geo-läge: livscykel-effekten exponerar "åk till lng/lat" här så HUD-knappen kan trigga om.
    const pinGeoTravelRef = useRef<((target: [number, number]) => void) | null>(null);
    // Skott + kollision: boll-markören (för att projicera dess skärmläge vid avfyrning),
    // drag-start/-aktuell pekarpunkt (skärm-px), unika träffar i pågående skott, och
    // antalet träffar som visas i HUD:en.
    const pinGeoBallRef = useRef<maplibregl.Marker | null>(null);
    const pinShotStartRef = useRef<{ x: number; y: number } | null>(null);
    const pinShotCurRef = useRef<{ x: number; y: number } | null>(null);
    const pinHitKeysRef = useRef<Set<string>>(new Set());
    const [pinShotHits, setPinShotHits] = useState(0);
    const pinFloatTextsRef = useRef<{ x: number; y: number; text: string; age: number; maxAge: number }[]>([]);
    const pinRingsRef = useRef<{ x: number; y: number; startR: number; age: number; maxAge: number }[]>([]);


    // ── Reviret (territorie-läget ovanpå pinball) ─────────────────────────────
    // Kulan målar de geografiska hex-rutor den rullar genom. revPaintedRef håller
    // målade cell-id:n (geografiska, stabila), revScreenRef cachar projicerade
    // hörn per session (kameran är fryst → projektionen är konstant) och
    // revPrevRef minns kulans förra position så vi kan måla HELA banan, inte bara
    // ett stickprov per frame. revStats speglar revir-storleken till HUD:en
    // (sätts bara när ett skott parkeras → noll setState i hot-loopen).
    const revActiveRef = useRef(false);
    const revPaintedRef = useRef<Set<string>>(new Set());
    const revScreenRef = useRef<Map<string, number[]>>(new Map());
    const revPrevRef = useRef<{ x: number; y: number } | null>(null);
    const [revStats, setRevStats] = useState<{ cells: number; events: number; enclosed: number; pioneer: number } | null>(null);
    // Topplista (dagens bästa resultat) + andra spelares territorier från Firestore.
    // remoteTerrRef = rutor andra (och jag tidigare idag) claimat, cell→{owner,color};
    // revWrittenRef = rutor jag redan sparat detta session (claimar bara nytillkomna).
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [myUid, setMyUid] = useState<string | null>(null);
    // Topplistans rankning: 'points' = störst revir, 'events' = flest besökta event.
    const [lbSort, setLbSort] = useState<'points' | 'events'>('points');
    const remoteTerrRef = useRef<Map<string, TerritoryCell>>(new Map());
    const revWrittenRef = useRef<Set<string>>(new Set());

    // Visa/göm ett GL-lager från komponent-scope (livscykel-effekten gömmer de
    // vanliga event-lagren i pinball-läget så eventen inte ritas dubbelt).
    const setGlLayerVisible = useCallback((id: string, visible: boolean) => {
        const m = mapRef.current;
        if (m && m.getLayer(id)) m.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    }, []);

    // Lägg kulan på plungern (mitten av skärmen), armad och stilla.
    const pinSeatBall = useCallback(() => {
        const pad = pinPadRef.current; // pad är alltid W/2, H/2 i geo-follow-läge
        pinBallRef.current = { x: pad.x, y: pad.y, vx: 0, vy: 0, r: PIN_BALL_R, alive: false, armed: true, lastHitKey: null };
    }, []);

    // Skott-input (GEO-läge, Skjut): dra åt ett håll och släpp → bollen flickas dit
    // (kraft ∝ draget). target-px = bollens skärmläge + drag·GAIN, översätts till
    // lng/lat via unproject och skjuts via pinGeoTravelRef (som även kör kollisionen).
    // I Flytta-läge (pinMoveMode) är de no-op så kartan panorerar/zoomar fritt.
    const onPinPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (pinMoveModeRef.current) return; // flytta-läge: låt kartan hantera touch
        try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* ignorera */ }
        const rect = pinCanvasRef.current!.getBoundingClientRect();
        const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        pinShotStartRef.current = p; pinShotCurRef.current = p;
    }, []);
    const onPinPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (pinMoveModeRef.current || !pinShotStartRef.current) return;
        const rect = pinCanvasRef.current!.getBoundingClientRect();
        pinShotCurRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);
    const onPinPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
        if (pinMoveModeRef.current) return;
        const start = pinShotStartRef.current;
        pinShotStartRef.current = null; pinShotCurRef.current = null;
        const map = mapRef.current, ballM = pinGeoBallRef.current, travel = pinGeoTravelRef.current;
        if (!start || !map || !ballM || !travel) return;
        // Läs släpp-positionen DIREKT från eventet (robust även om pointermove inte
        // hann uppdatera under draget → annars blev draget 0 och inget skott avfyrades).
        const rect = pinCanvasRef.current!.getBoundingClientRect();
        const relX = e.clientX - rect.left, relY = e.clientY - rect.top;
        const dragX = relX - start.x, dragY = relY - start.y;
        if (Math.hypot(dragX, dragY) < 14) return; // tryck utan drag → inget skott
        const bp = map.project(ballM.getLngLat());
        const GAIN = 2.4;
        const ll = map.unproject([bp.x - dragX * GAIN, bp.y - dragY * GAIN]);
        travel([ll.lng, ll.lat]);
    }, []);

    // En grupp är "speciell" om den behöver den rika DOM-brickan (animationer,
    // sifferbricka, vattning, highlight). Övriga renderas billigt i GL-lagret.
    // Samma predikat används både för att VÄLJA DOM-grupper (visibleGroups) och
    // för att UTESLUTA dem ur GL-lagret — så ingen markör dubbelritas.
    const isSpecialGroup = useCallback((group: LinkEvent[], key: string, nowMs: number): boolean => {
        if (pinballMode) {
            return !!PIN_GEO_MODE;
        }
        // I spelläget highlightas ALDRIG det valda (skulle avslöja målet) — då
        // ska målet ligga kvar som vanlig GL-markör.
        if (!gameMode && selectedEvent && group.some(e => e.id === selectedEvent.id)) return true;
        if (goldEventId && group.some(e => e.id === goldEventId)) return true;
        if (guessedEventId && group.some(e => e.id === guessedEventId)) return true;
        if (group.some(e => savedEventIds.has(e.id))) return true;
        if (group.some(e => e.userCreated)) return true;
        if (group.length > 1) return true; // grupp → sifferbricka + slideshow-cykler
        if (wateredKeys.has(key) || wateringKey === key) return true;
        if (group.every(e => discardedEventIds.has(e.id))) return true; // dämpad DOM-bricka
        if (group.some(e => e.time && e.time.getTime() > nowMs && e.time.getTime() - nowMs <= 60 * 60 * 1000)) return true;
        return false;
    }, [pinballMode, gameMode, selectedEvent, goldEventId, guessedEventId, savedEventIds, wateredKeys, wateringKey, discardedEventIds]);

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
            (!gameMode && selectedEvent && group.some(e => e.id === selectedEvent.id)) ||
            (!!guessedEventId && group.some(e => e.id === guessedEventId)) ||
            (!!goldEventId && group.some(e => e.id === goldEventId));

        const out: [string, LinkEvent[]][] = [];
        for (const entry of groups.entries()) {
            const [key, group] = entry;
            if (!isSpecialGroup(group, key, nowMs)) continue;
            if (mustShow(group)) { out.push(entry); continue; }
            const rep = group[0];
            // Range-validering (inte bara falsy): en projicerad koordinat som
            // lat=6129956 får annars LngLatBounds.contains att kasta och
            // kraschar hela kartan.
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            if (paddedBounds.contains([rep.lng, rep.lat])) out.push(entry);
        }
        return out;
    }, [groups, mapBounds, selectedEvent, gameMode, guessedEventId, goldEventId, isSpecialGroup]);

    // GL-lagret: alla ICKE-speciella grupper (huvuddelen). Byggs som GeoJSON +
    // den uppsättning brick-bilder (emoji × ev. källfärg) som behöver bakas. Hela
    // världen ligger i källan — MapLibre kullar och avkrockar själv på GPU:n
    // (icon-allow-overlap false), så vi behöver ingen egen viewport-gallring här.
    // Event från en "stor" källa (PRO/Korpen/Svenska kyrkan) får standard mörk bricka;
    // alla övriga event färgas efter sin kategori.
    const plainData = useMemo(() => {
        const nowMs = Date.now();
        const features: PlainFeature[] = [];
        const icons = new Map<string, { emoji: string; color?: string }>();
        for (const [key, group] of groups) {
            if (isSpecialGroup(group, key, nowMs)) continue;
            const rep = group[0];
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            const catKey = rep.category && EVENT_CATEGORIES[rep.category] ? rep.category : 'other';
            const emoji = rep.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');
            // Stor källa (PRO/Korpen/Svenska kyrkan) → ingen färg (mörk standard).
            // Alla andra → kategori-färg.
            const isBigSrc = sourceColor(rep.url || rep.id) !== null;
            const color = isBigSrc
                ? undefined
                : ((EVENT_CATEGORIES[catKey as EventCategoryType] as { markerHex?: string }).markerHex ?? undefined);
            const iconId = color ? `bricka:${color}:${emoji}` : `bricka:${emoji}`;
            if (!icons.has(iconId)) icons.set(iconId, { emoji, color });
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rep.lng!, rep.lat!] },
                properties: { icon: iconId, key },
            });
        }
        return { features, icons };
    }, [groups, isSpecialGroup]);
    const plainFeaturesRef = useRef<PlainFeature[]>([]);
    const usedIconsRef = useRef<Map<string, { emoji: string; color?: string }>>(new Map());
    // Nyckel = hela ikon-id:t (bricka:[färg:]emoji) så färgvarianter cachas separat.
    const bakedIconsRef = useRef<Map<string, { data: ImageData; pixelRatio: number }>>(new Map());

    // Installerar/uppdaterar GL-markörlagret: källa + bakade emoji-bilder + lager,
    // och pushar senaste datan. Idempotent — säker att kalla efter varje stilbyte
    // (setStyle rensar källor/bilder/lager, så de måste återinstalleras).
    const syncPlainLayer = useCallback(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        try {
            if (!map.getSource('plain-events')) {
                map.addSource('plain-events', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                    // Native MapLibre-klustring: närliggande event slås ihop till en
                    // bubbla (med antal) tills man zoomar in förbi clusterMaxZoom.
                    // clusterRadius i px = hur nära två punkter måste vara för att slås
                    // ihop. Detaljerna (brickorna) tar över när klustret löses upp.
                    cluster: true,
                    clusterRadius: 50,
                    clusterMaxZoom: 12,
                });
            }
            // Baka (eller återanvänd) bild för varje brick-variant (emoji × källfärg).
            usedIconsRef.current.forEach(({ emoji, color }, id) => {
                if (map.hasImage(id)) return;
                let baked = bakedIconsRef.current.get(id);
                if (!baked) {
                    const b = makeBrickaImageData(emoji, color);
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
                    // Bara icke-klustrade punkter får bricka — klustren ritas av
                    // cluster-lagren nedan.
                    filter: ['!', ['has', 'point_count']],
                    layout: {
                        'icon-image': ['get', 'icon'],
                        // Spetsen (nederkanten av bilden) på koordinaten.
                        'icon-anchor': 'bottom',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                        // Storlek matchad mot DOM-brickorna (~38px kropp) så enskilda
                        // GL-event och fler-event-grupper (DOM) ser lika stora ut.
                        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.78, 9, 0.9, 13, 0.98],
                        'symbol-z-order': 'source',
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
                    // Endast icke-klustrade punkter blir nålar/prickar.
                    filter: ['!', ['has', 'point_count']],
                    layout: { 'visibility': 'none' },
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 3.5, 14, 4.5],
                        'circle-color': '#1e293b',
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.5,
                    },
                });
            }
            // Kluster-bubblan: en cirkel vars storlek/färg trappas med antalet event
            // den döljer. Filtret 'has point_count' matchar bara aggregerade noder.
            if (!map.getLayer('plain-events-clusters')) {
                map.addLayer({
                    id: 'plain-events-clusters',
                    type: 'circle',
                    source: 'plain-events',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': ['step', ['get', 'point_count'],
                            '#3b82f6', 10, '#6366f1', 50, '#8b5cf6', 200, '#a855f7'],
                        'circle-radius': ['step', ['get', 'point_count'],
                            16, 10, 20, 50, 26, 200, 34],
                        'circle-opacity': 0.9,
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 2,
                    },
                });
            }
            // Antalet event inuti klustret, centrerat i bubblan.
            if (!map.getLayer('plain-events-cluster-count')) {
                map.addLayer({
                    id: 'plain-events-cluster-count',
                    type: 'symbol',
                    source: 'plain-events',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': ['get', 'point_count_abbreviated'],
                        'text-font': ['Open Sans Bold'],
                        'text-size': ['step', ['get', 'point_count'], 12, 50, 14, 200, 16],
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                    },
                    paint: {
                        'text-color': '#ffffff',
                    },
                });
            }
            const src = map.getSource('plain-events') as maplibregl.GeoJSONSource | undefined;
            src?.setData({ type: 'FeatureCollection', features: plainFeaturesRef.current as unknown as GeoJSON.Feature[] });
        } catch (err) {
            console.warn('Kunde inte synka GL-markörlagret', err);
        }
    }, []);
    const syncPlainLayerRef = useRef(syncPlainLayer);
    syncPlainLayerRef.current = syncPlainLayer;

    // Pusha ny GL-data när de icke-speciella grupperna ändras. Väntar på att
    // stilen är redo (annars finns ingen källa att skriva till).
    useEffect(() => {
        plainFeaturesRef.current = plainData.features;
        usedIconsRef.current = plainData.icons;
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) {
            syncPlainLayerRef.current();
        } else {
            const h = () => syncPlainLayerRef.current();
            map.once('style.load', h);
            return () => { map.off('style.load', h); };
        }
    }, [plainData]);

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
                md.element.onclick = (e) => {
                    e.stopPropagation();
                    if (gameModeRef.current) { onGuessRef.current?.(group); return; }
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
        if (!selectedEvent || selectedEvent.lat == null || selectedEvent.lng == null) {
            visitedOrderRef.current = [];
            visitedGroupKeyRef.current = null;
            return;
        }
        const gk = `${selectedEvent.lat.toFixed(4)},${selectedEvent.lng.toFixed(4)}`;
        if (gk !== visitedGroupKeyRef.current) {
            visitedGroupKeyRef.current = gk;
            visitedOrderRef.current = [selectedEvent.id];
        } else if (!visitedOrderRef.current.includes(selectedEvent.id)) {
            visitedOrderRef.current.push(selectedEvent.id);
        }
    }, [selectedEvent]);

    // 1. Initiera MapLibre kartan en gång
    useEffect(() => {
        if (!mapContainerRef.current) return;

        let map: maplibregl.Map;
        try {
        map = new maplibregl.Map({
            container: mapContainerRef.current,
            // Initial style matchar default-värdet på mapStyle (satellit) så
            // kartan inte måste byta stil direkt efter mount → ingen flicker.
            style: SATELLITE_STYLE,
            center: [14.4664, 58.0257], // Lng, Lat (Gränna, vid Vättern)
            zoom: 5,
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
            refreshExpiredTiles: false
        });
        } catch (err) {
            // WebGL kunde inte initieras (ofta "blocked" efter en tidigare
            // kontextförlust). Krascha inte hela appen — visa fallback i stället.
            console.error('Kartan kunde inte initieras (WebGL)', err);
            setMapError(true);
            return;
        }

        mapRef.current = map;


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
            setGlLayer('plain-events-dots', false);
        };

        map.on('zoomstart', showNeedles);
        map.on('zoomend', showBricks);

        // GL-lager som är klickbara: brickorna (inzoomat) + prickarna (utzoomat).
        // Punkt-lagren väljer ett event; kluster-lagret zoomar in i stället.
        const glPointLayers = ['plain-events', 'plain-events-dots'];
        const glHitLayers = [...glPointLayers, 'plain-events-clusters'];
        const glLayersPresent = () => glHitLayers.filter(id => map.getLayer(id));

        map.on('click', (e) => {
            // GEO-FLIPPER: tryck på kartan = SKJUT bollen dit du tryckte (+ stäng ev.
            // öppet kort). Robust — kartans klick fyras alltid (inget canvas/läge krävs).
            if (pinballModeRef.current) {
                pinGeoTravelRef.current?.([e.lngLat.lng, e.lngLat.lat]);
                onSelectEventRef.current(null);
                return;
            }
            // I gissningsläge ska ett klick på tom karta inte stänga mål-kortet
            // (det skulle avbryta rundan av misstag).
            if (gameModeRef.current) return;
            // Klick på en GL-markör/prick hanteras av lager-handlern nedan (väljer
            // eventet) — avmarkera då inte. queryRenderedFeatures kastar om inget
            // av lagren finns ännu, så vi vaktar.
            const layers = glLayersPresent();
            if (layers.length) {
                const hits = map.queryRenderedFeatures(e.point, { layers });
                if (hits.length) return;
            }
            onSelectEventRef.current(null);
        });

        // GL-markör/prick klickad → välj eventet (eller gissa i spelläget). Handlern
        // registreras en gång; den matchar lagret så fort det (åter)installerats.
        const onGlMarkerClick = (e: maplibregl.MapLayerMouseEvent) => {
            if (pinballModeRef.current) return;
            const feat = e.features && e.features[0];
            const key = feat?.properties?.key as string | undefined;
            const group = key ? groupsRef.current.get(key) : undefined;
            if (!group || group.length === 0) return;
            if (gameModeRef.current) { onGuessRef.current?.(group); return; }
            onSelectEventRef.current(group[0]);
        };
        // Klick på en kluster-bubbla → zooma in till den nivå där klustret löses upp
        // (MapLibre räknar ut den åt oss) och centrera på bubblan.
        const onClusterClick = (e: maplibregl.MapLayerMouseEvent) => {
            if (pinballModeRef.current || gameModeRef.current) return;
            const feat = e.features && e.features[0];
            const clusterId = feat?.properties?.cluster_id;
            if (clusterId == null) return;
            const src = map.getSource('plain-events') as maplibregl.GeoJSONSource | undefined;
            if (!src) return;
            const coords = (feat!.geometry as GeoJSON.Point).coordinates as [number, number];
            src.getClusterExpansionZoom(clusterId)
                .then(zoom => map.easeTo({ center: coords, zoom }))
                .catch(() => {});
        };
        const setPointer = () => { const c = map.getCanvas(); if (c) c.style.cursor = 'pointer'; };
        const clearPointer = () => { const c = map.getCanvas(); if (c) c.style.cursor = ''; };
        glPointLayers.forEach(id => {
            map.on('click', id, onGlMarkerClick);
        });
        map.on('click', 'plain-events-clusters', onClusterClick);
        glHitLayers.forEach(id => {
            map.on('mouseenter', id, setPointer);
            map.on('mouseleave', id, clearPointer);
        });

        map.on('drag', () => {
            if (onMapDragRef.current) {
                onMapDragRef.current();
            }
        });

        // Real-time projection updater for the anchored cloud popups (main +
        // any sun-clouds that are currently alive).
        const updateCloudPosition = () => {
          // Molnen är avstängda (CLOUDS_ENABLED=false) → hoppa över all moln-
          // projicering (per-frame setState). Gissningslinjen längre ner körs
          // ändå eftersom den hör till "Hitta event"-spelet, inte molnen.
          if (CLOUDS_ENABLED) {
            // Följt moln: skärmpunkten är konstant. Vi uppdaterar i stället
            // geo-ankaret varje frame så det matchar latlng under den pinnen
            // — molnet vandrar "med" användaren när kartan pannas/zoomas.
            const mainPt = mainFollowPtRef.current;
            if (mainFollowingRef.current && mainPt) {
                const ll = map.unproject([mainPt.x, mainPt.y]);
                const prevAnchor = cloudAnchorRef.current;
                if (!prevAnchor || Math.abs(prevAnchor.lat - ll.lat) > 1e-7 || Math.abs(prevAnchor.lng - ll.lng) > 1e-7) {
                    cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                    setCloudAnchor({ lat: ll.lat, lng: ll.lng });
                }
            } else {
                // Fritt ankare — projicera geo till skärm.
                const currentAnchor = cloudAnchorRef.current;
                if (currentAnchor) {
                    const pos = map.project([currentAnchor.lng, currentAnchor.lat]);
                    const prev = cloudAnchorPosRef.current;
                    if (!prev || Math.round(prev.x) !== Math.round(pos.x) || Math.round(prev.y) !== Math.round(pos.y)) {
                        setCloudAnchorPos({ x: pos.x, y: pos.y });
                    }
                }
            }

            const sunPt = sunFollowPtRef.current;
            if (sunFollowingRef.current && sunPt) {
                const ll = map.unproject([sunPt.x, sunPt.y]);
                const prevAnchor = sunCloudAnchorRef.current;
                if (!prevAnchor || Math.abs(prevAnchor.lat - ll.lat) > 1e-7 || Math.abs(prevAnchor.lng - ll.lng) > 1e-7) {
                    sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                    setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
                }
            } else {
                const currentSunAnchor = sunCloudAnchorRef.current;
                if (currentSunAnchor) {
                    const pos = map.project([currentSunAnchor.lng, currentSunAnchor.lat]);
                    const prev = sunCloudAnchorPosRef.current;
                    if (!prev || Math.round(prev.x) !== Math.round(pos.x) || Math.round(prev.y) !== Math.round(pos.y)) {
                        setSunCloudAnchorPos({ x: pos.x, y: pos.y });
                    }
                }
            }
            // Skala med zoom: 2x per zoom-nivå relativt skapande-zoomen.
            if (sunCloudAnchorRef.current) {
                const zoomDelta = map.getZoom() - sunCloudCreationZoomRef.current;
                const scaled = Math.min(Math.max(SUN_CLOUD_BASE_SCALE * Math.pow(2, zoomDelta), 0.25), CLOUD_MAX_SCALE);
                setSunCloudScale((prevScale) => Math.abs(prevScale - scaled) > 0.001 ? scaled : prevScale);
            }
          } // slut if (CLOUDS_ENABLED)

            // Gissnings-streck: projicera geo→skärm varje frame så strecket sitter
            // fast mellan gissningen och rätt svar medan kartan zoomar/pannas.
            const gl = guessLineRef.current;
            if (gl) {
                const pf = map.project([gl.from.lng, gl.from.lat]);
                const pt = map.project([gl.to.lng, gl.to.lat]);
                setGuessLineScreen((prev) => {
                    if (prev
                        && Math.round(prev.from.x) === Math.round(pf.x) && Math.round(prev.from.y) === Math.round(pf.y)
                        && Math.round(prev.to.x) === Math.round(pt.x) && Math.round(prev.to.y) === Math.round(pt.y)) return prev;
                    return { from: { x: pf.x, y: pf.y }, to: { x: pt.x, y: pt.y } };
                });
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
        });

        return () => {
            if (moveEndTimer) clearTimeout(moveEndTimer);
            if (glCanvas && onCtxLost) glCanvas.removeEventListener('webglcontextlost', onCtxLost as EventListener);
            if (glCanvas && onCtxRestored) glCanvas.removeEventListener('webglcontextrestored', onCtxRestored as EventListener);
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

    // Luta kameran när solknappen togglar tilt: pitch 60° = sidovy, 0° = platt.
    // Hoppar över det initiala körningen (då tilt redan matchar kartans 0°).
    const prevTiltedRef = useRef(tilted);
    useEffect(() => {
        if (prevTiltedRef.current === tilted) return;
        prevTiltedRef.current = tilted;
        const map = mapRef.current;
        if (!map) return;
        driftSuppressUntilRef.current = performance.now() + 1400;
        map.easeTo({ pitch: tilted ? 60 : 0, duration: 900 });
    }, [tilted]);

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

    // Flyg kameran så det valda eventet hamnar i vy (vi går TILL eventet —
    // eventet flyttas aldrig till oss). Återanvänds av både val-effekten nedan
    // och recenter-knappen på eventkortet.
    const recenterOnSelected = () => {
        const map = mapRef.current;
        if (!map) return;

        if (!selectedEvent || !selectedEvent.lat || !selectedEvent.lng) return;

        const currentZoom = map.getZoom();
        const maxZoom = map.getMaxZoom();

        if (cardExpanded) {
            if (baseZoomRef.current === 8) {
                baseZoomRef.current = currentZoom;
            }
        }
        const targetZoom = cardExpanded
            ? Math.min(baseZoomRef.current + 1, maxZoom)
            : baseZoomRef.current;

        const nextZoom = Math.max(currentZoom, targetZoom);

        if (!cardExpanded) {
            baseZoomRef.current = 8;
        }

        const targetYRatio = cardExpanded ? 0.32 : 0.40;
        // Negative offset relative to center moves it towards the top of the viewport
        const yOffset = map.getContainer().clientHeight * (targetYRatio - 0.5);

        driftSuppressUntilRef.current = performance.now() + 1500;
        map.easeTo({
            center: [selectedEvent.lng, selectedEvent.lat],
            zoom: nextZoom,
            offset: [0, yOffset],
            duration: 500
        });
    };

    // Dagbyte: stå still. När daySwitchNonce bumpas öppnar vi ett kort fönster där
    // val-effekten nedan INTE flyttar kameran (täcker både select-bytet och att
    // kortet öppnas direkt efteråt). Måste deklareras FÖRE val-effekten så den
    // hinner sätta fönstret innan val-effekten körs samma commit. Recenter-KNAPPEN
    // går via recenterOnSelected direkt och påverkas inte.
    const suppressAutoRecenterUntilRef = useRef(0);
    const prevDaySwitchNonceRef = useRef(daySwitchNonce);
    useEffect(() => {
        if (daySwitchNonce !== prevDaySwitchNonceRef.current) {
            prevDaySwitchNonceRef.current = daySwitchNonce;
            suppressAutoRecenterUntilRef.current = performance.now() + 1500;
        }
    }, [daySwitchNonce]);


    // 2. Hantera kamera-panorering och zoomning vid val av event.
    //    I gissningsläge flyttar vi ALDRIG kameran till det valda eventet — då
    //    skulle spelaren ju få mål-eventets position serverad direkt.
    useEffect(() => {
        if (gameMode || pinballMode) return; // pinball: kameran är fryst, träffat event flyger inte fram
        // Dagbyte just nu → rör inte kameran (vyn ska stå still).
        if (performance.now() < suppressAutoRecenterUntilRef.current) return;
        recenterOnSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded, gameMode, pinballMode]);

    // ── Pinball/Flipper: livscykel + rAF-loop ────────────────────────────────
    // Körs när läget slås på: frys + platta kameran, göm de vanliga event-lagren,
    // sätt upp canvas + offscreen-fält, bygg studsare och kör fysik-loopen tills
    // läget stängs av (då allt rivs och kartan tinas upp igen).
    useEffect(() => {
        if (!pinballMode) return;
        const map = mapRef.current;
        const canvas = pinCanvasRef.current;
        const container = mapContainerRef.current;
        if (!map || !canvas || !container) return;

        if (PIN_GEO_MODE) {
            let priorProj = 'mercator';
            try { const p = map.getProjection?.() as { type?: string } | undefined; if (p?.type) priorProj = p.type; } catch { /* default mercator */ }
            const prior = {
                pitch: map.getPitch(), bearing: map.getBearing(),
                center: map.getCenter(), zoom: map.getZoom(),
                minZoom: map.getMinZoom(), maxZoom: map.getMaxZoom(), maxBounds: map.getMaxBounds(),
            };
            map.stop();
            // Rensa canvasen (ev. gammal bumper-/boll-ritning) — vi ritar inget på den i geo-läget.
            const c2 = canvas.getContext('2d');
            if (c2) { c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, canvas.width, canvas.height); }
            map.setPitch(0); map.setBearing(0);
            try { map.setProjection({ type: 'globe' }); } catch { /* äldre maplibre saknar globe */ }
            map.setMaxBounds(null);
            map.fitBounds(new maplibregl.LngLatBounds(SWEDEN_BOUNDS[0], SWEDEN_BOUNDS[1]), { padding: 24, animate: false });
            map.setMinZoom(PIN_FLIP_MIN_ZOOM); // inte zooma ut för långt
            map.setMaxZoom(PIN_FLIP_MAX_ZOOM); // inte zooma in förbi satellit-datan
            map.setMaxBounds(new maplibregl.LngLatBounds(SWEDEN_PAN_LIMIT[0], SWEDEN_PAN_LIMIT[1]));

            const ballEl = document.createElement('div');
            ballEl.className = 'pin-geo-ball';
            const startLngLat = userPos ? ([userPos.lng, userPos.lat] as [number, number]) : SWEDEN_CENTER;
            const ball = new maplibregl.Marker({ element: ballEl }).setLngLat(startLngLat).addTo(map);

            pinGeoBallRef.current = ball; // så skott-handlers kan projicera bollens skärmläge

            if (userPos) {
                // Om vi redan har en användarposition, flyg dit direkt så man startar fokuserad
                map.flyTo({ center: [userPos.lng, userPos.lat], zoom: 14, duration: 800 });
            }

            // ── DPR + canvas setup för siktlinje-overlay ─────────────────────
            const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
            const setupGeoCanvas = () => {
                const W = container.clientWidth, H = container.clientHeight;
                canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
                pinSizeRef.current = { W, H, dpr };
            };
            setupGeoCanvas();
            const ctx = canvas.getContext('2d');

            // ── Reviret: kulan målar hex-rutorna den rullar genom ────────────
            revActiveRef.current = isFeatureOn('reviret');
            revPaintedRef.current.clear();
            revPrevRef.current = null;
            setRevStats(revActiveRef.current ? { cells: 0, events: 0, enclosed: 0, pioneer: 0 } : null);
            let revInterior = new Set<string>(); // inneslutna o-rullade rutor (flood-fill)
            let revHull: [number, number][] = []; // revirets ytterform (konvex hull) — solid massa utzoomat
            let revLastStatT = 0;    // throttle för live-statuppdatering (poängen klättrar medan man rullar)
            let revLastStatSize = -1; // senast rapporterade rut-antal (uppdatera bara när nymark tillkommit)
            const revCountEvents = (): number => {
                const painted = revPaintedRef.current;
                if (!painted.size) return 0;
                let n = 0;
                for (const group of groupsRef.current.values()) {
                    for (const ev of group) {
                        if (isValidLatLng(ev.lat, ev.lng) && painted.has(lngLatToCell(ev.lng!, ev.lat!))) n++;
                    }
                }
                return n;
            };
            // Måla hex-rutorna längs kulans geo-bana. Interpolerar i Web-Mercator-
            // meter (halv cellbredd) så ingen smal ruta hoppas över oavsett zoom.
            const revPaintTo = (lng: number, lat: number) => {
                if (!revActiveRef.current) return;
                const m = lngLatToMerc(lng, lat);
                const prev = revPrevRef.current;
                if (prev) {
                    const dist = Math.hypot(m.x - prev.x, m.y - prev.y);
                    const steps = Math.max(1, Math.ceil(dist / (HEX_SIZE_MERC * 0.5)));
                    for (let i = 1; i <= steps; i++) {
                        const t = i / steps;
                        const ss = mercToLngLat(prev.x + (m.x - prev.x) * t, prev.y + (m.y - prev.y) * t);
                        revPaintedRef.current.add(lngLatToCell(ss.lng, ss.lat));
                    }
                } else {
                    revPaintedRef.current.add(lngLatToCell(lng, lat));
                }
                revPrevRef.current = m;
            };
            const onRevToggleGeo = () => {
                revActiveRef.current = isFeatureOn('reviret');
                setRevStats(revActiveRef.current
                    ? { cells: revPaintedRef.current.size, events: revCountEvents(), enclosed: revInterior.size, pioneer: countPioneer(revPaintedRef.current, revInterior) }
                    : null);
            };
            window.addEventListener(FEATURE_CHANGE_EVENT, onRevToggleGeo);

            // ── Min färg: rita mitt revir i min spelarfärg (annars neutral blå).
            // Själva färgtonen läses LIVE i aimLoop (myReviretHueRef) så ett färgbyte
            // i profilen slår igenom utan att starta om flipper-effekten.
            const myIdent = myReviretIdentity();
            setMyUid(myIdent?.uid ?? null);

            // ── Topplista + andra spelares territorier (Firestore, bäst-möjligt) ─
            // Topplistan är global (dagens bästa); territorierna prenumereras per
            // vy-region och resubbas vid moveend (kameran är fri i geo-läget).
            // VIKTIGT: snapshots MERGE:as in i remoteTerrRef (ersätter den ALDRIG).
            // Annars byts hela kartan ut när 30-regioners-fönstret glider → tidigare
            // laddad mark töms/laddas om i kanterna = "den flyttas och håller på".
            // Rutor tas aldrig bort i reglerna (bara om-färgas) → merge är säker.
            revWrittenRef.current = new Set();
            remoteTerrRef.current = new Map();
            const unsubLeaderboard = subscribeDailyLeaderboard(setLeaderboard, 6);
            let terrUnsub: () => void = () => {};
            let lastRegionKey = '';
            let terrResubTimer = 0;
            const resubTerritory = () => {
                const b = map.getBounds();
                const regions = regionsForBounds(b.getWest(), b.getSouth(), b.getEast(), b.getNorth());
                const key = regions.slice(0, 30).join('|');
                if (key === lastRegionKey) return; // samma buckets → behåll lyssnaren
                lastRegionKey = key;
                terrUnsub();
                terrUnsub = subscribeTerritory(regions, (cells) => {
                    const acc = remoteTerrRef.current;
                    for (const [cell, t] of cells) acc.set(cell, t);
                    // Mjukt tak: släng äldsta om kartan blir orimligt stor över tid.
                    if (acc.size > 8000) {
                        let drop = acc.size - 8000;
                        for (const k of acc.keys()) { acc.delete(k); if (--drop <= 0) break; }
                    }
                });
            };
            resubTerritory();
            const onMoveEndTerr = () => {
                if (terrResubTimer) window.clearTimeout(terrResubTimer);
                terrResubTimer = window.setTimeout(resubTerritory, 600);
            };
            map.on('moveend', onMoveEndTerr);

            // ── Zoom-skala: krymp event-markörer + kula när man zoomar ut ─────
            // Markörerna skalas via en CSS-var på containern; kulan via sina mått.
            // (Kollisionsradien skalas i fysik-loopen med samma faktor.)
            const applyPinZoomScale = () => {
                const sc = pinScaleForZoom(map.getZoom());
                container.style.setProperty('--pin-zoom-scale', String(sc));
                const d = Math.max(7, Math.round(16 * sc));
                ballEl.style.width = d + 'px';
                ballEl.style.height = d + 'px';
                ballEl.style.boxShadow = `0 0 0 ${Math.max(1, 2 * sc).toFixed(1)}px rgba(255,255,255,0.9), 0 0 ${(10 * sc).toFixed(1)}px ${(3 * sc).toFixed(1)}px rgba(56,189,248,0.7)`;
            };
            applyPinZoomScale();
            map.on('zoom', applyPinZoomScale);

            // ── Siktlinje-RAF ────────────────────────────────────────────────
            // Ritar kontinuerligt: siktlinje boll→finger under drag, annars puls.
            let aimRaf = 0;
            const aimLoop = () => {
                if (!ctx) { aimRaf = requestAnimationFrame(aimLoop); return; }
                const W = container.clientWidth, H = container.clientHeight;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, W, H);

                // Min reviret-färg, LIVE: vald ton (profil) → annars deterministisk
                // per uid → annars neutral blå (utloggad).
                const liveHue = myReviretHueRef.current ?? (myIdent ? hueForUid(myIdent.uid) : null);
                const myPalNow = liveHue != null ? palette(liveHue) : null;
                const myFill = myPalNow ? myPalNow.fill : REVIRET_WET_FILL;
                const myEdge = myPalNow ? myPalNow.edge : REVIRET_WET_EDGE;

                // Reviret-lager (HYBRID): HELA reviret fylls solitt — rullade
                // rutor ∪ inneslutna o-rullade (revInterior, flood-fill räknad vid
                // stopp). Men hexagon-RUTNÄTET ritas BARA på rutorna man faktiskt
                // rullat → de inneslutna hålen blir helfärgade (utan rutnät). En path
                // + en fyllning = sömlöst. Kameran är fri → projicera om per frame,
                // vy-kapat så kostnaden följer SYNLIGA rutor.
                // Andra spelares territorier (Firestore) — ritas UNDER min egen
                // målning i ÄGARENS färg, så varje spelare har sin egen färg på
                // kartan. Bara inzoomat (>= REV_DETAIL_ZOOM) + vy-kapat + ett tak
                // så per-frame-projiceringen aldrig spårar ur. Mina egna rutor
                // hoppas över här (de ritas ovanpå i nästa block).
                if (revActiveRef.current && remoteTerrRef.current.size && map.getZoom() >= REV_DETAIL_ZOOM) {
                    const byColor = new Map<string, { x: number; y: number }[][]>();
                    let drawn = 0;
                    for (const [cell, t] of remoteTerrRef.current) {
                        if (drawn >= 1500) break;
                        if (revPaintedRef.current.has(cell)) continue;
                        const hue = Number(t.color);
                        if (!Number.isFinite(hue)) continue;
                        const cc = map.project(cellCenterLngLat(cell));
                        if (cc.x < -90 || cc.x > W + 90 || cc.y < -90 || cc.y > H + 90) continue;
                        let arr = byColor.get(t.color);
                        if (!arr) { arr = []; byColor.set(t.color, arr); }
                        arr.push(cellCornersLngLat(cell).map((ll) => map.project(ll)));
                        drawn++;
                    }
                    if (byColor.size) {
                        ctx.save();
                        for (const [colorKey, hexes] of byColor) {
                            const pal = palette(Number(colorKey));
                            ctx.beginPath();
                            for (const pts of hexes) {
                                ctx.moveTo(pts[0].x, pts[0].y);
                                for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
                                ctx.closePath();
                            }
                            ctx.fillStyle = pal.fill; ctx.fill();
                            ctx.lineJoin = 'round'; ctx.lineWidth = 1; ctx.strokeStyle = pal.edge; ctx.stroke();
                        }
                        ctx.restore();
                    }
                }

                if (revActiveRef.current && revPaintedRef.current.size) {
                    if (map.getZoom() < REV_DETAIL_ZOOM && revHull.length >= 3) {
                        // SOLID MASSA (utzoomat): fyll bara revirets ytterform (konvex
                        // hull) som EN polygon med få punkter — inga per-cell-projek-
                        // tioner, inga hexagoner → billigt även med tusentals rutor.
                        // Hexagon-detaljerna återkommer när man zoomar in (>= REV_DETAIL_ZOOM).
                        ctx.save();
                        ctx.beginPath();
                        for (let i = 0; i < revHull.length; i++) {
                            const hp = map.project(revHull[i]);
                            if (i === 0) ctx.moveTo(hp.x, hp.y); else ctx.lineTo(hp.x, hp.y);
                        }
                        ctx.closePath();
                        ctx.fillStyle = myFill;
                        ctx.fill();
                        ctx.lineJoin = 'round'; ctx.lineWidth = 2.5;
                        ctx.strokeStyle = myEdge;
                        ctx.stroke();
                        ctx.restore();
                    } else {
                    const NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
                    const projectHex = (cell: string): { x: number; y: number }[] | null => {
                        const cc = map.project(cellCenterLngLat(cell));
                        if (cc.x < -90 || cc.x > W + 90 || cc.y < -90 || cc.y > H + 90) return null;
                        return cellCornersLngLat(cell).map((ll) => map.project(ll));
                    };
                    const painted = revPaintedRef.current;
                    const rolledVis: { q: number; r: number; pts: { x: number; y: number }[] }[] = [];
                    ctx.save();
                    // 1) FYLL: rullade + inneslutna rutor i EN path → solid yta.
                    ctx.beginPath();
                    for (const cell of painted) {
                        const pts = projectHex(cell);
                        if (!pts) continue;
                        const comma = cell.indexOf(',');
                        rolledVis.push({ q: Number(cell.slice(0, comma)), r: Number(cell.slice(comma + 1)), pts });
                        ctx.moveTo(pts[0].x, pts[0].y);
                        for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
                        ctx.closePath();
                    }
                    for (const cell of revInterior) {
                        const pts = projectHex(cell);
                        if (!pts) continue;
                        ctx.moveTo(pts[0].x, pts[0].y);
                        for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
                        ctx.closePath();
                    }
                    ctx.fillStyle = myFill;
                    ctx.fill();
                    // 2) KONTUR: rita BARA ytterkanter (kanter utan reviret-granne) →
                    //    inga rutnäts-linjer genom den ifyllda massan. Tunn frontlinje
                    //    syns ändå som hexagoner (dess kanter ÄR ytterkanter).
                    if (rolledVis.length) {
                        ctx.beginPath();
                        for (const { q, r, pts } of rolledVis) {
                            for (let i = 0; i < 6; i++) {
                                const nb = NB[i];
                                const k = (q + nb[0]) + ',' + (r + nb[1]);
                                if (!painted.has(k) && !revInterior.has(k)) {
                                    const a = pts[i], b = pts[(i + 1) % 6];
                                    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                                }
                            }
                        }
                        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = myEdge;
                        ctx.stroke();
                    }
                    ctx.restore();
                    }
                }

                const ballLL = ball.getLngLat();
                const bp = map.project([ballLL.lng, ballLL.lat]);
                const bx = bp.x, by = bp.y;

                const shotStart = pinShotStartRef.current;
                const shotCur = pinShotCurRef.current;

                if (shotStart && shotCur && !pinMoveModeRef.current) {
                    // Drag-vektor (fingret mot start = avfyrningsriktning)
                    const fx = shotCur.x, fy = shotCur.y;
                    const dx = shotStart.x - fx, dy = shotStart.y - fy;
                    const len = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / len, uy = dy / len;
                    const power = Math.min(1, len / 180);

                    // Gummiband: finger → boll
                    const grad = ctx.createLinearGradient(fx, fy, bx, by);
                    grad.addColorStop(0, `rgba(0,106,167,${0.3 + 0.5 * power})`);
                    grad.addColorStop(1, `rgba(0,106,167,${0.85 + 0.15 * power})`);
                    ctx.save();
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 3 + power * 3; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(bx, by); ctx.stroke();

                    // Förutspådd bana (prickad) från boll i avfyrningsriktning
                    const reach = 60 + power * 310;
                    const tx = bx + ux * reach, ty = by + uy * reach;
                    ctx.setLineDash([7, 9]);
                    ctx.strokeStyle = `rgba(0,106,167,${0.35 + 0.5 * power})`; ctx.lineWidth = 2.5;
                    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
                    ctx.setLineDash([]);

                    // Pilspets
                    const a = Math.atan2(uy, ux);
                    ctx.fillStyle = `rgba(0,106,167,${0.5 + 0.5 * power})`;
                    ctx.beginPath(); ctx.moveTo(tx, ty);
                    ctx.lineTo(tx - 13 * Math.cos(a - 0.4), ty - 13 * Math.sin(a - 0.4));
                    ctx.lineTo(tx - 13 * Math.cos(a + 0.4), ty - 13 * Math.sin(a + 0.4));
                    ctx.closePath(); ctx.fill();

                    // Ghost-kula vid fingret
                    ctx.beginPath(); ctx.arc(fx, fy, PIN_BALL_R * 0.75, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
                    ctx.restore();
                } else if (!pinMoveModeRef.current) {
                    // Pulserande ring: bollen redo att skjutas
                    const t = (performance.now() % 1400) / 1400;
                    ctx.save();
                    ctx.beginPath(); ctx.arc(bx, by, PIN_BALL_R + 5 + t * 12, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(244,63,94,${0.55 * (1 - t)})`; ctx.lineWidth = 2; ctx.stroke();
                    ctx.restore();
                }

                // Rita och uppdatera shockwaves/ringar
                const rings = pinRingsRef.current;
                if (rings.length > 0) {
                    ctx.save();
                    for (let i = rings.length - 1; i >= 0; i--) {
                        const r = rings[i];
                        r.age++;
                        const progress = r.age / r.maxAge;
                        const radius = r.startR + progress * 40;
                        const alpha = 1 - progress;
                        ctx.beginPath();
                        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(251, 191, 36, ${alpha})`;
                        ctx.lineWidth = 3 - progress * 1.5;
                        ctx.stroke();
                        if (r.age >= r.maxAge) {
                            rings.splice(i, 1);
                        }
                    }
                    ctx.restore();
                }

                // Rita och uppdatera flytande poängtexter (+1, +2...)
                const floatTexts = pinFloatTextsRef.current;
                if (floatTexts.length > 0) {
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    for (let i = floatTexts.length - 1; i >= 0; i--) {
                        const ft = floatTexts[i];
                        ft.age++;
                        const progress = ft.age / ft.maxAge;
                        const curY = ft.y - (progress * 50); // sväva 50px uppåt
                        const alpha = 1 - progress;
                        
                        ctx.font = `900 ${Math.round(20 + progress * 4)}px system-ui, sans-serif`;
                        
                        // Textkant (skugga för läsbarhet mot kartan)
                        ctx.strokeStyle = `rgba(15, 23, 42, ${alpha * 0.8})`;
                        ctx.lineWidth = 4;
                        ctx.strokeText(ft.text, ft.x, curY);
                        
                        // Fyll text
                        ctx.fillStyle = `rgba(251, 191, 36, ${alpha})`;
                        ctx.fillText(ft.text, ft.x, curY);
                        
                        if (ft.age >= ft.maxAge) {
                            floatTexts.splice(i, 1);
                        }
                    }
                    ctx.restore();
                }

                aimRaf = requestAnimationFrame(aimLoop);
            };
            aimRaf = requestAnimationFrame(aimLoop);

            // ── Hjälpfunktion: avstånd punkt→segment ─────────────────────────
            const distPointToSeg2 = (px: number, py: number, ax: number, ay: number, bxp: number, byp: number) => {
                const dx = bxp - ax, dy = byp - ay, l2 = dx * dx + dy * dy;
                if (l2 === 0) return Math.hypot(px - ax, py - ay);
                let t = ((px - ax) * dx + (py - ay) * dy) / l2;
                t = Math.max(0, Math.min(1, t));
                return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
            };

            // ── Fysik-skott med studs ─────────────────────────────────────────
            // Bollen rör sig i skärm-px/ms, studsar mot event-markörer med
            // reflekterad normalvektor, och stannar av friktion. Kameran panorerar med bollen.
            type GeoPhysState = {
                vx: number;
                vy: number;
                lng: number;
                lat: number;
                hitKeys: Set<string>;
                lastHitKey: string | null;
                hitTimes: Map<string, number>;
                hitCount: number;
            };
            let geoPhysState: GeoPhysState | null = null;
            let geoPhysRaf = 0;
            const PHYS_STOP_V = 0.05; // px/ms — under detta parkeras bollen

            const startGeoPhysLoop = (initVx: number, initVy: number) => {
                cancelAnimationFrame(geoPhysRaf);
                const ll = ball.getLngLat();
                geoPhysState = {
                    vx: initVx,
                    vy: initVy,
                    lng: ll.lng,
                    lat: ll.lat,
                    hitKeys: new Set(),
                    lastHitKey: null,
                    hitTimes: new Map(),
                    hitCount: 0
                };
                pinHitKeysRef.current = new Set();
                pinFloatTextsRef.current = [];
                pinRingsRef.current = [];
                setPinShotHits(0);
                revPrevRef.current = null; // ny boll-bana → ingen interpolering från förra skottets slut

                // Increment shot counter in the page HUD
                onPinballLaunchRef.current?.();

                let prevNow = performance.now();
                const tick = (now: number) => {
                    if (!geoPhysState) return;
                    const state = geoPhysState;
                    const dt = Math.min(now - prevNow, 50);
                    prevNow = now;

                    const W = container.clientWidth, H = container.clientHeight;
                    // Skala kollisionsradien med zoom (samma faktor som markörernas
                    // visuella storlek) så fysiken inte flippar ur långt utzoomat.
                    const hitR = PIN_HIT_RADIUS_PX * pinScaleForZoom(map.getZoom());
                    let bp2 = map.project([state.lng, state.lat]);
                    let bx2 = bp2.x, by2 = bp2.y;

                    // Substeg för anti-tunneling
                    const SUBSTEPS = Math.max(1, Math.ceil(dt / 8));
                    const subDt = dt / SUBSTEPS;
                    for (let s = 0; s < SUBSTEPS; s++) {
                        const prevBx2 = bx2, prevBy2 = by2;
                        bx2 += state.vx * subDt;
                        by2 += state.vy * subDt;
                        // Friktion
                        const f = Math.pow(0.9985, subDt);
                        state.vx *= f; state.vy *= f;

                        // Kollision mot event-markörer
                        for (const [key, md] of markersRef.current) {
                            const mp = md.marker ? md.marker.getLngLat() : null;
                            if (!mp) continue;
                            const mp2 = map.project(mp);
                            const mpx = mp2.x, mpy = mp2.y;
                            if (mpx < -120 || mpx > W + 120 || mpy < -120 || mpy > H + 120) continue;

                            const d2 = distPointToSeg2(mpx, mpy, prevBx2, prevBy2, bx2, by2);
                            const hitR2 = hitR;
                            if (d2 < hitR2) {
                                // Studs: reflektera hastigheten mot normalen boll→markör
                                const nx2 = bx2 - mpx, ny2 = by2 - mpy;
                                const nlen2 = Math.max(1, Math.hypot(nx2, ny2));
                                const nux2 = nx2 / nlen2, nuy2 = ny2 / nlen2;
                                const dot2 = state.vx * nux2 + state.vy * nuy2;
                                if (dot2 < 0) {
                                    const REST = 0.75;
                                    state.vx -= (1 + REST) * dot2 * nux2;
                                    state.vy -= (1 + REST) * dot2 * nuy2;
                                    const overlap = hitR2 - d2;
                                    bx2 += nux2 * overlap; by2 += nuy2 * overlap;
                                }
                                
                                // Cooldown per studsare (400ms) så man kan studsa mot samma bumper igen
                                const nowMs = performance.now();
                                const lastHitTime = state.hitTimes.get(key) || 0;
                                if (nowMs - lastHitTime > 400) {
                                    state.hitTimes.set(key, nowMs);
                                    state.lastHitKey = key;
                                    state.hitKeys.add(key);
                                    state.hitCount++;

                                    const bubble = md.element.querySelector('.pin-bubble') as HTMLElement | null;
                                    if (bubble) {
                                        bubble.classList.remove('pin-hit-flash');
                                        void bubble.offsetWidth;
                                        bubble.classList.add('pin-hit-flash');
                                        setTimeout(() => bubble.classList.remove('pin-hit-flash'), 320);
                                    }

                                    // Lägg till flytande träffräknare (+1, +2...) ovanpå markören
                                    const bp = map.project(mp);
                                    pinFloatTextsRef.current.push({
                                        x: bp.x,
                                        y: bp.y,
                                        text: `+${state.hitCount}`,
                                        age: 0,
                                        maxAge: 45
                                    });

                                    // Lägg till en expanderande shockwave ring
                                    pinRingsRef.current.push({
                                        x: bp.x,
                                        y: bp.y,
                                        startR: hitR * 0.5,
                                        age: 0,
                                        maxAge: 25
                                    });

                                    const grp = groupsRef.current.get(key);
                                    if (grp) onPinballHitRef.current?.(grp);
                                    setPinShotHits(state.hitCount);
                                }
                            }
                        }
                    }

                    // Uppdatera geo-position + geo-follow
                    const newLL2 = map.unproject([bx2, by2]);
                    state.lng = newLL2.lng; state.lat = newLL2.lat;
                    ball.setLngLat([state.lng, state.lat]);
                    map.setCenter([state.lng, state.lat]);

                    // Reviret: måla hex-rutorna längs bollens bana.
                    revPaintTo(state.lng, state.lat);
                    // Live-uppdatera poängen så man SER nymark-stegen växa medan
                    // bollen rullar (throttlat ~4/s + bara när nya rutor tillkommit;
                    // inneslutna/pionjär räknas tyngre och uppdateras vid stopp).
                    if (revActiveRef.current) {
                        const nowT = performance.now();
                        const sz = revPaintedRef.current.size;
                        if (sz !== revLastStatSize && nowT - revLastStatT > 250) {
                            revLastStatT = nowT; revLastStatSize = sz;
                            const evs = revCountEvents();
                            setRevStats((s) => ({ cells: sz, events: evs, enclosed: s ? s.enclosed : 0, pioneer: s ? s.pioneer : 0 }));
                        }
                    }

                    const spd = Math.hypot(state.vx, state.vy);
                    if (spd < PHYS_STOP_V) {
                        geoPhysState = null;
                        if (revActiveRef.current) {
                            revInterior = computeInterior(revPaintedRef.current);
                            revHull = convexHull([...revPaintedRef.current].map((c) => cellCenterLngLat(c)));
                            const events = revCountEvents();
                            const points = revPaintedRef.current.size + revInterior.size;
                            setRevStats({ cells: revPaintedRef.current.size, events, enclosed: revInterior.size, pioneer: countPioneer(revPaintedRef.current, revInterior) });
                            // Spara (bäst-möjligt): claima de NYA rutorna i min färg så
                            // ytan + ägaren persisteras → andra spelare ser dem i min
                            // färg; pusha dagens poäng/event till topplistan.
                            const fresh: string[] = [];
                            for (const cell of revPaintedRef.current) {
                                if (!revWrittenRef.current.has(cell)) { revWrittenRef.current.add(cell); fresh.push(cell); }
                            }
                            if (fresh.length) void claimCells(fresh);
                            const bll = ball.getLngLat();
                            void saveDailyScore(points, events, regionForLngLat(bll.lng, bll.lat));
                        }
                        return;
                    }
                    geoPhysRaf = requestAnimationFrame(tick);
                };
                geoPhysRaf = requestAnimationFrame(tick);
            };

            // travelTo: konvertera geo-destination → hastighetsvektor
            const travelTo = (target: [number, number]) => {
                const ll = ball.getLngLat();
                const bp3 = map.project([ll.lng, ll.lat]);
                const tp3 = map.project(target);
                const dx3 = tp3.x - bp3.x, dy3 = tp3.y - bp3.y;
                const dist3 = Math.max(1, Math.hypot(dx3, dy3));
                const SPEED = 0.65; // px/ms startfart
                startGeoPhysLoop((dx3 / dist3) * SPEED, (dy3 / dist3) * SPEED);
            };
            pinGeoTravelRef.current = travelTo;
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                        setUserPos(next);
                        ball.setLngLat([next.lng, next.lat]);
                        map.flyTo({ center: [next.lng, next.lat], zoom: 14, duration: 1000 });
                    },
                    () => { /* nekad/timeout → bollen ligger kvar i Sveriges mitt */ },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
                );
            }

            return () => {
                cancelAnimationFrame(aimRaf);
                cancelAnimationFrame(geoPhysRaf);
                geoPhysState = null;
                window.removeEventListener(FEATURE_CHANGE_EVENT, onRevToggleGeo);
                map.off('zoom', applyPinZoomScale);
                map.off('moveend', onMoveEndTerr);
                if (terrResubTimer) window.clearTimeout(terrResubTimer);
                terrUnsub();
                unsubLeaderboard();
                remoteTerrRef.current = new Map();
                revWrittenRef.current = new Set();
                setLeaderboard([]);
                container.style.removeProperty('--pin-zoom-scale');
                revPaintedRef.current.clear();
                revPrevRef.current = null;
                setRevStats(null);
                pinGeoTravelRef.current = null;
                pinGeoBallRef.current = null;
                pinFloatTextsRef.current = [];
                pinRingsRef.current = [];
                setPinShotHits(0);
                ball.remove();
                if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
                const m = mapRef.current;
                if (m) {
                    m.setMinZoom(prior.minZoom);
                    m.setMaxZoom(prior.maxZoom);
                    m.setMaxBounds(prior.maxBounds ?? null);
                    try { m.setProjection({ type: priorProj }); } catch { /* ignorera */ }
                    m.jumpTo({ center: prior.center, zoom: prior.zoom, pitch: prior.pitch, bearing: prior.bearing });
                    driftSuppressUntilRef.current = performance.now();
                }
            };
        }


        // Flagga som sätts i cleanup om läget stängs av under zoom-animationen.
        let cancelled = false;

        // 0. Zooma in på bollen (min zoom 15) innan kameran fryses.
        // Vi låter kartan animera till rätt zoom och sedan startar fysikloopen.
        const currentZoom = map.getZoom();
        const PIN_TARGET_ZOOM = 15;
        const needsZoom = currentZoom < PIN_TARGET_ZOOM;
        const priorZoom = currentZoom;

        // Listeners som måste kunna tas bort av cleanup (deklareras utanför startPinball
        // så att de är tillgängliga även om läget stängs av under zoom-fasen).
        let onRevToggle: (() => void) | null = null;
        let onResize: (() => void) | null = null;

        const startPinball = () => {
            if (cancelled) return;

        // 1. Frys kameran + platta till (fysik i px/ms kräver stabil pixel-ram).
        const prior = { pitch: map.getPitch(), bearing: map.getBearing() };
        map.stop();
        map.setPitch(0); map.setBearing(0);
        map.dragPan.disable(); map.scrollZoom.disable(); map.doubleClickZoom.disable();
        map.touchZoomRotate.disable(); map.dragRotate.disable(); map.keyboard.disable(); map.boxZoom.disable();
        try { map.touchPitch?.disable(); } catch { /* äldre maplibre saknar touchPitch */ }
        driftSuppressUntilRef.current = Number.MAX_SAFE_INTEGER; // (idle-drift är redan av)

        // 2. Göm de vanliga event-lagren (inkl. kluster) — banan ritar eventen själv.
        setGlLayerVisible('plain-events', false);
        setGlLayerVisible('plain-events-dots', false);
        setGlLayerVisible('plain-events-clusters', false);
        setGlLayerVisible('plain-events-cluster-count', false);

        // 3. Mät banan + sätt upp canvas (DPR-skalad) + offscreen-fält (halv-res).
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        let W = container.clientWidth, H = container.clientHeight;
        const offCanvas = document.createElement('canvas');
        const setupCanvas = () => {
            W = container.clientWidth; H = container.clientHeight;
            canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
            offCanvas.width = Math.max(1, Math.round(W * 0.5)); offCanvas.height = Math.max(1, Math.round(H * 0.5));
            pinSizeRef.current = { W, H, dpr };
            // Banan täcker hela skärmen. Plunger (sikte) i mitten — bollen följer kameran.
            const minY = PIN_TOP_RESERVE, maxY = Math.max(PIN_TOP_RESERVE + 120, H - PIN_BOTTOM_RESERVE);
            pinBoardRef.current = { minX: PIN_WALL, minY, maxX: W - PIN_WALL, maxY };
            pinPadRef.current = { x: W / 2, y: H / 2 }; // mitten = bollens hem i geo-follow-läge
            revScreenRef.current.clear(); // projektionen ändras → cachade hörn ogiltiga
        };
        setupCanvas();
        const ctx = canvas.getContext('2d');
        const offCtx = offCanvas.getContext('2d');
        if (!ctx || !offCtx) return;
        const supportsFilter = 'filter' in ctx; // gooey-passet kräver canvas-filter
        let lowGfx = false, slowFrames = 0;

        // 4. Geo-follow: bollen sitter i mitten från start.
        // Plunger är också i mitten (siktet) så man skjuter från mitten.
        pinPadRef.current = { x: W / 2, y: H / 2 };
        pinBumpersRef.current = buildPinBumpers(map, groupsRef.current, pinBoardRef.current, dpr);
        pinGridRef.current = buildPinGrid(pinBumpersRef.current, PIN_BUMPER_MAX_R * 2);
        pinSeatBall();

        // 4b. Reviret: nollställ revir + cache för den här sessionen, läs av om
        // territorie-läget är på, och lyssna på shoppen så på/av slår igenom live.
        revActiveRef.current = isFeatureOn('reviret');
        revPaintedRef.current.clear();
        revScreenRef.current.clear();
        revPrevRef.current = null;
        setRevStats(revActiveRef.current ? { cells: 0, events: 0, enclosed: 0, pioneer: 0 } : null);
        onRevToggle = () => {
            revActiveRef.current = isFeatureOn('reviret');
            setRevStats(revActiveRef.current ? { cells: revPaintedRef.current.size, events: 0, enclosed: 0, pioneer: 0 } : null);
        };
        window.addEventListener(FEATURE_CHANGE_EVENT, onRevToggle);

        // Måla varje hex-ruta längs ett segment (p0→p1) i kulans skärmbana. Vi
        // interpolerar i ~12px-steg så en snabb kula inte hoppar över smala rutor;
        // Set.add är idempotent så översampling är gratis.
        const revPaintSegment = (x0: number, y0: number, x1: number, y1: number) => {
            if (!revActiveRef.current) return;
            const dist = Math.hypot(x1 - x0, y1 - y0);
            const steps = Math.max(1, Math.ceil(dist / 12));
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                // x0/y0 är CSS-pixlar → multiplicera med dpr för map.unproject (canvas-pixlar)
                const px = (x0 + (x1 - x0) * t) * dpr;
                const py = (y0 + (y1 - y0) * t) * dpr;
                const ll = map.unproject([px, py]);
                revPaintedRef.current.add(lngLatToCell(ll.lng, ll.lat));
            }
        };
        // Hur många distinkta event ligger i målade rutor (för HUD:en).
        const revCountEvents = (): number => {
            const painted = revPaintedRef.current;
            if (!painted.size) return 0;
            let n = 0;
            for (const group of groupsRef.current.values()) {
                for (const ev of group) {
                    if (isValidLatLng(ev.lat, ev.lng) && painted.has(lngLatToCell(ev.lng!, ev.lat!))) n++;
                }
            }
            return n;
        };

        // ── Rit-helpers ──────────────────────────────────────────────────────
        const roundRectPath = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
            c.beginPath();
            c.moveTo(x + r, y);
            c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
            c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
            c.closePath();
        };
        const drawBall = (c: CanvasRenderingContext2D, ball: PinBall) => {
            c.save();
            c.beginPath(); c.arc(ball.x, ball.y + 2, ball.r, 0, Math.PI * 2);
            c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill(); // mjuk skugga
            const g = c.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, ball.r * 0.15, ball.x, ball.y, ball.r);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#dbe4ee'); g.addColorStop(1, '#8190a4');
            c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fillStyle = g; c.fill();
            c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.stroke();
            c.restore();
        };
        const drawAim = (c: CanvasRenderingContext2D, pad: { x: number; y: number }, pull: { x: number; y: number }) => {
            const dx = pad.x - pull.x, dy = pad.y - pull.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const ux = dx / len, uy = dy / len;
            const power = Math.min(1, len / 220);
            c.save();
            // gummiband pad → pull
            c.strokeStyle = '#006AA7'; c.lineWidth = 4; c.lineCap = 'round';
            c.beginPath(); c.moveTo(pull.x, pull.y); c.lineTo(pad.x, pad.y); c.stroke();
            // förutspådd bana (prickad) från pad i avfyrnings-riktning
            const reach = 60 + power * 320;
            const tx = pad.x + ux * reach, ty = pad.y + uy * reach;
            c.setLineDash([6, 8]); c.strokeStyle = `rgba(0,106,167,${0.4 + 0.5 * power})`; c.lineWidth = 3;
            c.beginPath(); c.moveTo(pad.x, pad.y); c.lineTo(tx, ty); c.stroke();
            c.setLineDash([]);
            // pilspets
            const a = Math.atan2(uy, ux);
            c.fillStyle = `rgba(0,106,167,${0.5 + 0.5 * power})`;
            c.beginPath(); c.moveTo(tx, ty);
            c.lineTo(tx - 12 * Math.cos(a - 0.4), ty - 12 * Math.sin(a - 0.4));
            c.lineTo(tx - 12 * Math.cos(a + 0.4), ty - 12 * Math.sin(a + 0.4));
            c.closePath(); c.fill();
            // ghost-kula vid dra-handtaget
            c.beginPath(); c.arc(pull.x, pull.y, PIN_BALL_R * 0.8, 0, Math.PI * 2);
            c.fillStyle = 'rgba(255,255,255,0.45)'; c.fill();
            c.restore();
        };
        // Metaball-fält: additiva radial-gradient-skivor på en halv-res offscreen.
        // 'lighter' gör att närliggande skivors alfa summeras → de flyter ihop.
        const renderField = () => {
            offCtx.setTransform(1, 0, 0, 1, 0, 0);
            offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
            offCtx.globalCompositeOperation = 'lighter';
            for (const b of pinBumpersRef.current) {
                const x = b.cx * 0.5, y = b.cy * 0.5, r = b.r * 1.2 * 0.5;
                const g = offCtx.createRadialGradient(x, y, r * 0.1, x, y, r);
                g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
                offCtx.fillStyle = g; offCtx.beginPath(); offCtx.arc(x, y, r, 0, Math.PI * 2); offCtx.fill();
            }
            offCtx.globalCompositeOperation = 'source-over';
        };

        // Reviret-lager: fyll varje målad hex-ruta translucent. Kameran är fryst
        // under hela sessionen → projicerade hörn cachas per cell (revScreenRef).
        const renderTerritory = () => {
            if (!revActiveRef.current || revPaintedRef.current.size === 0) return;
            const cache = revScreenRef.current;
            ctx.save();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = REVIRET_WET_EDGE;
            ctx.fillStyle = REVIRET_WET_FILL;
            for (const cell of revPaintedRef.current) {
                let pts = cache.get(cell);
                if (!pts) {
                    pts = [];
                    for (const [lng, lat] of cellCornersLngLat(cell)) {
                        const p = map.project([lng, lat]);
                        pts.push(p.x, p.y);
                    }
                    cache.set(cell, pts);
                }
                ctx.beginPath();
                ctx.moveTo(pts[0], pts[1]);
                for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        };

        const render = () => {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);
            const bumpers = pinBumpersRef.current;
            const ball = pinBallRef.current;

            // banram + lätt tonad spelyta så bubblor/kula syns mot kartan
            const bd = pinBoardRef.current;
            ctx.save();
            roundRectPath(ctx, bd.minX, bd.minY, bd.maxX - bd.minX, bd.maxY - bd.minY, 18);
            ctx.fillStyle = 'rgba(15,23,42,0.10)'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.40)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();

            renderTerritory(); // under bubblorna → eventen läses fortfarande tydligt

            if (bumpers.length) {
                // gooey-kropp (mjuka ihopflytande halsar mellan närliggande bubblor)
                if (!lowGfx && supportsFilter) {
                    renderField();
                    ctx.save();
                    ctx.filter = 'blur(4px) contrast(10)';
                    ctx.drawImage(offCanvas, 0, 0, W, H);
                    ctx.filter = 'none';
                    ctx.globalCompositeOperation = 'source-in';
                    ctx.fillStyle = PIN_BODY_COLOR; ctx.fillRect(0, 0, W, H);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.restore();
                }
                // solida kärnor (alltid) → varje bubbla läses som en tydlig rund knapp;
                // överlappande kärnor i samma färg unioneras automatiskt = "går ihop".
                ctx.fillStyle = PIN_BODY_COLOR;
                for (const b of bumpers) { ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.fill(); }
                ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.30)';
                for (const b of bumpers) { ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.stroke(); }
                // symboler (på sin EGEN koord, aldrig centroiden) + träff-blink + antal
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                for (const b of bumpers) {
                    if (b.hitFlash > 0) {
                        ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r + 3, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(251,191,36,${b.hitFlash})`; ctx.lineWidth = 3; ctx.stroke();
                    }
                    ctx.font = `${Math.round(b.r * 1.05)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(b.emoji, b.cx, b.cy);
                    if (b.count > 1) {
                        const bx = b.cx + b.r * 0.72, by = b.cy - b.r * 0.72;
                        ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2);
                        ctx.fillStyle = '#f43f5e'; ctx.fill();
                        ctx.fillStyle = '#ffffff'; ctx.font = '700 11px system-ui, sans-serif';
                        ctx.fillText(String(b.count), bx, by);
                    }
                }
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '600 15px system-ui, sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Inga event i vyn — avsluta och zooma in först', W / 2, (bd.minY + bd.maxY) / 2);
            }

            if (ball) drawBall(ctx, ball);

            // sikte medan man drar; annars en mjuk plunger-puls vid armad kula
            if (pinAimingRef.current && pinPullRef.current && ball && ball.armed) {
                drawAim(ctx, pinPadRef.current, pinPullRef.current);
            } else if (ball && ball.armed) {
                const t = (performance.now() % 1200) / 1200;
                ctx.beginPath(); ctx.arc(pinPadRef.current.x, pinPadRef.current.y, PIN_BALL_R + 4 + t * 10, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(244,63,94,${0.5 * (1 - t)})`; ctx.lineWidth = 2; ctx.stroke();
            }
        };

        // ── rAF-loop (ackumulator, fast tidssteg, NOLL React-setState) ────────
        const onHit = (b: PinBumper) => { onPinballHitRef.current?.(b.group); };
        const loop = (now: number) => {
            const frameDt = Math.min(now - (pinLastTRef.current || now), PIN_DT_CAP);
            pinLastTRef.current = now;
            const ball = pinBallRef.current;
            if (ball && ball.alive) {
                pinAccRef.current += frameDt;
                let steps = 0;
                while (pinAccRef.current >= PIN_DT_FIX && steps < 12) {
                    stepPinball(ball, pinBoardRef.current, pinGridRef.current, PIN_DT_FIX, now, onHit);
                    pinAccRef.current -= PIN_DT_FIX; steps++;
                }
                if (pinAccRef.current > PIN_DT_FIX) pinAccRef.current = 0; // släpp backlog om vi kapade

                // Geo-follow: pan kartan så bollens geo-position hamnar i mitten.
                // ball.x/y är CSS-pixlar → multiplicera med dpr för map.unproject
                const ballGeoLL = map.unproject([ball.x * dpr, ball.y * dpr]);
                map.setCenter([ballGeoLL.lng, ballGeoLL.lat]);
                // Efter pannering: bollen ska alltid vara i mitten av skärmen.
                ball.x = W / 2;
                ball.y = H / 2;
                // Omprojektera studsare från geo-koordinater.
                // map.project returnerar canvas-pixlar (DPR-skalat) → dela med dpr
                for (const b of pinBumpersRef.current) {
                    const p = map.project([b.lng, b.lat]);
                    b.cx = p.x / dpr; b.cy = p.y / dpr;
                }
                // Bygg om grid med nya skärmkoordinater.
                pinGridRef.current = buildPinGrid(pinBumpersRef.current, PIN_BUMPER_MAX_R * 2);

                // Reviret: måla hela banan sedan förra framen (inte bara en punkt).
                if (revActiveRef.current) {
                    const prev = revPrevRef.current;
                    if (prev) revPaintSegment(prev.x, prev.y, ball.x, ball.y);
                    revPrevRef.current = { x: ball.x, y: ball.y };
                }
                const sp = Math.hypot(ball.vx, ball.vy);
                if (sp < PIN_STOP_V || now - pinFlightStartRef.current > PIN_MAX_FLIGHT_MS) {
                    pinSeatBall(); // parkera + arma om vid plungern
                    revPrevRef.current = null;
                    // Skottet är slut → enda setState i loopen (uppdaterar HUD:en).
                    if (revActiveRef.current) setRevStats({ cells: revPaintedRef.current.size, events: revCountEvents(), enclosed: 0, pioneer: 0 });
                }
            } else {
                pinAccRef.current = 0;
                // Bollen parkerad: om-projicera ÄNDÅ bumprarna från sina geo-koordinater
                // varje frame, så de följer kartan när ANVÄNDAREN panorerar/zoomar
                // (annars fryser de fast på skärmen medan kartan glider under dem).
                for (const b of pinBumpersRef.current) {
                    const p = map.project([b.lng, b.lat]);
                    b.cx = p.x / dpr; b.cy = p.y / dpr;
                }
            }
            for (const b of pinBumpersRef.current) if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - frameDt / 400);
            if (frameDt > 26) { slowFrames++; if (slowFrames > 30) lowGfx = true; } else { slowFrames = Math.max(0, slowFrames - 1); }
            render();
            pinRafRef.current = requestAnimationFrame(loop);
        };
        pinLastTRef.current = performance.now();
        pinRafRef.current = requestAnimationFrame(loop);

        // Banan följer fönsterstorleken (kameran är fryst så inga andra ombyggen).
        onResize = () => {
            setupCanvas();
            const ball = pinBallRef.current;
            if (!ball || !ball.alive) { // rör inte studsare mitt i ett skott
                const m = mapRef.current;
                if (m) {
                    const { dpr: d } = pinSizeRef.current;
                    pinBumpersRef.current = buildPinBumpers(m, groupsRef.current, pinBoardRef.current, d || 1);
                    pinGridRef.current = buildPinGrid(pinBumpersRef.current, PIN_BUMPER_MAX_R * 2);
                }
                pinSeatBall();
            }
        };
        window.addEventListener('resize', onResize);
        }; // slut på startPinball()

        // Trigger: om vi redan är inzoomade kör direkt, annars zooma in smooth.
        if (!needsZoom) {
            startPinball();
        } else {
            map.flyTo({ zoom: PIN_TARGET_ZOOM, duration: 700, easing: (t) => 1 - Math.pow(1 - t, 3) });
            map.once('moveend', startPinball);
        }

        return () => {
            cancelled = true;
            map.off('moveend', startPinball); // avbryt om ännu i zoom-fas
            cancelAnimationFrame(pinRafRef.current);
            if (onResize) window.removeEventListener('resize', onResize);
            if (onRevToggle) window.removeEventListener(FEATURE_CHANGE_EVENT, onRevToggle);
            setRevStats(null); // göm revir-HUD när läget stängs
            const m = mapRef.current;
            if (m) {
                m.dragPan.enable(); m.scrollZoom.enable(); m.doubleClickZoom.enable();
                m.touchZoomRotate.enable(); m.dragRotate.enable(); m.keyboard.enable(); m.boxZoom.enable();
                try { m.touchPitch?.enable(); } catch { /* ignorera */ }
                // Återställ till före-pinball-zoom + pitch/bearing
                m.flyTo({ zoom: priorZoom, pitch: 0, bearing: 0, duration: 400 });
                driftSuppressUntilRef.current = performance.now();
            }
            setGlLayerVisible('plain-events', true);
            setGlLayerVisible('plain-events-dots', false);
            setGlLayerVisible('plain-events-clusters', true);
            setGlLayerVisible('plain-events-cluster-count', true);
            // canvas kan vara oinitierad om vi avbröt i zoom-fasen
            const ctx2 = canvas.getContext('2d');
            if (ctx2) { ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, canvas.width, canvas.height); }
            pinBallRef.current = null; pinBumpersRef.current = [];
            pinAimingRef.current = false; pinPullRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinballMode, pinSeatBall, setGlLayerVisible]);

    // Bygg om studsarna när event-uppsättningen ändras (men inte mitt i ett skott).
    useEffect(() => {
        if (!pinballMode) return;
        const ball = pinBallRef.current;
        if (ball && ball.alive) return;
        const map = mapRef.current;
        const { W, H, dpr: d } = pinSizeRef.current;
        if (!map || !W || !H) return;
        pinBumpersRef.current = buildPinBumpers(map, groupsRef.current, pinBoardRef.current, d || 1);
        pinGridRef.current = buildPinGrid(pinBumpersRef.current, PIN_BUMPER_MAX_R * 2);
    }, [groups, pinballMode]);

    // Geo-flipper: kameran är ALLTID fri (panorera/zooma). Skjutandet sker via TRYCK
    // på kartan (map 'click') där man vill att bollen ska åka — inget skjut-läge som
    // fryser kameran, inget canvas-drag. Robust eftersom kartans klick alltid fungerar.
    useEffect(() => {
        if (!pinballMode) return;
        const map = mapRef.current;
        if (!map) return;
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pinballMode]);

    // Recenter-knappen flyger kameran TILL ett moln (vi går dit — molnet
    // teleporteras inte till oss). Finns båda molnen framme → toggla till det
    // andra för varje klick (minns vilket vi gick till sist). Finns bara ett
    // moln → alltid det. Inget moln → inget händer.
    const lastRecenterRef = useRef<'main' | 'sun'>('sun');

    // Jagar ett moln som fortfarande är i luften (mitt i ett glid): räknar ut var
    // det landar utifrån live-hastighet + friktion, flyger kameran dit och slår
    // sedan på POV (follow) så vi följer det medan det glider klart. Avsluta med
    // tryck på molnet igen.
    const latchOntoGlidingCloud = (
        kind: 'main' | 'sun',
        state: { sp: { x: number; y: number }; vx: number; vy: number }
    ) => {
        const map = mapRef.current; if (!map) return;
        setMainFollowing(false);
        setSunFollowing(false);
        lastRecenterRef.current = kind;

        const startFollow = () => {
            if (kind === 'main') { setSunFollowing(false); setMainFollowing(true); }
            else { setMainFollowing(false); setSunFollowing(true); }
        };

        const k = 2.2 / 1000;       // matchar CloudPopups GLIDE_FRICTION
        const stopThreshold = 0.04;
        const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

        if (speed < stopThreshold) {
            const ll = map.unproject([state.sp.x, state.sp.y]);
            driftSuppressUntilRef.current = performance.now() + 900;
            map.easeTo({ center: [ll.lng, ll.lat], duration: 500 });
            map.once('moveend', startFollow);
            return;
        }

        const landSP = { x: state.sp.x + state.vx / k, y: state.sp.y + state.vy / k };
        const targetLL = map.unproject([landSP.x, landSP.y]);
        const duration = Math.min(Math.max(Math.log(speed / stopThreshold) / k, 300), 2600);
        driftSuppressUntilRef.current = performance.now() + duration + 400;
        map.easeTo({
            center: [targetLL.lng, targetLL.lat],
            duration,
            easing: (t) => 1 - Math.pow(1 - t, 3)
        });
        map.once('moveend', startFollow);
    };

    const recenterOnClouds = () => {
        const map = mapRef.current;
        if (!map) return;

        const hasMain = showCloudRef.current && !!cloudAnchorRef.current;
        const hasSun = !!sunCloudAnchorRef.current;
        if (!hasMain && !hasSun) return;

        // Ett moln mitt i ett kast (glid) har inte commitat sitt nya ankare än —
        // läs live-glidet och JAGA molnet dit det faktiskt är på väg, inte dit det
        // kastades ifrån.
        const mainGlide = hasMain ? mainGlideStateRef.current : null;
        const sunGlide = hasSun ? sunGlideStateRef.current : null;
        if (mainGlide || sunGlide) {
            const g: 'main' | 'sun' = (mainGlide && sunGlide)
                ? (lastRecenterRef.current === 'main' ? 'sun' : 'main')
                : (mainGlide ? 'main' : 'sun');
            latchOntoGlidingCloud(g, (g === 'main' ? mainGlide : sunGlide)!);
            return;
        }

        // Ett iväg-kastat moln (ligger utanför bild) prioriteras.
        const mainThrown = hasMain && mainOffScreenRef.current;
        const sunThrown = hasSun && sunOffScreenRef.current;
        const thrown = mainThrown || sunThrown;

        let go: 'main' | 'sun';
        if (thrown) {
            if (mainThrown && sunThrown) go = lastRecenterRef.current === 'main' ? 'sun' : 'main';
            else go = mainThrown ? 'main' : 'sun';
        } else if (hasMain && hasSun) {
            // Växla till det andra molnet — men om målet redan ligger (nära) mitten
            // skulle det bli en ~1px-flytt. Hoppa då till det andra molnet.
            const cx = map.getContainer().clientWidth / 2;
            const cy = map.getContainer().clientHeight / 2;
            const distFromCenter = (a: { lat: number; lng: number } | null) => {
                if (!a) return -1;
                const p = map.project([a.lng, a.lat]);
                return Math.hypot(p.x - cx, p.y - cy);
            };
            const CENTER_EPS = 60; // px — räknas som "redan centrerat"
            go = lastRecenterRef.current === 'main' ? 'sun' : 'main';
            const other: 'main' | 'sun' = go === 'main' ? 'sun' : 'main';
            const goDist = distFromCenter(go === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current);
            const otherDist = distFromCenter(other === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current);
            if (goDist >= 0 && goDist < CENTER_EPS && otherDist >= CENTER_EPS) go = other;
        } else {
            go = hasMain ? 'main' : 'sun';
        }
        lastRecenterRef.current = go;

        const target = go === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current;
        if (!target) return;
        // Pausa idle-driften under flytten (annars motas centreringen bort).
        driftSuppressUntilRef.current = performance.now() + 1600;
        map.easeTo({ center: [target.lng, target.lat], duration: 600 });

        if (thrown) {
            // Kastat moln + fokus: flyg dit OCH aktivera POV (follow) så vi följer
            // det medan det snurrar/glider klart. Avsluta med tryck på molnet igen.
            map.once('moveend', () => {
                if (go === 'main') { setSunFollowing(false); setMainFollowing(true); }
                else { setMainFollowing(false); setSunFollowing(true); }
            });
        } else {
            // Vanlig växling: molnen står still, bara kameran flyttas.
            setMainFollowing(false);
            setSunFollowing(false);
        }
    };

    useEffect(() => {
        if (recenterTrigger <= 0) return;
        recenterOnClouds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recenterTrigger]);

    // Gissnings-streck: när det sätts (efter en felgissning) zoomar kartan ut/in
    // så BÅDE gissningen och rätt svar syns, och vi projicerar strecket direkt.
    // När det nollställs försvinner strecket.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) { setGuessLineScreen(null); return; }
        if (!guessLine) { setGuessLineScreen(null); return; }

        // Projicera direkt så strecket finns redan första framen.
        const pf = map.project([guessLine.from.lng, guessLine.from.lat]);
        const pt = map.project([guessLine.to.lng, guessLine.to.lat]);
        setGuessLineScreen({ from: { x: pf.x, y: pf.y }, to: { x: pt.x, y: pt.y } });

        // Zooma ut så båda punkterna ryms. Generös padding för banner (topp) och
        // eventkortet (botten) så streck och markörer inte hamnar under dem.
        const bounds = new maplibregl.LngLatBounds(
            [guessLine.from.lng, guessLine.from.lat],
            [guessLine.from.lng, guessLine.from.lat]
        );
        bounds.extend([guessLine.to.lng, guessLine.to.lat]);
        driftSuppressUntilRef.current = performance.now() + 2000;
        map.fitBounds(bounds, {
            padding: {
                top: 150,
                bottom: Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.42),
                left: 90,
                right: 90
            },
            maxZoom: 13,
            duration: 900
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guessLine]);

    // Spawn a new sun-cloud at the current map center whenever the parent
    // bumps sunCloudTrigger (which it does after the white-flash animation
    // completes). Each spawn replaces the previous sun-cloud — keeps it simple
    // while still feeling responsive on rapid clicks.
    useEffect(() => {
        if (sunCloudTrigger <= 0) return;
        const map = mapRef.current;
        if (!map) return;
        const center = map.getCenter();
        setSunCloudAnchor({ lat: center.lat, lng: center.lng });
        const screen = map.project([center.lng, center.lat]);
        setSunCloudAnchorPos({ x: screen.x, y: screen.y });
        // Nollställ skalan till basstorlek vid nuvarande zoom — molnet "anpassar
        // sig efter den zoom det skapas på".
        sunCloudCreationZoomRef.current = map.getZoom();
        setSunCloudScale(SUN_CLOUD_BASE_SCALE);
        setSunCloudId(id => id + 1);
    }, [sunCloudTrigger]);

    // Pinna respektive moln vid sin nuvarande skärmpunkt när follow slås på,
    // och släpp pinnen (uppdatera geo-ankaret från sista skärmpunkt) när den
    // slås av. Kart-panorering är alltid på — molnet sitter kvar på skärmen
    // medan kartan glider under det, geo-ankaret härleds varje frame.
    const prevMainFollowingRef = useRef(false);
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        const prev = prevMainFollowingRef.current;
        prevMainFollowingRef.current = mainFollowing;
        if (mainFollowing && !prev) {
            const pos = cloudAnchorPosRef.current;
            mainFollowPtRef.current = pos ? { x: pos.x, y: pos.y } : null;
        } else if (!mainFollowing && prev) {
            const pt = mainFollowPtRef.current;
            if (pt) {
                const ll = map.unproject([pt.x, pt.y]);
                cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setCloudAnchorPos({ x: pt.x, y: pt.y });
            }
            mainFollowPtRef.current = null;
        }
    }, [mainFollowing]);

    const prevSunFollowingRef = useRef(false);
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        const prev = prevSunFollowingRef.current;
        prevSunFollowingRef.current = sunFollowing;
        if (sunFollowing && !prev) {
            const pos = sunCloudAnchorPosRef.current;
            sunFollowPtRef.current = pos ? { x: pos.x, y: pos.y } : null;
        } else if (!sunFollowing && prev) {
            const pt = sunFollowPtRef.current;
            if (pt) {
                const ll = map.unproject([pt.x, pt.y]);
                sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setSunCloudAnchorPos({ x: pt.x, y: pt.y });
            }
            sunFollowPtRef.current = null;
        }
    }, [sunFollowing]);

    // Kasta iväg ett moln: pinnen flyttas till släpp-punkten och kameran
    // flyger med matchande momentum/friktion. Eftersom det följs är fastpinnat
    // vid den skärmpunkten hela kameraflugen tracker det kameran utan slutligt
    // hopp. Båda molnen får varsin handler så vi vet vilket som flygs.
    const makeFlingHandler = (kind: 'main' | 'sun') =>
        (vx: number, vy: number, holdX: number, holdY: number) => {
            const map = mapRef.current;
            if (!map) return;

            // Klampa inom skärmen (med marginal) så molnet aldrig blir oåtkomligt.
            const margin = 48;
            holdX = Math.min(Math.max(holdX, margin), window.innerWidth - margin);
            holdY = Math.min(Math.max(holdY, margin), window.innerHeight - margin);
            const ll = map.unproject([holdX, holdY]);
            if (kind === 'sun') {
                sunFollowPtRef.current = { x: holdX, y: holdY };
                sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setSunCloudAnchorPos({ x: holdX, y: holdY });
            } else {
                mainFollowPtRef.current = { x: holdX, y: holdY };
                cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setCloudAnchorPos({ x: holdX, y: holdY });
            }

            const k = 2.2 / 1000; // friktion per ms (matchar molnets glide)
            const stopThreshold = 0.04; // px/ms
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed < stopThreshold) return; // bara släppt, ingen fling
            const dispX = vx / k;
            const dispY = vy / k;
            const duration = Math.min(Math.max(Math.log(speed / stopThreshold) / k, 300), 2600);
            const cs = map.project(map.getCenter());
            const target = map.unproject([cs.x + dispX, cs.y + dispY]);
            driftSuppressUntilRef.current = performance.now() + duration + 400;
            map.easeTo({ center: target, duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
        };
    const handleMainFling = useMemo(() => makeFlingHandler('main'), []);
    const handleSunFling = useMemo(() => makeFlingHandler('sun'), []);

    // Slangbella-avfyrning: anropas från drag-release-handlers när användaren
    // släpper ett moln efter att ha dragit det medan slangbellan var armad.
    // Det dragna molnet är projektilen — vi slungar det åt motsatt håll mot
    // dragget (origin → current ger pull-vektor; vi skjuter längs current →
    // origin och vidare ut, som en sten i en riktig slangbella).
    const fireSlingshot = (kind: 'main' | 'sun', curScreenX: number, curScreenY: number) => {
        const map = mapRef.current;
        if (!map) return;
        const snap = engageSnapshotRef.current;
        const origin = kind === 'main' ? snap.main : snap.sun;
        if (!origin) { onSlingshotFired?.(); return; }
        const cur = { x: curScreenX, y: curScreenY };
        const pullDist = Math.hypot(cur.x - origin.x, cur.y - origin.y);
        if (pullDist < 20) { onSlingshotFired?.(); return; } // för kort → avbryt
        // Vektor från current TILL origin = motsatt mot dragget. Snärten flyger
        // genom origin och vidare lika långt eller längre på andra sidan.
        const dx = origin.x - cur.x, dy = origin.y - cur.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len, uy = dy / len;
        const shoot = Math.min(1600, Math.max(600, pullDist * 3));
        const targetX = cur.x + ux * shoot;
        const targetY = cur.y + uy * shoot;
        const fromLL = map.unproject([cur.x, cur.y]);
        const toLL = map.unproject([targetX, targetY]);
        const startTime = performance.now();
        const duration = 900;
        const tick = (now: number) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const lat = fromLL.lat + (toLL.lat - fromLL.lat) * eased;
            const lng = fromLL.lng + (toLL.lng - fromLL.lng) * eased;
            const sp = map.project([lng, lat]);
            if (kind === 'main') {
                cloudAnchorRef.current = { lat, lng };
                setCloudAnchor({ lat, lng });
                setCloudAnchorPos({ x: sp.x, y: sp.y });
            } else {
                sunCloudAnchorRef.current = { lat, lng };
                setSunCloudAnchor({ lat, lng });
                setSunCloudAnchorPos({ x: sp.x, y: sp.y });
            }
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        onSlingshotFired?.();
    };

    // Off-screen-detektering. Ett moln räknas som ute ur bild när dess
    // skärmpunkt ligger en bra bit utanför viewporten — då visar sidan en
    // återkallnings-knapp jämte solen.
    useEffect(() => {
        const isOff = (p: { x: number; y: number } | null) => {
            if (!p) return true;
            const w = window.innerWidth, h = window.innerHeight;
            const margin = 60;
            return p.x < -margin || p.x > w + margin || p.y < -margin || p.y > h + margin;
        };
        setMainOffScreen(isOff(cloudAnchorPos));
        setSunOffScreen(sunCloudAnchor !== null && isOff(sunCloudAnchorPos));
    }, [cloudAnchorPos, sunCloudAnchorPos, sunCloudAnchor]);

    const onCloudVisibilityChangeRef = useRef(onCloudVisibilityChange);
    onCloudVisibilityChangeRef.current = onCloudVisibilityChange;
    useEffect(() => {
        // "main borta" = molnet ligger utanför skärmen ELLER är stängt (showCloud
        // false) — i båda fallen ska molnsymbolen (återkalla-knappen) visas.
        onCloudVisibilityChangeRef.current?.({ main: mainOffScreen || !showCloud, sun: sunOffScreen });
    }, [mainOffScreen, sunOffScreen, showCloud]);

    const onMainRecalledChangeRef = useRef(onMainRecalledChange);
    onMainRecalledChangeRef.current = onMainRecalledChange;
    useEffect(() => {
        onMainRecalledChangeRef.current?.(cloudRecalled);
    }, [cloudRecalled]);

    // ── Z-ordning mellan molnen: MINSTA molnet alltid överst ─────────────────
    // Huvudmolnet är fast (~1), sol-molnet växer/krymper med zoomen (sunCloudScale).
    // Det minsta ska ligga framför → när sol-molnet zoomas större hamnar det bakom.
    // Ett litet hysteres-band runt jämn storlek (där de "möts" storleksmässigt)
    // gör att ordningen inte flippar fram och tillbaka precis vid mötespunkten.
    const MAIN_CLOUD_SCALE = 1; // huvudmolnet skalas inte med zoom
    const [frontCloud, setFrontCloud] = useState<'main' | 'sun'>('sun');
    useEffect(() => {
        const band = 0.08; // halva mötes-spannet (i scale-enheter runt jämn storlek)
        setFrontCloud(prev => {
            if (sunCloudScale < MAIN_CLOUD_SCALE - band) return 'sun';  // sol mindre → överst
            if (sunCloudScale > MAIN_CLOUD_SCALE + band) return 'main'; // sol större → bakom
            return prev; // inom mötes-spannet: behåll ordningen (de sitter ihop här)
        });
    }, [sunCloudScale]);
    // Det främre molnet får högre z, det bakre lägre — runt det gamla 9999-lagret.
    const mainCloudZ = frontCloud === 'main' ? 10000 : 9998;
    const sunCloudZ = frontCloud === 'sun' ? 10000 : 9998;

    // Slangbella aktiv när båda molnen är inom räckhåll av varandra (skärmpunkter
    // någorlunda nära). Större yta = man behöver inte träffa molnet exakt med det
    // andra — det räcker att de är i samma område för att fokus-knappen ska kunna
    // armas. Själva gummibanden visas inte här — bara när användaren armat läget.
    useEffect(() => {
        const a = cloudAnchorPos, b = sunCloudAnchorPos;
        const both = showCloud && sunCloudAnchor !== null && !!a && !!b;
        const inRange = both && Math.hypot(a!.x - b!.x, a!.y - b!.y) < 240;
        setSlingshotActive(!!inRange);
    }, [cloudAnchorPos, sunCloudAnchorPos, showCloud, sunCloudAnchor]);

    // Mood-överföring: drar man ett moln med en min OVANPÅ det andra molnet får
    // det andra molnet samma min. Vi använder live-drag-offsetterna för att veta
    // vilket moln som dras och var det är just nu (inkl. pågående drag).
    useEffect(() => {
        const a = cloudAnchorPos, b = sunCloudAnchorPos;
        if (!showCloud || sunCloudAnchor === null || !a || !b) return;
        const aPos = { x: a.x + mainLiveOffset.x, y: a.y + mainLiveOffset.y };
        const bPos = { x: b.x + sunLiveOffset.x, y: b.y + sunLiveOffset.y };
        const overlapping = Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) < 90;
        if (!overlapping) return;
        const mainDragged = mainLiveOffset.x !== 0 || mainLiveOffset.y !== 0;
        const sunDragged = sunLiveOffset.x !== 0 || sunLiveOffset.y !== 0;
        // Det DRAGNA molnets min stämplas på det andra (om det dragna har en min
        // och de inte redan har samma — annars skulle det stämpla om i all evighet).
        if (mainDragged && mainMoodRef.current != null && sunMoodRef.current !== mainMoodRef.current) {
            setSunIncomingMood(prev => ({ mood: mainMoodRef.current, nonce: prev.nonce + 1 }));
        } else if (sunDragged && sunMoodRef.current != null && mainMoodRef.current !== sunMoodRef.current) {
            setMainIncomingMood(prev => ({ mood: sunMoodRef.current, nonce: prev.nonce + 1 }));
        }
    }, [mainLiveOffset, sunLiveOffset, cloudAnchorPos, sunCloudAnchorPos, sunCloudAnchor, showCloud]);

    const onSlingshotChangeRef = useRef(onSlingshotChange);
    onSlingshotChangeRef.current = onSlingshotChange;
    useEffect(() => {
        onSlingshotChangeRef.current?.(slingshotActive);
    }, [slingshotActive]);

    // Återkalla ett moln till en synlig position. Snäpper både skärm- och
    // geo-ankaret till en punkt i nedre högra kanten (där sol-knappen sitter),
    // så molnet är direkt gripbart.
    const recallCloud = (kind: 'main' | 'sun') => {
        const map = mapRef.current; if (!map) return;
        const w = window.innerWidth, h = window.innerHeight;
        // Huvudmolnet hämtas tillbaka till skärmens MITT; sol-molnet till nedre
        // högra hörnet (vid sol-knappen).
        const targetX = kind === 'main' ? w * 0.5 : w * 0.78;
        const targetY = kind === 'main' ? h * 0.5 : h * 0.55;
        const ll = map.unproject([targetX, targetY]);
        if (kind === 'main') {
            cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
            setCloudAnchor({ lat: ll.lat, lng: ll.lng });
            setCloudAnchorPos({ x: targetX, y: targetY });
            setShowCloud(true);
            // Återkallat moln kommer fram som det runda leende-molnet, inte texten.
            setCloudRecalled(true);
            if (mainFollowingRef.current) mainFollowPtRef.current = { x: targetX, y: targetY };
        } else {
            sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
            setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
            setSunCloudAnchorPos({ x: targetX, y: targetY });
            if (sunFollowingRef.current) sunFollowPtRef.current = { x: targetX, y: targetY };
        }
    };
    const prevRecallMainRef = useRef(recallMainTrigger);
    useEffect(() => {
        if (recallMainTrigger > prevRecallMainRef.current) recallCloud('main');
        prevRecallMainRef.current = recallMainTrigger;
    }, [recallMainTrigger]);
    const prevRecallSunRef = useRef(recallSunTrigger);
    useEffect(() => {
        if (recallSunTrigger > prevRecallSunRef.current) recallCloud('sun');
        prevRecallSunRef.current = recallSunTrigger;
    }, [recallSunTrigger]);

    const handleSunCloudDragEnd = (ox: number, oy: number) => {
        const map = mapRef.current;
        const currentPos = sunCloudAnchorPosRef.current;
        if (map && currentPos) {
            const newScreenX = currentPos.x + ox;
            const newScreenY = currentPos.y + oy;
            const lngLat = map.unproject([newScreenX, newScreenY]);
            // Synka geo-ankar-refen direkt (samma fix som huvudmolnet — undviker
            // att ett 'move' under pan projicerar det gamla ankaret en frame).
            sunCloudAnchorRef.current = { lat: lngLat.lat, lng: lngLat.lng };
            setSunCloudAnchorPos({ x: newScreenX, y: newScreenY });
            setSunCloudAnchor({ lat: lngLat.lat, lng: lngLat.lng });
            // Slangbella armad → avfyra åt motsatt håll mot dragget.
            if (slingshotEngagedRef.current) {
                fireSlingshot('sun', newScreenX, newScreenY);
            }
        }
    };

    // Update coordinates when dropped
    const handleCloudDragEnd = (ox: number, oy: number) => {
        const map = mapRef.current;
        const currentPos = cloudAnchorPosRef.current;
        if (map && currentPos) {
            const newScreenX = currentPos.x + ox;
            const newScreenY = currentPos.y + oy;
            const lngLat = map.unproject([newScreenX, newScreenY]);
            // Synka geo-ANKAR-refen DIREKT (inte bara state). Annars kan ett 'move'-
            // event som fyrar medan man pannar projicera det GAMLA ankaret innan
            // refen hunnit uppdateras vid nästa render → molnet blinkar till vid
            // kast-origin för en frame. (recallCloud gör redan så här.)
            cloudAnchorRef.current = { lat: lngLat.lat, lng: lngLat.lng };
            setCloudAnchorPos({ x: newScreenX, y: newScreenY });
            setCloudAnchor({ lat: lngLat.lat, lng: lngLat.lng });
            // Slangbella armad → avfyra åt motsatt håll mot dragget.
            if (slingshotEngagedRef.current) {
                fireSlingshot('main', newScreenX, newScreenY);
            }
        }
    };

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
            const isSelected = !gameMode && !!inGroupSelected;
            const isSaved = group.some(e => savedEventIds.has(e.id));
            const isDiscarded = group.every(e => discardedEventIds.has(e.id));
            // Guld-markör = det rätta svaret som avslöjats. Skimrar och ligger överst.
            const isGold = !!goldEventId && group.some(e => e.id === goldEventId);
            // Markören man gissade på — hålls synlig (brickan visas direkt) efter avslöjet.
            const isGuessed = !!guessedEventId && group.some(e => e.id === guessedEventId);

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
            if (isSelected || isGold || isGuessed) revealedKeysRef.current.add(key);
            const isRevealed = revealedKeysRef.current.has(key);

            const isWatered = shopFlags.flowers && wateredKeys.has(key);
            const isWatering = shopFlags.flowers && wateringKey === key;

            // Event skapade direkt på VADKUL lyfts fram med en egen smaragdgrön
            // bricka (samma gröna som skapa-flödet) — de är sajtens kärna.
            // Gäller bara enskilda markörer; grupper cyklar genom flera event
            // och behåller därför standardutseendet.
            const isUserCreated = count === 1 && !!rep.userCreated;

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // För multi-event-grupper använder vi ett stabilt 'multi'-värde så
            // att stateKey inte ändras varje slideshow-tick (annars rivs brickan
            // ner och byggs upp igen + pop-in-animationen återstartas). Själva
            // emoji-bytet sker kirurgiskt längre ner.
            const stateKeyCategory = count > 1 ? 'multi' : (rep.category ?? 'other');
            const stateKey = `${isSelected}:${isRevealed}:${isSaved}:${isDiscarded}:${count}:${stateKeyCategory}:${startsWithinHour}:${isGold}:${isWatered}:${isWatering}:${isUserCreated}:${pinballMode}`;

            let markerData = markersRef.current.get(key);

            // Om pinballMode har växlat måste vi riva ner och återskapa
            // MapLibre-markören — anchor kan bara sättas vid skapandet.
            if (markerData && markerData.lastPinballMode !== pinballMode) {
                markerData.marker.remove();
                markersRef.current.delete(key);
                markerData = undefined;
            }

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

                // I pinball-läge använder vi 'center' som anchor så att bollens
                // kollisionspunkt stämmer exakt med markörens visuella mittpunkt.
                // I normalt läge: 'bottom' (nålspetsen pekar på koordinaten).
                const anchor = pinballMode ? 'center' : 'bottom';
                const marker = new maplibregl.Marker({
                    element: el,
                    anchor,
                })
                .setLngLat([rep.lng!, rep.lat!])
                .addTo(map);

                markerData = { marker, element: el, lastStateKey: '', lastPinballMode: pinballMode };
                markersRef.current.set(key, markerData);
            }

            // Uppdatera ENDAST om tillståndet faktiskt har förändrats
            if (markerData.lastStateKey !== stateKey) {
                markerData.lastStateKey = stateKey;

                // Uppdatera z-index på elementet. Viktiga tillstånd ligger överst.
                const zIndex = isGold ? 1500
                    : isSelected ? 1000
                    : isSaved ? 500
                    : isUserCreated ? 300
                    : count > 1 ? 200
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
                    if (gameModeRef.current) { onGuessRef.current?.(group); return; }
                    onSelectEventRef.current(rep);
                };

                // "Stor" källa (PRO/Korpen/Svenska kyrkan) identifieras för att
                // EXKLUDERA dem från kategorifärgningen — de får standardmörk bricka.
                // Alla övriga event får sin kategori-färg i standardläge.
                // Speciella tillstånd (vald/guld/sparad m.fl.) går alltid före.
                const catKey = rep.category && EVENT_CATEGORIES[rep.category] ? rep.category : 'other';
                const isBigSource = sourceColor(rep.url || rep.id) !== null;

                // Kategori-färg för icke-stora-källors event.
                const catColorHex = !isBigSource
                    ? (EVENT_CATEGORIES[catKey as EventCategoryType] as { markerHex?: string }).markerHex ?? null
                    : null;

                // Nål-brickans utseende per tillstånd. Mörkgrå standardbricka med
                // mjuk gradient för djup; VADKUL-skapade event får en smaragdgrön
                // bricka (samma gröna som skapa-flödet); guld = rätt svar i spelet.
                // Prioritet: vald (blå) > guld > inom 1 timme (orange) > VADKUL-
                // skapad (grön) > sparad (ljusblå) > kategori-färg > standard (mörk).
                const pinBg = isGold
                    ? 'linear-gradient(135deg, #fff7d6 0%, #fbbf24 45%, #d97706 100%)'
                    : isUserCreated
                    ? 'linear-gradient(145deg, #34d399 0%, #059669 55%, #047857 100%)'
                    : isSaved
                    ? 'linear-gradient(145deg, #ffffff 0%, #eef2f7 100%)'
                    : catColorHex
                    ? sourceGradientCss(catColorHex)
                    : 'linear-gradient(145deg, #344256 0%, #1e293b 55%, #16202e 100%)';
                const pinBorder = isGold
                    ? '3px solid #fde68a'
                    : isSelected
                    ? '3px solid #006AA7'
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
                const pinShadow = isGold
                    ? '0 0 0 4px rgba(251,191,36,0.35), 0 6px 22px rgba(217,119,6,0.55)'
                    : isSelected
                    ? '0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)'
                    : startsWithinHour
                    ? '0 0 0 3px rgba(249,115,22,0.28), 0 6px 18px rgba(249,115,22,0.40)'
                    : isUserCreated
                    ? '0 0 0 3px rgba(16,185,129,0.25), 0 6px 18px rgba(5,150,105,0.45)'
                    : isSaved
                    ? '0 4px 10px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)';

                // Vald/guld-bricka växer på plats (transform-origin: bottom center →
                // spetsen stannar på koordinaten, ingen translateY som lyfter av den).
                const scaleStyle = (isSelected || isGold) ? 'scale(1.2)' : 'scale(1)';
                const opacityStyle = isDiscarded ? 'opacity: 0.25; filter: grayscale(1);' : '';

                const emoji = rep.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');

                // Sifferbricka i hörnet för grupper; en liten prick för sparade enskilda.
                const countBadge = count > 1
                    ? `<div class="badge-count">${count > 99 ? '99+' : count}</div>`
                    : (isSaved ? '<div class="badge-saved"></div>' : '');

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
                const pinAnimationStyle = showImmediately
                    ? 'animation: none !important; opacity: 1 !important; transform: ' + scaleStyle + ' !important;'
                    : `transform: ${scaleStyle}; animation-delay: ${Math.round(animDelay)}ms;`;

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

                // I pinball-läge: markören är en rund studsare utan nålspets.
                // .pinball-marker på yttre wrapper styr animationsoverride;
                // .pin-bubble-round på bubblan tar bort rotation och fixar border-radius.
                const pinballWrapperClass = pinballMode ? ' pinball-marker' : '';
                const pinballBubbleClass = pinballMode ? ' pin-bubble-round' : '';

                markerData.element.innerHTML = `
                    <div class="custom-marker-wrapper${pinballWrapperClass}" style="${opacityStyle}; ${wrapperStyle}">
                        <div class="pin-element" style="${pinAnimationStyle}">
                            <div class="pin-bubble${pinballBubbleClass}${isGold ? ' pin-bubble-gold' : ''}${isWatering ? (isSparkleActive ? ' pin-bubble-watering-sparkle' : isSnowballActive ? ' pin-bubble-watering-snowball' : ' pin-bubble-watering') : ''}" style="background:${pinBg}; border:${pinBorder}; box-shadow: ${pinShadow};">
                                <div class="pin-emoji">${emoji}</div>
                            </div>
                            ${countBadge}
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
    }, [visibleGroups, selectedEvent, savedEventIds, discardedEventIds, gameMode, goldEventId, guessedEventId, wateredKeys, wateringKey, shopFlags, tilted, minuteTick]);

    // Bakgrunden bakom kartan syns vid snabb panorering (innan tiles laddat)
    // och som "rymd" bakom klotet — matcha aktiv kartstil så det aldrig
    // blixtrar ljusgrått på mörka kartor.
    const containerBg = mapStyle === 'dark' ? '#141414'
        : mapStyle === 'satellite' ? '#10181f'
        : mapStyle === 'themepark' ? '#b9d49c'
        : mapStyle === 'orientering' ? '#efe9dc'
        : '#f1f5f9';

    return (
        <div className="absolute inset-0 z-0" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, background: containerBg }}>
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
                        transform: scale(1) translateY(0);
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
                /* Flipper-läge: RUNDA studsare. Klasserna sätts bara i pinball, så
                   vanliga läget (droppen) är orört. Specificitet (2-3 klasser) vinner
                   över .pin-bubble utan !important → träff-blinken kan ändå skala. */
                .pin-bubble.pin-bubble-round { border-radius: 50%; transform: none; }
                .pin-bubble.pin-bubble-round::before { display: none; }
                .pin-bubble.pin-bubble-round .pin-emoji { transform: none; }
                .pinball-marker .pin-element { transform: none; }
                /* Zoom-skala: krymp pinball-markörerna när kartan är utzoomad
                   (--pin-zoom-scale sätts på kartcontainern i geo-flippern). Skalar
                   runt nederkanten = ankaret, så bumpern stannar på koordinaten. */
                .custom-marker-wrapper.pinball-marker {
                    transform: scale(var(--pin-zoom-scale, 1));
                    transform-origin: bottom center;
                }
                @media (hover: hover) and (pointer: fine) {
                    .v2-custom-marker:hover .pin-bubble.pin-bubble-round { transform: scale(1.07); }
                }
                /* Träff: studsaren blinkar/poppar när bollen "tar i" den. */
                .pin-bubble.pin-hit-flash { animation: pinHitPulse 0.3s ease-out; z-index: 5; }
                @keyframes pinHitPulse {
                    0%   { transform: scale(1);    filter: brightness(1);   box-shadow: 0 0 0 0 rgba(251,191,36,0.75); }
                    40%  { transform: scale(1.45); filter: brightness(1.9); box-shadow: 0 0 0 10px rgba(251,191,36,0); }
                    100% { transform: scale(1);    filter: brightness(1); }
                }
                /* Guld-markör: skimrar med en pulserande gloria runt brickan så
                   det rätta svaret syns tydligt även från avstånd. */
                @keyframes gold-marker-shimmer {
                    0%, 100% {
                        box-shadow: 0 0 0 3px rgba(251,191,36,0.30), 0 6px 22px rgba(217,119,6,0.45);
                        filter: brightness(1);
                    }
                    50% {
                        box-shadow: 0 0 0 7px rgba(251,191,36,0.12), 0 8px 28px rgba(217,119,6,0.7);
                        filter: brightness(1.18);
                    }
                }
                .pin-bubble-gold {
                    animation: gold-marker-shimmer 1.4s ease-in-out infinite;
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

            {/* Pinball/Flipper-overlay: en isolerad canvas ovanpå kartan (men under
                de body-nivå-kontroller som ligger i egna stacking-kontext). Fångar
                pekar-input bara när läget är på; annars helt genomsläpplig/dold. */}
            <canvas
                ref={pinCanvasRef}
                className="absolute inset-0 pinball-canvas"
                aria-hidden={!pinballMode}
                style={{
                    zIndex: 1600,
                    touchAction: 'none',
                    // Fånga drag/skjut-gester bara i skjut-läget (!pinMoveMode);
                    // annars genomsläpplig (none) så man kan flytta och zooma kartan.
                    pointerEvents: pinballMode && !pinMoveMode ? 'auto' : 'none',
                    display: pinballMode ? 'block' : 'none',
                }}
                onPointerDown={onPinPointerDown}
                onPointerMove={onPinPointerMove}
                onPointerUp={onPinPointerUp}
                onPointerCancel={onPinPointerUp}
            />

            {/* Reviret-HUD: visar revirets storlek. Bara i pinball-läget med
                territorie-funktionen på. pointer-events: none så den aldrig
                fångar slangbella-dragget på canvasen under. */}
            {pinballMode && revStats && (
                <div
                    className="absolute left-1/2 z-[1601] -translate-x-1/2 select-none pointer-events-none"
                    style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)' }}
                >
                    <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3.5 py-1.5 text-white shadow-lg backdrop-blur-sm">
                        <Hexagon size={15} className="text-[#4da3d6]" />
                        {revStats.cells === 0 ? (
                            <span className="text-[13px] font-medium">Skjut kulan — måla ditt revir</span>
                        ) : (
                            <span className="flex items-baseline gap-2 text-[13px] tabular-nums">
                                <span className="font-bold text-amber-300">{revStats.cells + revStats.enclosed} poäng</span>
                                <span className="text-white/40">·</span>
                                <span className="font-semibold text-[#9fd0ec]">{revStats.events} event</span>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Topplista (dagens bästa resultat). ALLTID synlig i flipper-läget med
                territorie-funktionen på — jag själv vävs in live (mina rutor +
                nymark-steg klättrar medan jag rullar) så listan aldrig är tom även
                innan reglerna deployats / utloggad. Färgad per spelare.
                pointer-events: none så den aldrig fångar skott-dragget. */}
            {pinballMode && revStats && (() => {
                const selfUid = myUid ?? '__me__';
                const selfPoints = revStats.cells + revStats.enclosed;
                const selfEvents = revStats.events;
                const selfHue = myReviretHue ?? (myUid ? hueForUid(myUid) : 205); // neutral blå om utloggad
                const rows: LeaderboardEntry[] = leaderboard.map((e) => ({ ...e }));
                const mine = myUid ? rows.find((r) => r.uid === myUid) : undefined;
                if (mine) {
                    mine.points = Math.max(mine.points, selfPoints);
                    mine.events = Math.max(mine.events, selfEvents);
                    mine.hue = selfHue; // visa min aktuella valda färg direkt
                } else {
                    rows.push({ uid: selfUid, name: 'Du', hue: selfHue, points: selfPoints, events: selfEvents });
                }
                // Rankning efter valt mått (revir-poäng eller flest besökta event).
                rows.sort((a, b) => lbSort === 'events'
                    ? (b.events - a.events || b.points - a.points)
                    : (b.points - a.points || b.events - a.events));
                const board = rows.slice(0, 6);
                const tab = (key: 'points' | 'events', label: string) => (
                    <button
                        type="button"
                        onClick={() => setLbSort(key)}
                        className={`pointer-events-auto rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors ${
                            lbSort === key ? 'bg-amber-400 text-slate-900' : 'text-white/55 hover:text-white'
                        }`}
                    >
                        {label}
                    </button>
                );
                return (
                    <div
                        className="absolute right-3 z-[1601] w-[200px] select-none pointer-events-none"
                        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 104px)' }}
                    >
                        <div className="rounded-2xl border border-white/10 bg-slate-900/85 px-3 py-2.5 text-white shadow-xl backdrop-blur-sm">
                            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
                                <Trophy size={13} /> Topplista idag
                            </div>
                            <div className="mb-2 flex items-center gap-1 rounded-full bg-white/5 p-0.5">
                                {tab('points', 'Revir')}
                                {tab('events', 'Besökta')}
                            </div>
                            <ol className="flex flex-col gap-0.5">
                                {board.map((e, i) => {
                                    const isMe = e.uid === selfUid;
                                    const evActive = lbSort === 'events';
                                    return (
                                        <li
                                            key={e.uid}
                                            className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${isMe ? 'bg-white/10' : ''}`}
                                        >
                                            <span className="w-3 shrink-0 text-center text-[11px] font-bold tabular-nums text-white/40">{i + 1}</span>
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ background: `hsl(${e.hue}, 72%, 52%)` }}
                                            />
                                            <span className={`flex-1 truncate text-[12px] ${isMe ? 'font-bold' : 'font-medium'}`}>
                                                {isMe ? 'Du' : e.name}
                                            </span>
                                            <span className={`tabular-nums ${evActive ? 'text-[10px] text-white/40' : 'text-[12px] font-bold text-amber-300'}`}>{e.points}</span>
                                            <span className={`tabular-nums ${evActive ? 'text-[12px] font-bold text-emerald-300' : 'text-[10px] text-white/40'}`}>{evActive ? '' : '·'}{e.events}{evActive ? ' ev' : ''}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>
                );
            })()}

            {/* Geo-flipper-HUD: en tydlig instruktion + träffräknare + lägesväljare */}
            {pinballMode && (
                <div
                    className="absolute left-1/2 z-[1602] flex -translate-x-1/2 flex-col items-center gap-2 select-none pointer-events-none"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
                >
                    {pinShotHits > 0 && (
                        <div className="rounded-full bg-amber-400 px-3.5 py-1 text-[13px] font-black text-slate-900 shadow-lg tabular-nums animate-bounce">
                            {pinShotHits} träff{pinShotHits === 1 ? '' : 'ar'}!
                        </div>
                    )}
                    
                    {/* Läges-knappar för Flytta vs Skjut */}
                    <div className="flex items-center gap-1 rounded-full bg-slate-950/90 p-1 border border-white/10 shadow-lg pointer-events-auto">
                        <button
                            type="button"
                            onClick={() => setPinMoveMode(true)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                                pinMoveMode
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Flytta & Zooma
                        </button>
                        <button
                            type="button"
                            onClick={() => setPinMoveMode(false)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                                !pinMoveMode
                                    ? 'bg-rose-500 text-white shadow-sm animate-pulse'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Dra & Skjut
                        </button>
                    </div>

                    {/* Instruktionstext baserat på aktuellt läge */}
                    <div className="flex items-center gap-2 rounded-full bg-slate-900/85 px-4 py-2 text-[12px] font-semibold text-white shadow-xl backdrop-blur-sm">
                        {pinMoveMode ? (
                            <>
                                <span className="text-sm" aria-hidden>🧭</span>
                                Flytta och zooma kartan för att hitta bra lägen
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
                                </svg>
                                Dra bakåt från bollen & släpp för att skjuta!
                            </>
                        )}
                    </div>
                </div>
            )}

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
                type CrateItem = { key: string; label: string; desc: string; color: string; icon: React.ReactNode; kind?: 'game' | 'pinball'; locked?: boolean };
                const crateItems: CrateItem[] = [
                    // Popup-meny: symbol + namn + kort info. Varje funktion har en egen
                    // passande accent-färg på symbolen; aktiv rad tonas i samma färg.
                    // Upplåst överst: Satellit, Skapa event, Hitta event, Flipper +
                    // kartstilarna Nöjesfält, Orientering & 3D-terräng. Resten är låsta.
                    { key: 'satellite', label: 'Satellit', desc: 'Byt mellan satellit- och vanlig karta', color: '#0d9488', icon: <Satellite size={20} /> },
                    { key: 'createEvent', label: 'Skapa event', desc: 'Skapa egna event på kartan', color: '#22c55e', icon: <Plus size={20} strokeWidth={2.5} /> },
                    { key: 'findgame', label: 'Hitta event', desc: 'Spel: hitta eventet på kartan', color: '#8b5cf6', icon: <Gamepad2 size={20} />, kind: 'game' },
                    { key: 'pinball', label: 'Flipper', desc: 'Rulla en kula — träffa event för att öppna', color: '#f43f5e', icon: <Disc3 size={20} />, kind: 'pinball' },
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
                const isCrateActive = (it: CrateItem) => it.kind === 'pinball' ? pinballMode : it.kind === 'game' ? findGameActive : isFeatureActive(it.key);
                const activeBagCount = crateItems.reduce((n, it) => n + (isCrateActive(it) ? 1 : 0), 0);

                const handleCrate = (it: CrateItem) => {
                    if (it.kind === 'pinball') {
                        if (pinballMode) onStopPinball?.();
                        else if (canStartPinball) onStartPinball?.();
                        setFuncBagOpen(false);
                        return;
                    }
                    if (it.kind === 'game') {
                        if (findGameActive) onStopFindGame?.();
                        else if (canStartFindGame) onStartFindGame?.();
                        setFuncBagOpen(false);
                        return;
                    }
                    // Klick på en tipsad funktion (t.ex. Fokus) → sluta blinka den.
                    setFeatureHint(h => h === it.key ? null : h);
                    // "Kasta" = kamera-följ. Att slå PÅ den ska kännas som ett dubbel-
                    // klick på molnet: sätt även följ-läget direkt (molnet ler) så man
                    // kan kasta på en gång och kameran följer med. Slå av → sluta följa.
                    if (it.key === 'throw') setMainFollowing(!isFeatureActive('throw'));
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
                                    // "Hitta event" är bara avstängd när ingen runda är möjlig.
                                    const locked = !!it.locked;
                                    const disabled = locked
                                        || (it.kind === 'game' && !findGameActive && !canStartFindGame)
                                        || (it.kind === 'pinball' && !pinballMode && !canStartPinball);
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
                                <Layers size={20} />
                                {activeBagCount > 0 && !funcBagOpen && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#006AA7] text-white text-[10px] font-black flex items-center justify-center border border-white">
                                        {activeBagCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Fokus — direkt UNDER funktions-knappen (vänsterkolumnen,
                            top-[72px] + 40px + 8px = top-[120px]). Centrerar kartan på
                            det valda eventet, annars passas alla dagens event in i vyn.
                            Göms när väskan är öppen (panelen täcker annars knappen). */}
                        {!funcBagOpen && (
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
                        {!funcBagOpen && (
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
            {/* Slangbella-gummiband: ritas mellan huvudmolnet och solmolnet.
                Använder live drag-offsetterna så banden stretchar med molnet i
                realtid när användaren drar. När slangbellan är "engaged" (armad
                via fokusknappen) syns banden alltid; annars fadar de in när
                molnen är nära varandra. */}
            {showCloud && cloudAnchorPos && sunCloudAnchorPos && slingshotEngaged && (() => {
                const aRaw = { x: cloudAnchorPos.x + mainLiveOffset.x, y: cloudAnchorPos.y + mainLiveOffset.y };
                const bRaw = { x: sunCloudAnchorPos.x + sunLiveOffset.x, y: sunCloudAnchorPos.y + sunLiveOffset.y };
                const distRaw = Math.hypot(aRaw.x - bRaw.x, aRaw.y - bRaw.y);
                // Banden visas BARA när slangbellan är armad — i ready-läget syns
                // ingenting, fokusknappen ändras bara så användaren kan godkänna.
                const opacity = 1;
                // Degenererat fall: när molnen ligger ovanpå varandra (eller mycket
                // nära) finns ingen riktning mellan dem → bandberäkningen kollapsar.
                // Vi tvingar då fram en minsta horisontell separation så banden
                // syns som ett armat "=" runt molnen, redo att dras isär.
                const minDist = 36;
                let a = aRaw, b = bRaw;
                if (distRaw < minDist) {
                    const cx0 = (aRaw.x + bRaw.x) / 2, cy0 = (aRaw.y + bRaw.y) / 2;
                    a = { x: cx0 - minDist / 2, y: cy0 };
                    b = { x: cx0 + minDist / 2, y: cy0 };
                }
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const dx = b.x - a.x, dy = b.y - a.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                const nx = -dy / len, ny = dx / len; // perpendikulär
                const spread = 13; // halva bandbredden i pixlar
                const sag = 18 + dist * 0.08; // hur mycket banden bågnar utåt
                const a1 = { x: a.x + nx * spread, y: a.y + ny * spread };
                const a2 = { x: a.x - nx * spread, y: a.y - ny * spread };
                const b1 = { x: b.x + nx * spread, y: b.y + ny * spread };
                const b2 = { x: b.x - nx * spread, y: b.y - ny * spread };
                const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
                const c1 = { x: cx + nx * (spread + sag), y: cy + ny * (spread + sag) };
                const c2 = { x: cx - nx * (spread + sag), y: cy - ny * (spread + sag) };
                return (
                    <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: '100%', height: '100%', opacity, transition: 'opacity 0.2s ease-out' }}
                    >
                        <path
                            d={`M ${a1.x} ${a1.y} Q ${c1.x} ${c1.y} ${b1.x} ${b1.y}`}
                            stroke="#006AA7" strokeWidth={4} strokeLinecap="round" fill="none"
                            opacity={0.85}
                        />
                        <path
                            d={`M ${a2.x} ${a2.y} Q ${c2.x} ${c2.y} ${b2.x} ${b2.y}`}
                            stroke="#006AA7" strokeWidth={4} strokeLinecap="round" fill="none"
                            opacity={0.85}
                        />
                    </svg>
                );
            })()}
            {/* Gissnings-streck: streckad linje mellan din gissning och rätt svar,
                med avståndet i mitten. Ritas efter en felgissning i spelet. */}
            {guessLineScreen && guessLine && (() => {
                const a = guessLineScreen.from, b = guessLineScreen.to;
                const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
                return (
                    <>
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                            <line
                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                stroke="#f59e0b" strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" opacity={0.95}
                            />
                            <circle cx={a.x} cy={a.y} r={7} fill="#475569" stroke="#fff" strokeWidth={2.5} />
                            <circle cx={b.x} cy={b.y} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />
                        </svg>
                        {guessLine.label && (
                            <div
                                className="absolute -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg border border-white/60 pointer-events-none whitespace-nowrap"
                                style={{ left: midX, top: midY }}
                            >
                                {guessLine.label}
                            </div>
                        )}
                    </>
                );
            })()}
            {CLOUDS_ENABLED && showCloud && cloudAnchorPos && eventsLoaded && (
                <CloudPopup
                    message={
                        isFeatureActive('sparkle') ? (
                            <span className="block font-rounded tracking-tight" style={{ transform: 'translateY(-12px)' }}>
                                <span
                                    className="block text-[19px] sm:text-[23px] leading-tight whitespace-nowrap"
                                    style={{ color: '#db2777', fontWeight: 700, letterSpacing: '-0.01em' }}
                                >
                                    Magiskt glitter! ✨
                                </span>
                                <span
                                    className="block text-[14px] sm:text-[16px] leading-snug my-1 text-pink-600 font-semibold"
                                >
                                    Håll mig över en nål för att dränka den i glittrande stjärnfall!
                                </span>
                            </span>
                        ) : isFeatureActive('snowball') ? (
                            <span className="block font-rounded tracking-tight" style={{ transform: 'translateY(-12px)' }}>
                                <span
                                    className="block text-[19px] sm:text-[23px] leading-tight whitespace-nowrap"
                                    style={{ color: '#1d4ed8', fontWeight: 700, letterSpacing: '-0.01em' }}
                                >
                                    Snöbollskrig! ❄️
                                </span>
                                <span
                                    className="block text-[14px] sm:text-[16px] leading-snug my-1 text-blue-600 font-semibold"
                                >
                                    Brrr! Håll mig över en nål för att kyla ner den med virvlande snöflingor!
                                </span>
                            </span>
                        ) : cloudStats ? (
                            <span className="block font-rounded tracking-tight" style={{ transform: 'translateY(-12px)' }}>
                                <span
                                    className="block text-[19px] sm:text-[23px] leading-tight whitespace-nowrap"
                                    style={{ color: '#006AA7', fontWeight: 700, letterSpacing: '-0.01em' }}
                                >
                                    {cloudStats.today} unika event idag
                                </span>
                                <span
                                    className="block text-[15px] sm:text-[17px] leading-snug my-1"
                                    style={{ color: '#006AA7', fontWeight: 600 }}
                                >
                                    {cloudStats.withinHour} börjar inom {cloudStats.withinHours} {cloudStats.withinHours === 1 ? 'timme' : 'timmar'}.
                                </span>
                                <span
                                    className="block text-[13px] sm:text-[14px] leading-snug"
                                    style={{ color: '#006AA7', fontWeight: 500 }}
                                >
                                    Alla spontana event i Sverige.
                                </span>
                            </span>
                        ) : `Se alla publika event du kan anmäla dig till idag. Ett nytt kan dyka upp nästa sekund.`
                    }
                    anchorPos={cloudAnchorPos}
                    onDragEnd={handleCloudDragEnd}
                    onDismiss={() => { setShowCloud(false); setMainFollowing(false); }}
                    throwEnabled={true}
                    followEnabled={isFeatureActive('throw')}
                    facesEnabled={isFeatureActive('faces')}
                    following={mainFollowing}
                    onToggleFollow={() => setMainFollowing(f => !f)}
                    onFollowFling={handleMainFling}
                    glideStateRef={mainGlideStateRef}
                    onLiveOffsetChange={(ox, oy) => setMainLiveOffset({ x: ox, y: oy })}
                    dismissOnTap={!cloudRecalled}
                    startClicked={cloudRecalled}
                    onMoodChange={setMainMood}
                    incomingMood={mainIncomingMood.mood}
                    incomingMoodNonce={mainIncomingMood.nonce}
                    tilted={tilted}
                    scale={mainPerspectiveScale}
                    maxScale={CLOUD_MAX_SCALE}
                    getDepthAtPoint={depthAtPointRef.current}
                    zIndex={mainCloudZ}
                />
            )}
            {CLOUDS_ENABLED && sunCloudAnchor && sunCloudAnchorPos && (
                <CloudPopup
                    key={sunCloudId}
                    message=""
                    anchorPos={sunCloudAnchorPos}
                    onDragEnd={handleSunCloudDragEnd}
                    onDismiss={() => { setSunCloudAnchor(null); setSunFollowing(false); }}
                    throwEnabled={true}
                    followEnabled={isFeatureActive('throw')}
                    facesEnabled={isFeatureActive('faces')}
                    faceScale={0.6}
                    showDelayMs={0}
                    scale={sunCloudScale * sunPerspectiveScale}
                    maxScale={CLOUD_MAX_SCALE}
                    getDepthAtPoint={depthAtPointRef.current}
                    following={sunFollowing}
                    onToggleFollow={() => setSunFollowing(f => !f)}
                    onFollowFling={handleSunFling}
                    glideStateRef={sunGlideStateRef}
                    onLiveOffsetChange={(ox, oy) => setSunLiveOffset({ x: ox, y: oy })}
                    onMoodChange={setSunMood}
                    incomingMood={sunIncomingMood.mood}
                    incomingMoodNonce={sunIncomingMood.nonce}
                    onTap={onSunCloudTap}
                    tilted={tilted}
                    zIndex={sunCloudZ}
                />
            )}
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
