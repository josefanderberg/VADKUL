/**
 * Listans HORISONT och kategoriernas EXTRA-RADER (Josef 3/9: "det står 5 på
 * chippen men det är bara 1"). Stadssidans daglista bär de första 14 listade
 * dagarna — mer blir för tungt för Stockholm (997 rader redan). Men chippen
 * räknar ALLA kommande event i kategorin, och en gles kategori (Växjös fem
 * marknader ligger i september–november) hade en enda rad i fönstret.
 *
 * Lösningen: kategorier med FÅ rader inom horisonten får sina senare event
 * med i sidan ändå — upp till minRows rader per kategori räknat från vad som
 * redan ligger i fönstret — som dagar märkta `beyond`. Klienten visar dem
 * bara när kategorin är vald; "Alla"-vyn är oförändrad. Taket håller
 * payloaden bunden: en stor kategori (100 konserter på två veckor) får inga
 * extra alls, en gles får allt den har. Det som ändå inte får plats räknas i
 * restByCategory ("…och N till längre fram").
 */

export const EXTRA_ROWS_PER_CATEGORY = 20;

/**
 * inHorizon = eventen inom fönstret, beyond = eventen efter det (tidssorterade).
 * Returnerar de beyond-event som ska med (i samma ordning) och resten per
 * kategori. Kategorier räknas på `category`-nyckeln.
 */
export function planCategoryExtras<E extends { category: string }>(
    inHorizon: readonly E[],
    beyond: readonly E[],
    minRows = EXTRA_ROWS_PER_CATEGORY,
): { extras: E[]; restByCategory: Record<string, number> } {
    const have = new Map<string, number>();
    for (const e of inHorizon) have.set(e.category, (have.get(e.category) ?? 0) + 1);
    const extras: E[] = [];
    const restByCategory: Record<string, number> = {};
    for (const e of beyond) {
        const n = have.get(e.category) ?? 0;
        if (n < minRows) {
            extras.push(e);
            have.set(e.category, n + 1);
        } else {
            restByCategory[e.category] = (restByCategory[e.category] ?? 0) + 1;
        }
    }
    return { extras, restByCategory };
}
