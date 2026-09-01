import { describe, it, expect } from 'vitest';
import { isValidLatLng, zoomForSpan, sameCityView } from './mapUtils';

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

// Hur brett en zoom-nivå faktiskt är i meter på en yta som är widthPx bred —
// facit för alla kameramått i kartan (startvyn, första-klick-fältet,
// intro-nedstigningen). Kontrollen görs BAKLÄNGES: räkna ut metrarna som
// zoomen ger och jämför med den beställda vidden.
const spanAtZoom = (widthPx: number, lat: number, zoom: number) =>
    ((40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / 512 / 2 ** zoom) * widthPx;

describe('zoomForSpan', () => {
    it('ger en zoom som visar precis den beställda vidden', () => {
        expect(spanAtZoom(1280, 59, zoomForSpan(1280, 59, 80_000))).toBeCloseTo(80_000, 3);
        expect(spanAtZoom(390, 67, zoomForSpan(390, 67, 460_000))).toBeCloseTo(460_000, 3);
    });

    it('halverad vidd = exakt en zoomnivå närmare', () => {
        const wide = zoomForSpan(1280, 59, 160_000);
        expect(zoomForSpan(1280, 59, 80_000) - wide).toBeCloseTo(1, 10);
    });

    it('bredare skärm ⇒ högre zoom för samma vidd i meter', () => {
        expect(zoomForSpan(1280, 59, 80_000)).toBeGreaterThan(zoomForSpan(390, 59, 80_000));
    });
});

// Kartan öppnar i din sparade stad, och GPS-svaret strax efteråt siktar oftast
// på exakt samma ortspunkt. Då ska stadshoppets frostade överlägg INTE fyra —
// annars blinkar det till för en förflyttning på noll meter.
describe('sameCityView', () => {
    const vaxjo = { lat: 56.8777, lng: 14.8091, zoom: 10 };

    it('samma punkt och zoom = samma vy', () => {
        expect(sameCityView(vaxjo, vaxjo)).toBe(true);
    });

    it('någon kilometer bort räknas fortfarande som samma stad', () => {
        expect(sameCityView({ ...vaxjo, lat: 56.888, lng: 14.82 }, vaxjo)).toBe(true);
    });

    it('grannstaden är INTE samma vy', () => {
        expect(sameCityView({ lat: 57.7826, lng: 14.1618, zoom: 10 }, vaxjo)).toBe(false); // Jönköping
        expect(sameCityView({ ...vaxjo, lng: 15.2 }, vaxjo)).toBe(false);                  // ~2,4 mil öster
    });

    it('samma punkt men annan höjd är INTE samma vy', () => {
        expect(sameCityView({ ...vaxjo, zoom: 6.8 }, vaxjo)).toBe(false);  // hela Sverige-vyn
        expect(sameCityView({ ...vaxjo, zoom: 10.2 }, vaxjo)).toBe(true);  // en gnutta ifrån
    });

    it('longituden vägs med cos(lat) — samma gradavstånd är kortare i norr', () => {
        const kiruna = { lat: 67.8558, lng: 20.2253, zoom: 10 };
        // 0,04° longitud ≈ 1,7 km i Kiruna men ≈ 2,4 km i Växjö.
        expect(sameCityView({ ...kiruna, lng: 20.2653 }, kiruna)).toBe(true);
    });
});
