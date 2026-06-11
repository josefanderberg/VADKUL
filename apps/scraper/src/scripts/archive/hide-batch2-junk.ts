/**
 * Engångs-cleanup (2026-06-09): göm default-datum-skräp från Nalen + Katalin.
 *
 * Nalen och Katalin har detaljsidor utan parsbart datum → sitemap-motorn
 * defaultade ~214 events till 2026-06-24T22:00 (inkl. "test" + restaurang-promo).
 *   - Nalen:   hela källan opålitlig → göm ALLA.
 *   - Katalin: 5 events har riktiga datum (behåll) → göm bara 2026-06-24-klustret.
 *
 *   npx ts-node src/scripts/hide-batch2-junk.ts            # dry-run
 *   npx ts-node src/scripts/hide-batch2-junk.ts --apply
 */
import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';

const apply = process.argv.includes('--apply');

async function main() {
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'));
    const rows = sqlite.prepare(`
        SELECT firestoreId, hostName, substr(time,1,10) AS day, title
        FROM link_events
        WHERE hidden = 0 AND firestoreId IS NOT NULL AND (
            hostName = 'Nalen'
            OR (hostName = 'Katalin' AND substr(time,1,10) = '2026-06-24')
        )
    `).all() as { firestoreId: string; hostName: string; day: string; title: string }[];

    const byHost: Record<string, number> = {};
    for (const r of rows) byHost[r.hostName] = (byHost[r.hostName] || 0) + 1;
    console.log(`${apply ? '🔧 APPLY' : '🔍 DRY-RUN'} — ${rows.length} skräp-events att gömma:`, byHost);
    for (const r of rows.slice(0, 5)) console.log(`   ex: [${r.hostName}] ${r.day} ${r.title.slice(0, 40)}`);

    if (!apply) { console.log('\nKör med --apply för att gömma.'); sqlite.close(); process.exit(0); }

    let fs = 0, fsMiss = 0;
    if (db) {
        for (const r of rows) {
            try { await db.collection('linkEvents').doc(r.firestoreId).update({ hidden: 1 }); fs++; }
            catch (e: any) { if (e.code === 5 || /NOT_FOUND/.test(e.message ?? '')) fsMiss++; else throw e; }
        }
    }
    const stmt = sqlite.prepare(`UPDATE link_events SET hidden = 1 WHERE firestoreId = ?`);
    for (const r of rows) stmt.run(r.firestoreId);
    sqlite.close();
    console.log(`\n✅ Gömt: Firestore ${fs} (${fsMiss} not-found), SQLite ${rows.length}`);
    process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
