import { describe, expect, it } from 'vitest';
import { showForFunOnCategoryPage, showForFunOnCityPage, FORFUN_CITY_SLUGS } from './partnerLinks';

describe('showForFunOnCategoryPage', () => {
    it('visar raden på barn-sidan i länkbytets städer', () => {
        for (const slug of FORFUN_CITY_SLUGS) {
            expect(showForFunOnCategoryPage(slug, 'barn')).toBe(true);
        }
    });

    it('visar den inte i andra städer eller andra kategorier', () => {
        expect(showForFunOnCategoryPage('stockholm', 'barn')).toBe(false);
        expect(showForFunOnCategoryPage('eskilstuna', 'konserter')).toBe(false);
        expect(showForFunOnCategoryPage('katrineholm', 'barn')).toBe(false);
    });
});

describe('showForFunOnCityPage', () => {
    it('är fallbacken när barn-undersidan saknas', () => {
        expect(showForFunOnCityPage('trosa', false)).toBe(true);
        expect(showForFunOnCityPage('strangnas', false)).toBe(true);
    });

    it('visas aldrig dubbelt: barn-undersida finns → raden bor där', () => {
        expect(showForFunOnCityPage('eskilstuna', true)).toBe(false);
        expect(showForFunOnCityPage('trosa', true)).toBe(false);
    });

    it('visas inte utanför länkbytets städer', () => {
        expect(showForFunOnCityPage('stockholm', false)).toBe(false);
    });
});
