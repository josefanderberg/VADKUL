/**
 * Bygger badplatsfilen (#279): apps/web/public/badplatser.json ur
 * OpenStreetMap via Overpass. Körs av nattkedjan (run-daily.sh) på måndagar,
 * eller när filen saknas - OSM:s badplatser ändras långsamt, och en
 * Sverige-fråga mot Overpass ska inte gå varje natt.
 *
 *   npm run badplatser            # hämta och skriv
 *   npm run badplatser -- --dry   # hämta och räkna, skriv inget
 *
 * Ett halvt svar (färre än BADPLATS_MIN_COUNT) skriver aldrig över filen.
 * Data © OpenStreetMap-bidragsgivare (ODbL) - krediten står redan i
 * välkomstrutans kartdata-rad.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    BADPLATS_MIN_COUNT,
    BADPLATS_QUERY,
    dedupeBadplatser,
    parseOverpass,
    toBadplatsGeoJSON,
} from '../utils/badplatser';

const OUT = path.resolve(__dirname, '../../../web/public/badplatser.json');
const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];

async function fetchOverpass(): Promise<unknown> {
    let lastError: unknown;
    for (const url of ENDPOINTS) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'vadkul.se badplatser (hej@vadkul.se)' },
                body: 'data=' + encodeURIComponent(BADPLATS_QUERY),
                signal: AbortSignal.timeout(330_000),
            });
            if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            lastError = err;
            console.warn(`⚠️ Badplatser: ${url} svarade inte (${err instanceof Error ? err.message : err})`);
        }
    }
    throw lastError;
}

async function main() {
    const dry = process.argv.includes('--dry');
    const raw = parseOverpass(await fetchOverpass());
    const list = dedupeBadplatser(raw);
    const named = list.filter(p => p.name).length;
    console.log(`Badplatser: ${raw.length} ur OSM, ${list.length} efter hopslagning (${named} med namn).`);
    if (list.length < BADPLATS_MIN_COUNT) {
        console.error(`❌ Badplatser: bara ${list.length} - halvt svar? Filen skrivs inte över.`);
        process.exit(1);
    }
    const json = JSON.stringify(toBadplatsGeoJSON(list));
    if (dry) {
        console.log(`(--dry) ${Math.round(json.length / 1024)} kB skulle skrivas till ${OUT}`);
        return;
    }
    fs.writeFileSync(OUT, json, 'utf-8');
    console.log(`Badplatsfilen skriven: ${OUT} (${Math.round(json.length / 1024)} kB)`);
}

main().catch(err => {
    console.error('❌ Badplatser misslyckades:', err);
    process.exit(1);
});
