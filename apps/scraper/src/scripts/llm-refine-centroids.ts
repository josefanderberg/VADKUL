/**
 * llm-refine-centroids.ts — LLM-extraktion + geokod-verifiering för
 * centroid-event som den deterministiska stegen inte löste (25/8, hävstång 2).
 *
 * Ollama (qwen3:8b) EXTRAHERAR platsen ur titel+beskrivning — den återger
 * text, gissar inte ur världskunskap. Varje kandidat verifieras hårt:
 * geokodas med nearCity-validering, måste flytta eventet >150 m men <60 km
 * från klustret, och ren stadsnivå räknas inte som förbättring. Fel som
 * slinker igenom är alltså "rimlig plats i rätt stad", aldrig fri fantasi.
 *
 * Kör EFTER bulk-repair (samma Nominatim-hänsyn):
 *   npx ts-node src/scripts/llm-refine-centroids.ts --limit=20            # dry
 *   npx ts-node src/scripts/llm-refine-centroids.ts --commit --limit=300
 */
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite, setEventCoords, upsertKnownVenue, isGenericLookupName } from '../utils/sqliteHelper';
import { llmEnrichEvent, ollamaIsAvailable } from '../utils/llmEnrich';
import {
    geocodeVenueSweden, reverseGeocode, isInNordic, distanceKm, isForeignAddress,
} from '../utils/venueCoordinates';
import { cleanCityName } from './geo-refine';

const COMMIT = process.argv.includes('--commit');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 300;
const MIN_MOVE_M = 150, MAX_JUMP_KM = 60;

interface Row {
    url: string; firestoreId: string | null; title: string;
    locationName: string; description: string; extractedAddress: string | null;
    lat: number; lng: number;
}

async function main(): Promise<void> {
    if (!(await ollamaIsAvailable())) {
        console.log('⚠️ Ollama ej uppe (localhost:11434) — avbryter.');
        process.exit(0);
    }
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, description, extractedAddress, lat, lng
        FROM link_events
        WHERE geoPrecision = 'stad-centroid' AND (hidden IS NULL OR hidden = 0)
          AND datetime(time) >= datetime('now')
          AND LENGTH(COALESCE(description, '')) >= 40
        ORDER BY time ASC LIMIT ?
    `).all(LIMIT) as Row[];
    console.log(`${COMMIT ? '🔧 COMMIT' : '🔍 DRY-RUN'} — ${rows.length} centroid-event med riktig beskrivning`);

    const cityCache = new Map<string, string | null>();
    let extracted = 0, verified = 0;
    for (const r of rows) {
        const res = await llmEnrichEvent(r.title, r.description, r.extractedAddress ?? '');
        const cand = (res.locationCandidate ?? '').trim();
        if (!cand || cand.length < 5 || isForeignAddress(cand)) continue;
        if (cand.toLowerCase() === r.locationName.trim().toLowerCase()) continue;   // inget nytt
        extracted++;

        const ckey = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
        if (!cityCache.has(ckey)) {
            cityCache.set(ckey, cleanCityName((await reverseGeocode(r.lat, r.lng))?.city ?? null));
        }
        const city = res.city || cityCache.get(ckey);
        if (!city) continue;

        const hit = await geocodeVenueSweden(`${cand}, ${city}`, { nearCity: city });
        if (!hit || !isInNordic(hit[0], hit[1])) continue;
        if (hit[2] === 'stad-centroid') continue;               // ingen förbättring
        const dKm = distanceKm(hit[0], hit[1], r.lat, r.lng);
        if (dKm * 1000 <= MIN_MOVE_M || dKm >= MAX_JUMP_KM) continue;

        verified++;
        console.log(`  📍 ${r.title.slice(0, 40).padEnd(40)} → "${cand}, ${city}" (${dKm.toFixed(1)} km, ${hit[2]})`);
        if (!COMMIT) continue;
        const precision = hit[2] ?? 'poi';
        setEventCoords(r.url, hit[0], hit[1], `llm: ${cand}, ${city}`.slice(0, 120), precision);
        if (db && r.firestoreId) {
            try {
                await db.collection('linkEvents').doc(r.firestoreId)
                    .update(stamped({ lat: hit[0], lng: hit[1], isLocationVerified: true, geoPrecision: precision }));
            } catch (e: any) { if (e?.code !== 5) console.error(`  ⚠️ Firestore: ${e?.message}`); }
        }
        // Registret får bara RENA venuenamn: inte generiska (förgiftnings-
        // risken från Seriefest-incidenten), inte adresser (siffror).
        if (precision === 'poi' && cand.length >= 5 && !isGenericLookupName(cand) && !/\d/.test(cand)) {
            upsertKnownVenue(cand, hit[0], hit[1], city, `llm-verify ${new Date().toISOString().slice(0, 10)}`);
        }
    }
    console.log(`\nKlart: ${extracted} kandidater ur LLM, ${verified} geokod-verifierade${COMMIT ? ' och skrivna' : ''}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
