import { describe, it, expect } from 'vitest';
import { isAffiliateUrl } from './affiliateLink';

describe('isAffiliateUrl', () => {
    it('känner igen vår Impact-wrappade Ticketmaster-länk (SE)', () => {
        expect(isAffiliateUrl(
            'https://ticketmaster.evyy.net/c/7528311/2038747/23885?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2F123&utm_medium=affiliate',
        )).toBe(true);
    });

    it('känner igen övriga redirect-nätverk ur samma regex som pipelinen', () => {
        expect(isAffiliateUrl('https://foo.sjv.io/c/1/2/3?u=https%3A%2F%2Fx.se')).toBe(true);
        expect(isAffiliateUrl('https://partner.prf.hn/click/abc')).toBe(true);
        expect(isAffiliateUrl('https://track.i123.net/x')).toBe(true);
    });

    it('fångar utm_medium=affiliate även på okänd redirect-domän', () => {
        expect(isAffiliateUrl('https://nya-natverket.example.com/r?utm_medium=affiliate')).toBe(true);
    });

    it('markerar INTE vanliga biljettlänkar', () => {
        expect(isAffiliateUrl('https://www.ticketmaster.se/event/123')).toBe(false);
        expect(isAffiliateUrl('https://www.tickster.com/sv/events/abc')).toBe(false);
        expect(isAffiliateUrl('https://billetto.se/e/xyz')).toBe(false);
        expect(isAffiliateUrl('https://www.facebook.com/events/1/')).toBe(false);
    });

    it('markerar INTE bar nätverksdomän utan subdomän (samma semantik som pipelinen)', () => {
        expect(isAffiliateUrl('https://evyy.net/c/1/2/3')).toBe(false);
    });

    it('tål tomt, null och trasiga URL:er', () => {
        expect(isAffiliateUrl('')).toBe(false);
        expect(isAffiliateUrl(null)).toBe(false);
        expect(isAffiliateUrl(undefined)).toBe(false);
        expect(isAffiliateUrl('inte en url')).toBe(false);
    });
});
