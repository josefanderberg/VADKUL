import { describe, it, expect } from 'vitest';
import { shouldRunToday, scheduledForToday } from './schedule';
import { Source } from './types';

// Juni 2026: mån 1:a → sön 7:e, mån 8:e, ons 10:e, tor 11:e.
const SUN = new Date(2026, 5, 7);
const MON = new Date(2026, 5, 8);
const TUE = new Date(2026, 5, 9);
const WED = new Date(2026, 5, 10);
const THU = new Date(2026, 5, 11);

function src(overrides: Partial<Source>): Source {
    return { id: 's', hostName: 'H', engine: 'sitemap', config: {}, ...overrides } as Source;
}

describe('shouldRunToday', () => {
    it('hourly och daily körs alla dagar', () => {
        for (const day of [SUN, MON, TUE, WED, THU]) {
            expect(shouldRunToday(src({ updateFrequency: 'hourly' }), day)).toBe(true);
            expect(shouldRunToday(src({ updateFrequency: 'daily' }), day)).toBe(true);
        }
    });

    it('utelämnad frekvens defaultar till daily', () => {
        expect(shouldRunToday(src({}), TUE)).toBe(true);
    });

    it('every-3d körs sön/mån/tor', () => {
        expect(shouldRunToday(src({ updateFrequency: 'every-3d' }), SUN)).toBe(true);
        expect(shouldRunToday(src({ updateFrequency: 'every-3d' }), MON)).toBe(true);
        expect(shouldRunToday(src({ updateFrequency: 'every-3d' }), THU)).toBe(true);
        expect(shouldRunToday(src({ updateFrequency: 'every-3d' }), TUE)).toBe(false);
        expect(shouldRunToday(src({ updateFrequency: 'every-3d' }), WED)).toBe(false);
    });

    it('weekly körs bara onsdag', () => {
        expect(shouldRunToday(src({ updateFrequency: 'weekly' }), WED)).toBe(true);
        for (const day of [SUN, MON, TUE, THU]) {
            expect(shouldRunToday(src({ updateFrequency: 'weekly' }), day)).toBe(false);
        }
    });

    it('disabled och dead körs aldrig — oavsett frekvens', () => {
        expect(shouldRunToday(src({ disabled: true, updateFrequency: 'hourly' }), WED)).toBe(false);
        expect(shouldRunToday(src({ status: 'dead', updateFrequency: 'daily' }), WED)).toBe(false);
    });
});

describe('scheduledForToday', () => {
    it('filtrerar källistan enligt frekvens', () => {
        const sources = [
            src({ id: 'a', updateFrequency: 'daily' }),
            src({ id: 'b', updateFrequency: 'weekly' }),
            src({ id: 'c', status: 'dead' }),
        ];
        expect(scheduledForToday(sources, TUE).map((s) => s.id)).toEqual(['a']);
        expect(scheduledForToday(sources, WED).map((s) => s.id)).toEqual(['a', 'b']);
    });
});
