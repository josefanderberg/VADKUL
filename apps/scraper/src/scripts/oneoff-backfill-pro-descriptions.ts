/**
 * oneoff-backfill-pro-descriptions.ts — hämta RIKTIGA beskrivningar för
 * befintliga framtida PRO-event (24/8, Canasta-fallet: motorn syntetiserade
 * "PRO X-aktivitet, Kommun." och slängde detaljsidans text där platsen står).
 *
 * Uppdaterar description i SQLite + Firestore (stamped, batchat). Själva
 * KOORDINAT-flytten görs av bulk-repair-centroids som läser den nya texten.
 *
 *   npx ts-node src/scripts/oneoff-backfill-pro-descriptions.ts            # dry 20 st
 *   npx ts-node src/scripts/oneoff-backfill-pro-descriptions.ts --commit   # alla
 */
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite } from '../utils/sqliteHelper';
import { fetchProActivityDescription } from '../scrapers/pro';
import { mapPool } from '../utils/mapPool';

const COMMIT = process.argv.includes('--commit');
const SAMPLE = 20;

interface Row { url: string; firestoreId: string | null; description: string | null }

async function main(): Promise<void> {
    let rows = sqlite.prepare(`
        SELECT url, firestoreId, description FROM link_events
        WHERE url LIKE 'https://pro.se/%' AND datetime(time) >= datetime('now')
          AND (hidden IS NULL OR hidden = 0)
    `).all() as Row[];
    // Bara rader med syntetisk platshållare — riktiga texter rörs inte.
    rows = rows.filter(r => !r.description || /-aktivitet( på .*)?, [A-ZÅÄÖ]/.test(r.description));
    if (!COMMIT) rows = rows.slice(0, SAMPLE);
    console.log(`${COMMIT ? '🔧 COMMIT' : `🔍 DRY-RUN (${SAMPLE} första)`} — ${rows.length} PRO-event att detalj-hämta`);

    const updStmt = sqlite.prepare('UPDATE link_events SET description = ?, updatedAt = ? WHERE url = ?');
    let fetched = 0, updated = 0, failed = 0;
    const pending: { firestoreId: string; description: string }[] = [];

    await mapPool(rows, 5, async (r) => {
        const desc = await fetchProActivityDescription(r.url);
        fetched++;
        if (fetched % 250 === 0) console.log(`  …${fetched}/${rows.length} (${updated} uppdaterade)`);
        if (!desc) { failed++; return; }
        if (!COMMIT) { console.log(`  📝 ${r.url.slice(-28)} → ${desc.slice(0, 90)}`); return; }
        updStmt.run(desc, new Date().toISOString(), r.url);
        updated++;
        if (r.firestoreId) pending.push({ firestoreId: r.firestoreId, description: desc });
    });

    if (COMMIT && db && pending.length) {
        for (let i = 0; i < pending.length; i += 400) {
            const batch = db.batch();
            for (const p of pending.slice(i, i + 400)) {
                batch.update(db.collection('linkEvents').doc(p.firestoreId), stamped({ description: p.description }));
            }
            try { await batch.commit(); } catch (e: any) { console.error(`  ⚠️ Firestore-batch: ${e?.message}`); }
        }
    }
    console.log(`\nKlart: ${updated} uppdaterade, ${failed} utan text (${fetched} hämtade)`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
