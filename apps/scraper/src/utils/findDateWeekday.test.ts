import { describe, it, expect } from 'vitest';
import { findFirstDateInText } from './swedishDate';

// 8 sep 2026 är en TISDAG.
const NOW = new Date(2026, 8, 8, 12, 0, 0);

describe('findFirstDateInText — veckodagen som facit', () => {
    it('behåller året när veckodagen stämmer (musikhuset.nu-formen)', () => {
        // 28 oktober 2026 är en onsdag.
        const d = findFirstDateInText('kliver upp på scenen onsdagen den 28 oktober kl 19.00', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(9);
        expect(d.getDate()).toBe(28);
        expect(d.getDay()).toBe(3);
    });

    it('slänger datumet hellre än att sätta fel dag', () => {
        // 28 oktober är onsdag 2026, torsdag 2027, lördag 2028 — "måndagen den
        // 28 oktober" går inte ihop med någon årgång framåt.
        expect(findFirstDateInText('måndagen den 28 oktober', NOW)).toBeNull();
    });

    it('rör inte datum UTAN veckodag', () => {
        const d = findFirstDateInText('Bonnadagen 26 september', NOW)!;
        expect(d.getMonth()).toBe(8);
        expect(d.getDate()).toBe(26);
        expect(d.getFullYear()).toBe(2026);
    });

    it('utskrivet år vinner fortfarande över gissning', () => {
        const d = findFirstDateInText('Premiär 14 mars 2027 kl 19:00', NOW)!;
        expect(d.getFullYear()).toBe(2027);
        expect(d.getMonth()).toBe(2);
    });

    it('klarar veckodag utan "den"', () => {
        // 12 september 2026 är en lördag.
        const d = findFirstDateInText('Lördag 12 september 10:00 Välkomna', NOW)!;
        expect(d.getDate()).toBe(12);
        expect(d.getDay()).toBe(6);
    });

    it('ISO-datum påverkas inte', () => {
        const d = findFirstDateInText('start 2026-10-06T17:00', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getDate()).toBe(6);
    });
});
