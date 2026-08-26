import { describe, it, expect } from 'vitest';
import { formatEventDate, formatEventDateSpan } from './dateUtils';

// Fast "nu" så Idag/Imorgon-grenarna är deterministiska: onsdag 2 sep 2026.
const NOW = new Date('2026-09-02T08:00:00');

describe('formatEventDate (injicerbart now)', () => {
    it('Idag/Imorgon/veckodag', () => {
        expect(formatEventDate(new Date('2026-09-02T10:00:00'), true, NOW)).toBe('Idag 10:00');
        expect(formatEventDate(new Date('2026-09-03T19:30:00'), true, NOW)).toBe('Imorgon 19:30');
        expect(formatEventDate(new Date('2026-09-05T15:00:00'), true, NOW)).toMatch(/^Lör 5 sep 15:00$/);
    });

    it('utan klockslag visas bara dagen', () => {
        expect(formatEventDate(new Date('2026-09-05T00:00:00'), false, NOW)).toMatch(/^Lör 5 sep$/);
    });
});

describe('formatEventDateSpan', () => {
    const start = new Date('2026-09-02T10:00:00');

    it('flerdagarsevent får spann (Live at Heart-regeln 26/8)', () => {
        expect(formatEventDateSpan(start, new Date('2026-09-05T23:00:00'), true, NOW))
            .toBe('Idag 10:00 – Lör 5 sep');
    });

    it('slut samma dag / saknat / bakvänt → vanliga formatet', () => {
        expect(formatEventDateSpan(start, new Date('2026-09-02T23:00:00'), true, NOW)).toBe('Idag 10:00');
        expect(formatEventDateSpan(start, undefined, true, NOW)).toBe('Idag 10:00');
        expect(formatEventDateSpan(start, new Date('2026-09-01T10:00:00'), true, NOW)).toBe('Idag 10:00');
        expect(formatEventDateSpan(start, new Date('skräp'), true, NOW)).toBe('Idag 10:00');
    });

    it('framtida start + spann', () => {
        expect(formatEventDateSpan(new Date('2026-09-09T10:00:00'), new Date('2026-09-12T22:00:00'), false, NOW))
            .toMatch(/^Ons 9 sep – Lör 12 sep$/);
    });
});
