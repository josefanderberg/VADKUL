/**
 * K4 post-processor: körs efter FB-skrapan på events med lat=0,lng=0.
 * Anropar Ollama (qwen3:8b) för att extrahera plats ur beskrivning,
 * feedar sedan kandidaten till Nominatim, och uppdaterar SQLite om geocoding lyckas.
 *
 * Körning: npx tsx apps/scraper/src/scripts/llm-enrich-missing.ts
 * Anropas automatiskt från scripts/run-daily.sh efter FB-scrapen.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { llmEnrichEvent, ollamaIsAvailable } from '../utils/llmEnrich';
import { geocodeVenueSweden, isForeignAddress, SWEDISH_GEO_CITIES } from '../utils/venueCoordinates';

const dbPath = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');

const updateStmt = sqlite.prepare(`
    UPDATE link_events
    SET lat = @lat, lng = @lng, geocodedQuery = @geocodedQuery,
        isLocationVerified = 1, updatedAt = @updatedAt
    WHERE url = @url
`);

const updateCategoryStmt = sqlite.prepare(`
    UPDATE link_events
    SET category = @category, updatedAt = @updatedAt
    WHERE url = @url AND (category IS NULL OR category = 'other')
`);

// Skriv bara AI-priset om eventet saknar pris (skriv inte över scraperns).
const updatePriceStmt = sqlite.prepare(`
    UPDATE link_events
    SET price = @price, updatedAt = @updatedAt
    WHERE url = @url AND (price IS NULL OR price = '')
`);

async function main() {
    const available = await ollamaIsAvailable();
    if (!available) {
        console.log('⚠️  Ollama ej tillgänglig på localhost:11434 — hoppar över K4-enrichment.');
        process.exit(0);
    }
    console.log('🤖 K4 LLM-enrichment startar...');

    const missing = sqlite.prepare(`
        SELECT url, title, description, extractedAddress
        FROM link_events
        WHERE lat = 0 AND lng = 0
          AND url LIKE '%facebook%'
          AND (description IS NOT NULL AND description != '')
        ORDER BY createdAt DESC
        LIMIT 500
    `).all() as { url: string; title: string; description: string; extractedAddress: string }[];

    console.log(`📊 ${missing.length} FB-events med lat=0 och beskrivning — skickar till Ollama...`);

    let enriched = 0;
    let geocoded = 0;
    let categoryFixed = 0;
    let junk = 0;

    for (const event of missing) {
        process.stdout.write(`  [${enriched + 1}/${missing.length}] "${event.title.slice(0, 60)}" `);

        const result = await llmEnrichEvent(event.title, event.description, event.extractedAddress);

        if (result.isJunk) {
            process.stdout.write('→ JUNK\n');
            junk++;
            enriched++;
            continue;
        }

        // Hoppa över geocoding om Ollama-kandidaten är utländsk
        // (t.ex. "Taormina", "Madrid", "Nancy" som kan matcha danska/svenska bynamnshomonymer)
        if (result.locationCandidate && isForeignAddress(result.locationCandidate)) {
            process.stdout.write('→ utländsk kandidat (skippad)\n');
            enriched++;
            continue;
        }

        // Acceptera bara geocode-resultat om Ollama angav ett känt svenskt stadsnamn,
        // eller om confidence är high (specifik adress)
        const cityIsSwedish = result.city
            ? SWEDISH_GEO_CITIES.some(c => c.toLowerCase() === result.city!.toLowerCase())
            : false;
        const allowGeocode = cityIsSwedish || result.confidence === 'high';

        // Uppdatera kategori om Ollama gav ett bättre svar
        if (result.category && result.category !== 'other') {
            updateCategoryStmt.run({
                category: result.category,
                updatedAt: new Date().toISOString(),
                url: event.url,
            });
            categoryFixed++;
        }

        // Skriv pris om Ollama hittade ett och eventet saknar det.
        if (result.price) {
            updatePriceStmt.run({
                price: result.price,
                updatedAt: new Date().toISOString(),
                url: event.url,
            });
        }

        // Geocoda plats-kandidaten om vi fick en och den är troligen svensk
        if (result.locationCandidate && allowGeocode) {
            const query = result.city
                ? `${result.locationCandidate}, ${result.city}`
                : result.locationCandidate;

            const coords = await geocodeVenueSweden(query);
            if (coords) {
                updateStmt.run({
                    lat: coords[0],
                    lng: coords[1],
                    geocodedQuery: query,
                    updatedAt: new Date().toISOString(),
                    url: event.url,
                });
                geocoded++;
                process.stdout.write(`→ ✅ [${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}] (${result.confidence})\n`);
            } else {
                process.stdout.write(`→ ⚠️  Ollama: "${result.locationCandidate}" — Nominatim miss\n`);
            }
        } else {
            process.stdout.write(`→ ingen plats (confidence: ${result.confidence})\n`);
        }

        enriched++;
    }

    console.log(`\n🎉 K4 klar:`);
    console.log(`  Behandlade: ${enriched}`);
    console.log(`  Geocodade:  ${geocoded} (lat/lng uppdaterade)`);
    console.log(`  Kategori:   ${categoryFixed} (category uppdaterade)`);
    console.log(`  Junk:       ${junk}`);
    console.log(`  Missade:    ${enriched - geocoded - junk}`);

    sqlite.close();
}

main().catch(err => {
    console.error('❌ K4 fel:', err);
    process.exit(1);
});
