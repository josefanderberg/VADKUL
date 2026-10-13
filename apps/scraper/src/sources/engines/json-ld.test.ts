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
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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

// Astrid Lindgrens Värld (12/10): TheaterEvent utan startDate — datumen ligger
// i eventSchedule[] (ett Schedule per spelperiod) och klockslaget SEPARAT i
// startTime. Nedskalat utsnitt ur /teatern/forestallning/madicken-och-lus-mia/;
// parkens eget program för 16/10 säger "Madicken och Lus-Mia 10:30".
describe('jsonLdToRawEvent — eventSchedule med startTime', () => {
    const ALV = 'https://astridlindgrensvarld.se/teatern/forestallning/madicken-och-lus-mia/';
    const node = (schedule: any[]) => ({
        '@type': 'TheaterEvent',
        name: 'Madicken och Lus-Mia',
        url: ALV,
        location: { '@type': 'Place', name: 'Junibacken' },
        eventSchedule: schedule,
    });
    const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        .map((d) => `https://schema.org/${d}`);

    // resolveSchedule väljer "närmaste kommande" mot Date.now() — lås nu.
    beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 12, 23, 0)); });
    afterAll(() => { vi.useRealTimers(); });

    it('närmaste kommande period + dess klockslag (inte "ingen tid")', () => {
        const ev = jsonLdToRawEvent(node([
            { '@type': 'Schedule', startDate: '2027-05-21', endDate: '2027-05-23', startTime: '10:40:00', byDay: week },
            { '@type': 'Schedule', startDate: '2026-09-18', endDate: '2026-09-20', startTime: '14:55:00', byDay: week },
            { '@type': 'Schedule', startDate: '2026-10-24', endDate: '2026-10-25', startTime: '10:30:00', byDay: week },
            { '@type': 'Schedule', startDate: '2026-10-16', endDate: '2026-10-18', startTime: '10:30:00', byDay: week },
        ]), ALV)!;
        expect(ev.startDate.getFullYear()).toBe(2026);
        expect(ev.startDate.getMonth()).toBe(9);     // oktober
        expect(ev.startDate.getDate()).toBe(16);
        expect(ev.startDate.getHours()).toBe(10);
        expect(ev.startDate.getMinutes()).toBe(30);
        expect(ev.endDate!.toISOString().slice(0, 10)).toBe('2026-10-18');
        expect(ev.venueName).toBe('Junibacken');
    });

    it('ensiffrig timme ("9:30") blir giltig ISO', () => {
        const ev = jsonLdToRawEvent(node([{ startDate: '2026-10-16', startTime: '9:30' }]), ALV)!;
        expect(ev.startDate.getHours()).toBe(9);
        expect(ev.startDate.getMinutes()).toBe(30);
    });

    it('utan startTime → datumet som förut (midnatt UTC = "bara datum")', () => {
        const ev = jsonLdToRawEvent(node([{ startDate: '2026-10-16', endDate: '2026-10-18' }]), ALV)!;
        expect(ev.startDate.toISOString()).toBe('2026-10-16T00:00:00.000Z');
    });

    it('startDate som redan bär klockslag rörs inte av startTime', () => {
        const ev = jsonLdToRawEvent(node([{ startDate: '2026-10-16T19:00:00', startTime: '10:30' }]), ALV)!;
        expect(ev.startDate.getHours()).toBe(19);
    });
});
