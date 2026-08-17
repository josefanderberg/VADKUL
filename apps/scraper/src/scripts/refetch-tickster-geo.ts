/**
 * refetch-tickster-geo.ts — reparera o-geokodade Tickster-event genom OMHÄMTNING.
 *
 * Bakgrund: ~695 Tickster-event sparades utan koordinater innan motorn fick
 * kart-länk-extraktion (backfillPlaceFromHtml) och location-scopad microdata.
 * extractedAddress förgiftades dessutom av footerns kontorsadress
 * ("Magasinsgatan 8"). Skip-känt-optimeringen gör att nattkörningen aldrig
 * re-extraherar kända URL:er — de måste hämtas om explicit.
 *
 * Per event (tickster-URL, framtida, lat=0):
 *   1. Hämta detaljsidan (1.5s throttle, Tickster är tålig men artighet gäller).
 *   2. backfillPlaceFromHtml → exakta koordinater ur Google Maps-länken,
 *      annars ort ur location-scopad microdata.
 *   3. Koordinater → skriv direkt. Bara ort → geokoda "venue, ort" med
 *      nearCity-validering. 404/utgånget → räkna separat (nattens cleanup tar dem).
 *   4. --apply rensar också giftet: extractedAddress "Magasinsgatan 8…" → NULL.
 *
 * Användning:
 *   npm run refetch-tickster                    # dry-run
 *   npm run refetch-tickster -- --apply --limit=700
 */

import { db } from '../config/firebase';
import { sqlite, setEventCoords } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { backfillPlaceFromHtml } from '../sources/engines/sitemap';
import { RawEvent } from '../sources/types';

const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 50;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const THROTTLE_MS = 1500;

interface Row {
    url: string;
    firestoreId: string | null;
    title: string;
    locationName: string | null;
}

async function applyCoords(r: Row, lat: number, lng: number, query: string): Promise<void> {
    setEventCoords(r.url, lat, lng, query);
    if (db && r.firestoreId) {
        try {
            await db.collection('linkEvents').doc(r.firestoreId)
                .update(stamped({ lat, lng, isLocationVerified: true }));
        } catch (e: any) {
            if (e?.code !== 5) console.error(`  ❌ Firestore fail ${r.url.slice(0, 50)}: ${e?.message}`);
        }
    }
}

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    if (APPLY) {
        // Rensa kontorsadress-giftet oavsett koordinat-status (visas i eventkort)
        const cleaned = sqlite.prepare(`
            UPDATE link_events SET extractedAddress = NULL
            WHERE url LIKE '%tickster%' AND extractedAddress LIKE 'Magasinsgatan 8%'
        `).run();
        console.log(`🧹 extractedAddress-gift rensat: ${cleaned.changes} rader`);
    }

    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, locationName
        FROM link_events
        WHERE url LIKE '%tickster%' AND hidden = 0 AND time >= datetime('now')
          AND (lat IS NULL OR lat = 0)
        ORDER BY time ASC
        LIMIT ?
    `).all(LIMIT) as Row[];
    console.log(`${rows.length} o-geokodade Tickster-event (limit ${LIMIT})`);

    let coordsFixed = 0, cityGeocoded = 0, gone = 0, noLead = 0, fetchFail = 0;

    for (const r of rows) {
        await new Promise(res => setTimeout(res, THROTTLE_MS));
        let html: string;
        try {
            const resp = await fetch(r.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
            if (resp.status === 404 || resp.status === 410) { gone++; continue; }
            if (!resp.ok) { fetchFail++; continue; }
            html = await resp.text();
        } catch { fetchFail++; continue; }

        // Minimal RawEvent — backfillPlaceFromHtml fyller coords/city på den.
        const ev: RawEvent = { title: r.title, url: r.url, startDate: new Date() };
        backfillPlaceFromHtml(html, ev);

        if (ev.coords) {
            coordsFixed++;
            console.log(`  📍 ${r.title.slice(0, 45).padEnd(45)} → kart-länk [${ev.coords[0].toFixed(4)},${ev.coords[1].toFixed(4)}]`);
            if (APPLY) await applyCoords(r, ev.coords[0], ev.coords[1], 'tickster kart-länk (refetch)');
            continue;
        }
        if (ev.city) {
            const venue = (r.locationName || '').split(',')[0].trim();
            const q = venue || ev.city;
            const hit = await geocodeVenueSweden(q, { nearCity: ev.city });
            if (hit) {
                cityGeocoded++;
                console.log(`  🏙️ ${r.title.slice(0, 45).padEnd(45)} → "${q}, ${ev.city}" [${hit[0].toFixed(4)},${hit[1].toFixed(4)}]`);
                if (APPLY) await applyCoords(r, hit[0], hit[1], `${q}, ${ev.city} (refetch)`);
                continue;
            }
        }
        noLead++;
    }

    console.log('\n=== Klart ===');
    console.log(`  📍 Kart-länk-koordinater: ${coordsFixed}`);
    console.log(`  🏙️ Ort-geokodade:         ${cityGeocoded}`);
    console.log(`  👻 Borta (404/410):       ${gone}`);
    console.log(`  ○ Ingen ledtråd:          ${noLead}`);
    console.log(`  ⚠️ Fetch-fel:             ${fetchFail}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

if (require.main === module) {
    main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
