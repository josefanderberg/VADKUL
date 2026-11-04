import { describe, expect, it } from 'vitest';
import { featuredFirst, featuredUntilMs, isFeaturedAt } from './featured';

const NU = Date.parse('2026-11-04T12:00:00Z');

describe('isFeaturedAt', () => {
    it('Date, ISO-sträng och ms-tal räknas lika', () => {
        const sen = '2026-11-10T00:00:00Z';
        expect(isFeaturedAt(new Date(sen), NU)).toBe(true);
        expect(isFeaturedAt(sen, NU)).toBe(true);
        expect(isFeaturedAt(Date.parse(sen), NU)).toBe(true);
    });
    it('passerad boost, saknat eller ogiltigt värde är inte boostad', () => {
        expect(isFeaturedAt('2026-11-01T00:00:00Z', NU)).toBe(false);
        expect(isFeaturedAt(NU, NU)).toBe(false);
        expect(isFeaturedAt(undefined, NU)).toBe(false);
        expect(isFeaturedAt(null, NU)).toBe(false);
        expect(isFeaturedAt('inte ett datum', NU)).toBe(false);
        expect(isFeaturedAt(new Date(NaN), NU)).toBe(false);
    });
    it('featuredUntilMs ger null för otolkbart', () => {
        expect(featuredUntilMs('x')).toBeNull();
        expect(featuredUntilMs(undefined)).toBeNull();
        expect(featuredUntilMs(5)).toBe(5);
    });
});

describe('featuredFirst', () => {
    it('lyfter de boostade först och behåller ordningen inom båda grupperna', () => {
        const rader = ['a', 'B', 'c', 'D', 'e'];
        expect(featuredFirst(rader, r => r === r.toUpperCase())).toEqual(['B', 'D', 'a', 'c', 'e']);
    });
    it('utan boostade är ordningen orörd (ny array)', () => {
        const rader = ['a', 'b'];
        const ut = featuredFirst(rader, () => false);
        expect(ut).toEqual(rader);
        expect(ut).not.toBe(rader);
    });
});
