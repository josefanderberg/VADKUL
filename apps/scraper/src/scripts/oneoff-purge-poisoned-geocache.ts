/**
 * oneoff-purge-poisoned-geocache.ts — rensa cache-svar som är tysta
 * stads-degraderingar (24/8, Växjö-granskningen).
 *
 * Före geoPrecision-märkningen cachades "Tallgårdens bibliotek, Växjö" →
 * Växjö centrum som en TRÄFF (ok=1, 90 dagars TTL). De raderna svarar före
 * den nya suffix-/första-ords-kedjan och låser felen i månader. Rensning:
 *
 *   DELETE där ok=1, koordinaten ligger ≤120 m från en 'city:'-centroid och
 *   frågans venue-del bär MER information än ett rent stadsnamn (kommatecken
 *   eller ≥2 ord). Bara stadsnamns-frågor ("växjö", "near:växjö|växjö") och
 *   'city:'/'street:'-nycklar behålls — de ÄR legitima centroid-/gatusvar.
 *
 * Nollställer också geoRefineAttempts för framtida stad-centroid-event:
 * registret (Overpass-seed) + nya kedjan ger uppgivna rader nya chanser.
 *
 *   npx ts-node src/scripts/oneoff-purge-poisoned-geocache.ts            # dry-run
 *   npx ts-node src/scripts/oneoff-purge-poisoned-geocache.ts --commit
 */
import { sqlite } from '../utils/sqliteHelper';

const COMMIT = process.argv.includes('--commit');
const NEAR_M = 120;

/** Venue-delen av en cache-nyckel: 'near:<stad>|<fråga>' → <fråga>, 'strict:x' → x. */
function venuePart(key: string): string | null {
    if (key.startsWith('city:') || key.startsWith('street:')) return null;   // legitima
    if (key.startsWith('near:')) {
        const i = key.indexOf('|');
        return i === -1 ? key.slice(5) : key.slice(i + 1);
    }
    if (key.startsWith('strict:')) return key.slice(7);
    return key;
}

/** Bär frågan mer info än ett rent stadsnamn? */
function moreThanCityName(q: string): boolean {
    const t = q.replace(/,\s*(sverige|sweden)\s*$/i, '').trim();
    if (t.includes(',')) return true;
    return t.split(/\s+/).length >= 2;
}

function main(): void {
    const cents = sqlite.prepare(
        "SELECT lat, lng FROM geocode_cache WHERE ok=1 AND query LIKE 'city:%' AND lat IS NOT NULL",
    ).all() as { lat: number; lng: number }[];

    const rows = sqlite.prepare(
        'SELECT query, lat, lng FROM geocode_cache WHERE ok = 1 AND lat IS NOT NULL',
    ).all() as { query: string; lat: number; lng: number }[];

    const dLat = NEAR_M / 111_320;
    const nearCentroid = (lat: number, lng: number) => cents.some(c =>
        Math.abs(lat - c.lat) < dLat
        && Math.abs(lng - c.lng) < NEAR_M / (111_320 * Math.cos((c.lat * Math.PI) / 180)));

    const doomed: string[] = [];
    for (const r of rows) {
        const vp = venuePart(r.query);
        if (vp === null || !moreThanCityName(vp)) continue;
        if (nearCentroid(r.lat, r.lng)) doomed.push(r.query);
    }

    console.log(`${doomed.length} förgiftade cache-rader av ${rows.length} ok-rader`);
    console.log('Exempel:', doomed.slice(0, 8).map(q => `\n  ${q.slice(0, 80)}`).join(''));

    if (COMMIT) {
        const del = sqlite.prepare('DELETE FROM geocode_cache WHERE query = ?');
        const tx = sqlite.transaction((keys: string[]) => { for (const k of keys) del.run(k); });
        tx(doomed);
        const reset = sqlite.prepare(`
            UPDATE link_events SET geoRefineAttempts = 0
            WHERE geoPrecision = 'stad-centroid' AND geoRefineAttempts > 0
              AND datetime(time) >= datetime('now')
        `).run();
        console.log(`✍️  ${doomed.length} cache-rader rensade, ${reset.changes} geoRefineAttempts nollställda`);
    } else {
        console.log('(dry-run — kör med --commit)');
    }
}

main();
