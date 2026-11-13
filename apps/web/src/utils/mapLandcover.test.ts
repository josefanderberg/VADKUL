import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import type * as maplibregl from 'maplibre-gl';
// maplibre-gl:s egen stilspec (beroende till maplibre-gl) - samma validering som kartan kör.
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import {
    addZoomedOutLandcover, COARSE_KINDS, COARSE_LAYER_ID, DETAIL_KINDS, DETAIL_LAYER_ID,
    FOREST_KINDS, LANDCOVER_COARSE_MAX_ZOOM, LANDCOVER_COLORS, LANDCOVER_MAX_ZOOM,
} from './mapLandcover';

// Voyager i miniatyr, med lagren i samma ordning som den riktiga stilen (13/11).
function voyagerLike(sourceName = 'protomaps'): maplibregl.StyleSpecification {
    return {
        version: 8,
        sources: { [sourceName]: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'landcover', type: 'fill', source: sourceName, 'source-layer': 'landuse', minzoom: 7 },
            { id: 'park_nature_reserve', type: 'fill', source: sourceName, 'source-layer': 'landuse' },
            { id: 'landuse_residential', type: 'fill', source: sourceName, 'source-layer': 'landuse', minzoom: 6 },
            { id: 'waterway', type: 'line', source: sourceName, 'source-layer': 'water' },
            { id: 'water', type: 'fill', source: sourceName, 'source-layer': 'water' },
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
            COARSE_LAYER_ID, DETAIL_LAYER_ID,
            'waterway', 'water', 'road_primary', 'place_city',
        ]);
    });

    it('ritar ur baskartans egna kakel, vad källan än heter, och hämtar inga höjdkakel', () => {
        for (const namn of ['protomaps', 'carto']) {
            const style = voyagerLike(namn);
            addZoomedOutLandcover(style);
            expect(lager(style, COARSE_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landcover' });
            expect(lager(style, DETAIL_LAYER_ID)).toMatchObject({ source: namn, 'source-layer': 'landuse' });
            expect(Object.keys(style.sources)).toEqual([namn]);
            expect(Object.values(style.sources).some(s => s.type === 'raster-dem')).toBe(false);
        }
    });

    it('Sverige-vyn visar det grova marktäcket, detaljen tar över från zoom 7', () => {
        const style = voyagerLike();
        addZoomedOutLandcover(style);
        const grovt = lager(style, COARSE_LAYER_ID);
        const detalj = lager(style, DETAIL_LAYER_ID);
        expect(opacitetVid(grovt, 5)).toBe(1);
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
        for (const id of [COARSE_LAYER_ID, DETAIL_LAYER_ID]) {
            const l = lager(style, id);
            expect(synligVid(l, LANDCOVER_MAX_ZOOM)).toBe(false);
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

        it('skogen ritas inte - den har landets gröna, som förut', () => {
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
