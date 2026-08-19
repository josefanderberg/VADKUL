/**
 * auto-quarantine.ts — nattkedjans karantän-utvärdering (körs EFTER scrapersteget).
 *
 *   npm run quarantine            # utvärdera + skriv quarantine.json
 *   npm run quarantine -- --dry   # visa vad som skulle hända, skriv inget
 *
 * Regler:
 *   IN:  källans senaste EMPTY_STREAK körningar var alla helt tomma
 *        (found=0, skipped_duplicate=0, skipped_outside_window=0) — dvs.
 *        scrapern ser ingenting alls; sidan är trolig trasig/flyttad.
 *        Friska-men-tysta källor (found>0, saved=0 = bara dubbletter) rörs ej.
 *   UT:  en karantänsatt källa vars senaste körning (vecko-retryn) såg liv
 *        (found>0 eller skips>0) släpps ut igen.
 *   KVAR: tom retry ⇒ lastRetry uppdateras, emptyRetries++ (nästa retry om 7d).
 *
 * Loggmarkörer (greppas av run-daily.sh till Teams-kortet):
 *   ⏸️ KARANTÄN: <id> — <skäl>
 *   ▶️ SLÄPPT: <id> — <skäl>
 */

import path from 'path';
import Database from 'better-sqlite3';
import { SOURCES } from '../sources/registry';
import {
    loadQuarantine, saveQuarantine, todayISO, QuarantineEntry,
} from '../sources/quarantine';
// Säkerställer att scrape_runs finns innan vi queryar
import { getSqlitePath } from '../utils/sqliteHelper';

const EMPTY_STREAK = 4;

interface RunRow {
    found: number;
    skipped_duplicate: number;
    skipped_outside_window: number;
    error_count: number;
    started_at: string;
}

function isEmptyRun(r: RunRow): boolean {
    return r.found === 0 && r.skipped_duplicate === 0 && r.skipped_outside_window === 0;
}

function main() {
    const dry = process.argv.includes('--dry');
    const db = new Database(getSqlitePath(), { readonly: true });
    const lastRuns = db.prepare(`
        SELECT found, skipped_duplicate, skipped_outside_window, error_count, started_at
        FROM scrape_runs WHERE source_id = ?
        ORDER BY started_at DESC LIMIT ?
    `);

    const q = loadQuarantine();
    const today = todayISO();
    const added: string[] = [];
    const released: string[] = [];
    const stillHeld: string[] = [];

    const eligible = SOURCES.filter((s) => !s.disabled && s.status !== 'dead');
    const byId = new Map(eligible.map((s) => [s.id, s]));

    // ── UT/KVAR: utvärdera befintlig karantän ────────────────────────────
    for (const [id, entry] of Object.entries(q.sources)) {
        if (!byId.has(id)) {
            // Källan borttagen/död/disabled i registryt — städa bort posten
            delete q.sources[id];
            continue;
        }
        const runs = lastRuns.all(id, 1) as RunRow[];
        const last = runs[0];
        if (!last) { stillHeld.push(id); continue; }
        // Hände en körning efter att källan sattes/senast retryades?
        const anchor = entry.lastRetry ?? entry.since;
        const ranSince = last.started_at.slice(0, 10) > anchor;
        if (!ranSince) { stillHeld.push(id); continue; }
        if (!isEmptyRun(last)) {
            delete q.sources[id];
            released.push(id);
            console.log(`▶️ SLÄPPT: ${id} — retry såg liv (found=${last.found}, skips=${last.skipped_duplicate + last.skipped_outside_window})`);
        } else {
            entry.lastRetry = today;
            entry.emptyRetries = (entry.emptyRetries ?? 0) + 1;
            stillHeld.push(id);
            console.log(`  kvar i karantän: ${id} (tom retry #${entry.emptyRetries})`);
        }
    }

    // ── IN: leta nya kandidater ──────────────────────────────────────────
    for (const s of eligible) {
        if (q.sources[s.id]) continue;
        const runs = lastRuns.all(s.id, EMPTY_STREAK) as RunRow[];
        if (runs.length < EMPTY_STREAK) continue;           // för ny för att döma
        if (!runs.every(isEmptyRun)) continue;
        const errs = runs.reduce((n, r) => n + r.error_count, 0);
        const reason = errs > 0
            ? `${EMPTY_STREAK} raka tomma körningar (${errs} fel)`
            : `${EMPTY_STREAK} raka tomma körningar (found=0, inga skips)`;
        const entry: QuarantineEntry = { since: today, reason };
        q.sources[s.id] = entry;
        added.push(s.id);
        console.log(`⏸️ KARANTÄN: ${s.id} — ${reason}`);
    }

    db.close();

    console.log('');
    console.log(`Karantän-summering: +${added.length} nya, ${released.length} släppta, ${stillHeld.length} kvar (totalt ${Object.keys(q.sources).length})`);
    if (dry) {
        console.log('(dry-run — quarantine.json orörd)');
        return;
    }
    saveQuarantine(q);
    console.log(`Skrev ${path.relative(process.cwd(), require('../sources/quarantine').QUARANTINE_PATH)}`);
}

main();
