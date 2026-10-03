import { describe, it, expect } from 'vitest';
import { countPerDay, sumDayCounts, stockholmDay } from './dayCounts';

// Vitest kör med TZ=Europe/Stockholm (vitest.config), som besökarna.

describe('countPerDay', () => {
    it('räknar per SVENSK dag — 23:30 UTC är nästa dag i Sverige', () => {
        const out = countPerDay([
            { time: '2026-10-03T10:00:00.000Z' },
            { time: '2026-10-03T21:30:00.000Z' },   // 23:30 svensk tid, samma dag
            { time: '2026-10-03T22:30:00.000Z' },   // 00:30 den 4/10
            { time: 'trasig' },
            {},
        ]);
        expect(out).toEqual({ '2026-10-03': 2, '2026-10-04': 1 });
    });
});

describe('sumDayCounts', () => {
    const perDay = { '2026-10-24': 1, '2026-10-25': 10, '2026-10-26': 100, '2026-10-27': 1000 };

    it('summerar dagarna från och med startdagen', () => {
        expect(sumDayCounts(perDay, new Date(2026, 9, 25, 8, 0), 2)).toBe(110);
    });

    it('sommartidens slut (25/10) varken hoppar över eller dubblar ett dygn', () => {
        expect(sumDayCounts(perDay, new Date(2026, 9, 24, 23, 59), 4)).toBe(1111);
    });

    it('saknade dagar räknas som noll', () => {
        expect(sumDayCounts({}, new Date(2026, 9, 25), 7)).toBe(0);
    });

    it('stockholmDay ger ÅÅÅÅ-MM-DD', () => {
        expect(stockholmDay(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
    });
});
