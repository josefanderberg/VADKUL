import { describe, expect, it } from 'vitest';
import * as original from '@vadkul/kontrakt';
import * as kopia from './organizerPage';

// Kopian (ts-node kan inte läsa ESM-paketet) måste räkna EXAKT som
// originalet i packages/kontrakt - annars pekar studions länkar på
// arrangörssidor som inte finns. Går det här rött: synka kopian.
const NAMN = [
    'Visit Linköping', 'ABF', 'Borås TME', 'Kultur & Fritid Växjö', '  Café  Ümeå – Scen! ',
    'ÅÄÖ åäö', 'Facebook', 'Tickster', 'AB', '', 'Åtvids församling', 'Korpen Stockholm',
];
const URLER = [
    'https://visitlinkoping.se/event/1', 'https://www.facebook.com/events/1',
    'https://www.tickster.com/sv/events/1', 'https://www.svenskakyrkan.se/atvid/1',
    'https://pro.se/1', 'https://vaxjo.pro.se/1', 'https://korpenstockholm.zoezi.se/1',
    'https://WWW.Abf.se/1', 'inte-en-url', '',
];

describe('organizerPage-kopian räknar som kontraktet', () => {
    it('organizerSlug', () => {
        for (const n of NAMN) expect(kopia.organizerSlug(n)).toBe(original.organizerSlug(n));
    });
    it('organizerDomain och isOptInSourceUrl', () => {
        for (const u of URLER) {
            expect(kopia.organizerDomain(u)).toBe(original.organizerDomain(u));
            expect(kopia.isOptInSourceUrl(u)).toBe(original.isOptInSourceUrl(u));
        }
    });
    it('isOrganizerCandidate och organizerPageSlug för alla kombinationer', () => {
        for (const n of NAMN) for (const u of URLER) {
            expect(kopia.isOrganizerCandidate(n, u)).toBe(original.isOrganizerCandidate(n, u));
            expect(kopia.organizerPageSlug(n, u)).toBe(original.organizerPageSlug(n, u));
        }
    });
    it('samma plattformsregex', () => {
        expect(kopia.ORGANIZER_PLATFORM_DOMAINS.source).toBe(original.ORGANIZER_PLATFORM_DOMAINS.source);
    });
});
