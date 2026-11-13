import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import type * as maplibregl from 'maplibre-gl';
// maplibre-gl:s egen stilspec (beroende till maplibre-gl) - samma validering som kartan kör.
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import {
    addZoomedOutLandcover, COARSE_KINDS, COARSE_LAYER_ID, DETAIL_KINDS, DETAIL_LAYER_ID,
    DEEP_COARSE_LAYER_ID, DEEP_MAX_ZOOM, DEEP_SOURCE_ID, DEEP_WATER_LAYER_ID,
    FOREST_DEEP_LAYER_ID, FOREST_FAR_OPACITY, FOREST_KINDS, FOREST_LAYER_ID,
    LANDCOVER_COARSE_MAX_ZOOM, LANDCOVER_COLORS, LANDCOVER_FALT_FJARRAN, LANDCOVER_MAX_ZOOM,
} from './mapLandcover';
import { childTileUrls, DEEP_KINDS, DEEP_LAYERS, DEEP_PROTOCOL } from './deepTiles';

// Grönskans färg så som nöjesfältsstilen sätter den på Voyagers lager.
const GRONSKA = ['interpolate', ['linear'], ['zoom'], 6, '#47822c', 10, '#7eb152'] as unknown as maplibregl.ExpressionSpecification;

// Voyager i miniatyr, med lagren i samma ordning som den riktiga stilen (13/11).
function voyagerLike(sourceName = 'protomaps'): maplibregl.StyleSpecification {
    return {
        version: 8,
        sources: { [sourceName]: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'landcover', type: 'fill', source: sourceName, 'source-layer': 'landuse', minzoom: 7, paint: { 'fill-color': GRONSKA } },
            { id: 'park_nature_reserve', type: 'fill', source: sourceName, 'source-layer': 'landuse' },
            { id: 'landuse_residential', type: 'fill', source: sourceName, 'source-layer': 'landuse', minzoom: 6 },
            { id: 'waterway', type: 'line', source: sourceName, 'source-layer': 'water' },
            { id: 'water', type: 'fill', source: sourceName, 'source-layer': 'water', paint: { 'fill-color': '#4e8ab7' } },
            { id: 'road_primary', type: 'line', source: sourceName, 'source-layer': 'roads' },
            { id: 'place_city', type: 'symbol', source: sourceName, 'source-layer': 'places' },
        ],
    };
}

function lager(style: maplibregl.StyleSpecification, id: string) {
    const l = style.layers.find(x => x.id === id) as maplibregl.FillLayerSpecification | undefined;
    if (!l) throw new Error(`saknar ${id}`);
    return l;
}

// Opaciteten ur ett ['interpolate', ['linear'], ['zoom'], z0, v0, z1, v1, ...]-uttryck.
function opacitetVid(l: maplibregl.FillLayerSpecification, zoom: number): number {
    const uttryck = l.paint?.['fill-opacity'] as unknown[];
    const stopp: [number, number][] = [];
    for (let i = 3; i < uttryck.length; i += 2) stopp.push([uttryck[i] as number, uttryck[i + 1] as number]);
    if (zoom <= stopp[0][0]) return stopp[0][1];
    for (let i = 1; i < stopp.length; i++) {
        const [z0, v0] = stopp[i - 1], [z1, v1] = stopp[i];
        if (zoom <= z1) return v0 + (v1 - v0) * (zoom - z0) / (z1 - z0);
    }
    return stopp[stopp.length - 1][1];
}

// Synligt vid zoom = inom min/maxzoom och opacitet över noll.
function synligVid(l: maplibregl.FillLayerSpecification, zoom: number) {
    if (l.minzoom !== undefined && zoom < l.minzoom) return false;
    if (l.maxzoom !== undefined && zoom >= l.maxzoom) return false;
    return opacitetVid(l, zoom) > 0;
}

