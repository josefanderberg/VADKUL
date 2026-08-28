import { describe, it, expect } from 'vitest';
import { expandWeekly } from './linkEventService';
import type { LinkEvent } from '../types';

// Veckoserier: EN regel på dokumentet vecklas ut till konkreta tillfällen.
// repeatWeeks begränsar serien; utan fältet rullar den tills vidare (gamla
// dokument, från innan valet fanns, ska bete sig exakt som förut).

const base = (time: Date, repeatWeeks?: number): LinkEvent =>
    ({ id: 'doc1', title: 'Pubquiz', time, repeatWeekly: true, repeatWeeks } as unknown as LinkEvent);

describe('expandWeekly', () => {
    // "Idag" i testet: onsdag 19 aug 2026. Serien startade onsdag 5 aug 19:00.
    const from = new Date(2026, 7, 19, 0, 0);
    const seriesStart = new Date(2026, 7, 5, 19, 0);

    it('obegränsad serie: hoppar över passerade datum och fyller horisonten', () => {
        const out = expandWeekly(base(seriesStart), from);
        expect(out.length).toBeGreaterThanOrEqual(12);
        expect(out[0].time).toEqual(new Date(2026, 7, 19, 19, 0)); // nästa tillfälle, inte 5 aug
        expect(out[0].id).toBe('doc1__2026-08-19');
        expect(out[0].seriesId).toBe('doc1');
    });

    it('repeatWeeks begränsar: 4 veckor = basen + tre till, sedan slut', () => {
        const out = expandWeekly(base(seriesStart, 4), from);
        // Serie 5/8–26/8; den 19/8 återstår 19/8 och 26/8.
        expect(out.map(e => e.id)).toEqual(['doc1__2026-08-19', 'doc1__2026-08-26']);
    });

    // Udda antal veckor (3, 5, …) valbara sedan 28/8 — dropdownen bjöd bara på
    // jämna tal, och en femveckorskurs fick väljas som "tills vidare".
    it('udda antal veckor: 5 veckor = basen + fyra till', () => {
        const out = expandWeekly(base(seriesStart, 5), from);
        // Serie 5/8–2/9; den 19/8 återstår 19/8, 26/8 och 2/9.
        expect(out.map(e => e.id)).toEqual([
            'doc1__2026-08-19', 'doc1__2026-08-26', 'doc1__2026-09-02',
        ]);
    });

    it('udda antal veckor: 3 veckor är slut den 19/8 (sista gången 19/8)', () => {
        const out = expandWeekly(base(seriesStart, 3), from);
        expect(out.map(e => e.id)).toEqual(['doc1__2026-08-19']);
    });

    it('färdigspelad serie ger tomt — försvinner från kartan av sig själv', () => {
        expect(expandWeekly(base(seriesStart, 2), from)).toEqual([]);
    });

    it('repeatWeeks 1 = engångsevent i seriens kläder', () => {
        const future = new Date(2026, 7, 21, 18, 0);
        const out = expandWeekly(base(future, 1), from);
        expect(out.map(e => e.id)).toEqual(['doc1__2026-08-21']);
    });
});
