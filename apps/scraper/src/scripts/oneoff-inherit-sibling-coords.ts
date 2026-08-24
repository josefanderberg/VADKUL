/**
 * oneoff-inherit-sibling-coords.ts — koordinat-arv mellan syskon-event.
 *
 * Samma (locationName, hostName) förekommer ofta både med exakta koordinater
 * (källkoordinat/poi/gata) och som stad-centroid (annan källa/körning utan
 * platsdata — Seriefest-mönstret). Centroid-raderna ärver syskonens
 * koordinat, förutsatt att de precisa syskonen är samstämmiga (<~200 m).
 *
 *   npx ts-node src/scripts/oneoff-inherit-sibling-coords.ts            # dry-run
 *   npx ts-node src/scripts/oneoff-inherit-sibling-coords.ts --commit
 */
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite, setEventCoords } from '../utils/sqliteHelper';

const COMMIT = process.argv.includes('--commit');

async function main(): Promise<void> {
    const pairs = sqlite.prepare(`
        SELECT LOWER(TRIM(locationName)) n, LOWER(TRIM(hostName)) h,
               AVG(lat) alat, AVG(lng) alng, COUNT(*) cnt
        FROM link_events
        WHERE geoPrecision IN ('kallkoordinat','poi','gata') AND NOT (lat=0 AND lng=0)
          AND LENGTH(TRIM(locationName)) >= 5
        GROUP BY n, h
        HAVING MAX(lat)-MIN(lat) < 0.002 AND MAX(lng)-MIN(lng) < 0.004
    `).all() as { n: string; h: string; alat: number; alng: number; cnt: number }[];

    const victims = sqlite.prepare(`
        SELECT url, firestoreId, locationName FROM link_events
        WHERE geoPrecision = 'stad-centroid'
          AND LOWER(TRIM(locationName)) = ? AND LOWER(TRIM(hostName)) = ?
          AND datetime(time) >= datetime('now') AND (hidden IS NULL OR hidden = 0)
    `);

    console.log(`${COMMIT ? '🔧 COMMIT' : '🔍 DRY-RUN'} — ${pairs.length} samstämmiga precisa (plats, värd)-par`);
    let moved = 0;
    const fsUpdates: { id: string; lat: number; lng: number }[] = [];
    for (const p of pairs) {
        const rows = victims.all(p.n, p.h) as { url: string; firestoreId: string | null; locationName: string }[];
        if (rows.length === 0) continue;
        console.log(`  📍 ${rows[0].locationName.slice(0, 50).padEnd(50)} ← arv från ${p.cnt} syskon (${rows.length} event)`);
        if (!COMMIT) continue;
        for (const r of rows) {
            setEventCoords(r.url, p.alat, p.alng, `arv: syskon-event ${p.n.slice(0, 40)}`, 'poi');
            moved++;
            if (r.firestoreId) fsUpdates.push({ id: r.firestoreId, lat: p.alat, lng: p.alng });
        }
    }
    if (COMMIT && db) {
        for (let i = 0; i < fsUpdates.length; i += 400) {
            const batch = db.batch();
            for (const u of fsUpdates.slice(i, i + 400)) {
                batch.update(db.collection('linkEvents').doc(u.id),
                    stamped({ lat: u.lat, lng: u.lng, isLocationVerified: true, geoPrecision: 'poi' }));
            }
            try { await batch.commit(); } catch (e: any) { console.error(`  ⚠️ Firestore: ${e?.message}`); }
        }
    }
    console.log(`\nKlart: ${moved} event ärvde syskonkoordinater`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
