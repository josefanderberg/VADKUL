/**
 * Badplatsfilen (#279): Sveriges badplatser som en liten GeoJSON-fil
 * (apps/web/public/badplatser.json) som webben och appen ritar badskylten ur
 * från kartzoom 9.
 *
 * Josef 22/11: "badplatser syns bara när man zoomar in jättemycket. Fixa så det
 * är mycket högre upp synligt." Baskartans kakel bär badplatserna först från
 * z13, och de djupare kaklen (#222, #274) räcker bara ner till zoom 11 innan
 * hämtningarna blir orimliga. Josef valde zoom 9 med en egen fil.
 *
 * Samma urval som kakelskylten (kontraktets POI_SIGNS.bad): OSM:s
 * leisure=bathing_place, natural=beach och amenity=public_bath. kind-värdena
 * skrivs som kaklens, så kontraktets lager och tryckruta fungerar oförändrade.
 *
 * Ren modul: hämtningen och skrivningen bor i scripts/badplatser.ts.
 */

export const BAD_KINDS = ['bathing_place', 'beach', 'public_bath'] as const;
export type BadKind = typeof BAD_KINDS[number];

/** Overpass-frågan: alla tre platstyperna inom Sverige, ytor som mittpunkt. */
export const BADPLATS_QUERY = `[out:json][timeout:300];
area["ISO3166-1"="SE"][admin_level=2]->.se;
(
  nwr["leisure"="bathing_place"](area.se);
  nwr["natural"="beach"](area.se);
  nwr["amenity"="public_bath"](area.se);
);
out center tags;`;

/**
 * Färre än så här efter rensningen = Overpass gav ett halvt svar (timeout,
 * avbruten fråga). Då skrivs filen inte över. Mätt mot OSM: flera tusen.
 */
export const BADPLATS_MIN_COUNT = 1000;

/** Två platser närmare än så här är samma bad (en strand + badplatsnoden på den). */
export const BADPLATS_SAME_METERS = 150;

export interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

export interface Badplats {
    /** "n123", "w456", "r789" - stabil ordning i filen. */
    id: string;
    kind: BadKind;
    name: string | null;
    lat: number;
    lon: number;
}

function kindOf(tags: Record<string, string>): BadKind | null {
    if (tags.leisure === 'bathing_place') return 'bathing_place';
    if (tags.natural === 'beach') return 'beach';
    if (tags.amenity === 'public_bath') return 'public_bath';
    return null;
}

/** Overpass-svarets element som badplatser. Element utan plats eller typ hoppas över. */
export function parseOverpass(json: unknown): Badplats[] {
    const elements = (json as { elements?: unknown })?.elements;
    if (!Array.isArray(elements)) return [];
    const out: Badplats[] = [];
    for (const raw of elements as OverpassElement[]) {
        const tags = raw?.tags ?? {};
        const kind = kindOf(tags);
        if (!kind) continue;
        const lat = raw.lat ?? raw.center?.lat;
        const lon = raw.lon ?? raw.center?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const name = (tags.name ?? '').trim() || null;
        out.push({ id: `${raw.type?.[0] ?? 'x'}${raw.id}`, kind, name, lat, lon });
    }
    return out;
}

function metersBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371000;
    const toRad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toRad;
    const dLon = (b.lon - a.lon) * toRad;
    const s = Math.sin(dLat / 2) ** 2
        + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

const KIND_RANK: Record<BadKind, number> = { bathing_place: 0, beach: 1, public_bath: 2 };

/**
 * Slå ihop platser som ligger inom `meters` från varandra till en: en strand
 * med en badplatsnod på är ETT bad, och två skyltar på samma ställe är brus.
 * Företräde: platsen med namn, sedan badplats före strand före badhus, sedan
 * lägsta id (så filen blir likadan varje vecka om OSM inte ändrats).
 */
export function dedupeBadplatser(list: readonly Badplats[], meters = BADPLATS_SAME_METERS): Badplats[] {
    const sorted = [...list].sort((a, b) =>
        (a.name ? 0 : 1) - (b.name ? 0 : 1)
        || KIND_RANK[a.kind] - KIND_RANK[b.kind]
        || a.id.localeCompare(b.id));
    // Rutnät i grader, stort nog att grannarna alltid ligger i närmaste 3x3.
    // En longitudgrad är kortare i norr: rutan görs bred nog för 70 grader N.
    const cellLat = meters / 111000;
    const cellLon = cellLat / Math.cos(70 * Math.PI / 180);
    const grid = new Map<string, Badplats[]>();
    const kept: Badplats[] = [];
    for (const p of sorted) {
        const ci = Math.floor(p.lat / cellLat);
        const cj = Math.floor(p.lon / cellLon);
        let near = false;
        for (let di = -1; di <= 1 && !near; di++) {
            for (let dj = -1; dj <= 1 && !near; dj++) {
                for (const q of grid.get(`${ci + di}:${cj + dj}`) ?? []) {
                    if (metersBetween(p, q) < meters) { near = true; break; }
                }
            }
        }
        if (near) continue;
        const copy = { ...p };
        kept.push(copy);
        const k = `${ci}:${cj}`;
        grid.set(k, [...(grid.get(k) ?? []), copy]);
    }
    return kept.sort((a, b) => a.id.localeCompare(b.id));
}

/** Fem decimaler = runt en meter, mer behövs inte för en skylt. */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * GeoJSON-filen. Egenskaperna heter som i baskartans kakel (kind, name) så
 * kontraktets skyltlager läser filen utan egen gren. Namnlösa platser saknar
 * name helt (lagret skriver då "Badplats").
 */
export function toBadplatsGeoJSON(list: readonly Badplats[]) {
    return {
        type: 'FeatureCollection' as const,
        features: list.map(p => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [round(p.lon), round(p.lat)] },
            properties: p.name ? { kind: p.kind, name: p.name } : { kind: p.kind },
        })),
    };
}
