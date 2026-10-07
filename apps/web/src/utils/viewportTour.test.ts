import { describe, it, expect } from 'vitest';
import {
    isInVisibleMapArea,
    dayOffsetOf,
    nextPeriodWithEvents,
    zoomOutStepsToReveal,
    TOUR_CARD_COVER_FRACTION,
} from './viewportTour';

// En stadsvy över Stockholm: ~0.1° hög, ~0.2° bred.
const STHLM = { west: 17.95, south: 59.28, east: 18.15, north: 59.38 };

describe('isInVisibleMapArea', () => {
    it('punkt mitt i rutan syns, punkt utanför gör det inte', () => {
        expect(isInVisibleMapArea(59.33, 18.05, STHLM)).toBe(true);
        expect(isInVisibleMapArea(59.33, 18.30, STHLM)).toBe(false); // öster om
        expect(isInVisibleMapArea(59.20, 18.05, STHLM)).toBe(false); // söder om
        expect(isInVisibleMapArea(59.40, 18.05, STHLM)).toBe(false); // norr om
    });

    it('utan kartruta syns ingenting', () => {
        expect(isInVisibleMapArea(59.33, 18.05, null)).toBe(false);
        expect(isInVisibleMapArea(59.33, 18.05, undefined)).toBe(false);
    });

    it('ogiltiga koordinater syns aldrig', () => {
        expect(isInVisibleMapArea(NaN, 18.05, STHLM)).toBe(false);
        expect(isInVisibleMapArea(59.33, Infinity, STHLM)).toBe(false);
    });

    it('brickor BAKOM kortet (nedersta andelen av skärmen) räknas inte som i bild', () => {
        // Strax ovanför sydkanten = bakom ett kort som täcker nedre 22 %.
        expect(isInVisibleMapArea(59.285, 18.05, STHLM)).toBe(true);
        expect(isInVisibleMapArea(59.285, 18.05, STHLM, TOUR_CARD_COVER_FRACTION)).toBe(false);
        // Mitt i rutan står fri oavsett kortet.
        expect(isInVisibleMapArea(59.33, 18.05, STHLM, TOUR_CARD_COVER_FRACTION)).toBe(true);
    });

    it('kortets överkant ligger på rätt andel av SKÄRMEN (mercator), inte av latituden', () => {
        // Vid 59° N är mercator nästan linjär över 0.1°, så gränsen för 50 %
        // ligger mycket nära mittlatituden — men inte exakt. Kontrollera att
        // en punkt tydligt över mitten syns och en tydligt under inte gör det.
        expect(isInVisibleMapArea(59.335, 18.05, STHLM, 0.5)).toBe(true);
        expect(isInVisibleMapArea(59.325, 18.05, STHLM, 0.5)).toBe(false);
    });

    it('täcker kortet hela skärmen syns bara översta kanten', () => {
        expect(isInVisibleMapArea(59.379, 18.05, STHLM, 1)).toBe(false);
        expect(isInVisibleMapArea(59.38, 18.05, STHLM, 1)).toBe(true);
    });
});

describe('dayOffsetOf', () => {
    const now = new Date(2026, 8, 2, 14, 30); // ons 2 sep 2026 kl 14:30

    it('idag = 0 oavsett klockslag', () => {
        expect(dayOffsetOf(new Date(2026, 8, 2, 0, 5), now)).toBe(0);
        expect(dayOffsetOf(new Date(2026, 8, 2, 23, 55), now)).toBe(0);
    });

    it('imorgon = 1, igår = −1', () => {
        expect(dayOffsetOf(new Date(2026, 8, 3, 9, 0), now)).toBe(1);
        expect(dayOffsetOf(new Date(2026, 8, 1, 23, 0), now)).toBe(-1);
    });

    it('räknar hela dygn över en sommartidsomställning', () => {
        // 25 okt 2026 är omställningen till vintertid i Sverige (25-timmarsdygn).
        const before = new Date(2026, 9, 24, 12, 0);
        expect(dayOffsetOf(new Date(2026, 9, 26, 12, 0), before)).toBe(2);
        expect(dayOffsetOf(new Date(2026, 9, 25, 12, 0), before)).toBe(1);
    });
});

