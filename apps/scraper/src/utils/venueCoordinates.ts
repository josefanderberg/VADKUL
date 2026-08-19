import { upsertKnownVenue, lookupVenueExact, lookupVenueSmart, getAllKnownVenues, countKnownVenues, geocodeCacheGet, geocodeCacheSet } from './sqliteHelper';

// Växjö venue coordinates lookup table — källa för initial DB-seedning.
// Lägg inte till nya venues här; använd manage-venues.ts eller known_venues-tabellen direkt.
export const VAXJO_VENUES: Record<string, [number, number]> = {
    // ─── Sports & Entertainment ────────────────────────────────────────────────
    'Vida Arena': [56.8797, 14.7736],
    'Vida arena': [56.8797, 14.7736],
    'vida arena': [56.8797, 14.7736],
    'Fortnox Arena': [56.8790, 14.7715],
    'fortnox arena': [56.8790, 14.7715],
    'Myresjöhus Arena': [56.8767, 14.7758],
    'myresjöhus arena': [56.8767, 14.7758],
    'Visma Arena': [56.8767, 14.7758],
    'Hovshaga Arena': [56.8700, 14.7900],
    'Campushallen': [56.8545, 14.8320],
    'campushallen': [56.8545, 14.8320],
    'Grönahuset': [56.8558, 14.8305],

    // ─── Culture & Music ────────────────────────────────────────────────────────
    'Växjö Konserthus': [56.8778, 14.8089],
    'Vaxjo Konserthus': [56.8778, 14.8089],
    'växjö konserthus': [56.8778, 14.8089],
    'Konserthuset': [56.8778, 14.8089],
    'konserthuset': [56.8778, 14.8089],
    'Konserthuset i Växjö': [56.8778, 14.8089],

    'Nygatan 6': [56.8796, 14.8061],
    'nygatan 6': [56.8796, 14.8061],

    'Växjö Teater': [56.8789, 14.8067],
    'Vaxjo Teater': [56.8789, 14.8067],
    'växjö teater': [56.8789, 14.8067],
    'Teatern': [56.8789, 14.8067],

    'Palladium Folkets Bio Växjö': [56.8793, 14.8065],
    'Palladium Växjö': [56.8793, 14.8065],
    'Palladium': [56.8793, 14.8065],
    'palladium': [56.8793, 14.8065],

    'IOGT Vattentorget': [56.8770, 14.8115],
    'iogt vattentorget': [56.8770, 14.8115],
    'Vattentorget': [56.8770, 14.8115],

    'Kulturhuset Prisma': [56.8783, 14.8050],
    'kulturhuset prisma': [56.8783, 14.8050],
    'Prisma': [56.8783, 14.8050],

    'Nöjesfabriken': [56.8810, 14.8145],
    'nöjesfabriken': [56.8810, 14.8145],

    'Filmstaden Växjö': [56.8800, 14.8090],
    'filmstaden': [56.8800, 14.8090],

    'Wasa Teater': [56.8789, 14.8067],

    // ─── University & Campus ────────────────────────────────────────────────────
    'Linnéuniversitetet': [56.8558, 14.8305],
    'Linneuniversitetet': [56.8558, 14.8305],
    'linnéuniversitetet': [56.8558, 14.8305],
    'Linnéuniversitetet, Växjö': [56.8558, 14.8305],
    'LNU Campus Växjö': [56.8558, 14.8305],
    'LNU': [56.8558, 14.8305],
    'Linnéuniversitetet Växjö': [56.8558, 14.8305],
    'Linnékåren': [56.8552, 14.8298],
    'linnékåren': [56.8552, 14.8298],
    'Kårhuset': [56.8552, 14.8298],
    'kårhuset': [56.8552, 14.8298],

    // ─── Parks & Outdoor ────────────────────────────────────────────────────────
    'Stadsparken': [56.8780, 14.8020],
    'stadsparken': [56.8780, 14.8020],
    'Linnéparken': [56.8810, 14.8110],
    'linnéparken': [56.8810, 14.8110],
    'Växjösjön': [56.8750, 14.8050],
    'Evedals badplats': [56.8600, 14.8500],
    'Kronobergsruinen': [56.8820, 14.8400],
    'Kronobergs slottsruin': [56.8820, 14.8400],

    // ─── City Centre & Squares ──────────────────────────────────────────────────
    'Stortorget': [56.8796, 14.8094],
    'stortorget': [56.8796, 14.8094],
    'Tegnérplatsen': [56.8792, 14.8085],
    'Rådhuset': [56.8790, 14.8082],
    'Rådhustorget': [56.8790, 14.8082],
    'Residenset': [56.8800, 14.8080],

    // ─── Restaurants & Cafés ────────────────────────────────────────────────────
    'PM & Vänner': [56.8791, 14.8078],
    'pm & vänner': [56.8791, 14.8078],
    'PM och Vänner': [56.8791, 14.8078],
    'Bishops Arms Växjö': [56.8793, 14.8085],
    'Bishops Arms': [56.8793, 14.8085],
    'bishops arms': [56.8793, 14.8085],
    'Kafé de Luxe': [56.8800, 14.8060],
    'Res Thai': [56.8798, 14.8072],
    'Södra Bar': [56.8780, 14.8070],

    // ─── Hotels ─────────────────────────────────────────────────────────────────
    'Elite Hotel Växjö': [56.8791, 14.8068],
    'Elite Hotel': [56.8791, 14.8068],
    'Clarion Collection Hotel Cardinal': [56.8795, 14.8072],
    'Hotel Cardinal': [56.8795, 14.8072],
    'Clarion Hotel Växjö': [56.8795, 14.8072],
    'Quality Hotel Ekoxen': [56.8800, 14.8040],

    // ─── Shopping & Markets ──────────────────────────────────────────────────────
    'Grand Samarkand': [56.8900, 14.7950],
    'Samarkand': [56.8900, 14.7950],
    'samarkand': [56.8900, 14.7950],
    'Teleborgscentrum': [56.8698, 14.8138],

    // ─── Community & Libraries ──────────────────────────────────────────────────
    'Växjö Bibliotek': [56.8785, 14.8055],
    'Stadsbiblioteket': [56.8785, 14.8055],
    'Folkets Park': [56.8830, 14.8030],
    'folkets park': [56.8830, 14.8030],

    // ─── Churches ───────────────────────────────────────────────────────────────
    'Domkyrkan': [56.8793, 14.8098],
    'Växjö Domkyrka': [56.8793, 14.8098],
    'Heliga Kors kyrka': [56.8805, 14.8153],

    'Teleborgshallen': [56.8570, 14.8210],
    'Arabyvalen': [56.8870, 14.7930],
    'Bäckaslöv': [56.8740, 14.7950],
    'Växjö Cricket Club': [56.8870, 14.7930],
    'Sigfridbassängen': [56.8650, 14.8250],
    'Sigfridsområdet': [56.8650, 14.8250],

    // ─── Default fallback (Växjö centrum – Stortorget) ──────────────────────────
    'DEFAULT': [56.8796, 14.8094]
};

