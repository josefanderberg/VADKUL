import { describe, it, expect } from 'vitest';
import {
    fitCamera, SWEDEN_BOUNDS, OVERVIEW_PADDING, OVERVIEW_MIN_ZOOM, OVERVIEW_MAX_ZOOM,
    canOfferOverview, hasLeftOverview, OVERVIEW_OFFER_MIN_ZOOM, OVERVIEW_LEFT_ZOOM_DELTA,
    readSwedenNudgeDone, markSwedenNudgeDone, SWEDEN_NUDGE_KEY,
} from './swedenOverview';

const NO_PAD = { top: 0, bottom: 0, left: 0, right: 0 };
// Boxens Mercator-mitt: mitten mellan ln tan-värdena, tillbaka till grader.
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const midLat = (Math.atan(Math.sinh((mercY(SWEDEN_BOUNDS.north) + mercY(SWEDEN_BOUNDS.south)) / 2)) * 180) / Math.PI;
const midLng = (SWEDEN_BOUNDS.west + SWEDEN_BOUNDS.east) / 2;

describe('fitCamera', () => {
    it('utan krom: centrum är boxens Mercator-mitt', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 1400, height: 900 }, NO_PAD);
        expect(cam.lat).toBeCloseTo(midLat, 6);
        expect(cam.lng).toBeCloseTo(midLng, 6);
    });

    it('vanlig desktop (1400×900): den fria ytan är för låg för landet → golvet', () => {
        expect(fitCamera(SWEDEN_BOUNDS, { width: 1400, height: 900 }, OVERVIEW_PADDING).zoom).toBe(OVERVIEW_MIN_ZOOM);
    });

    it('hög skärm: zoomen ligger mellan golv och tak och styrs av höjden', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 1400, height: 1400 }, OVERVIEW_PADDING);
        expect(cam.zoom).toBeGreaterThan(OVERVIEW_MIN_ZOOM);
        expect(cam.zoom).toBeLessThan(OVERVIEW_MAX_ZOOM);
        // Landet är högt och smalt: bredare skärm ändrar inte zoomen …
        expect(fitCamera(SWEDEN_BOUNDS, { width: 2400, height: 1400 }, OVERVIEW_PADDING).zoom).toBeCloseTo(cam.zoom, 6);
        // … men högre skärm zoomar in.
        expect(fitCamera(SWEDEN_BOUNDS, { width: 1400, height: 1800 }, OVERVIEW_PADDING).zoom).toBeGreaterThan(cam.zoom);
    });

    it('telefon: hela landet ryms inte ens på kartans minZoom → golvet', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 390, height: 800 }, OVERVIEW_PADDING);
        expect(cam.zoom).toBe(OVERVIEW_MIN_ZOOM);
    });

    it('jätteskärm: taket', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 8000, height: 8000 }, NO_PAD);
        expect(cam.zoom).toBe(OVERVIEW_MAX_ZOOM);
    });

    it('mer krom i botten än i toppen → centrum söder om boxmitten, i lod', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 390, height: 800 }, OVERVIEW_PADDING);
        expect(cam.lat).toBeLessThan(midLat);
        // Symmetriska sidor → ingen sidledsförskjutning.
        expect(cam.lng).toBeCloseTo(midLng, 6);
        // Förskjutningen är exakt (bottom − top)/2 px vid slutzoomen: räkna
        // tillbaka från kameran och landa på boxmitten igen.
        const worldPx = 512 * Math.pow(2, cam.zoom);
        const shiftPx = ((mercY(midLat) - mercY(cam.lat)) * worldPx) / (2 * Math.PI);
        expect(shiftPx).toBeCloseTo((OVERVIEW_PADDING.bottom - OVERVIEW_PADDING.top) / 2, 3);
    });

    it('mer krom till vänster → centrum väster om boxmitten', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 1400, height: 900 }, { ...NO_PAD, left: 300 });
        expect(cam.lng).toBeLessThan(midLng);
        expect(cam.lat).toBeCloseTo(midLat, 6);
    });

    it('krom större än skärmen kraschar inte', () => {
        const cam = fitCamera(SWEDEN_BOUNDS, { width: 200, height: 200 }, OVERVIEW_PADDING);
        expect(Number.isFinite(cam.lat)).toBe(true);
        expect(Number.isFinite(cam.lng)).toBe(true);
        expect(cam.zoom).toBe(OVERVIEW_MIN_ZOOM);
    });
});

describe('canOfferOverview / hasLeftOverview', () => {
    it('erbjuds bara när man står inzoomad', () => {
        expect(canOfferOverview(10)).toBe(true);
        expect(canOfferOverview(OVERVIEW_OFFER_MIN_ZOOM)).toBe(true);
        expect(canOfferOverview(OVERVIEW_OFFER_MIN_ZOOM - 0.1)).toBe(false);
        expect(canOfferOverview(4)).toBe(false);
    });

    it('översikten är lämnad först en bit förbi dess zoom', () => {
        expect(hasLeftOverview(4.2, 4.2)).toBe(false);
        expect(hasLeftOverview(4.2 + OVERVIEW_LEFT_ZOOM_DELTA, 4.2)).toBe(false);
        expect(hasLeftOverview(4.2 + OVERVIEW_LEFT_ZOOM_DELTA + 0.01, 4.2)).toBe(true);
        // Utzoomning under översikten räknas aldrig som att ha lämnat den.
        expect(hasLeftOverview(4, 4.4)).toBe(false);
    });
});

describe('engångsflaggan', () => {
    const fakeStore = () => {
        const m = new Map<string, string>();
        return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
    };

    it('ovisad → falsk, markerad → sann', () => {
        const s = fakeStore();
        expect(readSwedenNudgeDone(s)).toBe(false);
        markSwedenNudgeDone(s);
        expect(readSwedenNudgeDone(s)).toBe(true);
        expect(s.getItem(SWEDEN_NUDGE_KEY)).toBe('1');
    });

    it('utan lagring: hellre tyst än en pop-up varje besök', () => {
        expect(readSwedenNudgeDone(null)).toBe(true);
        expect(() => markSwedenNudgeDone(null)).not.toThrow();
    });

    it('kastande lagring räknas som klar', () => {
        const throwing = { getItem: () => { throw new Error('privat'); }, setItem: () => { throw new Error('privat'); } };
        expect(readSwedenNudgeDone(throwing)).toBe(true);
        expect(() => markSwedenNudgeDone(throwing)).not.toThrow();
    });
});
