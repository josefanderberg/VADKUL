import { describe, it, expect } from 'vitest';
import {
    weekendRange, isoWeekId, haversineKm, pickWeekendDigest, digestPushText,
    DIGEST_MIN_EVENTS,
    type DigestEvent, type DigestCityPoint,
} from './weekendDigest';

const UPPSALA: DigestCityPoint = { slug: 'uppsala', name: 'Uppsala', lat: 59.8586, lng: 17.6389 };

/** Event mitt i Uppsala en given ISO-tid. */
const evt = (id: string, time: string, extra: Partial<DigestEvent> = {}): DigestEvent => ({
    id, title: `Event ${id}`, time, lat: 59.8586, lng: 17.6389, hasSpecificTime: true, ...extra,
});

describe('weekendRange', () => {
    it('torsdag (utskicksdagen) → kommande helg, i svensk sommartid', () => {
        // Tor 17 sep 2026 kl 16:30 svensk tid.
        const r = weekendRange(new Date('2026-09-17T14:30:00.000Z'));
        // Fre 18 sep 00:00 CEST … mån 21 sep 00:00 CEST.
        expect(r.start.toISOString()).toBe('2026-09-17T22:00:00.000Z');
        expect(r.end.toISOString()).toBe('2026-09-20T22:00:00.000Z');
    });

    it('lördag/söndag (manuell körning) → INNEVARANDE helg', () => {
        // Sön 13 sep 2026.
        const r = weekendRange(new Date('2026-09-13T10:00:00.000Z'));
        expect(r.start.toISOString()).toBe('2026-09-10T22:00:00.000Z'); // fre 11 sep
        expect(r.end.toISOString()).toBe('2026-09-13T22:00:00.000Z');   // mån 14 sep
    });

    it('helgen då sommartiden tar slut får CEST-start och CET-slut', () => {
        // Tor 22 okt 2026; sommartiden slutar sön 25 okt.
        const r = weekendRange(new Date('2026-10-22T14:30:00.000Z'));
        expect(r.start.toISOString()).toBe('2026-10-22T22:00:00.000Z'); // fre 00:00 CEST
        expect(r.end.toISOString()).toBe('2026-10-25T23:00:00.000Z');   // mån 00:00 CET
    });
});

describe('isoWeekId', () => {
    it('räknar ISO-vecka på svenskt väggdatum', () => {
        expect(isoWeekId(new Date('2026-09-17T14:30:00.000Z'))).toBe('2026-W38');
        expect(isoWeekId(new Date('2026-09-11T10:00:00.000Z'))).toBe('2026-W37');
    });

    it('årsskiftet: 1 jan 2027 (fredag) hör till 2026-W53', () => {
        expect(isoWeekId(new Date('2027-01-01T12:00:00.000Z'))).toBe('2026-W53');
    });
});

describe('haversineKm', () => {
    it('Uppsala–Stockholm är ~63 km', () => {
        const km = haversineKm(59.8586, 17.6389, 59.3293, 18.0686);
        expect(km).toBeGreaterThan(55);
        expect(km).toBeLessThan(70);
    });
});

describe('pickWeekendDigest', () => {
    // Helgen fre 18–sön 20 sep 2026 (svensk tid).
    const range = weekendRange(new Date('2026-09-17T14:30:00.000Z'));

    it('null när helgen är för tunn (under tröskeln)', () => {
        const events = [evt('a', '2026-09-18T17:00:00.000Z'), evt('b', '2026-09-19T17:00:00.000Z')];
        expect(events.length).toBeLessThan(DIGEST_MIN_EVENTS);
        expect(pickWeekendDigest(events, UPPSALA, range)).toBeNull();
    });

    it('räknar bara event inom radien, i fönstret och med riktig position', () => {
        const events = [
            evt('fre', '2026-09-18T17:00:00.000Z'),
            evt('lor', '2026-09-19T17:00:00.000Z'),
            evt('son', '2026-09-20T12:00:00.000Z'),
            evt('stockholm', '2026-09-19T17:00:00.000Z', { lat: 59.3293, lng: 18.0686 }), // >10 km bort
            evt('mandag', '2026-09-21T17:00:00.000Z'),   // efter helgen
            evt('torsdag', '2026-09-17T17:00:00.000Z'),  // före helgen
            evt('nollo', '2026-09-19T17:00:00.000Z', { lat: 0, lng: 0 }), // plats saknas
        ];
        const res = pickWeekendDigest(events, UPPSALA, range);
        expect(res).not.toBeNull();
        expect(res!.count).toBe(3);
        expect(res!.picks.map(p => p.id).sort()).toEqual(['fre', 'lor', 'son']);
    });

    it('en pick per dag, populära först inom dagen', () => {
        const events = [
            evt('fre-vanlig', '2026-09-18T15:00:00.000Z'),
            evt('fre-pop', '2026-09-18T18:00:00.000Z', { pop: true }),
            evt('lor', '2026-09-19T17:00:00.000Z'),
            evt('son', '2026-09-20T12:00:00.000Z'),
        ];
        const res = pickWeekendDigest(events, UPPSALA, range)!;
        expect(res.picks.map(p => p.id)).toEqual(['fre-pop', 'lor', 'son']);
    });

    it('familj räknas i totalen men lyfts inte i texten', () => {
        const events = [
            evt('familj', '2026-09-18T09:00:00.000Z', { category: 'family' }),
            evt('musik', '2026-09-19T17:00:00.000Z', { category: 'music' }),
            evt('sport', '2026-09-20T12:00:00.000Z', { category: 'sport' }),
        ];
        const res = pickWeekendDigest(events, UPPSALA, range)!;
        expect(res.count).toBe(3);
        expect(res.picks.map(p => p.id).sort()).toEqual(['musik', 'sport']);
    });

    it('heldagsevent på söndag (svensk midnatt) hör till helgen', () => {
        const events = [
            evt('fre', '2026-09-18T17:00:00.000Z'),
            evt('lor', '2026-09-19T17:00:00.000Z'),
            // Sön 20 sep 00:00 CEST utan klockslag.
            evt('son-heldag', '2026-09-19T22:00:00.000Z', { hasSpecificTime: false }),
        ];
        const res = pickWeekendDigest(events, UPPSALA, range)!;
        expect(res.count).toBe(3);
        expect(res.picks.map(p => p.id)).toContain('son-heldag');
    });
});

describe('digestPushText', () => {
    it('bygger dag-för-dag-kropp med "och X till"', () => {
        const picks = [
            evt('a', '2026-09-18T17:00:00.000Z'),
            evt('b', '2026-09-19T17:00:00.000Z'),
            evt('c', '2026-09-20T12:00:00.000Z'),
        ];
        picks[0].title = 'Konsert i Botan';
        picks[1].title = 'Höstloppis på Vaksala torg';
        picks[2].title = 'Söndagsvernissage';
        const { title, body } = digestPushText(UPPSALA, 17, picks);
        expect(title).toBe('🎉 I helgen i Uppsala: 17 event');
        expect(body).toBe('Fre: Konsert i Botan · Lör: Höstloppis på Vaksala torg · Sön: Söndagsvernissage — och 14 till.');
    });

    it('kapar långa titlar med ellips', () => {
        const p = evt('x', '2026-09-18T17:00:00.000Z');
        p.title = 'En alldeles orimligt lång eventtitel som aldrig får plats i en push';
        const { body } = digestPushText(UPPSALA, 3, [p]);
        expect(body.length).toBeLessThan(60);
        expect(body).toContain('…');
    });
});
