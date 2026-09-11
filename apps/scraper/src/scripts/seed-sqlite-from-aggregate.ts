/**
 * seed-sqlite-from-aggregate.ts — bygg en engångs-SQLite (link_events) ur de
 * incheckade aggregat-JSON:erna i apps/web/public/.
 *
 * VARFÖR: skript som läser events.db (t.ex. schedule-city-posts) kan därmed
 * köras i GitHub Actions, där minins riktiga databas inte finns. Aggregatet
 * är nattens publicerade data — exakt det kartan visar — och räcker gott för
 * inläggsurval.
 *
 * Schemat skapas av sqliteHelper själv (importen kör migrationerna), så
 * hjälparens förberedda statements alltid matchar — en handrullad tabell
 * saknade updatedAt m.fl. och kraschade varje skript som råkar dra in
 * sqliteHelper transitivt (första CI-körningen 10/9).
 *
 * Skriver ALDRIG till riktiga events.db: målet måste anges via
 * SCRAPER_SQLITE_PATH och filen får inte redan finnas.
 *
 * destinations[i] och cards[i] byggs ur SAMMA rad i aggregate-events.ts
 * (index-linjerade) — verifieras per rad: kortet bär `id` (gammalt aggregat)
 * eller `h` = eventKey(url) (slankt kortlager sedan 2026-09-11). Seedern
 * måste klara båda — Stadsinlägg-workflowen läser de incheckade filerna, och
 * de byter format när minin byggt om aggregatet.
 *
 * Körning:  SCRAPER_SQLITE_PATH=/tmp/events-aggregat.db npx ts-node src/scripts/seed-sqlite-from-aggregate.ts
 */
import fs from 'fs';
import path from 'path';
import { eventKey } from '../utils/eventKey';

const OUT = process.env.SCRAPER_SQLITE_PATH;
if (!OUT || OUT === ':memory:') {
    console.error('❌ Sätt SCRAPER_SQLITE_PATH till målfilen (skyddar riktiga events.db).');
    process.exit(1);
}
if (fs.existsSync(OUT)) {
    console.error(`❌ ${OUT} finns redan — vägrar skriva över en befintlig databas.`);
    process.exit(1);
}

// Lazy require EFTER vakterna: sqliteHelper skapar databasfilen vid import.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sqlite } = require('../utils/sqliteHelper') as { sqlite: import('better-sqlite3').Database };

const webPub = path.resolve(__dirname, '../../../web/public');
const dest = JSON.parse(fs.readFileSync(path.join(webPub, 'events-destinations.json'), 'utf8'));
const cards = JSON.parse(fs.readFileSync(path.join(webPub, 'events-cards.json'), 'utf8'));

if (!Array.isArray(dest.events) || !Array.isArray(cards.events) || dest.events.length !== cards.events.length) {
    console.error(`❌ Aggregatlagren är inte index-linjerade (destinations ${dest.events?.length} ≠ cards ${cards.events?.length}).`);
    process.exit(1);
}

// Samma event i båda lagren? Slankt kort: h = eventKey(dest-id). Gammalt: id.
const sameEvent = (d: { id: string }, c: { id?: string; h?: string }) =>
    typeof c.h === 'string' ? c.h === eventKey(d.id) : c.id === d.id;

const now = new Date().toISOString();
const ins = sqlite.prepare(`INSERT OR IGNORE INTO link_events
    (url, title, time, endDate, locationName, category, lat, lng,
     hidden, isLocationVerified, hasSpecificTime, hostName, status, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'published', ?)`);

let inserted = 0, misaligned = 0;
sqlite.transaction(() => {
    for (let i = 0; i < dest.events.length; i++) {
        const d = dest.events[i], c = cards.events[i];
        // Samma rad i båda lagren ska vara samma event — annars är zipningen
        // fel och raden hoppas hellre än att få fel isLocationVerified/hostName.
        if (!sameEvent(d, c)) { misaligned++; continue; }
        const r = ins.run(
            d.id, d.title ?? '', d.time ?? '', d.endDate ?? null,
            d.locationName ?? '', d.category ?? 'other',
            Number(d.lat) || 0, Number(d.lng) || 0,
            c.isLocationVerified ? 1 : 0, d.hasSpecificTime ? 1 : 0,
            c.hostName ?? '', now,
        );
        inserted += r.changes;
    }
})();

console.log(`✅ ${inserted} event seedade till ${OUT} (aggregat updatedAt ${dest.updatedAt})`
    + (misaligned ? ` — ⚠️ ${misaligned} rader var inte id-linjerade och hoppades` : ''));
if (misaligned > dest.events.length / 100) {
    console.error('❌ >1 % felzippade rader — aggregatformatet har ändrats, uppdatera seedern.');
    process.exit(1);
}
