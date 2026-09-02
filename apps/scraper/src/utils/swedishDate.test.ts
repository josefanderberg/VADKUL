import { describe, it, expect } from 'vitest';
import { findFirstDateInText, normalizeDateOnlyTime, parseSwedishDate } from './swedishDate';

describe('normalizeDateOnlyTime', () => {
    it('sommar: lokal midnatt (22:00Z föreg. dag) → 12:00Z rätt kalenderdag', () => {
        // 2026-06-24T22:00Z = 2026-06-25 00:00 CEST → avsedd dag är 25 juni.
        expect(normalizeDateOnlyTime(new Date('2026-06-24T22:00:00.000Z')).toISOString())
            .toBe('2026-06-25T12:00:00.000Z');
    });

    it('vinter: lokal midnatt (23:00Z föreg. dag) → 12:00Z rätt kalenderdag', () => {
        // 2026-12-10T23:00Z = 2026-12-11 00:00 CET → avsedd dag är 11 dec.
        expect(normalizeDateOnlyTime(new Date('2026-12-10T23:00:00.000Z')).toISOString())
            .toBe('2026-12-11T12:00:00.000Z');
    });

    it('ISO UTC-midnatt behåller samma kalenderdag', () => {
        expect(normalizeDateOnlyTime(new Date('2026-06-06T00:00:00.000Z')).toISOString())
            .toBe('2026-06-06T12:00:00.000Z');
    });

    it('är idempotent (12:00Z → 12:00Z)', () => {
        const once = normalizeDateOnlyTime(new Date('2026-06-24T22:00:00.000Z'));
        expect(normalizeDateOnlyTime(once).toISOString()).toBe(once.toISOString());
    });

    it('renderar som dagtid i Stockholm (≈13–14:00), aldrig midnatt', () => {
        const out = normalizeDateOnlyTime(new Date('2026-06-24T22:00:00.000Z'));
        const hhmm = out.toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
        expect(hhmm).toBe('14:00');
    });
});

describe('findFirstDateInText — år med komma + spök-datum', () => {
    const NOW = new Date('2026-08-31T12:00:00');

    it('"8 juni, 2026" läses som 2026 (inte som årlöst datum)', () => {
        const d = findFirstDateInText('calendar_today 8 juni, 2026 Slagthuset, Malmö', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(5);
        expect(d.getDate()).toBe(8);
    });

    it('brödtext som upprepar ett passerat datum utan år ger inget spöke nästa år', () => {
        // Kulturbolaget: faktarutan har "8 juni, 2026", ingressen "Den 8 juni".
        // Utan dedupen vann 2027-06-08 som "första framtida datum" och eventet
        // som redan spelats dök upp igen ett år fram.
        const d = findFirstDateInText(
            '8 juni, 2026 Slagthuset, Malmö Datum har passerat. Den 8 juni intar han scenen.',
            NOW,
        )!;
        expect(d.getFullYear()).toBe(2026);
    });

    it('årlöst datum som saknar utskriven motsvarighet gissas fortfarande framåt', () => {
        const d = findFirstDateInText('Publicerad 22 augusti 2025. Konsert 2 oktober kl 19:00', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(9);
        expect(d.getDate()).toBe(2);
        expect(d.getHours()).toBe(19);
    });

    it('parseSwedishDate klarar komma före året', () => {
        const d = parseSwedishDate('8 juni, 2026', NOW)!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(5);
    });
});
