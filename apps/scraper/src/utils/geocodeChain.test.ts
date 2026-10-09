import { describe, it, expect, vi } from 'vitest';
import { firstPreciseHit } from './geocodeChain';
import type { GeoHit } from './venueCoordinates';

const answers = (m: Record<string, GeoHit | null>) => vi.fn(async (q: string) => m[q] ?? null);

describe('firstPreciseHit', () => {
    it('första precisa träffen vinner och resten provas inte', async () => {
        const geo = answers({ a: [1, 1, 'poi'], b: [2, 2, 'poi'] });
        expect(await firstPreciseHit(['a', 'b'], geo)).toEqual({ hit: [1, 1, 'poi'], query: 'a' });
        expect(geo).toHaveBeenCalledTimes(1);
    });

    it('stadscentroid stoppar inte kedjan (Magasinsgatan 8, Växjö → Växjö Teater)', async () => {
        const geo = answers({
            'Magasinsgatan 8, Växjö': [56.8787, 14.8094, 'stad-centroid'],
            'Växjö Teater, Växjö': [56.87986, 14.80348, 'poi'],
        });
        const r = await firstPreciseHit(['Magasinsgatan 8, Växjö', 'Växjö Teater, Växjö', 'Växjö'], geo);
        expect(r?.query).toBe('Växjö Teater, Växjö');
        expect(geo).toHaveBeenCalledTimes(2);
    });

    it('ort-centroid och okänd precision räknas som träff (oförändrat beteende)', async () => {
        expect((await firstPreciseHit(['x'], answers({ x: [1, 1, 'ort-centroid'] })))?.hit[2]).toBe('ort-centroid');
        expect((await firstPreciseHit(['x'], answers({ x: [1, 1, null] })))?.query).toBe('x');
        expect((await firstPreciseHit(['x'], answers({ x: [1, 1] as unknown as GeoHit })))?.query).toBe('x');
    });

    it('bara centroider → första centroiden; inga träffar → null', async () => {
        const geo = answers({ a: [1, 1, 'stad-centroid'], c: [3, 3, 'stad-centroid'] });
        expect(await firstPreciseHit(['a', 'b', 'c'], geo)).toEqual({ hit: [1, 1, 'stad-centroid'], query: 'a' });
        expect(await firstPreciseHit(['b'], geo)).toBeNull();
        expect(await firstPreciseHit([], geo)).toBeNull();
    });
});
