/**
 * Tester för jsonLdToRawEvent — särskilt SPRÅKTAGGADE värden.
 *
 * schema.org tillåter `{"@value": "...", "@language": "sv"}` där en naken
 * sträng vore väntad. EPiServer-sajter (vastsverige.com, som bär Stenungsunds
 * hela evenemangskalender) skickar titeln så, och motorn gjorde
 * `String(node.name)` → varje event fick titeln "[object Object]".
 * Fixture är ett nedskalat utsnitt ur en riktig vastsverige.com-detaljsida
 * (probad 2026-09-03).
 */
import { describe, it, expect } from 'vitest';
import { jsonLdToRawEvent } from './json-ld';

const BASE = 'https://www.vastsverige.com/stenungsund/evenemang/bibliotekets-it-cafe/';

describe('jsonLdToRawEvent — språktaggade värden', () => {
    it('packar upp @value i name och description', () => {
        const ev = jsonLdToRawEvent({
            '@type': 'Event',
            name: { '@value': 'Bibliotekets IT-hjälp', '@language': 'sv' },
            description: { '@value': 'Drop-in med IT-stöd.', '@language': 'sv' },
            startDate: '2026-08-27T13:00:00',
            endDate: '2026-12-10T14:30:00',
            url: BASE,
            location: {
                '@type': 'Place',
                name: 'Stenungsunds bibliotek',
                address: { '@type': 'PostalAddress', streetAddress: 'Fregatten 1', addressLocality: 'Stenungsund' },
            },
        }, BASE);

        expect(ev).not.toBeNull();
        expect(ev!.title).toBe('Bibliotekets IT-hjälp');
        expect(ev!.description).toBe('Drop-in med IT-stöd.');
        expect(ev!.venueName).toBe('Stenungsunds bibliotek');
        expect(ev!.city).toBe('Stenungsund');
        expect(ev!.address).toBe('Fregatten 1');
    });

    it('väljer svenska ur en flerspråkig array', () => {
        const ev = jsonLdToRawEvent({
            '@type': 'Event',
            name: [
                { '@value': 'Library IT help', '@language': 'en' },
                { '@value': 'Bibliotekets IT-hjälp', '@language': 'sv' },
            ],
            startDate: '2026-08-27T13:00:00',
            url: BASE,
        }, BASE);

        expect(ev!.title).toBe('Bibliotekets IT-hjälp');
    });

    it('faller tillbaka på första posten när svenska saknas', () => {
        const ev = jsonLdToRawEvent({
            '@type': 'Event',
            name: [{ '@value': 'Library IT help', '@language': 'en' }],
            startDate: '2026-08-27T13:00:00',
            url: BASE,
        }, BASE);

        expect(ev!.title).toBe('Library IT help');
    });

    it('lämnar vanliga strängar orörda', () => {
        const ev = jsonLdToRawEvent({
            '@type': 'Event',
            name: 'Höstmarknad',
            description: '  Marknad på torget.  ',
            startDate: '2026-09-20T10:00:00',
            url: BASE,
            organizer: { '@type': 'Organization', name: 'Stenungsunds kommun' },
        }, BASE);

        expect(ev!.title).toBe('Höstmarknad');
        expect(ev!.description).toBe('Marknad på torget.');
        expect(ev!.organizer).toBe('Stenungsunds kommun');
    });

    it('kastar event vars titel bara är ett tomt språkobjekt', () => {
        expect(jsonLdToRawEvent({
            '@type': 'Event',
            name: { '@value': '   ', '@language': 'sv' },
            startDate: '2026-09-20T10:00:00',
            url: BASE,
        }, BASE)).toBeNull();
    });
});
