import type { GeoHit } from './venueCoordinates';

/**
 * Kandidatkedjan: första träffen som är BÄTTRE än en stadscentroid vinner.
 * En stad-centroid stoppar inte kedjan — den sparas som reserv och används
 * bara när ingen senare kandidat ger mer. Förr vann första träffen oavsett
 * precision: Ticksters sidfotsadress gav "Magasinsgatan 8, Växjö" → Växjös
 * mittpunkt, och "Växjö Teater, Växjö" (registerträff, 380 m bort) provades
 * aldrig — 1 521 kommande Tickster-event (2/10). Götabibliotekens "Tjällmo
 * bibliotek, Linköping" likaså (Tjällmo ligger 37 km bort).
 */
export async function firstPreciseHit(
    queries: string[],
    geocode: (q: string) => Promise<GeoHit | null | undefined>,
): Promise<{ hit: GeoHit; query: string } | null> {
    let fallback: { hit: GeoHit; query: string } | null = null;
    for (const q of queries) {
        const hit = await geocode(q);
        if (!hit) continue;
        if (hit[2] !== 'stad-centroid') return { hit, query: q };
        if (!fallback) fallback = { hit, query: q };
    }
    return fallback;
}
