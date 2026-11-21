import { describe, it, expect } from 'vitest';
import {
    buildSmokePuffs,
    smokeDirFor,
    SMOKE_BLOW_MS,
    SMOKE_GONE_MS,
    SMOKE_PUFF_COUNT,
    SMOKE_PUFF_MAX_MS,
    SMOKE_PUFF_MIN_MS,
    SMOKE_WAVE_MS,
} from './smokePuff';

// Tipset under stadsplattan blåses bort som ett rökmoln (#268).
const W = 126;
const H = 26;

describe('smokeDirFor', () => {
    it('blåset kommer från sidan man tryckte på', () => {
        expect(smokeDirFor(110, 100, W)).toBe(1);   // vänstra halvan → åt höger
        expect(smokeDirFor(210, 100, W)).toBe(-1);  // högra halvan → åt vänster
    });

    it('tangentbord eller okänd bredd blåser åt höger', () => {
        expect(smokeDirFor(null, 100, W)).toBe(1);
        expect(smokeDirFor(150, 100, 0)).toBe(1);
    });
});

describe('buildSmokePuffs', () => {
    it('samma moln varje gång', () => {
        expect(buildSmokePuffs(W, H, 1)).toEqual(buildSmokePuffs(W, H, 1));
        expect(buildSmokePuffs(W, H, 1)).toHaveLength(SMOKE_PUFF_COUNT);
    });

    it('alla puffar driver med blåset', () => {
        for (const dir of [1, -1] as const) {
            for (const p of buildSmokePuffs(W, H, dir)) {
                expect(Math.sign(p.dx)).toBe(dir);
                expect(Math.abs(p.dx)).toBeGreaterThanOrEqual(70);
            }
        }
    });

    it('puffarna lossnar ur hela pillen, inte ur en klump', () => {
        const xs = buildSmokePuffs(W, H, 1).map(p => p.x);
        expect(Math.min(...xs)).toBeLessThan(W * 0.2);
        expect(Math.max(...xs)).toBeGreaterThan(W * 0.8);
        for (const p of buildSmokePuffs(W, H, 1)) {
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(W);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(H);
        }
    });

    it('vågen går från sidan blåset kommer ifrån', () => {
        const right = buildSmokePuffs(W, H, 1);
        const first = right.reduce((a, b) => (a.delay <= b.delay ? a : b));
        const last = right.reduce((a, b) => (a.delay >= b.delay ? a : b));
        expect(first.x).toBeLessThan(last.x);

        const left = buildSmokePuffs(W, H, -1);
        const firstL = left.reduce((a, b) => (a.delay <= b.delay ? a : b));
        const lastL = left.reduce((a, b) => (a.delay >= b.delay ? a : b));
        expect(firstL.x).toBeGreaterThan(lastL.x);
    });

    it('röken stiger: de flesta puffarna driver uppåt', () => {
        const up = buildSmokePuffs(W, H, 1).filter(p => p.dy < 0).length;
        expect(up).toBeGreaterThan(SMOKE_PUFF_COUNT / 2);
    });

    it('allt är borta innan tipset avmonteras', () => {
        for (const p of buildSmokePuffs(W, H, -1)) {
            expect(p.delay).toBeLessThanOrEqual(SMOKE_WAVE_MS);
            expect(p.duration).toBeGreaterThanOrEqual(SMOKE_PUFF_MIN_MS);
            expect(p.duration).toBeLessThanOrEqual(SMOKE_PUFF_MAX_MS);
            expect(p.delay + p.duration).toBeLessThanOrEqual(SMOKE_GONE_MS);
            expect(p.scale).toBeGreaterThan(1);
            expect(p.opacity).toBeGreaterThan(0);
            expect(p.opacity).toBeLessThanOrEqual(1);
        }
        expect(SMOKE_BLOW_MS).toBeLessThanOrEqual(SMOKE_GONE_MS);
    });

    it('tål en pill utan mått', () => {
        expect(() => buildSmokePuffs(0, 0, 1)).not.toThrow();
    });
});