describe('addZoomedOutLandcover', () => {
    it('lägger marktäcket över Voyagers grönska men under vattnet', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        expect(style.layers.map(l => l.id)).toEqual([
            'background', 'landcover', 'park_nature_reserve', 'landuse_residential',
            FOREST_DEEP_LAYER_ID, FOREST_LAYER_ID,
            DEEP_COARSE_LAYER_ID, COARSE_LAYER_ID, DETAIL_LAYER_ID,
            'waterway', 'water', DEEP_WATER_LAYER_ID, 'road_primary', 'place_city',
        ]);
    });

    it('ritar ur baskartans egna kakel, vad källan än heter, och hämtar inga höjdkakel', () => {
        for (const namn of ['protomaps', 'carto']) {
            const style = voyagerLike(namn);
            addZoomedOutLandcover(style);
            expect(lager(style, COARSE_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landcover' });
            expect(lager(style, DETAIL_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landuse' });
            expect(Object.keys(style.sources)).toEqual([namn, DEEP_SOURCE_ID]);
            expect(Object.values(style.sources).some(s => s.type === 'raster-dem')).toBe(false);
        }
    });

    it('Sverige-vyn visar det grova marktäcket, detaljen tar över från zoom 7', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        const grovt = lager(style, COARSE_LAYER_ID);
        const detalj = lager(style, DETAIL_LAYER_ID);
        // Under DEEP_MAX_ZOOM ritas det grova ur de djupare kaklen (#211).
        const djupt = lager(style, DEEP_COARSE_LAYER_ID);
        expect(djupt.maxzoom).toBe(DEEP_MAX_ZOOM);
        expect(grovt.minzoom).toBe(DEEP_MAX_ZOOM);
        expect(djupt.paint?.['fill-color']).toEqual(grovt.paint?.['fill-color']);
        expect(opacitetVid(grovt, 6)).toBe(1);
        expect(synligVid(detalj, 5)).toBe(false);
        expect(synligVid(detalj, 6.9)).toBe(false);
        // Korstoningen: båda finns i z7-kaklen.
        expect(synligVid(grovt, 7.3)).toBe(true);
        expect(synligVid(detalj, 7.3)).toBe(true);
        expect(opacitetVid(detalj, 8)).toBe(1);
        // z8-kaklen har inget 'landcover'-lager.
        expect(grovt.maxzoom).toBe(LANDCOVER_COARSE_MAX_ZOOM);
        expect(synligVid(grovt, 8)).toBe(false);
    });

    it('är borta före stadsvyn, så stadslandningen och stadssidornas kartor ser ut som förut', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        expect(LANDCOVER_MAX_ZOOM).toBeLessThan(10.5);
        for (const id of [COARSE_LAYER_ID, DETAIL_LAYER_ID, DEEP_COARSE_LAYER_ID, DEEP_WATER_LAYER_ID, FOREST_LAYER_ID, FOREST_DEEP_LAYER_ID]) {
            const l = lager(style, id);
            if (id === COARSE_LAYER_ID || id === DETAIL_LAYER_ID) expect(synligVid(l, LANDCOVER_MAX_ZOOM)).toBe(false);
            expect(l.maxzoom).toBeLessThanOrEqual(LANDCOVER_MAX_ZOOM);
            expect(synligVid(l, 10.5)).toBe(false);
            expect(synligVid(l, 11)).toBe(false);
        }
    });

    // Josef 13/11: "det ska inte vara mörkare karta än innan" och "nyanserna
    // eller den färg shemat vi hade innan på kartan".
    describe('färgerna är nöjesfältets gamla och aldrig mörkare än landet', () => {
        // Paletten läses ur källtexten: grönskan och bostadsytorna är inte exporterade.
        const bas = readFileSync(path.resolve(__dirname, '../components/v2/v2MapBaseStyles.ts'), 'utf8');
        const konstant = (namn: string) => {
            const m = bas.match(new RegExp(`const ${namn} = '(#[0-9a-f]{6})'`));
            if (!m) throw new Error(`hittar inte ${namn} i v2MapBaseStyles`);
            return m[1];
        };
        const bostad = bas.match(/landuse_residential'\) \{\s*paint\['fill-color'\] = '(#[0-9a-f]{6})'/)?.[1];
        const ljushet = (hex: string) => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0);

        it('varje ton finns redan i nöjesfältets palett', () => {
            const palett = [konstant('THEMEPARK_GREENERY_NEAR'), konstant('THEMEPARK_LAND_COLOR_NEAR'), bostad];
            expect(bostad).toBeDefined();
            for (const ton of Object.values(LANDCOVER_COLORS)) expect(palett).toContain(ton);
        });

        it('varje ton är ljusare än landet utzoomat', () => {
            const land = konstant('THEMEPARK_LAND_COLOR');
            for (const ton of Object.values(LANDCOVER_COLORS)) {
                expect(ljushet(ton)).toBeGreaterThan(ljushet(land));
            }
        });

        it('marktäckeslagren ritar inte skogen - den har egna lager (#211)', () => {
            const style = voyagerLike();
            addZoomedOutLandcover(style);
            for (const id of [COARSE_LAYER_ID, DETAIL_LAYER_ID]) {
                const valda = (lager(style, id).filter as unknown[])[2] as ['literal', string[]];
                for (const skog of FOREST_KINDS) expect(valda[1]).not.toContain(skog);
            }
            for (const skog of FOREST_KINDS) {
                expect(COARSE_KINDS[skog]).toBeUndefined();
                expect(DETAIL_KINDS[skog]).toBeUndefined();
            }
        });

        it('skog, öppen mark och fält skiljs åt med olika nyanser', () => {
            expect(new Set(Object.values(LANDCOVER_COLORS)).size).toBe(Object.keys(LANDCOVER_COLORS).length);
            expect(COARSE_KINDS.farmland).toBe('falt');
            expect(COARSE_KINDS.grassland).toBe('oppenMark');
            expect(DETAIL_KINDS.meadow).toBe('falt');
        });
    });

    it('fälten ritas ovanpå den öppna marken', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        for (const id of [COARSE_LAYER_ID, DETAIL_LAYER_ID]) {
            const sortKey = lager(style, id).layout?.['fill-sort-key'] as unknown[];
            const nyckel = (kind: string) => sortKey[sortKey.indexOf(kind) + 1] as number;
            expect(nyckel('farmland')).toBeGreaterThan(nyckel('grassland'));
        }
    });

    it('ger en giltig stil enligt MapLibres stilspec (uttrycken, filtren, sorteringen)', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        expect(validateStyleMin(style)).toEqual([]);
    });

    it('lägger inte till något två gånger', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        addZoomedOutLandcover(style);
        expect(style.layers.filter(l => l.id === COARSE_LAYER_ID)).toHaveLength(1);
        expect(style.layers.filter(l => l.id === DETAIL_LAYER_ID)).toHaveLength(1);
    });

    it('rör ingenting när stilen saknar en vektorkälla med land och vatten', () => {
        const style: maplibregl.StyleSpecification = {
            version: 8,
            sources: {},
            layers: [{ id: 'background', type: 'background' }],
        };
        addZoomedOutLandcover(style);
        expect(style.layers.map(l => l.id)).toEqual(['background']);
    });
});

