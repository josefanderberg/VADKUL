/**
 * SHIM: boost-regeln (aktiv boost + "boostade först") bor i @vadkul/kontrakt
 * (featured.ts) så listan under eventkortet lyfter samma event på webben och
 * i appen. Testerna bor i paketet. Kartans isEventFeatured/isBoostShownEveryDay
 * (services/linkEventService) står kvar oförändrade.
 */
import { isFeaturedAt, type FeaturedUntil } from '@vadkul/kontrakt';

export { featuredFirst, featuredUntilMs, isFeaturedAt, type FeaturedUntil } from '@vadkul/kontrakt';

/** Aktiv boost just nu - för rader utan egen `now` (sök-/sparat-/väljarlistans
 *  rader); klockan läses här, inte i komponenten (react-hooks/purity). */
export const isFeaturedNow = (until: FeaturedUntil): boolean => isFeaturedAt(until, Date.now());
