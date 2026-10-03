import { describe, it, expect } from 'vitest';
import { inSlice, sliceDestinations, sliceCards, buildDescBuckets } from './eventLayerSlices';
import { buildCardIndex, eventKey } from '@/utils/eventKey';
import { descBucketFor, DESC_BUCKETS } from '@/utils/eventTiles';

const dest = [
    { id: 'https://a.se/1', time: '2026-10-03T16:00:00.000Z', lat: 59.33, lng: 18.07 },   // Stockholm, idag
    { id: 'https://a.se/2', time: '2026-10-20T16:00:00.000Z', lat: 59.34, lng: 18.05 },   // Stockholm, bortom fönstret
    { id: 'https://b.se/3', time: '2026-10-03T18:00:00.000Z', lat: 57.71, lng: 11.97 },   // Göteborg, idag
    { id: 'https://c.se/4', time: '2026-10-03T18:00:00.000Z', lat: 0, lng: 0 },           // oplacerat
];
const win = { from: Date.parse('2026-10-02T22:00:00.000Z'), to: Date.parse('2026-10-16T21:59:59.999Z') };

describe('inSlice / sliceDestinations', () => {
    it('ruta + tidsfönster: bara stadens event inom fönstret', () => {
        expect(sliceDestinations(dest, { ...win, tile: '118_18' }).map((e) => e.id)).toEqual(['https://a.se/1']);
    });

    it('ruta utan tid = rutans hela tidslinje', () => {
        expect(sliceDestinations(dest, { tile: '118_18' }).map((e) => e.id)).toEqual(['https://a.se/1', 'https://a.se/2']);
    });

    it('tid utan ruta = hela landets fönster (dagens/fönstrets gamla beteende)', () => {
        expect(sliceDestinations(dest, win).map((e) => e.id)).toEqual(['https://a.se/1', 'https://b.se/3', 'https://c.se/4']);
    });

    it('oplacerade event hamnar aldrig i någon ruta', () => {
        expect(inSlice(dest[3], { tile: '0_0' })).toBe(false);
    });

    it('trasig tid faller ur ett tidsfönster', () => {
        expect(inSlice({ time: 'igår', lat: 59.33, lng: 18.07 }, win)).toBe(false);
    });
});

describe('sliceCards', () => {
    it('slankt format (h): följer destinations-slicen via hashen', () => {
        const cards = dest.map((e, i) => ({ h: eventKey(e.id), hostName: `Värd ${i}` }));
        const out = sliceCards(dest, buildCardIndex(cards), { ...win, tile: '118_18' });
        expect(out).toEqual([{ h: eventKey('https://a.se/1'), hostName: 'Värd 0' }]);
    });

    it('gammalt format (id) funkar likadant', () => {
        const cards = dest.map((e) => ({ id: e.id, hostName: 'X' }));
        expect(sliceCards(dest, buildCardIndex(cards), { tile: '115_11' }).map((c) => c.id)).toEqual(['https://b.se/3']);
    });

    it('event utan kort hoppas över (inget hål i arrayen)', () => {
        const cards = [{ h: eventKey('https://a.se/2'), coverImage: 'x' }];
        expect(sliceCards(dest, buildCardIndex(cards), { tile: '118_18' })).toEqual(cards);
    });
});

describe('buildDescBuckets', () => {
    it('varje beskrivning hamnar i sin hink och bara där', () => {
        const data: Record<string, string> = {};
        for (let i = 0; i < 2000; i++) data[`https://k.se/${i}`] = `Text ${i}`;
        const buckets = buildDescBuckets(data);
        expect(buckets).toHaveLength(DESC_BUCKETS);
        const total = buckets.reduce((n, b) => n + Object.keys(b).length, 0);
        expect(total).toBe(2000);
        const id = 'https://k.se/42';
        expect(buckets[descBucketFor(id)][id]).toBe('Text 42');
    });

    it('tomma beskrivningar skickas inte', () => {
        const buckets = buildDescBuckets({ 'https://k.se/x': '' });
        expect(buckets.every((b) => Object.keys(b).length === 0)).toBe(true);
    });
});
