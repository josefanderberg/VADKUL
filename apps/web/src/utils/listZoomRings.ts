/**
 * listZoomRings.ts - LISTAN ZOOMAR UT (ägarbeslut 8/10, Josef: "när man
 * scrollat ner i listan för man redan sett allt denna månaden på
 * eventkorten. Då ska ju kartan zooma ut så att listan kan börja om på
 * nästa zoomsteg, så tar man in fler event runtomkring och visa på när de
 * börjar").
 *
 * Kortets lista (Månaden/Populärt) är eventen i kartans ruta. Når man
 * botten zoomar kartan ut och listan FORTSÄTTER i stället för att ta slut:
 * det man redan sett står kvar överst, och eventen som kom in runtomkring
 * läggs under en avdelare - dag för dag från den visade dagen igen. Varje
 * utzoomning fryser vilka id:n som fanns i listan (en RING); en rad hör
 * till den första ringen som kände den, allt okänt hör till den yttersta.
 */
import type { MapBounds } from './viewportTour';

/** Under den här zoomen (≈ halva Sverige tvärs en mobil) zoomar listan
 *  inte ut längre - där är "runtomkring" inte runtomkring längre. */
export const LIST_ZOOM_OUT_FLOOR = 6;

export interface RingDay<R> {
    dayOffset: number;
    /** 0 = rutan innan första utzoomningen, 1 = det som kom in vid den … */
    ring: number;
    rows: R[];
}

/**
 * Delar listans dagar i ringar: först alla dagar med ring 0-rader, sedan
 * ring 1 från första dagen igen, osv. Dagarna behåller sin ordning inom
 * varje ring och tomma dagar följer inte med. `rings[i]` = id:na som fanns
 * i listan när kartan zoomade ut för (i+1):e gången.
 *
 * `idsOf` ger radens alla event (representanten + dubbletterna, utils/
 * groupDups): raden hör till den tidigaste ring NÅGOT av dem fanns i, så
 * en redan sedd rad aldrig hoppar ner under avdelaren för att ett nytt
 * tillfälle utanför rutan blev gruppens representant.
 */
export function splitDaysIntoRings<R>(
    days: readonly { dayOffset: number; rows: readonly R[] }[],
    rings: readonly ReadonlySet<string>[],
    idsOf: (row: R) => readonly string[],
): RingDay<R>[] {
    const ringOf = (ids: readonly string[]) => {
        for (let i = 0; i < rings.length; i++) if (ids.some(id => rings[i].has(id))) return i;
        return rings.length;
    };
    const perRing: RingDay<R>[][] = Array.from({ length: rings.length + 1 }, () => []);
    for (const day of days) {
        const split = new Map<number, R[]>();
        for (const row of day.rows) {
            const r = ringOf(idsOf(row));
            const list = split.get(r);
            if (list) list.push(row);
            else split.set(r, [row]);
        }
        for (const [ring, rows] of split) perRing[ring].push({ dayOffset: day.dayOffset, ring, rows });
    }
    return perRing.flat();
}

interface Placed {
    lat?: number | null;
    lng?: number | null;
}

const insideBounds = (lat: number, lng: number, b: MapBounds) =>
    lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;

/**
 * Närmaste event UTANFÖR rutan, räknat från kartans mitt - utzoomningens
 * mål, så steget alltid tar in minst ett nytt event när det finns något.
 * Avståndet är platt (longitud skalad med cos(lat)) - det räcker för att
 * välja närmast. null = inget utanför (eller inget med koordinater).
 */
export function nearestOutsideBounds<T extends Placed>(
    events: readonly T[],
    bounds: MapBounds,
    center: { lat: number; lng: number },
    include: (e: T) => boolean = () => true,
): T | null {
    const kx = Math.cos((center.lat * Math.PI) / 180);
    let best: T | null = null;
    let bestD = Infinity;
    for (const e of events) {
        const lat = e.lat, lng = e.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) continue;
        if (insideBounds(lat, lng, bounds) || !include(e)) continue;
        const dx = (lng - center.lng) * kx;
        const dy = lat - center.lat;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = e; }
    }
    return best;
}
