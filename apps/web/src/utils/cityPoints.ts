/**
 * SHIM (21/10 2026): sökorterna (291 st) bor numera i @vadkul/kontrakt
 * (packages/kontrakt/src/cityPoints.ts) - söket tolkar orten likadant på
 * webben och i appen. Testerna flyttade med dit.
 */
export {
    CITY_POINTS,
    findCityPoint,
    nearestCityPoint,
    searchCities,
    type CityPoint,
} from '@vadkul/kontrakt';
