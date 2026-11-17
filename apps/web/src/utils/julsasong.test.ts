import { describe, expect, it } from 'vitest';
import { förstaAdvent, ärJulsäsong } from './julsasong';

const d = (år: number, månad: number, dag: number, timme = 12) => new Date(år, månad - 1, dag, timme);

describe('förstaAdvent', () => {
    it('är fjärde söndagen före juldagen', () => {
        expect(förstaAdvent(2026)).toEqual(new Date(2026, 10, 29)); // 29 nov
        expect(förstaAdvent(2027)).toEqual(new Date(2027, 10, 28)); // 28 nov
        expect(förstaAdvent(2022)).toEqual(new Date(2022, 10, 27)); // juldagen en söndag
        expect(förstaAdvent(2024)).toEqual(new Date(2024, 11, 1)); // 1 dec
        expect(förstaAdvent(2025)).toEqual(new Date(2025, 10, 30)); // 30 nov
    });

    it('är alltid en söndag', () => {
        for (let år = 2020; år <= 2040; år++) expect(förstaAdvent(år).getDay()).toBe(0);
    });
});

describe('ärJulsäsong', () => {
    it('börjar första advent, inte mitten av november (Josef 17/11: "lite för tidigt")', () => {
        expect(ärJulsäsong(d(2026, 11, 17))).toBe(false);
        expect(ärJulsäsong(d(2026, 11, 28, 23))).toBe(false);
        expect(ärJulsäsong(d(2026, 11, 29, 0))).toBe(true);
        expect(ärJulsäsong(d(2024, 11, 30, 23))).toBe(false);
        expect(ärJulsäsong(d(2024, 12, 1, 0))).toBe(true);
    });

    it('gäller resten av december', () => {
        expect(ärJulsäsong(d(2026, 12, 24))).toBe(true);
        expect(ärJulsäsong(d(2026, 12, 31, 23))).toBe(true);
    });

    it('slutar efter trettondedag jul', () => {
        expect(ärJulsäsong(d(2027, 1, 1))).toBe(true);
        expect(ärJulsäsong(d(2027, 1, 6, 23))).toBe(true);
        expect(ärJulsäsong(d(2027, 1, 7, 0))).toBe(false);
    });

    it('är av resten av året', () => {
        expect(ärJulsäsong(d(2026, 6, 21))).toBe(false);
        expect(ärJulsäsong(d(2026, 10, 31))).toBe(false);
        expect(ärJulsäsong(d(2027, 2, 1))).toBe(false);
    });
});
