import { describe, expect, it } from 'vitest';
import {
    createSourceHealer, FEATURE_INDEX_ERROR, HEAL_COOLDOWN_MAX_MS, HEAL_COOLDOWN_MS, HEAL_DEBOUNCE_MS,
    isFeatureIndexError, type HealClock,
} from './v2MapEngineHeal';

// Motorbuggen "feature index out of bounds" (#206): ett trasigt kakel läks med
// en full setData av källan. Läkningen får aldrig bli en loop.

function fakeClock() {
    let t = 0;
    const timers: { at: number; fn: () => void }[] = [];
    const clock: HealClock = {
        now: () => t,
        setTimeout: (fn, ms) => { timers.push({ at: t + ms, fn }); },
    };
    const advance = (ms: number) => {
        const end = t + ms;
        for (;;) {
            timers.sort((a, b) => a.at - b.at);
            const next = timers[0];
            if (!next || next.at > end) break;
            timers.shift();
            t = next.at;
            next.fn();
        }
        t = end;
    };
    return { clock, advance, now: () => t };
}

describe('isFeatureIndexError', () => {
    it('känner igen motorns fel, som Error eller text', () => {
        expect(isFeatureIndexError(new Error(FEATURE_INDEX_ERROR))).toBe(true);
        expect(isFeatureIndexError(`Error: ${FEATURE_INDEX_ERROR}`)).toBe(true);
    });

    it('andra fel loggas som förut', () => {
        expect(isFeatureIndexError(new Error('Failed to fetch'))).toBe(false);
        expect(isFeatureIndexError(undefined)).toBe(false);
        expect(isFeatureIndexError({ message: FEATURE_INDEX_ERROR })).toBe(false);
    });
});

describe('createSourceHealer', () => {
    it('slår ihop en vågs alla trasiga kakel till en läkning', () => {
        const { clock, advance } = fakeClock();
        const healed: string[] = [];
        const request = createSourceHealer(id => healed.push(id), clock);
        expect(request('plain-events')).toBe(true);
        expect(request('plain-events')).toBe(false);
        expect(request('plain-events')).toBe(false);
        advance(HEAL_DEBOUNCE_MS - 1);
        expect(healed).toEqual([]);
        advance(1);
        expect(healed).toEqual(['plain-events']);
    });

    it('källorna läks var för sig', () => {
        const { clock, advance } = fakeClock();
        const healed: string[] = [];
        const request = createSourceHealer(id => healed.push(id), clock);
        request('plain-events');
        request('plain-events-front');
        advance(HEAL_DEBOUNCE_MS);
        expect(healed.sort()).toEqual(['plain-events', 'plain-events-front']);
    });

    it('återkommande fel bromsas allt hårdare men tappas aldrig', () => {
        const { clock, advance, now } = fakeClock();
        const healedAt: number[] = [];
        const request = createSourceHealer(() => healedAt.push(now()), clock);
        // Felet kommer tillbaka direkt efter varje läkning.
        for (let i = 0; i < 8; i++) {
            request('plain-events');
            advance(HEAL_COOLDOWN_MAX_MS + HEAL_DEBOUNCE_MS);
        }
        expect(healedAt).toHaveLength(8);
        const mellan = healedAt.slice(1).map((t, i) => t - healedAt[i]);
        for (const d of mellan) expect(d).toBeGreaterThanOrEqual(HEAL_COOLDOWN_MS);
    });

    it('fördubblar bromsen när felet kommer inom den, upp till taket', () => {
        const { clock, advance, now } = fakeClock();
        const healedAt: number[] = [];
        const request = createSourceHealer(() => healedAt.push(now()), clock);
        const tillNastaLakning = () => {
            const n = healedAt.length;
            while (healedAt.length === n) advance(50);
        };
        request('k');
        tillNastaLakning();
        const forvantat = [HEAL_COOLDOWN_MS];
        for (let i = 0; i < 7; i++) {
            // Nytt fel 100 ms efter läkningen.
            advance(100);
            request('k');
            tillNastaLakning();
        }
        const mellan = healedAt.slice(1).map((t, i) => t - healedAt[i]);
        let broms = HEAL_COOLDOWN_MS;
        for (let i = 1; i < mellan.length; i++) {
            broms = Math.min(broms * 2, HEAL_COOLDOWN_MAX_MS);
            forvantat.push(broms);
        }
        expect(mellan).toEqual(forvantat);
        expect(Math.max(...mellan)).toBe(HEAL_COOLDOWN_MAX_MS);
    });

    it('en lugn källa börjar om med kort broms', () => {
        const { clock, advance, now } = fakeClock();
        const healedAt: number[] = [];
        const request = createSourceHealer(() => healedAt.push(now()), clock);
        request('k');
        advance(HEAL_DEBOUNCE_MS);
        advance(100);
        request('k');
        advance(HEAL_COOLDOWN_MAX_MS);
        // Lugnt länge, sedan ett nytt fel: läks efter bara avstudsningen.
        advance(HEAL_COOLDOWN_MAX_MS);
        const fore = now();
        request('k');
        advance(HEAL_DEBOUNCE_MS);
        expect(healedAt[healedAt.length - 1] - fore).toBe(HEAL_DEBOUNCE_MS);
    });
});
