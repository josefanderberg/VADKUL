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
    CREATE INDEX IF NOT EXISTS idx_link_events_status   ON link_events(status);

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

// ─── Additive migrations ────────────────────────────────────────────────────

/**
 * Lägg till en kolumn om den inte redan finns. Returnerar true om den lades till
 * (dvs. kolumnen var ny), false om den redan existerade.
 */
function addColumnIfMissing(table: string, column: string, definition: string): boolean {
    const cols = (sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>).map(r => r.name);
    if (!cols.includes(column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        return true;
    }
    return false;
}

// status-kolumn: 'raw' | 'audited' | 'published'
// Backfillas direkt till 'published' för alla befintliga rader — de var redan
// synliga i webben och ska förbli det utan manuellt steg.
const statusAdded = addColumnIfMissing('link_events', 'status', "TEXT NOT NULL DEFAULT 'raw'");
if (statusAdded) {
    sqlite.exec("UPDATE link_events SET status = 'published' WHERE status = 'raw'");
    console.log('  ℹ️  link_events.status: kolumn tillagd, befintliga rader backfillades till "published"');
}

const insertRunStmt = sqlite.prepare(`
    INSERT INTO scrape_runs (source_id, host_name, started_at, duration_ms,
        found, saved, skipped_duplicate, skipped_outside_window, skipped_invalid,
        error_count, first_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
}

export function recordScrapeRun(run: ScrapeRunRow): void {
    try {
        insertRunStmt.run(
            run.sourceId, run.hostName, run.startedAt.toISOString(),
            run.durationMs, run.found, run.saved,
            run.skippedDuplicate, run.skippedOutsideWindow, run.skippedInvalid,
            run.errorCount, run.firstError ?? null,
        );
    } catch (err) {
        console.error('Failed to record scrape run:', err);
    }
}

const upsertStmt = sqlite.prepare(`
    INSERT INTO link_events (
        url, title, time, locationName, extractedAddress, geocodedQuery,
        lat, lng, hostName, category, coverImage, description,
        attendees, createdAt, isLocationVerified, isHostVerified, hidden,
        firestoreId, updatedAt, status
    ) VALUES (
        @url, @title, @time, @locationName, @extractedAddress, @geocodedQuery,
        @lat, @lng, @hostName, @category, @coverImage, @description,
        @attendees, @createdAt, @isLocationVerified, @isHostVerified, @hidden,
        @firestoreId, @updatedAt, @status
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
        -- status bevaras avsiktligt vid re-scrape; ändras bara via setEventStatus()
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

export type EventStatus = 'raw' | 'audited' | 'published';

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
    /**
     * Pipeline-status. Default 'published' för bakåtkompatibilitet —
     * alla gamla anropare som inte sätter status får published direkt.
     * Sätt 'raw' explicit när AUDIT_ENABLED=true för att markera att
     * eventet väntar på granskning.
     */
    status?: EventStatus;
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
        status:             event.status ?? 'published',
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

const setStatusStmt = sqlite.prepare(
    'UPDATE link_events SET status = ?, updatedAt = ? WHERE url = ?',
);

export function setEventStatus(url: string, status: EventStatus): void {
    try {
        setStatusStmt.run(status, new Date().toISOString(), url);
    } catch (err) {
        console.error('Failed to set event status:', err);
    }
}

export function countSqliteEvents(): number {
    const row = countStmt.get() as { n: number };
    return row.n;
}

export function getSqlitePath(): string {
    return dbPath;
}

export { sqlite };
