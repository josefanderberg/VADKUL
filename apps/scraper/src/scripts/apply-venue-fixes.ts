/**
 * apply-venue-fixes.ts — applicera de manuellt verifierade venue-koordinaterna
 * i data/venueFixes.ts. Körs i nattkedjan (idempotent — no-op när allt redan
 * stämmer) och kan köras för hand efter en ny rapport:
 *
 *   npm run venue-fixes                # dry-run (skriver INGET)
 *   npm run venue-fixes -- --apply     # skriver SQLite + Firestore
 *
 * Tre saker per fix (se venueFixes.ts för varför):
 *   1. known_venues-upsert för varje namn → framtida geokodningar träffar
 *      kandidat 0 i geocodeVenueSweden i stället för Nominatim-namnar.
 *   2. geocode_cache-rensning (LIKE på namnen) → förgiftade 90-dagarsträffar
 *      dör; nästa uppslag går via known_venues.
 *   3. Befintliga FRAMTIDA event med exakt matchande locationName flyttas
 *      (setEventCoords + Firestore-update via stamped) när de står >100 m fel.
 *
 * Läser BARA SQLite-spegeln (aldrig Firestore-kollektioner) — Firestore rörs
 * enbart med punkt-updates per firestoreId, CLAUDE.md-reglerna hålls.
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords, upsertKnownVenue } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { distanceKm } from '../utils/venueCoordinates';
import { VENUE_FIXES, matchVenueFix } from '../data/venueFixes';

const APPLY = process.argv.includes('--apply');

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN (inget skrivs — kör med --apply)');

    // 1 + 2: known_venues + cache-rensning, per namn.
    let cachePurged = 0;
    for (const fix of VENUE_FIXES) {
        for (const name of fix.names) {
            if (APPLY) upsertKnownVenue(name, fix.lat, fix.lng, fix.city, `venue-fix: ${fix.note}`);
            const rows = sqlite.prepare('SELECT COUNT(*) AS n FROM geocode_cache WHERE query LIKE ?')
                .get(`%${name.toLowerCase()}%`) as { n: number };
            if (rows.n > 0) {
                if (APPLY) sqlite.prepare('DELETE FROM geocode_cache WHERE query LIKE ?').run(`%${name.toLowerCase()}%`);
                cachePurged += rows.n;
            }
        }
        console.log(`📍 ${fix.city}: ${fix.names.join(' / ')} → ${fix.lat}, ${fix.lng}`);
    }
    const nNames = VENUE_FIXES.reduce((s, f) => s + f.names.length, 0);
    console.log(`   known_venues: ${nNames} namn ${APPLY ? 'upsertade' : 'skulle upsertas'}, geocode_cache: ${cachePurged} rader ${APPLY ? 'rensade' : 'skulle rensas'}`);

    // 3: flytta befintliga framtida event som matchar och står fel.
    const events = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now')
    `).all() as { url: string; firestoreId: string | null; title: string | null; locationName: string | null; lat: number | null; lng: number | null }[];

    // En trasig rad (NULL-titel, korrupt url …) får ALDRIG fälla hela steget:
    // run-daily.sh sväljer exit≠0 med en ⚠️-rad och kör vidare, så en krasch
    // här betyder tyst att inga event flyttas alls (Piteå 5/9 — skogen låg
    // kvar i nattens aggregat). Därför per-rad-try/catch + null-säkra fält.
    let moved = 0, alreadyRight = 0, fsErrors = 0, rowErrors = 0;
    for (const e of events) {
        try {
            const fix = matchVenueFix(e.locationName);
            if (!fix) continue;
            const dist = distanceKm(e.lat || 0, e.lng || 0, fix.lat, fix.lng);
            if (dist < 0.1) { alreadyRight++; continue; }
            console.log(`  🔧 ${(e.title ?? '(utan titel)').slice(0, 45)} | ${e.locationName} | ${dist.toFixed(1)} km fel${APPLY ? ' → flyttas' : ''}`);
            if (!APPLY) { moved++; continue; }
            setEventCoords(e.url, fix.lat, fix.lng, `venue-fix: ${fix.city}`, 'poi');
            if (db && e.firestoreId) {
                try {
                    await db.collection('linkEvents').doc(e.firestoreId).update(stamped({
                        lat: fix.lat, lng: fix.lng, isLocationVerified: true, geoPrecision: 'poi',
                    }));
                } catch (err: any) {
                    // NOT_FOUND (kod 5) = dokumentet rensat ur Firestore — SQLite räcker.
                    if (err?.code !== 5) { fsErrors++; console.error(`  ⚠️ Firestore-update misslyckades för ${e.url}:`, err?.message); }
                }
            }
            moved++;
        } catch (err: any) {
            rowErrors++;
            console.error(`  ⚠️ Rad hoppades över (${(e?.url ?? '?').slice(0, 60)}):`, err?.message);
        }
    }
    console.log(`✅ Venue-fixar: ${moved} event ${APPLY ? 'flyttade' : 'skulle flyttas'}, ${alreadyRight} stod redan rätt${fsErrors ? `, ${fsErrors} Firestore-fel` : ''}${rowErrors ? `, ${rowErrors} trasiga rader överhoppade` : ''}`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
