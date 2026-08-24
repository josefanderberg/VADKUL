/**
 * seed-venues-overpass.ts — bulk-seeda known_venues från OSM Overpass.
 *
 * Växjö-granskningen 24/8: hälften av centroid-stacken var BIBLIOTEK som
 * Nominatims fritextsökning inte hittar ("Tallgårdens bibliotek, Växjö" → 0
 * träffar) trots att POI:n finns i OSM. Overpass hämtar dem strukturerat —
 * ETT engångsjobb för hela landet i stället för en misslyckad Nominatim-
 * fråga per event och natt. Registret kollas FÖRST i geokodningskedjan
 * (geocodeVenueSweden steg 0) och av geo-refine (kandidat 0).
 *
 * Säkerhetsregler (known_venues.name är UNIK och global):
 *   - namn < 5 tecken eller generiska ("Biblioteket", "Folkets hus") hoppas
 *   - namn som förekommer FLERA gånger i OSM-datat hoppas helt (tvetydiga —
 *     fel träff i fel stad är värre än ingen träff)
 *   - namn som redan finns i known_venues rörs INTE (geo-refines lärdomar
 *     och Växjö-seeden vinner över Overpass)
 *   - stad = addr:city-taggen, annars närmsta ort ur webbens cityPoints
 *     (≤30 km), annars '' — ALDRIG default-Växjö
 *
 *   npx ts-node src/scripts/seed-venues-overpass.ts            # dry-run
 *   npx ts-node src/scripts/seed-venues-overpass.ts --commit
 *   npx ts-node src/scripts/seed-venues-overpass.ts --kategorier=library,museum
 */
import fs from 'fs';
import path from 'path';
import { sqlite, upsertKnownVenue, countKnownVenues } from '../utils/sqliteHelper';
import { isInNordic } from '../utils/venueCoordinates';

const COMMIT = process.argv.includes('--commit');
const CAT_ARG = process.argv.find(a => a.startsWith('--kategorier='));

/** [tagg, värde, etikett] — kategorier med bra namn-POI:er i svensk OSM. */
const CATEGORIES: [string, string, string][] = [
    ['amenity', 'library', 'bibliotek'],
    ['amenity', 'theatre', 'teater'],
    ['amenity', 'cinema', 'biograf'],
    ['amenity', 'arts_centre', 'kulturhus'],
    ['amenity', 'community_centre', 'samlingslokal'],
    ['tourism', 'museum', 'museum'],
    ['amenity', 'place_of_worship', 'kyrka'],
];
const picked = CAT_ARG
    ? CATEGORIES.filter(c => CAT_ARG.split('=')[1].split(',').includes(c[1]))
    : CATEGORIES;

/** Samma generiska-namn-vakt som geo-refine — tabellen får inte förgiftas. */
const GENERIC = /^(bibliotek(et)?|stadsbibliotek(et)?|kyrka(n)?|kapell(et)?|församlingshem(met)?|folkets hus|folkets park|hembygdsgård(en)?|bygdegård(en)?|kulturhus(et)?|museum|museet|bio(grafen)?|teater(n)?|scen(en)?|sporthall(en)?|missionshus(et)?|allianskyrkan|pingstkyrkan|missionskyrkan|frälsningsarmén|equmeniakyrkan|filadelfia(kyrkan)?|betel|betania|salem|sion|elim|centrumkyrkan|korskyrkan|stadsmuseet|konsthall(en)?|medborgarhus(et)?)$/i;

/** Webbens ortlista (291 orter med koordinater), regex-läst över paketgränsen
 *  — samma trick som schedule-city-posts.ts. */
function loadCityPoints(): { name: string; lat: number; lng: number }[] {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../web/src/utils/cityPoints.ts'), 'utf-8');
    const out: { name: string; lat: number; lng: number }[] = [];
    for (const m of src.matchAll(/\{ name: '([^']+)', lat: ([\d.]+), lng: ([\d.]+)/g)) {
        out.push({ name: m[1], lat: Number(m[2]), lng: Number(m[3]) });
    }
    return out;
}

