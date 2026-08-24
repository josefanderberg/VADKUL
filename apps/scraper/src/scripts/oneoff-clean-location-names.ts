/** Engångssanering av locationName-skräp i befintliga rader (25/8):
 *  "(Öppnas i ett nytt fönster)", ", Sweden"-svansar, HTML-entiteter.
 *  SQLite för alla rader; Firestore för framtida (aggregatet läser SQLite,
 *  men inkrementell sync får inte återinföra skräpet).
 *
 *    npx ts-node src/scripts/oneoff-clean-location-names.ts --commit
 */
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { sqlite } from '../utils/sqliteHelper';
import { cleanLocationName } from '../utils/text';

const COMMIT = process.argv.includes('--commit');

async function main(): Promise<void> {
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, locationName, datetime(time) >= datetime('now') AS framtida
        FROM link_events WHERE locationName IS NOT NULL AND locationName != ''
    `).all() as { url: string; firestoreId: string | null; locationName: string; framtida: number }[];

    const upd = sqlite.prepare('UPDATE link_events SET locationName = ?, updatedAt = ? WHERE url = ?');
    let changed = 0;
    const fsPending: { id: string; loc: string }[] = [];
    for (const r of rows) {
        const clean = cleanLocationName(r.locationName);
        if (!clean || clean === r.locationName) continue;
        changed++;
        if (changed <= 10) console.log(`  "${r.locationName.slice(0, 55)}" → "${clean.slice(0, 55)}"`);
        if (!COMMIT) continue;
        upd.run(clean, new Date().toISOString(), r.url);
        if (r.framtida && r.firestoreId) fsPending.push({ id: r.firestoreId, loc: clean });
    }
    if (COMMIT && db) {
        for (let i = 0; i < fsPending.length; i += 400) {
            const batch = db.batch();
            for (const p of fsPending.slice(i, i + 400)) {
                batch.update(db.collection('linkEvents').doc(p.id), stamped({ locationName: p.loc }));
            }
            try { await batch.commit(); } catch (e: any) { console.error(`  ⚠️ Firestore: ${e?.message}`); }
        }
    }
    console.log(`${COMMIT ? 'Sanerade' : 'Skulle sanera'}: ${changed} av ${rows.length} rader`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
