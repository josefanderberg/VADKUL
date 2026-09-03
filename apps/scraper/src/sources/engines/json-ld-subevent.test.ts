/**
 * Tester för JSON-LD-motorns traversering + mappning. Fixturen är ett
 * nedskalat utsnitt ur berwaldhallen.se/kalendarium (probad 2026-09-04):
 * hela månaden ligger som EN EventSeries med tillfällena i subEvent[],
 * utan url — bara offers.url (bokningssidan) pekar ut ett unikt event.
 */
import { describe, it, expect } from 'vitest';
import { collectEvents, jsonLdToRawEvent } from './json-ld';

const ACCEPTED = new Set(['Event', 'EventSeries', 'MusicEvent']);

const BERWALDHALLEN_SERIES = {
    '@context': 'https://schema.org',
    '@type': 'EventSeries',
    '@id': 'https://berwaldhallen.se/kalendarium',
    name: 'Kalendarium',
    url: 'https://berwaldhallen.se/kalendarium',
    subEvent: [
        {
            '@type': 'Event',
            '@id': 'https://berwaldhallen.se/event/120565',
            name: 'Mörka sagor och danser - med Lin & Johnsson',
            startDate: '2026-09-09T18:00:00+02:00',
            endDate: '2026-09-09T19:00:00+02:00',
            location: {
                '@type': 'Place', name: 'Berwaldhallen', latitude: '59.3331', longitude: '18.0976668',
                address: { streetAddress: 'Dag Hammarskjölds väg 3', addressLocality: 'Stockholm' },
            },
            image: 'https://cdn-production.berwaldhallen.se/wp-content/x.jpg',
            offers: { '@type': 'Offer', price: '100 - 420', url: 'https://boka.berwaldhallen.se/sv/buyingflow/tickets/29145/120565/' },
        },
        {
            '@type': 'Event',
            '@id': 'https://berwaldhallen.se/event/120566',
            name: 'Mörka sagor och danser - med Lin & Johnsson',
            startDate: '2026-09-10T18:00:00+02:00',
            location: { '@type': 'Place', name: 'Berwaldhallen' },
            offers: { '@type': 'Offer', url: 'https://boka.berwaldhallen.se/sv/buyingflow/tickets/29145/120566/' },
        },
    ],
};

describe('collectEvents — EventSeries.subEvent', () => {
    it('samlar serien OCH tillfällena under den', () => {
        const out: any[] = [];
        collectEvents(BERWALDHALLEN_SERIES, ACCEPTED, out);
        const names = out.map((n) => n['@id']);
        expect(names).toContain('https://berwaldhallen.se/event/120565');
        expect(names).toContain('https://berwaldhallen.se/event/120566');
        expect(out).toHaveLength(3);
    });

    it('serie-noden utan startDate mappas inte, tillfällena får offers.url som URL', () => {
        const out: any[] = [];
        collectEvents(BERWALDHALLEN_SERIES, ACCEPTED, out);
        const mapped = out.map((n) => jsonLdToRawEvent(n, 'https://www.berwaldhallen.se/kalendarium')).filter(Boolean);
        expect(mapped).toHaveLength(2);
        const first = mapped[0]!;
        expect(first.url).toBe('https://boka.berwaldhallen.se/sv/buyingflow/tickets/29145/120565/');
        expect(first.startDate.toISOString()).toBe('2026-09-09T16:00:00.000Z');
        expect(first.venueName).toBe('Berwaldhallen');
        expect(first.city).toBe('Stockholm');
        expect(first.coords).toEqual([59.3331, 18.0976668]);
        // Två tillfällen av samma produktion → olika URL:er, ingen kollision på primärnyckeln.
        expect(new Set(mapped.map((m) => m!.url)).size).toBe(2);
    });
});
