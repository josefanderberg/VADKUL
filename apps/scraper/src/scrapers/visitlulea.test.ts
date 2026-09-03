import { describe, it, expect } from 'vitest';
import { mapVisitLuleaHit } from './visitlulea';

const CFG = { defaultCity: 'Luleå' };

// Riktiga träffar ur eventsapi/filter 2026-09-04 (nedskalade).
const HASTMASSA = {
    Id: '25790_1', ContentId: 25790,
    Header: 'Norrbottens hästmässa & hästloppis',
    Image: { Url: '/media/cfjij01m/screenshot.jpg', AltText: 'Norrbottens hästmässa' },
    Category: 'Loppis & auktion',
    Url: '/evenemang/2026/norrbottens-hastmassa-hastloppis-5-sep-2026/',
    StartDate: '2026-09-05T00:00:00', EndDate: '2026-09-05T00:00:00',
    LeadText: 'Rånebygdens ridklubb', Location: 'Rånebygdens ridklubb',
    NextOpenDate: '2026-09-05T00:00:00', IsSingleDateEvent: true,
};

const UTSTALLNING = {
    ContentId: 26006,
    Header: 'Galleri Y presenterar: Norrtrådar',
    Image: { Url: '/media/va4bnuoo/affisch.jpg' },
    Category: 'Utställning',
    Url: '/evenemang/2026/galleri-y-presenterar-norrtradar-27-aug-2026/',
    StartDate: '2026-08-27T00:00:00', EndDate: '2026-09-27T00:00:00',
    LeadText: 'Galleri Y, Sunderby folkhögskola', Location: 'Galleri Y, Sunderby folkhögskola',
    IsSingleDateEvent: false,
};

describe('mapVisitLuleaHit', () => {
    it('mappar endagsevent: absolut URL + bild, venue, defaultCity, kategori', () => {
        const ev = mapVisitLuleaHit(HASTMASSA, CFG)!;
        expect(ev.title).toBe('Norrbottens hästmässa & hästloppis');
        expect(ev.url).toBe('https://visitlulea.se/evenemang/2026/norrbottens-hastmassa-hastloppis-5-sep-2026/');
        expect(ev.imageUrl).toBe('https://visitlulea.se/media/cfjij01m/screenshot.jpg');
        expect(ev.venueName).toBe('Rånebygdens ridklubb');
        expect(ev.city).toBe('Luleå');
        expect(ev.category).toBe('market');
        expect(ev.externalId).toBe('25790');
        expect(ev.startDate.getDate()).toBe(5);
        expect(ev.startDate.getMonth()).toBe(8);
        // API:t ger bara midnatt → inget klockslag att lita på.
        expect(ev.hasSpecificTime).toBeUndefined();
        expect(ev.endDate).toBeUndefined();
    });

    it('utställning över en månad får endDate', () => {
        const ev = mapVisitLuleaHit(UTSTALLNING, CFG)!;
        expect(ev.category).toBe('art');
        expect(ev.endDate?.getMonth()).toBe(8);
        expect(ev.endDate?.getDate()).toBe(27);
    });

    it('okänd kategori lämnas åt runnerns klassificerare', () => {
        const ev = mapVisitLuleaHit({ ...HASTMASSA, Category: 'Kunskap' }, CFG)!;
        expect(ev.category).toBeUndefined();
    });

    it('träff utan rubrik, länk eller datum avvisas', () => {
        expect(mapVisitLuleaHit({ ...HASTMASSA, Header: '' }, CFG)).toBeNull();
        expect(mapVisitLuleaHit({ ...HASTMASSA, Url: undefined }, CFG)).toBeNull();
        expect(mapVisitLuleaHit({ ...HASTMASSA, StartDate: null }, CFG)).toBeNull();
    });
});
