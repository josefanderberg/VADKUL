/**
 * Migration: göm events från våra nya Sources som ligger >60 dagar fram.
 *
 * Bakgrund: när källsidan beskriver en utställning eller löpande aktivitet
 * ("Öppet 5 juni – 31 december") plockar vår parser ofta slutdatumet
 * eftersom startdatumet är passerat. Resultat: events daterade dec/2027/2028
 * trots att de pågår redan idag.
 *
 * Strategi: gömma alla events från våra 14 kommun-sources där stored är
 * mer än 60 dagar fram. Appens visnings-fönster är ändå 30 dagar.
 *
 * Användning:
 *   npx ts-node src/scripts/hide-far-future-events.ts        # dry-run
 *   npx ts-node src/scripts/hide-far-future-events.ts --apply
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { SOURCES } from '../sources/registry';

const apply = process.argv.includes('--apply');
const HOSTS = SOURCES.map((s) => s.hostName);
const CUTOFF_DAYS = 60;

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    const cutoff = new Date(Date.now() + CUTOFF_DAYS * 86400000);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    console.log(apply ? '🔧 APPLY mode' : '🔍 DRY-RUN');
    console.log(`Cutoff: events >${cutoffStr} göms\n`);

    const rows = sqliteDb.prepare(`
        SELECT url, title, time, firestoreId, hostName
        FROM link_events
        WHERE hostName IN (${HOSTS.map(() => '?').join(',')})
          AND firestoreId IS NOT NULL
          AND hidden = 0
          AND substr(time,1,10) > ?
        ORDER BY time DESC
    `).all(...HOSTS, cutoffStr) as any[];

    console.log(`Hittade ${rows.length} kandidater att gömma\n`);
    for (const r of rows) {
        console.log(`  ${r.time.slice(0,10)} | ${r.hostName.slice(0,16).padEnd(16)} | ${r.title.slice(0, 60)}`);
    }

    if (apply && rows.length > 0) {
        console.log('\nUppdaterar Firestore + SQLite…');
        let batch = db.batch();
        let inBatch = 0;
        let written = 0;
        for (const r of rows) {
            batch.update(db.collection('linkEvents').doc(r.firestoreId), { hidden: 1 });
            inBatch++;
            if (inBatch >= 400) {
                await batch.commit();
                written += inBatch;
                batch = db.batch();
                inBatch = 0;
            }
        }
        if (inBatch > 0) { await batch.commit(); written += inBatch; }

        // SQLite-update
        sqliteDb.close();
        const wDb = new Database(path.resolve(__dirname, '../../events.db'));
        const stmt = wDb.prepare(`UPDATE link_events SET hidden=1 WHERE firestoreId = ?`);
        for (const r of rows) stmt.run(r.firestoreId);
        wDb.close();

        console.log(`✅ Gömde ${written} events i Firestore + SQLite`);
    }

    console.log(`\nTOTAL: ${rows.length} ${apply ? 'gömda' : '(dry-run)'}`);
    process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
