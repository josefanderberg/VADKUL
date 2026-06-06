/**
 * show-runs — visa körningshistorik från scrape_runs-tabellen.
 *
 * Användning:
 *   npm run runs                    # summering per source (senaste körning + totaler)
 *   npm run runs -- --recent [N]    # senaste N körningar (default 30), tidslinje
 *   npm run runs -- --source <id>   # detaljer för en specifik source (senaste 20)
 *   npm run runs -- --errors        # visa bara körningar med fel
 */

import { getRecentRuns, getRunsBySource, getSourceStats, ScrapeRunRecord } from '../utils/sqliteHelper';

const args = process.argv.slice(2);

function flag(name: string): boolean {
    return args.includes(name);
}

function flagValue(name: string): string | undefined {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : undefined;
}

function fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}

function fmtDate(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusIcon(r: ScrapeRunRecord): string {
    if (r.error_count > 0) return '⚠️ ';
    if (r.saved > 0)       return '✅ ';
    return '○  ';
}

function printRun(r: ScrapeRunRecord): void {
    const errors = r.errors_json ? (JSON.parse(r.errors_json) as string[]) : [];
    console.log(
        `${statusIcon(r)}${fmtDate(r.started_at)}  ` +
        `${r.source_id.padEnd(32)} ` +
        `saved=${String(r.saved).padStart(4)}  ` +
        `found=${String(r.found).padStart(4)}  ` +
        `dup=${String(r.skipped_duplicate).padStart(3)}  ` +
        `hidden=${String(r.hidden_count).padStart(3)}  ` +
        `err=${r.error_count}  ` +
        `${fmtDuration(r.duration_ms)}`
    );
    for (const e of errors) {
        console.log(`   └─ ${e}`);
    }
}

// ─── --source <id> ──────────────────────────────────────────────────────────

const sourceId = flagValue('--source');
if (sourceId) {
    const limit = parseInt(flagValue('--limit') ?? '20', 10);
    const runs = getRunsBySource(sourceId, limit);
    if (runs.length === 0) {
        console.log(`Inga körningar hittades för source: ${sourceId}`);
        process.exit(0);
    }
    console.log(`\n=== ${sourceId} — senaste ${runs.length} körningar ===\n`);
    for (const r of runs) printRun(r);
    process.exit(0);
}

// ─── --recent [N] ───────────────────────────────────────────────────────────

if (flag('--recent')) {
    const limit = parseInt(flagValue('--recent') ?? '30', 10) || 30;
    const runs = getRecentRuns(limit);
    const filtered = flag('--errors') ? runs.filter(r => r.error_count > 0) : runs;
    console.log(`\n=== Senaste ${filtered.length} körningar ===\n`);
    for (const r of filtered) printRun(r);
    process.exit(0);
}

// ─── Default: summering per source ──────────────────────────────────────────

const stats = getSourceStats();

if (stats.length === 0) {
    console.log('Inga körningar i databasen ännu.');
    process.exit(0);
}

const onlyErrors = flag('--errors');
const rows = onlyErrors ? stats.filter(s => s.total_errors > 0) : stats;

console.log(`\n=== Source-summering (${rows.length} sources${onlyErrors ? ', med fel' : ''}) ===\n`);
console.log(
    'SOURCE'.padEnd(34) +
    'RUNS'.padStart(5) +
    '  LAST RUN            ' +
    'SAVED'.padStart(7) +
    '  ERRORS'
);
console.log('─'.repeat(80));

for (const s of rows) {
    const errMark = s.total_errors > 0 ? ` ⚠️  ${s.total_errors}` : '    0';
    console.log(
        s.source_id.padEnd(34) +
        String(s.runs).padStart(5) +
        '  ' + fmtDate(s.last_run).padEnd(20) +
        String(s.total_saved).padStart(7) +
        errMark
    );
}

console.log('─'.repeat(80));
const totalRuns  = rows.reduce((a, s) => a + s.runs, 0);
const totalSaved = rows.reduce((a, s) => a + s.total_saved, 0);
const totalErr   = rows.reduce((a, s) => a + s.total_errors, 0);
console.log(
    'TOTAL'.padEnd(34) +
    String(totalRuns).padStart(5) +
    '  ' + ' '.repeat(20) +
    String(totalSaved).padStart(7) +
    `    ${totalErr}`
);
console.log();
