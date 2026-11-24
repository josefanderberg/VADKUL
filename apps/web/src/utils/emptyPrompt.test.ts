import { describe, expect, it } from 'vitest';
import { EMPTY_PROMPT_MAX_ZOOM, emptyPromptAllowedAt } from './emptyPrompt';
import { POI_SIGN_DEEP_NEAR_MIN_ZOOM } from './mapPoiSigns';

// #252, Josef 15/11: "den täcker för mycket av skärmen. och är ivägen när man
// kanske letar efter restaurangen".
describe('tom-prompten på kvartersnivå', () => {
    it('tiger där kvarterets platsskyltar tänds', () => {
        expect(EMPTY_PROMPT_MAX_ZOOM).toBe(POI_SIGN_DEEP_NEAR_MIN_ZOOM);
        expect(emptyPromptAllowedAt(EMPTY_PROMPT_MAX_ZOOM)).toBe(false);
        expect(emptyPromptAllowedAt(17)).toBe(false);
    });

    it('visas som förut på stadsnivå och utzoomat', () => {
        // Stadslandningen ligger på ~10,5.
        expect(emptyPromptAllowedAt(10.5)).toBe(true);
        expect(emptyPromptAllowedAt(EMPTY_PROMPT_MAX_ZOOM - 0.01)).toBe(true);
        expect(emptyPromptAllowedAt(5)).toBe(true);
    });

    it('visas innan kartan rapporterat sin zoom', () => {
        expect(emptyPromptAllowedAt(null)).toBe(true);
    });
});
