import { describe, it, expect } from 'vitest';
import { mapNorticShow, parseNorticCoords, parseNorticTime, formatNorticPrice } from './nortic';

const baseEvent = {
    id: 80453,
    title: 'Cabaret',
    link: 'https://www.nortic.se/ticket/event/80453',
    description: '<p>Musikalen &amp; showen</p>',
    shortDescription: 'Musikalen Cabaret',
    category: 'Musikal',
    imageUrl: 'https://branding.nortic.io/organizer/346/event/80453',
    organizerName: 'Ydre Kulturcentrum',
};

const baseShow = {
    id: 334805,
    name: 'Cabaret',
    startDate: '2026-10-10 16:00',
    arenaId: 12132,
    arenaName: 'Kulturverkstaden',
    arenaCity: 'Österbymo',
    arenaAddress: 'Bygatan 1',
    // OBS: API:ts fält är förväxlade — longitude bär latituden.
    arenaLongitude: '57.82485',
    arenaLatitude: '15.27572',
    minPrice: 275.0,
    maxPrice: 375.0,
};

describe('mapNorticShow', () => {
    it('mappar en komplett föreställning', () => {
        const ev = mapNorticShow(baseEvent, baseShow)!;
        expect(ev.title).toBe('Cabaret');
        expect(ev.url).toBe('https://www.nortic.se/ticket/event/80453#a12132');
        expect(ev.venueName).toBe('Kulturverkstaden');
        expect(ev.city).toBe('Österbymo');
        expect(ev.address).toBe('Bygatan 1');
        expect(ev.price).toBe('275–375 kr');
        expect(ev.hostName).toBe('Ydre Kulturcentrum');
        expect(ev.externalId).toBe('80453:12132');
        expect(ev.startDate.getHours()).toBe(16);   // lokal väggtid bevaras
    });

    it('rättar API:ts förväxlade lat/lng', () => {
        const ev = mapNorticShow(baseEvent, baseShow)!;
        expect(ev.coords).toEqual([57.82485, 15.27572]);   // [lat, lng] efter swap
    });

    it('boknings-tillägg filtreras på titel', () => {
        expect(mapNorticShow({ ...baseEvent, title: 'Lägg till elanslutning till din campingbokning' }, baseShow)).toBeNull();
        expect(mapNorticShow({ ...baseEvent, title: 'Parkering festivalområdet' }, baseShow)).toBeNull();
    });

    it('utan titel/datum → null', () => {
        expect(mapNorticShow({ ...baseEvent, title: '' }, { ...baseShow, name: '' })).toBeNull();
        expect(mapNorticShow(baseEvent, { ...baseShow, startDate: undefined })).toBeNull();
    });
});

describe('parseNorticCoords', () => {
    it('swappar förväxlade fält', () => {
        expect(parseNorticCoords(baseShow)).toEqual([57.82485, 15.27572]);
    });
    it('accepterar redan-korrekt ordning (om Nortic rättar API:t)', () => {
        expect(parseNorticCoords({ ...baseShow, arenaLongitude: '15.27572', arenaLatitude: '57.82485' }))
            .toEqual([57.82485, 15.27572]);
    });
    it('skräp/utanför Norden → undefined', () => {
        expect(parseNorticCoords({ ...baseShow, arenaLongitude: '', arenaLatitude: '' })).toBeUndefined();
        expect(parseNorticCoords({ ...baseShow, arenaLongitude: '40.7', arenaLatitude: '-74.0' })).toBeUndefined();
    });
});

describe('formatNorticPrice', () => {
    it('intervall, enkelpris, gratis, okänt', () => {
        expect(formatNorticPrice(275, 375)).toBe('275–375 kr');
        expect(formatNorticPrice(275, 275)).toBe('275 kr');
        expect(formatNorticPrice(0, 0)).toBe('Gratis');
        expect(formatNorticPrice(null, null)).toBeUndefined();
    });
});

describe('parseNorticTime', () => {
    it('lokal väggtid utan offset', () => {
        const d = parseNorticTime('2026-10-10 16:00')!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getHours()).toBe(16);
        expect(parseNorticTime('trasigt')).toBeNull();
    });
});
