import { describe, it, expect } from 'vitest';
import { isGenericHost, cleanHostName, hostFromOgDescription, hostFromPageJson } from './hostFallback';

describe('isGenericHost', () => {
    it('känner igen instrumentets fallback och tomt', () => {
        expect(isGenericHost('Facebook')).toBe(true);
        expect(isGenericHost('')).toBe(true);
        expect(isGenericHost(null)).toBe(true);
        expect(isGenericHost('Okänd')).toBe(true);
        expect(isGenericHost('Kalix Kommun')).toBe(false);
    });
});

describe('hostFromOgDescription', () => {
    it('plockar värden ur "Evenemang av X · …"', () => {
        expect(hostFromOgDescription('Evenemang av Ljungby Taekwon-do ITF · Torsdag 3 september 2026 kl. 10:00')).toBe('Ljungby Taekwon-do ITF');
        expect(hostFromOgDescription('Event by Fasching · Stockholm')).toBe('Fasching');
        expect(hostFromOgDescription('Höstfest!\nEvenemang av Kalix Kommun och Kalix bibliotek\nLördag 6 september')).toBe('Kalix Kommun och Kalix bibliotek');
    });
    it('null utan trigger eller när namnet är generiskt', () => {
        expect(hostFromOgDescription('Välkommen på konsert i kväll!')).toBeNull();
        expect(hostFromOgDescription('Evenemang av Facebook · idag')).toBeNull();
        expect(hostFromOgDescription(null)).toBeNull();
    });
});

describe('hostFromPageJson', () => {
    it('event_creator / hosts / owner ur Relay-JSON, med unicode-escapes avkodade', () => {
        expect(hostFromPageJson('{"event_creator":{"__typename":"Page","id":"1","name":"V\\u00e4xj\\u00f6dyksport"}}')).toBe('Växjödyksport');
        expect(hostFromPageJson('"event_hosts":[{"__typename":"User","name":"Peter Logozar","id":"2"}]')).toBe('Peter Logozar');
        expect(hostFromPageJson('"owner":{"__typename":"Page","id":"9","name":"Kappa Bar Malm\\u00f6"}')).toBe('Kappa Bar Malmö');
    });
    it('hoppar generiska/orimliga namn och saknad JSON', () => {
        expect(hostFromPageJson('"host_name":"Facebook"')).toBeNull();
        expect(hostFromPageJson('<html>inget json</html>')).toBeNull();
        expect(hostFromPageJson(null)).toBeNull();
    });
});

describe('cleanHostName', () => {
    it('tvättar FB-svansar', () => {
        expect(cleanHostName('Trafikspecialisten3 tidigare evenemang')).toBe('Trafikspecialisten');
        expect(cleanHostName('Bio Roy · Sida · Biograf')).toBe('Bio Roy');
        expect(cleanHostName('Gretas G\\u00f6teborgMeddelande')).toBe('Gretas Göteborg');
    });
    it('släpper datum- och intresse-svansen ur og:description (12/10)', () => {
        expect(cleanHostName('Folkuniversitetet Syd den onsdag, oktober 14 2026 med 167 intresserade.')).toBe('Folkuniversitetet Syd');
        expect(cleanHostName('Eyragården, Kävlinge Kommun den onsdag, oktober 14 2026')).toBe('Eyragården, Kävlinge Kommun');
        expect(cleanHostName('Malmö Opera on Friday, October 16 2026 with 12 people interested')).toBe('Malmö Opera');
        expect(cleanHostName('Klubb Lördag')).toBe('Klubb Lördag');
        expect(cleanHostName('Jazz on Sunday')).toBe('Jazz on Sunday');
    });
});
