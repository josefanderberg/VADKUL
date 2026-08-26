import { describe, it, expect } from 'vitest';
import { extractCrunchoState, pickOccurrence, mapCrunchoEvent, mapCrunchoRouteEvent, mapCrunchoApiEvent, CrunchoEvent } from './cruncho';

const CFG = { pageUrl: 'https://visitlund.se/evenemangskalender', defaultCity: 'Lund' };
const WINDOW_START = new Date('2026-07-09T00:00:00+02:00');

describe('extractCrunchoState', () => {
    it('hittar state med hex-portlet-id (regression: [\\d.]+ missade a-f)', () => {
        const html = `<script>AppRegistry.registerInitialState('12.4a9fdbcc196afbc01b4dc7e',` +
            `{"size":1,"totalEvents":1,"events":[{"id":"abc","name":"Test"}]})</script>`;
        const state = extractCrunchoState(html);
        expect(state?.totalEvents).toBe(1);
        expect(state?.events?.[0].name).toBe('Test');
    });

    it('hoppar över portlets utan events[] (sök-varianten) och klarar strängar med klamrar', () => {
        const html =
            `<script>AppRegistry.registerInitialState('12.aaa',{"settings":{"x":1}})</script>` +
            `<script>AppRegistry.registerInitialState('12.bbb',` +
            `{"size":1,"totalEvents":2,"events":[{"id":"x","name":"Krull {y} \\"quote\\" }"}]})</script>`;
        const state = extractCrunchoState(html);
        expect(state?.totalEvents).toBe(2);
    });

    it('ingen state → null', () => {
        expect(extractCrunchoState('<html><body>tom</body></html>')).toBeNull();
    });
});

describe('pickOccurrence', () => {
    it('tar första förekomsten i/efter fönstret ur dates[]', () => {
        const e: CrunchoEvent = {
            startDate: '2026-03-01T09:00:00Z',
            dates: [
                { startDate: '2026-03-01T09:00:00Z', endDate: '2026-03-01T15:00:00Z' },
                { startDate: '2026-07-12T09:00:00Z', endDate: '2026-07-12T15:00:00Z' },
                { startDate: '2026-07-20T09:00:00Z', endDate: '2026-07-20T15:00:00Z' },
            ],
        };
        const r = pickOccurrence(e, WINDOW_START);
        expect(r?.start.toISOString()).toBe('2026-07-12T09:00:00.000Z');
        expect(r?.end?.toISOString()).toBe('2026-07-12T15:00:00.000Z');
    });

    it('bara passerade förekomster → faller tillbaka på toppnivåns startDate', () => {
        const e: CrunchoEvent = {
            startDate: '2026-06-01T22:00:00Z',
            endDate: '2026-09-20T21:59:00Z',
            dates: [{ startDate: '2026-06-05T09:00:00Z' }],
        };
        const r = pickOccurrence(e, WINDOW_START);
        expect(r?.start.toISOString()).toBe('2026-06-01T22:00:00.000Z');
    });

    it('inget datum alls → null', () => {
        expect(pickOccurrence({}, WINDOW_START)).toBeNull();
    });
});

