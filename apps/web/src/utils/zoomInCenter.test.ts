import { describe, it, expect } from 'vitest';
import { zoomInCenter } from './zoomInCenter';

// Växjö-ish. 0,01° lat ≈ 1,1 km, 0,01° lng ≈ 0,6 km på den breddgraden.
const CITY = { lat: 56.879, lng: 14.806 };

describe('zoomInCenter (zoom-bannerns målpunkt)', () => {
    it('inga markörer i orten → ortens mittpunkt', () => {
        expect(zoomInCenter([], CITY)).toEqual(CITY);
        // 30 km bort räknas inte som orten.
        expect(zoomInCenter([{ lat: 57.15, lng: 14.806 }], CITY)).toEqual(CITY);
    });

    it('en klunga vid sidan av mitten → klungans genomsnitt', () => {
        const c = zoomInCenter([
            { lat: 56.885, lng: 14.816 },
            { lat: 56.887, lng: 14.818 },
            { lat: 56.886, lng: 14.814 },
        ], CITY);
        expect(c.lat).toBeCloseTo(56.886, 5);
        expect(c.lng).toBeCloseTo(14.816, 5);
    });

    it('en ensam markör i utkanten drar inte iväg mitten', () => {
        const c = zoomInCenter([
            { lat: 56.880, lng: 14.806 },
            { lat: 56.881, lng: 14.807 },
            { lat: 56.879, lng: 14.808 },
            { lat: 56.930, lng: 14.806 }, // ~5,7 km norrut
        ], CITY);
        expect(c.lat).toBeCloseTo(56.880, 5);
        expect(c.lng).toBeCloseTo(14.807, 5);
    });

    it('den större klungan vinner', () => {
        const c = zoomInCenter([
            { lat: 56.900, lng: 14.806 },
            { lat: 56.901, lng: 14.806 },
            { lat: 56.860, lng: 14.806 },
            { lat: 56.861, lng: 14.806 },
            { lat: 56.862, lng: 14.806 },
        ], CITY);
        expect(c.lat).toBeCloseTo(56.861, 5);
    });

    it('lika stora klungor → den närmast ortens mitt', () => {
        const c = zoomInCenter([
            { lat: 56.920, lng: 14.806 },
            { lat: 56.921, lng: 14.806 },
            { lat: 56.870, lng: 14.806 },
            { lat: 56.871, lng: 14.806 },
        ], CITY);
        expect(c.lat).toBeCloseTo(56.8705, 5);
    });

    it('ogiltiga koordinater hoppas över', () => {
        expect(zoomInCenter([{ lat: NaN, lng: 14.8 }], CITY)).toEqual(CITY);
    });
});