/**
 * Seed the known_venues SQLite table from VAXJO_VENUES on first run.
 * De-duplicates by JS toLowerCase() before inserting so only one row
 * per case-insensitive name is written.
 */
function seedKnownVenues(): void {
    const seen = new Set<string>();
    for (const [name, [lat, lng]] of Object.entries(VAXJO_VENUES)) {
        if (name === 'DEFAULT') continue;
        const lower = name.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        upsertKnownVenue(name, lat, lng, 'Växjö');
    }
}

// Seed once on first import if the table is empty.
if (countKnownVenues() === 0) {
    seedKnownVenues();
}

/**
 * Generiska venue-ord som finns i nästan varje svensk stad. Substring-matchning
 * på dessa ger cross-city-fel: "Stora Teatern" (Göteborg) får INTE matcha
 * "Teatern" (Växjö), och bare "Domkyrkan" i Lund-kontext ska inte ge Växjö-koords.
 * Exakta träffar tillåts fortfarande — alla nuvarande anropare är Växjö-kontext
 * (create-event.ts interaktivt + geocodeVenue som söker inom ~80 km från Växjö).
 */
const GENERIC_VENUE_TERMS = new Set([
    'teatern', 'stadsteatern', 'konserthuset', 'domkyrkan', 'stadsbiblioteket',
    'biblioteket', 'folkets park', 'folkets hus', 'stadsparken', 'stortorget',
    'rådhuset', 'rådhustorget', 'kårhuset', 'kulturhuset', 'residenset',
    'stadshuset', 'filmstaden', 'hemvärnsgården', 'församlingshemmet',
]);

/** Är termen specifik nog för substring-matchning mot known_venues? */
function isSpecificVenueTerm(nameLower: string): boolean {
    return nameLower.length >= 6 && !GENERIC_VENUE_TERMS.has(nameLower.trim());
}

/**
 * Hitta en känd stad inbäddad i en textsträng (t.ex. "Stadsbiblioteket, Stockholm").
 * Ord-gräns via separator-normalisering — JS \b är opålitligt intill åäö.
 */
