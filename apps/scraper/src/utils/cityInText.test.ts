import { describe, it, expect } from 'vitest';
import { cityMentioned, findKnownCity, findKnownCities } from './cityInText';

describe('cityMentioned', () => {
    it('ordgräns + genitiv', () => {
        expect(cityMentioned('Konsert i Umeå ikväll', 'Umeå')).toBe(true);
        expect(cityMentioned('Härnösands Riksteaterförening', 'Härnösand')).toBe(true);
        expect(cityMentioned('Umeåbor på turné', 'Umeå')).toBe(false);
    });

    it('sammansatta ortnamn matchar inte stadsnamnet de innehåller', () => {
        expect(cityMentioned('Östra Ljungby kyrka', 'Ljungby')).toBe(false);
        expect(cityMentioned('Västra Sandviken, Grums', 'Sandviken')).toBe(false);
        expect(cityMentioned('Vinberg-Ljungby Hembygdsförening', 'Ljungby')).toBe(false);
    });

    it('byadresser "<Ortnamn> <nummer>" är inte stadsbevis', () => {
        expect(cityMentioned('Sandviken 130, Frösön', 'Sandviken')).toBe(false);
        expect(cityMentioned('Storgatan 5, Sandviken', 'Sandviken')).toBe(true);
    });
});

describe('findKnownCity / findKnownCities', () => {
    it('hittar en känd stad, annars null', () => {
        expect(findKnownCity('Väven, Umeå')).toBe('Umeå');
        expect(findKnownCity('SCA Arena')).toBeNull();
    });

    it('findKnownCities listar alla — tvetydighetsunderlaget', () => {
        expect(findKnownCities('Buss Göteborg – Malmö')).toEqual(['Göteborg', 'Malmö']);
        expect(findKnownCities('Timrå IK – Skellefteå AIK')).toEqual(['Skellefteå']);
        expect(findKnownCities('Sopplunch i församlingshemmet')).toEqual([]);
    });
});
