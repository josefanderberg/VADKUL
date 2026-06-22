import { describe, it, expect } from 'vitest';
import { normalizeDateOnlyTime } from './swedishDate';

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
