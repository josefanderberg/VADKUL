import { describe, it, expect } from 'vitest';
import { normalizeLlmCategory } from './llmEnrich';
import { CANONICAL_CATEGORIES } from './categoryNormalize';

/**
 * Modellens svar måste alltid landa i de 11 kanoniska kategorierna —
 * llm-enrich-missing skriver värdet rakt till link_events.category, och
 * webben känner bara de kanoniska nycklarna (okänt degraderas tyst till
 * "Övrigt"). Före 18/10-fixen läckte promptens egna ord (performing-arts,
 * education, food-drink) ut i aggregatet.
 */
describe('normalizeLlmCategory', () => {
    it('promptens hela ordförråd landar kanoniskt', () => {
        const facit: Record<string, string> = {
            music: 'music',
            'performing-arts': 'stage',
            comedy: 'stage',
            market: 'market',
            sport: 'sport',
            education: 'course',
            art: 'art',
            social: 'social',
            'food-drink': 'food',
            family: 'family',
            other: 'other',
        };
        for (const [svar, kanon] of Object.entries(facit)) {
            expect(normalizeLlmCategory(svar), svar).toBe(kanon);
        }
    });

    it('fuzzy-varianter från modellen mappas', () => {
        expect(normalizeLlmCategory('Dansfest')).toBe('stage');
        expect(normalizeLlmCategory('konsert')).toBe('music');
        expect(normalizeLlmCategory('festival')).toBe('music');
        expect(normalizeLlmCategory('pubquiz')).toBe('social');
        expect(normalizeLlmCategory('träning')).toBe('sport');
    });

    it('skräp → other, aldrig något utanför de kanoniska', () => {
        const kanon = new Set<string>(CANONICAL_CATEGORIES);
        for (const v of ['workshop', 'culture', 'hittepå', '', null, undefined, 42, {}]) {
            expect(kanon.has(normalizeLlmCategory(v))).toBe(true);
        }
        expect(normalizeLlmCategory('hittepå-kategori')).toBe('other');
        expect(normalizeLlmCategory(null)).toBe('other');
    });
});
