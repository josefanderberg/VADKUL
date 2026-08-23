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

// ':memory:' stöds för tester — ren in-memory-DB utan filsystem.
const dbPath = process.env.SCRAPER_SQLITE_PATH === ':memory:'
    ? ':memory:'
    : process.env.SCRAPER_SQLITE_PATH
        ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
        : path.resolve(__dirname, '../../events.db');

// Säkerställ att katalogen finns
if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });

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

    -- Known venues: manuell koordinattabell för Växjö + övriga orter.
    -- Ersätter det hårdkodade VAXJO_VENUES-objektet. Administreras via manage-venues.ts.
    CREATE TABLE IF NOT EXISTS known_venues (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE,
        lat        REAL    NOT NULL,
        lng        REAL    NOT NULL,
        city       TEXT    DEFAULT 'Växjö',
        notes      TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_known_venues_name ON known_venues(name);

    -- Persistent geocoding-cache: Nominatim-svar per normaliserad query.
    -- ok=1 → lat/lng giltiga; ok=0 → query gav inget (negativ cache, så vi
    -- inte hamrar Nominatim med samma misslyckade fråga varje natt).
    CREATE TABLE IF NOT EXISTS geocode_cache (
        query      TEXT PRIMARY KEY,
        lat        REAL,
        lng        REAL,
        ok         INTEGER NOT NULL,
        checked_at TEXT    NOT NULL
    );

    -- Sync-metadata (nyckel/värde): cursors för inkrementell Firestore→SQLite-sync.
    CREATE TABLE IF NOT EXISTS sync_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);

// ─── Additive migrations ────────────────────────────────────────────────────

function addColumnIfMissing(table: string, column: string, definition: string): boolean {
    const cols = (sqlite.pragma(`table_info(${table})`) as Array<{ name: string }>).map(r => r.name);
    if (!cols.includes(column)) {
        sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        return true;
    }
    return false;
}

addColumnIfMissing('link_events', 'aiVerdict',            'TEXT');
addColumnIfMissing('link_events', 'aiConfidence',         'TEXT');
addColumnIfMissing('link_events', 'category_confidence',  'TEXT');
addColumnIfMissing('link_events', 'emoji',                'TEXT');
addColumnIfMissing('link_events', 'price',                'TEXT');
addColumnIfMissing('scrape_runs', 'hidden_count',         'INTEGER DEFAULT 0');
addColumnIfMissing('scrape_runs', 'errors_json',          'TEXT');
addColumnIfMissing('scrape_runs', 'audited_count',        'INTEGER DEFAULT 0');
addColumnIfMissing('scrape_runs', 'auto_hidden_count',    'INTEGER DEFAULT 0');

// hasSpecificTime: 1 = källan gav ett riktigt klockslag, 0 = bara datum
// (midnatt är platshållare). NULL på legacy-rader backfillas nedan.
// timeFixAttempts: hur många gånger fix-event-times försökt hitta klockslag
// på detaljsidan — efter 3 försök ger vi upp (sidan saknar tid).
addColumnIfMissing('link_events', 'hasSpecificTime', 'INTEGER');
addColumnIfMissing('link_events', 'timeFixAttempts', 'INTEGER DEFAULT 0');
// geoRefineAttempts: hur många nätter geo-refine försökt förfina eventets
// koordinater utan träff — efter 3 hoppas raden så budgeten når nya event.
addColumnIfMissing('link_events', 'geoRefineAttempts', 'INTEGER DEFAULT 0');
{
    // Backfill av NULL-rader (legacy + rader skrivna av äldre processer):
    // midnatt i ANTINGEN lokal tid eller UTC = "bara datum". Körs i JS (inte
    // SQL) eftersom lokal midnatt beror på DST (T22/T23 i UTC). Körs vid varje
    // uppstart — billig no-op när alla rader redan har flaggan.
    const rows = sqlite.prepare('SELECT url, time FROM link_events WHERE hasSpecificTime IS NULL').all() as Array<{ url: string; time: string | null }>;
    if (rows.length > 0) {
        const upd = sqlite.prepare('UPDATE link_events SET hasSpecificTime = ? WHERE url = ?');
        const backfill = sqlite.transaction((rs: Array<{ url: string; time: string | null }>) => {
            for (const r of rs) {
                const d = r.time ? new Date(r.time) : null;
                const midnightish = !d || isNaN(d.getTime())
                    || (d.getHours() === 0 && d.getMinutes() === 0)
                    || (d.getUTCHours() === 0 && d.getUTCMinutes() === 0);
                upd.run(midnightish ? 0 : 1, r.url);
            }
        });
        backfill(rows);
        console.log(`  ℹ️  link_events.hasSpecificTime: ${rows.length} NULL-rader backfillade`);
    }
}

