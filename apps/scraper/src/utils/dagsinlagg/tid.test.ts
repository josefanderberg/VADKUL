import { describe, it, expect } from 'vitest';
import {
    dagarMellan, dygnet, helgen, plusDagar, stockholmDatum, stockholmKlockslag,
    stockholmMidnatt, stockholmTid, stockholmVeckodag,
} from './tid';

describe('stockholmDatum', () => {
    it('ger svenskt väggdatum även strax efter UTC-midnatt', () => {
        // 23:30 UTC 2/11 = 00:30 svensk tid 3/11 (CET).
        expect(stockholmDatum(Date.UTC(2026, 10, 2, 23, 30))).toBe('2026-11-03');
    });

    it('hanterar sommartid', () => {
        // 22:30 UTC 2/7 = 00:30 svensk tid 3/7 (CEST).
        expect(stockholmDatum(Date.UTC(2026, 6, 2, 22, 30))).toBe('2026-07-03');
    });
});

describe('stockholmMidnatt och dygnet', () => {
    it('midnatt i november är 23:00 UTC dagen innan', () => {
        expect(stockholmMidnatt('2026-11-03').toISOString()).toBe('2026-11-02T23:00:00.000Z');
    });

    it('dygnet är 24 h brett utom vid tidsomställning', () => {
        const d = dygnet('2026-11-03');
        expect(d.slut.getTime() - d.start.getTime()).toBe(86_400_000);
        const omst = dygnet('2026-10-25'); // sommartiden slutar: 25 h
        expect(omst.slut.getTime() - omst.start.getTime()).toBe(25 * 3_600_000);
    });
});

describe('veckodag och helgen', () => {
    it('3/11 2026 är en tisdag', () => {
        expect(stockholmVeckodag(stockholmTid('2026-11-03', '07:00'))).toBe(2);
    });

    it('mån-tor pekar på kommande helg, fre-sön på innevarande', () => {
        const tis = helgen(stockholmTid('2026-11-03', '07:00'));
        expect(tis.fredag).toBe('2026-11-06');
        expect(tis.start.toISOString()).toBe('2026-11-05T23:00:00.000Z');
        expect(tis.slut.toISOString()).toBe('2026-11-08T23:00:00.000Z');
        expect(helgen(stockholmTid('2026-11-08', '12:00')).fredag).toBe('2026-11-06');
        expect(helgen(stockholmTid('2026-11-09', '12:00')).fredag).toBe('2026-11-13');
    });
});

describe('plusDagar, dagarMellan, klockslag', () => {
    it('räknar över månadsskifte', () => {
        expect(plusDagar('2026-11-29', 3)).toBe('2026-12-02');
        expect(dagarMellan('2026-11-29', '2026-12-02')).toBe(3);
        expect(dagarMellan('2026-12-02', '2026-11-29')).toBe(-3);
    });

    it('klockslag i svensk tid', () => {
        expect(stockholmKlockslag(stockholmTid('2026-11-03', '09:00'))).toBe('09:00');
        expect(stockholmTid('2026-11-03', '09:00').toISOString()).toBe('2026-11-03T08:00:00.000Z');
    });
});
