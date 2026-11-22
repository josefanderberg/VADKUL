import { EVENT_CATEGORIES, type EventCategoryType } from './categories';
import { classifySource } from './sources';

/**
 * FAVORITKATEGORIERNA (#271, ägarbeslut 22/11, Josef: "om man väljer några
 * kategorier på 3 steget av introt, då ska inte bara de visas. utan alla ska
 * fortfarande visas ... de som jag valt ska ha tjockare border och
 * prioriteras när jag scrollar ner till listan eller klickar på nästa").
 *
 * Introts kategorival är alltså en PREFERENS, inte ett filter: inget göms.
 * Favoriterna märks med tjockare ram på kartan och går först i listan under
 * eventkortet, i Nästa och i reveal-urvalet. Sökarkets kategorichips
 * (utils/mapFilter) är fortfarande det riktiga filtret.
 *
 * Ingen TTL (till skillnad från kartfiltret): en preferens gömmer ingenting,
 * så 15/9-läxan om osynliga filter gäller inte här. Ändras i väljaren
 * (profilpanelens "Kartan startar i" / välkomstrutans Byt).
 *
 * Rena funktioner utom read/write, som bara rör localStorage.
 */
export const FAVORITE_CATEGORIES_KEY = 'vadkul_favoritkategorier';

/** Tolka det lagrade värdet - okända nycklar och skräp filtreras bort. */
export function parseFavoriteCategories(raw: string | null): EventCategoryType[] {
    if (!raw) return [];
    let arr: unknown;
    try { arr = JSON.parse(raw); } catch { return []; }
    if (!Array.isArray(arr)) return [];
    const out: EventCategoryType[] = [];
    for (const k of arr) {
        if (typeof k === 'string' && k in EVENT_CATEGORIES && !out.includes(k as EventCategoryType)) out.push(k as EventCategoryType);
    }
    return out;
}

/** Läs favoriterna. Tom lista = inga (eller trasigt/privat läge). */
export function readFavoriteCategories(): EventCategoryType[] {
    try {
        return parseFavoriteCategories(window.localStorage.getItem(FAVORITE_CATEGORIES_KEY));
    } catch { return []; }
}

/** Spara favoriterna. Tom lista tar bort nyckeln. */
export function writeFavoriteCategories(kats: readonly EventCategoryType[]): void {
    try {
        if (kats.length === 0) window.localStorage.removeItem(FAVORITE_CATEGORIES_KEY);
        else window.localStorage.setItem(FAVORITE_CATEGORIES_KEY, JSON.stringify(kats));
    } catch { /* privat läge - favoriterna gäller då bara besöket */ }
}

type FavoriteEventLike = { category?: string | null; url?: string | null; id?: string };

/**
 * Tillhör eventet en favoritkategori? Okänd/saknad kategori räknas som
 * Övrigt, som i kartfiltret. Opt-in-källorna (Svenska kyrkan/PRO/Korpen)
 * räknas ALDRIG som favoriter: de är närområdets egna spår (#240) och ska
 * inte gå före i kö bara för att deras event råkar bära en vald kategori.
 */
export function isFavoriteEvent(evt: FavoriteEventLike, favorites: ReadonlySet<string> | null | undefined): boolean {
    if (!favorites || favorites.size === 0) return false;
    const cat = evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other';
    if (!favorites.has(cat)) return false;
    return classifySource(evt.url || evt.id) === null;
}

/**
 * Favoriterna först (stabilt), resten efter i oförändrad ordning. Används
 * inom en dag i listan under eventkortet - eventen ligger redan i tids-/
 * närhetsordning, och boostade lyfts därefter överst av featuredFirst.
 */
export function favoritesFirst<T>(items: readonly T[], isFavorite: (item: T) => boolean): T[] {
    const lifted: T[] = [];
    const rest: T[] = [];
    for (const it of items) (isFavorite(it) ? lifted : rest).push(it);
    return lifted.length === 0 || rest.length === 0 ? [...items] : [...lifted, ...rest];
}

/**
 * NÄSTA MED FAVORITER FÖRST: kör samma val (`pick`, t.ex. närmast ankaret
 * bland obesökta) först bland poolens favoriter, och först när de är slut
 * bland hela poolen. Utan favoriter i poolen = exakt `pick(pool)`.
 */
export function pickFavoriteFirst<T, R>(
    pool: readonly T[],
    isFavorite: (item: T) => boolean,
    pick: (candidates: T[]) => R | null,
): R | null {
    const favs = pool.filter(isFavorite);
    if (favs.length > 0 && favs.length < pool.length) {
        const hit = pick(favs);
        if (hit !== null) return hit;
    }
    return pick([...pool]);
}

/**
 * Reveal-urvalets rankning kring en punkt (inzoomat, V2Map pickRevealKeys):
 * populära/guld först, sedan favoritkategorier, sedan övriga - närmast först
 * inom varje skikt. Utan favoriter = dagens ordning (7/10-beslutet).
 */
export function compareRevealRank(
    a: { pop: boolean; fav?: boolean; d2: number },
    b: { pop: boolean; fav?: boolean; d2: number },
): number {
    return (Number(b.pop) - Number(a.pop)) || (Number(!!b.fav) - Number(!!a.fav)) || (a.d2 - b.d2);
}
