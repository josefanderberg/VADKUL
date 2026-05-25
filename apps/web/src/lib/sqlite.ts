import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Hitta databasfilen robust i monorepot
let dbPath = '';
const pathsToTry = [
    path.join(process.cwd(), '../scraper/events.db'),
    path.join(process.cwd(), 'apps/scraper/events.db'),
    path.join(process.cwd(), 'events.db')
];

for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
        dbPath = p;
        break;
    }
}

if (!dbPath) {
    dbPath = path.resolve(process.cwd(), '../scraper/events.db');
}

// Säkerställ att mappen för databasen existerar
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

console.log(`🗃️ Next.js SQLite Database Path: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Skapa tabellerna om de inte redan finns
db.exec(`
    CREATE TABLE IF NOT EXISTS user_events (
        id                  TEXT PRIMARY KEY,
        type                TEXT,
        title               TEXT,
        description         TEXT,
        locationName        TEXT,
        lat                 REAL,
        lng                 REAL,
        time                TEXT,           -- ISO-8601
        price               REAL,
        minParticipants     INTEGER,
        maxParticipants     INTEGER,
        minAge              INTEGER,
        maxAge              INTEGER,
        ageCategory         TEXT,
        requiresApproval    INTEGER DEFAULT 0,
        coverImage          TEXT,
        customCategory      TEXT,
        views               INTEGER DEFAULT 0,
        host                TEXT,           -- JSON sträng
        attendees           TEXT,           -- JSON array sträng
        createdAt           TEXT            -- ISO-8601
    );

    CREATE INDEX IF NOT EXISTS idx_user_events_time ON user_events(time);

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
`);

export { db };
