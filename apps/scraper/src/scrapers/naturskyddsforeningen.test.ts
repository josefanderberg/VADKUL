import { describe, it, expect } from 'vitest';
import { mapNsfEvent, parseStartTime } from './naturskyddsforeningen';

const baseResult = {
    title: 'Slåtterkurs på ängen',
    url: '/kalender/slatterkurs-pa-angen-2026-07-12/',
    timeString: '10.00–14.00',
    dateString: '12 juli 2026',
    organizer: 'Naturskyddsföreningen Sollentuna',
    location: 'Törnskogens naturreservat',
    coordinates: { lat: 59.46, lng: 17.94 },
    image: { url: 'https://cms.naturskyddsforeningen.se/bild.jpg' },
    excerpt: 'Lär dig slåtter med lie <b>och</b> räfsa […]',
};

describe('parseStartTime', () => {
    it('plockar starttid ur intervall och enkeltid, punkt eller kolon', () => {
        expect(parseStartTime('18.00–20.00')).toEqual({ h: 18, m: 0 });
        expect(parseStartTime('9:30')).toEqual({ h: 9, m: 30 });
        expect(parseStartTime('')).toBeNull();
        expect(parseStartTime('99.99')).toBeNull();
    });
});

describe('mapNsfEvent', () => {
    it('mappar ett komplett GraphQL-result med slug-datum + timeString', () => {
        const e = mapNsfEvent(baseResult)!;
        expect(e.url).toBe('https://www.naturskyddsforeningen.se/kalender/slatterkurs-pa-angen-2026-07-12/');
        expect(e.startDate.getFullYear()).toBe(2026);
        expect(e.startDate.getMonth()).toBe(6);       // juli
        expect(e.startDate.getDate()).toBe(12);
        expect(e.startDate.getHours()).toBe(10);      // ur timeString, lokal tid
        expect(e.coords).toEqual([59.46, 17.94]);
        expect(e.hostName).toBe('Naturskyddsföreningen Sollentuna');
        expect(e.venueName).toBe('Törnskogens naturreservat, Naturskyddsföreningen Sollentuna');
        expect(e.imageUrl).toBe('https://cms.naturskyddsforeningen.se/bild.jpg');
    });

    it('slug utan ISO-datum hoppas över (dateString kan vara intervall — opålitlig)', () => {
        expect(mapNsfEvent({ ...baseResult, url: '/kalender/standig-utstallning/' })).toBeNull();
    });

    it('utan timeString blir starttiden 00:00 (runnerns heldags-heuristik tar över)', () => {
        const e = mapNsfEvent({ ...baseResult, timeString: '' })!;
        expect(e.startDate.getHours()).toBe(0);
        expect(e.hasSpecificTime).toBeUndefined();
    });

    it('koordinater saknas → location blir geocode-kandidat', () => {
        const e = mapNsfEvent({ ...baseResult, coordinates: undefined })!;
        expect(e.coords).toBeUndefined();
        expect(e.geocodeCandidates).toEqual(['Törnskogens naturreservat']);
    });

    it('excerpt städas från HTML och WP-excerpt-rester ("[…]")', () => {
        expect(mapNsfEvent(baseResult)!.description).toBe('Lär dig slåtter med lie och räfsa');
    });
});
