import { describe, expect, it } from 'vitest';
import { lastNDayKeys, stockholmDayKey } from './visits';

// 2026-08-26 12:00 svensk sommartid (10:00 UTC).
const NOON = Date.parse('2026-08-26T10:00:00Z');

describe('stockholmDayKey', () => {
    it('ger ISO-form i svensk tid', () => {
        expect(stockholmDayKey(NOON)).toBe('2026-08-26');
    });
    it('räknar kvällsbesök till svenskt dygn, inte UTC', () => {
        // 23:30 svensk tid = 21:30 UTC — UTC-dygnet är fortfarande "26:e".
        expect(stockholmDayKey(Date.parse('2026-08-26T21:30:00Z'))).toBe('2026-08-26');
        // 00:30 svensk tid (27:e) = 22:30 UTC (26:e) — nyckeln ska vara 27:e.
        expect(stockholmDayKey(Date.parse('2026-08-26T22:30:00Z'))).toBe('2026-08-27');
    });
});

describe('lastNDayKeys', () => {
    it('ger idag + n−1 dagar bakåt, idag först', () => {
        expect(lastNDayKeys(3, NOON)).toEqual(['2026-08-26', '2026-08-25', '2026-08-24']);
    });
    it('kliver över månadsskiften', () => {
        const firstOfMonth = Date.parse('2026-09-01T10:00:00Z');
        expect(lastNDayKeys(2, firstOfMonth)).toEqual(['2026-09-01', '2026-08-31']);
    });
    it('7 dagar = besöksveckan', () => {
        const keys = lastNDayKeys(7, NOON);
        expect(keys).toHaveLength(7);
        expect(new Set(keys).size).toBe(7);
        expect(keys[6]).toBe('2026-08-20');
    });
});
