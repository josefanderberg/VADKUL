/**
 * scraper-alerts.ts — samlar nattens skrapproblem i scraper-alerts.json.
 *
 *   npm run alerts          # skriv filen + sammanfattning
 *
 * Nattkedjan kör den efter invariant-vakten och pushar filen (whitelist i
 * run-daily.sh). Rotens `npm run dev` skriver ut den (scripts/print-alerts.mjs)
 * så problem syns på arbetsmaskinen utan att någon läser Telegram-rapporten.
 * Logiken bor i utils/scraperAlerts.ts. Läser bara lokala SQLite — noll
 * Firestore-reads.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { getSqlitePath } from '../utils/sqliteHelper';
import { SOURCES } from '../sources/registry';
import {
    detectRunProblems, detectDayClusters, detectNullIsland, quarantineAlerts, sortAlerts,
    type Alert, type RunRow,
} from '../utils/scraperAlerts';

const OUT_PATH = path.resolve(__dirname, '../../scraper-alerts.json');
const QUARANTINE_PATH = path.resolve(__dirname, '../../quarantine.json');

function main() {
    const sqlite = new Database(getSqlitePath(), { readonly: true });

    let quarantine: Record<string, { since?: string; reason?: string }> = {};
    try { quarantine = JSON.parse(fs.readFileSync(QUARANTINE_PATH, 'utf-8')).sources ?? {}; } catch { /* ingen fil */ }
    const disabled = new Set(SOURCES.filter((s) => s.disabled || (s as { status?: string }).status === 'dead').map((s) => s.id));
    const skip = new Set([...disabled, ...Object.keys(quarantine)]);

    // 1. Körhistorik (30 dagar, nyast först per källa).
    const runs = sqlite.prepare(`
        SELECT source_id, host_name, started_at, found, skipped_duplicate, error_count, first_error
        FROM scrape_runs WHERE started_at >= datetime('now', '-30 days')
        ORDER BY source_id, started_at DESC
    `).all() as RunRow[];
    const bySource = new Map<string, RunRow[]>();
    for (const r of runs) {
        const list = bySource.get(r.source_id) ?? [];
        list.push(r);
        bySource.set(r.source_id, list);
    }

    // 2. Kommande synliga event (30 d) — datumkluster och 0,0.
    const upcoming = sqlite.prepare(`
        SELECT hostName AS host, date(time, 'localtime') AS day, lat, lng
        FROM link_events
        WHERE hidden = 0 AND time >= datetime('now') AND time < datetime('now', '+30 days')
    `).all() as { host: string | null; day: string; lat: number | null; lng: number | null }[];
    const withHost = upcoming.filter((r) => r.host) as { host: string; day: string; lat: number | null; lng: number | null }[];
    const nullIsland = detectNullIsland(
        withHost.filter((r) => Math.abs(r.lat ?? 0) < 0.01 && Math.abs(r.lng ?? 0) < 0.01).map((r) => r.host),
    );

    // 3. Invariant-vaktens larm från senaste körningen.
    let invariantAlerts: Alert[] = [];
    try {
        invariantAlerts = (sqlite.prepare(`
            SELECT host_name, largest_cluster, events FROM invariant_runs
            WHERE alarms > 0 AND date = (SELECT max(date) FROM invariant_runs)
        `).all() as { host_name: string; largest_cluster: number; events: number }[]).map((r) => ({
            level: 'varning' as const, kind: 'invariant' as const, source: r.host_name,
            message: `invariant-vakten larmar (${r.largest_cluster} av ${r.events} event på samma tidsstämpel) — se nattloggen`,
        }));
    } catch { /* tabellen finns inte än */ }
    sqlite.close();

    const alerts = sortAlerts([
        ...detectRunProblems(bySource, skip),
        ...detectDayClusters(withHost),
        ...nullIsland.alerts,
        ...invariantAlerts,
        ...quarantineAlerts(quarantine),
    ]);

    const counts = {
        fel: alerts.filter((a) => a.level === 'fel').length,
        varning: alerts.filter((a) => a.level === 'varning').length,
        nollkoordinatTotalt: nullIsland.total,
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), counts, alerts }, null, 2) + '\n', 'utf-8');

    for (const a of alerts) console.log(`${a.level === 'fel' ? '❌' : '⚠️ '} [${a.kind}] ${a.source}: ${a.message}`);
    // Raden greppas av run-daily.sh in i Telegram-rapporten.
    console.log(`Scraperlarm-summering: ${counts.fel} fel, ${counts.varning} varningar, ${counts.nollkoordinatTotalt} event på 0,0`);
}

main();
