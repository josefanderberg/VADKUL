import { describe, it, expect } from 'vitest';
import type { LinkEvent } from '@/types';
import {
    parseEventSeed,
    apiEventToLinkEvent,
    mergeDeepLinkEvent,
    EVENT_SEED_MAX_AGE_MS,
    type EventSeedRaw,
} from './eventSeed';

const NOW = 1_756_700_000_000; // fast klocka — testerna ska inte bero på Date.now()

const validSeed = (over: Partial<EventSeedRaw> = {}): string => JSON.stringify({
    v: 1,
    savedAt: NOW - 1000,
    id: 'https://example.se/event/1',
    title: 'Konsert i parken',
    t: NOW + 86_400_000,
    hasSpecificTime: true,
    lat: 56.88,
    lng: 14.81,
    locationName: 'Stadsparken',
    category: 'music',
    emoji: '🎸',
    hostName: 'Parkscenen',
    coverImage: 'https://example.se/bild.jpg',
    price: '120 kr',
    attendees: 3,
    description: 'En kväll med livemusik.',
    ...over,
});

describe('parseEventSeed', () => {
    it('bygger ett komplett LinkEvent av en giltig seed', () => {
        const ev = parseEventSeed(validSeed(), 'https://example.se/event/1', NOW)!;
        expect(ev).not.toBeNull();
        expect(ev.id).toBe('https://example.se/event/1');
        // url = id: url ÄR primärnyckeln för skrapade event (pipeline-regeln).
        expect(ev.url).toBe('https://example.se/event/1');
        expect(ev.title).toBe('Konsert i parken');
        expect(ev.time.getTime()).toBe(NOW + 86_400_000);
        expect(ev.lat).toBe(56.88);
        expect(ev.lng).toBe(14.81);
        expect(ev.hostName).toBe('Parkscenen');
        expect(ev.category).toBe('music');
        expect(ev.coverImage).toBe('https://example.se/bild.jpg');
        expect(ev.description).toBe('En kväll med livemusik.');
        expect(ev.price).toBe('120 kr');
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('avvisar seed för ett ANNAT event-id (kvarglömd seed får aldrig öppna fel kort)', () => {
        expect(parseEventSeed(validSeed(), 'https://example.se/event/2', NOW)).toBeNull();
    });

    it('avvisar för gammal seed', () => {
        const old = validSeed({ savedAt: NOW - EVENT_SEED_MAX_AGE_MS - 1 });
        expect(parseEventSeed(old, 'https://example.se/event/1', NOW)).toBeNull();
    });

    it('avvisar trasig JSON, fel version och saknad titel', () => {
        expect(parseEventSeed('inte json {', 'x', NOW)).toBeNull();
        expect(parseEventSeed(validSeed({ v: 2 as unknown as 1 }), 'https://example.se/event/1', NOW)).toBeNull();
        expect(parseEventSeed(validSeed({ title: '  ' }), 'https://example.se/event/1', NOW)).toBeNull();
        expect(parseEventSeed(validSeed({ t: Number.NaN }), 'https://example.se/event/1', NOW)).toBeNull();
    });

    it('sanerar ogiltiga koordinater till 0,0 (oplacerad — som destinations-mappningen)', () => {
        const ev = parseEventSeed(validSeed({ lat: 6_129_956, lng: 14.81 }), 'https://example.se/event/1', NOW)!;
        expect(ev.lat).toBe(0);
        expect(ev.lng).toBe(0);
    });

    it('utelämnade fält blir kortets "vet inte"-lägen', () => {
        const ev = parseEventSeed(
            validSeed({
                lat: undefined, lng: undefined, hostName: undefined, coverImage: undefined,
                description: undefined, category: undefined, price: undefined, attendees: undefined,
            }),
            'https://example.se/event/1', NOW,
        )!;
        expect(ev.hostName).toBe('');
        expect(ev.coverImage).toBe('');
        // undefined (inte '') → kortet visar "Hämtar beskrivning…" tills svar finns.
        expect(ev.description).toBeUndefined();
        expect(ev.category).toBe('other');
        expect(ev.attendees).toBe(0);
    });
});

describe('apiEventToLinkEvent', () => {
    const apiEvent = {
        id: 'https://example.se/event/1',
        title: 'Konsert i parken',
        time: '2026-09-05T18:00:00.000Z',
        endDate: '2026-09-05T21:00:00.000Z',
        hasSpecificTime: true,
        lat: 56.88,
        lng: 14.81,
        locationName: 'Stadsparken',
        category: 'music',
        hostName: 'Parkscenen',
        coverImage: 'https://example.se/bild.jpg',
        price: '120 kr',
        attendees: 3,
        isLocationVerified: true,
        url: 'https://example.se/biljetter',
        description: 'Hela långa programtexten.',
    };

    it('mappar API-svaret till ett LinkEvent', () => {
        const ev = apiEventToLinkEvent(apiEvent, apiEvent.id)!;
        expect(ev).not.toBeNull();
        expect(ev.time.toISOString()).toBe('2026-09-05T18:00:00.000Z');
        expect(ev.endDate?.toISOString()).toBe('2026-09-05T21:00:00.000Z');
        expect(ev.url).toBe('https://example.se/biljetter');
        expect(ev.isLocationVerified).toBe(true);
        expect(ev.description).toBe('Hela långa programtexten.');
    });

    it('avvisar fel id, otolkbar tid och skräp', () => {
        expect(apiEventToLinkEvent(apiEvent, 'annat-id')).toBeNull();
        expect(apiEventToLinkEvent({ ...apiEvent, time: 'inte-en-tid' }, apiEvent.id)).toBeNull();
        expect(apiEventToLinkEvent(null, apiEvent.id)).toBeNull();
        expect(apiEventToLinkEvent('sträng', apiEvent.id)).toBeNull();
    });

    it('släpper omvänt slutdatum (pipelinevakten: slut > start)', () => {
        const ev = apiEventToLinkEvent({ ...apiEvent, endDate: '2026-09-05T10:00:00.000Z' }, apiEvent.id)!;
        expect(ev.endDate).toBeUndefined();
    });
});

describe('mergeDeepLinkEvent', () => {
    const base = (over: Partial<LinkEvent> = {}): LinkEvent => ({
        id: 'ev1', url: 'ev1', title: 'Titel', time: new Date(NOW), createdAt: new Date(NOW),
        locationName: 'Platsen', lat: 56, lng: 14, hostName: 'Värden', category: 'music',
        coverImage: 'https://a.se/1.jpg', description: 'Kort text.', attendees: 2,
        hasSpecificTime: true,
        ...over,
    });

    it('returnerar base orörd när extra saknas eller gäller annat event', () => {
        const b = base();
        expect(mergeDeepLinkEvent(b, null)).toBe(b);
        expect(mergeDeepLinkEvent(b, base({ id: 'ev2' }))).toBe(b);
    });

    it('base vinner där den har innehåll; extra fyller luckorna', () => {
        const merged = mergeDeepLinkEvent(
            base({ hostName: '', coverImage: '', price: undefined }),
            base({ hostName: 'Seedvärden', coverImage: 'https://a.se/seed.jpg', price: '99 kr', locationName: 'Annan plats' }),
        );
        expect(merged.hostName).toBe('Seedvärden');
        expect(merged.coverImage).toBe('https://a.se/seed.jpg');
        expect(merged.price).toBe('99 kr');
        // base hade redan en plats — extra får inte skriva över.
        expect(merged.locationName).toBe('Platsen');
    });

    it('längsta beskrivningen vinner (seedens är kapad, API:ts/lagrens är hela)', () => {
        const long = 'En mycket längre beskrivning än basens korta.';
        expect(mergeDeepLinkEvent(base(), base({ description: long })).description).toBe(long);
        expect(mergeDeepLinkEvent(base({ description: long }), base()).description).toBe(long);
    });

    it('koordinater backfillas BARA när base är oplacerad (0,0)', () => {
        const placed = mergeDeepLinkEvent(base(), base({ lat: 59, lng: 18 }));
        expect(placed.lat).toBe(56);
        const unplaced = mergeDeepLinkEvent(base({ lat: 0, lng: 0 }), base({ lat: 59, lng: 18 }));
        expect(unplaced.lat).toBe(59);
        expect(unplaced.lng).toBe(18);
    });

    it("kategori-platshållaren 'other' ersätts av extras riktiga kategori", () => {
        expect(mergeDeepLinkEvent(base({ category: 'other' }), base({ category: 'sport' })).category).toBe('sport');
        expect(mergeDeepLinkEvent(base({ category: 'music' }), base({ category: 'sport' })).category).toBe('music');
    });
});
