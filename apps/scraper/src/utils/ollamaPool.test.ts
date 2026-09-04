import { describe, it, expect } from 'vitest';
import { chunk, mapWithConcurrency, ollamaConcurrencyFrom } from './ollamaPool';

describe('ollamaConcurrencyFrom', () => {
    it('default 3 när env saknas eller är skräp', () => {
        expect(ollamaConcurrencyFrom(undefined)).toBe(3);
        expect(ollamaConcurrencyFrom('')).toBe(3);
        expect(ollamaConcurrencyFrom('abc')).toBe(3);
        expect(ollamaConcurrencyFrom('0')).toBe(3);
    });

    it('klampas till 1–8', () => {
        expect(ollamaConcurrencyFrom('1')).toBe(1);
        expect(ollamaConcurrencyFrom('5')).toBe(5);
        expect(ollamaConcurrencyFrom('50')).toBe(8);
    });
});

describe('chunk', () => {
    it('delar i bitar, sista kortare', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([], 3)).toEqual([]);
    });

    it('storlek < 1 blir 1', () => {
        expect(chunk(['a', 'b'], 0)).toEqual([['a'], ['b']]);
    });
});

describe('mapWithConcurrency', () => {
    it('bevarar ordningen även när snabba svar kommer först', async () => {
        const delays = [30, 5, 20, 1];
        const out = await mapWithConcurrency(delays, 4, async (d, i) => {
            await new Promise(r => setTimeout(r, d));
            return `${i}:${d}`;
        });
        expect(out).toEqual(['0:30', '1:5', '2:20', '3:1']);
    });

    it('kör aldrig fler än `concurrency` samtidigt', async () => {
        let inFlight = 0, peak = 0;
        await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
            inFlight++; peak = Math.max(peak, inFlight);
            await new Promise(r => setTimeout(r, 3));
            inFlight--;
        });
        expect(peak).toBe(3);
    });

    it('tom lista → tom lista', async () => {
        expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
    });
});
