import { describe, it, expect } from 'vitest';
import { shouldRunToday, scheduledForToday, isRefreshRun, fnv1a, localDayNumber } from './schedule';
import { Source } from './types';

const DAYS = Array.from({ length: 28 }, (_, i) => new Date(2026, 5, 1 + i)); // 1–28 juni 2026

function src(overrides: Partial<Source>): Source {
    return { id: 's', hostName: 'H', engine: 'sitemap', config: {}, ...overrides } as Source;
}

describe('shouldRunToday (hash-fas)', () => {
    it('hourly och daily körs alla dagar', () => {
        for (const day of DAYS.slice(0, 7)) {
            expect(shouldRunToday(src({ updateFrequency: 'hourly' }), day)).toBe(true);
            expect(shouldRunToday(src({ updateFrequency: 'daily' }), day)).toBe(true);
        }
    });

    it('utelämnad frekvens defaultar till daily', () => {
        expect(shouldRunToday(src({}), DAYS[1])).toBe(true);
    });

    it('every-3d körs exakt var 3:e dag', () => {
        const s = src({ id: 'kommun-x', updateFrequency: 'every-3d' });
        const runDays = DAYS.filter((d) => shouldRunToday(s, d)).map((d) => d.getDate());
        expect(runDays.length).toBeGreaterThanOrEqual(9);
        for (let i = 1; i < runDays.length; i++) {
            expect(runDays[i] - runDays[i - 1]).toBe(3);
        }
    });

    it('weekly körs exakt var 7:e dag', () => {
        const s = src({ id: 'venue-y', updateFrequency: 'weekly' });
        const runDays = DAYS.filter((d) => shouldRunToday(s, d)).map((d) => d.getDate());
        expect(runDays.length).toBe(4);
        for (let i = 1; i < runDays.length; i++) {
            expect(runDays[i] - runDays[i - 1]).toBe(7);
        }
    });

    it('biweekly körs exakt var 14:e dag', () => {
        const s = src({ id: 'operahuset', updateFrequency: 'biweekly' });
        const runDays = DAYS.filter((d) => shouldRunToday(s, d)).map((d) => d.getDate());
        expect(runDays.length).toBe(2);
        expect(runDays[1] - runDays[0]).toBe(14);
    });

    it('olika källor får olika faser — lasten sprids jämnt över nätter', () => {
        const sources = Array.from({ length: 300 }, (_, i) =>
            src({ id: `kalla-${i}`, updateFrequency: 'every-3d' }),
        );
        const perDay = DAYS.slice(0, 3).map((d) => scheduledForToday(sources, d).length);
        // Alla 300 ska köras exakt en gång över 3 nätter …
        expect(perDay.reduce((a, b) => a + b, 0)).toBe(300);
        // … och ingen natt får vara tom eller ta mer än ~hälften.
        for (const n of perDay) {
            expect(n).toBeGreaterThan(50);
            expect(n).toBeLessThan(150);
        }
    });

    it('disabled och dead körs aldrig — oavsett frekvens', () => {
        expect(shouldRunToday(src({ disabled: true, updateFrequency: 'hourly' }), DAYS[0])).toBe(false);
        expect(shouldRunToday(src({ status: 'dead', updateFrequency: 'daily' }), DAYS[0])).toBe(false);
    });

    it('är deterministisk — samma källa+dag ger alltid samma svar', () => {
        const s = src({ id: 'stabil', updateFrequency: 'weekly' });
        const a = DAYS.map((d) => shouldRunToday(s, d));
        const b = DAYS.map((d) => shouldRunToday(s, d));
        expect(a).toEqual(b);
    });
});

describe('isRefreshRun', () => {
    it('var 4:e körning är full-refresh', () => {
        const s = src({ id: 'daily-z', updateFrequency: 'daily' });
        const refreshes = DAYS.filter((d) => isRefreshRun(s, d));
        // 28 dagar daily → 7 refresh-körningar med jämn 4-dagars-rytm
        expect(refreshes.length).toBe(7);
        for (let i = 1; i < refreshes.length; i++) {
            expect(localDayNumber(refreshes[i]) - localDayNumber(refreshes[i - 1])).toBe(4);
        }
    });

    it('refresh-faserna skiljer sig mellan källor', () => {
        const ids = Array.from({ length: 40 }, (_, i) => `s-${i}`);
        const refreshingToday = ids.filter((id) =>
            isRefreshRun(src({ id, updateFrequency: 'daily' }), DAYS[0]),
        );
        // ~25% förväntas — kräver bara att inte alla/inga träffar samma natt
        expect(refreshingToday.length).toBeGreaterThan(0);
        expect(refreshingToday.length).toBeLessThan(40);
    });
});

describe('scheduledForToday', () => {
    it('filtrerar bort döda källor och respekterar frekvens', () => {
        const sources = [
            src({ id: 'a', updateFrequency: 'daily' }),
            src({ id: 'b', updateFrequency: 'weekly' }),
            src({ id: 'c', status: 'dead' }),
        ];
        for (const d of DAYS) {
            const ids = scheduledForToday(sources, d).map((s) => s.id);
            expect(ids).toContain('a');
            expect(ids).not.toContain('c');
        }
        // b körs exakt 4 ggr på 28 dagar
        const bRuns = DAYS.filter((d) => scheduledForToday(sources, d).some((s) => s.id === 'b'));
        expect(bRuns.length).toBe(4);
    });
});

describe('fnv1a', () => {
    it('ger stabil, spridd hash', () => {
        expect(fnv1a('abc')).toBe(fnv1a('abc'));
        expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
        const buckets = new Set(Array.from({ length: 100 }, (_, i) => fnv1a(`id-${i}`) % 7));
        expect(buckets.size).toBe(7); // alla 7 veckodags-faser används
    });
});
