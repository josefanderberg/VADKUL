/**
 * Kategorichipsen på stadssidorna: FILTER och UNDERSIDA är två olika saker
 * (Josef 3/9: "kan vi inte göra så att de finns som kategorifiltrering
 * iallafall, men skippa undersidorna?").
 *
 *   • CHIPPEN (filtret) finns för varje kategori med minst CATEGORY_CHIP_MIN
 *     kommande event i staden — på alla orter, småorterna inräknade.
 *   • UNDERSIDAN (/evenemang/stad/kategori, den Google indexerar) finns bara
 *     när kategorin bär den: CATEGORY_PAGE_MIN_BIG i storstäderna (dagens 5,
 *     rörs inte — redan indexerade sidor ska inte försvinna) och
 *     CATEGORY_PAGE_MIN_SMALL i småorterna (räknat 2/9: ≥10 ger 117 sidor
 *     med substans, ≥5 hade gett 205 varav många på 6–9 event — tunt).
 *
 * Chips utan undersida filtrerar på plats och bär stadssidans adress med
 * ?kategori=<slug> (CategoryChips) — ingen ny indexerbar sida uppstår.
 * Trösklarna räknas om vid varje build (nattliga deployen), så en kategori
 * får och tappar sin undersida med säsongen utan att filtret påverkas.
 */

export const CATEGORY_CHIP_MIN = 3;
export const CATEGORY_PAGE_MIN_BIG = 5;
export const CATEGORY_PAGE_MIN_SMALL = 10;

/** Tröskeln för en egen undersida i den här staden. */
export const categoryPageMin = (small: boolean | undefined) => (small ? CATEGORY_PAGE_MIN_SMALL : CATEGORY_PAGE_MIN_BIG);

export type CategoryChipPlan = { dataKey: string; count: number; hasPage: boolean };

/**
 * Vilka chips staden får, i kategoriordningen (`dataKeys`), och vilka av dem
 * som har en undersida. counts = kommande event per datanyckel.
 */
export function planCategoryChips(
    dataKeys: readonly string[],
    counts: Readonly<Record<string, number>> | ReadonlyMap<string, number>,
    small: boolean | undefined,
): CategoryChipPlan[] {
    const get = (k: string) => (counts instanceof Map ? counts.get(k) : (counts as Record<string, number>)[k]) ?? 0;
    const pageMin = categoryPageMin(small);
    const out: CategoryChipPlan[] = [];
    for (const dataKey of dataKeys) {
        const count = get(dataKey);
        if (count < CATEGORY_CHIP_MIN) continue;
        out.push({ dataKey, count, hasPage: count >= pageMin });
    }
    return out;
}

/** Adressen en chip länkar till: undersidan när den finns, annars stadssidan
 *  med kategorin som fråga (filtret slår på vid laddning). */
export function categoryChipHref(citySlug: string, catSlug: string, hasPage: boolean): string {
    return hasPage ? `/evenemang/${citySlug}/${catSlug}` : `/evenemang/${citySlug}?kategori=${catSlug}`;
}

/** Aktiv kategori-slug ur adressen: /evenemang/<stad>/<slug> eller
 *  /evenemang/<stad>?kategori=<slug>. null = alla. Andra städers adresser
 *  ger null (komponenten kan ligga kvar monterad under en mjuk navigering). */
export function activeCategorySlug(pathname: string, search: string, citySlug: string): string | null {
    const seg = pathname.split('/').filter(Boolean);
    if (seg[0] !== 'evenemang' || seg[1] !== citySlug) return null;
    if (seg[2]) return seg[2];
    const q = new URLSearchParams(search).get('kategori');
    return q && q.trim() ? q.trim() : null;
}
