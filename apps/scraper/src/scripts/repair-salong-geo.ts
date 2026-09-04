/**
 * repair-salong-geo.ts — flytta salongs-event till sin byggnad.
 *
 * Bakgrund (Piteå 2026-09-04): Ticksters "Saga - Bio 3:an" låg 14 km utanför
 * stan — biljettsystemet har en koordinat per SALONG och de spretar. Skrapan
 * geokodar numera byggnaden först (tickster.ts + runnerns geokodkedja), men
 * kända URL:er hoppas i nattkörningen, så befintliga rader måste flyttas
 * explicit. Det här gör det: för varje framtida event vars locationName är
 * "SALONG - BYGGNAD" geokodas "BYGGNAD, STAD"; en riktig träff (known_venues/
 * poi/gata — inte stads-/ortcentroid) som ligger >300 m från nuvarande punkt
 * skrivs till SQLite + Firestore. En geokodning per byggnad+stad (cachad).
 *
 * Användning:
 *   npm run repair-salong                      # dry-run
 *   npm run repair-salong -- --apply --limit=300
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { geocodeVenueSweden, distanceKm, GeoHit } from '../utils/venueCoordinates';
import { venueBuildingOf } from '../utils/venueFromText';
import { deriveExpectedCity } from './repair-misplaced-geo';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 300;
const MIN_MOVE_KM = 0.3;

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    locationName: string | null;
    hostName: string | null;
    geocodedQuery: string | null;
    lat: number | null;
    lng: number | null;
}

/** Sista komma-segmentet ("Saga - Bio 3:an, Piteå" → "Piteå") som svag stads-fallback. */
function trailingSegment(text: string | null): string | null {
    const parts = (text ?? '').split(',').map(s => s.trim()).filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 1] : null;
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, hostName, geocodedQuery, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
          AND locationName LIKE '%-%'
        ORDER BY time ASC
    `).all() as Row[];
    const targets = rows.filter(r => venueBuildingOf(r.locationName)).slice(0, LIMIT);
    console.log(`${targets.length} salongs-event (av ${rows.length} kandidater, limit ${LIMIT})`);

    const cache = new Map<string, GeoHit | null>();
    let moved = 0, alreadyThere = 0, noCity = 0, noHit = 0;

    for (const r of targets) {
        const building = venueBuildingOf(r.locationName)!;
        const city = deriveExpectedCity(r.locationName, r.hostName, r.geocodedQuery)
            ?? trailingSegment(r.locationName) ?? trailingSegment(r.geocodedQuery);
        if (!city) { noCity++; continue; }

        const q = `${building}, ${city}`;
        let hit = cache.get(q);
        if (hit === undefined) {
            hit = await geocodeVenueSweden(q, { nearCity: city });
            cache.set(q, hit ?? null);
        }
        if (!hit || !hit[2] || hit[2] === 'stad-centroid' || hit[2] === 'ort-centroid') { noHit++; continue; }

        const dist = (r.lat && r.lng) ? distanceKm(r.lat, r.lng, hit[0], hit[1]) : Infinity;
        if (dist < MIN_MOVE_KM) { alreadyThere++; continue; }

        moved++;
        console.log(`  🏛️ ${r.title.slice(0, 40).padEnd(40)} "${r.locationName}" → "${q}" [${hit[0].toFixed(4)},${hit[1].toFixed(4)}] (${hit[2]}, ${Number.isFinite(dist) ? dist.toFixed(1) + ' km' : 'saknade koord'})`);
        if (!APPLY) continue;

        setEventCoords(r.url, hit[0], hit[1], q, hit[2]);
        if (db && r.firestoreId) {
            try {
                await db.collection('linkEvents').doc(r.firestoreId)
                    .update(stamped({ lat: hit[0], lng: hit[1], geocodedQuery: q, isLocationVerified: true }));
            } catch (e: any) {
                if (e?.code !== 5) console.error(`  ❌ Firestore fail ${r.url.slice(0, 50)}: ${e?.message}`);
            }
        }
    }

    console.log('\n=== Klart ===');
    console.log(`  🏛️ Flyttade till byggnaden: ${moved}`);
    console.log(`  ✓ Låg redan rätt (<${MIN_MOVE_KM * 1000} m): ${alreadyThere}`);
    console.log(`  ○ Ingen träff på byggnaden:  ${noHit}`);
    console.log(`  ○ Ingen stad att söka nära:  ${noCity}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