function findEmbeddedCity(text: string): string | null {
    const padded = ' ' + text.toLowerCase().replace(/[^a-zåäöéü0-9]+/gi, ' ').trim() + ' ';
    return SWEDISH_GEO_CITIES.find((c) => padded.includes(` ${c.toLowerCase()} `)) ?? null;
}

/** Case-okänslig kontroll mot SWEDISH_GEO_CITIES. Returnerar kanonisk stavning eller null. */
export function knownGeoCity(name: string): string | null {
    const t = (name || '').trim().toLowerCase();
    if (!t) return null;
    return SWEDISH_GEO_CITIES.find((c) => c.toLowerCase() === t) ?? null;
}

/**
 * Get coordinates for a venue name.
 * Queries the known_venues SQLite table (exact, then case-insensitive substring).
 *
 * Cross-city-skydd: nämner frågan en annan stad än radens city-kolumn hoppas
 * raden över, och substring-matchning kräver att den kortare termen är specifik
 * (≥6 tecken och inte ett generiskt venue-ord som "Teatern"/"Stadsbiblioteket").
 */
export function getVenueCoordinates(venueName: string): [number, number] | null {
    if (!venueName) return null;
    const trimmed = venueName.trim();
    const lower = trimmed.toLowerCase();

    // Stad inbäddad i frågan? Då får bara rader från SAMMA stad matcha.
    const queryCity = findEmbeddedCity(trimmed)?.toLowerCase() ?? null;

    // 1. Exact match (fastest path — relies on UNIQUE index).
    //    Bara när frågan inte pekar ut en stad — annars måste city-kolumnen jämföras.
    if (!queryCity) {
        const exact = lookupVenueExact(trimmed);
        if (exact) return exact;
    }

    // 2. Case-insensitive + partial match in JS (table is small, ~70 rows)
    for (const row of getAllKnownVenues()) {
        const rowLower = row.name.toLowerCase();
        const rowCity = (row.city || '').toLowerCase();
        if (queryCity && rowCity && rowCity !== queryCity) continue;   // annan stad → aldrig match
        if (rowLower === lower) return [row.lat, row.lng];
        // Substring bara när den KORTARE (inneslutna) termen är specifik nog
        if (lower.includes(rowLower) && isSpecificVenueTerm(rowLower)) return [row.lat, row.lng];
        if (rowLower.includes(lower) && isSpecificVenueTerm(lower)) return [row.lat, row.lng];
    }

    return null;
}

// Används av geocodeVenueSweden för att skanna adresser efter inbäddad stad.
export const SWEDISH_GEO_CITIES = [
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Örebro', 'Helsingborg',
    'Norrköping', 'Jönköping', 'Umeå', 'Lund', 'Västerås', 'Sundsvall', 'Karlstad',
    'Växjö', 'Gävle', 'Borås', 'Eskilstuna', 'Halmstad', 'Östersund', 'Kalmar',
    'Trollhättan', 'Luleå', 'Skellefteå', 'Kristianstad', 'Falun', 'Karlskrona',
    'Skövde', 'Motala', 'Nyköping', 'Örnsköldsvik', 'Varberg', 'Visby', 'Lidköping',
    'Alingsås', 'Borlänge', 'Trelleborg', 'Ystad', 'Västervik', 'Katrineholm',
    'Norrtälje', 'Enköping', 'Hässleholm', 'Piteå', 'Uddevalla', 'Kungsbacka',
    'Falkenberg', 'Ängelholm', 'Landskrona', 'Karlshamn', 'Ronneby', 'Oskarshamn',
    'Nässjö', 'Ljungby', 'Arvika', 'Kristinehamn', 'Mariestad', 'Sandviken',
    'Söderhamn', 'Hudiksvall', 'Härnösand', 'Boden', 'Kiruna', 'Gällivare',
    'Lycksele', 'Eslöv', 'Staffanstorp', 'Sjöbo', 'Simrishamn', 'Laholm',
    'Eksjö', 'Vimmerby', 'Nybro', 'Sölvesborg', 'Olofström', 'Älmhult',
    'Finspång', 'Mjölby', 'Strängnäs', 'Nora', 'Lindesberg',
    // Gotland-orter (2026-07-27): ankrar FB-events adress-skan på rätt ö.
    // 'Roma' utelämnad — \b-regexen skulle träffa italienska adresser;
    // countrycodes=se skyddar geokodningen men sökbruset är inte värt det.
    'Hemse', 'Slite', 'Klintehamn', 'Fårösund', 'Ljugarn', 'Burgsvik',
    'Katthammarsvik', 'Lärbro', 'Stånga', 'Havdhem', 'Tingstäde',
    'Romakloster', 'Fårö',
];

