import { describe, it, expect } from 'vitest';
import { planCategoryExtras, EXTRA_ROWS_PER_CATEGORY } from './listHorizon';

const ev = (category: string, id: string) => ({ category, id });
const many = (category: string, n: number, prefix = category) => Array.from({ length: n }, (_, i) => ev(category, `${prefix}${i}`));

describe('planCategoryExtras', () => {
    it('Växjö-fallet: en marknad i fönstret, fyra senare → alla fyra tas med', () => {
        const inHorizon = [ev('market', 'm0'), ...many('music', 30)];
        const beyond = [ev('market', 'm1'), ev('art', 'a1'), ev('market', 'm2'), ev('market', 'm3'), ev('market', 'm4')];
        const { extras, restByCategory } = planCategoryExtras(inHorizon, beyond);
        expect(extras.map(e => e.id)).toEqual(['m1', 'a1', 'm2', 'm3', 'm4']);
        expect(restByCategory).toEqual({});
    });

    it('en stor kategori i fönstret får inga extra — allt senare hamnar i resten', () => {
        const { extras, restByCategory } = planCategoryExtras(many('music', 40), many('music', 12, 'later'));
        expect(extras).toEqual([]);
        expect(restByCategory).toEqual({ music: 12 });
    });

    it('taket räknas från vad som redan finns i fönstret, i tidsordning', () => {
        const inHorizon = many('art', EXTRA_ROWS_PER_CATEGORY - 2);
        const beyond = many('art', 5, 'later');
        const { extras, restByCategory } = planCategoryExtras(inHorizon, beyond);
        expect(extras.map(e => e.id)).toEqual(['later0', 'later1']);
        expect(restByCategory).toEqual({ art: 3 });
    });

    it('eget tak och tomma listor', () => {
        expect(planCategoryExtras([], many('food', 3), 2)).toEqual({ extras: many('food', 2), restByCategory: { food: 1 } });
        expect(planCategoryExtras([], [])).toEqual({ extras: [], restByCategory: {} });
    });
});
