import { describe, expect, it } from 'vitest';
import { isOptInSourceUrl, isOrganizerCandidate, organizerDomain, organizerPageSlug, organizerSlug } from './organizer';

// FACIT: går något rött här har utskickade /arrangor/-länkar brutits (mejl,
// arrangörernas länkar till sin sida) - backa ändringen hellre än att skriva
// om facit.
const SLUG_FACIT: [string, string][] = [
    ['Visit Linköping', 'visit-linkoping'],
    ['ABF', 'abf'],
    ['Borås TME', 'boras-tme'],
    ['Studieförbundet Vuxenskolan', 'studieforbundet-vuxenskolan'],
    ['Kultur & Fritid Växjö', 'kultur-och-fritid-vaxjo'],
    ['  Café  Ümeå – Scen! ', 'cafe-umea-scen'],
    ['ÅÄÖ åäö', 'aao-aao'],
    ['Destination Uppsala', 'destination-uppsala'],
];

describe('organizerSlug', () => {
    it.each(SLUG_FACIT)('%s -> %s', (namn, slug) => {
        expect(organizerSlug(namn)).toBe(slug);
    });
    it('kapar vid 80 tecken utan avslutande bindestreck', () => {
        const s = organizerSlug(`${'a'.repeat(79)} b`);
        expect(s.length).toBeLessThanOrEqual(80);
        expect(s.endsWith('-')).toBe(false);
    });
});

describe('organizerDomain', () => {
    it('tar bort www och gör gemener', () => {
        expect(organizerDomain('https://WWW.VisitLinkoping.se/event/1')).toBe('visitlinkoping.se');
    });
    it('ger null för icke-URL:er', () => {
        expect(organizerDomain('abc')).toBeNull();
        expect(organizerDomain(undefined)).toBeNull();
    });
});

describe('isOrganizerCandidate', () => {
    it('godtar en vanlig arrangör', () => {
        expect(isOrganizerCandidate('Visit Linköping', 'https://visitlinkoping.se/e/1')).toBe(true);
    });
    it('godtar Facebook-arrangörer med riktigt namn', () => {
        expect(isOrganizerCandidate('Kulturföreningen', 'https://www.facebook.com/events/1')).toBe(true);
    });
    it('avvisar källnamn, plattformar och tomt', () => {
        expect(isOrganizerCandidate('Facebook', 'https://www.facebook.com/events/1')).toBe(false);
        expect(isOrganizerCandidate('Arrangör AB', 'https://www.tickster.com/sv/events/1')).toBe(false);
        expect(isOrganizerCandidate('Någon', 'https://www.ticketmaster.se/event/1')).toBe(false);
        expect(isOrganizerCandidate('', 'https://abf.se/1')).toBe(false);
        expect(isOrganizerCandidate('AB', 'https://abf.se/1')).toBe(false);
        expect(isOrganizerCandidate('ABF', 'inte-en-url')).toBe(false);
    });
});

describe('isOptInSourceUrl', () => {
    it('känner igen Svenska kyrkan, PRO och Korpen', () => {
        expect(isOptInSourceUrl('https://www.svenskakyrkan.se/atvid/kalender/1')).toBe(true);
        expect(isOptInSourceUrl('https://pro.se/distrikt/1')).toBe(true);
        expect(isOptInSourceUrl('https://vaxjo.pro.se/1')).toBe(true);
        expect(isOptInSourceUrl('https://korpenstockholm.zoezi.se/1')).toBe(true);
    });
    it('släpper igenom övriga och icke-URL:er', () => {
        expect(isOptInSourceUrl('https://visitlinkoping.se/1')).toBe(false);
        expect(isOptInSourceUrl('https://improv.se/1')).toBe(false);
        expect(isOptInSourceUrl('abc')).toBe(false);
    });
});

describe('organizerPageSlug', () => {
    it('ger sluggen för en vanlig arrangör, med normaliserade blanksteg', () => {
        expect(organizerPageSlug('  Visit   Linköping ', 'https://visitlinkoping.se/event/1')).toBe('visit-linkoping');
    });
    it('ingen sida för opt-in-källor, användarskapade och plattformar', () => {
        expect(organizerPageSlug('Åtvids församling', 'https://www.svenskakyrkan.se/atvid/1')).toBeNull();
        expect(organizerPageSlug('Anna', 'x1Y2z3AbCdEf')).toBeNull();
        expect(organizerPageSlug('Tickster', 'https://www.tickster.com/sv/events/1')).toBeNull();
    });
});
