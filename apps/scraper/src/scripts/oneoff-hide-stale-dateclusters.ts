/**
 * Engångs (28/9 2026): dölj event som ligger kvar på ett FELAKTIGT datumkluster
 * efter motorfixarna för Malmö Live och Havremagasinet.
 *
 *   - malmo-live:     sajtbannerns "3 oktober … Malmö Marathon" gav 64 passerade
 *                     konserter datumet 2026-10-03.
 *   - havremagasinet: "Andra event"-kortens "10 okt." gav 47 gamla sidor 2026-10-10.
 *
 * Refresh-vägen (SCRAPE_FORCE_REFRESH=1) rättar bara URL:er som den fixade
 * motorn fortfarande returnerar. Resten (passerade konserter, gamla sidor)
 * returneras aldrig igen och står annars kvar på fel dag. Skriptet kör den
 * fixade motorn, och döljer klustrets event vars URL INTE finns i dess utdata.
 *
 *   npx ts-node src/scripts/oneoff-hide-stale-dateclusters.ts          # dry-run
 *   npx ts-node src/scripts/oneoff-hide-stale-dateclusters.ts --apply
 *
 * Skriver hidden i BÅDE SQLite och Firestore (via stamped()).
 */
import Database from 'better-sqlite3';
import path from 'path';
import { db } from '../config/firebase';
import { setHidden } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { SOURCES } from '../sources/registry';
import { ENGINES } from '../sources';

const APPLY = process.argv.includes('--apply');
const DB_PATH = path.resolve(__dirname, '../../events.db');

const CLUSTERS = [
    { sourceId: 'malmo-live', hostName: 'Malmö Live Konserthus', badDay: '2026-10-03' },
    { sourceId: 'havremagasinet', hostName: 'Havremagasinet', badDay: '2026-10-10' },
];

const norm = (u: string) => u.replace(/\/+$/, '');

async function validUrls(sourceId: string): Promise<Set<string>> {
    const source = SOURCES.find((s) => s.id === sourceId);
    if (!source) throw new Error(`okänd källa ${sourceId}`);
    const now = new Date();
    const events = await ENGINES[source.engine](source.config as any, {
        windowStart: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        windowEnd: new Date(now.getTime() + 400 * 86400000),
        log: (m: string) => console.log(`  [${sourceId}] ${m}`),
        isKnownUrl: async () => false,
        refreshKnown: true,
    } as any);
    return new Set(events.map((e) => norm(e.url)));
}

async function main() {
    const sqlite = new Database(DB_PATH, { readonly: true });
    let hidden = 0;
    for (const c of CLUSTERS) {
        const valid = await validUrls(c.sourceId);
        // time lagras i UTC — lokal dag 3/10 = UTC 2/10 22:00 … 3/10 21:59.
        const rows = sqlite.prepare(`
            SELECT url, firestoreId, title, time FROM link_events
            WHERE hostName = ? AND hidden = 0
              AND datetime(time, 'localtime') >= ? AND datetime(time, 'localtime') < date(?, '+1 day')
        `).all(c.hostName, c.badDay, c.badDay) as { url: string; firestoreId: string | null; title: string; time: string }[];
        const stale = rows.filter((r) => !valid.has(norm(r.url)));
        console.log(`\n${c.hostName} ${c.badDay}: ${rows.length} i klustret, ${valid.size} giltiga URL:er från motorn → ${stale.length} att dölja, ${rows.length - stale.length} behålls`);
        for (const r of rows) console.log(`  ${stale.includes(r) ? '🙈' : '✅'} ${r.title.slice(0, 60)}`);
        if (!APPLY) continue;
        for (const r of stale) {
            setHidden(r.url, true);
            // Dokument som redan är borta i Firestore (spegeln släpar) → bara SQLite.
            if (r.firestoreId) {
                try { await db!.collection('linkEvents').doc(r.firestoreId).update(stamped({ hidden: true })); }
                catch (err) { if ((err as { code?: number }).code !== 5) throw err; }
            }
            hidden++;
        }
    }
    sqlite.close();
    console.log(APPLY ? `\n✅ ${hidden} dolda.` : '\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
