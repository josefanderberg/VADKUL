/**
 * Kategori-NYCKLARNA är kontrakt: aggregat-JSON:erna bär dem som strängar,
 * kartfiltret och stadssidorna matchar på dem, och appen kommer göra likadant.
 * Själva kategori-DEFINITIONERNA (emoji, färger, bilder) är presentationslager
 * och bor kvar per klient (webbens utils/categories.ts importerar PNG:er och
 * kan därför inte ligga här). Webbens EVENT_CATEGORIES har en `satisfies
 * Record<EventCategoryType, …>`-vakt så listorna aldrig glider isär: ny
 * kategori läggs HÄR först, sedan får varje klient tsc-fel tills den hanterats.
 */
export const EVENT_CATEGORY_KEYS = [
    'music',
    'stage',
    'art',
    'sport',
    'food',
    'market',
    'party',
    'social',
    'course',
    'family',
    'other',
] as const;

export type EventCategoryType = (typeof EVENT_CATEGORY_KEYS)[number];

/** Opt-in-källorna (inte LLM-kategorier) — se webbens SPECIAL_CATEGORIES. */
export const SPECIAL_CATEGORY_KEYS = ['svenskakyrkan', 'pro'] as const;

export type SpecialCategoryType = (typeof SPECIAL_CATEGORY_KEYS)[number];
