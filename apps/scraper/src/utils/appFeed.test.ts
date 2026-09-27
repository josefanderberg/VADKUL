import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { eventKey } from './eventKey';
import { parseCities, nearestRegion, buildAppFeeds } from './appFeed';

describe('parseCities mot RIKTIGA kontrakt/cities.ts', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../../packages/kontrakt/src/cities.ts'), 'utf-8');
    const cities = parseCities(src);

    it('läser hela stadslistan (formatdrift ger färre)', () => {
        expect(cities.length).toBeGreaterThanOrEqual(40);
    });

    it('kända städer får rätt region', () => {
        const bySlug = new Map(cities.map(c => [c.slug, c]));
        expect(bySlug.get('stockholm')?.region).toBe('stockholm');
        expect(bySlug.get('malmo')?.region).toBe('skane');
        expect(bySlug.get('umea')?.region).toBe('vasterbotten');
    });
});

const CITIES = [
    { slug: 'stockholm', name: 'Stockholm', lat: 59.3293, lng: 18.0686, region: 'stockholm' },
    { slug: 'goteborg', name: 'Göteborg', lat: 57.7089, lng: 11.9746, region: 'vastra-gotaland' },
    { slug: 'lulea', name: 'Luleå', lat: 65.5848, lng: 22.1547, region: 'norrbotten' },
];

describe('nearestRegion', () => {
    it('tar närmaste stadens region, utan radietak', () => {
        expect(nearestRegion(59.33, 18.07, CITIES)).toBe('stockholm');
        // Kiruna ligger 24 mil från Luleå — hör ändå hemma i norrbotten.
        expect(nearestRegion(67.8558, 20.2253, CITIES)).toBe('norrbotten');
    });
});

describe('buildAppFeeds', () => {
    const now = new Date('2026-09-25T10:00:00+02:00');
    const dest = (over: Record<string, unknown>) => ({
        id: 'https://ex.se/1', title: 'Event', time: '2026-09-26T18:00:00.000Z',
        hasSpecificTime: true, lat: 59.33, lng: 18.07, locationName: 'Plats', category: 'music',
        ...over,
    }) as Parameters<typeof buildAppFeeds>[0][number];

    it('filtrerar horisonten: passerat och bortom 14 dagar åker ut', () => {
        const regions = buildAppFeeds([
            dest({ id: 'a', time: '2026-09-24T18:00:00.000Z' }),   // igår
            dest({ id: 'b' }),                                      // imorgon
            dest({ id: 'c', time: '2026-10-15T18:00:00.000Z' }),   // bortom horisonten
        ], [], CITIES, now);
        expect(regions.get('stockholm')?.map(e => e.id)).toEqual(['b']);
    });

    it('hoppar null island och joinar bild via eventKey', () => {
        const id = 'https://ex.se/med-bild';
        const regions = buildAppFeeds([
            dest({ id }),
            dest({ id: 'x', lat: 0, lng: 0 }), // null island — bort
        ], [{ h: eventKey(id), coverImage: 'https://img.se/a.jpg' }], CITIES, now);
        const list = regions.get('stockholm')!;
        expect(list).toHaveLength(1);
        expect(list[0].img).toBe('https://img.se/a.jpg');
        expect(list[0].url).toBeUndefined(); // id ÄR länken när cards inte skrivit om den
    });

    it('sorterar i tidsordning och delar upp per region', () => {
        const regions = buildAppFeeds([
            dest({ id: 'sen', time: '2026-09-28T18:00:00.000Z' }),
            dest({ id: 'tidig', time: '2026-09-26T10:00:00.000Z' }),
            dest({ id: 'gbg', lat: 57.71, lng: 11.97 }),
        ], [], CITIES, now);
        expect(regions.get('stockholm')?.map(e => e.id)).toEqual(['tidig', 'sen']);
        expect(regions.get('vastra-gotaland')?.map(e => e.id)).toEqual(['gbg']);
    });

    it('tomma valfria fält utelämnas (bytes × tusentals event)', () => {
        const regions = buildAppFeeds([dest({ id: 'ren', emoji: '', endDate: '', locationName: '' })], [], CITIES, now);
        const ev = regions.get('stockholm')![0];
        expect('emoji' in ev && ev.emoji !== undefined).toBe(false);
        expect(ev.endDate).toBeUndefined();
        expect(ev.locationName).toBeUndefined();
        expect(JSON.stringify(ev)).not.toContain('emoji');
    });
});
