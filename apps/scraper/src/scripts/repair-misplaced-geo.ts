/**
 * repair-misplaced-geo.ts — reparera HISTORISKT felplacerade event (Örebro-buggen).
 *
 * Bakgrund: fram till 2026-07-02 geokodades paraply-event med bara venue-namnet
 * ("S:t Nikolai kyrka") utan ort. Nominatim returnerade Sveriges mest prominenta
 * namne → ~170 event ligger >60 km från sin riktiga stad (Halmstad-kyrkor på
 * Örebro-koordinater, Falkenberg→Norrköping, Lidköping→Stockholm …). Felträffarna
 * cachades dessutom i 90 dagar. nearCity-valideringen i geocodeVenueSweden
 * stoppar NYA fel — det här skriptet reparerar de gamla.
 *
 * Per event (hidden=0, framtida, koordinater satta):
 *   1. Härled FÖRVÄNTAD STAD: "…, X församling/pastorat"-mönstret i locationName/
 *      hostName (deriveTown — samma logik som SvK-scrapern), annars känd stad
 *      inbäddad i locationName/geocodedQuery (genitiv-s hanterat).
 *   2. Geokoda stadens centroid (cachad "city:"-nyckel). Ingen centroid → hoppa.
 *   3. Ligger eventet ≤60 km från staden → korrekt placerat, hoppa.
 *   4. Annars FELPLACERAT: re-geokoda locationName med { nearCity: stad }.
 *      Träff → uppdatera SQLite + Firestore. Miss → nolla koordinaterna vid
 *      --apply (webbkartan döljer 0,0 — bättre dolt än i fel stad).
 *
 * Användning:
 *   npm run repair-geo                   # dry-run (skriver INGET)
 *   npm run repair-geo -- --apply        # skriver SQLite + Firestore
 *   npm run repair-geo -- --limit=100    # Nominatim-budget (default 400)
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords } from '../utils/sqliteHelper';
import {
    geocodeVenueSweden, geocodeCityCentroid, distanceKm, reverseGeocode,
    SWEDISH_GEO_CITIES, NEAR_CITY_MAX_KM, knownGeoCity,
} from '../utils/venueCoordinates';
import { deriveTown } from '../scrapers/svenskakyrkan';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 400;

const PARISH_SUFFIX = /^(.+?)\s+(pastorat|församling|distrikt|domkyrkoförsamling|kyrkliga samfällighet)$/i;

/** Församlingar vars namn INTE är en känd stad (eller är en ort någon
 *  annanstans) — mappas manuellt till närmaste stad i SWEDISH_GEO_CITIES så
 *  valideringen når dem alls. Upptäckta via buggrapporter; utan raden här är
 *  församlingen "icke härledbar" och skriptet tittar aldrig på dess event.
 *  Sundsvall-tråden 6/8: Stockholms Katarina församling och Rödöns församling
 *  (Krokom) låg båda geokodade i Sundsvallstrakten. */
const PARISH_CITY_ALIAS: Record<string, string> = {
    'katarina': 'Stockholm',   // Katarina församling, Södermalm
    'rödön': 'Östersund',      // Rödöns församling, Krokoms kommun
};

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    locationName: string | null;
    geocodedQuery: string | null;
    hostName: string | null;
    lat: number;
    lng: number;
}

/** Väderstrecks-/storleksprefix som gör ortnamnet till en ANNAN ort. */
const COMPOUND_PREFIX = /(östra|västra|norra|södra|gamla|nya|stora|lilla|övre|nedre)\s*$/i;

/**
 * Nämns orten (ordgräns, genitiv ok, ej bindestreck) i en textsträng?
 * "<Ortnamn> <siffra>" avvisas — det är en BYADRESS ("Sandviken 130" = gård på
 * Frösön, inte staden Sandviken); lookahead kräver att whitespace efter namnet
 * INTE följs av en siffra.
 */
