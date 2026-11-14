/**
 * repair-centroids-from-register.ts — flytta mittpunktsevent till lokalen när
 * lokalregistret (known_venues) redan KAN platsen.
 *
 * Bakgrund (jämförelsen 14/11 2026): 1 008 framtida event låg på en orts
 * mittpunkt fast platsen stod i registret. Uppslaget krävde att stadsnamnen
 * var samma text, och källan anger ofta kommunen ("Fittja bibliotek,
 * Botkyrka") medan registret bär postorten (Norsborg). lookupVenueNear matchar
 * på namn + närhet i stället, och är nu inkopplat i geokodningskedjan,
 * geo-refine och bulk-repair. Det här skriptet läker de event som redan låg
 * fel — utan ett enda nätanrop, så det går på sekunder.
 *
 * Per event (framtida, synligt, geoPrecision stad-/ort-centroid):
 *   - registerträff på platsnamnet (hela / före första kommat / utan
 *     genitiv-s) inom 25 km från eventets nuvarande punkt,
 *   - flytt över 150 m → nya koordinater, geoPrecision 'poi',
 *   - under 150 m → eventet stod redan på lokalen, bara märkningen rättas.
 * Event som geo-refine redan gett upp om (≥3 försök) tas också — det är just
 * de som fastnat.
 *
 * Skriver SQLite + Firestore (stamped()). --apply krävs, annars dry-run.
 *
 *   npx ts-node src/scripts/repair-centroids-from-register.ts            # dry-run
 *   npx ts-node src/scripts/repair-centroids-from-register.ts --apply
 */

import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite, setEventCoords, lookupVenueNear } from '../utils/sqliteHelper';
import { deGenitiveFirstWord, distanceKm, isInNordic, KNOWN_VENUE_NEAR_KM } from '../utils/venueCoordinates';

const APPLY = process.argv.includes('--apply');
const MIN_MOVE_M = 150;

interface Row {
    url: string; firestoreId: string | null; title: string;
    locationName: string; lat: number; lng: number; geoPrecision: string;
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN (kör med --apply för att skriva)');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, lat, lng, geoPrecision
        FROM link_events
        WHERE hidden = 0 AND time >= ?
          AND geoPrecision IN ('stad-centroid', 'ort-centroid')
          AND locationName IS NOT NULL AND TRIM(locationName) <> ''
    `).all(new Date().toISOString()) as Row[];
    console.log(`${rows.length} framtida synliga event på en ortsmittpunkt`);

    let moved = 0;
    let relabelled = 0;
    const byName = new Map<string, { n: number; km: number }>();
    for (const r of rows) {
        const name = r.locationName.trim();
        const head = name.split(',')[0].trim();
        const deGen = deGenitiveFirstWord(head);
        const hit = lookupVenueNear(name, r.lat, r.lng, KNOWN_VENUE_NEAR_KM)
            ?? (head !== name ? lookupVenueNear(head, r.lat, r.lng, KNOWN_VENUE_NEAR_KM) : null)
            ?? (deGen ? lookupVenueNear(deGen, r.lat, r.lng, KNOWN_VENUE_NEAR_KM) : null);
        if (!hit || !isInNordic(hit[0], hit[1])) continue;

        const km = distanceKm(hit[0], hit[1], r.lat, r.lng);
        if (km * 1000 > MIN_MOVE_M) {
            moved++;
            const agg = byName.get(head) ?? { n: 0, km };
            agg.n++;
            byName.set(head, agg);
        } else {
            relabelled++;
        }
        if (!APPLY) continue;
        setEventCoords(r.url, hit[0], hit[1], `venue-register: ${head.slice(0, 60)}`, 'poi');
        if (db && r.firestoreId) {
            try {
                await db.collection('linkEvents').doc(r.firestoreId)
                    .update(stamped({ lat: hit[0], lng: hit[1], isLocationVerified: true, geoPrecision: 'poi' }));
            } catch (e: any) {
                // NOT_FOUND (kod 5) = dokumentet rensat ur Firestore — SQLite räcker.
                if (e?.code !== 5) console.error(`  ❌ Firestore ${r.url.slice(0, 60)}: ${e?.message}`);
            }
        }
    }

    console.log(`\n📍 ${moved} event ${APPLY ? 'flyttade' : 'skulle flyttas'} från mittpunkten till lokalen (${byName.size} platser)`);
    console.log(`🏷️  ${relabelled} stod redan på lokalen — ${APPLY ? 'märkta' : 'skulle märkas'} 'poi'`);
    console.log('\n  event  flytt   plats');
    for (const [name, a] of [...byName.entries()].sort((x, y) => y[1].n - x[1].n).slice(0, 40)) {
        console.log(`  ${String(a.n).padStart(5)}  ${a.km.toFixed(1).padStart(4)} km  ${name}`);
    }
    if (!APPLY) console.log('\nDry-run — inget skrivet.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
