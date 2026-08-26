import { describe, it, expect } from 'vitest';
import { normalizeFacebookUrl, mapAccentEvent } from './accentfeed';

const CFG = { feedId: '35230', defaultCity: 'Kalix' };

describe('normalizeFacebookUrl', () => {
    it('lägger på avslutande slash — annars dubblett mot facebook-scrapern', () => {
        expect(normalizeFacebookUrl('https://www.facebook.com/events/1007504065270047'))
            .toBe('https://www.facebook.com/events/1007504065270047/');
    });

    it('är idempotent', () => {
        expect(normalizeFacebookUrl('https://www.facebook.com/events/1007504065270047/'))
            .toBe('https://www.facebook.com/events/1007504065270047/');
    });

    it('normaliserar bort värdvariationer och frågesträng', () => {
        expect(normalizeFacebookUrl('https://facebook.com/events/123?ref=share'))
            .toBe('https://www.facebook.com/events/123/');
        expect(normalizeFacebookUrl('https://m.facebook.com/events/123/'))
            .toBe('https://www.facebook.com/events/123/');
    });

    it('släpper igenom icke-FB-länkar orörda', () => {
        expect(normalizeFacebookUrl('https://kalix.se/evenemang/x')).toBe('https://kalix.se/evenemang/x');
    });

    it('avvisar tomt och relativt', () => {
        expect(normalizeFacebookUrl(undefined)).toBeNull();
        expect(normalizeFacebookUrl('')).toBeNull();
        expect(normalizeFacebookUrl('/events/123')).toBeNull();
    });
});

describe('mapAccentEvent', () => {
    const E = {
        event_id: '1007504065270047',
        name: 'Släktforskning för nybörjare',
        description: 'Lär dig grunderna i släktforskning.',
        event_start_utc: '2026-11-12T18:00:00.000Z',
        event_end_utc: '2026-11-12T20:00:00.000Z',
        start_time_display: 'true',
        html_link: 'https://www.facebook.com/events/1007504065270047',
        image: 'https://scontent.example/x.jpg',
        event_venue: 'Kalix Folkets Hus',
        location_text: 'Strandgatan 2, Kalix',
        event_lati: '65.856453309445',
        event_longi: '23.15',
        ticket_price: '100 kr',
        owner: 'Kalix Bibliotek',
    };

    it('normaliserar URL:en', () => {
        expect(mapAccentEvent(E, CFG)!.url).toBe('https://www.facebook.com/events/1007504065270047/');
    });

    it('bär koordinater, plats, pris och arrangör', () => {
        const e = mapAccentEvent(E, CFG)!;
        expect(e.coords).toEqual([65.856453309445, 23.15]);
        expect(e.venueName).toBe('Kalix Folkets Hus');
        expect(e.address).toBe('Strandgatan 2, Kalix');
        expect(e.city).toBe('Kalix');
        expect(e.price).toBeUndefined();       // price sätts inte av mapparen
        expect(e.organizer).toBe('Kalix Bibliotek');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.endDate?.toISOString()).toBe('2026-11-12T20:00:00.000Z');
    });

    it('litar inte på klockslag när arrangören inte satt något', () => {
        expect(mapAccentEvent({ ...E, start_time_display: 'false' }, CFG)!.hasSpecificTime).toBeUndefined();
    });

    it('avvisar koordinater utanför Norden och 0,0', () => {
        expect(mapAccentEvent({ ...E, event_lati: '0', event_longi: '0' }, CFG)!.coords).toBeUndefined();
        expect(mapAccentEvent({ ...E, event_lati: '40.7', event_longi: '-74' }, CFG)!.coords).toBeUndefined();
    });

    it('hoppar över inställda event', () => {
        expect(mapAccentEvent({ ...E, event_status: 'cancelled' }, CFG)).toBeNull();
    });

    it('avvisar poster utan namn, länk eller starttid', () => {
        expect(mapAccentEvent({ ...E, name: '' }, CFG)).toBeNull();
        expect(mapAccentEvent({ ...E, html_link: undefined }, CFG)).toBeNull();
        expect(mapAccentEvent({ ...E, event_start_utc: undefined }, CFG)).toBeNull();
    });
});
