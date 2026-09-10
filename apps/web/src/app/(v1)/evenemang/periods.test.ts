import { describe, it, expect, afterEach, vi } from 'vitest';
import { periodKeys, PERIODS } from './periods';

// "I helgen" (tillbaka 10/9): nästkommande lör+sön i svensk tid; på lördag =
// idag+imorgon, på söndag = bara idag.
describe('periodKeys — I helgen', () => {
    afterEach(() => { vi.useRealTimers(); });
    const at = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };

    it('en onsdag → kommande lördag + söndag', () => {
        at('2026-09-09T10:00:00+02:00'); // onsdag
        expect(periodKeys('weekend')).toEqual(['2026-09-12', '2026-09-13']);
    });

    it('en lördag → idag + imorgon', () => {
        at('2026-09-12T10:00:00+02:00');
        expect(periodKeys('weekend')).toEqual(['2026-09-12', '2026-09-13']);
    });

    it('en söndag → bara idag', () => {
        at('2026-09-13T20:00:00+02:00');
        expect(periodKeys('weekend')).toEqual(['2026-09-13']);
    });

    it('svensk tid, inte UTC: fredag 23:30 UTC är redan lördag i Sverige', () => {
        at('2026-09-11T23:30:00Z'); // = lördag 01:30 svensk sommartid
        expect(periodKeys('weekend')).toEqual(['2026-09-12', '2026-09-13']);
    });

    it('chippet ligger mellan Imorgon och I veckan', () => {
        expect(PERIODS.map(p => p.key)).toEqual(['all', 'today', 'tomorrow', 'weekend', 'week']);
    });
});
