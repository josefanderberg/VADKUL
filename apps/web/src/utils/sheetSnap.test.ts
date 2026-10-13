import { describe, it, expect } from 'vitest';
import { sheetStops, nextStopAbove, nextStopBelow, snapUp, snapDown, snapRelease, projectedHeight, releaseVelocity } from './sheetSnap';

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

    it('ett långt drag hoppar två steg', () => {
        expect(snapUp(STOPS, 35, 85)).toBe(90);
        expect(snapUp(STOPS, 35, 60)).toBe(55);
    });

    it('hoppar vidare redan en fjärdedel förbi mellanstoppet (Josef 11/10)', () => {
        // 55 + 0,25 * (90 - 55) = 63,75 - långt före mittpunkten 72,5.
        expect(snapUp(STOPS, 35, 64)).toBe(90);
        expect(snapUp(STOPS, 35, 63)).toBe(55);
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

    it('hoppar vidare redan en fjärdedel förbi tapp-höjden', () => {
        // 55 - 0,25 * (55 - 35) = 50.
        expect(snapDown(STOPS, 90, 50)).toBe(35);
        expect(snapDown(STOPS, 90, 50.5)).toBe(55);
    });

    it('ett långt neddrag från taket stänger hela vägen (Josef 11/10)', () => {
        // Förbi default med en fjärdedel av dess höjd: 35 - 8,75 = 26,25.
        expect(snapDown(STOPS, 90, 26)).toBeNull();
        expect(snapDown(STOPS, 90, 27)).toBe(35);
        expect(snapDown(STOPS, 55, 20)).toBeNull();
    });
});

describe('projectedHeight / releaseVelocity (släppets fart)', () => {
    it('projicerar 100 ms framåt med tak på 15 vh', () => {
        expect(projectedHeight(50, 0.1)).toBeCloseTo(60);
        expect(projectedHeight(50, -0.1)).toBeCloseTo(40);
        expect(projectedHeight(50, 2)).toBe(65);
        expect(projectedHeight(50, -2)).toBe(35);
        expect(projectedHeight(50, 0)).toBe(50);
    });

    it('farten räknas ur de senaste 80 ms', () => {
        const prov = [{ t: 0, h: 30 }, { t: 100, h: 40 }, { t: 140, h: 44 }, { t: 180, h: 48 }];
        expect(releaseVelocity(prov, 180)).toBeCloseTo(0.1);
    });

    it('ett finger som stått still före släppet ger ingen fart', () => {
        expect(releaseVelocity([{ t: 0, h: 30 }, { t: 20, h: 40 }], 300)).toBe(0);
        expect(releaseVelocity([], 10)).toBe(0);
        expect(releaseVelocity([{ t: 5, h: 30 }], 10)).toBe(0);
    });
});

describe('snapRelease (fingerdraget, med kompaktläget 30/9)', () => {
    // Sträcket mellan tid/plats och arrangören når kanten vid 20 vh - det är
    // också kompaktstoppet (arrangören dold, titel + tid kvar).
    const EDGE = 20;
    const WITH_COMPACT = [EDGE, ...STOPS];

    it('sakta ner från default, släppt medan sträcket syns → kompaktläget', () => {
        expect(snapRelease(WITH_COMPACT, 35, 27, EDGE)).toBe(20);
        expect(snapRelease(WITH_COMPACT, 35, 20.5, EDGE)).toBe(20);
    });

    it('sträcket över kanten → stäng', () => {
        expect(snapRelease(WITH_COMPACT, 35, 19.5, EDGE)).toBeNull();
        expect(snapRelease(WITH_COMPACT, 35, 5, EDGE)).toBeNull();
    });

    it('från kompaktläget: darr studsar tillbaka, ett riktigt neddrag stänger', () => {
        expect(snapRelease(WITH_COMPACT, 20, 17, EDGE)).toBe(20);
        expect(snapRelease(WITH_COMPACT, 20, 12, EDGE)).toBeNull();
    });

    it('från kompaktläget uppåt → default', () => {
        expect(snapRelease(WITH_COMPACT, 20, 23, EDGE)).toBe(35);
    });

    it('ett kort ryck från default studsar tillbaka', () => {
        expect(snapRelease(WITH_COMPACT, 35, 31, EDGE)).toBe(35);
    });

    it('långt drag från taket landar på närmaste stopp, eller stänger under sträcket', () => {
        expect(snapRelease(WITH_COMPACT, 90, 24, EDGE)).toBe(20);
        expect(snapRelease(WITH_COMPACT, 90, 33, EDGE)).toBe(35);
        expect(snapRelease(WITH_COMPACT, 90, 10, EDGE)).toBeNull();
    });

    it('utan sträck (väljarlistan) avgör bara stoppen', () => {
        expect(snapRelease(STOPS, 35, 25, null)).toBeNull();
        expect(snapRelease(STOPS, 90, 40, null)).toBe(35);
    });

    it('ett snabbt drag uppåt hoppar förbi tapp-höjden', () => {
        // Släppt på 50 vh: stillastående → tapp-höjden, i fart → taket.
        expect(snapRelease(WITH_COMPACT, 35, 50, EDGE)).toBe(55);
        expect(snapRelease(WITH_COMPACT, 35, 50, EDGE, 6, 4, 0.2)).toBe(90);
    });

    it('ett snabbt drag nedåt från taket hoppar förbi tapp-höjden', () => {
        expect(snapRelease(WITH_COMPACT, 90, 52, EDGE)).toBe(55);
        expect(snapRelease(WITH_COMPACT, 90, 52, EDGE, 6, 4, -0.1)).toBe(35);
    });

    it('farten stänger aldrig ett kort ryck - darr-regeln står kvar', () => {
        expect(snapRelease(WITH_COMPACT, 35, 31, EDGE, 6, 4, -2)).toBe(35);
    });

    it('ett snabbt ryck nedåt från default landar i kompaktläget, inte stängt', () => {
        // Släppt på 28 vh med sträcket synligt: 28 - 10 = 18 → kompaktläget.
        // I högre fart 28 - 15 (projektionens tak) = 13, förbi kompaktstoppet
        // med en fjärdedel av dess höjd (20 - 5 = 15) → stäng.
        expect(snapRelease(WITH_COMPACT, 35, 28, EDGE, 6, 4, -0.1)).toBe(20);
        expect(snapRelease(WITH_COMPACT, 35, 28, EDGE, 6, 4, -0.2)).toBeNull();
    });
});
