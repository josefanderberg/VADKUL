import { describe, it, expect } from 'vitest';
import { sheetStops, nextStopAbove, nextStopBelow, snapUp, snapDown } from './sheetSnap';

// Typisk telefon: default 35 vh, tapp-höjden 55 vh, taket 90 vh.
const STOPS = [35, 55, 90];

describe('sheetStops', () => {
    it('sorterar stigande och avdubblerar stopp som ligger för nära', () => {
        expect(sheetStops([90, 35, 55])).toEqual([35, 55, 90]);
        // Tapp-höjden sammanfaller med taket (kort beskrivning) → ett stopp.
        expect(sheetStops([35, 88, 90])).toEqual([35, 88]);
        // …eller med default.
        expect(sheetStops([35, 37, 90])).toEqual([35, 90]);
    });

    it('släpper ogiltiga värden', () => {
        expect(sheetStops([35, NaN, 90])).toEqual([35, 90]);
    });
});

describe('nextStopAbove / nextStopBelow (hjulet, ett steg per gest)', () => {
    it('stegar upp genom stoppen och stannar på taket', () => {
        expect(nextStopAbove(STOPS, 35)).toBe(55);
        expect(nextStopAbove(STOPS, 55)).toBe(90);
        expect(nextStopAbove(STOPS, 90)).toBe(90);
    });

    it('strax under ett stopp räknas som redan där', () => {
        expect(nextStopAbove(STOPS, 52)).toBe(90);
        expect(nextStopAbove(STOPS, 50)).toBe(55);
    });

    it('stegar ner och slutar med null = stäng', () => {
        expect(nextStopBelow(STOPS, 90)).toBe(55);
        expect(nextStopBelow(STOPS, 55)).toBe(35);
        expect(nextStopBelow(STOPS, 35)).toBeNull();
        expect(nextStopBelow(STOPS, 38)).toBeNull();
    });
});

describe('snapUp (släpp efter uppåtdrag)', () => {
    it('ett kort ryck från default avancerar ett steg', () => {
        expect(snapUp(STOPS, 35, 37)).toBe(55);
    });

    it('ett långt drag landar på stoppet närmast fingret', () => {
        expect(snapUp(STOPS, 35, 85)).toBe(90);
        expect(snapUp(STOPS, 35, 60)).toBe(55);
    });

    it('vid lika avstånd vinner det högre', () => {
        expect(snapUp(STOPS, 35, 72.5)).toBe(90);
    });

    it('från taket (inget ovanför) blir det taket', () => {
        expect(snapUp(STOPS, 90, 90)).toBe(90);
        expect(snapUp(STOPS, 55, 58)).toBe(90);
    });
});

describe('snapDown (släpp efter nedåtdrag)', () => {
    it('från taket landar ett kort drag på tapp-höjden, ett långt på default', () => {
        expect(snapDown(STOPS, 90, 80)).toBe(55);
        expect(snapDown(STOPS, 90, 40)).toBe(35);
    });

    it('från tapp-höjden → default, från default → stäng', () => {
        expect(snapDown(STOPS, 55, 45)).toBe(35);
        expect(snapDown(STOPS, 35, 25)).toBeNull();
    });

    it('vid lika avstånd vinner det lägre', () => {
        expect(snapDown(STOPS, 90, 45)).toBe(35);
    });
});
