/**
 * Göm ALLA synliga events för en källa (host) — för döda källor vars events
 * är skräp (t.ex. default-datum-kluster). Reversibelt (hidden=1, ej raderat).
 *
 *   npx ts-node src/scripts/hide-source-events.ts --host='Oceanen'           # dry-run
 *   npx ts-node src/scripts/hide-source-events.ts --host='Oceanen' --apply
 */
import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';

const apply = process.argv.includes('--apply');
const hostArg = process.argv.find((a) => a.startsWith('--host='));
const host = hostArg ? hostArg.split('=').slice(1).join('=') : '';

async function main() {
    if (!host) { console.error("Ange --host='Källans hostName'"); process.exit(1); }
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'));
    const rows = sqlite.prepare(`
        SELECT firestoreId, substr(time,1,10) AS day, title FROM link_events
        WHERE hostName = ? AND hidden = 0 AND firestoreId IS NOT NULL
    `).all(host) as { firestoreId: string; day: string; title: string }[];

    console.log(`${apply ? '🔧 APPLY' : '🔍 DRY-RUN'} — ${host}: ${rows.length} synliga events att gömma`);
    const days = new Set(rows.map((r) => r.day));
    console.log(`   distinkta datum: ${days.size}${days.size === 1 ? ' (⚠️ default-datum-kluster)' : ''}`);
    for (const r of rows.slice(0, 4)) console.log(`   ex: ${r.day} ${r.title.slice(0, 45)}`);

    if (!apply) { console.log('\nKör med --apply för att gömma.'); sqlite.close(); process.exit(0); }

    let fs = 0, miss = 0;
    if (db) for (const r of rows) {
        try { await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ hidden: 1 })); fs++; }
        catch (e: any) { if (e.code === 5 || /NOT_FOUND/.test(e.message ?? '')) miss++; else throw e; }
    }
    const stmt = sqlite.prepare(`UPDATE link_events SET hidden = 1 WHERE firestoreId = ?`);
    for (const r of rows) stmt.run(r.firestoreId);
    sqlite.close();
    console.log(`\n✅ Gömt: Firestore ${fs} (${miss} not-found), SQLite ${rows.length}`);
    process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
