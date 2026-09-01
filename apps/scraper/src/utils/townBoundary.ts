/**
 * townBoundary.ts — hör eventet hemma på orten vi postar om?
 *
 * BAKGRUNDEN: stadsinläggen väljer event inom en RADIE (25 km), och en radie
 * känner inga kommungränser. Landskrona-gruppen avvisade oss 2026-09-01 med
 * motiveringen "Ta bort alla evenemang som ej finns i Landskrona kommun och
 * lägg upp igen" — inlägget hade Helsingborg (Sundspärlan), Kävlinge
 * (Löddeköpinge), Lomma (Bjärred) och Svalöv i sig, fler utsocknes rader än
 * egna. Samma fel gjorde Torshälla-inlägget till ett Västerås-inlägg och
 * satte Gottsunda (Uppsala, 60 km bort) i Märsta-inlägget.
 *
 * VI HAR INGA KOMMUNPOLYGONER, och behöver inga: webbens `cityPoints`
 * (293 orter, i stort sett varje kommunhuvudort) räcker för att avgöra vilken
 * ort ett event NATURLIGT hör till. Det är samma resonemang som kartans
 * stadsruta gör när den visar närmsta ort.
 *
 * Två prov, namnet före geometrin — en adress som säger "Kävlinge" är ett
 * starkare bevis än en koordinat som råkar ligga nära gränsen.
 *
 * Ren logik utan I/O: ortlistan skickas in. Testas i townBoundary.test.ts.
 */

export interface TownPoint {
    name: string;
    lat: number;
    lng: number;
}

export interface PlacedEvent {
    locationName?: string | null;
    extractedAddress?: string | null;
    lat: number;
    lng: number;
}

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Ortnamn kortare än så här ger för många falska träffar i fritext ("Ed",
 * "Ås", "Mora" i "Hedemora"). De orterna avgörs på geometri i stället.
 */
const MIN_NAME_LENGTH = 4;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Ordgräns som tål åäö. JS \b räknar å/ä/ö som icke-bokstäver, så
 * "Lund" hade matchat mitt i "Lundåkra" — därför en egen teckenklass.
 */
function mentionsTown(haystack: string, town: string): boolean {
    if (town.length < MIN_NAME_LENGTH) return false;
    const re = new RegExp(`(^|[^a-zåäöéüA-ZÅÄÖÉÜ])${escapeRegex(town)}($|[^a-zåäöéüA-ZÅÄÖÉÜ])`, 'i');
    return re.test(haystack);
}

/**
 * Vilka orter nämns i eventets plats-/adressfält? Längsta namnet först, så
 * "Helsingborg" vinner över en ort vars namn är en delsträng av det.
 */
export function townsMentioned(event: PlacedEvent, towns: TownPoint[]): string[] {
    const hay = `${event.locationName ?? ''} ${event.extractedAddress ?? ''}`;
    if (!hay.trim()) return [];
    return towns
        .filter(t => mentionsTown(hay, t.name))
        .map(t => t.name)
        .sort((a, b) => b.length - a.length);
}

/** Orten vars mittpunkt ligger närmast eventet. */
export function nearestTown(event: PlacedEvent, towns: TownPoint[]): TownPoint | null {
    let best: TownPoint | null = null;
    let bestKm = Infinity;
    for (const t of towns) {
        const km = distanceKm(event.lat, event.lng, t.lat, t.lng);
        if (km < bestKm) { bestKm = km; best = t; }
    }
    return best;
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Hör eventet hemma i `town`?
 *
 * 1. NAMNPROVET. Nämner platsen vår ort är svaret ja — "Landskrona Teater"
 *    hör till Landskrona även om koordinaten hamnat snett. Nämner den bara
 *    ANDRA orter är svaret nej: "Friluftsfrämjandet Lödde-Kävlinge" är
 *    Kävlinges, hur nära Landskrona den än råkar ligga.
 *
 * 2. GEOMETRIPROVET. Utan ortnamn att gå på vinner närmaste ort. Sundspärlan
 *    säger inte "Helsingborg" i namnet, men ligger där.
 *
 * `nearbyRadiusKm` är en säkerhetsventil för orter som SAKNAS i listan:
 * ligger eventet mycket nära vår ort behålls det även om någon grannort
 * råkar vara marginellt närmare. Utan den tappar små orter i storstadens
 * skugga nästan allt.
 */
export function belongsToTown(
    event: PlacedEvent,
    town: TownPoint,
    towns: TownPoint[],
    { nearbyRadiusKm = 4 }: { nearbyRadiusKm?: number } = {},
): boolean {
    const mentioned = townsMentioned(event, towns);
    if (mentioned.some(n => sameName(n, town.name))) return true;
    if (mentioned.length > 0) return false;

    if (distanceKm(event.lat, event.lng, town.lat, town.lng) <= nearbyRadiusKm) return true;

    const nearest = nearestTown(event, towns);
    return nearest === null || sameName(nearest.name, town.name);
}
