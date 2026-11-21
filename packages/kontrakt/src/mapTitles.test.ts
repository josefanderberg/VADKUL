import { describe, expect, it } from 'vitest';
import {
    bySideExpression,
    TITLE_PLACEMENTS,
    TITLE_PLACEMENTS_BY_SIDE,
    TITLE_SIDE_EDGE_PX,
    TITLE_SIDE_PROP,
    titleSide,
} from './mapTitles';

const nyckel = (ps: readonly (readonly [string, readonly [number, number]])[]) => ps.map(([a, [x, y]]) => `${a}:${x},${y}`);

describe('titlarnas lägen', () => {
    it('den vanliga ordningen är webbens #204: under först, sedan höger, vänster, över', () => {
        expect(TITLE_PLACEMENTS.map(([a]) => a)).toEqual([
            'top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right',
        ]);
        expect(TITLE_PLACEMENTS_BY_SIDE[0]).toBe(TITLE_PLACEMENTS);
    });

    it('varje sida har exakt samma åtta lägen, bara i annan ordning', () => {
        for (const ordning of TITLE_PLACEMENTS_BY_SIDE) {
            expect([...nyckel(ordning)].sort()).toEqual([...nyckel(TITLE_PLACEMENTS)].sort());
        }
    });

    it('vänstra delen: titeln växer åt höger först, under brickan överst', () => {
        const [första, andra, tredje] = TITLE_PLACEMENTS_BY_SIDE[1].map(([a]) => a);
        expect([första, andra, tredje]).toEqual(['top-left', 'left', 'bottom-left']);
    });

    it('högra delen: spegelvänt, titeln växer åt vänster först', () => {
        const [första, andra, tredje] = TITLE_PLACEMENTS_BY_SIDE[2].map(([a]) => a);
        expect([första, andra, tredje]).toEqual(['top-right', 'right', 'bottom-right']);
    });

    it('lägena som sträcker sig utåt kommer sist i kanterna', () => {
        expect(TITLE_PLACEMENTS_BY_SIDE[1].slice(-3).map(([a]) => a)).toEqual(['top-right', 'right', 'bottom-right']);
        expect(TITLE_PLACEMENTS_BY_SIDE[2].slice(-3).map(([a]) => a)).toEqual(['top-left', 'left', 'bottom-left']);
    });
});

describe('titleSide', () => {
    const W = 390;
    const kant = W / 2 - TITLE_SIDE_EDGE_PX;

    it('allt utom kantremsorna är mitten: raka lägen först (#270)', () => {
        expect(titleSide(0, W)).toBe(0);
        expect(titleSide(kant, W)).toBe(0);
        expect(titleSide(-kant, W)).toBe(0);
        // Förr (tredjedelsregeln i #262) var det här redan "höger".
        expect(titleSide(W / 6 + 1, W)).toBe(0);
    });

    it('i kantremsan växer titeln inåt', () => {
        expect(titleSide(-kant - 1, W)).toBe(1);
        expect(titleSide(kant + 1, W)).toBe(2);
        expect(titleSide(-W, W)).toBe(1);
    });

    it('på en bred skärm är remsan lika smal i pixlar', () => {
        expect(titleSide(-(1440 / 2 - TITLE_SIDE_EDGE_PX - 1), 1440)).toBe(0);
        expect(titleSide(-(1440 / 2 - TITLE_SIDE_EDGE_PX + 1), 1440)).toBe(1);
    });

    it('på en mycket smal bild möts remsorna aldrig', () => {
        expect(titleSide(0, 120)).toBe(0);
        expect(titleSide(-50, 120)).toBe(1);
        expect(titleSide(50, 120)).toBe(2);
    });

    it('okända mått ger mitten (den vanliga ordningen)', () => {
        expect(titleSide(NaN, W)).toBe(0);
        expect(titleSide(100, 0)).toBe(0);
    });
});

describe('bySideExpression', () => {
    it('ett match-uttryck på sidan med mitten som reserv', () => {
        const uttryck = bySideExpression(o => o[0][0]);
        expect(uttryck).toEqual(['match', ['coalesce', ['get', TITLE_SIDE_PROP], 0], 1, 'top-left', 2, 'top-right', 'top']);
    });
});
