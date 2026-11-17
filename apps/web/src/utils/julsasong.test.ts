import { describe, expect, it } from 'vitest';
import { ärJulsäsong } from './julsasong';

const d = (år: number, månad: number, dag: number, timme = 12) => new Date(år, månad - 1, dag, timme);

describe('ärJulsäsong', () => {
    it('börjar 15 november', () => {
        expect(ärJulsäsong(d(2026, 11, 14, 23))).toBe(false);
        expect(ärJulsäsong(d(2026, 11, 15, 0))).toBe(true);
    });

    it('gäller hela december', () => {
        expect(ärJulsäsong(d(2026, 12, 1))).toBe(true);
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
