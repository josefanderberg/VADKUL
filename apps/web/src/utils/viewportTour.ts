/**
 * Nästa-bläddringens "i bild"-regler (Josef 2/9: "när man klickar på nästa
 * event ska vi bara gå till nästa event som syns i bilden — kartan ska
 * aldrig hoppa iväg; har man gått igenom alla går vi automatiskt till nästa
 * dag"). Rena funktioner så de går att testa utan karta:
 *
 *   • isInVisibleMapArea — ligger punkten inom kartrutan OCH ovanför den del
 *     av skärmen som eventkortet täcker? Brickor bakom kortet syns inte och
 *     räknas därför inte som "i bild".
 *   • dayOffsetOf — kalenderdagens offset från idag (dagväljarens enhet).
 *   • nextPeriodWithEvents — nästa dag/period som har något att visa.
 *   • zoomOutStepsToReveal — hur långt kartan ska zooma ut (kring samma
 *     mitt) för att nästa obesökta event ska synas (7/10 sent).
 */

export type MapBounds = { west: number; south: number; east: number; north: number };

/**
 * Andel av skärmhöjden (räknat från botten) som eventkortet täcker i sitt
 * hopfällda peek-läge — EventCard:s COLLAPSED_HEIGHT_VH (22 vh). Konstant i
 * stället för kortets faktiska höjd: urvalet ska inte ändras medan man drar
 * i kortet, och drar man ner det till peek står brickan garanterat fri.
 */
export const TOUR_CARD_COVER_FRACTION = 0.22;

// Web Mercator-y (utan skalfaktor): skärmens vertikala led är linjär i den
// här, inte i latitud — så "andel av skärmhöjden" måste räknas här.
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

/**
 * Är punkten synlig på skärmen? Inom kartrutan, och — om coveredFraction > 0
 * — ovanför den nedersta andelen av skärmhöjden (kortet). Utan kartruta
 * (kartan har inte rapporterat än) syns inget.
 */
export function isInVisibleMapArea(
    lat: number,
    lng: number,
    bounds: MapBounds | null | undefined,
    coveredFraction = 0,
): boolean {
    if (!bounds) return false;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lng < bounds.west || lng > bounds.east || lat < bounds.south || lat > bounds.north) return false;
    if (coveredFraction <= 0) return true;
    const yNorth = mercY(bounds.north);
    const ySouth = mercY(bounds.south);
    const yCardTop = ySouth + (yNorth - ySouth) * Math.min(1, coveredFraction);
    return mercY(lat) >= yCardTop;
}

/**
 * Kalenderdagens offset från idag: 0 = idag, 1 = imorgon, −1 = igår. Räknar
 * på lokala dygnsstarter och avrundar, så en sommartidsomställning (23- eller
 * 25-timmarsdygn) inte ger 0.96 eller 1.04.
 */
export function dayOffsetOf(time: Date, now: Date = new Date()): number {
    const day = new Date(time);
    day.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Nästa periodstart EFTER fromOffset vars fönster [start, start+periodDays−1]
 * innehåller minst en av eventDayOffsets. Stegar i HELA perioder (en dag i
 * dagläget, sju i veckovyn — ett endagssteg i veckovyn hade visat nästan
 * samma event igen). Tomma dagar hoppas över; null när inget finns kvar.
 */
export function nextPeriodWithEvents(
    eventDayOffsets: Iterable<number>,
    fromOffset: number,
    periodDays = 1,
): number | null {
    const days = Math.max(1, Math.floor(periodDays));
    const offsets = new Set<number>();
    let maxOffset = -Infinity;
    for (const o of eventDayOffsets) {
        if (!Number.isFinite(o)) continue;
        offsets.add(o);
        if (o > maxOffset) maxOffset = o;
    }
    if (offsets.size === 0) return null;
    for (let start = fromOffset + days; start <= maxOffset; start += days) {
        for (let d = 0; d < days; d++) {
            if (offsets.has(start + d)) return start;
        }
    }
    return null;
}

/**
 * NÄSTA ZOOMAR UT när eventen i bild är genomgångna (ägarbeslut 7/10 sent,
 * Josef: "när vi har gått genom alla de som vi inom det området där vi är.
 * då ska ju kartan automatiskt zooma ut, men börja om på vilken dag man är
 * på") - ERSÄTTER 2/9-steget "rakt till nästa dag". Kameran panorerar
 * fortfarande ALDRIG: den zoomar ut kring samma mitt, precis så mycket att
 * målet hamnar i bild.
 *
 * Hur många zoomnivåer ut som krävs för att en punkt dx/dy pixlar från
 * kartans mitt ska landa i den synliga ytan: inom en marginal (padFraction
 * av bredd/höjd) från kanterna och ovanför kortets nedersta andel
 * (coveredFraction, samma mått som isInVisibleMapArea). En zoomnivå ut
 * halverar alla avstånd från mitten. 0 = syns redan.
 */
export function zoomOutStepsToReveal(
    dx: number,
    dy: number,
    width: number,
    height: number,
    coveredFraction = TOUR_CARD_COVER_FRACTION,
    padFraction = 0.1,
): number {
    if (!(width > 0) || !(height > 0)) return 0;
    const padX = width * padFraction;
    const padY = height * padFraction;
    // Hur långt från mitten punkten får ligga åt det håll den ligger.
    const roomX = width / 2 - padX;
    const roomY = dy < 0 ? height / 2 - padY : height * (0.5 - coveredFraction) - padY;
    let scale = 1;
    if (dx !== 0 && roomX > 0) scale = Math.min(scale, roomX / Math.abs(dx));
    if (dy !== 0 && roomY > 0) scale = Math.min(scale, roomY / Math.abs(dy));
    return scale >= 1 ? 0 : -Math.log2(scale);
}