/**
 * Nordisk bounding box — Sverige + Norge + Danmark + Finland.
 * Används som skyddsnät mot event från t.ex. Moldavien, Bangladesh, USA m.m.
 * Norge och Danmark tillåts passera igenom.
 */
export const NORDIC_BOUNDS = {
    latMin: 54.5,   // Sydligaste Danmark (Gedser)
    latMax: 71.5,   // Nordligaste Norge (Nordkapp)
    lngMin:  4.5,   // Västligaste Norge (Stad)
    lngMax: 31.5,   // Östligaste Finland (Nuorgam)
} as const;

export function isInNordic(lat: number, lng: number): boolean {
    return (
        lat >= NORDIC_BOUNDS.latMin && lat <= NORDIC_BOUNDS.latMax &&
        lng >= NORDIC_BOUNDS.lngMin && lng <= NORDIC_BOUNDS.lngMax
    );
}

/** Behålls för bakåtkompatibilitet — föredra isInNordic() för ny kod. */
export function isInSweden(lat: number, lng: number): boolean {
    return lat >= 55.0 && lat <= 69.5 && lng >= 10.5 && lng <= 24.5;
}

/**
 * Checks if the address contains foreign indicators (outside Sweden, Denmark, Norway, Finland)
 * to avoid false partial matches in Nominatim geocoding.
 */
export function isForeignAddress(address: string): boolean {
    if (!address) return false;

    // Snabb check: icke-latinska tecken → definitivt utlandet
    // Kyrilliska (Moldavien, Ryssland...), bengali, arabiska, devanagari m.fl.
    if (/[Ѐ-ӿ؀-ۿऀ-ॿঀ-৿฀-๿一-鿿]/.test(address)) {
        return true;
    }

    const lower = address.toLowerCase();
    const foreignIndicators = [
        // Engelsktalande länder
        'usa', 'united states', 'new zealand', 'united kingdom', 'great britain', 'england',
        'australia', 'canada', 'germany', 'deutschland', 'france', 'spain', 'italy',
        'new york', 'london', 'auckland', 'california', 'florida', 'texas',
        'switzerland', 'belgium', 'austria', 'netherlands',
        // OBS 2026-07-02: danska/norska städer BORTTAGNA — grannländerna ingår
        // nu "på ytan" (NORDIC_BOUNDS + countrycodes=se,dk,no fanns redan;
        // tickster-sitemap-no m.fl. behöver kunna geokoda "venue, Drammen").
        // Veckodagarna togs också bort: onsdag/torsdag/fredag är IDENTISKA på
        // svenska och flaggade svenska strängar som utländska (latent bugg).
        // Finska städer (ej del av nordiska bbox)
        'helsinki', 'helsingfors', 'tampere', 'turku', 'oulu',
        // Moldavien/Östeuropa (Cyrillic filtreras ovan, men latin-varianter)
        'moldova', 'chisinau',
        // Bangladesh/Indien (latin-varianter)
        'dhaka', 'nakhalpara', 'shaheen bagh',
    ];
    return foreignIndicators.some(indicator => {
        const regex = new RegExp(`\\b${indicator}\\b`, 'i');
        return regex.test(lower);
    });
}

// respect 1 req/sec (env-override finns för att testerna inte ska sova på riktigt)
const NOMINATIM_DELAY_MS = parseInt(process.env.NOMINATIM_DELAY_MS || '1100', 10);

/**
 * HTTP-fel (429 rate-limit, 5xx) får ALDRIG tolkas som "platsen finns inte" —
 * en 429-miss som cachas ligger kvar i 14 dagar och förgiftar geokodningen
 * (incident 2026-07-02: parallella skript → 429 → 306 falska cache-misses).
 * Kasta istället; cache-lagren fångar och returnerar null UTAN att skriva cache.
 */
class NominatimHttpError extends Error {
    constructor(public status: number) { super(`Nominatim HTTP ${status}`); }
}

