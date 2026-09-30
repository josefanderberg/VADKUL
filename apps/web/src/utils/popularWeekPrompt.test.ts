import { describe, expect, it } from 'vitest';
import { POPULAR_WEEK_PROMPT_MIN, landingPulseAllowsPrompt, shouldOfferPopularWeek, type PopularWeekPromptState } from './popularWeekPrompt';

const base: PopularWeekPromptState = {
    popularInWeek: 8,
    popularOnly: false,
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
    it('inte när 🔥 redan är på', () => {
        expect(shouldOfferPopularWeek({ ...base, popularOnly: true })).toBe(false);
    });
    it('inte när veckan är låst av zoomen', () => {
        expect(shouldOfferPopularWeek({ ...base, weekUnlocked: false })).toBe(false);
    });
    it('inte med arrangörsfilter/källa, och aldrig efter att den stängts', () => {
        expect(shouldOfferPopularWeek({ ...base, otherFilter: true })).toBe(false);
        expect(shouldOfferPopularWeek({ ...base, dismissed: true })).toBe(false);
    });
});

describe('landingPulseAllowsPrompt', () => {
    const landing = { tourPlaying: true, pulseSuppressed: false, pulseDoneForCity: false, weekShown: false };
    it('tiger innan pulsen kört och medan den visar veckan', () => {
        expect(landingPulseAllowsPrompt(landing)).toBe(false);
        expect(landingPulseAllowsPrompt({ ...landing, weekShown: true })).toBe(false);
    });
    it('släpper fram bannern när pulsen gått tillbaka till dag', () => {
        expect(landingPulseAllowsPrompt({ ...landing, pulseDoneForCity: true })).toBe(true);
    });
    it('rör man kartan mitt i veckofasen släpps den fram (man står kvar på veckan)', () => {
        expect(landingPulseAllowsPrompt({ ...landing, tourPlaying: false, weekShown: true })).toBe(true);
    });
    it('eget periodval tystar pulsen och släpper fram bannern', () => {
        expect(landingPulseAllowsPrompt({ ...landing, pulseSuppressed: true, weekShown: true })).toBe(true);
    });
});
