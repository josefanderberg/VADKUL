/**
 * Partnerlänken till ForFun (forfun.info) — länkbytet med Evgeniia Egorova,
 * grundare av ForFun (LinkedIn 27/9 2026): hennes stadsguider för Eskilstuna,
 * Nyköping, Strängnäs och Trosa länkar till våra stadssidor, och vi lyfter
 * ForFun för barnfamiljer i samma fyra städer. Vanliga länkar åt båda håll
 * (ingen nofollow — det är själva bytet), borttagbara när som helst.
 *
 * Placeringsregeln: raden bor på stadens barn-kategorisida när den finns,
 * och på stadssidan när barn-undersidan ligger under säsongströskeln — så
 * alla fyra orterna alltid bär raden någonstans, aldrig på två ställen.
 */

export const FORFUN_URL = 'https://forfun.info';

/** Städerna i länkbytet — Sörmlandsorterna ForFuns guider täcker. */
export const FORFUN_CITY_SLUGS: readonly string[] = ['eskilstuna', 'nykoping', 'strangnas', 'trosa'];

/** Barn-kategorisidan visar raden i länkbytets städer. */
export function showForFunOnCategoryPage(citySlug: string, categorySlug: string): boolean {
    return categorySlug === 'barn' && FORFUN_CITY_SLUGS.includes(citySlug);
}

/** Stadssidan är fallbacken: raden visas bara när barn-undersidan inte
 *  finns just nu (annars bor den där, aldrig på båda). */
export function showForFunOnCityPage(citySlug: string, hasBarnPage: boolean): boolean {
    return !hasBarnPage && FORFUN_CITY_SLUGS.includes(citySlug);
}
