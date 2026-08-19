/**
 * Standardläget för opt-in-källorna Svenska kyrkan + PRO (Josef 20/8).
 *
 * UTLOGGADE besökare får BÅDA förvalda — den som inte har någon profil att gå
 * på ska mötas av kartans fylligaste läge, inte av ett tomt Hudiksvall
 * (jfr tom-karta-diagnosen: opt-in-källorna var en av orsakerna).
 *
 * INLOGGADE medlemmar får dem bara vid **65 år eller äldre**. För alla andra
 * förblir de opt-in precis som förut: källorna bär väldigt många event och
 * skulle annars dränka det övriga utbudet för den som inte vill ha dem.
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
    if (!opts.loggedIn) return [...SPECIAL_DEFAULT_KEYS];
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
