import { describe, expect, it } from 'vitest';
import {
    createSourceHealer, createTileRetrier, FEATURE_INDEX_ERROR, HEAL_COOLDOWN_MAX_MS, HEAL_COOLDOWN_MS,
    HEAL_DEBOUNCE_MS, isFeatureIndexError, isRetryableTileFetch, TILE_RETRY_DELAYS_MS, TILE_RETRY_RESET_MS,
    tileFetchStatus, type HealClock, type TileXYZ,
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

// Kakel som inte gick att hämta (#207). Samma form som MapLibres AJAXError.
function ajaxError(status: number, text = 'Failed to fetch', withStatus = true) {
    const url = 'https://tiles.basemaps.cartocdn.com/v/20261026-01/vectortiles/carto.streets/v2/11/1102/623.mvt';
    const err = new Error(`AJAXError: ${text} (${status}): ${url}`);
    if (withStatus) Object.assign(err, { status, statusText: text, url });
    return err;
}

describe('isRetryableTileFetch', () => {
    it('nätfel och tillfälligt överlastad server försöks igen', () => {
        expect(isRetryableTileFetch(ajaxError(0))).toBe(true);
        expect(isRetryableTileFetch(ajaxError(503, 'Service Unavailable'))).toBe(true);
        expect(isRetryableTileFetch(ajaxError(429, 'Too Many Requests'))).toBe(true);
        expect(isRetryableTileFetch(ajaxError(408, 'Request Timeout'))).toBe(true);
    });

    it('läser statusen ur meddelandet om fältet tappats på vägen från workern', () => {
        expect(tileFetchStatus(ajaxError(0, 'Failed to fetch', false))).toBe(0);
        expect(isRetryableTileFetch(ajaxError(502, 'Bad Gateway', false))).toBe(true);
    });

    it('bestående fel och andra fel försöks inte igen', () => {
        expect(isRetryableTileFetch(ajaxError(403, 'Forbidden'))).toBe(false);
        expect(isRetryableTileFetch(ajaxError(400, 'Bad Request'))).toBe(false);
        expect(isRetryableTileFetch(new Error(FEATURE_INDEX_ERROR))).toBe(false);
        expect(isRetryableTileFetch(new Error('Failed to fetch'))).toBe(false);
        expect(isRetryableTileFetch('AJAXError: Failed to fetch (0): x')).toBe(false);
    });
});

describe('createTileRetrier', () => {
    const KAKEL: TileXYZ = { x: 1102, y: 623, z: 11 };

    it('försöker igen efter en stund, högst två gånger, sedan ges kaklet upp', () => {
        const { clock, advance } = fakeClock();
        const forsok: string[] = [];
        const request = createTileRetrier((id, t) => forsok.push(`${id} ${t.z}/${t.x}/${t.y}`), clock);
        expect(request('protomaps', KAKEL)).toBe('retry');
        advance(TILE_RETRY_DELAYS_MS[0] - 1);
        expect(forsok).toEqual([]);
        advance(1);
        expect(forsok).toEqual(['protomaps 11/1102/623']);
        // Försöket föll igen.
        expect(request('protomaps', KAKEL)).toBe('retry');
        advance(TILE_RETRY_DELAYS_MS[1]);
        expect(forsok).toHaveLength(2);
        // Och en tredje gång: nu ges det upp.
        expect(request('protomaps', KAKEL)).toBe('gave-up');
        advance(TILE_RETRY_RESET_MS / 2);
        expect(forsok).toHaveLength(2);
    });

    it('slår ihop fel medan ett försök väntar', () => {
        const { clock, advance } = fakeClock();
        let n = 0;
        const request = createTileRetrier(() => { n++; }, clock);
        expect(request('protomaps', KAKEL)).toBe('retry');
        expect(request('protomaps', KAKEL)).toBe('pending');
        advance(TILE_RETRY_DELAYS_MS[0]);
        expect(n).toBe(1);
    });

    it('kaklen och källorna räknas var för sig', () => {
        const { clock } = fakeClock();
        const request = createTileRetrier(() => {}, clock);
        expect(request('protomaps', KAKEL)).toBe('retry');
        expect(request('protomaps', { ...KAKEL, x: 1103 })).toBe('retry');
        expect(request('plain-events', KAKEL)).toBe('retry');
    });

    it('ett kakel som fungerat en längre stund får nya försök', () => {
        const { clock, advance } = fakeClock();
        const request = createTileRetrier(() => {}, clock);
        request('protomaps', KAKEL);
        advance(TILE_RETRY_DELAYS_MS[0]);
        request('protomaps', KAKEL);
        advance(TILE_RETRY_DELAYS_MS[1]);
        expect(request('protomaps', KAKEL)).toBe('gave-up');
        advance(TILE_RETRY_RESET_MS + 1);
        expect(request('protomaps', KAKEL)).toBe('retry');
    });
});
