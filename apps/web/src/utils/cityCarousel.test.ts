import { describe, it, expect } from 'vitest';
import { focusedTile, scrollLeftFor, stepTile, tileFocus } from './cityCarousel';

// Stadsvalets karusell (#268): brickan i mitten är den valda.
const SPACING = 164; // brickans bredd + mellanrummet

describe('tileFocus', () => {
    it('1 mitt i raden, 0 en brickbredd bort eller mer', () => {
        expect(tileFocus(500, 500, SPACING)).toBe(1);
        expect(tileFocus(500 + SPACING, 500, SPACING)).toBe(0);
        expect(tileFocus(500 - SPACING, 500, SPACING)).toBe(0);
        expect(tileFocus(5000, 500, SPACING)).toBe(0);
    });

    it('lika på båda sidor och jämnt avtagande', () => {
        expect(tileFocus(540, 500, SPACING)).toBeCloseTo(tileFocus(460, 500, SPACING), 10);
        let prev = 1;
        for (let d = 10; d <= SPACING; d += 10) {
            const f = tileFocus(500 + d, 500, SPACING);
            expect(f).toBeLessThan(prev);
            prev = f;
        }
    });

    it('mjuk i båda ändar: börjar inte växa med ett ryck', () => {
        // Nära kanten och nära mitten ändras värdet långsammare än mitt emellan.
        const atEdge = tileFocus(500 + SPACING - 8, 500, SPACING) - tileFocus(500 + SPACING, 500, SPACING);
        const atCenter = tileFocus(500, 500, SPACING) - tileFocus(508, 500, SPACING);
        const inMiddle = tileFocus(500 + SPACING / 2 - 4, 500, SPACING) - tileFocus(500 + SPACING / 2 + 4, 500, SPACING);
        expect(atEdge).toBeLessThan(inMiddle);
        expect(atCenter).toBeLessThan(inMiddle);
    });

    it('tål en rad utan mått', () => {
        expect(tileFocus(10, 10, 0)).toBe(0);
    });
});

describe('focusedTile', () => {
    const centers = [100, 264, 428, 592];

    it('brickan närmast mitten', () => {
        expect(focusedTile(centers, 100)).toBe(0);
        expect(focusedTile(centers, 300)).toBe(1);
        expect(focusedTile(centers, 9999)).toBe(3);
    });

    it('mitt emellan två vinner den tidigare, tom rad ger -1', () => {
        expect(focusedTile(centers, 182)).toBe(0);
        expect(focusedTile([], 100)).toBe(-1);
    });
});

describe('scrollLeftFor', () => {
    it('ställer brickan mitt i raden', () => {
        expect(scrollLeftFor(600, 400, 2000)).toBe(400);
    });

    it('stannar i radens ändar', () => {
        expect(scrollLeftFor(100, 400, 2000)).toBe(0);
        expect(scrollLeftFor(1950, 400, 2000)).toBe(1600);
        expect(scrollLeftFor(100, 400, 300)).toBe(0);
    });
});

describe('stepTile', () => {
    it('ett steg åt sidan, stannar i ändarna', () => {
        expect(stepTile(2, 1, 5)).toBe(3);
        expect(stepTile(0, -1, 5)).toBe(0);
        expect(stepTile(4, 1, 5)).toBe(4);
        expect(stepTile(0, 1, 0)).toBe(-1);
    });
});
