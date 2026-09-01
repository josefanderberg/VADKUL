import { describe, it, expect } from 'vitest';
import { isTrustedTicketSource, isAffiliateLink } from './ticketSources';

describe('isTrustedTicketSource', () => {
    it('känner igen de kuraterade biljettsystemen', () => {
        for (const u of [
            'https://www.ticketmaster.se/event/mamma-mia-the-party',
            'https://www.ticketmaster.dk/event/askepot',
            'https://ticketmaster.evyy.net/c/8469859/2038747/23885?u=x',
            'https://www.tickster.com/se/sv/events/abc',
            'https://billetto.se/e/lady-lovers-comedy-night-1964711',
            'https://nortic.se/event/12345',
        ]) expect(isTrustedTicketSource(u), u).toBe(true);
    });

    it('gäller inte vanliga arrangörssajter', () => {
        for (const u of [
            'https://www.visitstockholm.com/events/mamma-mia',
            'https://www.facebook.com/events/1113026937561482/',
            'https://kommunen.se/kalender',
        ]) expect(isTrustedTicketSource(u), u).toBe(false);
    });
});

describe('isAffiliateLink', () => {
    it('skiljer intäktslänken från den nakna biljettlänken', () => {
        expect(isAffiliateLink('https://ticketmaster.evyy.net/c/8469859/2038747/23885?u=x')).toBe(true);
        // Naken TM-länk ger ingen provision — den ska förlora dubblettvalet.
        expect(isAffiliateLink('https://www.ticketmaster.se/event/snarky-puppy')).toBe(false);
        expect(isAffiliateLink('https://www.visitstockholm.com/events/mamma-mia')).toBe(false);
    });
});
