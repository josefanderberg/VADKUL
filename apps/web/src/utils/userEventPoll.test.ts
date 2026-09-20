import { describe, it, expect } from 'vitest';
import {
    decideUserEventPoll,
    USER_EVENT_SAFETY_REFETCH_MS,
    type UserEventPollInput,
} from './userEventPoll';

/** Stabilt utgångsläge: hämtat nyss, 53 event, probe:n håller med. */
const base: UserEventPollInput = {
    nowMs: 1_000_000,
    lastFullFetchMs: 1_000_000 - 30_000,
    lastCount: 53,
    probedCount: 53,
};

describe('decideUserEventPoll', () => {
    it('hämtar allt första gången (inget hämtat än)', () => {
        expect(decideUserEventPoll({ ...base, lastFullFetchMs: null, lastCount: null }))
            .toBe('full');
    });

    it('hämtar allt även om bara antalet saknas', () => {
        expect(decideUserEventPoll({ ...base, lastCount: null })).toBe('full');
    });

    it('hoppar över varvet när antalet står stilla', () => {
        expect(decideUserEventPoll(base)).toBe('skip');
    });

    it('hämtar när ett event tillkommit', () => {
        expect(decideUserEventPoll({ ...base, probedCount: 54 })).toBe('full');
    });

    it('hämtar när ett event tagits bort', () => {
        expect(decideUserEventPoll({ ...base, probedCount: 52 })).toBe('full');
    });

    it('hämtar när probe:n misslyckades — null är "vet inte", inte "noll"', () => {
        expect(decideUserEventPoll({ ...base, probedCount: null })).toBe('full');
    });

    it('skiljer misslyckad probe från en databas som faktiskt är tom', () => {
        // 0 event kvar efter att det enda tagits bort ska hämtas...
        expect(decideUserEventPoll({ ...base, lastCount: 1, probedCount: 0 })).toBe('full');
        // ...men ett stabilt tomt läge ska INTE hämtas om och om igen.
        expect(decideUserEventPoll({ ...base, lastCount: 0, probedCount: 0 })).toBe('skip');
    });

    it('säkerhetsnätet hämtar när tiden löpt ut trots oförändrat antal', () => {
        const nowMs = base.nowMs;
        expect(decideUserEventPoll({
            ...base,
            nowMs,
            lastFullFetchMs: nowMs - USER_EVENT_SAFETY_REFETCH_MS,
        })).toBe('full');
    });

    it('säkerhetsnätet slår INTE till en tick för tidigt', () => {
        const nowMs = base.nowMs;
        expect(decideUserEventPoll({
            ...base,
            nowMs,
            lastFullFetchMs: nowMs - USER_EVENT_SAFETY_REFETCH_MS + 1,
        })).toBe('skip');
    });

    it('respekterar överstyrt nätintervall', () => {
        const nowMs = base.nowMs;
        expect(decideUserEventPoll({
            ...base, nowMs, lastFullFetchMs: nowMs - 60_000, safetyMs: 30_000,
        })).toBe('full');
        expect(decideUserEventPoll({
            ...base, nowMs, lastFullFetchMs: nowMs - 10_000, safetyMs: 30_000,
        })).toBe('skip');
    });

    it('KOSTNADSKONTRAKTET: ett dygns stillastående pollar ger max nätets hämtningar', () => {
        // Simulera ett dygn med 30 s-poll och oförändrat antal: alla varv utom
        // säkerhetsnätets ska bli 'skip'. Går det här testet rött har någon
        // gjort pollen dyr igen — det var precis det som kostade 400k reads.
        const POLL_MS = 30_000;
        const DAY_MS = 24 * 60 * 60 * 1000;
        let lastFullFetchMs = 0;
        let fulls = 0;
        for (let t = POLL_MS; t <= DAY_MS; t += POLL_MS) {
            const d = decideUserEventPoll({
                nowMs: t, lastFullFetchMs, lastCount: 53, probedCount: 53,
            });
            if (d === 'full') { fulls++; lastFullFetchMs = t; }
        }
        // 24 h / 15 min = 96 fulla hämtningar, i stället för 2 880 pollar.
        expect(fulls).toBe(96);
        expect(fulls).toBeLessThan(DAY_MS / POLL_MS / 10);
    });
});