describe('nextPeriodWithEvents', () => {
    it('nästa dag med event, tomma dagar hoppas över', () => {
        expect(nextPeriodWithEvents([0, 1, 3], 0)).toBe(1);
        expect(nextPeriodWithEvents([0, 3], 0)).toBe(3);
        expect(nextPeriodWithEvents([0, 3], 1)).toBe(3);
    });

    it('dagar bakom eller lika med startdagen räknas inte', () => {
        expect(nextPeriodWithEvents([-1, 0], 0)).toBeNull();
        expect(nextPeriodWithEvents([0, 0, 0], 0)).toBeNull();
    });

    it('null när inget finns kvar eller listan är tom', () => {
        expect(nextPeriodWithEvents([], 0)).toBeNull();
        expect(nextPeriodWithEvents([2, 5], 5)).toBeNull();
        expect(nextPeriodWithEvents([NaN], 0)).toBeNull();
    });

    it('veckovyn stegar i hela veckor och träffar fönster som innehåller event', () => {
        // Fönster [7,13] innehåller dag 10 → nästa vecka börjar på 7.
        expect(nextPeriodWithEvents([2, 10], 0, 7)).toBe(7);
        // Bara dag 16 kvar → fönster [14,20].
        expect(nextPeriodWithEvents([16], 0, 7)).toBe(14);
        // Dag 5 ligger i det NUVARANDE fönstret [0,6] → inget nästa.
        expect(nextPeriodWithEvents([5], 0, 7)).toBeNull();
    });

    it('en trasig periodlängd faller tillbaka till en dag', () => {
        expect(nextPeriodWithEvents([0, 2], 0, 0)).toBe(2);
        expect(nextPeriodWithEvents([0, 2], 0, 0.4)).toBe(2);
    });
});

describe('zoomOutStepsToReveal', () => {
    // 400 x 800: marginal 40/80 px, kortet täcker nedersta 22 %.
    const W = 400, H = 800;

    it('punkt som redan syns kräver ingen zoom', () => {
        expect(zoomOutStepsToReveal(0, 0, W, H)).toBe(0);
        expect(zoomOutStepsToReveal(100, -200, W, H)).toBe(0);
    });

    it('dubbelt så långt bort som rummet åt sidan = en zoomnivå ut', () => {
        // Rummet i x: 200 - 40 = 160 px.
        expect(zoomOutStepsToReveal(320, 0, W, H)).toBeCloseTo(1);
        expect(zoomOutStepsToReveal(-640, 0, W, H)).toBeCloseTo(2);
    });

    it('nedåt räknas mot kortets överkant, inte skärmens botten', () => {
        // Rummet nedåt: 800 * (0.5 - 0.22) - 80 = 144 px; uppåt 400 - 80 = 320.
        expect(zoomOutStepsToReveal(0, 288, W, H)).toBeCloseTo(1);
        expect(zoomOutStepsToReveal(0, -288, W, H)).toBe(0);
    });

    it('den snålaste riktningen avgör', () => {
        const steps = zoomOutStepsToReveal(320, 576, W, H);
        expect(steps).toBeCloseTo(2);
    });

    it('trasig storlek ger noll i stället för NaN', () => {
        expect(zoomOutStepsToReveal(500, 500, 0, H)).toBe(0);
    });

    it('efter zoomen ligger punkten inom den synliga ytan', () => {
        const dx = 1234, dy = 987;
        const s = Math.pow(2, -zoomOutStepsToReveal(dx, dy, W, H));
        expect(W / 2 + dx * s).toBeLessThanOrEqual(W - W * 0.1 + 1e-6);
        expect(H / 2 + dy * s).toBeLessThanOrEqual(H * (1 - TOUR_CARD_COVER_FRACTION) - H * 0.1 + 1e-6);
    });
});