const toRad = (d: number) => (d * Math.PI) / 180;
function distKm(a: number, b: number, x: number, y: number): number {
    const dLat = toRad(x - a), dLng = toRad(y - b);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(x)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

interface Poi { name: string; lat: number; lng: number; city: string; cat: string }

/** Två publika instanser — huvudinstansen 406:ar när slottarna är fulla. */
const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];

async function fetchCategory(tag: string, value: string, label: string): Promise<Poi[]> {
    const query = `[out:json][timeout:180];
area["ISO3166-1"="SE"][admin_level=2]->.se;
nwr["${tag}"="${value}"]["name"](area.se);
out center tags;`;
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4 && !res?.ok; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 30_000));
        const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
        try {
            res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'VadkulScraperBot/1.0 (admin@vadkul.se)' },
                body: 'data=' + encodeURIComponent(query),
            });
            if (!res.ok) console.warn(`  … ${label}: ${res.status} från ${new URL(endpoint).host} (försök ${attempt + 1})`);
        } catch (e) {
            console.warn(`  … ${label}: nätfel mot ${new URL(endpoint).host} (försök ${attempt + 1})`);
            res = null;
        }
    }
    if (!res?.ok) {
        console.warn(`⚠️ Overpass gav upp för ${label} efter 4 försök — hoppar kategorin`);
        return [];
    }
    const data: any = await res.json();
    const out: Poi[] = [];
    for (const el of data.elements ?? []) {
        const name = (el.tags?.name || '').trim();
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        if (!name || typeof lat !== 'number' || typeof lng !== 'number') continue;
        if (!isInNordic(lat, lng)) continue;
        out.push({ name, lat, lng, city: (el.tags?.['addr:city'] || '').trim(), cat: label });
    }
    return out;
}

async function main(): Promise<void> {
    console.log(COMMIT ? '🔧 COMMIT' : '🔍 DRY-RUN', '— kategorier:', picked.map(c => c[2]).join(', '));
    const cityPoints = loadCityPoints();

    const all: Poi[] = [];
    for (const [tag, value, label] of picked) {
        const pois = await fetchCategory(tag, value, label);
        console.log(`  ${label.padEnd(14)} ${pois.length} namngivna POI:er`);
        all.push(...pois);
        await new Promise(r => setTimeout(r, 10_000));   // Overpass-artighet
    }

    // Tvetydiga namn ut: samma namn på flera platser (>1 km isär) = skippa.
    // Exakta dubbletter (samma byggnad som node+way) räknas som EN.
    const byName = new Map<string, Poi[]>();
    for (const p of all) {
        const k = p.name.toLowerCase();
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k)!.push(p);
    }

    const existsStmt = sqlite.prepare('SELECT 1 FROM known_venues WHERE LOWER(name) = LOWER(?)');
    let seeded = 0, ambiguous = 0, generic = 0, tooShort = 0, already = 0;
    for (const [, pois] of byName) {
        const p = pois[0];
        if (pois.some(q => distKm(p.lat, p.lng, q.lat, q.lng) > 1)) { ambiguous++; continue; }
        if (p.name.length < 5) { tooShort++; continue; }
        if (GENERIC.test(p.name)) { generic++; continue; }
        if (existsStmt.get(p.name)) { already++; continue; }

        let city = p.city;
        if (!city) {
            let best: { name: string; d: number } | null = null;
            for (const c of cityPoints) {
                const d = distKm(p.lat, p.lng, c.lat, c.lng);
                if (d <= 30 && (!best || d < best.d)) best = { name: c.name, d };
            }
            city = best?.name ?? '';
        }

        if (COMMIT) upsertKnownVenue(p.name, p.lat, p.lng, city, `overpass-seed ${p.cat} ${new Date().toISOString().slice(0, 10)}`);
        seeded++;
    }

    console.log(`\n${COMMIT ? 'Seedade' : 'Skulle seeda'}: ${seeded}`);
    console.log(`Hoppade: ${ambiguous} tvetydiga namn, ${generic} generiska, ${tooShort} för korta, ${already} fanns redan`);
    console.log(`known_venues totalt nu: ${countKnownVenues()}`);
}

main().catch(e => { console.error(e); process.exit(1); });
