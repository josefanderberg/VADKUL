/**
 * Standardläget för opt-in-källorna Svenska kyrkan + PRO.
 *
 * UTLOGGADE besökare får INGA förvalda (Josef 31/8, river 20/8-beslutet som
 * förvalde båda): källorna bär väldigt många event och dränkte det övriga
 * utbudet för förstagångsbesökaren. De är rena opt-in-kryss i kategorikolumnen.
 *
 * INLOGGADE medlemmar får dem bara vid **65 år eller äldre**. För alla andra
 * förblir de opt-in: samma dränknings-skäl som för besökarna.
 *
 * VIKTIGT — att förvälja dem GÖMMER inget annat: page.tsx räknar bort
 * opt-in-nycklarna ur normal-valet (`selectedNormal`), så ett ikryssat PRO
 * betyder "PRO OCKSÅ", aldrig "bara PRO". Det var precis den fällan den
 * borttagna family-defaulten gick i (den gömde allt annat) — lägg aldrig
 * tillbaka opt-in-nycklar i normal-valet.
 *
 * Åldern är best-effort: saknas den (gamla konton utan `age`) blir svaret
 * tomt. Hellre opt-in än att tvinga på en 30-åring PRO-utbudet.
 */
export const SPECIAL_DEFAULT_KEYS = ['pro', 'svenskakyrkan'] as const;

export function defaultSpecialCategories(
    opts: { loggedIn: boolean; age?: unknown },
): string[] {
    if (!opts.loggedIn) return [];
    const { age } = opts;
    if (typeof age === 'number' && Number.isFinite(age) && age >= 65) {
        return [...SPECIAL_DEFAULT_KEYS];
    }
    return [];
}

/**
 * Sorterad nyckel i samma format som `mapCategories`-jämförelserna i page.tsx
 * (`[...set].sort().join(',')`) — används för att avgöra om ett val bara är
 * standardläget, t.ex. innan `?kategori=` skrivs till adressfältet.
 */
export function specialDefaultsKey(opts: { loggedIn: boolean; age?: unknown }): string {
    return defaultSpecialCategories(opts).sort().join(',');
}
