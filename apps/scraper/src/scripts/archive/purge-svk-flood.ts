/**
 * purge-svk-flood — engångsstäd efter incidenten 2026-06-11.
 *
 * Nattjobbet hann spara ~845 ofiltrerade Svenska kyrkan-event (dop, vigslar,
 * stängningsnotiser…) som 'published' innan det stoppades. Det här raderar
 * NATTENS batch (createdAt >= 2026-06-11T04:00Z) ur BÅDE Firestore och
 * SQLite-spegeln, så att morgondagens körning med hårt filter importerar om
 * den publika delmängden fräscht. De ~12 äldre dev-test-eventen lämnas.
 *
 * Kör: ts-node src/scripts/purge-svk-flood.ts --yes
 */
import path from 'path';
import Database from 'better-sqlite3';
import { db, dbTarget } from '../config/firebase';

const CUTOFF = '2026-06-11T04:00';

async function main() {
    if (!process.argv.includes('--yes')) {
        console.error('Raderar nattens svenskakyrkan-event ur Firestore + SQLite. Kör med --yes.');
        process.exit(1);
    }
    if (!db) {
        console.error('❌ Ingen Firestore-anslutning.');
        process.exit(1);
    }
    console.log(`DB: ${dbTarget.name} (DB_TARGET=${dbTarget.key})`);

    const sqlite = new Database(path.resolve(__dirname, '../../events.db'));
    const rows = sqlite
        .prepare(
            `SELECT url, firestoreId FROM link_events
             WHERE url LIKE '%svenskakyrkan%' AND createdAt >= ?`
        )
        .all(CUTOFF) as { url: string; firestoreId: string | null }[];
    console.log(`${rows.length} rader att radera (cutoff ${CUTOFF})`);

    // Firestore: batch-radera (max 500 ops/batch)
    const ids = rows.map((r) => r.firestoreId).filter(Boolean) as string[];
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 500) {
        const batch = db.batch();
        for (const id of ids.slice(i, i + 500)) batch.delete(db.collection('linkEvents').doc(id));
        await batch.commit();
        deleted += Math.min(500, ids.length - i);
        console.log(`  Firestore: ${deleted}/${ids.length}`);
    }
    if (ids.length < rows.length) {
        console.log(`  ⚠️ ${rows.length - ids.length} rader saknade firestoreId — raderas bara ur SQLite.`);
    }

    const res = sqlite
        .prepare(`DELETE FROM link_events WHERE url LIKE '%svenskakyrkan%' AND createdAt >= ?`)
        .run(CUTOFF);
    console.log(`SQLite: ${res.changes} rader raderade.`);

    const left = sqlite
        .prepare(`SELECT COUNT(*) AS n FROM link_events WHERE url LIKE '%svenskakyrkan%'`)
        .get() as { n: number };
    console.log(`Kvar med svenskakyrkan-URL: ${left.n} (ska vara ~12 äldre).`);
    sqlite.close();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
