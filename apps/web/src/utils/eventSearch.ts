/**
 * SHIM (21/10 2026): eventsöket bor numera i @vadkul/kontrakt
 * (packages/kontrakt/src/search.ts) - webben och appen rankar, tolkar ort
 * och kategoriord och sorterar närmast först med SAMMA kod. Där står hela
 * bakgrunden (11/9-klagomålet, 16/9-tolkningen, 20/10-filterlistan och
 * 21/10-beslutet "närområdet prioriterat"); testerna flyttade med.
 * eventSearch.test.ts här håller bara kategoriernas sökord i takt med
 * webbens etiketter.
 */
export {
    CATEGORY_SEARCH_WORDS,
    CITY_SEARCH_RADIUS_KM,
    SAME_DISTANCE_KM,
    SEARCH_TIER,
    categoryForWord,
    eventSearchTier,
    filterSearchMatches,
    highlightSegments,
    isFilterQuery,
    nearestOrigin,
    normalizeSearchQuery,
    parseCategoryQuery,
    rankSearchResults,
    searchEvents,
    sortNearestFirst,
    splitCityFromQuery,
    withinCitySearch,
    type HighlightSegment,
    type LatLng,
    type RankableEvent,
    type SearchableEvent,
} from '@vadkul/kontrakt';
