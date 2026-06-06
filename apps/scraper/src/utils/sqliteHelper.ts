import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Lokal SQLite-spegel av `linkEvents`. Skriver parallellt med Firestore så vi
 * alltid har en lokal upplaga (för Mac Mini-körningar utan nätberoende, snabba
 * queries, och som källa när vi byter ut Firestore framöver).
 *
 * DB-fil: apps/scraper/events.db (övergripande för alla DB_TARGETs — lokal SQLite
 * är samma oavsett om Firestore pekar mot prod/emulator).
 * Kan overridas med env SCRAPER_SQLITE_PATH.
 */

const dbPath = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

// Säkerställ att katalogen finns
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

sqlite.exec(`
    CREATE TABLE IF NOT EXISTS link_events (
        url                  TEXT PRIMARY KEY,
        title                TEXT,
        time                 TEXT,           -- ISO-8601
        locationName         TEXT,
        extractedAddress     TEXT,
        geocodedQuery        TEXT,
        lat                  REAL,
        lng                  REAL,
        hostName             TEXT,
        category             TEXT,
        coverImage           TEXT,
        description          TEXT,
        attendees            INTEGER,
        createdAt            TEXT,           -- ISO-8601
        isLocationVerified   INTEGER DEFAULT 0,
        isHostVerified       INTEGER DEFAULT 0,
        hidden               INTEGER DEFAULT 0,
        firestoreId          TEXT,
        updatedAt            TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_link_events_time     ON link_events(time);
    CREATE INDEX IF NOT EXISTS idx_link_events_hidden   ON link_events(hidden);
    CREATE INDEX IF NOT EXISTS idx_link_events_verified ON link_events(isLocationVerified);

    -- Run-history: en rad per scraper-körning så vi kan se trender och regressioner.
    CREATE TABLE IF NOT EXISTS scrape_runs (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id                TEXT    NOT NULL,
        host_name                TEXT    NOT NULL,
        started_at               TEXT    NOT NULL,            -- ISO timestamp
        duration_ms              INTEGER,
        found                    INTEGER DEFAULT 0,
        saved                    INTEGER DEFAULT 0,
        skipped_duplicate        INTEGER DEFAULT 0,
        skipped_outside_window   INTEGER DEFAULT 0,
        skipped_invalid          INTEGER DEFAULT 0,
        error_count              INTEGER DEFAULT 0,
        first_error              TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scrape_runs_source     ON scrape_runs(source_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_scrape_runs_started_at ON scrape_runs(started_at);
`);

