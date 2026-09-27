/**
 * Partnerlänken till ForFun (forfun.info) — länkbytet med Evgeniia Egorova,
 * grundare av ForFun (LinkedIn 27/9 2026): hennes stadsguider för Eskilstuna,
 * Nyköping, Strängnäs och Trosa länkar till våra stadssidor, och vi lyfter
 * ForFun för barnfamiljer i samma fyra städer. Vanliga länkar åt båda håll
 * (ingen nofollow — det är själva bytet), borttagbara när som helst.
 *
 * Placeringsregeln: rutan bor på stadens barn-kategorisida när den finns,
 * och på stadssidan när barn-undersidan ligger under säsongströskeln — så
 * alla fyra orterna alltid bär rutan någonstans, aldrig på två ställen.
 *
 * Länkarna går DIREKT till ForFuns stadsguide (hennes önskan 27/9:
 * "forfun.info/att-gora-med-barn/eskilstuna … då hamnar föräldrarna direkt
 * i rätt stad") med utm_source=vadkul, så trafiken från oss syns rent i
 * hennes statistik — spegelbilden av att hon UTM-taggar sina länkar hit.
 */

export const FORFUN_URL = 'https://forfun.info';

/** Städerna i länkbytet — Sörmlandsorterna ForFuns guider täcker.
 *  Sluggarna är IDENTISKA hos båda: vår citySlug är också hennes guide-slug. */
export const FORFUN_CITY_SLUGS: readonly string[] = ['eskilstuna', 'nykoping', 'strangnas', 'trosa'];

/** Djuplänken till stadens ForFun-guide, UTM-taggad för hennes statistik. */
export function forFunHref(citySlug: string): string {
    return `${FORFUN_URL}/att-gora-med-barn/${citySlug}?utm_source=vadkul&utm_medium=referral`;
}

/** Barn-kategorisidan visar rutan i länkbytets städer. */
export function showForFunOnCategoryPage(citySlug: string, categorySlug: string): boolean {
    return categorySlug === 'barn' && FORFUN_CITY_SLUGS.includes(citySlug);
}

/** Stadssidan är fallbacken: rutan visas bara när barn-undersidan inte
 *  finns just nu (annars bor den där, aldrig på båda). */
export function showForFunOnCityPage(citySlug: string, hasBarnPage: boolean): boolean {
    return !hasBarnPage && FORFUN_CITY_SLUGS.includes(citySlug);
}
