/**
 * oneoff-repair-fb-anchor-291.ts — flytta FB-event som hamnade på sökköns
 * stad fast eventets egen text pekar ut en annan ort (#291).
 *
 * Orsak: FB-kedjan ankrade lokalen på köns stad. "Medborgarhuset i Säffle"
 * ur Uppsala-kön föll till Uppsalas mittpunkt, eftersom Säffle inte fanns
 * bland de 95 städer som textstads-försöket kände till. Kedjan är fixad
 * (anchorCityEvidence + preferTextHit i scrapers/facebook/anchorCity.ts),
 * men skip-känt gör att nattkörningen aldrig rör de lagrade eventen igen.
 *
 * Per kommande FB-event (synligt):
 *   1. Bevis ur egen text, utan köstad (den sparas inte): adressen/lokal-
 *      namnet eller ett helt titelsegment som är en ort. Ett svagt bevis
 *      flyttar bara till en specifik träff (poi/gata), som i kedjan.
 *   2. Ligger eventet redan inom NEAR_CITY_MAX_KM från orten → rätt, hoppa.
 *      Nämner texten en känd stad nära eventets punkt → punkten är bekräftad
 *      (samma regel som kedjans "kontextstaden nämns"), hoppa.
 *   3. Geokoda som kedjan gör: lokalen ankrad på textens ort. preferTextHit
 *      mot den sparade punkten avgör; utan träff → ortens mittpunkt.
 *
 * Cachenycklarna near:<köstad>|<lokal>, <köstad> (köns mittpunkt) lämnas:
 * kedjan läser textens ort under en egen nyckel, och en raderad near:-nyckel
 * räknas bara fram till samma svar igen.
 *
 *   npx ts-node src/scripts/oneoff-repair-fb-anchor-291.ts            # torrkörning
 *   npx ts-node src/scripts/oneoff-repair-fb-anchor-291.ts --apply    # skriver
 *
 * Läser bara SQLite-spegeln. Skriver SQLite + Firestore (stamped, punkt-
 * updates per firestoreId). Vägrar köra medan nattkedjan kör (Nominatim 429).
 */

import { execSync } from 'child_process';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite, setEventCoords } from '../utils/sqliteHelper';
import {
    geocodeVenueSweden, geocodeCityCentroid, distanceKm, NEAR_CITY_MAX_KM, type GeoHit,
} from '../utils/venueCoordinates';
import { findKnownCities } from '../utils/cityInText';
import { anchorCityEvidence, preferTextHit } from '../scrapers/facebook/anchorCity';

const APPLY = process.argv.includes('--apply');
/** Köstad som aldrig nämns: vi vet inte vilken kö eventet kom från. */
const NO_CONTEXT = '§ingen-kö§';

interface Row {
    url: string; firestoreId: string | null; title: string | null; description: string | null;
    locationName: string | null; extractedAddress: string | null;
    lat: number; lng: number; geoPrecision: string | null;
}

function nightChainRunning(): boolean {
    try {
        return execSync('pgrep -f "scripts/run-daily.sh" || true').toString().trim().length > 0;
    } catch { return false; }
}

/** Nämner texten en känd stad som ligger nära eventets punkt? Då är punkten bekräftad. */
async function pointConfirmedByText(text: string, lat: number, lng: number): Promise<string | null> {
    for (const c of findKnownCities(text)) {
        const center = await geocodeCityCentroid(c);
        if (center && distanceKm(lat, lng, center[0], center[1]) <= NEAR_CITY_MAX_KM) return c;
    }
    return null;
}

