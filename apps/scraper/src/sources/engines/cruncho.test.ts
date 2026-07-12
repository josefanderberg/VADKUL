import { describe, it, expect } from 'vitest';
import { extractCrunchoState, pickOccurrence, mapCrunchoEvent, CrunchoEvent } from './cruncho';

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
