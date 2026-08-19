/**
 * cost-guard.ts — nattlig kostnadsvakt: snapshotar varje Firestore-kollektions
 * dokumentantal (count()-aggregat, ~1 read per 1000 docs) i lokala SQLite:n
 * och VARNAR när något börjar spåra iväg — regressionsskyddet efter
 * egress-incidenten aug-26 och eventReminders-svullnaden (46 920 döda docs).
 *
 *   npm run cost-guard            # snapshot + varningar
 *   npm run cost-guard -- --report  # skriv även hela tabellen
 *
 * Varningsregler:
 *   1. TILLVÄXT: > +25 % OCH > +1000 docs sedan jämförelsepunkten
 *      (7 dagar bakåt, eller äldsta snapshot om historiken är yngre).
 *   2. TAK: absoluta gränser per kollektion (CAPS) — bounded by design;
 *      spräcks taket är något trasigt eller behöver medvetet höjas här.
 *
 * ⚠️-raderna greppas av run-daily.sh in i nattens Teams-kort — det är
 * "webhooken" som larmar innan kostnaden hinner bli en faktura.
 */

import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { getSqlitePath } from '../utils/sqliteHelper';

/** Absoluta tak. Kollektioner utan egen rad använder DEFAULT_CAP. */
const CAPS: Record<string, number> = {
    linkEvents: 60_000,        // ~33k idag; 60k ⇒ fönstret/cleanup har slutat städa
    eventStats: 40_000,        // ~11k idag; växer med visade event
    eventReminders: 2_000,     // ska vara nära noll efter 2026-08-19-fixen
    eventReminderSends: 5_000,
    eventReminderPrefs: 5_000,
    geocodeCache: 100_000,
    notifications: 10_000,
    territory: 20_000,
};
const DEFAULT_CAP = 100_000;
const GROWTH_FACTOR = 1.25;
const GROWTH_MIN_DOCS = 1_000;
const COMPARE_DAYS_BACK = 7;

function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
    const report = process.argv.includes('--report');
    const fdb = db!;
    const sqlite = new Database(getSqlitePath());
    sqlite.exec(`CREATE TABLE IF NOT EXISTS usage_snapshots (
        date       TEXT NOT NULL,
        collection TEXT NOT NULL,
        docs       INTEGER NOT NULL,
        PRIMARY KEY (date, collection)
    )`);

    const today = todayISO();
    const collections = await fdb.listCollections();
    const counts: Record<string, number> = {};
    for (const c of collections) {
        const snap = await c.count().get();
        counts[c.id] = snap.data().count;
    }

    const upsert = sqlite.prepare('INSERT OR REPLACE INTO usage_snapshots (date, collection, docs) VALUES (?, ?, ?)');
    const tx = sqlite.transaction(() => {
        for (const [id, n] of Object.entries(counts)) upsert.run(today, id, n);
    });
    tx();

    // Jämförelsepunkt: senaste snapshot ≥ COMPARE_DAYS_BACK dagar bakåt,
    // annars äldsta som finns (dock aldrig dagens egna).
    const prevRow = (coll: string): { date: string; docs: number } | undefined =>
        (sqlite.prepare(`
            SELECT date, docs FROM usage_snapshots
            WHERE collection = ? AND date < ?
              AND date <= date(?, '-' || ? || ' days')
            ORDER BY date DESC LIMIT 1
        `).get(coll, today, today, COMPARE_DAYS_BACK)
        ?? sqlite.prepare(`
            SELECT date, docs FROM usage_snapshots
            WHERE collection = ? AND date < ?
            ORDER BY date ASC LIMIT 1
        `).get(coll, today)) as { date: string; docs: number } | undefined;

    let warnings = 0;
    let totalDocs = 0;
    for (const [id, n] of Object.entries(counts).sort(([, a], [, b]) => b - a)) {
        totalDocs += n;
        const cap = CAPS[id] ?? DEFAULT_CAP;
        if (n > cap) {
            warnings++;
            console.log(`⚠️ KOSTNADSVAKT: ${id} över taket — ${n} docs (tak ${cap}). Trasig städning eller höj taket medvetet i cost-guard.ts.`);
        }
        const prev = prevRow(id);
        if (prev && n > prev.docs * GROWTH_FACTOR && n - prev.docs > GROWTH_MIN_DOCS) {
            warnings++;
            console.log(`⚠️ KOSTNADSVAKT: ${id} växer snabbt — ${prev.docs} → ${n} sedan ${prev.date} (+${Math.round(((n - prev.docs) / prev.docs) * 100)}%).`);
        }
        if (report) console.log(`   ${id.padEnd(24)} ${String(n).padStart(8)}${prev ? `  (${prev.date}: ${prev.docs})` : ''}`);
    }

    sqlite.close();
    console.log(`Kostnadsvakt-summering: ${Object.keys(counts).length} kollektioner, ${totalDocs} docs totalt, ${warnings} varningar`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('⚠️ KOSTNADSVAKT-FEL:', e); process.exit(1); });
