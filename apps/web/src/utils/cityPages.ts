/**
 * Stadssidornas städer (/evenemang/<slug>) — den KLIENTSÄKRA listan.
 *
 * Bodde i app/(v1)/evenemang/cityData.ts t.o.m. 2/9, men den modulen läser
 * event-JSON:erna med fs och kan inte importeras av klientkod. Kartans
 * stadsnamns-länk överst (Josef 2/9: "hoppa över stad-för-stad-sidan och gå
 * direkt till den stad man är i") behöver veta vilka orter som HAR en
 * stadssida och var de ligger — därför ligger själva listan här, och
 * cityData re-exporterar den så alla gamla importer står kvar oförändrade.
 *
 * Skild från utils/cityPoints (291 SÖKBARA orter — de flesta saknar
 * stadssida) och lib/cityUtils (medlemssegmenteringens kommunlista).
 */

export type City = {
    name: string; slug: string; lat: number; lng: number; population: number;
    /** Mindre ort: 20 km-radie (i stället för 35), INGA kategorisidor, och
     *  noindex-vakt när utbudet är tunt (MIN_INDEXABLE_EVENTS). Se blocket
     *  vid småortslistan nedan. */
    small?: true;
};

// Städer som får en egen landningssida. Ordningen spelar ingen roll —
// sidorna sorterar själva efter eventantal. population = kommunens, ca
// (SCB 2024, avrundat) — används bara för topplistans "per invånare"-läge,
// grova siffror räcker gott.
export const CITIES: City[] = [
    { name: 'Stockholm', slug: 'stockholm', lat: 59.33, lng: 18.06, population: 990000 },
    { name: 'Göteborg', slug: 'goteborg', lat: 57.71, lng: 11.97, population: 600000 },
    { name: 'Malmö', slug: 'malmo', lat: 55.60, lng: 13.00, population: 366000 },
    { name: 'Uppsala', slug: 'uppsala', lat: 59.86, lng: 17.64, population: 242000 },
    { name: 'Linköping', slug: 'linkoping', lat: 58.41, lng: 15.62, population: 167000 },
    { name: 'Örebro', slug: 'orebro', lat: 59.27, lng: 15.21, population: 159000 },
    { name: 'Västerås', slug: 'vasteras', lat: 59.61, lng: 16.55, population: 160000 },
    { name: 'Helsingborg', slug: 'helsingborg', lat: 56.05, lng: 12.69, population: 152000 },
    { name: 'Norrköping', slug: 'norrkoping', lat: 58.59, lng: 16.19, population: 146000 },
    { name: 'Jönköping', slug: 'jonkoping', lat: 57.78, lng: 14.16, population: 147000 },
    { name: 'Umeå', slug: 'umea', lat: 63.83, lng: 20.26, population: 133000 },
    { name: 'Lund', slug: 'lund', lat: 55.70, lng: 13.19, population: 131000 },
    { name: 'Borås', slug: 'boras', lat: 57.72, lng: 12.94, population: 115000 },
    { name: 'Sundsvall', slug: 'sundsvall', lat: 62.39, lng: 17.31, population: 100000 },
    { name: 'Gävle', slug: 'gavle', lat: 60.67, lng: 17.14, population: 103000 },
    { name: 'Eskilstuna', slug: 'eskilstuna', lat: 59.37, lng: 16.51, population: 108000 },
    { name: 'Halmstad', slug: 'halmstad', lat: 56.67, lng: 12.86, population: 106000 },
    { name: 'Växjö', slug: 'vaxjo', lat: 56.88, lng: 14.81, population: 98000 },
    { name: 'Karlstad', slug: 'karlstad', lat: 59.40, lng: 13.51, population: 97000 },
    { name: 'Södertälje', slug: 'sodertalje', lat: 59.20, lng: 17.63, population: 103000 },
    { name: 'Kristianstad', slug: 'kristianstad', lat: 56.03, lng: 14.16, population: 87000 },
    { name: 'Luleå', slug: 'lulea', lat: 65.58, lng: 22.15, population: 79000 },
    { name: 'Skellefteå', slug: 'skelleftea', lat: 64.75, lng: 20.95, population: 78000 },
    { name: 'Kalmar', slug: 'kalmar', lat: 56.66, lng: 16.36, population: 72000 },
    { name: 'Östersund', slug: 'ostersund', lat: 63.18, lng: 14.64, population: 65000 },
    { name: 'Falun', slug: 'falun', lat: 60.61, lng: 15.63, population: 60000 },
    { name: 'Karlskrona', slug: 'karlskrona', lat: 56.16, lng: 15.59, population: 67000 },
    { name: 'Visby', slug: 'visby', lat: 57.64, lng: 18.30, population: 61000 },
    { name: 'Trollhättan', slug: 'trollhattan', lat: 58.28, lng: 12.29, population: 60000 },
    { name: 'Nyköping', slug: 'nykoping', lat: 58.75, lng: 17.01, population: 58000 },
    { name: 'Skövde', slug: 'skovde', lat: 58.39, lng: 13.85, population: 58000 },

    // ── Småorter (small: true) — SEO-långsvansen, tillagda 1/9 2026 ──────────
    // Urvalet är RÄKNAT, inte tyckt (analysscript i sessionen 1/9): av
    // cityPoints 291 orter behölls de som (1) ligger ≥20 km från närmaste
    // befintliga stadssida, och efter iterativ närmsta-ort-tilldelning har
    // (2) ≥40 kommande källfiltrerade event, (3) spridda över ≥15 av 30 dagar
    // och ≥8 av 16 helgdagar, samt (4) ≥40 % av eventen inom 10 km ("Evenemang
    // i X" måste vara sant — Landskrona-läxan). 40 orter klarade golvet;
    // listan är stabil ±små golvändringar (naturligt glapp i datat under den).
    // Förorter (Solna, Mölndal…) faller på separationskravet — de vore
    // doorway-sidor med storstadens utbud. Koordinater från utils/cityPoints.
    { name: 'Kungsbacka', slug: 'kungsbacka', lat: 57.49, lng: 12.08, population: 87000, small: true },
    { name: 'Varberg', slug: 'varberg', lat: 57.11, lng: 12.25, population: 67000, small: true },
    { name: 'Norrtälje', slug: 'norrtalje', lat: 59.76, lng: 18.70, population: 65000, small: true },
    { name: 'Märsta', slug: 'marsta', lat: 59.62, lng: 17.86, population: 51000, small: true },
    { name: 'Åkersberga', slug: 'akersberga', lat: 59.48, lng: 18.30, population: 48000, small: true },
    { name: 'Upplands Väsby', slug: 'upplands-vasby', lat: 59.52, lng: 17.91, population: 48000, small: true },
    { name: 'Enköping', slug: 'enkoping', lat: 59.64, lng: 17.08, population: 48000, small: true },
    { name: 'Falkenberg', slug: 'falkenberg', lat: 56.90, lng: 12.49, population: 47000, small: true },
    { name: 'Landskrona', slug: 'landskrona', lat: 55.87, lng: 12.83, population: 47000, small: true },
    { name: 'Motala', slug: 'motala', lat: 58.54, lng: 15.04, population: 44000, small: true },
    { name: 'Ängelholm', slug: 'angelholm', lat: 56.25, lng: 12.86, population: 44000, small: true },
    { name: 'Piteå', slug: 'pitea', lat: 65.32, lng: 21.48, population: 42000, small: true },
    { name: 'Alingsås', slug: 'alingsas', lat: 57.93, lng: 12.53, population: 42000, small: true },
    { name: 'Strängnäs', slug: 'strangnas', lat: 59.38, lng: 17.03, population: 40000, small: true },
    { name: 'Västervik', slug: 'vastervik', lat: 57.76, lng: 16.64, population: 37000, small: true },
    { name: 'Kinna', slug: 'kinna', lat: 57.51, lng: 12.69, population: 35000, small: true },
    { name: 'Värnamo', slug: 'varnamo', lat: 57.19, lng: 14.04, population: 35000, small: true },
    { name: 'Vallentuna', slug: 'vallentuna', lat: 59.53, lng: 18.08, population: 34000, small: true },
    { name: 'Nödinge', slug: 'nodinge', lat: 57.90, lng: 12.05, population: 33000, small: true },
    { name: 'Kungsängen', slug: 'kungsangen', lat: 59.48, lng: 17.75, population: 32000, small: true },
    { name: 'Karlshamn', slug: 'karlshamn', lat: 56.17, lng: 14.86, population: 32000, small: true },
    { name: 'Ystad', slug: 'ystad', lat: 55.43, lng: 13.82, population: 31000, small: true },
    { name: 'Ljungby', slug: 'ljungby', lat: 56.83, lng: 13.94, population: 29000, small: true },
    { name: 'Stenungsund', slug: 'stenungsund', lat: 58.07, lng: 11.82, population: 27000, small: true },
    { name: 'Laholm', slug: 'laholm', lat: 56.51, lng: 13.04, population: 26000, small: true },
    { name: 'Arvika', slug: 'arvika', lat: 59.65, lng: 12.59, population: 25000, small: true },
    { name: 'Östhammar', slug: 'osthammar', lat: 60.26, lng: 18.37, population: 22000, small: true },
    { name: 'Sjöbo', slug: 'sjobo', lat: 55.63, lng: 13.70, population: 20000, small: true },
    { name: 'Tranås', slug: 'tranas', lat: 58.03, lng: 14.98, population: 19000, small: true },
    { name: 'Älmhult', slug: 'almhult', lat: 56.55, lng: 14.14, population: 18000, small: true },
    { name: 'Höör', slug: 'hoor', lat: 55.93, lng: 13.54, population: 17000, small: true },
    { name: 'Sölvesborg', slug: 'solvesborg', lat: 56.05, lng: 14.58, population: 17000, small: true },
    { name: 'Vimmerby', slug: 'vimmerby', lat: 57.67, lng: 15.86, population: 15000, small: true },
    { name: 'Säffle', slug: 'saffle', lat: 59.13, lng: 12.92, population: 15000, small: true },
    { name: 'Trosa', slug: 'trosa', lat: 58.90, lng: 17.55, population: 14000, small: true },
    { name: 'Arboga', slug: 'arboga', lat: 59.39, lng: 15.84, population: 14000, small: true },
    { name: 'Olofström', slug: 'olofstrom', lat: 56.28, lng: 14.53, population: 13000, small: true },
    { name: 'Borgholm', slug: 'borgholm', lat: 56.88, lng: 16.66, population: 11000, small: true },
    { name: 'Markaryd', slug: 'markaryd', lat: 56.46, lng: 13.60, population: 10000, small: true },
    { name: 'Mullsjö', slug: 'mullsjo', lat: 57.92, lng: 13.88, population: 7000, small: true },
];

