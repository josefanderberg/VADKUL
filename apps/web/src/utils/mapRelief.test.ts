import { describe, expect, it } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import { addZoomedOutRelief, RELIEF_DEM_ID, RELIEF_DEM_MAX_ZOOM, RELIEF_MAX_ZOOM } from './mapRelief';
import { CLOUD_GONE_ZOOM } from './eventClouds';

function voyagerLike(): maplibregl.StyleSpecification {
    return {
        version: 8,
        sources: { carto: { type: 'vector', url: 'https://example.invalid/tiles.json' } },
        layers: [
            { id: 'background', type: 'background' },
            { id: 'landcover', type: 'fill', source: 'carto', 'source-layer': 'landcover' },
            { id: 'park_national_park', type: 'fill', source: 'carto', 'source-layer': 'park' },
            { id: 'waterway', type: 'line', source: 'carto', 'source-layer': 'waterway' },
            { id: 'water', type: 'fill', source: 'carto', 'source-layer': 'water' },
            { id: 'road_primary', type: 'line', source: 'carto', 'source-layer': 'transportation' },
            { id: 'place_city', type: 'symbol', source: 'carto', 'source-layer': 'place' },
        ],
    };
}

describe('addZoomedOutRelief', () => {
    it('lägger höjdfärger och skuggning över grönskan men under vattnet', () => {
        const style = voyagerLike();
        addZoomedOutRelief(style);
        const ids = style.layers.map(l => l.id);
        expect(ids).toEqual([
            'background', 'landcover', 'park_national_park',
            'relief-colors', 'relief-shade',
            'waterway', 'water', 'road_primary', 'place_city',
        ]);
        expect(style.sources[RELIEF_DEM_ID]).toMatchObject({ type: 'raster-dem', encoding: 'terrarium' });
    });

    it('slutar vid molnens gräns, så stadsvyn inte hämtar några höjdkakel', () => {
        const style = voyagerLike();
        addZoomedOutRelief(style);
        const relief = style.layers.filter(l => 'source' in l && l.source === RELIEF_DEM_ID);
        expect(relief).toHaveLength(2);
        for (const l of relief) expect(l.maxzoom).toBe(RELIEF_MAX_ZOOM);
        expect(RELIEF_MAX_ZOOM).toBeLessThanOrEqual(CLOUD_GONE_ZOOM);
        // Stadslandningen ligger runt 10,5 och stadssidornas kartor på 11.
        expect(RELIEF_MAX_ZOOM).toBeLessThan(10.5);
    });

    it('hämtar grova höjdkakel, så en utzoomning inte drar mycket mobildata', () => {
        const style = voyagerLike();
        addZoomedOutRelief(style);
        const src = style.sources[RELIEF_DEM_ID] as maplibregl.RasterDEMSourceSpecification;
        expect(src.maxzoom).toBe(RELIEF_DEM_MAX_ZOOM);
        expect(RELIEF_DEM_MAX_ZOOM).toBeLessThanOrEqual(7);
    });

    it('lägger inte till något två gånger', () => {
        const style = voyagerLike();
        addZoomedOutRelief(style);
        addZoomedOutRelief(style);
        expect(style.layers.filter(l => l.id === 'relief-shade')).toHaveLength(1);
    });

    it('klarar en stil utan vatten: lägger reliefen direkt efter bakgrunden', () => {
        const style: maplibregl.StyleSpecification = {
            version: 8,
            sources: {},
            layers: [{ id: 'background', type: 'background' }, { id: 'labels', type: 'symbol', source: 'x' }],
        };
        addZoomedOutRelief(style);
        expect(style.layers.map(l => l.id)).toEqual(['background', 'relief-colors', 'relief-shade', 'labels']);
    });
});
