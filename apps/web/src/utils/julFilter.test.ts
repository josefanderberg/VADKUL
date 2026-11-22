import { describe, expect, it } from 'vitest';
import { passesModeFilter } from './julFilter';

const jul = { title: 'Julmarknad på torget' };
const popJul = { title: 'Stora julkonserten', pop: true };
const pop = { title: 'Håkan Hellström', pop: true };
const vanlig = { title: 'Quiz på puben' };
const eget = { title: 'Brädspelskväll', userCreated: true };

describe('passesModeFilter', () => {
    it('inget läge på släpper igenom allt', () => {
        for (const e of [jul, popJul, pop, vanlig, eget]) expect(passesModeFilter(e, false, false)).toBe(true);
    });

    it('🔥 ensamt = populärregeln som förut', () => {
        expect(passesModeFilter(pop, true, false)).toBe(true);
        expect(passesModeFilter(popJul, true, false)).toBe(true);
        expect(passesModeFilter(jul, true, false)).toBe(false);
        expect(passesModeFilter(vanlig, true, false)).toBe(false);
        expect(passesModeFilter(eget, true, false)).toBe(true);
    });

    it('🎄 ensamt smalnar till julevent', () => {
        expect(passesModeFilter(jul, false, true)).toBe(true);
        expect(passesModeFilter(popJul, false, true)).toBe(true);
        expect(passesModeFilter(pop, false, true)).toBe(false);
        expect(passesModeFilter(vanlig, false, true)).toBe(false);
    });

    it('användarskapade event syns alltid, även i jul-läget', () => {
        expect(passesModeFilter(eget, false, true)).toBe(true);
    });

    it('🔥 + 🎄 är en union', () => {
        expect(passesModeFilter(jul, true, true)).toBe(true);
        expect(passesModeFilter(pop, true, true)).toBe(true);
        expect(passesModeFilter(popJul, true, true)).toBe(true);
        expect(passesModeFilter(vanlig, true, true)).toBe(false);
    });

    it('saknad titel är inte jul', () => {
        expect(passesModeFilter({}, false, true)).toBe(false);
        expect(passesModeFilter({ title: null }, false, true)).toBe(false);
    });
});