// #211, Josef 13/11 om Sverige-vyn: "gör inte skåne så ljust. ha en grönare nyans."
describe('åkrarna i Sverige-vyn är grönare än inzoomat', () => {
    const kanal = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const ljushet = (hex: string) => kanal(hex).reduce((s, v) => s + v, 0);
    // Grönt i förhållande till rött och blått: högre = grönare, mindre blekt.
    const gronhet = (hex: string) => { const [r, g, b] = kanal(hex); return g / ((r + b) / 2); };
    // Färgen ett match-uttryck ger en viss kind.
    const fargFor = (match: unknown, kind: string) => {
        const m = match as unknown[];
        return m[m.indexOf(kind) + 1];
    };

    it('tonen är mörkare och grönare än den ljusa, men ljusare än landet', () => {
        expect(ljushet(LANDCOVER_FALT_FJARRAN)).toBeLessThan(ljushet(LANDCOVER_COLORS.falt));
        expect(gronhet(LANDCOVER_FALT_FJARRAN)).toBeGreaterThan(gronhet(LANDCOVER_COLORS.falt));
        expect(ljushet(LANDCOVER_FALT_FJARRAN)).toBeGreaterThan(ljushet('#5b9b3b'));
        // Fälten ska fortfarande gå att skilja från den öppna marken.
        expect(LANDCOVER_FALT_FJARRAN).not.toBe(LANDCOVER_COLORS.oppenMark);
    });

    it('det grova lagret (Sverige-vyn) ritar åkern i den gröna tonen, övrigt som förut', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        const match = lager(style, COARSE_LAYER_ID).paint?.['fill-color'];
        expect(fargFor(match, 'farmland')).toBe(LANDCOVER_FALT_FJARRAN);
        expect(fargFor(match, 'grassland')).toBe(LANDCOVER_COLORS.oppenMark);
        expect(fargFor(match, 'urban_area')).toBe(LANDCOVER_COLORS.ljus);
    });

    it('detaljlagret tar vid i samma ton och ljusnar till den gamla före stadsvyn', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        const uttryck = lager(style, DETAIL_LAYER_ID).paint?.['fill-color'] as unknown[];
        expect(uttryck.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
        // Första stoppet = där korstoningen från det grova lagret är klar.
        expect(fargFor(uttryck[4], 'farmland')).toBe(LANDCOVER_FALT_FJARRAN);
        expect(fargFor(uttryck[4], 'meadow')).toBe(LANDCOVER_FALT_FJARRAN);
        expect(uttryck[5]).toBe(LANDCOVER_MAX_ZOOM);
        expect(fargFor(uttryck[6], 'farmland')).toBe(LANDCOVER_COLORS.falt);
        expect(fargFor(uttryck[4], 'grassland')).toBe(fargFor(uttryck[6], 'grassland'));
    });
});

