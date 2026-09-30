import { describe, expect, it } from 'vitest';
import { POPULAR_WEEK_PROMPT_MIN, shouldOfferPopularWeek, type PopularWeekPromptState } from './popularWeekPrompt';

const base: PopularWeekPromptState = {
    popularInWeek: 8,
    popularOnly: false,
    weekMode: false,
    weekUnlocked: true,
    otherFilter: false,
    dismissed: false,
};

describe('shouldOfferPopularWeek', () => {
    it('erbjuds vid fler än 5 populära i veckan', () => {
        expect(POPULAR_WEEK_PROMPT_MIN).toBe(6);
        expect(shouldOfferPopularWeek({ ...base, popularInWeek: 6 })).toBe(true);
        expect(shouldOfferPopularWeek({ ...base, popularInWeek: 5 })).toBe(false);
    });
    it('inte när man redan har det bannern erbjuder', () => {
        expect(shouldOfferPopularWeek({ ...base, popularOnly: true })).toBe(false);
        expect(shouldOfferPopularWeek({ ...base, weekMode: true })).toBe(false);
    });
    it('inte när veckan är låst av zoomen', () => {
        expect(shouldOfferPopularWeek({ ...base, weekUnlocked: false })).toBe(false);
    });
    it('inte med arrangörsfilter/källa, och aldrig efter att den stängts', () => {
        expect(shouldOfferPopularWeek({ ...base, otherFilter: true })).toBe(false);
        expect(shouldOfferPopularWeek({ ...base, dismissed: true })).toBe(false);
    });
});
