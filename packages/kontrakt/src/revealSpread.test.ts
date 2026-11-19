import { describe, expect, it } from 'vitest';
import { pickSpreadRevealKeys, REVEAL_SPREAD_CELL_PX, type SpreadCandidate } from './revealSpread';

const ZOOM = 11;
const GBG = { lat: 57.7089, lng: 11.9746 };
const VIEW = { width: 1440, height: 900 };

/** En punkt `dx`/`dy` skärmpixlar från `from` vid ZOOM (öster/söder positivt). */
function at(key: string, dx: number, dy: number, pop = false): SpreadCandidate {
    const world = 512 * 2 ** ZOOM;
    const lng = GBG.lng + (dx / world) * 360;
    const yc = 0.5 - Math.log((1 + Math.sin((GBG.lat * Math.PI) / 180)) / (1 - Math.sin((GBG.lat * Math.PI) / 180))) / (4 * Math.PI);
    const y = yc + dy / world;
    const lat = ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
    return { key, lat, lng, pop };
}

describe('pickSpreadRevealKeys', () => {
    it('sprider urvalet i stället för att ta allt ur den tätaste klungan', () => {
        // En tät, populär klunga uppe till höger + enstaka event runt om.
        const klunga = Array.from({ length: 60 }, (_, i) => at(`k${i}`, 400 + (i % 6) * 5, -300 + Math.floor(i / 6) * 5, true));
        const spridda = [at('a', -500, 300), at('b', 0, 0), at('c', -300, -200), at('d', 300, 250)];
        const keys = pickSpreadRevealKeys([...klunga, ...spridda], GBG, ZOOM, VIEW, 6);
        expect(keys).toHaveLength(6);
        expect(keys.filter(k => k.startsWith('k')).length).toBeLessThanOrEqual(2);
        for (const k of ['a', 'b', 'c', 'd']) expect(keys).toContain(k);
    });

    it('tar rutorna närmast mitten först när antalet inte räcker till alla', () => {
        const pts = [at('mitt', 10, 10), at('kant', 690, 430), at('nara', -200, 0)];
        expect(pickSpreadRevealKeys(pts, GBG, ZOOM, VIEW, 2).sort()).toEqual(['mitt', 'nara']);
    });

    it('populärast först inom sin ruta', () => {
        const pts = [at('vanlig', 2, 2), at('pop', 60, 60, true)];
        expect(pickSpreadRevealKeys(pts, GBG, ZOOM, VIEW, 1)).toEqual(['pop']);
    });

    it('tar ett varv till när alla rutor har fått sitt', () => {
        const pts = [at('a1', 5, 5), at('a2', 20, 20), at('b1', -400, 0)];
        expect(pickSpreadRevealKeys(pts, GBG, ZOOM, VIEW, 3).sort()).toEqual(['a1', 'a2', 'b1']);
    });

    it('räknar bara det som syns i vyn', () => {
        const pts = [at('inne', 0, 0), at('utanfor', VIEW.width, 0)];
        expect(pickSpreadRevealKeys(pts, GBG, ZOOM, VIEW, 5)).toEqual(['inne']);
    });

    it('tål tomt och skräp', () => {
        expect(pickSpreadRevealKeys([], GBG, ZOOM, VIEW, 5)).toEqual([]);
        expect(pickSpreadRevealKeys([at('a', 0, 0)], GBG, ZOOM, VIEW, 0)).toEqual([]);
        expect(pickSpreadRevealKeys([at('a', 0, 0)], GBG, NaN, VIEW, 5)).toEqual([]);
        expect(pickSpreadRevealKeys([{ key: 'x', lat: NaN, lng: 12, pop: false }], GBG, ZOOM, VIEW, 5)).toEqual([]);
        expect(REVEAL_SPREAD_CELL_PX).toBeGreaterThan(0);
    });

    it('rutorna sitter i kartan: en panorering byter inte urvalet', () => {
        const world = 512 * 2 ** ZOOM;
        const merc = (lat: number) => {
            const sn = Math.sin((lat * Math.PI) / 180);
            return 0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI);
        };
        const cx = ((GBG.lng + 180) / 360) * world;
        const cy = merc(GBG.lat) * world;
        const fromWorld = (key: string, ax: number, ay: number, pop: boolean): SpreadCandidate => ({
            key,
            pop,
            lng: (ax / world) * 360 - 180,
            lat: ((2 * Math.atan(Math.exp((0.5 - ay / world) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI,
        });
        // Fem kartrutor i rad: ett populärt event i vänsterkanten, ett vanligt i högerkanten.
        const c0 = Math.floor(cx / REVEAL_SPREAD_CELL_PX);
        const r0 = Math.floor(cy / REVEAL_SPREAD_CELL_PX);
        const pts: SpreadCandidate[] = [];
        for (let i = -2; i <= 2; i++) {
            const left = (c0 + i) * REVEAL_SPREAD_CELL_PX;
            const yMid = (r0 + 0.5) * REVEAL_SPREAD_CELL_PX;
            pts.push(fromWorld(`pop${i}`, left + 5, yMid, true));
            pts.push(fromWorld(`van${i}`, left + REVEAL_SPREAD_CELL_PX - 5, yMid, false));
        }
        const forst = pickSpreadRevealKeys(pts, GBG, ZOOM, VIEW, 5).sort();
        expect(forst).toEqual(['pop-1', 'pop-2', 'pop0', 'pop1', 'pop2']);
        for (const shift of [40, 90, 133]) {
            const flyttad = { lat: GBG.lat, lng: GBG.lng + (shift / world) * 360 };
            expect(pickSpreadRevealKeys(pts, flyttad, ZOOM, VIEW, 5).sort()).toEqual(forst);
        }
    });
});