// Lokalt (Växjö-region, ~80 km)
async function nominatimSearch(query: string): Promise<[number, number] | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=se`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' }
    });
    if (!response.ok) throw new NominatimHttpError(response.status);

    const data = await response.json();
    for (const result of data ?? []) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        // Sanity check: must be within ~80 km of Växjö centrum
        if (Math.abs(lat - 56.88) < 0.7 && Math.abs(lng - 14.81) < 0.7) {
            return [lat, lng];
        }
    }
    return null;
}

// Nordic-bred (Sverige, Danmark, Norge). Valfritt accept-predikat filtrerar
// träffarna (limit=3) — används av nearCity-valideringen för att välja träffen
// nära rätt stad istället för Nominatims mest "prominenta" (Örebro-buggen).
async function nominatimSearchSweden(
    query: string,
    accept?: (lat: number, lng: number) => boolean,
): Promise<[number, number] | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3&countrycodes=se,dk,no`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' }
    });
    if (!response.ok) throw new NominatimHttpError(response.status);

    const data = await response.json();
    for (const result of data ?? []) {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        // Sanity check: must be within Nordic bounding box (SE/DK/NO)
        if (lat >= 54.5 && lat <= 71.5 && lng >= 4.0 && lng <= 31.5) {
            if (accept && !accept(lat, lng)) continue;
            return [lat, lng];
        }
    }
    return null;
}

export function cleanVenueName(name: string): string {
    if (!name) return '';
    let cleaned = name.trim();
    
    // 1. Remove redundant country names
    cleaned = cleaned.replace(/\b(SWEDEN|Sweden|Sverige)\b/gi, '');
    
    // 2. Remove duplicate city names (Växjö)
    const matchCount = (cleaned.match(/växjö/gi) || []).length;
    if (matchCount > 1) {
        cleaned = cleaned.replace(/växjö/gi, '');
        cleaned = cleaned.trim().replace(/,$/, '') + ', Växjö';
    }
    
    // 3. Clean up multiple commas, spaces, and trailing/leading punctuation
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/,\s*,/g, ',');
    cleaned = cleaned.trim().replace(/^,|,$/g, '');
    
    return cleaned.trim();
}

/**
 * Geocode a venue name via OpenStreetMap Nominatim.
 * Respects the 1 req/sec rate limit.
 */
export async function geocodeVenue(rawVenueName: string): Promise<[number, number] | null> {
    if (!rawVenueName) return null;

    if (isForeignAddress(rawVenueName)) {
        console.log(`[Geocoding] Skipped foreign venue: "${rawVenueName}"`);
        return null;
    }

    const venueName = cleanVenueName(rawVenueName);

    // Check local list first (fast path)
    const local = getVenueCoordinates(venueName);
    if (local) return local;

    console.log(`[Geocoding] Querying Nominatim for: "${venueName}" (original: "${rawVenueName}")`);

    try {
        // Strategy 1: full name + Växjö
        let result = await nominatimSearch(`${venueName}, Växjö, Sverige`);
        await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
        if (result) {
            console.log(`[Geocoding] Found (strategy 1) "${venueName}": [${result[0]}, ${result[1]}]`);
            return result;
        }

        // Strategy 2: just name + Växjö (without "Sverige" to widen search)
        result = await nominatimSearch(`${venueName}, Växjö`);
        await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
        if (result) {
            console.log(`[Geocoding] Found (strategy 2) "${venueName}": [${result[0]}, ${result[1]}]`);
            return result;
        }

        // Strategy 3: strip common prefix words and retry
        const simplified = venueName.replace(/^(scenen på|i |på |vid )/gi, '').trim();
        if (simplified !== venueName) {
            result = await nominatimSearch(`${simplified}, Växjö, Sverige`);
            await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
            if (result) {
                console.log(`[Geocoding] Found (strategy 3) "${simplified}": [${result[0]}, ${result[1]}]`);
                return result;
            }
        }

        // Strategy 4: If there is a comma, try only the part after the first comma (often the address)
        if (venueName.includes(',')) {
            const parts = venueName.split(',');
            const addressOnly = parts.slice(1).join(',').trim();
            if (addressOnly.length > 5) {
                console.log(`[Geocoding] Trying strategy 4 (address only): "${addressOnly}"`);
                result = await nominatimSearch(addressOnly);
                await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
                if (result) {
                    console.log(`[Geocoding] Found (strategy 4) "${addressOnly}": [${result[0]}, ${result[1]}]`);
                    return result;
                }
            }
        }
    } catch (e) {
        // 429/5xx: avbryt hela kedjan — fler strategier bränner bara mer kvot.
        if (e instanceof NominatimHttpError) {
            console.warn(`[Geocoding] Nominatim ${e.status} för "${venueName}" — avbryter (ej cachat)`);
            return null;
        }
        throw e;
    }

    console.log(`[Geocoding] No results for "${venueName}".`);
    return null;
}

/** Haversine-avstånd i km mellan två WGS84-punkter. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Max-avstånd från stadscentroiden för att en nearCity-validerad träff ska godkännas. */
export const NEAR_CITY_MAX_KM = 60;

