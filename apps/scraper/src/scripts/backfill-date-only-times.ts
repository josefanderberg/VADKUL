/**
 * backfill-date-only-times.ts — rätta "bara datum"-event som lagrats på lokal
 * midnatt (22:00Z sommar / 23:00Z vinter).
 *
 * Bakgrund: tidigare lagrades datum-only-event (hasSpecificTime=0) som lokal
 * midnatt. toISOString() gör 00:00 lokal till 22:00Z (CEST) / 23:00Z (CET)
 * FÖREGÅENDE dygn — det ser ut som ett klockslag och kan rulla över datumet.
 * fix-midnight-times rättade redan FLAGGAN (hasSpecificTime=false); här rättas
 * TIDSVÄRDET till en neutral eftermiddag (12:00Z ≈ 14:00 lokal) på rätt
 * Stockholms-kalenderdag. Framåt sköts detta av addEventToDb.
 *
 * Rör bara hasSpecificTime=0-event (de 12 med flaggan satt till 1 påstår en
 * riktig tid och lämnas ifred). normalizeDateOnlyTime är idempotent.
 *
 * Användning:
 *   npx ts-node src/scripts/backfill-date-only-times.ts            # dry-run
 *   npx ts-node src/scripts/backfill-date-only-times.ts --apply
 */

import { db } from '../config/firebase';
import { sqlite, setEventTime } from '../utils/sqliteHelper';
import { normalizeDateOnlyTime } from '../utils/swedishDate';

const APPLY = process.argv.includes('--apply');

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    hostName: string | null;
    time: string;
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    // Lokal-midnatt-signaturen: 22:00Z (sommar) eller 23:00Z (vinter), framtida,
    // och bara där källan saknade klockslag (hasSpecificTime=0).
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, hostName, time
        FROM link_events
        WHERE strftime('%H:%M', time) IN ('22:00', '23:00')
          AND hasSpecificTime = 0
          AND time >= datetime('now')
        ORDER BY time ASC
    `).all() as Row[];

    console.log(`${rows.length} date-only-event på lokal midnatt att rätta.\n`);

    const perHost = new Map<string, number>();
    let fixed = 0, unchanged = 0, fsFail = 0;

    for (const r of rows) {
        const old = new Date(r.time);
        if (isNaN(old.getTime())) continue;
        const next = normalizeDateOnlyTime(old);
        if (next.toISOString() === old.toISOString()) { unchanged++; continue; }

        fixed++;
        perHost.set(r.hostName || '(okänd)', (perHost.get(r.hostName || '(okänd)') || 0) + 1);

        if (APPLY) {
            setEventTime(r.url, next.toISOString(), false);
            if (db && r.firestoreId) {
                try {
                    await db.collection('linkEvents').doc(r.firestoreId)
                        .update({ time: next, hasSpecificTime: false });
                } catch (e: any) {
                    if (e?.code !== 5) { fsFail++; console.error(`  ❌ Firestore ${r.url.slice(0, 50)}: ${e?.message}`); }
                }
            }
        }
    }

    console.log('=== Per host ===');
    for (const [host, n] of [...perHost.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${host.slice(0, 40).padEnd(40)}  ${n}`);
    }

    console.log('\n=== Klart ===');
    console.log(`  🕑 Rättade:   ${fixed}`);
    console.log(`  ○ Oförändrade: ${unchanged}`);
    if (fsFail) console.log(`  ❌ Firestore-fel: ${fsFail}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
