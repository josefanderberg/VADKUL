/**
 * RADERA alla länk-events för en källa — så att källan får skrapa om dem rent.
 *
 * Skillnad mot hide-source-events.ts: den GÖMMER (hidden=1), vilket räcker för
 * döda källor. Men gömda rader ligger kvar som "känd URL" och gör att källan
 * aldrig återskapar eventet. När motorn har lagats och den GAMLA datan är fel
 * (fel datum, fel spelplats) är radering rätt verktyg: nästa körning läser om
 * sidorna och sparar korrekta värden.
 *
 *   npx ts-node src/scripts/purge-source-events.ts --host='Kulturbolaget'
 *   npx ts-node src/scripts/purge-source-events.ts --host='Kulturbolaget' --apply
 *
 * Skyddsräcken: dry-run som default, och ett tak (--max=, default 500) så att
 * ett felstavat host-argument aldrig kan tömma halva databasen.
 *
 * Boostade event påverkas inte: skrapade events boostar mot ett SEPARAT
 * overlay-dokument (se boostTargetRef i functions), inte mot linkEvents-doc:et.
 */
import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';

const apply = process.argv.includes('--apply');
const arg = (name: string) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : '';
};
const host = arg('host');
const max = parseInt(arg('max') || '500', 10);

async function main() {
    if (!host) { console.error("Ange --host='Källans hostName'"); process.exit(1); }
    const sqlite = new Database(path.resolve(__dirname, '../../events.db'));
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, substr(time,1,16) AS t, title, locationName
        FROM link_events WHERE hostName = ?
    `).all(host) as { url: string; firestoreId: string | null; t: string; title: string; locationName: string | null }[];

    console.log(`${apply ? '🔧 APPLY' : '🔍 DRY-RUN'} — ${host}: ${rows.length} rader`);
    if (!rows.length) { sqlite.close(); process.exit(0); }
    const days = new Set(rows.map((r) => r.t.slice(0, 10)));
    console.log(`   distinkta datum: ${days.size}${days.size <= 3 ? ' (⚠️ default-datum-kluster)' : ''}`);
    for (const r of rows.slice(0, 5)) {
        console.log(`   ex: ${r.t}  ${r.title.slice(0, 40).padEnd(40)} ${r.locationName ?? '—'}`);
    }
    if (rows.length > max) {
        console.error(`\n⛔ ${rows.length} rader > --max=${max}. Höj taket medvetet om det är avsiktligt.`);
        sqlite.close(); process.exit(1);
    }
    if (!apply) { console.log('\nKör med --apply för att radera.'); sqlite.close(); process.exit(0); }

    let fsDeleted = 0, missing = 0;
    if (db) for (const r of rows) {
        if (!r.firestoreId) { missing++; continue; }
        try { await db.collection('linkEvents').doc(r.firestoreId).delete(); fsDeleted++; }
        catch (e: any) {
            if (e.code === 5 || /NOT_FOUND/.test(e.message ?? '')) missing++; else throw e;
        }
    }
    const stmt = sqlite.prepare(`DELETE FROM link_events WHERE url = ?`);
    const tx = sqlite.transaction((list: typeof rows) => { for (const r of list) stmt.run(r.url); });
    tx(rows);
    sqlite.close();
    console.log(`\n✅ Raderat: Firestore ${fsDeleted} (${missing} saknade doc-id), SQLite ${rows.length}`);
    console.log('   Nästa källkörning skrapar om sidorna och sparar rätt värden.');
    process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
