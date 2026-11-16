import type { GeoHit } from './venueCoordinates';

/** Mittpunkter: reserv i kedjan, aldrig ett skäl att sluta leta. Högre = bättre. */
const CENTROID_RANK: Record<string, number> = { 'stad-centroid': 1, 'ort-centroid': 2 };

/**
 * Kandidatkedjan: första träffen som är BÄTTRE än en mittpunkt vinner (lokal,
 * gata, källans koordinat — eller okänd väg ur gammal cache). Mittpunkter
 * stoppar inte kedjan: de sparas som reserv, och en ortsmittpunkt (by i
 * platsnamnet) går före stadens mittpunkt. Vid lika rang vinner den första.
 *
 * Förr vann första träffen oavsett precision: Ticksters sidfotsadress gav
 * "Magasinsgatan 8, Växjö" → Växjös mittpunkt, och "Växjö Teater, Växjö"
 * (registerträff, 380 m bort) provades aldrig — 1 521 kommande Tickster-event
 * (2/10). Sedan 16/11 (#247) stoppar inte heller ortsmittpunkten: "Sturefors
 * bibliotek, Söderköping" (konsortiets medlemsort) vann och låg 38 km fel,
 * och en adress på bynivå skymde lokalen som kom efter i listan.
 */
export async function firstPreciseHit(
    queries: string[],
    geocode: (q: string) => Promise<GeoHit | null | undefined>,
): Promise<{ hit: GeoHit; query: string } | null> {
    let fallback: { hit: GeoHit; query: string } | null = null;
    for (const q of queries) {
        const hit = await geocode(q);
        if (!hit) continue;
        const rank = CENTROID_RANK[hit[2] ?? ''];
        if (!rank) return { hit, query: q };
        if (!fallback || rank > CENTROID_RANK[fallback.hit[2] ?? '']) fallback = { hit, query: q };
    }
    return fallback;
}

/** Rang för en sparad eller ny träff: lokal/gata/källkoordinat 3, ort 2, stad 1. */
export function precisionRank(precision: string | null | undefined): number {
    return CENTROID_RANK[precision ?? ''] ?? 3;
}

/** Hur långt en ny mittpunkt av samma rang ska ligga från den sparade för att flytta eventet. */
export const CENTROID_MOVE_KM = 2;

/**
 * Ska ett sparat mittpunktsevent flyttas till kedjans nya svar? (#247:
 * rättelser i kedjan nådde aldrig gamla event.) Bara uppåt i precision, eller
 * samma rang men en annan punkt (Vilhelminas kommunmitt → orten). distanceKm
 * injiceras så att modulen förblir fri från sqlite. Ren funktion.
 */
export function shouldMovePlace(
    stored: { lat: number; lng: number; precision: string | null },
    best: GeoHit | null | undefined,
    distanceKm: (a: number, b: number, c: number, d: number) => number,
): boolean {
    if (!best) return false;
    const oldRank = precisionRank(stored.precision), newRank = precisionRank(best[2]);
    if (newRank !== oldRank) return newRank > oldRank;
    if (newRank === 3) return false;   // lokalen var redan känd
    return distanceKm(stored.lat, stored.lng, best[0], best[1]) > CENTROID_MOVE_KM;
}
