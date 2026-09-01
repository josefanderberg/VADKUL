import { familyIsOptIn } from './familyFilter';
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

/**
 * FAMILJ & BARN är också en opt-in-rad sedan 1/9 — men FÖRVALD (Josef:
 * "uppe bland pro och svenska kyrkan, men markerad till en början ... så att
 * nya användare ser en 1 på knappen"). Cirkeln ligger alltså alltid överst
 * med kyrkan/PRO, till skillnad från förr då den bara flyttade dit för
 * inloggade vuxna utan barn.
 *
 * 19/8-regeln lever kvar i vem som får den FÖRVALD: inloggad vuxen utan barn
 * i profilen får den urkryssad (familyIsOptIn === true) — det var hela
 * poängen med den regeln. Alla andra, inklusive varje utloggad besökare,
 * möts av en ikryssad 🧸 och badgen "1".
 *
 * Att den ligger i opt-in-hinken är det som gör detta ofarligt: page.tsx
 * räknar bort opt-in-nycklar ur normal-valet, så ett ikryssat 'family'
 * betyder "familj OCKSÅ", aldrig "bara familj". Den gamla family-defaulten
 * låg i NORMAL-valet och gömde därför allt annat — lägg aldrig tillbaka den.
 */
export const FAMILY_KEY = 'family';

export function defaultSpecialCategories(
    opts: { loggedIn: boolean; age?: unknown; hasChildren?: unknown },
): string[] {
    const keys: string[] = [];
    // Familj & barn: förvald för alla UTOM den som 19/8-regeln pekar ut
    // (inloggad vuxen utan barn i profilen).
    if (!familyIsOptIn(opts.loggedIn ? { age: opts.age, hasChildren: opts.hasChildren } : null)) {
        keys.push(FAMILY_KEY);
    }
    if (opts.loggedIn) {
        const { age } = opts;
        if (typeof age === 'number' && Number.isFinite(age) && age >= 65) {
            keys.push(...SPECIAL_DEFAULT_KEYS);
        }
    }
    return keys;
}

/**
 * Sorterad nyckel i samma format som `mapCategories`-jämförelserna i page.tsx
 * (`[...set].sort().join(',')`) — används för att avgöra om ett val bara är
 * standardläget, t.ex. innan `?kategori=` skrivs till adressfältet.
 */
export function specialDefaultsKey(opts: { loggedIn: boolean; age?: unknown; hasChildren?: unknown }): string {
    return defaultSpecialCategories(opts).sort().join(',');
}
