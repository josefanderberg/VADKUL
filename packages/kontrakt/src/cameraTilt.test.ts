import { describe, expect, it } from 'vitest';
import {
    addBuilding3dLayer, BUILDING_3D_FALLBACK_M, BUILDING_3D_LAYER_ID, BUILDING_3D_MIN_ZOOM,
    pitchForZoom, TILT_FULL_ZOOM, TILT_MAX_DEG, TILT_START_ZOOM, type TiltStyle,
} from './cameraTilt';

describe('pitchForZoom', () => {
    it('är plan upp till startzoomen, alltså genom hela stadslandningen', () => {
        expect(pitchForZoom(4)).toBe(0);
        expect(pitchForZoom(10.5)).toBe(0);
        expect(pitchForZoom(12)).toBe(0);
        expect(pitchForZoom(TILT_START_ZOOM)).toBe(0);
    });

    it('når max vid full zoom och stannar där', () => {
        expect(pitchForZoom(TILT_FULL_ZOOM)).toBe(TILT_MAX_DEG);
        expect(pitchForZoom(18)).toBe(TILT_MAX_DEG);
        expect(pitchForZoom(22)).toBe(TILT_MAX_DEG);
    });

    it('är en rak ramp däremellan', () => {
        const mitten = (TILT_START_ZOOM + TILT_FULL_ZOOM) / 2;
        expect(pitchForZoom(mitten)).toBeCloseTo(TILT_MAX_DEG / 2, 6);
        const span = TILT_FULL_ZOOM - TILT_START_ZOOM;
        expect(pitchForZoom(TILT_START_ZOOM + span / 5)).toBeCloseTo(TILT_MAX_DEG / 5, 6);
    });

    it('växer aldrig nedåt och håller sig inom MapLibres tak', () => {
        let prev = -1;
        for (let z = 0; z <= 22; z += 0.25) {
            const p = pitchForZoom(z);
            expect(p).toBeGreaterThanOrEqual(prev);
            expect(p).toBeLessThanOrEqual(60);
            prev = p;
        }
    });

    it('ger plan karta för ogiltig zoom', () => {
        expect(pitchForZoom(NaN)).toBe(0);
        expect(pitchForZoom(Infinity)).toBe(0);
    });
});

describe('addBuilding3dLayer', () => {
    const voyager = (): TiltStyle => ({
        layers: [
            { id: 'background', type: 'background' },
            { id: 'water', type: 'fill', source: 'protomaps', 'source-layer': 'water' },
            { id: 'building', type: 'fill', source: 'protomaps', 'source-layer': 'buildings', minzoom: 13 },
            { id: 'building-top', type: 'fill', source: 'protomaps', 'source-layer': 'buildings', minzoom: 13 },
            { id: 'road_major', type: 'line', source: 'protomaps', 'source-layer': 'roads' },
            { id: 'roadname_minor', type: 'symbol', source: 'protomaps', 'source-layer': 'roads' },
            { id: 'place_village', type: 'symbol', source: 'protomaps', 'source-layer': 'places' },
        ],
    });

    it('lägger husen på byggnadernas källa, över vägarna och under första symbol-lagret', () => {
        const style = voyager();
        expect(addBuilding3dLayer(style)).toBe(true);
        const ids = style.layers!.map(l => l.id);
        expect(ids.indexOf(BUILDING_3D_LAYER_ID)).toBe(ids.indexOf('road_major') + 1);
        expect(ids.indexOf(BUILDING_3D_LAYER_ID)).toBe(ids.indexOf('roadname_minor') - 1);
        const layer = style.layers!.find(l => l.id === BUILDING_3D_LAYER_ID)!;
        expect(layer.type).toBe('fill-extrusion');
        expect(layer.source).toBe('protomaps');
        expect(layer['source-layer']).toBe('buildings');
        expect(layer.minzoom).toBe(BUILDING_3D_MIN_ZOOM);
    });

    it('tar bara riktiga byggnader, inte husnumrens punkter', () => {
        const style = voyager();
        addBuilding3dLayer(style);
        const layer = style.layers!.find(l => l.id === BUILDING_3D_LAYER_ID)!;
        expect(JSON.stringify(layer.filter)).toContain('"building","building_part"');
        expect(JSON.stringify(layer.filter)).not.toContain('address');
    });

    it('tonar in höjden från 0 vid startzoomen till kaklens höjd, med schablon för hus utan höjd', () => {
        const style = voyager();
        addBuilding3dLayer(style);
        const paint = (style.layers!.find(l => l.id === BUILDING_3D_LAYER_ID)!.paint) as Record<string, unknown>;
        const height = paint['fill-extrusion-height'] as unknown[];
        expect(height.slice(0, 5)).toEqual(['interpolate', ['linear'], ['zoom'], BUILDING_3D_MIN_ZOOM, 0]);
        expect(height[5]).toBe(BUILDING_3D_MIN_ZOOM + 1);
        expect(height[6]).toEqual(['coalesce', ['get', 'height'], BUILDING_3D_FALLBACK_M]);
        // Sockeln bara när huset har en höjd, annars kan den hamna över taket.
        const base = paint['fill-extrusion-base'] as unknown[];
        expect(base[6]).toEqual(['case', ['has', 'height'], ['coalesce', ['get', 'min_height'], 0], 0]);
    });

    it('lägger inte lagret två gånger och rör inte en stil utan byggnader', () => {
        const style = voyager();
        expect(addBuilding3dLayer(style)).toBe(true);
        expect(addBuilding3dLayer(style)).toBe(false);
        expect(style.layers!.filter(l => l.id === BUILDING_3D_LAYER_ID)).toHaveLength(1);

        const utan: TiltStyle = { layers: [{ id: 'background', type: 'background' }] };
        expect(addBuilding3dLayer(utan)).toBe(false);
        expect(utan.layers).toHaveLength(1);
        expect(addBuilding3dLayer({})).toBe(false);
    });

    it('hamnar sist om stilen saknar symbol-lager', () => {
        const style: TiltStyle = { layers: [
            { id: 'building', type: 'fill', source: 'protomaps', 'source-layer': 'buildings' },
        ] };
        addBuilding3dLayer(style);
        expect(style.layers!.at(-1)!.id).toBe(BUILDING_3D_LAYER_ID);
    });
});
