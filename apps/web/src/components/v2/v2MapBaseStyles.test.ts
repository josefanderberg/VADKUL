import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import { fetchAndTransformThemeParkStyle, isThemeParkRoadLayer } from './v2MapBaseStyles';

// Vita vägar mot det gröna landet (#208). Voyager bytte i oktober 2026 från
// OpenMapTiles (source-layer transportation) till Protomaps (roads) med samma
// lager-id, och matchningen på det gamla namnet slutade tyst att verka.

describe('isThemeParkRoadLayer', () => {
    it('vägar i både gamla och nya schemat', () => {
        expect(isThemeParkRoadLayer('road_pri_fill_noramp', 'roads')).toBe(true);
        expect(isThemeParkRoadLayer('road_pri_fill_noramp', 'transportation')).toBe(true);
        expect(isThemeParkRoadLayer('bridge_mot_case', 'roads')).toBe(true);
        expect(isThemeParkRoadLayer('rail_dash', 'roads')).toBe(true);
    });

    it('inte flygfältens banor, som förut låg i ett eget lager', () => {
        expect(isThemeParkRoadLayer('aeroway-runway', 'roads')).toBe(false);
        expect(isThemeParkRoadLayer('aeroway-taxiway', 'roads')).toBe(false);
    });

    it('inte andra lager', () => {
        expect(isThemeParkRoadLayer('water', 'water')).toBe(false);
        expect(isThemeParkRoadLayer('background', undefined)).toBe(false);
    });
});

describe('fetchAndTransformThemeParkStyle', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // Voyager i miniatyr med den nya stilens lager-id och source-layers (13/11).
    function voyager(): maplibregl.StyleSpecification {
        const src = 'protomaps';
        return {
            version: 8,
            sources: { [src]: { type: 'vector', tiles: ['https://example.invalid/{z}/{x}/{y}.mvt'] } },
            layers: [
                { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
                { id: 'water', type: 'fill', source: src, 'source-layer': 'water', paint: { 'fill-color': '#d4dadc' } },
                { id: 'aeroway-runway', type: 'line', source: src, 'source-layer': 'roads', paint: { 'line-color': '#e0e0e0' } },
                { id: 'road_minor_case', type: 'line', source: src, 'source-layer': 'roads', paint: { 'line-color': '#e9e5dc' } },
                { id: 'road_mot_fill_noramp', type: 'line', source: src, 'source-layer': 'roads', paint: { 'line-color': '#fbd59f' } },
                { id: 'roadname_major', type: 'symbol', source: src, 'source-layer': 'roads', paint: { 'text-color': '#666' } },
            ],
        };
    }

    async function transformed() {
        vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => voyager() })));
        const style = await fetchAndTransformThemeParkStyle();
        const paint = (id: string) => (style.layers.find(l => l.id === id) as { paint?: Record<string, unknown> }).paint;
        return paint;
    }

    it('vägarna i roads blir vita, även kantlinjerna som förut', async () => {
        const paint = await transformed();
        expect(paint('road_mot_fill_noramp')?.['line-color']).toBe('#ffffff');
        expect(paint('road_minor_case')?.['line-color']).toBe('#ffffff');
    });

    it('flygfältsbanor och vägnamn behåller sina färger', async () => {
        const paint = await transformed();
        expect(paint('aeroway-runway')?.['line-color']).toBe('#e0e0e0');
        expect(paint('roadname_major')?.['text-color']).toBe('#666');
        expect(paint('roadname_major')?.['line-color']).toBeUndefined();
    });
});
