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
    /** FRÅN IDAG-avsnittet (9/10): de tidigare dagarna (idag fram till den
     *  visade dagen) som lades till när man valde "Från idag" i botten. */
    fromToday?: true;
    rows: R[];
}

/** FRÅN IDAG (ägarbeslut 9/10, Josef: "om man är på en annan dag än idag,
 *  eller om default på kvällen hunnit bli imorgon. Då ska man kunna välja
 *  att ifrån idag eller så kan man zooma ut"). */
export interface FromTodayOpts {
    /** Den visade dagen - listan börjar där. Dagar före den hör till Från
     *  idag-avsnittet och visas bara när det är valt. */
    shownDay: number;
    /** Antal utzoomningar (ringar) som var gjorda när Från idag valdes,
     *  null = inte valt. */
    todayAt: number | null;
}

/** Avsnittens nyckel: ring r = r, Från idag-avsnittet ligger mellan ringen
 *  det valdes i och nästa utzoomning. */
export const listSegmentKey = (d: { ring: number; fromToday?: true }) => d.ring + (d.fromToday ? 0.5 : 0);

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
 *
 * Med `fromToday` får dagarna före den visade dagen ett eget avsnitt: utan
 * valet följer de inte med alls, med valet hamnar det man ännu inte sett
 * (dagarna idag→visade dagen i de ringar som redan fanns) under en egen
 * avdelare, i den ordning man valde. En utzoomning EFTER valet börjar om
 * från idag - de tidigare dagarna ingår i den ringen som vanligt.
 */
export function splitDaysIntoRings<R>(
    days: readonly { dayOffset: number; rows: readonly R[] }[],
    rings: readonly ReadonlySet<string>[],
    idsOf: (row: R) => readonly string[],
    fromToday?: FromTodayOpts,
): RingDay<R>[] {
    const ringOf = (ids: readonly string[]) => {
        for (let i = 0; i < rings.length; i++) if (ids.some(id => rings[i].has(id))) return i;
        return rings.length;
    };
    const perSegment = new Map<number, RingDay<R>[]>();
    for (const day of days) {
        const earlier = !!fromToday && day.dayOffset < fromToday.shownDay;
        if (earlier && fromToday!.todayAt === null) continue;
        const split = new Map<number, RingDay<R>>();
        for (const row of day.rows) {
            const r = ringOf(idsOf(row));
            const todayAt = fromToday?.todayAt ?? 0;
            const seg: { ring: number; fromToday?: true } = earlier && r <= todayAt
                ? { ring: todayAt, fromToday: true }
                : { ring: r };
            const key = listSegmentKey(seg);
            const hit = split.get(key);
            if (hit) hit.rows.push(row);
            else split.set(key, { dayOffset: day.dayOffset, ...seg, rows: [row] });
        }
        for (const [key, d] of split) {
            const list = perSegment.get(key);
            if (list) list.push(d);
            else perSegment.set(key, [d]);
        }
    }
    return [...perSegment.entries()].sort(([a], [b]) => a - b).flatMap(([, list]) => list);
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
