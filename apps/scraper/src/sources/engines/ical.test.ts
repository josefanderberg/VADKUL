import { describe, it, expect } from 'vitest';
import { synthesizeUrl, splitIcsLocation } from './ical';

describe('synthesizeUrl', () => {
    // Blockeraren som gjorde motorn oanvändbar för Google Calendar-feeds: utan
    // unik url dedupas hela feeden ner till ett event (url = primärnyckel).
    it('ger varje UID en egen url', () => {
        const page = 'https://www.markaryd.com/evenemang-i-markaryd';
        const a = synthesizeUrl(page, '3lb0lmldbdahqlhj1f0jarhg4n@google.com');
        const b = synthesizeUrl(page, 'annat-uid@google.com');
        expect(a).not.toBe(b);
        expect(a.startsWith(page)).toBe(true);
    });

    it('är stabil mellan körningar för samma UID', () => {
        expect(synthesizeUrl('https://x.se/kalender', 'uid-1'))
            .toBe(synthesizeUrl('https://x.se/kalender', 'uid-1'));
    });

    it('respekterar befintlig query-sträng', () => {
        expect(synthesizeUrl('https://x.se/k?sida=2', 'uid-1'))
            .toBe('https://x.se/k?sida=2&uid=uid-1');
    });

    it('faller tillbaka på sidan när UID saknas', () => {
        expect(synthesizeUrl('https://x.se/kalender', undefined)).toBe('https://x.se/kalender');
    });

    it('url-kodar UID:t', () => {
        expect(synthesizeUrl('https://x.se/k', 'a b@google.com')).toBe('https://x.se/k?uid=a%20b%40google.com');
    });
});

describe('splitIcsLocation', () => {
    it('plockar venue och ort ur en full adress', () => {
        expect(splitIcsLocation('Musikhuset i Markaryd, Drottninggatan 54, 285 38 Markaryd, Sverige'))
            .toEqual({
                venueName: 'Musikhuset i Markaryd',
                address: 'Musikhuset i Markaryd, Drottninggatan 54, 285 38 Markaryd',
                city: 'Markaryd',
            });
    });

    it('behåller ett ensamt segment som venue utan att hitta på adress', () => {
        expect(splitIcsLocation('Kulturhuset i Markaryd', 'Markaryd'))
            .toEqual({ venueName: 'Kulturhuset i Markaryd', address: undefined, city: 'Markaryd' });
    });

    it('faller tillbaka på defaultCity när postnummer saknas', () => {
        expect(splitIcsLocation('Verdandilokalen, Strömsnäsbruk', 'Markaryd').city).toBe('Markaryd');
    });

    it('klarar tom LOCATION', () => {
        expect(splitIcsLocation(undefined, 'Markaryd')).toEqual({ city: 'Markaryd' });
    });

    it('postnumret vinner över defaultCity', () => {
        expect(splitIcsLocation('Bruksparken, Storgatan 1, 287 31 Strömsnäsbruk', 'Markaryd').city)
            .toBe('Strömsnäsbruk');
    });
});
