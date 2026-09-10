#!/usr/bin/env node
/**
 * seed-sqlite-from-aggregate.js — bygg en engångs-SQLite (link_events) ur de
 * incheckade aggregat-JSON:erna i apps/web/public/.
 *
 * VARFÖR: skript som läser events.db (t.ex. schedule-city-posts) kan därmed
 * köras i GitHub Actions, där minins riktiga databas inte finns. Aggregatet
 * är nattens publicerade data — exakt det kartan visar — och räcker gott för
 * inläggsurval. Skriver ALDRIG till riktiga events.db: målfilen måste anges
 * via SCRAPER_SQLITE_PATH och får inte redan finnas.
 *
 * Kolumnerna är de eventsForTown m.fl. läser: url, title, time, endDate,
 * locationName, category, lat, lng, hidden, isLocationVerified, hostName.
 * destinations[i] och cards[i] byggs ur SAMMA rad i aggregate-events.ts
 * (index-linjerade) — det verifieras per rad via id-jämförelse.
 *
 * Körning:  SCRAPER_SQLITE_PATH=/tmp/events-aggregat.db node scripts/seed-sqlite-from-aggregate.js
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const OUT = process.env.SCRAPER_SQLITE_PATH;
if (!OUT) {
    console.error('❌ Sätt SCRAPER_SQLITE_PATH till målfilen (skyddar riktiga events.db).');
    process.exit(1);
}
if (fs.existsSync(OUT)) {
    console.error(`❌ ${OUT} finns redan — vägrar skriva över en befintlig databas.`);
    process.exit(1);
}

const webPub = path.resolve(__dirname, '../../web/public');
const dest = JSON.parse(fs.readFileSync(path.join(webPub, 'events-destinations.json'), 'utf8'));
const cards = JSON.parse(fs.readFileSync(path.join(webPub, 'events-cards.json'), 'utf8'));

if (!Array.isArray(dest.events) || !Array.isArray(cards.events) || dest.events.length !== cards.events.length) {
    console.error(`❌ Aggregatlagren är inte index-linjerade (destinations ${dest.events?.length} ≠ cards ${cards.events?.length}).`);
    process.exit(1);
}

const db = new Database(OUT);
db.exec(`CREATE TABLE link_events (
    url TEXT PRIMARY KEY,
    title TEXT, time TEXT, endDate TEXT,
    locationName TEXT, category TEXT,
    lat REAL, lng REAL,
    hidden INTEGER DEFAULT 0,
    isLocationVerified INTEGER DEFAULT 0,
    hostName TEXT
)`);

const ins = db.prepare(`INSERT OR IGNORE INTO link_events
    (url, title, time, endDate, locationName, category, lat, lng, hidden, isLocationVerified, hostName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`);

let inserted = 0, misaligned = 0;
db.transaction(() => {
    for (let i = 0; i < dest.events.length; i++) {
        const d = dest.events[i], c = cards.events[i];
        // Samma rad i båda lagren har samma id — annars är zipningen fel och
        // raden hoppas hellre än att få fel isLocationVerified/hostName.
        if (d.id !== c.id) { misaligned++; continue; }
        const r = ins.run(
            d.id, d.title ?? '', d.time ?? '', d.endDate ?? null,
            d.locationName ?? '', d.category ?? 'other',
            Number(d.lat) || 0, Number(d.lng) || 0,
            c.isLocationVerified ? 1 : 0, c.hostName ?? '',
        );
        inserted += r.changes;
    }
})();
db.close();

console.log(`✅ ${inserted} event seedade till ${OUT} (aggregat updatedAt ${dest.updatedAt})`
    + (misaligned ? ` — ⚠️ ${misaligned} rader var inte id-linjerade och hoppades` : ''));
if (misaligned > dest.events.length / 100) {
    console.error('❌ >1 % felzippade rader — aggregatformatet har ändrats, uppdatera seedern.');
    process.exit(1);
}
