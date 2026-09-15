import { describe, it, expect } from 'vitest';
import { buildMyEventRows } from './myEventRows';
import type { LinkEvent } from '@/types';

/** Fast "nu" så testerna aldrig blir tidsbomber. */
const NOW = Date.parse('2026-09-14T12:00:00.000Z');

const evt = (id: string, timeIso: string, over: Partial<LinkEvent> = {}): LinkEvent => ({
    id,
    url: '',
    title: id,
    time: new Date(timeIso),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    locationName: 'Testorten',
    lat: 59, lng: 17,
    hostName: 'Test',
    category: 'social',
    coverImage: '',
    description: '',
    attendees: 0,
    isLocationVerified: true,
    hasSpecificTime: true,
    userCreated: true,
    ...over,
} as LinkEvent);

/** Ett utvecklat serietillfälle som expandWeekly bygger dem. */
const occ = (baseId: string, timeIso: string, over: Partial<LinkEvent> = {}) =>
    evt(`${baseId}__${timeIso.slice(0, 10)}`, timeIso, { seriesId: baseId, repeatWeekly: true, ...over });

describe('buildMyEventRows — veckoserier', () => {
    it('en serie blir EN rad — nästa kommande tillfälle representerar', () => {
        const out = buildMyEventRows([
            occ('fre', '2026-09-18T15:00:00.000Z'),
            occ('fre', '2026-09-25T15:00:00.000Z'),
            occ('fre', '2026-10-02T15:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].evt.id).toBe('fre__2026-09-18');
        expect(out[0].docIds).toEqual(['fre']);
        expect(out[0].tag).toBe('Varje vecka');
    });

    it('redan passerade tillfällen väljs inte som representant', () => {
        const out = buildMyEventRows([
            occ('fre', '2026-09-11T15:00:00.000Z'),
            occ('fre', '2026-09-18T15:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].evt.id).toBe('fre__2026-09-18');
    });

    it('en helt passerad serie representeras av sitt SENASTE tillfälle', () => {
        const out = buildMyEventRows([
            occ('gammal', '2026-08-07T15:00:00.000Z'),
            occ('gammal', '2026-08-14T15:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].evt.id).toBe('gammal__2026-08-14');
    });

    it('varannan vecka syns på chippet', () => {
        const out = buildMyEventRows([
            occ('lor', '2026-09-19T15:00:00.000Z', { repeatIntervalWeeks: 2 }),
            occ('lor', '2026-10-03T15:00:00.000Z', { repeatIntervalWeeks: 2 }),
        ], NOW);
        expect(out[0].tag).toBe('Varannan vecka');
    });

    it('serie-fallback utan seriesId grupperar på id-stammen före "__"', () => {
        const out = buildMyEventRows([
            evt('bas__2026-09-18', '2026-09-18T15:00:00.000Z', { repeatWeekly: true }),
            evt('bas__2026-09-25', '2026-09-25T15:00:00.000Z', { repeatWeekly: true }),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].docIds).toEqual(['bas']);
    });
});

describe('buildMyEventRows — samma event inlagt flera gånger (Stobirk)', () => {
    // Fyra SEPARATA dokument, samma titel och plats, oregelbunden rytm och
    // olika klockslag — exakt så destilleribesöken ligger i Firestore.
    const stobirk = (id: string, timeIso: string) =>
        evt(id, timeIso, { title: 'Destilleribesök på Stobirk', locationName: 'Stobirk Spirits, Åkers Krutbruk', url: 'https://stobirk.se', isTip: true });

    it('slås ihop till EN rad med antal tillfällen och alla dokument-id', () => {
        const out = buildMyEventRows([
            stobirk('a', '2026-09-19T15:00:00.000Z'),
            stobirk('c', '2026-10-17T11:00:00.000Z'),
            stobirk('b', '2026-10-03T11:00:00.000Z'),
            stobirk('d', '2026-11-14T12:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].evt.id).toBe('a');           // nästa kommande
        expect(out[0].count).toBe(4);
        expect(out[0].tag).toBe('4 tillfällen');
        expect(out[0].docIds).toEqual(['a', 'b', 'c', 'd']); // i tidsordning
    });

    it('samma titel på OLIKA platser är olika event', () => {
        const out = buildMyEventRows([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Loppis', locationName: 'Åkers Krutbruk' }),
            evt('y', '2026-09-20T15:00:00.000Z', { title: 'Loppis', locationName: 'Strängnäs' }),
        ], NOW);
        expect(out).toHaveLength(2);
    });

    it('olika titlar på samma plats är olika event', () => {
        const out = buildMyEventRows([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Loppis' }),
            evt('y', '2026-09-20T15:00:00.000Z', { title: 'Pubquiz' }),
        ], NOW);
        expect(out).toHaveLength(2);
    });

    it('titel-/platsmatchningen struntar i skiftläge och extra blanksteg', () => {
        const out = buildMyEventRows([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Höstloppis  i  Arboga', locationName: 'Torget' }),
            evt('y', '2026-09-26T15:00:00.000Z', { title: 'höstloppis i arboga', locationName: ' Torget ' }),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].count).toBe(2);
    });

    it('utan platsnamn faller nyckeln tillbaka på koordinaten', () => {
        const out = buildMyEventRows([
            evt('x', '2026-09-19T15:00:00.000Z', { title: 'Grillkväll', locationName: '' }),
            evt('y', '2026-09-26T15:00:00.000Z', { title: 'Grillkväll', locationName: '', lat: 60, lng: 17 }),
        ], NOW);
        expect(out).toHaveLength(2);
    });
});

describe('buildMyEventRows — vanliga event', () => {
    it('engångsevent passerar orörda, utan chip, i tidsordning', () => {
        const out = buildMyEventRows([
            occ('lor', '2026-09-19T16:00:00.000Z'),
            evt('engangs', '2026-09-17T18:00:00.000Z'),
            occ('lor', '2026-09-26T16:00:00.000Z'),
            occ('fre', '2026-09-18T15:00:00.000Z'),
        ], NOW);
        expect(out.map(r => r.evt.id)).toEqual(['engangs', 'fre__2026-09-18', 'lor__2026-09-19']);
        expect(out[0].tag).toBeUndefined();
        expect(out[0].count).toBe(1);
        expect(out[0].docIds).toEqual(['engangs']);
    });

    it('tom lista ger tom lista', () => {
        expect(buildMyEventRows([], NOW)).toEqual([]);
    });
});