/**
 * Längre bort än så här från närmaste stadssida ska stadsnamnet INTE länka
 * till en stad utan till /evenemang-indexet: i Kiruna är "Luleå" (30 mil
 * bort) ett sämre svar än listan över alla städer. Stadssidorna själva
 * räknar 35 km (20 för småorterna) som "med omnejd" — 60 km är samma gräns
 * som kartans stadsnamn-platta använder för att alls skriva ut en ort.
 */
export const CITY_PAGE_MAX_KM = 60;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Storcirkelavstånd i km (haversine) — samma formel som cityData.distKm. */
export function cityPageDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Närmaste stad MED STADSSIDA till en punkt, eller null när ingen ligger inom
 * maxKm (då är /evenemang-indexet rätt länkmål). Ren funktion — ingen
 * webbläsare, inget nät.
 */
export function nearestCityPage(lat: number, lng: number, maxKm: number = CITY_PAGE_MAX_KM): City | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    let best: City | null = null;
    let bestKm = Infinity;
    for (const c of CITIES) {
        const km = cityPageDistanceKm(lat, lng, c.lat, c.lng);
        if (km < bestKm) { best = c; bestKm = km; }
    }
    return best && bestKm <= maxKm ? best : null;
}

/** Stadssidans URL. */
export const cityPageHref = (city: City): string => `/evenemang/${city.slug}`;
