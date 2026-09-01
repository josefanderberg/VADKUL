import { describe, it, expect } from 'vitest';
import { buildDeepLinkEventIndex, usableImageUrl } from './deepLinkEventIndex';

const dest = (over: Record<string, unknown> = {}) => ({
    id: 'https://example.se/event/1',
    title: 'Konsert i parken',
    time: '2026-09-05T18:00:00.000Z',
    hasSpecificTime: true,
    lat: 56.88,
    lng: 14.81,
    locationName: 'Stadsparken',
    category: 'music',
    ...over,
});

describe('buildDeepLinkEventIndex', () => {
    it('slår ihop destinations + cards + descriptions till ett uppslag per id', () => {
        const index = buildDeepLinkEventIndex(
            [dest()],
            [{ id: 'https://example.se/event/1', hostName: 'Parkscenen', coverImage: 'https://example.se/b.jpg', price: '120 kr', attendees: 3, isHostVerified: true, url: 'https://example.se/biljetter' }],
            { 'https://example.se/event/1': 'Hela programtexten.' },
        );
        const ev = index.get('https://example.se/event/1')!;
        expect(ev.title).toBe('Konsert i parken');
        expect(ev.hostName).toBe('Parkscenen');
        expect(ev.coverImage).toBe('https://example.se/b.jpg');
        expect(ev.price).toBe('120 kr');
        expect(ev.attendees).toBe(3);
        expect(ev.isHostVerified).toBe(true);
        expect(ev.url).toBe('https://example.se/biljetter');
        expect(ev.description).toBe('Hela programtexten.');
    });

    it('klarar event utan kort och utan beskrivning — valfria fält utelämnas', () => {
        const index = buildDeepLinkEventIndex([dest()], [], {});
        const ev = index.get('https://example.se/event/1')!;
        expect(ev.hostName).toBeUndefined();
        expect(ev.description).toBeUndefined();
        expect(ev.lat).toBe(56.88);
        // JSON-svaret ska vara litet: inga nycklar för fält utan innehåll.
        expect('coverImage' in ev).toBe(false);
    });

    it('filtrerar skräpbilder (data:-platshållare och rotrelativa sökvägar) vid inläsningen', () => {
        const index = buildDeepLinkEventIndex(
            [dest({ id: 'a' }), dest({ id: 'b' })],
            [
                { id: 'a', coverImage: 'data:image/svg+xml;base64,AAAA' },
                { id: 'b', coverImage: '/images/lokal.jpg' },
            ],
            {},
        );
        expect(index.get('a')!.coverImage).toBeUndefined();
        expect(index.get('b')!.coverImage).toBeUndefined();
    });

    it('hoppar över trasiga rader (saknat id/titel/tid) utan att fälla bygget', () => {
        const index = buildDeepLinkEventIndex(
            [dest(), null, 'sträng', dest({ id: '' }), dest({ id: 'x', title: undefined }), dest({ id: 'y', time: undefined })],
            [],
            {},
        );
        expect(index.size).toBe(1);
    });

    it('tom prissträng utelämnas, 0 anmälda utelämnas', () => {
        const index = buildDeepLinkEventIndex(
            [dest()],
            [{ id: 'https://example.se/event/1', price: '', attendees: 0 }],
            {},
        );
        const ev = index.get('https://example.se/event/1')!;
        expect('price' in ev).toBe(false);
        expect('attendees' in ev).toBe(false);
    });
});

describe('usableImageUrl', () => {
    it('släpper bara absoluta http(s)-adresser', () => {
        expect(usableImageUrl('https://a.se/b.jpg')).toBe('https://a.se/b.jpg');
        expect(usableImageUrl('http://a.se/b.jpg')).toBe('http://a.se/b.jpg');
        expect(usableImageUrl('data:image/png;base64,AA')).toBeUndefined();
        expect(usableImageUrl('/images/b.jpg')).toBeUndefined();
        expect(usableImageUrl('')).toBeUndefined();
        expect(usableImageUrl(undefined)).toBeUndefined();
        expect(usableImageUrl(42)).toBeUndefined();
    });
});