// #211, Josef 13/11: "gärna mer av skogsområde och sjöar så långt utzoomat som
// det kan finnas med" och "ännu viktigare ... det som är skogsområde. alltså de
// konturerna om de fortfarande sågs längre utzoomat".
describe('djupare kakel och skogens konturer i Sverige-vyn', () => {
    const färdig = (namn = 'protomaps') => {
        const style = voyagerLike(namn);
        addZoomedOutLandcover(style);
        return style;
    };

    it('den djupa källan är baskartans egna kakel bakom protokollet, ett zoomsteg djupare', () => {
        const style = färdig();
        const src = style.sources[DEEP_SOURCE_ID] as maplibregl.VectorSourceSpecification;
        expect(src.type).toBe('vector');
        expect(src.tiles).toEqual([`${DEEP_PROTOCOL}://https://example.invalid/{z}/{x}/{y}.mvt`]);
        // Kakel z ger barnen på z+1, och källan används aldrig från DEEP_MAX_ZOOM.
        expect(src.maxzoom).toBe(DEEP_MAX_ZOOM - 1);
        const barn = childTileUrls(src.tiles![0].replace('{z}/{x}/{y}', '5/17/9'));
        expect(barn?.[0].url).toBe('https://example.invalid/6/34/18.mvt');
    });

    it('inga lager använder den djupa källan från zoom 6 - inga extra hämtningar inzoomat', () => {
        const djupa = färdig().layers.filter(l => 'source' in l && l.source === DEEP_SOURCE_ID);
        expect(djupa.map(l => l.id).sort()).toEqual([FOREST_DEEP_LAYER_ID, DEEP_COARSE_LAYER_ID, DEEP_WATER_LAYER_ID].sort());
        for (const l of djupa) expect(l.maxzoom).toBe(DEEP_MAX_ZOOM);
        // Allt lagren läser finns i det hopslagna kaklet.
        for (const l of djupa) expect(DEEP_LAYERS).toContain((l as maplibregl.FillLayerSpecification)['source-layer']);
    });

    it('de djupare sjöarna har baskartans vattenfärg och ligger direkt ovanpå dess vatten', () => {
        const style = färdig();
        expect(lager(style, DEEP_WATER_LAYER_ID).paint?.['fill-color']).toBe('#4e8ab7');
        const ids = style.layers.map(l => l.id);
        expect(ids.indexOf(DEEP_WATER_LAYER_ID)).toBe(ids.indexOf('water') + 1);
    });

    it('skogens konturer ritas under zoom 7 i Voyager-grönskans egen färg, utan glapp', () => {
        const style = färdig();
        const djup = lager(style, FOREST_DEEP_LAYER_ID);
        const nära = lager(style, FOREST_LAYER_ID);
        for (const l of [djup, nära]) {
            expect(l['source-layer']).toBe('landuse');
            expect(l.filter).toEqual(['in', ['get', 'kind'], ['literal', [...FOREST_KINDS]]]);
            expect(l.paint?.['fill-color']).toEqual(GRONSKA);
        }
        // Det hopslagna kaklet har just de skogsytor lagret ritar.
        expect([...DEEP_KINDS.landuse].sort()).toEqual([...FOREST_KINDS].sort());
        // Djupa kakel till 6, baskartans 6-7, sedan Voyagers eget lager (minzoom 7).
        expect([djup.minzoom, djup.maxzoom]).toEqual([undefined, DEEP_MAX_ZOOM]);
        expect([nära.minzoom, nära.maxzoom]).toEqual([DEEP_MAX_ZOOM, 7]);
        expect(nära.source).toBe('protomaps');
        // Full styrka där Voyagers lager tar vid, mjukare längst ut.
        expect(opacitetVid(nära, 7)).toBe(1);
        expect(opacitetVid(djup, 5)).toBe(FOREST_FAR_OPACITY);
        expect(opacitetVid(djup, 4)).toBe(FOREST_FAR_OPACITY);
    });

    it('skogen ligger under fält och öppen mark', () => {
        const ids = färdig().layers.map(l => l.id);
        expect(ids.indexOf(FOREST_DEEP_LAYER_ID)).toBeLessThan(ids.indexOf(DEEP_COARSE_LAYER_ID));
        expect(ids.indexOf(FOREST_LAYER_ID)).toBeLessThan(ids.indexOf(COARSE_LAYER_ID));
    });

    it('en källa utan egen kakelmall (TileJSON) får ingen djup källa, men skog och marktäcke ur baskartan', () => {
        const style = voyagerLike();
        style.sources.protomaps = { type: 'vector', url: 'https://example.invalid/tiles.json' };
        addZoomedOutLandcover(style);
        expect(style.sources[DEEP_SOURCE_ID]).toBeUndefined();
        const ids = style.layers.map(l => l.id);
        expect(ids).not.toContain(DEEP_WATER_LAYER_ID);
        expect(ids).not.toContain(DEEP_COARSE_LAYER_ID);
        expect(lager(style, COARSE_LAYER_ID).minzoom).toBeUndefined();
        expect(lager(style, FOREST_LAYER_ID)).toMatchObject({ source: 'protomaps', maxzoom: 7 });
        expect(validateStyleMin(style)).toEqual([]);
    });

    it('stilen med djup källa är giltig enligt MapLibres stilspec', () => {
        expect(validateStyleMin(färdig())).toEqual([]);
    });
});