describe('mapCrunchoEvent', () => {
    const base: CrunchoEvent = {
        id: '69fb41aa1ed2065b9779f51c',
        name: 'We Have A Dream 10 år',
        startDate: '2026-07-12T10:00:00Z',
        venue: 'Domkyrkoplatsen',
        address: 'Domkyrkoplatsen, Lund, Sweden',
        city: 'Centrala staden, Lund',
        mapCoordinates: { lat: 55.703827, lng: 13.193566 },
        description: '<p>Fotoutställning &amp; berättelser.</p>',
        photos: [{ url: 'https://s3.cruncho.co/img.png' }],
        isFree: true,
        status: 'posted',
        categories: ['arts'],
    };

    it('mappar alla fält, coords [lat,lng], Gratis, avkodad beskrivning', () => {
        const ev = mapCrunchoEvent(base, CFG, WINDOW_START)!;
        expect(ev.title).toBe('We Have A Dream 10 år');
        expect(ev.url).toContain('evenemang?id=69fb41aa1ed2065b9779f51c');
        expect(ev.coords).toEqual([55.703827, 13.193566]);
        expect(ev.city).toBe('Lund');           // defaultCity vinner över stadsdels-city
        expect(ev.price).toBe('Gratis');
        expect(ev.description).toContain('Fotoutställning & berättelser');
        expect(ev.description).not.toContain('<p>');
        expect(ev.imageUrl).toBe('https://s3.cruncho.co/img.png');
    });

    it('pris i kronor när inte gratis', () => {
        const ev = mapCrunchoEvent({ ...base, isFree: false, price: 150 }, CFG, WINDOW_START)!;
        expect(ev.price).toBe('150 kr');
    });

    it('hide eller status≠posted → null', () => {
        expect(mapCrunchoEvent({ ...base, hide: true }, CFG, WINDOW_START)).toBeNull();
        expect(mapCrunchoEvent({ ...base, status: 'draft' }, CFG, WINDOW_START)).toBeNull();
    });

    it('nollkoordinater skickas inte vidare', () => {
        const ev = mapCrunchoEvent({ ...base, mapCoordinates: { lat: 0, lng: 0 } }, CFG, WINDOW_START)!;
        expect(ev.coords).toBeUndefined();
    });
});

describe('mapCrunchoRouteEvent', () => {
    const CFG = { pageUrl: 'https://www.ange.se/evenemang', defaultCity: 'Ånge' };
    const E = {
        id: 'OnA5R0gdaQTG8OAGgErG',
        name: 'Kulturskolan - pop-up i Konsthallen!',
        from: '2026-08-27T10:00:00.000+02:00',
        to: '2026-08-27T16:00:00.000+02:00',
        uri: '/evenemang/evenemang/2026-08-21-kulturskolan---pop-up-i-konsthallen',
        venue: 'Järnvägsgatan 3',
        address: 'Järnvägsgatan 3, 841 33 Ånge, Sverige',
        organizer: 'Kulturskolan',
        imageUrl: 'https://s3.cruncho.co/eventmanager-assets/utstallning.jpg',
        description: 'Välkommen att ta del av Kulturskolans verksamhet.',
    };

    it('gör uri absolut mot kalendersidan', () => {
        expect(mapCrunchoRouteEvent(E, CFG)!.url)
            .toBe('https://www.ange.se/evenemang/evenemang/2026-08-21-kulturskolan---pop-up-i-konsthallen');
    });

    it('läser from/to som lokal tid med offset', () => {
        const e = mapCrunchoRouteEvent(E, CFG)!;
        expect(e.startDate.toISOString()).toBe('2026-08-27T08:00:00.000Z');
        expect(e.endDate?.toISOString()).toBe('2026-08-27T14:00:00.000Z');
        expect(e.hasSpecificTime).toBe(true);
    });

    it('sätter arrangören som hostName och bär full adress', () => {
        const e = mapCrunchoRouteEvent(E, CFG)!;
        expect(e.hostName).toBe('Kulturskolan');
        expect(e.address).toBe('Järnvägsgatan 3, 841 33 Ånge, Sverige');
        expect(e.city).toBe('Ånge');
    });

    it('lämnar hasSpecificTime öppen för heldagsposter', () => {
        expect(mapCrunchoRouteEvent({ ...E, from: '2026-08-27T00:00:00.000+02:00' }, CFG)!.hasSpecificTime).toBeUndefined();
    });

    it('avvisar poster utan namn, from eller uri', () => {
        expect(mapCrunchoRouteEvent({ ...E, name: '' }, CFG)).toBeNull();
        expect(mapCrunchoRouteEvent({ ...E, from: undefined }, CFG)).toBeNull();
        expect(mapCrunchoRouteEvent({ ...E, uri: undefined }, CFG)).toBeNull();
        expect(mapCrunchoRouteEvent({ ...E, from: 'aldrig' }, CFG)).toBeNull();
    });

    it('klarar arrangör satt till null', () => {
        const e = mapCrunchoRouteEvent({ ...E, organizer: null }, CFG)!;
        expect(e.hostName).toBeUndefined();
    });
});

