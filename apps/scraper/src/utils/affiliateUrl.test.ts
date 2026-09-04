import { describe, it, expect } from 'vitest';
import { publicUrl } from './affiliateUrl';

const OUR = 'https://ticketmaster.evyy.net/c/7528311/2038747/23885';

describe('publicUrl', () => {
    it('wrappar rena ticketmaster.se-URL:er i vår Impact-redirect', () => {
        expect(publicUrl('https://www.ticketmaster.se/event/foo-tickets/123'))
            .toBe(`${OUR}?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Ffoo-tickets%2F123&utm_medium=affiliate`);
    });

    it('behåller destinationens egna query-parametrar i u=', () => {
        expect(publicUrl('https://www.ticketmaster.se/event/foo/123?language=en-us'))
            .toBe(`${OUR}?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Ffoo%2F123%3Flanguage%3Den-us&utm_medium=affiliate`);
    });

    it('är idempotent: vår egen redirect packas upp och blir samma länk igen', () => {
        const once = publicUrl('https://www.ticketmaster.se/event/foo/123');
        expect(publicUrl(once)).toBe(once);
    });

    it('främmande Impact-redirect (8469859) blir VÅR länk till samma destination', () => {
        const foreign = 'https://ticketmaster.evyy.net/c/8469859/476403/9251'
            + '?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Fbar%2F456';
        expect(publicUrl(foreign))
            .toBe(`${OUR}?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Fbar%2F456&utm_medium=affiliate`);
    });

    it('strippar främmande ?c=8469859&ac= innan wrappen (ingen dubbel spårning i u=)', () => {
        expect(publicUrl('https://www.ticketmaster.se/event/baz/789?c=8469859&ac=1'))
            .toBe(`${OUR}?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Fbaz%2F789&utm_medium=affiliate`);
    });

    it('rör inte icke-Ticketmaster-URL:er', () => {
        const fb = 'https://www.facebook.com/events/1043758228197158/';
        expect(publicUrl(fb)).toBe(fb);
    });

    it('wrappar .dk och .no med SINA marknadslänkar (SE-mallen ger 404 där)', () => {
        expect(publicUrl('https://www.ticketmaster.dk/event/foo/123'))
            .toBe('https://ticketmaster.evyy.net/c/7528311/1958964/23893?u=https%3A%2F%2Fwww.ticketmaster.dk%2Fevent%2Ffoo%2F123&utm_medium=affiliate');
        expect(publicUrl('https://www.ticketmaster.no/event/foo/123'))
            .toBe('https://ticketmaster.evyy.net/c/7528311/1958977/23900?u=https%3A%2F%2Fwww.ticketmaster.no%2Fevent%2Ffoo%2F123&utm_medium=affiliate');
    });

    it('är idempotent även för dk/no', () => {
        const once = publicUrl('https://www.ticketmaster.dk/event/foo/123');
        expect(publicUrl(once)).toBe(once);
    });

    it('marknader utan egen mall (.com) wrappas INTE — fel lands länk är värre än ingen', () => {
        const com = 'https://www.ticketmaster.com/event/foo/123';
        expect(publicUrl(com)).toBe(com);
    });

    it('gamla .dk-länkar med främmande ?c=8469859 städas och wrappas med DK-mallen', () => {
        expect(publicUrl('https://www.ticketmaster.dk/event/foredrag/120173681?language=en-us&c=8469859&ac=1'))
            .toBe('https://ticketmaster.evyy.net/c/7528311/1958964/23893?u=https%3A%2F%2Fwww.ticketmaster.dk%2Fevent%2Fforedrag%2F120173681%3Flanguage%3Den-us&utm_medium=affiliate');
    });

    it('universe.com med ref strippas men wrappas inte', () => {
        expect(publicUrl('https://www.universe.com/events/foo?ref=abc&c=1&ac=2'))
            .toBe('https://www.universe.com/events/foo');
    });

    it('sjv.io-redirect med url= packas upp', () => {
        expect(publicUrl('https://brand.sjv.io/c/111/222/333?url=https%3A%2F%2Fexample.com%2Fx'))
            .toBe('https://example.com/x');
    });

    it('utm_medium=affiliate strippas från icke-TM-länkar (gamla beteendet)', () => {
        expect(publicUrl('https://example.com/x?utm_medium=affiliate'))
            .toBe('https://example.com/x');
    });

    it('ogiltig URL returneras orörd', () => {
        expect(publicUrl('inte en url')).toBe('inte en url');
        expect(publicUrl('')).toBe('');
    });

    it('luras inte av ticketmaster i subdomän på annan domän', () => {
        const evil = 'https://ticketmaster.se.evil.example/event/foo';
        expect(publicUrl(evil)).toBe(evil);
    });
});