export function cityMentioned(text: string, city: string): boolean {
    const esc = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[\\s,])${esc}s?(?=$|[,.!:)]|\\s+(?!\\d))`, 'i');
    const m = re.exec(text || '');
    if (!m) return false;
    return !COMPOUND_PREFIX.test((text || '').slice(0, m.index + m[1].length));
}

/**
 * Känd stad i en textsträng. Ordgränser är space/komma/punkt — INTE bindestreck:
 * "Vinberg-Ljungby" (Falkenberg), "Nora-Skogs" (Ångermanland) är egna orter och
 * får inte matcha Ljungby/Nora. Prefix-vakten stoppar "Östra Ljungby" (Skåne)
 * och "Västra Sandviken" (Grums) — dry-run 2026-07-02 visade att de annars
 * "repareras" till fel landsdel.
 */
export function findKnownCity(text: string): string | null {
    for (const c of SWEDISH_GEO_CITIES) {
        if (cityMentioned(text, c)) return c;
    }
    return null;
}

/**
 * Härled förväntad stad för ett event. Exporterad för test (ren funktion).
 * Församlings-mönstret vinner (mest tillförlitligt); annars känd stad i
 * sista komma-segmentet först (platssträngar slutar oftast med orten).
 *
 * VIKTIGT: returnerar BARA städer i SWEDISH_GEO_CITIES. Små församlingsorter
 * är tvetydiga på nationell nivå — "Stenkyrka" (Tjörn) centroid-geokodas till
 * Stenkyrka på GOTLAND, "Edsberg" (Närke) till Sollentunas Edsberg. Att
 * validera/reparera mot fel centroid FLYTTAR korrekta event till fel landsdel
 * (upptäckt i dry-run 2026-07-02). Hellre färre men säkra reparationer.
 */
export function deriveExpectedCity(
    locationName: string | null, hostName: string | null, geocodedQuery: string | null,
): string | null {
    // 1. "…, X församling/pastorat" i locationName eller hostName.
    //    Församlingen är den MEST specifika signalen: pekar den på en okänd
    //    småort avbryter vi helt — att falla vidare till stads-scanning gav
    //    falska träffar ("Nora församlingsgård, Nora-Skogs församling" ≠ Nora).
    for (const src of [locationName, hostName]) {
        if (!src) continue;
        for (const part of src.split(',').map(s => s.trim()).reverse()) {
            const m = part.match(PARISH_SUFFIX);
            if (m) {
                const town = deriveTown(m[1].trim());
                // Aliastabellen först (församlingsnamn som inte är städer),
                // sedan bara otvetydiga (kända) städer — småorter kan heta
                // samma sak på flera ställen i landet.
                const alias = town ? PARISH_CITY_ALIAS[town.toLowerCase()] : undefined;
                const known = alias ?? (town ? knownGeoCity(town) : null);
                return known;   // känd stad ELLER null — aldrig vidare till svagare signal
            }
        }
    }
    // 2. Känd stad inbäddad — sista komma-segmentet först, sedan hela strängen
    for (const src of [locationName, geocodedQuery]) {
        if (!src) continue;
        for (const part of src.split(',').map(s => s.trim()).reverse()) {
            const hit = findKnownCity(part);
            if (hit) return hit;
        }
    }
    return null;
}

async function applyCoords(r: Row, lat: number, lng: number, query: string, verified: boolean): Promise<void> {
    setEventCoords(r.url, lat, lng, query);
    if (db && r.firestoreId) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId)
                .update({ lat, lng, isLocationVerified: verified });
        } catch (e: any) {
            if (e?.code !== 5) console.error(`  ❌ Firestore fail ${r.url.slice(0, 50)}: ${e?.message}`);
        }
    }
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, geocodedQuery, hostName, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
          AND lat IS NOT NULL AND lat != 0 AND lng IS NOT NULL AND lng != 0
    `).all() as Row[];
    console.log(`${rows.length} framtida event med koordinater`);

    let derivable = 0, checked = 0, misplaced = 0, repaired = 0, zeroed = 0, ambiguous = 0;
    let nominatimBudget = LIMIT;
    const centroidFail = new Set<string>();

    for (const r of rows) {
        // Tur-arrangörer: lokalavdelningens STAD står i namnet men eventet är
        // en tur någon annanstans (Friluftsfrämjandet Göteborg → Bunnerfjällen)
        // och käll-API:t levererar korrekta tur-koordinater. Rör aldrig dessa.
        if (/^friluftsfrämjandet/i.test(r.locationName || '') || /^friluftsfrämjandet/i.test(r.hostName || '')) continue;

        const city = deriveExpectedCity(r.locationName, r.hostName, r.geocodedQuery);
        if (!city || centroidFail.has(city)) continue;
        derivable++;
        if (nominatimBudget <= 0) continue;

        const center = await geocodeCityCentroid(city);   // cachad — kostar sällan
        if (!center) { centroidFail.add(city); continue; }
        checked++;

        const dist = distanceKm(r.lat, r.lng, center[0], center[1]);
        if (dist <= NEAR_CITY_MAX_KM) continue;   // rätt placerat

        // Tvetydighets-vakt: stadslistans namn är INTE unika ortnamn. "Nora
        // Hembygdsförening" ligger i Nora ÅNGERMANLAND, "Sandviken 130" är en
        // bygata på Frösön — originalkoordinaterna var RÄTT. Reverse-geokoda
        // originalet: nämner platsen där eventet redan ligger samma ortnamn är
        // namnbeviset värdelöst → rör inte eventet.
        const rev = await reverseGeocode(r.lat, r.lng);
        if (rev?.displayName && cityMentioned(rev.displayName, city)) {
            ambiguous++;
            console.log(`\n⚖️  TVETYDIG: ${r.title.slice(0, 40)} | "${city}" finns även vid originalet (${rev.displayName.slice(0, 60)}) — hoppar`);
            continue;
        }

        misplaced++;
        console.log(`\n📍 FEL: ${r.title.slice(0, 45).padEnd(45)} | ${String(r.locationName).slice(0, 45)}`);
        console.log(`   ${Math.round(dist)} km från ${city} [${r.lat.toFixed(3)},${r.lng.toFixed(3)}]`);

        // Re-geokoda med stads-ankring + validering
        nominatimBudget--;
        const loc = (r.locationName || '').split(',')[0].trim() || city;
        const hit = await geocodeVenueSweden(loc, { nearCity: city });
        if (hit) {
            console.log(`   → reparerad: [${hit[0].toFixed(4)},${hit[1].toFixed(4)}] ("${loc}", nära ${city})`);
            repaired++;
            if (APPLY) await applyCoords(r, hit[0], hit[1], `${loc}, ${city} (repair)`, true);
        } else {
            console.log(`   → ingen träff nära ${city} — ${APPLY ? 'NOLLAR (döljs på kartan)' : 'skulle nollas'}`);
            zeroed++;
            if (APPLY) await applyCoords(r, 0, 0, `repair-miss: ${loc}, ${city}`, false);
        }
    }

    console.log('\n=== Klart ===');
    console.log(`  Härledbar stad:  ${derivable}`);
    console.log(`  Kontrollerade:   ${checked}`);
    console.log(`  ⚠️ Felplacerade:  ${misplaced}`);
    console.log(`  ⚖️ Tvetydiga:     ${ambiguous} (samma ortnamn vid originalet — orörda)`);
    console.log(`  ✅ Reparerade:    ${repaired}`);
    console.log(`  ⭕ Nollade:       ${zeroed}`);
    if (centroidFail.size) console.log(`  Ogeokodbara städer: ${[...centroidFail].join(', ')}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
