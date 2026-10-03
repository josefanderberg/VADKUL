/**
 * Geografiska RUTOR för kartdatat — egress-trappans nästa steg efter
 * tidsfönstret (docs/egress-optimering.md, "Fällan").
 *
 * Kartan hämtade hela Sveriges event även för den som bara tittar på sin stad:
 * 14-dagarsfönstret är ~1,2 MB brotli för landet men ~0,11 MB för rutan runt
 * Stockholm (mätt 3/10, 26 360 event i fönstret). Klienten hämtar därför bara
 * rutorna runt kartvyn.
 *
 * KVANTISERINGEN ÄR HELA POÄNGEN, precis som för tidsfönstret: rutorna är ett
 * FAST rutnät, så alla besökare över samma stad ber om exakt samma URL:er och
 * CDN:en cachar EN post per ruta och dygn. Slica aldrig på besökarens råa
 * viewport-bbox — då blir varje besök en cache-miss och en funktionsinvokation.
 *
 * Ren modul (inga webbläsar- eller Node-API:er): delas av routen
 * /api/events/[layer] och klienten (linkEventService), och testas här.
 */
import { eventKeyNum } from './eventKey';

/** Rutans höjd i grader latitud (~55 km). */
export const TILE_LAT_DEG = 0.5;
/** Rutans bredd i grader longitud (~55 km på 60° N). */
export const TILE_LNG_DEG = 1;

/**
 * Giltigt rutområde (index, inklusive). Sverige ligger på lat 55–69,
 * lng 11–24; rutnätet tillåter generös marginal (grannländernas
 * gränstrakter) men ingen godtycklig ruta — routen avvisar allt utanför, så
 * ingen kan spränga CDN-cachen med påhittade nycklar.
 */
export const TILE_LAT_MIN = 100;  // 50° N
export const TILE_LAT_MAX = 143;  // 72° N (exkl.)
export const TILE_LNG_MIN = 0;    // 0° E
export const TILE_LNG_MAX = 34;   // 35° E (exkl.)

/**
 * Fler rutor än så här i området → hämta hela landet i stället. Kartans
 * område är minst veckovyns 60 km-cirkel: 6–9 rutor i södra Sverige, ~15 i
 * fjällen (meridianerna går ihop); ett utzoomat län ~20. Hela Sverige i bild
 * är ~400 rutor — där är landslagret både färre förfrågningar och lika många
 * bytes.
 */
export const MAX_AREA_TILES = 25;

/** Hur mycket vyn breddas åt varje håll innan rutorna räknas (andel av
 *  spannet). Litet panorerande ska inte ge en ny hämtning för varje drag. */
export const AREA_MARGIN_FRACTION = 0.25;

/**
 * Antal hinkar för beskrivningslagret. Beskrivningar behövs bara för det kort
 * man öppnar — i stället för hela lagret (~2 MB brotli) hämtas hinken eventet
 * ligger i (~47 000 / 512 ≈ 90 beskrivningar, några kB). Fast antal = fasta
 * URL:er = CDN-träff mellan besökare.
 */
export const DESC_BUCKETS = 512;

/** Rå destinations-rad (aggregatets form) — bara fälten rutlogiken läser. */
export interface DestRowLike {
    id?: unknown;
    time?: unknown;
    lat?: unknown;
    lng?: unknown;
}

export interface Bounds {
    west: number;
    south: number;
    east: number;
    north: number;
}

/** "118_18" — rutans index i lat- resp. lng-led. URL-säkert utan kodning. */
export function tileKey(latIdx: number, lngIdx: number): string {
    return `${latIdx}_${lngIdx}`;
}

/**
 * Rutan en koordinat ligger i — null för ogiltiga/oplacerade punkter (0,0 =
 * "oplacerad", döljs ändå på kartan) och för punkter utanför rutområdet.
 */
export function tileKeyFor(lat: unknown, lng: unknown): string | null {
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null;
    const la = Math.floor(lat / TILE_LAT_DEG);
    const ln = Math.floor(lng / TILE_LNG_DEG);
    if (la < TILE_LAT_MIN || la >= TILE_LAT_MAX || ln < TILE_LNG_MIN || ln >= TILE_LNG_MAX) return null;
    return tileKey(la, ln);
}

/** Tolka en rutnyckel ur en URL. Allt som inte är en giltig ruta → null. */
export function parseTileKey(raw: unknown): { latIdx: number; lngIdx: number } | null {
    if (typeof raw !== 'string') return null;
    const m = /^(\d{1,3})_(\d{1,3})$/.exec(raw);
    if (!m) return null;
    const latIdx = Number(m[1]);
    const lngIdx = Number(m[2]);
    if (latIdx < TILE_LAT_MIN || latIdx >= TILE_LAT_MAX || lngIdx < TILE_LNG_MIN || lngIdx >= TILE_LNG_MAX) return null;
    // Kanonisk form krävs ("0118_18" är samma ruta men en ANNAN cache-nyckel).
    if (tileKey(latIdx, lngIdx) !== raw) return null;
    return { latIdx, lngIdx };
}

