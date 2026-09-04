import { describe, it, expect } from 'vitest';
import { matchesCityScope, parseCityArg } from './scope';

describe('matchesCityScope', () => {
    it('utan scope matchar allt — även sidor utan stad', () => {
        expect(matchesCityScope('Piteå', undefined)).toBe(true);
        expect(matchesCityScope(undefined, '')).toBe(true);
        expect(matchesCityScope(null, '   ')).toBe(true);
    });

    it('med scope: exakt stad, skiftlägesokänsligt, trimmat', () => {
        expect(matchesCityScope('Piteå', 'Piteå')).toBe(true);
        expect(matchesCityScope('piteå', ' PITEÅ ')).toBe(true);
        expect(matchesCityScope('Luleå', 'Piteå')).toBe(false);
        expect(matchesCityScope(undefined, 'Piteå')).toBe(false);
    });

    it('scope är hela stadsnamnet — inte prefix', () => {
        expect(matchesCityScope('Piteå kommun', 'Piteå')).toBe(false);
    });
});

describe('parseCityArg', () => {
    it('plockar --city= och trimmar', () => {
        expect(parseCityArg(['--city=Piteå'])).toBe('Piteå');
        expect(parseCityArg(['--apply', '--city= Luleå '])).toBe('Luleå');
    });

    it('saknas eller tomt → undefined', () => {
        expect(parseCityArg([])).toBeUndefined();
        expect(parseCityArg(['--city='])).toBeUndefined();
        expect(parseCityArg(['--cityx=Piteå'])).toBeUndefined();
    });
});
