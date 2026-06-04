/**
 * Källors hälsa — visar trender och regressioner från scrape_runs-tabellen.
 *
 * Tre kategorier:
 *   🟢 STABLE   ≥3 senaste körningarna hade ≥1 saved och inga errors
 *   🟡 WATCH    funkar oftast men senaste körningen sämre än snittet
 *   🔴 BROKEN   0 saved senaste körningen + 0 saved snitt-7d (eller errors)
 *
 * Användning:
 *   npm run health
 *   npm run health -- --json          # för dashboards
 *   npm run health -- --since=7d      # period (default 14d)
 */

import path from 'path';
import Database from 'better-sqlite3';
import { SOURCES } from '../sources/registry';
// Import säkerställer att scrape_runs-tabellen skapas innan vi queryar den
import '../utils/sqliteHelper';

const args = (() => {
    const out: any = { since: '14d' };
    for (const a of process.argv.slice(2)) {
        if (a === '--json') out.json = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

const sinceDays = parseInt(String(args.since).replace('d', ''), 10) || 14;

interface RunRow {
    started_at: string;
    duration_ms: number;
    found: number;
    saved: number;
    error_count: number;
    first_error: string | null;
}

interface SourceStat {
    sourceId: string;
    hostName: string;
    registered: boolean;          // finns i SOURCES.ts (annars är det legacy/bespoke)
    disabled: boolean;
    runs: number;
    lastRun: string | null;
    lastSaved: number | null;
    lastErrors: number | null;
    avgSaved7d: number;
    maxSaved: number;
    consecutiveZero: number;      // antal körningar i rad med saved=0
    consecutiveErrors: number;    // antal körningar i rad med errors > 0
    firstError?: string;
    status: '🟢 STABLE' | '🟡 WATCH' | '🔴 BROKEN' | '⚪ NEW';
    note: string;
}

function classify(s: SourceStat): SourceStat {
    let status: SourceStat['status'] = '⚪ NEW';
    let note = '';

    if (s.runs === 0) {
        status = '⚪ NEW';
        note = 'Aldrig körd';
    } else if (s.consecutiveErrors >= 3 || (s.lastSaved === 0 && s.avgSaved7d < 1)) {
        status = '🔴 BROKEN';
        note = s.consecutiveErrors >= 3
            ? `${s.consecutiveErrors} körningar i rad med fel`
            : `0 saved senaste, snitt 7d: ${s.avgSaved7d.toFixed(1)}`;
    } else if (s.lastSaved !== null && s.lastErrors !== null) {
        const dropRatio = s.avgSaved7d > 0 ? s.lastSaved / s.avgSaved7d : 1;
        if (s.lastErrors > 0) {
            status = '🟡 WATCH';
            note = `${s.lastErrors} errors senaste körningen`;
        } else if (dropRatio < 0.5 && s.avgSaved7d >= 3) {
            status = '🟡 WATCH';
            note = `Saved tappade ${Math.round((1 - dropRatio) * 100)}% mot snittet`;
        } else if (s.runs >= 3 && s.consecutiveZero === 0) {
            status = '🟢 STABLE';
            note = `${s.runs} körningar, snitt ${s.avgSaved7d.toFixed(1)} saved`;
        } else {
            status = '🟡 WATCH';
            note = `${s.runs} körningar, otillräcklig historik`;
        }
    }

    return { ...s, status, note };
}

function main() {
    const db = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();

    // Hämta alla unika källor som loggat åtminstone en körning
    const sourceIds = (db.prepare(`SELECT DISTINCT source_id, host_name FROM scrape_runs WHERE started_at >= ?`)
        .all(cutoff) as { source_id: string; host_name: string }[]);

    // Plus alla källor i registry (även om de aldrig kört)
    const registryIds = new Map(SOURCES.map(s => [s.id, s]));
    for (const s of SOURCES) {
        if (!sourceIds.find(x => x.source_id === s.id)) {
            sourceIds.push({ source_id: s.id, host_name: s.hostName });
        }
    }

    const stats: SourceStat[] = sourceIds.map(({ source_id, host_name }) => {
        const runs = db.prepare(`
            SELECT started_at, duration_ms, found, saved, error_count, first_error
            FROM scrape_runs
            WHERE source_id = ? AND started_at >= ?
            ORDER BY started_at DESC
        `).all(source_id, cutoff) as RunRow[];

        const reg = registryIds.get(source_id);
        const last = runs[0];

        // Räkna konsekutiv-streaks från senaste körning bakåt
        let consecutiveZero = 0;
        let consecutiveErrors = 0;
        for (const r of runs) {
            if (r.saved === 0) consecutiveZero++; else break;
        }
        for (const r of runs) {
            if (r.error_count > 0) consecutiveErrors++; else break;
        }

        const last7d = runs.slice(0, 7);
        const avgSaved7d = last7d.length > 0
            ? last7d.reduce((s, r) => s + r.saved, 0) / last7d.length : 0;
        const maxSaved = runs.reduce((m, r) => Math.max(m, r.saved), 0);

        const stat: SourceStat = {
            sourceId: source_id,
            hostName: host_name,
            registered: !!reg,
            disabled: reg?.disabled ?? false,
            runs: runs.length,
            lastRun: last?.started_at ?? null,
            lastSaved: last?.saved ?? null,
            lastErrors: last?.error_count ?? null,
            avgSaved7d,
            maxSaved,
            consecutiveZero,
            consecutiveErrors,
            firstError: last?.first_error ?? undefined,
            status: '⚪ NEW',
            note: '',
        };
        return classify(stat);
    });

    // Sortera efter status (BROKEN först, sen STABLE, sen NEW)
    const order = { '🔴 BROKEN': 0, '🟡 WATCH': 1, '🟢 STABLE': 2, '⚪ NEW': 3 };
    stats.sort((a, b) => order[a.status] - order[b.status] || b.avgSaved7d - a.avgSaved7d);

    if (args.json) {
        console.log(JSON.stringify(stats, null, 2));
        process.exit(0);
    }

    // Pretty output
    const summary = {
        broken: stats.filter(s => s.status === '🔴 BROKEN').length,
        watch:  stats.filter(s => s.status === '🟡 WATCH').length,
        stable: stats.filter(s => s.status === '🟢 STABLE').length,
        new:    stats.filter(s => s.status === '⚪ NEW').length,
    };
    console.log(`\nScraping-hälsa (senaste ${sinceDays} dagar)\n`);
    console.log(`  🔴 BROKEN  ${summary.broken}    🟡 WATCH  ${summary.watch}    🟢 STABLE ${summary.stable}    ⚪ NEW  ${summary.new}\n`);

    console.log('Källa                          Status     Runs  Last  Snitt   Note');
    console.log('─'.repeat(110));
    for (const s of stats) {
        const lastStr = s.lastRun ? new Date(s.lastRun).toISOString().slice(5, 16).replace('T', ' ') : '-';
        const id = (s.sourceId + (s.disabled ? ' (disabled)' : '')).padEnd(30);
        const runs = String(s.runs).padStart(4);
        const last = String(s.lastSaved ?? '-').padStart(4);
        const avg = s.avgSaved7d.toFixed(1).padStart(5);
        console.log(`${id} ${s.status}  ${runs}  ${lastStr}  ${avg}   ${s.note}`);
        if (s.status === '🔴 BROKEN' && s.firstError) {
            console.log(`${' '.repeat(48)}└─ "${s.firstError.slice(0, 60)}..."`);
        }
    }
    console.log('');
    process.exit(0);
}

main();