// Additive migrations — safe to run on existing DBs (ignored if column exists).
function addColumnIfMissing(table: string, column: string, definition: string): void {
    const cols = (sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>).map(r => r.name);
    if (!cols.includes(column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
}

addColumnIfMissing('link_events', 'aiVerdict',    'TEXT');
addColumnIfMissing('link_events', 'aiConfidence', 'TEXT');
addColumnIfMissing('scrape_runs', 'hidden_count', 'INTEGER DEFAULT 0');
addColumnIfMissing('scrape_runs', 'errors_json',  'TEXT');

const insertRunStmt = sqlite.prepare(`
    INSERT INTO scrape_runs (source_id, host_name, started_at, duration_ms,
        found, saved, skipped_duplicate, skipped_outside_window, skipped_invalid,
        error_count, first_error, hidden_count, errors_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export interface ScrapeRunRow {
    sourceId: string;
    hostName: string;
    startedAt: Date;
    durationMs: number;
    found: number;
    saved: number;
    skippedDuplicate: number;
    skippedOutsideWindow: number;
    skippedInvalid: number;
    errorCount: number;
    firstError?: string;
    hiddenCount?: number;
    errors?: string[];
}

export function recordScrapeRun(run: ScrapeRunRow): void {
    try {
        insertRunStmt.run(
            run.sourceId, run.hostName, run.startedAt.toISOString(),
            run.durationMs, run.found, run.saved,
            run.skippedDuplicate, run.skippedOutsideWindow, run.skippedInvalid,
            run.errorCount, run.firstError ?? null,
            run.hiddenCount ?? 0,
            run.errors && run.errors.length > 0 ? JSON.stringify(run.errors) : null,
        );
    } catch (err) {
        console.error('Failed to record scrape run:', err);
    }
}

// ─── Query helpers for show-runs CLI ────────────────────────────────────────

export interface ScrapeRunRecord {
    id: number;
    source_id: string;
    host_name: string;
    started_at: string;
    duration_ms: number;
    found: number;
    saved: number;
    skipped_duplicate: number;
    skipped_outside_window: number;
    skipped_invalid: number;
    error_count: number;
    first_error: string | null;
    hidden_count: number;
    errors_json: string | null;
}

const recentRunsStmt = sqlite.prepare<[number], ScrapeRunRecord>(`
    SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT ?
`);

const runsBySourceStmt = sqlite.prepare<[string, number], ScrapeRunRecord>(`
    SELECT * FROM scrape_runs WHERE source_id = ? ORDER BY started_at DESC LIMIT ?
`);

const sourceStatsStmt = sqlite.prepare<[], { source_id: string; host_name: string; runs: number; last_run: string; total_saved: number; total_errors: number }>(`
    SELECT
        source_id,
        host_name,
        COUNT(*)        AS runs,
        MAX(started_at) AS last_run,
        SUM(saved)      AS total_saved,
        SUM(error_count) AS total_errors
    FROM scrape_runs
    GROUP BY source_id
    ORDER BY last_run DESC
`);

export function getRecentRuns(limit = 50): ScrapeRunRecord[] {
    return recentRunsStmt.all(limit);
}

export function getRunsBySource(sourceId: string, limit = 20): ScrapeRunRecord[] {
    return runsBySourceStmt.all(sourceId, limit);
}

export function getSourceStats(): Array<{ source_id: string; host_name: string; runs: number; last_run: string; total_saved: number; total_errors: number }> {
    return sourceStatsStmt.all();
}

const upsertStmt = sqlite.prepare(`
    INSERT INTO link_events (
        url, title, time, locationName, extractedAddress, geocodedQuery,
        lat, lng, hostName, category, coverImage, description,
        attendees, createdAt, isLocationVerified, isHostVerified, hidden,
        firestoreId, updatedAt
    ) VALUES (
        @url, @title, @time, @locationName, @extractedAddress, @geocodedQuery,
        @lat, @lng, @hostName, @category, @coverImage, @description,
        @attendees, @createdAt, @isLocationVerified, @isHostVerified, @hidden,
        @firestoreId, @updatedAt
    )
    ON CONFLICT(url) DO UPDATE SET
        title              = excluded.title,
        time               = excluded.time,
        locationName       = excluded.locationName,
        extractedAddress   = excluded.extractedAddress,
        geocodedQuery      = excluded.geocodedQuery,
        lat                = excluded.lat,
        lng                = excluded.lng,
        hostName           = excluded.hostName,
        category           = excluded.category,
        coverImage         = excluded.coverImage,
        description        = excluded.description,
        attendees          = excluded.attendees,
        isLocationVerified = excluded.isLocationVerified,
        isHostVerified     = excluded.isHostVerified,
        firestoreId        = COALESCE(excluded.firestoreId, link_events.firestoreId),
        updatedAt          = excluded.updatedAt
`);

const existsStmt    = sqlite.prepare('SELECT 1 FROM link_events WHERE url = ?');
const getByUrlStmt  = sqlite.prepare('SELECT * FROM link_events WHERE url = ?');
const setHiddenStmt = sqlite.prepare('UPDATE link_events SET hidden = ?, updatedAt = ? WHERE url = ?');
const countStmt     = sqlite.prepare('SELECT COUNT(*) AS n FROM link_events');

function toIso(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && typeof (value as any).toDate === 'function') {
        return (value as any).toDate().toISOString();
    }
    return String(value);
}

export interface SqliteEvent {
    url: string;
    title: string;
    time: Date | string;
    locationName?: string;
    extractedAddress?: string;
    geocodedQuery?: string;
    lat?: number;
    lng?: number;
    hostName?: string;
    category?: string;
    coverImage?: string;
    description?: string;
    attendees?: number;
    createdAt?: Date | string;
    isLocationVerified?: boolean;
    isHostVerified?: boolean;
    hidden?: boolean;
    firestoreId?: string;
}

export function upsertEvent(event: SqliteEvent): void {
    upsertStmt.run({
        url:                event.url,
        title:              event.title ?? '',
        time:               toIso(event.time),
        locationName:       event.locationName ?? '',
        extractedAddress:   event.extractedAddress ?? '',
        geocodedQuery:      event.geocodedQuery ?? '',
        lat:                event.lat ?? 0,
        lng:                event.lng ?? 0,
        hostName:           event.hostName ?? '',
        category:           event.category ?? 'other',
        coverImage:         event.coverImage ?? '',
        description:        event.description ?? '',
        attendees:          event.attendees ?? 0,
        createdAt:          toIso(event.createdAt) ?? new Date().toISOString(),
        isLocationVerified: event.isLocationVerified ? 1 : 0,
        isHostVerified:     event.isHostVerified ? 1 : 0,
        hidden:             event.hidden ? 1 : 0,
        firestoreId:        event.firestoreId ?? null,
        updatedAt:          new Date().toISOString(),
    });
}

export function sqliteEventExists(url: string): boolean {
    return !!existsStmt.get(url);
}

export function getSqliteEvent(url: string): any | null {
    return getByUrlStmt.get(url) ?? null;
}

export function setHidden(url: string, hidden: boolean): void {
    setHiddenStmt.run(hidden ? 1 : 0, new Date().toISOString(), url);
}

export function countSqliteEvents(): number {
    const row = countStmt.get() as { n: number };
    return row.n;
}

export function getSqlitePath(): string {
    return dbPath;
}

export { sqlite };
