import { describe, it, expect } from 'vitest';
import { CITIES as CITY_PAGES } from './cityPages';
import { findCityPoint } from './cityPoints';
import { parseAccountStartChoice, parseChosenCity, popularStartCities } from './startChoice';

describe('startstaden täcker alla städer', () => {
    it('varje stadssida går att välja som startstad', () => {
        const missing = CITY_PAGES.filter(c => !findCityPoint(c.name)).map(c => c.name);
        expect(missing).toEqual([]);
    });

    it('snabbvalen är stadssidor, största först, utan dubbletter', () => {
        const top = popularStartCities(5);
        expect(top.map(c => c.name)).toEqual(['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping']);
        expect(new Set(top).size).toBe(top.length);
    });
});

describe('parseChosenCity', () => {
    it('slår upp ortnamnet i listan, koordinaterna kommer ur listan', () => {
        const c = parseChosenCity('Växjö');
        expect(c?.name).toBe('Växjö');
        expect(c?.lat).toBeGreaterThan(56);
    });

    it('tomt eller okänt namn ger null', () => {
        expect(parseChosenCity(null)).toBeNull();
        expect(parseChosenCity('')).toBeNull();
        expect(parseChosenCity('Atlantis')).toBeNull();
    });
});

describe('parseAccountStartChoice', () => {
    it('null = där jag är, saknas/skräp = aldrig frågat', () => {
        expect(parseAccountStartChoice(null)).toEqual({ kind: 'here' });
        expect(parseAccountStartChoice(undefined)).toEqual({ kind: 'unset' });
        expect(parseAccountStartChoice(42)).toEqual({ kind: 'unset' });
        expect(parseAccountStartChoice({ name: 'Växjö' })).toEqual({ kind: 'unset' });
    });

    it('känd ort ger staden, okänd behandlas som aldrig frågat', () => {
        const r = parseAccountStartChoice('Umeå');
        expect(r.kind).toBe('city');
        expect(r.kind === 'city' && r.city.name).toBe('Umeå');
        expect(parseAccountStartChoice('Atlantis')).toEqual({ kind: 'unset' });
    });
});
