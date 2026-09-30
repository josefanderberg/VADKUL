/**
 * "Visa alla populära event i veckan"-bannern (Josef 30/9: "jag tror folk
 * kanske säljs in mer på det än att det kommer syjuntor och annat").
 * Erbjuds på kartan när veckan har tillräckligt många 🔥 Populära i
 * kartvyn; ett tryck byter till veckovy med Populära påslaget.
 */

/** "Mer än 5" populära i veckan i vyn. */
export const POPULAR_WEEK_PROMPT_MIN = 6;

export type PopularWeekPromptState = {
    /** Pop-flaggade (eller boostade) event i veckofönstret i kartvyn. */
    popularInWeek: number;
    /** 🔥 redan på - då har man redan det bannern erbjuder. Veckovyn i sig
     *  hindrar INTE: rör man kartan mitt i landningspulsen blir man kvar på
     *  veckan, och då ska bannern ändå upp (Josef 30/9). */
    popularOnly: boolean;
    /** Veckan går att välja på den här zoomen (samma grind som dagväljaren). */
    weekUnlocked: boolean;
    /** Arrangörsfilter eller en opt-in-källa (aldrig populära) är vald. */
    otherFilter: boolean;
    /** Stängd under besöket (✕, kartklick eller använd). */
    dismissed: boolean;
};

export function shouldOfferPopularWeek(s: PopularWeekPromptState): boolean {
    if (s.dismissed || s.popularOnly || s.otherFilter) return false;
    if (!s.weekUnlocked) return false;
    return s.popularInWeek >= POPULAR_WEEK_PROMPT_MIN;
}
