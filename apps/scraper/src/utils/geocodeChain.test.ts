import { describe, it, expect, vi } from 'vitest';
import { firstPreciseHit, shouldMovePlace } from './geocodeChain';
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

    it('okänd precision (gammal cache) räknas som träff', async () => {
        expect((await firstPreciseHit(['x'], answers({ x: [1, 1, null] })))?.query).toBe('x');
        expect((await firstPreciseHit(['x'], answers({ x: [1, 1] as unknown as GeoHit })))?.query).toBe('x');
    });

    it('ortsmittpunkt stoppar inte kedjan: lokalen efter vinner (#247)', async () => {
        const geo = answers({
            'Storgatan 5, Gemla, Växjö': [56.86, 14.65, 'ort-centroid'],
            'Gemla bibliotek, Växjö': [56.861, 14.651, 'poi'],
        });
        const r = await firstPreciseHit(['Storgatan 5, Gemla, Växjö', 'Gemla bibliotek, Växjö', 'Växjö'], geo);
        expect(r?.query).toBe('Gemla bibliotek, Växjö');
    });

    it('ortsmittpunkt går före stadens mittpunkt, även när den kommer senare', async () => {
        const geo = answers({ a: [1, 1, 'stad-centroid'], b: [2, 2, 'ort-centroid'], c: [3, 3, 'ort-centroid'] });
        expect(await firstPreciseHit(['a', 'b', 'c'], geo)).toEqual({ hit: [2, 2, 'ort-centroid'], query: 'b' });
        expect(geo).toHaveBeenCalledTimes(3);
    });

    it('bara centroider → första centroiden; inga träffar → null', async () => {
        const geo = answers({ a: [1, 1, 'stad-centroid'], c: [3, 3, 'stad-centroid'] });
        expect(await firstPreciseHit(['a', 'b', 'c'], geo)).toEqual({ hit: [1, 1, 'stad-centroid'], query: 'a' });
        expect(await firstPreciseHit(['b'], geo)).toBeNull();
        expect(await firstPreciseHit([], geo)).toBeNull();
    });
});

describe('shouldMovePlace (#247: rättelser ska nå gamla event)', () => {
    const km = (a: number, b: number, c: number, d: number) => Math.hypot(a - c, b - d) * 100;   // grovt, räcker här

    it('uppåt i precision flyttar, nedåt aldrig', () => {
        expect(shouldMovePlace({ lat: 1, lng: 1, precision: 'stad-centroid' }, [1.001, 1, 'poi'], km)).toBe(true);
        expect(shouldMovePlace({ lat: 1, lng: 1, precision: 'stad-centroid' }, [1.3, 1, 'ort-centroid'], km)).toBe(true);
        expect(shouldMovePlace({ lat: 1, lng: 1, precision: 'ort-centroid' }, [1.3, 1, 'stad-centroid'], km)).toBe(false);
        expect(shouldMovePlace({ lat: 1, lng: 1, precision: 'poi' }, [1.3, 1, 'poi'], km)).toBe(false);
    });

    it('by mot by: bara bort från kommunmitt eller till registrets punkt (Röda Sten låg rätt)', () => {
        const rodaSten = { lat: 57.6891735, lng: 11.9016288, precision: 'ort-centroid' };
        expect(shouldMovePlace(rodaSten, [57.6037012, 11.8616753, 'ort-centroid'], km)).toBe(false);
        expect(shouldMovePlace(rodaSten, [57.6037012345678, 11.86167531234, 'ort-centroid'], km)).toBe(true);
        expect(shouldMovePlace({ lat: 56.416667, lng: 15.833333, precision: 'ort-centroid' }, [56.4443568, 15.8179628, 'ort-centroid'], km)).toBe(true);
    });

    it('samma rang: bara en annan punkt flyttar (kommunmitten → orten)', () => {
        expect(shouldMovePlace({ lat: 64.833, lng: 16.0, precision: 'stad-centroid' }, [64.624, 16.663, 'stad-centroid'], km)).toBe(true);
        expect(shouldMovePlace({ lat: 1, lng: 1, precision: 'stad-centroid' }, [1.001, 1, 'stad-centroid'], km)).toBe(false);
        expect(shouldMovePlace({ lat: 1, lng: 1, precision: 'stad-centroid' }, null, km)).toBe(false);
    });
});