async function main(): Promise<void> {
    if (nightChainRunning() && !process.argv.includes('--force')) {
        console.error('❌ Nattkedjan kör — två Nominatim-konsumenter samtidigt ger 429. Vänta.');
        process.exit(2);
    }
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, description, locationName, extractedAddress, lat, lng, geoPrecision
        FROM link_events
        WHERE url LIKE '%facebook.com/events/%'
          AND (hidden IS NULL OR hidden = 0)
          AND datetime(COALESCE(NULLIF(endDate, ''), time)) >= datetime('now')
          AND lat IS NOT NULL AND lng IS NOT NULL AND NOT (lat = 0 AND lng = 0)
    `).all() as Row[];
    console.log(`${rows.length} kommande synliga FB-event`);

    const fsUpdates: { id: string; data: Record<string, unknown> }[] = [];
    let candidates = 0, moved = 0, kept = 0, confirmed = 0;

    for (const r of rows) {
        const address = (r.extractedAddress || r.locationName || '').trim();
        if (!address) continue;
        const title = r.title ?? '';
        const description = r.description ?? '';
        const evidence = anchorCityEvidence({ contextCity: NO_CONTEXT, title, address, description });
        if (!evidence) continue;

        const town = await geocodeCityCentroid(evidence.city);
        if (!town || distanceKm(r.lat, r.lng, town[0], town[1]) <= NEAR_CITY_MAX_KM) continue;

        const confirmer = await pointConfirmedByText([title, address, description].join('\n'), r.lat, r.lng);
        if (confirmer) {
            confirmed++;
            console.log(`  ✋ ${title.slice(0, 50).padEnd(50)} | ${address.slice(0, 30).padEnd(30)} texten nämner ${confirmer} vid punkten — orörd`);
            continue;
        }
        const textQuery = address.toLowerCase().includes(evidence.city.toLowerCase())
            ? address : `${address}, ${evidence.city}`;
        const textHit = await geocodeVenueSweden(textQuery, { nearCity: evidence.city });
        const stored: GeoHit = [r.lat, r.lng, (r.geoPrecision || null) as GeoHit[2]];

        let target: { hit: GeoHit; query: string } | null = null;
        if (textHit && preferTextHit(evidence, textHit, stored)) {
            target = { hit: textHit, query: textQuery };
        } else if (!textHit && evidence.strength === 'stark') {
            // Som kedjans Retry 2: ortens mittpunkt, ärligt märkt.
            const c = await geocodeVenueSweden(`${evidence.city}, Sverige`);
            if (c) target = { hit: [c[0], c[1], 'stad-centroid'], query: `${evidence.city}, Sverige` };
        }
        // Svagt bevis utan lokal i textens ort: kedjan hade inte rört det heller.
        if (!target && evidence.strength !== 'stark') continue;
        candidates++;

        if (!target) {
            kept++;
            console.log(`  ·  ${title.slice(0, 50).padEnd(50)} | ${address.slice(0, 30).padEnd(30)} [${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}] ${r.geoPrecision ?? '–'} står kvar (${evidence.city} via ${evidence.from}, textträff ${textHit?.[2] ?? 'miss'})`);
            continue;
        }

        const [lat, lng, precision] = target.hit;
        const dKm = distanceKm(r.lat, r.lng, lat, lng);
        moved++;
        console.log(`  📍 ${title.slice(0, 50).padEnd(50)} | ${address.slice(0, 30).padEnd(30)} ${r.geoPrecision ?? '–'} → ${evidence.city} ${precision ?? '–'} (${dKm.toFixed(0)} km, ${evidence.strength} via ${evidence.from})`);
        if (APPLY) {
            setEventCoords(r.url, lat, lng, target.query, precision ?? null);
            if (r.firestoreId) {
                fsUpdates.push({
                    id: r.firestoreId,
                    data: { lat, lng, geocodedQuery: target.query, geoPrecision: precision ?? null, isLocationVerified: true },
                });
            }
        }
    }

    if (APPLY && db && fsUpdates.length > 0) {
        let fsErr = 0;
        for (const u of fsUpdates) {
            try { await db.collection('linkEvents').doc(u.id).update(stamped(u.data)); }
            catch (e: any) { if (e?.code !== 5) { fsErr++; console.error(`  ⚠️ Firestore ${u.id}: ${e?.message}`); } }
        }
        console.log(`Firestore: ${fsUpdates.length} punkt-updates${fsErr ? `, ${fsErr} fel` : ''}`);
    }

    console.log(`\n✅ ${candidates} felplacerade kandidater: ${moved} flyttade, ${kept} orörda · ${confirmed} bekräftade av texten`);
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error(e); process.exit(1); });
}
