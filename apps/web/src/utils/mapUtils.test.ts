import { describe, it, expect } from 'vitest';
import { isValidLatLng } from './mapUtils';

// Kraschvakten: EN ogiltig koordinat in i LngLatBounds.contains fäller hela
// kartan, och null island-event skulle annars flooda Guineabukten.
describe('isValidLatLng', () => {
    it('svenska koordinater är giltiga', () => {
        expect(isValidLatLng(59.3293, 18.0686)).toBe(true); // Stockholm
        expect(isValidLatLng(55.605, 13.0038)).toBe(true);  // Malmö
        expect(isValidLatLng(67.8558, 20.2253)).toBe(true); // Kiruna
    });

    it('projicerade koordinater (SWEREF99/RT90) avvisas', () => {
        expect(isValidLatLng(6129956, 1583912)).toBe(false);
    });

    it('null island och dess närområde avvisas', () => {
        expect(isValidLatLng(0, 0)).toBe(false);
        expect(isValidLatLng(0.009, -0.009)).toBe(false);
        expect(isValidLatLng(0.02, 0)).toBe(true); // utanför ~1 km-zonen
    });

    it('icke-tal, NaN och Infinity avvisas', () => {
        expect(isValidLatLng('59.3' as unknown, 18 as unknown)).toBe(false);
        expect(isValidLatLng(NaN, 18)).toBe(false);
        expect(isValidLatLng(59, Infinity)).toBe(false);
        expect(isValidLatLng(null, undefined)).toBe(false);
    });

    it('gränsvärden: exakt ±90/±180 är giltiga, utanför inte', () => {
        expect(isValidLatLng(90, 180)).toBe(true);
        expect(isValidLatLng(-90, -180)).toBe(true);
        expect(isValidLatLng(90.0001, 0)).toBe(false);
        expect(isValidLatLng(0.02, 180.0001)).toBe(false);
    });
});
