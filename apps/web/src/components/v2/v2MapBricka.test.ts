import { describe, it, expect } from 'vitest';
import type { LinkEvent } from '../../types';
import {
    isEventPast,
    groupIsPast,
    groupStartsWithinHour,
    groupKeyOf,
    NO_TIME_PAST_HOUR,
    ONE_HOUR_MS,
} from './v2MapBricka';

// "Har varit"-logiken delas av ALLA ytor (kartan, EventCard, SavedPanel,
// stadssidorna) — en regression här dimmar/visar fel event överallt samtidigt.

const ev = (time: Date | null, hasSpecificTime?: boolean): LinkEvent =>
    ({ time, hasSpecificTime } as unknown as LinkEvent);

describe('isEventPast', () => {
    // Fast "nu": 2026-08-19 15:00 lokal tid (TZ låst till Europe/Stockholm).
    const now = new Date(2026, 7, 19, 15, 0).getTime();

    it('event utan tid alls är aldrig "varit"', () => {
        expect(isEventPast(ev(null), now)).toBe(false);
    });

    it('event med klockslag: "varit" först en timme efter start', () => {
        const startedNow = new Date(2026, 7, 19, 15, 0);
        const started59min = new Date(2026, 7, 19, 14, 1);
        const started60min = new Date(2026, 7, 19, 14, 0);
        expect(isEventPast(ev(startedNow), now)).toBe(false);
        expect(isEventPast(ev(started59min), now)).toBe(false);
        expect(isEventPast(ev(started60min), now)).toBe(true);
    });

    it(`event utan klockslag: "varit" först kl ${NO_TIME_PAST_HOUR} sin dag`, () => {
        const todayMidnight = new Date(2026, 7, 19, 0, 0);
        const before20 = new Date(2026, 7, 19, 19, 59, 59).getTime();
        const at20 = new Date(2026, 7, 19, 20, 0).getTime();
        expect(isEventPast(ev(todayMidnight, false), before20)).toBe(false);
        expect(isEventPast(ev(todayMidnight, false), at20)).toBe(true);
    });

    it('gårdagens tidlösa event är "varit", morgondagens inte', () => {
        expect(isEventPast(ev(new Date(2026, 7, 18, 0, 0), false), now)).toBe(true);
        expect(isEventPast(ev(new Date(2026, 7, 20, 0, 0), false), now)).toBe(false);
    });
});

describe('groupIsPast', () => {
    const now = new Date(2026, 7, 19, 15, 0).getTime();
    const past = ev(new Date(2026, 7, 19, 10, 0));
    const upcoming = ev(new Date(2026, 7, 19, 18, 0));

    it('dämpas först när ALLA event i gruppen har varit', () => {
        expect(groupIsPast([past, upcoming], now)).toBe(false);
        expect(groupIsPast([past, past], now)).toBe(true);
    });

    it('tom grupp är inte "varit"', () => {
        expect(groupIsPast([], now)).toBe(false);
    });
});

describe('groupStartsWithinHour', () => {
    const now = new Date(2026, 7, 19, 15, 0).getTime();

    it('framtida start inom en timme → true, redan startat → false', () => {
        expect(groupStartsWithinHour([ev(new Date(now + ONE_HOUR_MS))], now)).toBe(true);
        expect(groupStartsWithinHour([ev(new Date(now + ONE_HOUR_MS + 1))], now)).toBe(false);
        expect(groupStartsWithinHour([ev(new Date(now))], now)).toBe(false);
    });
});

describe('groupKeyOf', () => {
    it('4 decimaler (~11 m) — nära koordinater delar markör, längre bort inte', () => {
        expect(groupKeyOf(59.32930001, 18.06860002)).toBe(groupKeyOf(59.3293, 18.0686));
        expect(groupKeyOf(59.3293, 18.0686)).not.toBe(groupKeyOf(59.3294, 18.0686));
    });
});
