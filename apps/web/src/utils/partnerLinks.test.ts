import { describe, expect, it } from 'vitest';
import { forFunHref, showForFunOnCategoryPage, showForFunOnCityPage, FORFUN_CITY_SLUGS } from './partnerLinks';

describe('forFunHref', () => {
    it('djuplänkar till stadens guide med utm-taggning', () => {
        expect(forFunHref('eskilstuna')).toBe('https://forfun.info/att-gora-med-barn/eskilstuna?utm_source=vadkul&utm_medium=referral');
    });

    it('bygger en giltig adress för alla länkbytets städer', () => {
        for (const slug of FORFUN_CITY_SLUGS) {
            expect(forFunHref(slug)).toContain(`/att-gora-med-barn/${slug}?`);
        }
    });
});

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
