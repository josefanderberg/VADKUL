import { describe, it, expect } from 'vitest';
import { CITIES as CITY_PAGES } from './cityPages';
import { findCityPoint } from './cityPoints';
import { parseAccountStartChoice, parseChosenCity, popularStartCities, startCityChips } from './startChoice';

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

// Startskärmens stadsrad (#268): raden som rullar i sidled.
describe('startCityChips', () => {
    const popular = popularStartCities(5);
    const växjö = findCityPoint('Växjö')!;
    const göteborg = findCityPoint('Göteborg')!;

    it('obesvarad fråga: Där jag är först, inget markerat', () => {
        const chips = startCityChips(null, false, popular);
        expect(chips[0]).toEqual({ key: 'där-jag-är', city: null, selected: false });
        expect(chips.slice(1).map(c => c.city?.name)).toEqual(popular.map(c => c.name));
        expect(chips.some(c => c.selected)).toBe(false);
    });

    it('vald stad står först och är markerad, även utanför snabbvalen', () => {
        const chips = startCityChips(växjö, true, popular);
        expect(chips[0]).toEqual({ key: 'Växjö', city: växjö, selected: true });
        expect(chips[1].city).toBeNull();
        expect(chips.filter(c => c.selected)).toHaveLength(1);
        expect(chips).toHaveLength(popular.length + 2);
    });

    it('vald stad bland snabbvalen står inte två gånger', () => {
        const chips = startCityChips(göteborg, true, popular);
        expect(chips.filter(c => c.city?.name === 'Göteborg')).toHaveLength(1);
        expect(chips[0].city?.name).toBe('Göteborg');
        expect(chips).toHaveLength(popular.length + 1);
    });

    it('svaret "där jag är" markerar den brickan', () => {
        const chips = startCityChips(null, true, popular);
        expect(chips[0]).toEqual({ key: 'där-jag-är', city: null, selected: true });
    });

    it('nycklarna är unika', () => {
        const chips = startCityChips(växjö, true, popularStartCities(12));
        expect(new Set(chips.map(c => c.key)).size).toBe(chips.length);
    });
});
