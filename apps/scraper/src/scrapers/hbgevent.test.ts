import { describe, it, expect } from 'vitest';
import { parseHbgDate, parseHbgCoords, mapHbgEvent } from './hbgevent';

const CFG = {
    groupId: 549,
    urlTemplate: 'https://astorp.se/arkiv/evenemang/evenemang.html?id={id}',
    defaultCity: 'Åstorp',
};

describe('parseHbgDate', () => {
    it('läser lokal väggtid', () => {
        const d = parseHbgDate('2026-08-27 16:30')!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(7);
        expect(d.getDate()).toBe(27);
        expect(d.getHours()).toBe(16);
        expect(d.getMinutes()).toBe(30);
    });

    it('accepterar ISO-separator', () => {
        expect(parseHbgDate('2026-08-27T16:30')?.getHours()).toBe(16);
    });

    it('avvisar datum utan klockslag och skräp', () => {
        expect(parseHbgDate('2026-08-27')).toBeNull();
        expect(parseHbgDate(undefined)).toBeNull();
        expect(parseHbgDate('')).toBeNull();
    });
});

describe('parseHbgCoords', () => {
    it('konverterar strängkoordinater', () => {
        expect(parseHbgCoords({ latitude: '56.1367244', longitude: '12.9342496' })).toEqual([56.1367244, 12.9342496]);
    });

    it('avvisar 0,0, tomt och utanför Norden', () => {
        expect(parseHbgCoords({ latitude: '0', longitude: '0' })).toBeUndefined();
        expect(parseHbgCoords(null)).toBeUndefined();
        expect(parseHbgCoords({ latitude: '48.85', longitude: '2.35' })).toBeUndefined();
    });
});

describe('mapHbgEvent', () => {
    const EV = {
        id: 2137990,
        title: { rendered: 'ABC-kurs', plain_text: 'ABC-kurs' },
        content: { plain_text: 'Trött på tjat, bråk och dåligt samvete? Anmäl dig till vår föräldrakurs.' },
        occasions: [
            { start_date: '2026-08-27 16:30', end_date: '2026-08-27 19:00', status: 'scheduled' },
            { start_date: '2026-09-03 16:30', end_date: '2026-09-03 19:00', status: 'scheduled' },
        ],
        location: { title: 'Arena Åstorp', street_address: 'Trädgårdsgatan 59', city: 'Åstorp', latitude: '56.1367244', longitude: '12.9342496' },
        featured_media: { source_url: 'https://api.helsingborg.se/wp-content/uploads/abc.png' },
        event_categories: ['För familjen', 'Föreläsning'],
    };

    it('ger ett event per tillfälle', () => {
        expect(mapHbgEvent(EV, CFG)).toHaveLength(2);
    });

    it('bygger publik URL ur mallen, unik per tillfälle', () => {
        const [a, b] = mapHbgEvent(EV, CFG);
        expect(a.url).toBe('https://astorp.se/arkiv/evenemang/evenemang.html?id=2137990#2026-08-27');
        expect(b.url).toContain('#2026-09-03');
    });

    it('hanterar den andra kommunens URL-mönster', () => {
        const skurup = { ...CFG, urlTemplate: 'https://www.skurup.se/evenemang/visa-evenemang/{id}', defaultCity: 'Skurup' };
        expect(mapHbgEvent(EV, skurup)[0].url).toBe('https://www.skurup.se/evenemang/visa-evenemang/2137990#2026-08-27');
    });

    it('bär plats, koordinater, bild och kategori', () => {
        const e = mapHbgEvent(EV, CFG)[0];
        expect(e.venueName).toBe('Arena Åstorp');
        expect(e.address).toBe('Trädgårdsgatan 59');
        expect(e.city).toBe('Åstorp');
        expect(e.coords).toEqual([56.1367244, 12.9342496]);
        expect(e.imageUrl).toContain('abc.png');
        expect(e.category).toBe('För familjen');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.endDate).toBeDefined();
    });

    it('faller tillbaka på defaultCity när platsen saknas', () => {
        expect(mapHbgEvent({ ...EV, location: null }, CFG)[0].city).toBe('Åstorp');
    });

    it('hoppar över inställda tillfällen', () => {
        const ev = { ...EV, occasions: [{ start_date: '2026-08-27 16:30', status: 'cancelled' }, { start_date: '2026-09-03 16:30', status: 'scheduled' }] };
        expect(mapHbgEvent(ev, CFG)).toHaveLength(1);
    });

    it('avkodar HTML-entiteter i titeln', () => {
        const ev = { ...EV, title: { rendered: 'Kurs &#8211; del 2', plain_text: 'Kurs &#8211; del 2' } };
        expect(mapHbgEvent(ev, CFG)[0].title).toBe('Kurs – del 2');
    });

    it('hoppar över poster utan titel, id eller tillfällen', () => {
        expect(mapHbgEvent({ ...EV, title: { plain_text: '' } }, CFG)).toEqual([]);
        expect(mapHbgEvent({ ...EV, id: undefined }, CFG)).toEqual([]);
        expect(mapHbgEvent({ ...EV, occasions: [] }, CFG)).toEqual([]);
    });
});
