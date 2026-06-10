/**
 * Källa-inventarium — hela registret grupperat på livscykel-status.
 *
 * Svarar på "vilka scrapers HAR vi, och vad är statusen?". Skiljer sig från:
 *   - `health`   — härleder STABLE/WATCH/BROKEN ur körhistorik (scrape_runs)
 *   - `coverage` — kommun-täckning (vilka av 290 kommuner vi når)
 * Det här visar vår MEDVETNA klassning (Source.status) + senaste utfall.
 *
 * Status:
 *   🟢 active        — i rotation (default)
 *   🧪 experimental  — tillagd men underpresterar; utveckla vidare
 *   ⚰️  dead          — bevisat tom, hoppas över (körs aldrig)
 *
 * Användning:
 *   npm run sources-list                 # allt, grupperat
 *   npm run sources-list -- --status=experimental
 *   npm run sources-list -- --engine=sitemap
 *   npm run sources-list -- --json
 */

import path from 'path';
import Database from 'better-sqlite3';
import { SOURCES } from '../sources/registry';
import '../utils/sqliteHelper'; // säkerställer scrape_runs

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--json') out.json = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

type Status = 'active' | 'experimental' | 'dead';
const statusOf = (s: { status?: Status }): Status => s.status ?? 'active';

const ICON: Record<Status, string> = { active: '🟢', experimental: '🧪', dead: '⚰️ ' };
const ORDER: Status[] = ['active', 'experimental', 'dead'];

interface LastRun { saved: number; found: number; started_at: string; error_count: number; }

function loadLastRuns(): Map<string, LastRun> {
    const map = new Map<string, LastRun>();
    try {
        const db = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
        const rows = db.prepare(`
            SELECT source_id, saved, found, started_at, error_count
            FROM scrape_runs r1
            WHERE started_at = (
                SELECT MAX(started_at) FROM scrape_runs r2 WHERE r2.source_id = r1.source_id
            )
        `).all() as (LastRun & { source_id: string })[];
        for (const r of rows) map.set(r.source_id, r);
        db.close();
    } catch { /* ingen db än — kör utan utfall */ }
    return map;
}

function main() {
    const lastRuns = loadLastRuns();

    let sources = SOURCES.slice();
    if (args.status) sources = sources.filter((s) => statusOf(s) === args.status);
    if (args.engine) sources = sources.filter((s) => s.engine === args.engine);
    if (args.region) sources = sources.filter((s) => s.region === args.region);

    if (args.json) {
        const out = sources.map((s) => ({
            id: s.id, hostName: s.hostName, engine: s.engine, region: s.region,
            status: statusOf(s), updateFrequency: s.updateFrequency ?? 'daily',
            lastVerified: s.lastVerified, lastRun: lastRuns.get(s.id) ?? null, notes: s.notes,
        }));
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    // Gruppera på status
    const byStatus: Record<Status, typeof sources> = { active: [], experimental: [], dead: [] };
    for (const s of sources) byStatus[statusOf(s)].push(s);

    const total = sources.length;
    console.log(`\n📋 KÄLLA-INVENTARIUM — ${total} källor\n`);

    for (const st of ORDER) {
        const group = byStatus[st];
        if (group.length === 0) continue;
        console.log(`${ICON[st]} ${st.toUpperCase()} (${group.length})`);
        group.sort((a, b) => a.hostName.localeCompare(b.hostName, 'sv'));
        for (const s of group) {
            const lr = lastRuns.get(s.id);
            const yield_ = lr ? `${lr.saved}/${lr.found}` : '—';
            const freq = (s.updateFrequency ?? 'daily').padEnd(8);
            console.log(`   ${s.id.padEnd(28)} ${s.engine.padEnd(10)} ${freq} senast: ${yield_.padStart(8)}  ${s.hostName}`);
        }
        console.log('');
    }

    // Sammanfattning per status × engine
    console.log('── Sammanfattning ──');
    for (const st of ORDER) {
        const group = byStatus[st];
        if (group.length === 0) continue;
        const byEngine = group.reduce<Record<string, number>>((acc, s) => {
            acc[s.engine] = (acc[s.engine] || 0) + 1; return acc;
        }, {});
        const eng = Object.entries(byEngine).map(([e, n]) => `${e}=${n}`).join(', ');
        console.log(`  ${ICON[st]} ${st.padEnd(13)} ${String(group.length).padStart(3)}   (${eng})`);
    }
    console.log('');
}

main();
