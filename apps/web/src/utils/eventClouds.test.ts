import { describe, expect, it } from 'vitest';
import {
    CLOUD_FULL_ZOOM,
    CLOUD_GONE_ZOOM,
    CLOUD_MAX_LEVEL,
    CLOUD_MAX_OPACITY,
    CLOUD_MIN_LEVEL,
    PUSH_MARGIN_PX,
    buildClouds,
    cloudLevelFor,
    cloudOpacityForZoom,
    cloudScaleFor,
    pushOffset,
} from './eventClouds';

const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };
const GOTEBORG = { lat: 57.7089, lng: 11.9746 };

describe('cloudOpacityForZoom', () => {
    it('står fullt framme i Sverige-vyn', () => {
        expect(cloudOpacityForZoom(4)).toBeCloseTo(CLOUD_MAX_OPACITY);
        expect(cloudOpacityForZoom(CLOUD_FULL_ZOOM)).toBeCloseTo(CLOUD_MAX_OPACITY);
    });

    it('är helt borta i stadsvyn', () => {
        expect(cloudOpacityForZoom(CLOUD_GONE_ZOOM)).toBe(0);
        expect(cloudOpacityForZoom(10.5)).toBe(0);
        expect(cloudOpacityForZoom(15)).toBe(0);
    });

    it('tunnas ut jämnt på vägen in', () => {
        let prev = cloudOpacityForZoom(CLOUD_FULL_ZOOM);
        for (let z = CLOUD_FULL_ZOOM + 0.25; z <= CLOUD_GONE_ZOOM; z += 0.25) {
            const o = cloudOpacityForZoom(z);
            expect(o).toBeLessThan(prev);
            prev = o;
        }
    });

    it('tål skräpvärden', () => {
        expect(cloudOpacityForZoom(NaN)).toBe(0);
    });
});

describe('cloudLevelFor', () => {
    it('avrundar zoomen och håller sig inom gränserna', () => {
        expect(cloudLevelFor(5.2)).toBe(5);
        expect(cloudLevelFor(5.6)).toBe(6);
        expect(cloudLevelFor(2)).toBe(CLOUD_MIN_LEVEL);
        expect(cloudLevelFor(16)).toBe(CLOUD_MAX_LEVEL);
    });

    it('fladdrar inte mellan två nivåer vid halvsteget', () => {
        expect(cloudLevelFor(5.55, 5)).toBe(5);
        expect(cloudLevelFor(5.45, 6)).toBe(6);
        expect(cloudLevelFor(5.7, 5)).toBe(6);
        expect(cloudLevelFor(7.4, 5)).toBe(7);
    });
});

describe('cloudScaleFor', () => {
    it('är 1 på molnets egen nivå och dubblas per zoomsteg', () => {
        expect(cloudScaleFor(6, 6)).toBe(1);
        expect(cloudScaleFor(7, 6)).toBe(2);
        expect(cloudScaleFor(5.5, 6)).toBeCloseTo(Math.SQRT1_2);
    });
});

describe('buildClouds', () => {
    it('ger ett moln per plats med event, i eventens tyngdpunkt', () => {
        const clouds = buildClouds([STOCKHOLM, STOCKHOLM, GOTEBORG], 5);
        expect(clouds).toHaveLength(2);
        const sthlm = clouds.find(c => c.count === 2)!;
        expect(sthlm.lat).toBeCloseTo(STOCKHOLM.lat);
        expect(sthlm.lng).toBeCloseTo(STOCKHOLM.lng);
    });

    it('gör molnen större och tätare där eventen är fler', () => {
        const many = Array.from({ length: 200 }, () => STOCKHOLM);
        const clouds = buildClouds([...many, GOTEBORG], 5);
        const big = clouds.find(c => c.count === 200)!;
        const small = clouds.find(c => c.count === 1)!;
        expect(big.radius).toBeGreaterThan(small.radius);
        expect(big.alpha).toBeGreaterThan(small.alpha);
        expect(big.alpha).toBeLessThanOrEqual(1);
        // Tätast sist = överst i ritordningen.
        expect(clouds[clouds.length - 1]).toBe(big);
    });

    it('delar upp samma stad i fler moln på högre nivå', () => {
        const spread = Array.from({ length: 40 }, (_, i) => ({
            lat: 59.2 + (i % 8) * 0.03,
            lng: 17.8 + Math.floor(i / 8) * 0.08,
        }));
        expect(buildClouds(spread, 9).length).toBeGreaterThan(buildClouds(spread, 5).length);
    });

    it('hoppar över oplacerade och ogiltiga punkter', () => {
        const clouds = buildClouds(
            [{ lat: 0, lng: 0 }, { lat: NaN, lng: 18 }, { lat: 59, lng: Infinity }, STOCKHOLM],
            6,
        );
        expect(clouds).toHaveLength(1);
        expect(clouds[0].count).toBe(1);
    });

    it('ger samma moln samma nyckel och form när listan fylls på', () => {
        const a = buildClouds([STOCKHOLM], 6)[0];
        const b = buildClouds([STOCKHOLM, STOCKHOLM, GOTEBORG], 6).find(c => c.count === 2)!;
        expect(b.id).toBe(a.id);
        expect(b.seed).toBe(a.seed);
        expect(a.seed).toBeGreaterThanOrEqual(0);
        expect(a.seed).toBeLessThan(1);
    });
});

describe('pushOffset', () => {
    it('rör inte moln utanför räckvidden', () => {
        expect(pushOffset(500, 0, 0, 0, 40)).toEqual({ x: 0, y: 0, fade: 0 });
        expect(pushOffset(40 + PUSH_MARGIN_PX, 0, 0, 0, 40)).toEqual({ x: 0, y: 0, fade: 0 });
    });

    it('knuffar rakt bort från pekaren', () => {
        const right = pushOffset(60, 0, 0, 0, 40);
        expect(right.x).toBeGreaterThan(0);
        expect(right.y).toBeCloseTo(0);
        const up = pushOffset(0, -60, 0, 0, 40);
        expect(up.y).toBeLessThan(0);
        expect(up.x).toBeCloseTo(0);
    });

    it('knuffar mer och tunnar ut mer ju närmare pekaren står', () => {
        const near = pushOffset(20, 0, 0, 0, 40);
        const far = pushOffset(120, 0, 0, 0, 40);
        expect(near.x).toBeGreaterThan(far.x);
        expect(near.fade).toBeGreaterThan(far.fade);
        expect(near.fade).toBeLessThan(1);
    });

    it('väljer en riktning när pekaren står mitt på molnet', () => {
        const hit = pushOffset(10, 10, 10, 10, 40);
        expect(hit.y).toBeLessThan(0);
        expect(Number.isFinite(hit.x)).toBe(true);
    });
});