/**
 * Geokoda en STAD (stadsnivå-precision). Cachas i geocode_cache med egen
 * "city:"-nyckel så centroiderna aldrig blandas med venue-svar. Används av
 * nearCity-valideringen — en centroid per stad, sedan lokala lookups.
 * Exporterad för repair-misplaced-geo (batch-validering av gamla event).
 */
export async function geocodeCityCentroid(city: string): Promise<[number, number] | null> {
    const name = (city || '').trim();
    if (!name) return null;

    const key = `city:${name.toLowerCase()}`;
    const cached = geocodeCacheGet(key);
    if (cached && (cached.ok ? cached.ageDays < 90 : cached.ageDays < 14)) {
        return cached.ok ? [cached.lat, cached.lng] : null;
    }

    await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
    try {
        const result = await nominatimSearchSweden(`${name}, Sverige`);
        geocodeCacheSet(key, result);
        return result;
    } catch (e) {
        if (e instanceof NominatimHttpError) {
            console.warn(`[Geocoding/SE] Nominatim ${e.status} för centroid "${name}" — ej cachat`);
            return null;
        }
        throw e;
    }
}

export interface GeocodeSwedenOpts {
    /**
     * Förväntad stad/ort. Sätts den valideras ALLA svar (även cachade) mot
     * stadscentroiden: träffar längre bort än NEAR_CITY_MAX_KM underkänns och
     * frågan provas igen som "<query>, <nearCity>". Skyddet mot att Nominatim
     * tappar termer och returnerar Sveriges mest prominenta namne — t.ex.
     * "S:t Nikolai kyrka" (Halmstad) → Örebro-koordinater.
     */
    nearCity?: string;
}

/**
 * Sverige-bred geocoding — söker i hela Sverige via Nominatim.
 * Används av Tickster-scrapen och andra rikstäckande scrapers.
 *
 * Persistent cache (geocode_cache i SQLite): träffar återanvänds i 90 dagar
 * (venues flyttar inte), missar provas om efter 14 dagar (OSM kompletteras).
 * Paraply-källorna (SvK 577 församlingar, PRO ~970 föreningar, Hembygd) frågar
 * efter samma platser varje körning — utan cachen kostar det 1,1s+ per fråga
 * och natt, med cachen är det en lokal lookup.
 *
 * Utan opts.nearCity: exakt samma beteende som tidigare (bakåtkompatibelt).
 */
