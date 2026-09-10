import { describe, it, expect } from 'vitest';
import { passesPopularFilter, popularBypass } from './popularFilter';

const IN_AN_HOUR = new Date(Date.now() + 3_600_000);
const AN_HOUR_AGO = new Date(Date.now() - 3_600_000);

describe('passesPopularFilter', () => {
    it('filter av → allt passerar, även utan fält', () => {
        expect(passesPopularFilter({}, false)).toBe(true);
        expect(passesPopularFilter({ pop: true }, false)).toBe(true);
    });
    it('filter på → bara pop-flaggade', () => {
        expect(passesPopularFilter({ pop: true }, true)).toBe(true);
        expect(passesPopularFilter({}, true)).toBe(false);
        expect(passesPopularFilter({ pop: false }, true)).toBe(false);
    });
    it('gamla lager utan fältet = inte populär, kastar aldrig', () => {
        expect(passesPopularFilter({ pop: undefined }, true)).toBe(false);
    });
});

describe('popularBypass', () => {
    it('användarskapade går alltid förbi', () => {
        expect(passesPopularFilter({ userCreated: true }, true)).toBe(true);
    });
    it('aktiv boost går förbi — utgången gör det inte', () => {
        expect(passesPopularFilter({ featuredUntil: IN_AN_HOUR }, true)).toBe(true);
        expect(passesPopularFilter({ featuredUntil: AN_HOUR_AGO }, true)).toBe(false);
        expect(popularBypass({ featuredUntil: AN_HOUR_AGO })).toBe(false);
    });
});
