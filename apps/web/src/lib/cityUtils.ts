/**
 * cityUtils — slug↔stad mappning + matchning av event till stad.
 *
 * Slug-format: lowercase, å/ä→a, ö→o, mellanslag→bindestreck.
 * Exempel: "Malmö" → "malmo", "Östersund" → "ostersund", "Upplands Väsby" → "upplands-vasby".
 */

export interface City {
    slug: string;
    name: string;
    lat: number;
    lng: number;
    region: string;  // län
    population?: number;
}

/**
 * De 60 största svenska kommunerna efter folkmängd plus alla där vi har
 * dedikerad scraper-källa. Koordinaterna är ungefärligt stadens centrum.
 * Används för per-kommun-sidor + radie-matchning.
 */
export const CITIES: City[] = [
    // ─── 25 störst (~3.5M+ invånare totalt) ──────────────────────────────────
    { slug: 'stockholm',     name: 'Stockholm',     lat: 59.3293, lng: 18.0686, region: 'stockholm', population: 980000 },
    { slug: 'goteborg',      name: 'Göteborg',      lat: 57.7089, lng: 11.9746, region: 'vastra-gotaland', population: 590000 },
    { slug: 'malmo',         name: 'Malmö',         lat: 55.6049, lng: 13.0038, region: 'skane', population: 350000 },
    { slug: 'uppsala',       name: 'Uppsala',       lat: 59.8586, lng: 17.6389, region: 'uppsala', population: 240000 },
    { slug: 'vasteras',      name: 'Västerås',      lat: 59.6099, lng: 16.5448, region: 'vastmanland', population: 160000 },
    { slug: 'orebro',        name: 'Örebro',        lat: 59.2741, lng: 15.2066, region: 'orebro', population: 160000 },
    { slug: 'linkoping',     name: 'Linköping',     lat: 58.4108, lng: 15.6214, region: 'ostergotland', population: 165000 },
    { slug: 'helsingborg',   name: 'Helsingborg',   lat: 56.0465, lng: 12.6945, region: 'skane', population: 150000 },
    { slug: 'jonkoping',     name: 'Jönköping',     lat: 57.7826, lng: 14.1618, region: 'jonkoping', population: 145000 },
    { slug: 'norrkoping',    name: 'Norrköping',    lat: 58.5877, lng: 16.1924, region: 'ostergotland', population: 145000 },
    { slug: 'lund',          name: 'Lund',          lat: 55.7058, lng: 13.1932, region: 'skane', population: 130000 },
    { slug: 'umea',          name: 'Umeå',          lat: 63.8258, lng: 20.2630, region: 'vasterbotten', population: 135000 },
    { slug: 'gavle',         name: 'Gävle',         lat: 60.6749, lng: 17.1413, region: 'gavleborg', population: 105000 },
    { slug: 'boras',         name: 'Borås',         lat: 57.7210, lng: 12.9401, region: 'vastra-gotaland', population: 115000 },
    { slug: 'sodertalje',    name: 'Södertälje',    lat: 59.1955, lng: 17.6253, region: 'stockholm', population: 100000 },
    { slug: 'eskilstuna',    name: 'Eskilstuna',    lat: 59.3705, lng: 16.5092, region: 'sodermanland', population: 110000 },
    { slug: 'halmstad',      name: 'Halmstad',      lat: 56.6745, lng: 12.8578, region: 'halland', population: 105000 },
    { slug: 'sundsvall',     name: 'Sundsvall',     lat: 62.3908, lng: 17.3069, region: 'vasternorrland', population: 100000 },
    { slug: 'vaxjo',         name: 'Växjö',         lat: 56.8777, lng: 14.8094, region: 'kronoberg', population: 95000 },
    { slug: 'karlstad',      name: 'Karlstad',      lat: 59.3793, lng: 13.5036, region: 'varmland', population: 95000 },
    { slug: 'kristianstad',  name: 'Kristianstad',  lat: 56.0294, lng: 14.1567, region: 'skane', population: 85000 },
    { slug: 'lulea',         name: 'Luleå',         lat: 65.5848, lng: 22.1547, region: 'norrbotten', population: 80000 },
    { slug: 'mölndal',       name: 'Mölndal',       lat: 57.6554, lng: 12.0140, region: 'vastra-gotaland', population: 70000 },
    { slug: 'kalmar',        name: 'Kalmar',        lat: 56.6634, lng: 16.3613, region: 'kalmar', population: 72000 },
    { slug: 'falun',         name: 'Falun',         lat: 60.6066, lng: 15.6355, region: 'dalarna', population: 60000 },
    // Andra med dedikerad källa eller hög event-volym
    { slug: 'skelleftea',    name: 'Skellefteå',    lat: 64.7507, lng: 20.9528, region: 'vasterbotten', population: 75000 },
    { slug: 'karlskrona',    name: 'Karlskrona',    lat: 56.1612, lng: 15.5869, region: 'blekinge', population: 67000 },
    { slug: 'trollhattan',   name: 'Trollhättan',   lat: 58.2837, lng: 12.2886, region: 'vastra-gotaland', population: 60000 },
    { slug: 'ostersund',     name: 'Östersund',     lat: 63.1792, lng: 14.6357, region: 'jamtland', population: 50000 },
    { slug: 'uddevalla',     name: 'Uddevalla',     lat: 58.3498, lng: 11.9419, region: 'vastra-gotaland', population: 56000 },
    { slug: 'borlange',      name: 'Borlänge',      lat: 60.4858, lng: 15.4371, region: 'dalarna', population: 53000 },
    { slug: 'motala',        name: 'Motala',        lat: 58.5371, lng: 15.0366, region: 'ostergotland', population: 45000 },
    { slug: 'helsingborg',   name: 'Helsingborg',   lat: 56.0465, lng: 12.6945, region: 'skane', population: 150000 },
    { slug: 'landskrona',    name: 'Landskrona',    lat: 55.8703, lng: 12.8307, region: 'skane', population: 47000 },
    { slug: 'nykoping',      name: 'Nyköping',      lat: 58.7531, lng: 17.0085, region: 'sodermanland', population: 60000 },
    { slug: 'falkenberg',    name: 'Falkenberg',    lat: 56.9055, lng: 12.4912, region: 'halland', population: 47000 },
    { slug: 'alingsas',      name: 'Alingsås',      lat: 57.9295, lng: 12.5333, region: 'vastra-gotaland', population: 43000 },
    { slug: 'pitea',         name: 'Piteå',         lat: 65.3170, lng: 21.4795, region: 'norrbotten', population: 43000 },
    { slug: 'katrineholm',   name: 'Katrineholm',   lat: 58.9967, lng: 16.2089, region: 'sodermanland', population: 35000 },
    { slug: 'monsteras',     name: 'Mönsterås',     lat: 57.0394, lng: 16.4421, region: 'kalmar', population: 13000 },
];

const BY_SLUG = new Map(CITIES.map(c => [c.slug, c]));

export function getCity(slug: string): City | null {
    return BY_SLUG.get(slug.toLowerCase()) || null;
}

export function slugifyCity(name: string): string {
    return name.toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Haversine i km. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Är eventet i denna stad? Matchar antingen genom:
 *   - locationName/extractedAddress innehåller stadnamn (case-insensitive)
 *   - lat/lng inom RADIUS_KM från stadens centrum (default 20km)
 */
export function eventMatchesCity(
    event: { locationName?: string; extractedAddress?: string; lat?: number; lng?: number },
    city: City,
    radiusKm: number = 20,
): boolean {
    const name = city.name.toLowerCase();
    const haystack = `${event.locationName || ''} ${event.extractedAddress || ''}`.toLowerCase();
    if (haystack.includes(name)) return true;
    if (event.lat && event.lng && event.lat !== 0 && event.lng !== 0) {
        const dist = haversineKm(event.lat, event.lng, city.lat, city.lng);
        if (dist <= radiusKm) return true;
    }
    return false;
}
