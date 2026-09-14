import { describe, it, expect } from 'vitest';
import { isNewSince, visitBaselineDay, NEW_SINCE_MIN_COUNT } from './newSinceLastVisit';

/** Fast "nu" så testerna aldrig blir tidsbomber. */
const NOW = Date.parse('2026-09-14T18:00:00.000Z');

describe('isNewSince', () => {
    it('räknar dagar EFTER baslinjen som nya', () => {
        expect(isNewSince('2026-09-13', '2026-09-10')).toBe(true);
    });

    it('räknar INTE samma dag som baslinjen (konservativt: aggregatet bakades sannolikt före besöket)', () => {
        expect(isNewSince('2026-09-10', '2026-09-10')).toBe(false);
    });

    it('räknar inte äldre dagar', () => {
        expect(isNewSince('2026-09-08', '2026-09-10')).toBe(false);
    });

    it('utan firstSeen eller baslinje är inget nytt', () => {
        expect(isNewSince(undefined, '2026-09-10')).toBe(false);
        expect(isNewSince('2026-09-13', null)).toBe(false);
        expect(isNewSince('', '2026-09-10')).toBe(false);
    });

    it('klarar månads- och årsskiften (lexikografisk ISO-jämförelse)', () => {
        expect(isNewSince('2026-10-01', '2026-09-30')).toBe(true);
        expect(isNewSince('2027-01-01', '2026-12-31')).toBe(true);
    });
});

describe('visitBaselineDay', () => {
    it('ger UTC-dagen för en lagrad ISO-stämpel', () => {
        expect(visitBaselineDay('2026-09-10T21:30:00.000Z', NOW)).toBe('2026-09-10');
    });

    it('normaliserar offset-stämplar till UTC-dag', () => {
        // 00:30 svensk sommartid = 22:30 UTC dagen innan.
        expect(visitBaselineDay('2026-09-11T00:30:00+02:00', NOW)).toBe('2026-09-10');
    });

    it('ger null för saknat, oparsbart eller framtida värde', () => {
        expect(visitBaselineDay(null, NOW)).toBeNull();
        expect(visitBaselineDay('', NOW)).toBeNull();
        expect(visitBaselineDay('trasigt', NOW)).toBeNull();
        expect(visitBaselineDay('2026-09-15T12:00:00.000Z', NOW)).toBeNull();
    });
});

describe('NEW_SINCE_MIN_COUNT', () => {
    it('är minst 2 — en banner om ett enda nytt event ska aldrig kunna visas', () => {
        expect(NEW_SINCE_MIN_COUNT).toBeGreaterThanOrEqual(2);
    });
});
