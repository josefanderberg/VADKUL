import { describe, it, expect } from 'vitest';
import { parseMapFilter, serializeMapFilter, MAP_FILTER_MAX_AGE_MS } from './mapFilter';

const NOW = 1_790_000_000_000;

describe('parseMapFilter', () => {
    it('tolkar ett sparat flerval', () => {
        const raw = serializeMapFilter({ kats: ['music', 'sport'], pop: false }, NOW);
        expect(parseMapFilter(raw, NOW)).toEqual({ kats: ['music', 'sport'], pop: false });
    });

    it('tolkar 🔥-läget utan kategorier', () => {
        const raw = serializeMapFilter({ kats: [], pop: true }, NOW);
        expect(parseMapFilter(raw, NOW)).toEqual({ kats: [], pop: true });
    });

    it('ger null för null/skräp/fel typ', () => {
        expect(parseMapFilter(null, NOW)).toBeNull();
        expect(parseMapFilter('inte json', NOW)).toBeNull();
        expect(parseMapFilter('42', NOW)).toBeNull();
        expect(parseMapFilter('"str"', NOW)).toBeNull();
        expect(parseMapFilter(JSON.stringify({ kats: ['music'] }), NOW)).toBeNull(); // saknar savedAt
    });

    it('filtrerar bort okända kategorinycklar', () => {
        const raw = JSON.stringify({ kats: ['music', 'finnsinte', 7], pop: false, savedAt: NOW });
        expect(parseMapFilter(raw, NOW)).toEqual({ kats: ['music'], pop: false });
    });

    it('ger null när bara okända nycklar finns kvar och 🔥 är av', () => {
        const raw = JSON.stringify({ kats: ['finnsinte'], pop: false, savedAt: NOW });
        expect(parseMapFilter(raw, NOW)).toBeNull();
    });

    it('ger null för tomt filter (inget att återställa)', () => {
        const raw = JSON.stringify({ kats: [], pop: false, savedAt: NOW });
        expect(parseMapFilter(raw, NOW)).toBeNull();
    });

    it('respekterar månadsgränsen', () => {
        const raw = serializeMapFilter({ kats: ['music'], pop: false }, NOW);
        expect(parseMapFilter(raw, NOW + MAP_FILTER_MAX_AGE_MS - 1)).not.toBeNull();
        expect(parseMapFilter(raw, NOW + MAP_FILTER_MAX_AGE_MS + 1)).toBeNull();
    });

    it('pop måste vara exakt true', () => {
        const raw = JSON.stringify({ kats: ['music'], pop: 'ja', savedAt: NOW });
        expect(parseMapFilter(raw, NOW)).toEqual({ kats: ['music'], pop: false });
    });
});
