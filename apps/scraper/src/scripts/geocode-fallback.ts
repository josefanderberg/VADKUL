/**
 * Geocode-fallback: för events där lat=0,lng=0 men locationName finns,
 * försök geocoda `locationName + kommun-namn`. Lägger till stad-fallback
 * om locationName är samma som kommun (bara stad-koordinater).
 *
 * Användning:
 *   npx ts-node src/scripts/geocode-fallback.ts        # dry-run
 *   npx ts-node src/scripts/geocode-fallback.ts --apply
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { SOURCES } from '../sources/registry';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

const apply = process.argv.includes('--apply');
const HOSTS = SOURCES.map((s) => s.hostName);

// Mappa hostName → city name to use in geocoder query
function hostToCity(host: string): string {
    return host
        .replace(/s? Kommun$/i, '')
        .replace(/^(Visit|Destination|Visit )\s+/i, '')
        .replace(/\s*&.*/, '')   // "Göteborg & Co" → "Göteborg"
        .replace(/s Stad$/i, '') // "Helsingborgs Stad" → "Helsingborg"
        .trim();
}

interface Row {
    url: string; title: string; firestoreId: string; hostName: string;
    locationName: string; lat: number; lng: number;
}

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(apply ? '🔧 APPLY' : '🔍 DRY-RUN');

    const rows: Row[] = sqliteDb.prepare(`
        SELECT url, title, firestoreId, hostName, locationName, lat, lng
        FROM link_events
        WHERE hostName IN (${HOSTS.map(() => '?').join(',')})
          AND firestoreId IS NOT NULL
          AND hidden = 0
          AND lat = 0 AND lng = 0
          AND locationName IS NOT NULL
          AND locationName != ''
          AND locationName != 'Sverige'
        ORDER BY hostName
    `).all(...HOSTS) as Row[];

    console.log(`Kandidater: ${rows.length}\n`);

    const stats: Record<string, { tried: number; found: number; failed: number }> = {};
    let totalFound = 0;
    let prevHost = '';

    for (const r of rows) {
        stats[r.hostName] ??= { tried: 0, found: 0, failed: 0 };
        stats[r.hostName].tried++;

        if (prevHost !== r.hostName) { console.log(`\n=== ${r.hostName} ===`); prevHost = r.hostName; }

        const city = hostToCity(r.hostName);
        // Strategier i ordning:
        //   1. locationName + ", " + kommunsstad     ("Stortorget, Östersund")
        //   2. locationName ensamt                    ("Stortorget")  — Nominatim funkar ibland
        //   3. Bara kommunsstaden                     ("Östersund")    — sista fallback
        const queries = [
            r.locationName === city ? city : `${r.locationName}, ${city}`,
            r.locationName,
            city,
        ];

        let coords: [number, number] | null = null;
        let usedQuery = '';
        for (const q of queries) {
            if (!q) continue;
            const c = await geocodeVenueSweden(q);
            if (c) { coords = c; usedQuery = q; break; }
        }

        if (!coords) {
            stats[r.hostName].failed++;
            console.log(`  ✗  ${r.title.slice(0, 45)} | "${r.locationName}"`);
            continue;
        }

        stats[r.hostName].found++;
        totalFound++;
        console.log(`  ✅ ${r.title.slice(0, 45)} | "${usedQuery}" → [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}]`);

        if (apply) {
            try {
                await db.collection('linkEvents').doc(r.firestoreId).update({
                    lat: coords[0],
                    lng: coords[1],
                    // Markera som city-only om vi föll tillbaka på bara stad
                    isLocationVerified: usedQuery !== city,
                });
            } catch (e) {
                console.error(`    ERR: ${(e as Error).message}`);
            }
        }
    }

    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    for (const [h, s] of Object.entries(stats)) {
        console.log(`  ${h.padEnd(28)} tried=${String(s.tried).padStart(3)}  found=${String(s.found).padStart(3)}  failed=${s.failed}`);
    }
    console.log(`TOTAL: ${totalFound} nya koordinater ${apply ? '(applicerade)' : '(dry-run)'}`);
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