describe('mapCrunchoApiEvent', () => {
    const CFG = {
        pageUrl: 'https://lomma.se/evenemang',
        hostedApi: { destination: 'lomma', siteBase: 'https://burlovlommastaffanstorp.cruncho.co' },
        defaultCity: 'Lomma',
    };
    const E = {
        id: 'klXDgp',
        name: 'Fladdermössens mystiska värld',
        description: '<p>Följ med på fladdermussafari.</p>',
        eventStart: ['2026-08-27T18:00:00.000Z', '2026-09-03T18:00:00.000Z'],
        eventEnd: ['2026-08-27T19:30:00.000Z', '2026-09-03T19:30:00.000Z'],
        hideEventStartTime: false,
        address: 'Dalbyvägen 51, 232 31 Arlöv, Sweden',
        city: 'Arlöv',
        eventVenueName: 'Falsterbo',
        organizer: 'Naturskolan',
        isFree: false,
        price: 440,
        geometry: { lat: 55.397121, lng: 12.8415278 },
        photos: [{ url: 'https://s3.cruncho.co/eventmanager-assets/x.jpg' }],
    };

    it('ger ett event per tillfälle', () => {
        expect(mapCrunchoApiEvent(E, CFG)).toHaveLength(2);
    });

    it('bygger /sv-SE/place/<id>-länk, unik per tillfälle', () => {
        const [a, b] = mapCrunchoApiEvent(E, CFG);
        expect(a.url).toBe('https://burlovlommastaffanstorp.cruncho.co/sv-SE/place/klXDgp#2026-08-27');
        expect(b.url).toContain('#2026-09-03');
    });

    it('tar orten per event — destinationen spänner flera kommuner', () => {
        expect(mapCrunchoApiEvent(E, CFG)[0].city).toBe('Arlöv');
        expect(mapCrunchoApiEvent({ ...E, city: undefined }, CFG)[0].city).toBe('Lomma');
    });

    it('formaterar priset som tal, inte sträng', () => {
        expect(mapCrunchoApiEvent(E, CFG)[0].price).toBe('440 kr');
        expect(mapCrunchoApiEvent({ ...E, price: null }, CFG)[0].price).toBeUndefined();
        expect(mapCrunchoApiEvent({ ...E, isFree: true }, CFG)[0].price).toBe('Gratis');
    });

    it('bär koordinater och bild', () => {
        const e = mapCrunchoApiEvent(E, CFG)[0];
        expect(e.coords).toEqual([55.397121, 12.8415278]);
        expect(e.imageUrl).toContain('cruncho.co');
        expect(e.hasSpecificTime).toBe(true);
    });

    it('litar inte på klockslaget när arrangören dolt det', () => {
        expect(mapCrunchoApiEvent({ ...E, hideEventStartTime: true }, CFG)[0].hasSpecificTime).toBeUndefined();
    });

    it('hoppar över dolda poster och poster utan tillfällen', () => {
        expect(mapCrunchoApiEvent({ ...E, hide: true }, CFG)).toEqual([]);
        expect(mapCrunchoApiEvent({ ...E, eventStart: [] }, CFG)).toEqual([]);
        expect(mapCrunchoApiEvent({ ...E, name: '' }, CFG)).toEqual([]);
        expect(mapCrunchoApiEvent({ ...E, id: undefined }, CFG)).toEqual([]);
    });

    it('klarar att eventEnd är kortare än eventStart', () => {
        const e = mapCrunchoApiEvent({ ...E, eventEnd: ['2026-08-27T19:30:00.000Z'] }, CFG);
        expect(e[0].endDate).toBeDefined();
        expect(e[1].endDate).toBeUndefined();
    });
});