/**
 * Rutorna som täcker vyn (breddad med `margin` av spannet åt varje håll).
 * null = för många rutor (> MAX_AREA_TILES) eller ogiltig vy → anroparen
 * hämtar hela landet. Rutor utanför rutområdet hoppas över (havet runt
 * Sverige, Norge långt västerut) — de kan inte innehålla några event.
 */
export function tilesForBounds(
    b: Bounds,
    margin: number = AREA_MARGIN_FRACTION,
    maxTiles: number = MAX_AREA_TILES,
): string[] | null {
    const { west, south, east, north } = b;
    if (![west, south, east, north].every(Number.isFinite)) return null;
    if (east < west || north < south) return null;
    const padLat = (north - south) * margin;
    const padLng = (east - west) * margin;
    const la0 = Math.max(TILE_LAT_MIN, Math.floor((south - padLat) / TILE_LAT_DEG));
    const la1 = Math.min(TILE_LAT_MAX - 1, Math.floor((north + padLat) / TILE_LAT_DEG));
    const ln0 = Math.max(TILE_LNG_MIN, Math.floor((west - padLng) / TILE_LNG_DEG));
    const ln1 = Math.min(TILE_LNG_MAX - 1, Math.floor((east + padLng) / TILE_LNG_DEG));
    // Vyn helt utanför rutområdet: inga rutor behövs (tom lista ≠ "hela landet").
    if (la1 < la0 || ln1 < ln0) return [];
    if ((la1 - la0 + 1) * (ln1 - ln0 + 1) > maxTiles) return null;
    const out: string[] = [];
    for (let la = la0; la <= la1; la++) {
        for (let ln = ln0; ln <= ln1; ln++) out.push(tileKey(la, ln));
    }
    return out;
}

/**
 * Täcks vyn (UTAN marginal) helt av de laddade rutorna? Det är frågan kartan
 * ställer innan den får säga "Inga event här" — en vy som ännu inte hämtats
 * ska visa "Laddar", aldrig ett falskt tomt.
 */
export function boundsCoveredBy(b: Bounds, loaded: ReadonlySet<string>): boolean {
    const tiles = tilesForBounds(b, 0, Number.POSITIVE_INFINITY);
    if (!tiles) return false;
    return tiles.every((t) => loaded.has(t));
}

/** Beskrivningshinken för ett event-id (= källans url). */
export function descBucketFor(id: string): number {
    return eventKeyNum(id) % DESC_BUCKETS;
}

/** Tolka en hinksiffra ur en URL — bara kanoniska heltal i [0, DESC_BUCKETS). */
export function parseDescBucket(raw: unknown): number | null {
    if (typeof raw !== 'string' || !/^(0|[1-9]\d{0,3})$/.test(raw)) return null;
    const n = Number(raw);
    return n < DESC_BUCKETS ? n : null;
}

/**
 * Kvadraten runt en cirkel (radie i km) — kartans dataområde är minst
 * veckovyns cirkel (WEEK_AREA_MIN_RADIUS_KM i page.tsx), så dag→vecka-pulsen
 * vid landningen aldrig väntar på en ny hämtning.
 */
export function circleBounds(lat: number, lng: number, radiusKm: number): Bounds {
    const dLat = radiusKm / 111.32;
    const cos = Math.cos((lat * Math.PI) / 180);
    const dLng = radiusKm / (111.32 * Math.max(cos, 0.01));
    return { west: lng - dLng, south: lat - dLat, east: lng + dLng, north: lat + dLat };
}

/** Minsta rektangel som rymmer båda. */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
    return {
        west: Math.min(a.west, b.west),
        south: Math.min(a.south, b.south),
        east: Math.max(a.east, b.east),
        north: Math.max(a.north, b.north),
    };
}

/**
 * Kartans råa destinations-rader i rutläget: de laddade rutornas rader +
 * dagens LANDSSLICE för allt utanför dem (dagens prickar finns då kvar över
 * hela landet medan rutorna hämtas). Samma id räknas en gång — rutans rad
 * vinner (färskare än dagsslicen), och en server som ignorerar ?tile=
 * (deploy-glappet: gammal funktion, ny klient) ger inga dubbletter.
 * Utdatat är tidssorterat som lagren (kartans sortering räknar med det).
 */
export function composeAreaRows<T extends DestRowLike>(
    todayRows: readonly T[],
    tileRows: Iterable<readonly [string, readonly T[]]>,
): T[] {
    const loaded = new Set<string>();
    const seen = new Set<string>();
    const out: T[] = [];
    for (const [tile, rows] of tileRows) {
        loaded.add(tile);
        for (const r of rows) {
            if (typeof r?.id !== 'string' || seen.has(r.id)) continue;
            seen.add(r.id);
            out.push(r);
        }
    }
    for (const r of todayRows) {
        if (typeof r?.id !== 'string' || seen.has(r.id)) continue;
        const t = tileKeyFor(r.lat, r.lng);
        if (t && loaded.has(t)) continue;
        seen.add(r.id);
        out.push(r);
    }
    // ISO-strängar (samma format genom hela lagret) sorterar som tider.
    return out.sort((a, b) => {
        const ta = String(a.time ?? '');
        const tb = String(b.time ?? '');
        return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
}
