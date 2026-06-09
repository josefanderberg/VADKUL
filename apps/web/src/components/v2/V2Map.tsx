'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Box, Globe, Mountain, Plus, X, Video, Send, Sun, Target, Crosshair, Maximize2, Zap, Sparkles, Snowflake, Lock, Users, Gamepad2, Smile, Satellite, Flower2, Cloud, Flag, Map as MapIcon } from 'lucide-react';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import CloudPopup, { CloudExpression } from '../ui/CloudPopup';

// Två basstilar: standard vektor-karta (Voyager) och en raster-satellitvy
// (ESRI World Imagery). Vi växlar via map.setStyle(); markörer behålls eftersom
// de är DOM-element i container, inte en del av style-spec:en.
const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const SATELLITE_STYLE: maplibregl.StyleSpecification = {
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
    onFeatureFlagsChange?: (flags: { sun: boolean; focus: boolean; createEvent: boolean; multiplayer: boolean; findcloud: boolean }) => void;
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
    recallMainTrigger = 0,
    recallSunTrigger = 0,
    recenterTrigger = 0,
    daySwitchNonce = 0,
    onCloudVisibilityChange,
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
    onStopFindGame
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string }>>(new Map());
    // Grupp-nycklar som någon gång visats som bricka via att vara markerade.
    // En gång avslöjad → brickan visas alltid direkt (ingen staggered kö), så
    // ett event man navigerat förbi inte faller tillbaka till nål.
    const revealedKeysRef = useRef<Set<string>>(new Set());

    const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('satellite');
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
        findcloud: boolean;
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
        createEvent: false,   // av som default (kan slås på i funktions-popupen)
        multiplayer: false,   // kräver konto-registrering
        record: false,        // låst tills "köpt"
        flowers: false,       // av som default (kan slås på i funktions-popupen)
        findcloud: false      // av: när på visas "hämta moln"-knappen vid dagväljaren
    });

    // Begränsningen borttagen: man kan aktivera hur många funktioner som helst samtidigt.
    const MAX_ACTIVE_FEATURES = 999;
    const COUNTED_FEATURE_KEYS = [
        'satellite', 'tilt', 'globe', 'terrain',
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
            multiplayer: shopFlags.multiplayer,
            findcloud: shopFlags.findcloud
        });
    }, [shopFlags.sun, shopFlags.focus, shopFlags.createEvent, shopFlags.multiplayer, shopFlags.findcloud]);

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

    // Cloud popup geographic map anchor state and projection variables
    // Solves request: anchor cloud to a position on map, move with map
    const [cloudAnchor, setCloudAnchor] = useState<{ lat: number; lng: number }>({ lat: 56.8777, lng: 14.8091 });
    const [cloudAnchorPos, setCloudAnchorPos] = useState<{ x: number; y: number } | null>(null);
    const [showCloud, setShowCloud] = useState(true);

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
    // Knuffa användaren att testa funktioner när molnet kastas bort / går utanför
    // skärmen. INGA lås — bara blinkning + en "Ny funktion"-pil som visar att det
    // finns nytt att prova. 1:a gången molnet försvinner → Fokus surfas upp
    // (recenter-knappen vid "Idag" blinkar tills man klickar → centrerar). 2:a
    // gången → Hitta molnet (raden i menyn blinkar).
    const [cloudGoneCount, setCloudGoneCount] = useState(0);
    const [featureHint, setFeatureHint] = useState<'focus' | 'findcloud' | null>(null);
    // True när väskan öppnats medan ett tips var aktivt → då slutar "Ny funktion"-
    // pilen + lager-blinket (för gott för det tipset). Själva funktionsraden blinkar
    // dock kvar tills man klickat på den. Nollställs när ett NYTT tips dyker upp.
    const [hintAcknowledged, setHintAcknowledged] = useState(false);
    // 4s startfönster: ignorera "moln-borta"-händelser i början — kartan/molnet
    // laddar och rör sig under intron, annars tänds tipset direkt.
    const [onboardingReady, setOnboardingReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setOnboardingReady(true), 4000);
        return () => clearTimeout(t);
    }, []);
    // (Moln-interaktions-detektorn som tickar cloudGoneCount ligger längre ner —
    //  efter mainLiveOffset, eftersom den läser drag-offseten.)
    // 1:a gången molnet flyttas/försvinner → tipsa om Fokus, 2:a → Hitta molnet.
    // Aktiverar INGET automatiskt (Fokus är inte default-på) — bara ett tips;
    // användaren slår på funktionen själv från väskan.
    useEffect(() => {
        if (cloudGoneCount === 1) setFeatureHint('focus');
        else if (cloudGoneCount === 2) setFeatureHint('findcloud');
    }, [cloudGoneCount]);
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

    // Onboarding-detektor: tickar cloudGoneCount när man RÖR molnet (drar det >8px),
    // kastar bort det eller det går utanför skärmen — en gång per gest. Hoppar över
    // de första 4 sekunderna (onboardingReady) så intro-rörelsen inte räknas.
    const cloudInteractedRef = useRef(false);
    useEffect(() => {
        const moved = Math.abs(mainLiveOffset.x) > 8 || Math.abs(mainLiveOffset.y) > 8;
        // "Borta" = molnet ligger FAKTISKT utanför skärmen (eller är dolt). I lutad
        // vy projiceras molnet nära horisonten och stannar synligt även när man
        // pannar långt → då är det INTE borta och Hitta molnet ska inte tipsas.
        const gone = mainOffScreen || !showCloud;
        const interacted = moved || gone;
        if (interacted && !cloudInteractedRef.current) {
            cloudInteractedRef.current = true;
            if (onboardingReady) setCloudGoneCount(c => {
                // Steg 1 (Fokus) räcker att man rört molnet. Steg 2 (Hitta molnet)
                // ska BARA tändas när molnet verkligen är borta — annars tipsar vi
                // om att leta efter ett moln som syns (särskilt i lutad vy).
                if (c >= 1 && !gone) return c;
                return Math.min(c + 1, 2);
            });
        } else if (!interacted && cloudInteractedRef.current) {
            cloudInteractedRef.current = false;
        }
    }, [mainLiveOffset, mainOffScreen, showCloud, onboardingReady]);

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

    // Filtrera grupper så vi bara renderar markörer som faktiskt är inom skärmen (+ 20% marginal), men visa ALLTID det valda eventet direkt
    const visibleGroups = useMemo(() => {
        if (!mapBounds) return [];

        const lngSpan = mapBounds.getEast() - mapBounds.getWest();
        const latSpan = mapBounds.getNorth() - mapBounds.getSouth();
        const paddedBounds = new maplibregl.LngLatBounds(
            [mapBounds.getWest() - lngSpan * 0.2, mapBounds.getSouth() - latSpan * 0.2],
            [mapBounds.getEast() + lngSpan * 0.2, mapBounds.getNorth() + latSpan * 0.2]
        );

        return Array.from(groups.entries()).filter(([_, group]) => {
            // Visa alltid det valda eventet omedelbart, även om det råkar ligga utanför skärmens gränser just nu
            const containsSelected = group.some(e => e.id === selectedEvent?.id);
            if (containsSelected) return true;
            // Visa alltid markören man gissade på (spelet) så brickan syns efter avslöjet.
            if (guessedEventId && group.some(e => e.id === guessedEventId)) return true;

            const rep = group[0];
            if (!rep.lng || !rep.lat) return false;
            return paddedBounds.contains([rep.lng, rep.lat]);
        });
    }, [groups, mapBounds, selectedEvent, guessedEventId]);

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
                const emoji = EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫';
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
            center: [14.8091, 56.8777], // Lng, Lat (Växjö)
            zoom: 8,
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

        // WebGL-säkerhetsnät: om GPU:n tappar renderingskontexten (t.ex. vid
        // minnespress) ska sidan inte dö. preventDefault gör förlusten
        // återställbar, och vid återställning ritar vi om kartan.
        const glCanvas = map.getCanvas();
        const onCtxLost = (e: Event) => { e.preventDefault(); };
        const onCtxRestored = () => { try { map.triggerRepaint(); } catch { /* noop */ } };
        glCanvas.addEventListener('webglcontextlost', onCtxLost as EventListener, false);
        glCanvas.addEventListener('webglcontextrestored', onCtxRestored as EventListener, false);

        // Lägg till zoom/pan klasshantering för att växla mellan brickor och nålar
        const container = mapContainerRef.current;
        const showNeedles = () => {
            container.classList.remove('map-state-full');
            container.classList.add('map-state-needle');
        };
        const showBricks = () => {
            container.classList.remove('map-state-needle');
            container.classList.add('map-state-full');
        };

        map.on('zoomstart', showNeedles);
        map.on('zoomend', showBricks);

        map.on('click', () => {
            // I gissningsläge ska ett klick på tom karta inte stänga mål-kortet
            // (det skulle avbryta rundan av misstag).
            if (gameModeRef.current) return;
            onSelectEventRef.current(null);
        });

        map.on('drag', () => {
            if (onMapDragRef.current) {
                onMapDragRef.current();
            }
        });

        // Real-time projection updater for the anchored cloud popups (main +
        // any sun-clouds that are currently alive).
        const updateCloudPosition = () => {
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
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
        });

        return () => {
            if (moveEndTimer) clearTimeout(moveEndTimer);
            glCanvas.removeEventListener('webglcontextlost', onCtxLost as EventListener);
            glCanvas.removeEventListener('webglcontextrestored', onCtxRestored as EventListener);
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
        const map = mapRef.current;
        if (!map) return;
        map.setStyle(mapStyle === 'satellite' ? SATELLITE_STYLE : STREETS_STYLE_URL);
        // setStyle ersätter HELA stilen → projektionen nollställs och custom-källor
        // (DEM) försvinner. Återställ globe + terräng när nya stilen laddat klart.
        map.once('style.load', () => {
            applyProjection(map, isGlobeRef.current);
            applyTerrain(map, is3DTerrainRef.current);
        });
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
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
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
        canvas.addEventListener('pointerdown', pause);
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
            canvas.removeEventListener('pointerdown', pause);
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
        if (gameMode) return;
        // Dagbyte just nu → rör inte kameran (vyn ska stå still).
        if (performance.now() < suppressAutoRecenterUntilRef.current) return;
        recenterOnSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded, gameMode]);

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
        onCloudVisibilityChangeRef.current?.({ main: mainOffScreen, sun: sunOffScreen });
    }, [mainOffScreen, sunOffScreen]);

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
        const targetX = w * 0.78;
        const targetY = h * 0.55;
        const ll = map.unproject([targetX, targetY]);
        if (kind === 'main') {
            cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
            setCloudAnchor({ lat: ll.lat, lng: ll.lng });
            setCloudAnchorPos({ x: targetX, y: targetY });
            setShowCloud(true);
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

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // För multi-event-grupper använder vi ett stabilt 'multi'-värde så
            // att stateKey inte ändras varje slideshow-tick (annars rivs brickan
            // ner och byggs upp igen + pop-in-animationen återstartas). Själva
            // emoji-bytet sker kirurgiskt längre ner.
            const stateKeyCategory = count > 1 ? 'multi' : (rep.category ?? 'other');
            const stateKey = `${isSelected}:${isRevealed}:${isSaved}:${isDiscarded}:${count}:${stateKeyCategory}:${startsWithinHour}:${isGold}:${isWatered}:${isWatering}`;

            let markerData = markersRef.current.get(key);

            if (!markerData) {
                const el = document.createElement('div');
                el.className = 'v2-custom-marker';

                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'bottom'
                })
                .setLngLat([rep.lng!, rep.lat!])
                .addTo(map);

                markerData = { marker, element: el, lastStateKey: '' };
                markersRef.current.set(key, markerData);
            }

            // Uppdatera ENDAST om tillståndet faktiskt har förändrats
            if (markerData.lastStateKey !== stateKey) {
                markerData.lastStateKey = stateKey;

                // Uppdatera z-index på elementet. Multi-event-grupper (count > 1)
                // ligger ovanpå enskilda nålhuvuden så att siffer-badgen aldrig
                // skyms av en tom nål.
                const zIndex = isGold ? 1500
                    : isSelected ? 1000
                    : isSaved ? 500
                    : count > 1 ? 200
                    : isDiscarded ? -100 : 0;
                markerData.element.style.zIndex = String(zIndex);

                // Sätt eventlyssnare på klick. I gissningsläge är klicket en
                // gissning på hela gruppen i stället för ett vanligt val.
                markerData.element.onclick = (e) => {
                    e.stopPropagation();
                    if (gameModeRef.current) { onGuessRef.current?.(group); return; }
                    onSelectEventRef.current(rep);
                };

                // Uppdatera markörens HTML-innehåll direkt i DOM:en.
                // Prioritet: vald (blå) > sparad (ljusblå) > börjar inom 1 timme (orange) > standard (svart).
                const needleDotColor = isSelected
                    ? '#006AA7'
                    : isSaved
                    ? '#5BA3CC'
                    : startsWithinHour
                    ? '#f97316'
                    : '#1e293b';
                const needleLineColor = isSelected ? '#006AA7' : isSaved ? '#5BA3CC' : '#475569';
                const needleDotSize = isSelected ? 10 : isSaved ? 8 : 7;
                const needleLineH = isSelected ? 28 : 22;

                const pinBg = isGold
                    ? 'linear-gradient(135deg, #fff7d6 0%, #fbbf24 45%, #d97706 100%)'
                    : isSaved ? '#ffffff' : '#1e293b';
                const pinBorder = isGold
                    ? '3px solid #fde68a'
                    : isSelected
                    ? '3px solid #006AA7'
                    : isSaved
                    ? '2px solid #5BA3CC'
                    : startsWithinHour
                    ? '2px solid #f97316'
                    : '2px solid rgba(255,255,255,0.25)';

                // Använd högpresterande CSS box-shadow
                const pinShadow = isGold
                    ? '0 0 0 4px rgba(251,191,36,0.35), 0 6px 22px rgba(217,119,6,0.55)'
                    : isSelected
                    ? '0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)'
                    : isSaved
                    ? '0 4px 10px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)';

                const scaleStyle = (isSelected || isGold) ? 'scale(1.25) translateY(-10px)' : 'scale(1)';
                const opacityStyle = isDiscarded ? 'opacity: 0.25; filter: grayscale(1);' : '';

                const catKey = rep.category && EVENT_CATEGORIES[rep.category] ? rep.category : 'other';
                const emoji = EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫';

                const countBadge = count > 1
                    ? `<div class="badge-count">${count > 99 ? '99+' : count}</div>`
                    : (isSaved ? '<div class="badge-saved"></div>' : '');

                const needleBadgeHtml = count > 1
                    ? `<div class="badge-needle-count">${count > 99 ? '99+' : count}</div>`
                    : '';

                // Fördela uppdykandet så att alla markörer poppar in under totalt 4 sekunder (4000ms), men visa det valda direkt (0ms delay)
                const N = visibleGroups.length;
                const animDelay = isSelected ? 0 : (N > 1 ? (index / (N - 1)) * 4000 : 0);
                // Valt OCH redan avslöjat event visar brickan direkt utan kö-delay.
                const showImmediately = isSelected || isRevealed;
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

                markerData.element.innerHTML = `
                    <div class="custom-marker-wrapper" style="${opacityStyle}; ${wrapperStyle}">
                        <!-- NEEDLE ELEMENT -->
                        <div class="needle-element">
                            <div style="position:relative;">
                                <div class="needle-dot" style="width:${needleDotSize}px;height:${needleDotSize}px;background:${needleDotColor};"></div>
                                ${needleBadgeHtml}
                            </div>
                            <div class="needle-line" style="height:${needleLineH}px;background:${needleLineColor};"></div>
                        </div>

                        <!-- PIN ELEMENT -->
                        <div class="pin-element" style="${pinAnimationStyle}">
                            <div class="pin-bubble${isGold ? ' pin-bubble-gold' : ''}${isWatering ? (isSparkleActive ? ' pin-bubble-watering-sparkle' : isSnowballActive ? ' pin-bubble-watering-snowball' : ' pin-bubble-watering') : ''}" style="background:${pinBg}; border:${pinBorder}; box-shadow: ${pinShadow};">
                                <div class="pin-emoji">${emoji}</div>
                            </div>
                            ${countBadge}
                            ${wateringFeedbackHtml}
                        </div>

                        <!-- FLOWERS -->
                        ${flowersHtml}
                    </div>
                `;
            }

            // Vald grupp med flera event: byt emoji till det event man tittar på,
            // och räkna ner siffran (kvar att bläddra till) medan man trycker
            // Nästa — kirurgiskt, utan att riva ner brickan.
            if (inGroupSelected && count > 1) {
                const selCatKey = inGroupSelected.category && EVENT_CATEGORIES[inGroupSelected.category]
                    ? inGroupSelected.category : 'other';
                const selEmoji = EVENT_CATEGORIES[selCatKey as EventCategoryType]?.emoji ?? '🎫';
                const emojiEl = markerData.element.querySelector('.pin-emoji');
                if (emojiEl && emojiEl.textContent !== selEmoji) emojiEl.textContent = selEmoji;

                // Siffran = count − position i bläddrings-ordningen. Nästa → index
                // ökar → siffran minskar; Bakåt → index minskar → siffran ökar.
                const idx = visitedOrderRef.current.indexOf(inGroupSelected.id);
                const remaining = Math.min(count, Math.max(1, count - (idx >= 0 ? idx : 0)));
                const remStr = remaining > 99 ? '99+' : String(remaining);
                markerData.element.querySelectorAll('.badge-needle-count, .badge-count').forEach((el) => {
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
    }, [visibleGroups, selectedEvent, savedEventIds, discardedEventIds, gameMode, goldEventId, guessedEventId, wateredKeys, wateringKey, shopFlags, tilted]);

    return (
        <div className="absolute inset-0 z-0 bg-slate-100" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
            {/* CSS och Keyframes för en mjuk, progressiv animation */}
            <style>{`
                .v2-custom-marker {
                    background: none !important;
                    border: none !important;
                    cursor: pointer;
                    width: 44px;
                    height: 60px;
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
                    height: 60px;
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
                    height: 60px;
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
                }
                .pin-emoji {
                    transform: rotate(-45deg);
                    font-size: 22px;
                    line-height: 1;
                    position: relative;
                    z-index: 1;
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
                    border-radius: 999px;
                    border: 1.5px solid #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    box-sizing: border-box;
                }

                /* ──────────────────────────────────────────────────────────
                   TILLSTÅNDS-KLASSER (Styrs av containerklassen)
                ────────────────────────────────────────────────────────── */

                /* 1. Nål-läge (Vid zoom/pan) */
                .map-state-needle .v2-custom-marker .needle-element {
                    display: flex;
                }
                .map-state-needle .v2-custom-marker .pin-element {
                    display: none;
                }

                /* 2. Brick-läge (Standard när kartan är stilla) — nålen visas
                   alltid, brickan poppar upp ovanpå när kartan står still. */
                .map-state-full .v2-custom-marker .needle-element {
                    display: flex;
                }
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
                type CrateItem = { key: string; label: string; desc: string; color: string; icon: React.ReactNode; kind?: 'game'; locked?: boolean };
                const crateItems: CrateItem[] = [
                    // Popup-meny: symbol + namn + kort info. Varje funktion har en egen
                    // passande accent-färg på symbolen; aktiv rad tonas i samma färg.
                    { key: 'satellite', label: 'Satellit', desc: 'Byt mellan satellit- och vanlig karta', color: '#0d9488', icon: <Satellite size={20} /> },
                    { key: 'focus', label: 'Fokus', desc: 'Centrera kartan på molnet', color: '#2563eb', icon: <Target size={20} /> },
                    { key: 'findcloud', label: 'Hitta molnet', desc: 'Visar knappen för att hämta molnet vid dagväljaren', color: '#60a5fa', icon: <Cloud size={20} /> },
                    { key: 'throw', label: 'Kasta', desc: 'Dubbelklick: kameran följer molnet när du kastar', color: '#0ea5e9', icon: <Send size={20} /> },
                    { key: 'tilt', label: 'Lutning', desc: 'Luta kartan till en 3D-vy', color: '#6366f1', icon: <Box size={20} /> },
                    { key: 'terrain', label: '3D-terräng', desc: 'Visa höjder & terräng i 3D', color: '#16a34a', icon: <Mountain size={20} /> },
                    { key: 'globe', label: 'Klot', desc: 'Visa kartan som en jordglob', color: '#0891b2', icon: <Globe size={20} /> },
                    { key: 'createEvent', label: 'Skapa event', desc: 'Skapa egna event på kartan', color: '#22c55e', icon: <Plus size={20} strokeWidth={2.5} /> },
                    { key: 'faces', label: 'Ansikten', desc: 'Molnen får ansikten & uttryck', color: '#ec4899', icon: <Smile size={20} /> },
                    { key: 'findgame', label: 'Hitta event', desc: 'Spel: hitta eventet på kartan', color: '#8b5cf6', icon: <Gamepad2 size={20} />, kind: 'game' },
                    { key: 'flowers', label: 'Blommor', desc: 'Vattna nålar så blommor växer', color: '#db2777', icon: <Flower2 size={20} /> },
                    { key: 'sun', label: 'Sol', desc: 'Sol-effekt som lyser upp kartan', color: '#f59e0b', icon: <Sun size={20} /> },
                    { key: 'slingshot', label: 'Slangbella', desc: 'Skjut iväg molnet med slangbella', color: '#ef4444', icon: <Crosshair size={20} /> },
                    // Länder — låst, överst bland de låsta funktionerna (placeholder, inte aktiverbar än).
                    { key: 'countries', label: 'Länder', desc: 'Visa länder på kartan', color: '#0284c7', icon: <MapIcon size={20} />, locked: true },
                    { key: 'bigCloud', label: 'Större moln', desc: 'Gör molnen större', color: '#64748b', icon: <Maximize2 size={20} />, locked: true },
                    { key: 'sparkle', label: 'Glitter', desc: 'Glitter runt molnen', color: '#a855f7', icon: <Sparkles size={20} />, locked: true },
                    { key: 'snowball', label: 'Snöboll', desc: 'Kasta snöbollar i stället', color: '#38bdf8', icon: <Snowflake size={20} />, locked: true },
                    { key: 'fastThrow', label: 'Snabbare kast', desc: 'Mer fart när du kastar molnen', color: '#f59e0b', icon: <Zap size={20} />, locked: true },
                    // Golf — låst, placerad ovanför Multiplayer.
                    { key: 'golf', label: 'Golf', desc: 'Kommer snart', color: '#65a30d', icon: <Flag size={20} />, locked: true },
                    { key: 'multiplayer', label: 'Multiplayer', desc: 'Spela med andra (kräver konto)', color: '#6366f1', icon: <Users size={20} />, locked: true },
                    { key: 'record', label: 'Spela in', desc: 'Spela in din skärm', color: '#ef4444', icon: <Video size={20} />, locked: true }
                ];
                const isCrateActive = (it: CrateItem) => it.kind === 'game' ? findGameActive : isFeatureActive(it.key);
                const activeBagCount = crateItems.reduce((n, it) => n + (isCrateActive(it) ? 1 : 0), 0);

                const handleCrate = (it: CrateItem) => {
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
                                className="fixed top-[118px] right-3 z-[1150] w-[270px] max-h-[68vh] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/60 p-1.5 pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
                            >
                                <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Funktioner
                                </div>
                                {crateItems.map((it) => {
                                    const active = isCrateActive(it);
                                    // Låst funktion (Golf) → går inte att aktivera (visas med hänglås).
                                    // "Hitta event" är bara avstängd när ingen runda är möjlig.
                                    const locked = !!it.locked;
                                    const disabled = locked || (it.kind === 'game' && !findGameActive && !canStartFindGame);
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

                        {/* Lager-knappen — ALLTID synlig (top-[72px] right-4). Klick
                            öppnar/stänger funktions-popupen ovan. Onboarding: blinkar +
                            visar en "Ny funktion"-pil till vänster när det finns en ny
                            funktion att upptäcka (featureHint), tills menyn öppnas. */}
                        <div className="fixed top-[72px] right-4 z-[1151] pointer-events-auto">
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

                        {/* Snabb-toggle för lutning — sitter direkt UNDER lager-knappen
                            (top-[72px] + 40px knapp + 8px lucka = top-[120px]). Visas så
                            länge Lutning är AKTIVERAD i väskan (tiltEnabled). Klick togglar
                            bara kameran på/av (blå = på, vit = av) — knappen ligger kvar.
                            Knappen försvinner först när man stänger av Lutning i väskan.
                            Göms medan väskan är öppen (krockar annars med panelen). */}
                        {tiltEnabled && !funcBagOpen && (
                            <div className="fixed top-[120px] right-4 z-[1151] pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={() => onToggleTilt?.()}
                                    aria-label="Lutning"
                                    aria-pressed={tilted}
                                    title={tilted ? 'Lutning på – klicka för platt vy' : 'Lutning av – klicka för 3D-vy'}
                                    className={`h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors ${
                                        tilted ? 'bg-[#006AA7] text-white border-white/30' : 'bg-white/90 text-slate-700 border-white/50 hover:bg-white'
                                    }`}
                                >
                                    <Box size={20} />
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
            {showCloud && cloudAnchorPos && (
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
            {sunCloudAnchor && sunCloudAnchorPos && (
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
                                        { key: 'tilt', label: 'Lutning', icon: <Box size={18} /> },
                                        { key: 'globe', label: 'Klot', icon: <Globe size={18} /> },
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
