import { describe, expect, it } from 'vitest';
import {
    CLOUD_FULL_ZOOM,
    CLOUD_GONE_ZOOM,
    CLOUD_MAX_LEVEL,
    CLOUD_MAX_OPACITY,
    CLOUD_MIN_LEVEL,
    CLOUD_PRESENCE,
    CLOUD_REVEAL_MAX,
    CLOUD_REVEAL_RADIUS_PX,
    PUSH_MARGIN_PX,
    buildClouds,
    cloudClearAt,
    CLOUD_CLEAR_AT,
    CLOUD_CLEAR_LEVEL,
    cloudLevelFor,
    cloudOpacityForZoom,
    cloudScaleFor,
    glideStep,
    GLIDE_MAX_SPEED,
    pickCloudRevealKeys,
    pushOffset,
    type CloudRevealPoint,
    type CloudView,
} from './eventClouds';

const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };
const GOTEBORG = { lat: 57.7089, lng: 11.9746 };

describe('cloudOpacityForZoom', () => {
    it('står fullt framme i Sverige-vyn', () => {
        expect(cloudOpacityForZoom(4)).toBeCloseTo(CLOUD_MAX_OPACITY);
        expect(cloudOpacityForZoom(CLOUD_FULL_ZOOM)).toBeCloseTo(CLOUD_MAX_OPACITY);
    });

    it('syns svagt vid stadslandningen och är helt borta längre in', () => {
        expect(cloudOpacityForZoom(10.5)).toBeGreaterThan(0);
        expect(cloudOpacityForZoom(10.5)).toBeLessThan(CLOUD_MAX_OPACITY);
        expect(cloudOpacityForZoom(CLOUD_GONE_ZOOM)).toBe(0);
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
    // Södra Sverige med omnejd: Göteborg i väst, Stockholm i öst, hav runt om.
    const SODRA: CloudView = { west: 10, south: 55, east: 20, north: 61 };
    /** Är punkten inom `km` från platsen? (grovt, räcker för testerna) */
    const near = (c: { lat: number; lng: number }, p: { lat: number; lng: number }, km: number) =>
        Math.hypot((c.lat - p.lat) * 111, (c.lng - p.lng) * 111 * Math.cos((p.lat * Math.PI) / 180)) < km;
    const city = (p: { lat: number; lng: number }, n: number) =>
        Array.from({ length: n }, (_, i) => ({ lat: p.lat + ((i % 10) - 5) * 0.01, lng: p.lng + (Math.floor(i / 10) - 5) * 0.02 }));

    it('lägger moln över glesa trakter och klart väder där eventen finns', () => {
        const clouds = buildClouds([...city(STOCKHOLM, 200), ...city(GOTEBORG, 120)], 7, SODRA);
        expect(clouds.length).toBeGreaterThan(20);
        // Inget moln mitt över städerna.
        expect(clouds.filter(c => near(c, STOCKHOLM, 20))).toEqual([]);
        expect(clouds.filter(c => near(c, GOTEBORG, 20))).toEqual([]);
    });

    it('utan event alls blir det trasiga moln, inte ett täcke', () => {
        const view: CloudView = { west: 14, south: 57, east: 18, north: 59 };
        const clouds = buildClouds([], 7, view);
        const cellsPerWorld = (512 * 2 ** 7) / 88;
        const merc = (lat: number) => {
            const s2 = Math.sin((lat * Math.PI) / 180);
            return 0.5 - Math.log((1 + s2) / (1 - s2)) / (4 * Math.PI);
        };
        const cols = Math.floor(((view.east + 180) / 360) * cellsPerWorld) - Math.floor(((view.west + 180) / 360) * cellsPerWorld) + 1;
        const rows = Math.floor(merc(view.south) * cellsPerWorld) - Math.floor(merc(view.north) * cellsPerWorld) + 1;
        const share = clouds.length / (cols * rows);
        expect(share).toBeGreaterThan(CLOUD_PRESENCE - 0.2);
        expect(share).toBeLessThan(CLOUD_PRESENCE + 0.2);
    });

    it('glest ger tunnare moln än tomt, och kanten av en stad är klarare än ödemarken', () => {
        const tomt = buildClouds([], 7, SODRA);
        const glest = buildClouds([{ lat: 57.3, lng: 15.2 }], 7, SODRA);
        const avg = (cs: { alpha: number }[]) => cs.reduce((a, c) => a + c.alpha, 0) / Math.max(1, cs.length);
        const runt = (cs: ReturnType<typeof buildClouds>) => cs.filter(c => near(c, { lat: 57.3, lng: 15.2 }, 60));
        expect(runt(glest).length).toBeLessThanOrEqual(runt(tomt).length);
        if (runt(glest).length > 0) expect(avg(runt(glest))).toBeLessThan(avg(runt(tomt)));
    });

    it('utzoomat får glesbygd med några event moln, men storstaden är klar', () => {
        const norrland: { lat: number; lng: number }[] = [];
        for (let la = 62; la <= 64; la += 0.8) for (let lo = 14; lo <= 18; lo += 1.2) {
            for (let i = 0; i < 4; i++) norrland.push({ lat: la + i * 0.01, lng: lo });
        }
        const view: CloudView = { west: 12, south: 58, east: 20, north: 65 };
        const clouds = buildClouds([...city(STOCKHOLM, 400), ...norrland], 5, view);
        // Moln även i rutor som HAR event - inte bara i de tomma emellan.
        expect(clouds.filter(c => c.lat > 61.5 && c.count > 0).length).toBeGreaterThan(0);
        expect(clouds.filter(c => near(c, STOCKHOLM, 40))).toEqual([]);
    });

    it('inzoomat lite tjockare moln än utzoomat', () => {
        const view: CloudView = { west: 15, south: 57, east: 16, north: 58 };
        const avg = (cs: { alpha: number }[]) => cs.reduce((a, c) => a + c.alpha, 0) / cs.length;
        expect(avg(buildClouds([], 9, view))).toBeGreaterThan(avg(buildClouds([], 6, view)));
    });

    it('fyller bara vyn', () => {
        const clouds = buildClouds([], 7, { west: 15, south: 57, east: 16, north: 58 });
        expect(clouds.length).toBeGreaterThan(0);
        for (const c of clouds) {
            expect(c.lng).toBeGreaterThan(14.6);
            expect(c.lng).toBeLessThan(16.4);
            expect(c.lat).toBeGreaterThan(56.7);
            expect(c.lat).toBeLessThan(58.3);
        }
    });

    it('hoppar över oplacerade och ogiltiga punkter', () => {
        const skrap = [{ lat: 0, lng: 0 }, { lat: NaN, lng: 18 }, { lat: 59, lng: Infinity }];
        expect(buildClouds(skrap, 7, SODRA)).toEqual(buildClouds([], 7, SODRA));
    });

    it('ger samma moln samma nyckel och form, och event långt bort rör dem inte', () => {
        const a = buildClouds([], 7, SODRA);
        const b = buildClouds(city(GOTEBORG, 50), 7, SODRA);
        const fjärran = a.filter(c => near(c, { lat: 60.3, lng: 19.5 }, 80));
        expect(fjärran.length).toBeGreaterThan(0);
        for (const c of fjärran) expect(b.find(x => x.id === c.id)).toEqual(c);
        for (const c of a) {
            expect(c.seed).toBeGreaterThanOrEqual(0);
            expect(c.seed).toBeLessThan(1);
            expect(c.alpha).toBeLessThanOrEqual(1);
            expect(c.extra).toBeGreaterThanOrEqual(0);
            expect(c.extra).toBeLessThanOrEqual(2);
        }
    });

    it('tätast sist = överst i ritordningen', () => {
        const clouds = buildClouds([], 7, SODRA);
        for (let i = 1; i < clouds.length; i++) expect(clouds[i].alpha).toBeGreaterThanOrEqual(clouds[i - 1].alpha);
    });

    it('bygger inget för en ofantlig vy eller skräpvy', () => {
        expect(buildClouds([], 10, { west: -180, south: -80, east: 180, north: 80 })).toEqual([]);
        expect(buildClouds([], 7, { west: NaN, south: 55, east: 20, north: 61 })).toEqual([]);
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

/** En punkt `px` skärmpixlar öster om `from` vid zoomen `zoom`. */
function eastOf(from: { lat: number; lng: number }, px: number, zoom: number) {
    return { lat: from.lat, lng: from.lng + (px / (512 * Math.pow(2, zoom))) * 360 };
}

describe('pickCloudRevealKeys', () => {
    const zoom = 5;
    const pt = (key: string, px: number, pop = false): CloudRevealPoint => ({ key, pop, ...eastOf(STOCKHOLM, px, zoom) });

    it('tänder bara det som ligger i hålet', () => {
        const points = [pt('nära', 20), pt('kanten', CLOUD_REVEAL_RADIUS_PX - 2), pt('utanför', CLOUD_REVEAL_RADIUS_PX + 5)];
        expect(pickCloudRevealKeys(points, STOCKHOLM, zoom, CLOUD_REVEAL_RADIUS_PX, CLOUD_REVEAL_MAX))
            .toEqual(['nära', 'kanten']);
    });

    it('ett hål i havet tänder ingenting, inte ens de närmaste långt bort', () => {
        const havet = eastOf(STOCKHOLM, 600, zoom);
        const points = [pt('a', 0), pt('b', 30), { key: 'gbg', pop: true, ...GOTEBORG }];
        expect(pickCloudRevealKeys(points, havet, zoom, CLOUD_REVEAL_RADIUS_PX, CLOUD_REVEAL_MAX)).toEqual([]);
    });

    it('tar de närmaste pekaren, inte de populäraste i hålet', () => {
        const points = [pt('n1', 5), pt('n2', 10), pt('pop-langre', 80, true), pt('n3', 15)];
        expect(pickCloudRevealKeys(points, STOCKHOLM, zoom, CLOUD_REVEAL_RADIUS_PX, 3))
            .toEqual(['n1', 'n2', 'n3']);
    });

    it('tänder bara några få när man hovrar, inte en hel stad', () => {
        const many = Array.from({ length: 40 }, (_, i) => pt(`e${i}`, i));
        expect(pickCloudRevealKeys(many, STOCKHOLM, zoom, CLOUD_REVEAL_RADIUS_PX, CLOUD_REVEAL_MAX))
            .toEqual(['e0', 'e1', 'e2']);
        expect(CLOUD_REVEAL_MAX).toBeLessThanOrEqual(5);
    });

    it('radien räknas i skärmpixlar, så samma plats är utanför vid högre zoom', () => {
        const nära = { key: 'x', pop: false, ...eastOf(STOCKHOLM, 50, zoom) };
        expect(pickCloudRevealKeys([nära], STOCKHOLM, zoom, CLOUD_REVEAL_RADIUS_PX, 50)).toEqual(['x']);
        expect(pickCloudRevealKeys([nära], STOCKHOLM, zoom + 1, CLOUD_REVEAL_RADIUS_PX, 50)).toEqual(['x']);
        expect(pickCloudRevealKeys([nära], STOCKHOLM, zoom + 2, CLOUD_REVEAL_RADIUS_PX, 50)).toEqual([]);
    });

    it('noll radie eller noll max ger ingenting', () => {
        expect(pickCloudRevealKeys([pt('a', 0)], STOCKHOLM, zoom, 0, 50)).toEqual([]);
        expect(pickCloudRevealKeys([pt('a', 0)], STOCKHOLM, zoom, CLOUD_REVEAL_RADIUS_PX, 0)).toEqual([]);
    });
});

describe('cloudClearAt', () => {
    it('är den fasta gränsen inzoomat och växer per nivå utåt', () => {
        expect(cloudClearAt(CLOUD_CLEAR_LEVEL)).toBe(CLOUD_CLEAR_AT);
        expect(cloudClearAt(CLOUD_CLEAR_LEVEL + 2)).toBe(CLOUD_CLEAR_AT);
        expect(cloudClearAt(7)).toBeGreaterThan(cloudClearAt(8));
        expect(cloudClearAt(5)).toBeGreaterThan(cloudClearAt(7));
        // Sverige-vyn: tiotals event innan en ruta är helt klar.
        expect(cloudClearAt(5)).toBeGreaterThan(30);
    });
});

describe('glideStep', () => {
    const still = { ox: 0, oy: 0, vx: 0, vy: 0 };
    const run = (g: typeof still, pushers: { x: number; y: number }[], steps: number, scale = 1) => {
        for (let i = 0; i < steps; i++) g = glideStep(g, 100 + g.ox * scale, 100 + g.oy * scale, pushers, 40, scale, 16);
        return g;
    };

    it('glider bort från pekaren', () => {
        const g = run(still, [{ x: 80, y: 100 }], 30);
        expect(g.ox).toBeGreaterThan(20);
        expect(Math.abs(g.oy)).toBeLessThan(1);
    });

    it('stannar där den hamnar - fjädrar inte tillbaka när pekaren går', () => {
        const knuffad = run(still, [{ x: 80, y: 100 }], 30);
        const efter = run(knuffad, [], 200);
        expect(efter.ox).toBeGreaterThanOrEqual(knuffad.ox);
        expect(efter.vx).toBe(0);
        expect(efter.vy).toBe(0);
    });

    it('rör inte moln utom räckhåll', () => {
        expect(run(still, [{ x: 900, y: 900 }], 20)).toEqual(still);
    });

    it('förskjutningen räknas på molnets nivå, så den följer med vid zoom', () => {
        const a = glideStep(still, 100, 100, [{ x: 90, y: 100 }], 40, 1, 16);
        const b = glideStep(still, 100, 100, [{ x: 90, y: 100 }], 40, 2, 16);
        expect(b.vx).toBeCloseTo(a.vx);
        expect(b.ox).toBeCloseTo(a.ox / 2);
    });

    it('har en högsta fart', () => {
        let g = still;
        for (let i = 0; i < 60; i++) g = glideStep(g, 100, 100, [{ x: 99, y: 100 }], 40, 1, 16);
        expect(Math.hypot(g.vx, g.vy)).toBeLessThanOrEqual(GLIDE_MAX_SPEED);
    });

    it('tål noll tid och skräp', () => {
        expect(glideStep(still, 100, 100, [{ x: 90, y: 100 }], 40, 1, 0)).toBe(still);
        expect(glideStep(still, 100, 100, [{ x: 90, y: 100 }], 40, 0, 16)).toBe(still);
    });
});
