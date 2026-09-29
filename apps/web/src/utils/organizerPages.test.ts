import { describe, expect, it } from 'vitest';
import { isOptInSourceUrl } from '@vadkul/kontrakt';
import { isFromOrganizer, organizerHref, organizerNameFromSlug, organizerPageSlug, topOrganizers } from './organizerPages';
import { classifySource } from './sources';

describe('organizerPageSlug', () => {
    it('ger sluggen för en vanlig arrangör', () => {
        expect(organizerPageSlug('Visit Linköping', 'https://visitlinkoping.se/event/1')).toBe('visit-linkoping');
    });
    it('normaliserar blanksteg i namnet', () => {
        expect(organizerPageSlug('  Visit   Linköping ', 'https://visitlinkoping.se/event/1')).toBe('visit-linkoping');
    });
    it('ingen sida för opt-in-källorna', () => {
        expect(organizerPageSlug('Åtvids församling', 'https://www.svenskakyrkan.se/atvid/kalender/1')).toBeNull();
        expect(organizerPageSlug('PRO Växjö', 'https://pro.se/distrikt/1')).toBeNull();
        expect(organizerPageSlug('Korpen Stockholm', 'https://korpenstockholm.zoezi.se/1')).toBeNull();
    });
    it('ingen sida för användarskapade event (id är inget URL)', () => {
        expect(organizerPageSlug('Anna', 'x1Y2z3AbCdEf')).toBeNull();
    });
    it('ingen sida för plattformar och källnamn', () => {
        expect(organizerPageSlug('Tickster', 'https://www.tickster.com/sv/events/1')).toBeNull();
        expect(organizerPageSlug('Facebook', 'https://www.facebook.com/events/1')).toBeNull();
        expect(organizerPageSlug(null, 'https://abf.se/1')).toBeNull();
    });
});

describe('organizerHref', () => {
    it('bygger adressen', () => {
        expect(organizerHref('visit-linkoping')).toBe('/arrangor/visit-linkoping');
    });
});

describe('topOrganizers', () => {
    const ev = (hostSlug: string | null, hostName: string) => ({ hostSlug, hostName });
    it('räknar per slug, kräver minsta antal och sorterar', () => {
        const events = [
            ev('abf', 'ABF'), ev('abf', 'ABF'), ev('abf', 'abf'),
            ev('visit-linkoping', 'Visit Linköping'), ev('visit-linkoping', 'Visit Linköping'),
            ev('visit-linkoping', 'Visit Linköping'), ev('visit-linkoping', 'Visit Linköping'),
            ev('liten', 'Liten'),
            ev(null, 'Utan sida'), ev(null, 'Utan sida'), ev(null, 'Utan sida'),
        ];
        expect(topOrganizers(events, 3, 10)).toEqual([
            { slug: 'visit-linkoping', name: 'Visit Linköping', count: 4 },
            { slug: 'abf', name: 'ABF', count: 3 },
        ]);
    });
    it('kapar vid n', () => {
        const events = ['a', 'b', 'c'].flatMap(s => [ev(s, s.toUpperCase()), ev(s, s.toUpperCase())]);
        expect(topOrganizers(events, 1, 2)).toHaveLength(2);
    });
});

describe('opt-in-reglerna räknar lika i kontraktet och kartans filter', () => {
    // Kontraktets isOptInSourceUrl speglar SOURCE_DEFS i utils/sources.ts.
    // Går det här rött har någon ändrat den ena utan den andra - då länkar
    // kartan till arrangörssidor som inte finns (eller tvärtom).
    it.each([
        'https://www.svenskakyrkan.se/atvid/kalender/1',
        'https://pro.se/distrikt/1',
        'https://vaxjo.pro.se/1',
        'https://korpenstockholm.zoezi.se/1',
        'https://visitlinkoping.se/1',
        'https://improv.se/1',
        'https://www.facebook.com/events/1',
    ])('%s', (url) => {
        expect(isOptInSourceUrl(url)).toBe(!!classifySource(url));
    });
});

describe('isFromOrganizer', () => {
    it('matchar arrangörens event oavsett blanksteg och versaler', () => {
        expect(isFromOrganizer('Visit Linköping', 'https://visitlinkoping.se/1', 'visit-linkoping')).toBe(true);
        expect(isFromOrganizer('visit  linköping', 'https://visitlinkoping.se/2', 'visit-linkoping')).toBe(true);
    });
    it('avvisar andra arrangörer och event utan sida', () => {
        expect(isFromOrganizer('ABF', 'https://abf.se/1', 'visit-linkoping')).toBe(false);
        expect(isFromOrganizer(null, 'https://abf.se/1', 'abf')).toBe(false);
        // Samma namn men opt-in-källa: ingen sida, alltså ingen träff.
        expect(isFromOrganizer('Korpen Linköping', 'https://korpenlinkoping.zoezi.se/1', 'korpen-linkoping')).toBe(false);
        // Användarskapat event med samma namn (id är inget URL).
        expect(isFromOrganizer('ABF', 'x1Y2z3', 'abf')).toBe(false);
    });
    it('ger samma svar som organizerPageSlug', () => {
        const fall: [string, string][] = [
            ['Visit Linköping', 'https://visitlinkoping.se/1'],
            ['Tickster', 'https://www.tickster.com/1'],
            ['Åtvids församling', 'https://www.svenskakyrkan.se/1'],
            ['Kultur & Fritid', 'https://kultur.se/1'],
        ];
        for (const [namn, url] of fall) {
            const slug = organizerPageSlug(namn, url);
            if (slug) expect(isFromOrganizer(namn, url, slug)).toBe(true);
        }
    });
});

describe('organizerNameFromSlug', () => {
    it('gör en läsbar reserv', () => {
        expect(organizerNameFromSlug('visit-linkoping')).toBe('Visit linkoping');
    });
});
