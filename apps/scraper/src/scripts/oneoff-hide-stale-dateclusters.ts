/**
 * Engångs (28/9 2026): dölj event som ligger kvar på ett FELAKTIGT datumkluster
 * efter motorfixarna för Malmö Live och Havremagasinet.
 *
 *   - malmo-live:     sajtbannerns "3 oktober … Malmö Marathon" gav 64 passerade
 *                     konserter datumet 2026-10-03.
 *   - havremagasinet: "Andra event"-kortens "10 okt." gav 47 gamla sidor 2026-10-10.
 *
 * 12/10 2026 (de två ovan är redan körda, därför borta ur CLUSTERS):
 *   - stora-teatern-gbg: "På gång"-hjulets "15 okt 2026" på passerade
 *                        föreställningar (70 av 106 på 2026-10-15).
 *   - olm:               "Mer i kalendern"-puffens "26 oktober" (14 av 19).
 *   - artipelag:         "Mer på gång"-kortets "31 okt 2026" på gamla
 *                        utställningar (20 av 20 på 2026-10-31).
 *
 * Refresh-vägen (SCRAPE_FORCE_REFRESH=1 / contentSweep) rättar bara URL:er som
 * den fixade motorn fortfarande daterar INOM fönstret — runnern hoppar över
 * resten innan refreshen. Passerade konserter/gamla sidor står annars kvar på
 * fel dag. Skriptet kör den fixade motorn och döljer klustrets event som
 * motorn inte längre returnerar ELLER nu daterar till en passerad dag (de
 * fixade motorerna 12/10 returnerar passerade sidor med sitt riktiga datum).
 * Event som motorn flyttar till en ANNAN kommande dag lämnas åt refreshen.
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
    { sourceId: 'stora-teatern-gbg', hostName: 'Stora Teatern', badDay: '2026-10-15' },
    { sourceId: 'olm', hostName: 'Örebro läns museum', badDay: '2026-10-26' },
    { sourceId: 'artipelag', hostName: 'Artipelag', badDay: '2026-10-31' },
];

const norm = (u: string) => u.replace(/\/+$/, '');

/** URL → motorns (fixade) startdatum för allt källan returnerar just nu. */
async function engineDates(sourceId: string): Promise<Map<string, Date>> {
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
    return new Map(events.map((e) => [norm(e.url), e.startDate]));
}

async function main() {
    const sqlite = new Database(DB_PATH, { readonly: true });
    let hidden = 0;
    for (const c of CLUSTERS) {
        const dates = await engineDates(c.sourceId);
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const valid = new Set([...dates].filter(([, d]) => d >= todayStart).map(([u]) => u));
        // time lagras i UTC — lokal dag 3/10 = UTC 2/10 22:00 … 3/10 21:59.
        const rows = sqlite.prepare(`
            SELECT url, firestoreId, title, time FROM link_events
            WHERE hostName = ? AND hidden = 0
              AND datetime(time, 'localtime') >= ? AND datetime(time, 'localtime') < date(?, '+1 day')
        `).all(c.hostName, c.badDay, c.badDay) as { url: string; firestoreId: string | null; title: string; time: string }[];
        const stale = rows.filter((r) => !valid.has(norm(r.url)));
        console.log(`\n${c.hostName} ${c.badDay}: ${rows.length} i klustret, ${valid.size} kommande URL:er från motorn → ${stale.length} att dölja, ${rows.length - stale.length} behålls`);
        for (const r of rows) {
            const d = dates.get(norm(r.url));
            console.log(`  ${stale.includes(r) ? '🙈' : '✅'} ${r.title.slice(0, 60)} → ${d ? d.toISOString().slice(0, 16) : 'ej i motorn'}`);
        }
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