// status-kolumn: 'raw' | 'audited' | 'published'
// Backfillas direkt till 'published' för alla befintliga rader — de var redan
// synliga i webben och ska förbli det utan manuellt steg.
const statusAdded = addColumnIfMissing('link_events', 'status', "TEXT NOT NULL DEFAULT 'raw'");
if (statusAdded) {
    sqlite.exec("UPDATE link_events SET status = 'published' WHERE status = 'raw'");
    console.log('  ℹ️  link_events.status: kolumn tillagd, befintliga rader backfillades till "published"');
}
// Index on status must come after column migration (column may not exist at CREATE TABLE time).
sqlite.exec("CREATE INDEX IF NOT EXISTS idx_link_events_status ON link_events(status)");

const insertRunStmt = sqlite.prepare(`
    INSERT INTO scrape_runs (source_id, host_name, started_at, duration_ms,
        found, saved, skipped_duplicate, skipped_outside_window, skipped_invalid,
        error_count, first_error, hidden_count, errors_json, audited_count, auto_hidden_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    auditedCount?: number;
    autoHiddenCount?: number;
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
            run.auditedCount ?? 0,
            run.autoHiddenCount ?? 0,
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

// ─── Audit helpers ───────────────────────────────────────────────────────────

const setAuditStmt = sqlite.prepare(
    'UPDATE link_events SET aiVerdict = ?, aiConfidence = ?, updatedAt = ? WHERE url = ?',
);

export function setEventAudit(url: string, verdict: string, confidence: string): void {
    try {
        setAuditStmt.run(verdict, confidence, new Date().toISOString(), url);
    } catch (err) {
        console.error('Failed to set event audit:', err);
    }
}

const setAuditFullStmt = sqlite.prepare(
    `UPDATE link_events
     SET aiVerdict = ?, aiConfidence = ?, category = ?, category_confidence = ?,
         emoji = ?, price = ?, updatedAt = ?
     WHERE url = ?`,
);

export interface EventAuditWrite {
    verdict: string;
    confidence: string;
    category: string;
    categoryConfidence: string;
    emoji: string;
    price: string | null;
}

/** Skriver hela LLM-auditresultatet (verdict + kategori + emoji + pris) atomiskt. */
export function setEventAuditWithCategory(url: string, a: EventAuditWrite): void {
    try {
        setAuditFullStmt.run(
            a.verdict, a.confidence, a.category, a.categoryConfidence,
            a.emoji, a.price ?? null, new Date().toISOString(), url,
        );
    } catch (err) {
        console.error('Failed to set event audit with category:', err);
    }
}

const upsertStmt = sqlite.prepare(`
    INSERT INTO link_events (
        url, title, time, hasSpecificTime, locationName, extractedAddress, geocodedQuery,
        lat, lng, hostName, category, coverImage, description,
        attendees, createdAt, isLocationVerified, isHostVerified, hidden,
        firestoreId, updatedAt, status, price
    ) VALUES (
        @url, @title, @time, @hasSpecificTime, @locationName, @extractedAddress, @geocodedQuery,
        @lat, @lng, @hostName, @category, @coverImage, @description,
        @attendees, @createdAt, @isLocationVerified, @isHostVerified, @hidden,
        @firestoreId, @updatedAt, @status, @price
    )
    ON CONFLICT(url) DO UPDATE SET
        title              = excluded.title,
        time               = excluded.time,
        hasSpecificTime    = COALESCE(excluded.hasSpecificTime, link_events.hasSpecificTime),
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
        updatedAt          = excluded.updatedAt,
        -- price: bevara LLM-extraherat pris även om scrapern råkar skicka ''
        --        NULLIF tomma strängar till NULL så COALESCE faller tillbaka på sparat värde.
        price              = COALESCE(NULLIF(excluded.price, ''), link_events.price)
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
    /** true = riktigt klockslag från källan; false = bara datum (midnatt är platshållare). */
    hasSpecificTime?: boolean;
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
    /** Entrépris från strukturerad källa (t.ex. json-ld offers.price). */
    price?: string;
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
        hasSpecificTime:    event.hasSpecificTime === undefined ? null : (event.hasSpecificTime ? 1 : 0),
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
        price:              event.price ?? null,
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

// ─── Known Venues ──────────────────────────────────────────────────────────────

export interface KnownVenueRow {
    id: number;
    name: string;
    lat: number;
    lng: number;
    city: string | null;
    notes: string | null;
    created_at: string;
}

const venueUpsertStmt = sqlite.prepare(`
    INSERT INTO known_venues (name, lat, lng, city, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
        lat   = excluded.lat,
        lng   = excluded.lng,
        city  = excluded.city,
        notes = COALESCE(excluded.notes, known_venues.notes)
`);

const venueDeleteStmt   = sqlite.prepare('DELETE FROM known_venues WHERE name = ?');
const venueExactStmt    = sqlite.prepare('SELECT lat, lng FROM known_venues WHERE name = ? LIMIT 1');
const venueAllStmt      = sqlite.prepare('SELECT id, name, lat, lng, city, notes, created_at FROM known_venues ORDER BY name ASC');
const venueByCityStmt   = sqlite.prepare('SELECT id, name, lat, lng, city, notes, created_at FROM known_venues WHERE city = ? ORDER BY name ASC');
const venueCountStmt    = sqlite.prepare('SELECT COUNT(*) AS n FROM known_venues');

export function upsertKnownVenue(name: string, lat: number, lng: number, city?: string, notes?: string): void {
    venueUpsertStmt.run(name, lat, lng, city ?? 'Växjö', notes ?? null);
}

export function deleteKnownVenue(name: string): boolean {
    const info = venueDeleteStmt.run(name);
    return info.changes > 0;
}

export function lookupVenueExact(name: string): [number, number] | null {
    const row = venueExactStmt.get(name) as { lat: number; lng: number } | undefined;
    return row ? [row.lat, row.lng] : null;
}

const venueSmartCityStmt = sqlite.prepare(
    'SELECT lat, lng FROM known_venues WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?) LIMIT 1',
);
const venueSmartUniqueStmt = sqlite.prepare(
    'SELECT lat, lng, COUNT(*) OVER () AS n FROM known_venues WHERE LOWER(name) = LOWER(?) LIMIT 1',
);

/**
 * Case-okänslig venue-lookup för geokodningskedjan (geocodeVenueSweden steg 0).
 * Med stad: kräver stadsmatch — "Konserthuset" finns i många städer och fel
 * träff vore värre än Nominatim-vägen. Utan stad: träff bara om namnet är
 * UNIKT i tabellen (annars ambiguöst → null och låt Nominatim avgöra).
 */
export function lookupVenueSmart(name: string, city?: string): [number, number] | null {
    const n = name.trim();
    if (n.length < 4) return null;
    if (city && city.trim()) {
        const row = venueSmartCityStmt.get(n, city.trim()) as { lat: number; lng: number } | undefined;
        return row ? [row.lat, row.lng] : null;
    }
    const row = venueSmartUniqueStmt.get(n) as { lat: number; lng: number; n: number } | undefined;
    return row && row.n === 1 ? [row.lat, row.lng] : null;
}

export function getAllKnownVenues(): KnownVenueRow[] {
    return venueAllStmt.all() as KnownVenueRow[];
}

export function listKnownVenues(city?: string): KnownVenueRow[] {
    return city
        ? (venueByCityStmt.all(city) as KnownVenueRow[])
        : (venueAllStmt.all() as KnownVenueRow[]);
}

export function countKnownVenues(): number {
    return (venueCountStmt.get() as { n: number }).n;
}

// ─── Tids- och koordinat-uppdateringar (fix-times, refresh-körningar, geo-refine) ──

const setTimeStmt = sqlite.prepare(
    'UPDATE link_events SET time = ?, hasSpecificTime = ?, updatedAt = ? WHERE url = ?',
);

/** Sätt ny tid + tidskvalitets-flagga för ett event (SQLite-delen). */
export function setEventTime(url: string, timeIso: string, hasSpecificTime: boolean): void {
    setTimeStmt.run(timeIso, hasSpecificTime ? 1 : 0, new Date().toISOString(), url);
}

const bumpAttemptsStmt = sqlite.prepare(
    'UPDATE link_events SET timeFixAttempts = COALESCE(timeFixAttempts, 0) + 1 WHERE url = ?',
);

/** Räkna upp antalet misslyckade tids-fix-försök (fix-event-times ger upp efter 3). */
export function bumpTimeFixAttempts(url: string): void {
    bumpAttemptsStmt.run(url);
}

const setLocStmt = sqlite.prepare('UPDATE link_events SET locationName = ?, updatedAt = ? WHERE url = ?');
export function setEventLocationName(url: string, locationName: string): void {
    setLocStmt.run(locationName, new Date().toISOString(), url);
}

const bumpGeoRefineStmt = sqlite.prepare(
    'UPDATE link_events SET geoRefineAttempts = COALESCE(geoRefineAttempts, 0) + 1 WHERE url = ?',
);

/** Räkna upp antalet resultatlösa geo-refine-försök (ger upp efter 3). */
export function bumpGeoRefineAttempts(url: string): void {
    bumpGeoRefineStmt.run(url);
}

const setCoordsStmt = sqlite.prepare(`
    UPDATE link_events
    SET lat = ?, lng = ?, geocodedQuery = ?, isLocationVerified = 1, updatedAt = ?
    WHERE url = ?
`);

/** Sätt förfinade koordinater + vilken query som gav träffen (geo-refine). */
export function setEventCoords(url: string, lat: number, lng: number, geocodedQuery: string): void {
    setCoordsStmt.run(lat, lng, geocodedQuery, new Date().toISOString(), url);
}

// ─── Geocode-cache ───────────────────────────────────────────────────────────

export interface GeocodeCacheHit {
    lat: number;
    lng: number;
    ok: boolean;
    ageDays: number;
}

const geoCacheGetStmt = sqlite.prepare('SELECT lat, lng, ok, checked_at FROM geocode_cache WHERE query = ?');
const geoCacheSetStmt = sqlite.prepare(`
    INSERT INTO geocode_cache (query, lat, lng, ok, checked_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(query) DO UPDATE SET
        lat = excluded.lat, lng = excluded.lng, ok = excluded.ok, checked_at = excluded.checked_at
`);

export function geocodeCacheGet(query: string): GeocodeCacheHit | null {
    const row = geoCacheGetStmt.get(query) as { lat: number; lng: number; ok: number; checked_at: string } | undefined;
    if (!row) return null;
    const ageDays = (Date.now() - new Date(row.checked_at).getTime()) / 86_400_000;
    return { lat: row.lat, lng: row.lng, ok: row.ok === 1, ageDays };
}

export function geocodeCacheSet(query: string, coords: [number, number] | null): void {
    geoCacheSetStmt.run(query, coords?.[0] ?? null, coords?.[1] ?? null, coords ? 1 : 0, new Date().toISOString());
}

// ─── Sync-metadata (cursors för inkrementell sync) ──────────────────────────

const syncMetaGetStmt = sqlite.prepare('SELECT value FROM sync_meta WHERE key = ?');
const syncMetaSetStmt = sqlite.prepare(`
    INSERT INTO sync_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

export function getSyncMeta(key: string): string | null {
    const row = syncMetaGetStmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
}

export function setSyncMeta(key: string, value: string): void {
    syncMetaSetStmt.run(key, value);
}

export { sqlite };
