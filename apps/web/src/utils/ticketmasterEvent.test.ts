import { describe, it, expect } from 'vitest';
import { isTicketmasterEvent } from './ticketmasterEvent';

describe('isTicketmasterEvent', () => {
    it('känner igen rena ticketmaster.se-adresser (id-fältet)', () => {
        expect(isTicketmasterEvent({ id: 'https://www.ticketmaster.se/event/foo-tickets/123' })).toBe(true);
        expect(isTicketmasterEvent({ id: 'https://ticketmaster.se/event/foo/1' })).toBe(true);
    });

    it('känner igen vår affiliate-redirect (url-fältet efter wrappen)', () => {
        expect(isTicketmasterEvent({
            id: 'https://www.ticketmaster.se/event/foo/123',
            url: 'https://ticketmaster.evyy.net/c/7528311/2038747/23885?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Ffoo%2F123&utm_medium=affiliate',
        })).toBe(true);
    });

    it('känner igen redirect-erans evyy-id:n (gamla rader)', () => {
        expect(isTicketmasterEvent({
            id: 'https://ticketmaster.evyy.net/c/8469859/476403/9251?u=https%3A%2F%2Fwww.ticketmaster.se%2Fevent%2Fbar%2F456',
        })).toBe(true);
    });

    it('nekar andra arrangörer', () => {
        expect(isTicketmasterEvent({ id: 'https://www.facebook.com/events/1043758228197158/', url: 'https://www.facebook.com/events/1043758228197158/' })).toBe(false);
        expect(isTicketmasterEvent({ id: 'https://visitpitea.se/evenemang/sommarloppis/' })).toBe(false);
    });

    it('luras inte av ticketmaster i främmande domän', () => {
        expect(isTicketmasterEvent({ url: 'https://ticketmaster.se.evil.example/event/foo' })).toBe(false);
        expect(isTicketmasterEvent({ url: 'https://evil.example/?u=https://www.ticketmaster.se/x' })).toBe(false);
    });

    it('tål userCreated-id:n som inte är URL:er, null och tomt', () => {
        expect(isTicketmasterEvent({ id: 'abc123def' })).toBe(false);
        expect(isTicketmasterEvent({ id: '', url: '' })).toBe(false);
        expect(isTicketmasterEvent(null)).toBe(false);
        expect(isTicketmasterEvent(undefined)).toBe(false);
    });
});
