/**
 * check-invariants.ts — nattlig datainvariant-vakt: granskar FÖRDELNINGEN av
 * publicerbara framtida event per källa i lokala SQLite-spegeln och larmar på
 * mönster som är osynliga per event (ren logik + trösklar i utils/invariants.ts).
 *
 *   npm run invariants              # granska + logga till invariant_runs
 *   npm run invariants -- --report  # skriv även hela metrik-tabellen
 *
 * Facit-fallet: KB-datumkapningen 29/8 2026 (56 event / 7 unika tidsstämplar)
 * som varken health.ts eller LLM-auditen såg. En `GROUP BY time` hade räckt —
 * det är i princip vad den här vakten kör varje natt.
 *
 * 🚨 INVARIANT:-raderna greppas av run-daily.sh in i Telegram-rapporten.
 * Nollkostnad: läser bara lokala SQLite (inga Firestore-reads). Larmar är
 * gransknings-signaler — vakten döljer/ändrar ALDRIG event själv.
 */

import Database from 'better-sqlite3';
import { getSqlitePath } from '../utils/sqliteHelper';
import {
    computeSourceMetrics, evaluateSource, buildBaseline,
    type InvariantEventRow, type SourceMetrics,
} from '../utils/invariants';

/** Så många tidigare körningar bygger baslinjen (median). */
const BASELINE_RUNS = 14;

function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function main() {
    const report = process.argv.includes('--report');
    const sqlite = new Database(getSqlitePath());
    sqlite.exec(`CREATE TABLE IF NOT EXISTS invariant_runs (
        date                 TEXT NOT NULL,
        host_name            TEXT NOT NULL,
        events               INTEGER NOT NULL,
        clocked_events       INTEGER NOT NULL,
        distinct_times       INTEGER NOT NULL,
        mean_cluster         REAL NOT NULL,
        largest_cluster      INTEGER NOT NULL,
        largest_cluster_time TEXT,
        no_clock_pct         INTEGER NOT NULL,
        top_venue_share      INTEGER NOT NULL,
        top_venue            TEXT,
        alarms               INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, host_name)
    )`);

    // Samma population som aggregate-events.ts exporterar till webben.
    const rows = sqlite.prepare(`
        SELECT hostName, time, hasSpecificTime, locationName
        FROM link_events
        WHERE hidden = 0 AND status = 'published' AND time >= ?
    `).all(new Date().toISOString()) as InvariantEventRow[];

    const metrics = computeSourceMetrics(rows);
    const today = todayISO();

    const historyStmt = sqlite.prepare(`
        SELECT events, clocked_events AS clockedEvents, distinct_times AS distinctTimes,
               mean_cluster AS meanClusterSize,
               largest_cluster AS largestClusterSize, largest_cluster_time AS largestClusterTime,
               no_clock_pct AS noClockPct, top_venue_share AS topVenueShare, top_venue AS topVenue,
               host_name AS hostName
        FROM invariant_runs WHERE host_name = ? AND date < ?
        ORDER BY date DESC LIMIT ${BASELINE_RUNS}
    `);
    const upsert = sqlite.prepare(`
        INSERT OR REPLACE INTO invariant_runs
        (date, host_name, events, clocked_events, distinct_times, mean_cluster,
         largest_cluster, largest_cluster_time, no_clock_pct, top_venue_share, top_venue, alarms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let alarmCount = 0;
    let infoCount = 0;
    const writeAll = sqlite.transaction((all: Array<{ m: SourceMetrics; alarms: number }>) => {
        for (const { m, alarms } of all) {
            upsert.run(today, m.hostName, m.events, m.clockedEvents, m.distinctTimes,
                m.meanClusterSize, m.largestClusterSize, m.largestClusterTime, m.noClockPct,
                m.topVenueShare, m.topVenue, alarms);
        }
    });

    const results: Array<{ m: SourceMetrics; alarms: number }> = [];
    for (const m of metrics) {
        const history = historyStmt.all(m.hostName, today) as SourceMetrics[];
        const findings = evaluateSource(m, buildBaseline(history));
        const alarms = findings.filter((f) => f.level === 'alarm');
        for (const f of alarms) console.log(`🚨 INVARIANT: ${f.message}`);
        infoCount += findings.length - alarms.length;
        alarmCount += alarms.length;
        results.push({ m, alarms: alarms.length });

        if (report) {
            // Info-fynd (venue-koncentration m.m.) bara här — 100 % samma venue
            // är NORMALT för bibliotek/församlingar och dränker nattloggen.
            for (const f of findings.filter((f) => f.level === 'info')) console.log(`   ℹ️ ${f.message}`);
            console.log(`   ${m.hostName.slice(0, 30).padEnd(30)} ${String(m.events).padStart(4)} event  ` +
                `${String(m.distinctTimes).padStart(4)} tider (snitt ${m.meanClusterSize.toFixed(1)})  ` +
                `kluster ${m.largestClusterSize}  utan-klockslag ${m.noClockPct} %`);
        }
    }
    writeAll(results);
    sqlite.close();

    console.log(`Invariantvakt-summering: ${metrics.length} källor granskade (${rows.length} framtida event), ${alarmCount} larm, ${infoCount} info`);
}

main();
