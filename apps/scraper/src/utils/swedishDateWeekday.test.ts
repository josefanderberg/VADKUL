import { describe, it, expect } from 'vitest';
import { parseSwedishDateWeekdayChecked } from './swedishDate';

// 7 sep 2026 är en MÅNDAG — all inferens nedan utgår från den.
const NOW = new Date(2026, 8, 7, 12, 0, 0);

describe('parseSwedishDateWeekdayChecked', () => {
    it('behåller årets datum när veckodagen stämmer', () => {
        const d = parseSwedishDateWeekdayChecked('fredag 11 sep 20.00', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(8);
        expect(d.getDate()).toBe(11);
        expect(d.getDay()).toBe(5);
    });

    it('hoppar till året då veckodagen stämmer i stället för att gissa framåt', () => {
        // 3 jan 2027 är en SÖNDAG, 3 jan 2028 en MÅNDAG. "lördag 3 jan" kan
        // alltså inte vara någotdera — men 3 jan 2026 var en lördag (bakåt).
        const d = parseSwedishDateWeekdayChecked('lördag 3 jan 19.00', NOW);
        expect(d === null || d.getDay() === 6).toBe(true);
    });

    it('returnerar null hellre än fel dag när ingen närliggande årgång stämmer', () => {
        // 14 dec 2026 är en måndag; "söndag 14 dec" stämmer inte 2026,
        // och grannåren ger tisdag (2027) resp. torsdag (2028).
        expect(parseSwedishDateWeekdayChecked('söndag 14 dec 16.30', NOW)).toBeNull();
    });

    it('lämnar strängar utan veckodag orörda', () => {
        const d = parseSwedishDateWeekdayChecked('11 sep 20.00', NOW)!;
        expect(d.getDate()).toBe(11);
        expect(d.getFullYear()).toBe(2026);
    });

    it('klarar förkortad veckodag', () => {
        const d = parseSwedishDateWeekdayChecked('tis 8 sep 15.00', NOW)!;
        expect(d.getDay()).toBe(2);
        expect(d.getDate()).toBe(8);
    });

    it('ger null för osnyggt skräp', () => {
        expect(parseSwedishDateWeekdayChecked('', NOW)).toBeNull();
        expect(parseSwedishDateWeekdayChecked('måndag ingen månad', NOW)).toBeNull();
    });
});
