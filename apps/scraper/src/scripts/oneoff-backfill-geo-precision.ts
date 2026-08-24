/**
 * oneoff-backfill-geo-precision.ts — märk upp BEFINTLIGA rader med geoPrecision
 * (kolumnen infördes 2026-08-24; allt äldre är NULL).
 *
 * Regler, i ordning (första träff vinner):
 *   1. geocodedQuery = 'källans egna koordinater'      → 'kallkoordinat'
 *   2. geocodedQuery LIKE 'stad: %'                    → 'stad-centroid'
 *      (runnerns refresh-fallback, enda stället som märkte före 24/8)
 *   3. koordinaten ligger ≤120 m från en stadscentroid i geocode_cache
 *      ('city:%'-nycklarna)                            → 'stad-centroid'
 *      (fångar de 190 centroid-stackarna: Växjö 103, Göteborg 641 osv.)
 *
 * Enbart SQLite — Firestore-docs uppdateras inte (10k+ writes för ett
 * härledbart fält är inte värt kostnaden; upsertens COALESCE bevarar
 * märkningen när dokument synkas utan fältet).
 *
 *   npx ts-node src/scripts/oneoff-backfill-geo-precision.ts           # dry-run
 *   npx ts-node src/scripts/oneoff-backfill-geo-precision.ts --commit
 */
import { sqlite } from '../utils/sqliteHelper';

const COMMIT = process.argv.includes('--commit');
const NEAR_M = 120;

function main(): void {
    // Regel 1 + 2 — ren SQL.
    const r1 = sqlite.prepare(`
        SELECT COUNT(*) n FROM link_events
        WHERE geoPrecision IS NULL AND geocodedQuery = 'källans egna koordinater'
    `).get() as { n: number };
    const r2 = sqlite.prepare(`
        SELECT COUNT(*) n FROM link_events
        WHERE geoPrecision IS NULL AND geocodedQuery LIKE 'stad: %'
    `).get() as { n: number };

    // Regel 3 — stadscentroider ur cachen, matcha på närhet.
    const centroids = sqlite.prepare(`
        SELECT query, lat, lng FROM geocode_cache
        WHERE ok = 1 AND query LIKE 'city:%' AND lat IS NOT NULL
    `).all() as { query: string; lat: number; lng: number }[];
    console.log(`${centroids.length} stadscentroider i geocode_cache`);

    // ~120 m i grader (lat); lng-spannet vidgas med breddgraden — ta det
    // generösa värdet för Sverige (cos 69° ≈ 0.36) och verifiera exakt i JS.
    const dLat = NEAR_M / 111_320;
    const cntStmt = sqlite.prepare(`
        SELECT COUNT(*) n FROM link_events
        WHERE geoPrecision IS NULL
          AND geocodedQuery != 'källans egna koordinater'
          AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
          AND NOT (lat = 0 AND lng = 0)
    `);
    const updStmt = sqlite.prepare(`
        UPDATE link_events SET geoPrecision = 'stad-centroid'
        WHERE geoPrecision IS NULL
          AND geocodedQuery != 'källans egna koordinater'
          AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
          AND NOT (lat = 0 AND lng = 0)
    `);

    let rule3 = 0;
    const perCity: [string, number][] = [];
    for (const c of centroids) {
        const dLng = NEAR_M / (111_320 * Math.cos((c.lat * Math.PI) / 180));
        const args = [c.lat - dLat, c.lat + dLat, c.lng - dLng, c.lng + dLng] as const;
        const n = (cntStmt.get(...args) as { n: number }).n;
        if (n === 0) continue;
        rule3 += n;
        perCity.push([c.query.slice(5), n]);
        if (COMMIT) updStmt.run(...args);
    }

    if (COMMIT) {
        const u1 = sqlite.prepare(`
            UPDATE link_events SET geoPrecision = 'kallkoordinat'
            WHERE geoPrecision IS NULL AND geocodedQuery = 'källans egna koordinater'
        `).run();
        const u2 = sqlite.prepare(`
            UPDATE link_events SET geoPrecision = 'stad-centroid'
            WHERE geoPrecision IS NULL AND geocodedQuery LIKE 'stad: %'
        `).run();
        console.log(`✍️  kallkoordinat: ${u1.changes}, stad:-prefix: ${u2.changes}, centroid-närhet: ${rule3}`);
    } else {
        console.log(`DRY-RUN — skulle märka: kallkoordinat ${r1.n}, stad:-prefix ${r2.n}, centroid-närhet ${rule3}`);
    }
    perCity.sort((a, b) => b[1] - a[1]);
    console.log('Topp 15 städer (centroid-närhet):');
    for (const [city, n] of perCity.slice(0, 15)) console.log(`  ${city.padEnd(20)} ${n}`);

    const total = sqlite.prepare(`SELECT geoPrecision p, COUNT(*) n FROM link_events GROUP BY p ORDER BY n DESC`).all() as { p: string | null; n: number }[];
    console.log('\nFördelning efteråt:' + (COMMIT ? '' : ' (oförändrad — dry-run)'));
    for (const row of total) console.log(`  ${String(row.p).padEnd(15)} ${row.n}`);
}

main();
