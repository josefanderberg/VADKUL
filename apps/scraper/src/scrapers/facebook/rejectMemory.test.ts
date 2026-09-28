import { describe, it, expect } from 'vitest';
import { shouldSkip, rememberOutsideWindow, rememberNoDate, pruneMemory, RejectMemory, NO_DATE_RETRY_DAYS } from './rejectMemory';

const now = new Date('2026-09-28T12:00:00');
const days = (n: number) => new Date(now.getTime() + n * 86400000);

describe('rejectMemory', () => {
    it('okänd URL laddas som vanligt', () => {
        expect(shouldSkip({}, 'u', now)).toBe(false);
    });

    it('passerat event hoppas över för gott', () => {
        const mem: RejectMemory = {};
        rememberOutsideWindow(mem, 'u', days(-3));
        expect(shouldSkip(mem, 'u', now)).toBe(true);
        expect(shouldSkip(mem, 'u', days(200))).toBe(true);
    });

    it('event bortom fönstret hoppas över tills det kommer inom 30 dagar', () => {
        const mem: RejectMemory = {};
        rememberOutsideWindow(mem, 'u', days(45));
        expect(shouldSkip(mem, 'u', now)).toBe(true);
        expect(shouldSkip(mem, 'u', days(20))).toBe(false);   // 25 dagar kvar → inom fönstret
    });

    it('event idag räknas inte som passerat', () => {
        const mem: RejectMemory = { u: { eventTime: new Date('2026-09-28T08:00:00').toISOString() } };
        expect(shouldSkip(mem, 'u', now)).toBe(false);
    });

    it('utan datum vilar i NO_DATE_RETRY_DAYS dagar', () => {
        const mem: RejectMemory = {};
        rememberNoDate(mem, 'u', now);
        expect(shouldSkip(mem, 'u', days(NO_DATE_RETRY_DAYS - 1))).toBe(true);
        expect(shouldSkip(mem, 'u', days(NO_DATE_RETRY_DAYS + 1))).toBe(false);
    });

    it('prune släpper årsgamla passerade och utgångna no-date, behåller resten', () => {
        const mem: RejectMemory = {
            old: { eventTime: days(-400).toISOString() },
            past: { eventTime: days(-10).toISOString() },
            far: { eventTime: days(90).toISOString() },
            nodateDone: { retryAfter: days(-1).toISOString() },
            nodateWait: { retryAfter: days(5).toISOString() },
        };
        expect(Object.keys(pruneMemory(mem, now)).sort()).toEqual(['far', 'nodateWait', 'past']);
    });

    it('trasigt datum ⇒ ingen skip (hellre en sidladdning för mycket)', () => {
        expect(shouldSkip({ u: { eventTime: 'nonsens' } }, 'u', now)).toBe(false);
    });
});