export async function geocodeVenueSweden(
    rawQuery: string,
    opts: GeocodeSwedenOpts = {},
): Promise<[number, number] | null> {
    if (!rawQuery) return null;

    if (isForeignAddress(rawQuery)) {
        console.log(`[Geocoding/SE] Skipped foreign query: "${rawQuery}"`);
        return null;
    }

    // Skippa endast Ticksters faktiska kontoradress (Magasinsgatan 8, 411 18 Göteborg).
    // Tidigare strippade vi "Magasinsgatan 8" globalt, vilket förstörde adresser
    // som "Fat Daves, Magasinsgatan 8, Malmö" (samma gatunamn finns i andra städer).
    const cleaned = rawQuery
        .replace(/Magasinsgatan\s*8\s*,?\s*\d{3}\s*\d{2}\s+Göteborg/gi, '')
        .replace(/Magasinsgatan\s*8\s*,\s*Göteborg\b/gi, '')
        .trim()
        .replace(/^,\s*|\s*,\s*$/g, '')
        .replace(/,\s*,/g, ',');
    if (!cleaned) return null;

    // 0. Verifierade venues (known_venues) — gratis, exakta, byggs upp av
    // geo-refines nattliga träffar. Prova hela frågan och segmentet före
    // första kommat ("Åhaga, Borås" → "Åhaga"). Stadskrav när nearCity finns;
    // utan stad krävs att namnet är unikt i tabellen (se lookupVenueSmart).
    const nearCityRaw = (opts.nearCity || '').trim();
    const venueHit = lookupVenueSmart(cleaned, nearCityRaw || undefined)
        ?? (cleaned.includes(',') ? lookupVenueSmart(cleaned.split(',')[0], nearCityRaw || undefined) : null);
    if (venueHit) return venueHit;

    // nearCity-validering: geokoda stadens centroid (cachad) och bygg predikatet.
    // Kan centroiden inte lösas (okänd småort) → kör oskyddat som tidigare.
    const nearCity = nearCityRaw;
    const cityCenter = nearCity ? await geocodeCityCentroid(nearCity) : null;
    const accept = cityCenter
        ? (lat: number, lng: number) => distanceKm(lat, lng, cityCenter[0], cityCenter[1]) <= NEAR_CITY_MAX_KM
        : undefined;

    if (!accept) {
        // Bakåtkompatibla vägen — exakt gamla beteendet.
        const cached = geocodeCacheGet(cleaned);
        if (cached && (cached.ok ? cached.ageDays < 90 : cached.ageDays < 14)) {
            return cached.ok ? [cached.lat, cached.lng] : null;
        }
        try {
            const result = await geocodeVenueSwedenLive(cleaned);
            geocodeCacheSet(cleaned, result);
            return result;
        } catch (e) {
            if (e instanceof NominatimHttpError) {
                console.warn(`[Geocoding/SE] Nominatim ${e.status} för "${cleaned}" — ej cachat`);
                return null;
            }
            throw e;
        }
    }

    // 1. Bas-cachens svar återanvänds BARA om det klarar stadsvalideringen.
    //    Cachen är förgiftad med 90-dagars felträffar (bare "S:t Nikolai kyrka"
    //    → Örebro) — sådana släpps inte igenom, men bas-nyckeln lämnas orörd
    //    (den kan vara "rätt" för anropare utan nearCity-kontext).
    const cached = geocodeCacheGet(cleaned);
    if (cached && cached.ok && cached.ageDays < 90 && accept(cached.lat, cached.lng)) {
        return [cached.lat, cached.lng];
    }

    // 2. Stads-ankrad variant med egen cache-nyckel (svaret gäller PER stad).
    const anchored = cleaned.toLowerCase().includes(nearCity.toLowerCase())
        ? cleaned
        : `${cleaned}, ${nearCity}`;
    const nearKey = `near:${nearCity.toLowerCase()}|${anchored.toLowerCase()}`;
    const nearCached = geocodeCacheGet(nearKey);
    if (nearCached && (nearCached.ok ? nearCached.ageDays < 90 : nearCached.ageDays < 14)) {
        // Validera även denna — nycklar skrivna före valideringen kan vara fel.
        if (nearCached.ok && accept(nearCached.lat, nearCached.lng)) {
            return [nearCached.lat, nearCached.lng];
        }
        if (!nearCached.ok) return null;
        // ok men fel stad → fall igenom till live-omkörning (skriver om nyckeln)
    }

    try {
        const result = await geocodeVenueSwedenLive(anchored, accept);
        geocodeCacheSet(nearKey, result);
        if (!result) {
            console.log(`[Geocoding/SE] "${anchored}" underkänd av nearCity-validering (${nearCity}, max ${NEAR_CITY_MAX_KM} km)`);
        }
        return result;
    } catch (e) {
        if (e instanceof NominatimHttpError) {
            console.warn(`[Geocoding/SE] Nominatim ${e.status} för "${anchored}" — ej cachat`);
            return null;
        }
        throw e;
    }
}

/**
 * Själva Nominatim-kedjan, utan cache. Anropa geocodeVenueSweden istället.
 * accept-predikatet (nearCity-validering) appliceras på ALLA steg — även
 * komma-tail- och stads-skanningsfallbacken får inte returnera fel stad.
 */
async function geocodeVenueSwedenLive(
    cleaned: string,
    accept?: (lat: number, lng: number) => boolean,
): Promise<[number, number] | null> {
    await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));

    // Försök 1: full fråga
    let result = await nominatimSearchSweden(cleaned, accept);
    if (result) {
        console.log(`[Geocoding/SE] Found "${cleaned}": [${result[0]}, ${result[1]}]`);
        return result;
    }

    // Försök 2: om komma finns, testa sista delen (ofta stad)
    if (cleaned.includes(',')) {
        const city = cleaned.split(',').map(s => s.trim()).filter(Boolean).pop() || '';
        if (city && city !== cleaned) {
            await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
            result = await nominatimSearchSweden(city, accept);
            if (result) {
                console.log(`[Geocoding/SE] Found city "${city}": [${result[0]}, ${result[1]}]`);
                return result;
            }
        }
    }

    // Försök 3: skanna query efter inbäddad stad (hanterar "Foajén - Örebro Konserthus" etc.)
    const foundCity = SWEDISH_GEO_CITIES.find(c => {
        const pattern = new RegExp(`\\b${c}\\b`, 'i');
        return pattern.test(cleaned);
    });
    if (foundCity) {
        const withCity = cleaned.toLowerCase().endsWith(foundCity.toLowerCase())
            ? cleaned
            : `${cleaned}, ${foundCity}`;
        if (withCity !== cleaned) {
            await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
            result = await nominatimSearchSweden(withCity, accept);
            if (result) {
                console.log(`[Geocoding/SE] Found via city-scan "${withCity}": [${result[0]}, ${result[1]}]`);
                return result;
            }
        }
        // Sista chansen: bara stadsnamnet (stad-nivå precision)
        await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
        result = await nominatimSearchSweden(`${foundCity}, Sverige`, accept);
        if (result) {
            console.log(`[Geocoding/SE] City-level fallback "${foundCity}": [${result[0]}, ${result[1]}]`);
            return result;
        }
    }

    console.log(`[Geocoding/SE] No results for "${cleaned}".`);
    return null;
}

