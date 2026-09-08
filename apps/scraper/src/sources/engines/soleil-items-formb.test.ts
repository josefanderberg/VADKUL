import { describe, it, expect } from 'vitest';
import { mapSoleilItem } from './sitevision';

const BASE = 'https://www.ljungby.se/arkiv/evenemang/';

// Riktigt item ur ljungby.se items-API 2026-09-07 (form B).
const B: any = {
    image: '/images/200.363faeab/1786733587163/bild.jpg',
    canceled: false,
    id: '5.5066b7c119ed432521cc66a1',
    title: 'Konstutställning Mattias Liljeqvist',
    start: { date: '7 sep', time: '10.00', millis: 1788768000000, iso: { date: '2026-09-07', time: '10:00', full: '2026-09-07T10:00' } },
    end: { date: '10 okt', time: '19.00', iso: { date: '2026-10-10', time: '19:00', full: '2026-10-10T19:00' } },
    fields: [{ icon: 'geo-alt', description: 'Plats', id: 'sol.event.location', value: 'Konsthall Ljungby Bibliotek' }],
    uri: '/arkiv/evenemang/arkiv/2026-09-07-konstutstallning-mattias-liljeqvist',
    desc: 'Höstens stora fotoutställning.',
};

// Form A (malmo.se) ska fortsätta fungera oförändrat.
const A: any = {
    id: 'a1',
    title: 'Sommarscen Malmö',
    url: '/evenemang/sommarscen',
    desc: 'Musik i parken',
    image: '/img/s.jpg',
    place: ['Folkets Park'],
    dates: { date: '2026-07-10', time: '18:00' },
};

describe('mapSoleilItem — form B (ljungby)', () => {
    it('läser uri, start.iso och fields som plats', () => {
        const ev = mapSoleilItem(B, BASE, 'Ljungby')!;
        expect(ev.title).toBe('Konstutställning Mattias Liljeqvist');
        expect(ev.url).toBe('https://www.ljungby.se/arkiv/evenemang/arkiv/2026-09-07-konstutstallning-mattias-liljeqvist');
        expect(ev.venueName).toBe('Konsthall Ljungby Bibliotek');
        expect(ev.startDate.getFullYear()).toBe(2026);
        expect(ev.startDate.getDate()).toBe(7);
        expect(ev.startDate.getHours()).toBe(10);
        expect(ev.hasSpecificTime).toBe(true);
        expect(ev.city).toBe('Ljungby');
    });

    it('tar med slutdatum för pågående utställningar', () => {
        const ev = mapSoleilItem(B, BASE, 'Ljungby')!;
        expect(ev.endDate?.getMonth()).toBe(9);
        expect(ev.endDate?.getDate()).toBe(10);
    });

    it('publicerar inte inställda event', () => {
        expect(mapSoleilItem({ ...B, canceled: true }, BASE, 'Ljungby')).toBeNull();
    });

    it('kräver fortfarande titel, datum och länk', () => {
        expect(mapSoleilItem({ ...B, uri: undefined }, BASE, 'Ljungby')).toBeNull();
        expect(mapSoleilItem({ ...B, start: null }, BASE, 'Ljungby')).toBeNull();
        expect(mapSoleilItem({ ...B, title: ' ' }, BASE, 'Ljungby')).toBeNull();
    });
});

describe('mapSoleilItem — form A (malmo) oförändrad', () => {
    it('läser url, dates och place som förut', () => {
        const ev = mapSoleilItem(A, 'https://malmo.se/evenemangskalender', 'Malmö')!;
        expect(ev.url).toBe('https://malmo.se/evenemang/sommarscen');
        expect(ev.venueName).toBe('Folkets Park');
        expect(ev.startDate.getHours()).toBe(18);
        expect(ev.endDate).toBeUndefined();
    });
});
