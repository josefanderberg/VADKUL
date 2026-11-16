/**
 * Rena hjälpare för omgeokodningen av SPARADE event (#247, platsgranskningen
 * 15/11). Ett sparat event saknar RawEventets stad och kandidatlista; de får
 * härledas ur locationName och den sparade frågan. Ingen I/O här — orts-
 * uppslagen injiceras.
 */
import { shouldMovePlace, precisionRank } from './geocodeChain';
import type { GeoHit } from './venueCoordinates';

export type TownSource = 'lokalen' | 'postort' | 'bibliotekets-ort' | 'sparad-fråga';

/**
 * Eventets ort för omgeokodningen, och varifrån den kom. Ordning:
 *   1. hela lokalnamnet är en ort ("Övertorneå", "Västerhaninge"),
 *   2. postorten i lokalnamnet ("Finngatan 2D, SE-824 71 Delsbo"),
 *   3. lokalnamnets SISTA segment när det är en ort ("Ätrans bibliotek, Falkenberg"),
 *   4. postorten i den sparade adressen,
 *   5. den sparade frågans sista segment.
 * Ortnamn MITT I lokalnamnet används inte: "KvB Hallen", "Front Lindholmen"
 * och "Bokskogen i Torup" pekade ut tätorter hundratals km bort (dry-run
 * 16/11). Den sparade frågan kommer sist: konsortierna skrev en ANNAN
 * medlemsort där ("Storfors bibliotek, Arvika") — bibliotekens ort härleds
 * i stället ur skrapans egen logik (mapAxiellEvent).
 */
export function deriveTownForRow(
    locationName: string | null | undefined,
    geocodedQuery: string | null | undefined,
    extractedAddress: string | null | undefined,
    isPlace: (s: string) => boolean,
    postalTownOf: (s: string) => string | null,
): { town: string; source: TownSource } | null {
    const loc = (locationName ?? '').trim();
    const segs = loc.split(',').map(s => s.trim()).filter(Boolean);
    if (segs.length === 1 && isPlace(segs[0])) return { town: segs[0], source: 'lokalen' };
    const locPost = postalTownOf(loc);
    if (locPost && isPlace(locPost)) return { town: locPost, source: 'postort' };
    const locLast = segs.length >= 2 ? segs[segs.length - 1] : null;
    if (locLast && isPlace(locLast)) return { town: locLast, source: 'lokalen' };
    const addrPost = postalTownOf(extractedAddress ?? '');
    if (addrPost && isPlace(addrPost)) return { town: addrPost, source: 'postort' };
    const q = (geocodedQuery ?? '').replace(/^stad:\s*/i, '').split(',').map(s => s.trim()).filter(Boolean);
    const qLast = q[q.length - 1];
    if (qLast && !/\d/.test(qLast) && isPlace(qLast)) return { town: qLast, source: 'sparad-fråga' };
    return null;
}

/** Lokalnamnet utan ett avslutande ortsegment: "Idun, Umeå Folkets Hus, Umeå" → "Idun, Umeå Folkets Hus". */
export function venueWithoutTown(locationName: string, town: string): string {
    const segs = locationName.split(',').map(s => s.trim()).filter(Boolean);
    while (segs.length > 1 && segs[segs.length - 1].toLowerCase() === town.toLowerCase()) segs.pop();
    return segs.join(', ');
}

/** Avstånd som räknas som "en annan ort" — felen i granskningen låg 25–129 km bort. */
export const WRONG_TOWN_KM = 20;

/**
 * Ska det sparade eventet flyttas till omgeokodningens svar?
 *   - uppåt i precision, eller samma rang men en annan punkt (shouldMovePlace),
 *   - märkningen var fel ("Östersund, Östersund" som 'poi') — relabel,
 *   - den sparade punkten låg i en annan ort (> WRONG_TOWN_KM) och orten
 *     kommer ur eventets EGET lokalnamn, inte ur den sparade frågan,
 *   - registerraden låg långt från orten i sitt eget namn ("Malå bibliotek"
 *     i Norsjö) — då är den sparade 'poi'-träffen inget värd.
 */
export function decideMove(args: {
    stored: { lat: number; lng: number; precision: string | null };
    storedLabelWrong: boolean;
    storedConflict: boolean;
    best: GeoHit | null | undefined;
    townSource: TownSource;
    distanceKm: (a: number, b: number, c: number, d: number) => number;
}): 'flytt' | 'märkning' | 'annan-ort' | 'register-konflikt' | null {
    const { stored, best, distanceKm } = args;
    if (!best) return null;
    const far = distanceKm(stored.lat, stored.lng, best[0], best[1]) > WRONG_TOWN_KM;
    if (args.storedConflict) return 'register-konflikt';
    if (shouldMovePlace(stored, best, distanceKm)) return 'flytt';
    if (far && args.townSource !== 'sparad-fråga' && precisionRank(stored.precision) < 3) return 'annan-ort';
    if (args.storedLabelWrong) return 'märkning';
    return null;
}