/**
 * STRIKT Sverige-geokodning — EN Nominatim-fråga med hela strängen, ingen
 * komma-tail- eller stads-fallback. För geo-refine: en fallback hade bara
 * flyttat eventet från ett stadscentrum-kluster till ett annat (kommun-
 * centroiden). Antingen träffar hela "Venue, Stad"-frågan en POI, eller null.
 * Cachas med egen nyckel så den inte blandas med fallback-kedjans svar.
 */
export async function geocodeVenueSwedenStrict(rawQuery: string): Promise<[number, number] | null> {
    if (!rawQuery) return null;
    if (isForeignAddress(rawQuery)) return null;
    const cleaned = rawQuery.trim().replace(/\s+/g, ' ');
    if (cleaned.length < 3) return null;

    const key = `strict:${cleaned.toLowerCase()}`;
    const cached = geocodeCacheGet(key);
    if (cached && (cached.ok ? cached.ageDays < 90 : cached.ageDays < 14)) {
        return cached.ok ? [cached.lat, cached.lng] : null;
    }

    await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
    try {
        const result = await nominatimSearchSweden(cleaned);
        geocodeCacheSet(key, result);
        return result;
    } catch (e) {
        if (e instanceof NominatimHttpError) {
            console.warn(`[Geocoding/SE] Nominatim ${e.status} för strict "${cleaned}" — ej cachat`);
            return null;
        }
        throw e;
    }
}

/**
 * Strukturerad gatuadress-geokodning — för geo-refine när vi har en explicit
 * adress ("Storgatan 12") + stad. Till skillnad från geocodeVenueSweden finns
 * INGEN stads-fallback här: antingen får vi en adress-precis träff eller null.
 * Cachas i geocode_cache med strukturerad nyckel.
 */
export async function geocodeStreetSweden(street: string, city: string): Promise<[number, number] | null> {
    if (!street || !city) return null;
    if (isForeignAddress(`${street}, ${city}`)) return null;

    const key = `street:${street.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
    const cached = geocodeCacheGet(key);
    if (cached && (cached.ok ? cached.ageDays < 90 : cached.ageDays < 14)) {
        return cached.ok ? [cached.lat, cached.lng] : null;
    }

    await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
    let result: [number, number] | null = null;
    try {
        const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=se'
            + `&street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
        });
        // HTTP-fel (429/5xx) = transient — returnera null UTAN att cacha miss
        if (!res.ok) {
            console.warn(`[Geocoding/SE] Nominatim ${res.status} för street "${street}, ${city}" — ej cachat`);
            return null;
        }
        const data: any = await res.json();
        for (const hit of data ?? []) {
            const lat = parseFloat(hit.lat);
            const lng = parseFloat(hit.lon);
            if (isInNordic(lat, lng)) { result = [lat, lng]; break; }
        }
    } catch {
        // nätfel = transient → ej cachat
        return null;
    }

    geocodeCacheSet(key, result);
    return result;
}

export interface ReverseGeocodeResult {
    /** Hela display-strängen från Nominatim (t.ex. "Vida Arena, Lyckhems väg, Växjö, ...") */
    displayName: string;
    /** city / town / village (best-effort, kan vara null när Nominatim bara har municipality) */
    city: string | null;
    countryCode: string | null;
}

/**
 * Reverse-geokoda en koordinat via Nominatim. Respekterar 1 req/sec.
 * Returnerar null vid HTTP-fel eller tomt svar — kallaren får anta "okänt".
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
    if (!lat && !lng) return null;
    await new Promise(r => setTimeout(r, NOMINATIM_DELAY_MS));
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
        });
        if (!res.ok) return null;
        const data: any = await res.json();
        if (!data || !data.display_name) return null;
        const a = data.address || {};
        const city = a.city || a.town || a.village || a.municipality || a.county || null;
        const countryCode = (a.country_code || '').toLowerCase() || null;
        return {
            displayName: data.display_name,
            city,
            countryCode,
        };
    } catch {
        return null;
    }
}
