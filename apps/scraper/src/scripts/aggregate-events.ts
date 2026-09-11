import { db } from '../config/firebase';
import { publicUrl } from '../utils/affiliateUrl';
import { sqlite } from '../utils/sqliteHelper';
import { applyVenueFixInPlace } from '../data/venueFixes';
import { buildTitleFreq, isPopularEvent, normTitlePop } from '../utils/popularEvent';
import { eventKey } from '../utils/eventKey';
import { uploadPrepackedBlobs } from '../utils/aggregateBlobs';
import * as path from 'path';
import * as fs from 'fs';

interface DestinationLayer {
    id: string;
    title: string;
    time: string;
    /** Validerat slutdatum (ISO) — bara med när det finns (flerdagarsevent). */
    endDate?: string;
    /** false = källan gav bara datum (midnatt är platshållare) — webben visar då ingen klocktid. */
    hasSpecificTime: boolean;
    lat: number;
    lng: number;
    locationName: string;
    category: string;
    /** Per-event-emoji från AI-audit (🧘/🏃 osv) — webben föredrar denna framför kategori-default. */
    emoji?: string;
    /** true = 🔥 Populär (utils/popularEvent). Utelämnas annars (bytes × 30k event i aggregatet). */
    pop?: true;
}

/**
 * SLANKT kortlager (2026-09-11). Bar tidigare hela url:en två gånger (`id` +
 * `url`) plus sju fält som destinations redan levererar — webbens
 * mergeCardsWithDestinations läste aldrig något av det. Mätt på skarpa datat
 * (44k event): 2,76 → 1,16 MB brotli, −58 %, utan att en enda besökare ser
 * någon skillnad.
 *
 * Regeln för vad som får bo här: bara fält som INTE finns i destinations och
 * som någon faktiskt läser. Tomma värden utelämnas (bytes × 44k event).
 *
 * ⚠️ Formatet har fler läsare än kartan — alla slår upp kortet via `h`
 * (eller via gamla `id`) och måste hållas toleranta: linkEventService,
 * cityData, shareData, lib/deepLinkEventIndex (/api/event), scraperns
 * seed-sqlite-from-aggregate (Stadsinlägg-workflowen) och
 * docs/outreach/generate-arrangorer.mjs.
 */
interface CardLayer {
    /** Join-nyckel mot destinations `id` — se utils/eventKey. Ersätter hela url:en. */
    h: string;
    coverImage?: string;
    hostName?: string;
    attendees?: number;
    price?: string;
    isLocationVerified?: true;
    isHostVerified?: true;
    /**
     * Bara när publicUrl() faktiskt skrivit om länken (affiliate-wrap,
     * param-städning, värd-reparation) — ~2 % av eventen. Är den lika med
     * destinations `id` utelämnas den och ALLA läsare faller tillbaka dit
     * (även stadssidornas BOKA-knapp: isAffiliateUrl(card.url ?? id)).
     */
    url?: string;
    /** true = koordinaten är stadens mittpunkt (geoPrecision='stad-centroid'). */
    approxGeo?: true;
}

export async function runAggregation(opts: { includeUnpublished?: boolean } = {}) {
    console.log('\n📊 Starting VADKUL Event Aggregator...');
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    const nowIso = now.toISOString();

    const statusFilter = opts.includeUnpublished
        ? ''
        : "AND status = 'published'";
    if (opts.includeUnpublished) {
        console.log('   ⚠️  --include-unpublished: raw/audited events ingår i exporten');
    }

    // 1. Fetch active events from SQLite
    const rows = sqlite.prepare(`
        SELECT * FROM link_events
        WHERE hidden = 0 ${statusFilter} AND time >= ?
        ORDER BY time ASC
    `).all(nowIso) as any[];

    console.log(`   Found ${rows.length} active events to aggregate.`);

    const updatedAt = new Date().toISOString();

    // 2. Build the progressive layers
    const destinations: DestinationLayer[] = [];
    const cards: CardLayer[] = [];
    const descriptions: Record<string, string> = {};

    // Skyddsvakt: en enda koordinat utanför WGS84-intervallet (projicerade
    // SWEREF99/RT90-koords från paraply-API:er) kraschar HELA Mapbox-kartan i
    // dess bounds-filter. Sanera till 0,0 (webben döljer 0,0) så ett dåligt
    // event aldrig kan släcka kartan för alla andra. Loggas för uppföljning.
    let droppedCoords = 0;
    let venueFixed = 0;
    const safeCoord = (lat: number, lng: number): [number, number] => {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
        droppedCoords++;
        return [0, 0];
    };

    // 🔥-klassningen behöver global titelfrekvens (rutindetektorn) — räknas
    // över exakt den radmängd som aggregeras, samma semantik som webbens
    // repeatCount i cityData.
    const titleFreq = buildTitleFreq(rows);
    let popCount = 0;

    let skippedNoUrl = 0;
    rows.forEach(row => {
        const id = row.url; // Use url as unique identifier
        // Utan url finns ingen nyckel: alla sådana rader delar id "" och skriver
        // över varandra i descriptions-mappen — och en tom mapp-nyckel avvisas
        // dessutom av Firestore ("Element at index 0 should not be an empty
        // string"), vilket fällde HELA descriptions-uppladdningen. VADKUL-värdade
        // event saknar url by design och läses live, inte härifrån.
        if (!id) { skippedNoUrl++; return; }
        // Venue-vakt: manuellt verifierade koordinater tvingas ÄVEN här, sist i
        // kedjan före publicering. Nattens venue-fixes-steg kan faila tyst
        // (run-daily.sh kör vidare på ⚠️ — Piteå 5/9: aggregatet byggdes med
        // skogen kvar trots steget), och audit-daemonens omaggregeringar går
        // också genom runAggregation — så vakten här täcker båda vägarna.
        if (applyVenueFixInPlace(row)) venueFixed++;
        const [safeLat, safeLng] = safeCoord(Number(row.lat) || 0, Number(row.lng) || 0);
        // NULL (legacy-rad som inte backfillats) tolkas som "har tid" bara om
        // klockslaget inte är midnatt — samma heuristik som webben använt.
        const t = new Date(row.time);
        const hasSpecificTime = row.hasSpecificTime != null
            ? row.hasSpecificTime === 1
            : !((t.getHours() === 0 && t.getMinutes() === 0) || (t.getUTCHours() === 0 && t.getUTCMinutes() === 0));

        const pop = isPopularEvent(
            {
                url: id,
                title: row.title || '',
                time: row.time,
                category: row.category || 'other',
                hasSpecificTime,
                coverImage: row.coverImage,
                price: row.price,
                attendees: Number(row.attendees) || 0,
                locationName: row.locationName,
            },
            titleFreq.get(normTitlePop(row.title || '')) ?? 1,
        ) ? true as const : undefined;
        if (pop) popCount++;

        destinations.push({
            id,
            title: row.title || '',
            time: row.time,
            // Utelämnas när okänt — bara flerdagars-/sluttids-event bär fältet
            // (bytes × 30k event i aggregatet).
            endDate: row.endDate || undefined,
            hasSpecificTime,
            lat: safeLat,
            lng: safeLng,
            locationName: row.locationName || '',
            category: row.category || 'other',
            emoji: row.emoji || undefined,
            pop
        });

        // Bara det destinations INTE redan bär. Tomma värden utelämnas — webben
        // sätter tillbaka samma default ('' / 0 / false) vid sammanslagningen.
        const publicHref = publicUrl(row.url);
        cards.push({
            h: eventKey(id),
            coverImage: row.coverImage || undefined,
            hostName: row.hostName || undefined,
            attendees: Number(row.attendees) || undefined,
            price: row.price || undefined,
            isLocationVerified: row.isLocationVerified === 1 ? true : undefined,
            isHostVerified: row.isHostVerified === 1 ? true : undefined,
            // Lika med id för 98,3 % av eventen → skicka bara skillnaden.
            url: publicHref !== id ? publicHref : undefined,
            // Positionen är stadens mittpunkt, inte platsen — låter webben visa
            // "ungefär i {stad}" i stället för att låtsas vara en exakt nål.
            // Utelämnas helt annars (bytes × 47k event i aggregatet).
            approxGeo: row.geoPrecision === 'stad-centroid' ? true : undefined,
        });

        descriptions[id] = row.description || '';
    });

    if (skippedNoUrl > 0) {
        console.log(`   ⏭  ${skippedNoUrl} event utan url hoppades över (saknar aggregat-nyckel).`);
    }
    console.log(`   🔥 ${popCount} av ${destinations.length} event klassade som Populära (${destinations.length ? Math.round(popCount / destinations.length * 100) : 0} %)`);
    if (droppedCoords > 0) {
        console.log(`   ⚠️  ${droppedCoords} event hade ogiltiga koordinater (utanför WGS84) — sanerade till 0,0 i kartlagret`);
    }
    if (venueFixed > 0) {
        console.log(`   📍 ${venueFixed} event fick verifierade venue-koordinater vid aggregering (venueFixes-vakten)`);
    }

    // "Null island": ogeokodade events på (0,0) och dess närområde. De stannar
    // kvar i destinations-lagret (och därmed i list-/sökvyn) men webben döljer
    // dem på kartan (isValidLatLng). Logga omfattningen så vi ser hur stor
    // geokodnings-skulden är.
    const nullIslandCount = destinations.filter(
        d => Math.abs(d.lat) < 0.01 && Math.abs(d.lng) < 0.01
    ).length;
    if (nullIslandCount > 0) {
        console.log(`   🏝️  ${nullIslandCount} av ${destinations.length} event ligger på null island (0,0) — döljs från kartan, kvar i list-/sökvy`);
    }

    // Lagren ligger kvar i TIDSORDNING (SQL:ens ORDER BY time). Platssortering
    // prövades 2026-09-11 och ströks: bara −4 % i brotli (2,89 mot 3,02 MB per
    // besökare), men kartans tidssortering i (v2)/page.tsx — som körs vid
    // varje callback — gick från 0,4 till 6,8 ms på 44k event eftersom indatan
    // inte längre var försorterad. Tidsordningen är dessutom grunden för
    // tidsfönster-steget i docs/egress-optimering.md.
    const destinationsPayload = { updatedAt, events: destinations };
    const cardsPayload = { updatedAt, events: cards };
    const descriptionsPayload = { updatedAt, data: descriptions };

    // 3. Save to local JSON files in Next.js public directory
    const webPublicDir = path.resolve(__dirname, '../../../web/public');
    
    // Ensure web public directory exists (might be running scraper standalone)
    if (fs.existsSync(webPublicDir)) {
        try {
            fs.writeFileSync(path.join(webPublicDir, 'events-destinations.json'), JSON.stringify(destinationsPayload, null, 2), 'utf-8');
            fs.writeFileSync(path.join(webPublicDir, 'events-cards.json'), JSON.stringify(cardsPayload, null, 2), 'utf-8');
            fs.writeFileSync(path.join(webPublicDir, 'events-descriptions.json'), JSON.stringify(descriptionsPayload, null, 2), 'utf-8');
            console.log('   ✅ Saved static JSON files in apps/web/public/');
        } catch (writeErr) {
            console.error('   ⚠️ Failed to write local static JSON files:', writeErr);
        }
    } else {
        console.log('   ℹ️ Next.js web app public directory not found. Skipping local JSON files write.');
    }

    // 4. Upload to Firestore under 'aggregatedEvents' collection
    if (!db) {
        console.warn('   ⚠️ Firebase Firestore is not initialized. Skipping Firestore upload.');
        return;
    }

    console.log('   📤 Uploading aggregated layers to Firestore collection "aggregatedEvents"...');

    // Förpackade blobbar (brotli q11 + gzip 9) FÖRE JSON-lagren: routen matchar
    // blobben på exakt updatedAt, så när lagrets nya updatedAt blir synligt ska
    // blobben redan ligga där (miss → routens q6-väg, bara långsammare). Ett
    // blob-fel får aldrig stoppa JSON-uppladdningen — den är sanningskällan.
    for (const [layer, payload] of [
        ['destinations', destinationsPayload],
        ['cards', cardsPayload],
        ['descriptions', descriptionsPayload],
    ] as const) {
        try {
            await uploadPrepackedBlobs(db, layer, updatedAt, Buffer.from(JSON.stringify(payload)));
        } catch (e) {
            console.error(`      ⚠️ Blob "${layer}" misslyckades (routen packar q6 själv):`, (e as Error).message);
        }
    }

    // Varje upload försöker separat — en stor doc ska inte stoppa de andra.
    // Destinations: shardas likt cards om för stort (passerade 1 MB-gränsen
    // 2026-06-11 när per-event-emojin tillkom — webbens fetchLayer är generisk).
    try {
        const destBytes = Buffer.byteLength(JSON.stringify(destinationsPayload), 'utf-8');
        if (destBytes < 900_000) {
            await db.collection('aggregatedEvents').doc('destinations').set(destinationsPayload);
            await deleteShards(db, 'destinations_');
            console.log(`      ✅ Uploaded "destinations" document (${(destBytes / 1024).toFixed(0)} KB)`);
        } else {
            // Packa på FAKTISKA bytes, inte antal: ett antal-baserat tak (2000 st)
            // spräcker Firestores 1 MB-doc om snitt-eventet växer (längre titlar/
            // platsnamn eller fler emoji-rika rader klumpas ihop). Byte-budget
            // garanterar att INGEN shard kan passera taket — samma robusta mönster
            // som descriptions-lagret nedan. 700 KB ger marginal för Firestore-
            // overhead (fältnamn/index) ovanpå JSON-måttet.
            const SHARD_BYTE_BUDGET = 700_000;
            const shards: any[][] = [];
            let current: any[] = [];
            let currentBytes = 50;   // klammer + updatedAt/shardIndex-overhead
            for (const evt of destinations) {
                const evtBytes = Buffer.byteLength(JSON.stringify(evt), 'utf8') + 1;   // +komma
                if (currentBytes + evtBytes > SHARD_BYTE_BUDGET && current.length > 0) {
                    shards.push(current);
                    current = [];
                    currentBytes = 50;
                }
                current.push(evt);
                currentBytes += evtBytes;
            }
            if (current.length > 0) shards.push(current);
            console.log(`      ℹ️  Destinations är ${(destBytes / 1024).toFixed(0)} KB > 900 KB → shardas i ${shards.length} delar (byte-budget)`);
            await uploadShardedLayer(db, 'destinations',
                { updatedAt, shardCount: shards.length, totalEvents: destinations.length },
                shards.map((events, i) => ({ updatedAt, shardIndex: i, events })));
            console.log(`      ✅ Uploaded "destinations" + ${shards.length} shards`);
        }
    } catch (e) {
        console.error('      ❌ "destinations" upload failed:', (e as Error).message);
    }

    // Cards: shardas om för stort. Firestore-limit: 1 MB per dokument.
    try {
        const cardsBytes = Buffer.byteLength(JSON.stringify(cardsPayload), 'utf-8');
        if (cardsBytes < 900_000) {
            // Får plats i ett dokument
            await db.collection('aggregatedEvents').doc('cards').set(cardsPayload);
            // Rensa ev. tidigare shards
            await deleteCardsShards(db);
            console.log(`      ✅ Uploaded "cards" document (${(cardsBytes / 1024).toFixed(0)} KB)`);
        } else {
            // Sharda. Index-doc har shardCount, varje shard har events-array.
            const SHARD_SIZE = 700;
            const shards: any[][] = [];
            for (let i = 0; i < cards.length; i += SHARD_SIZE) {
                shards.push(cards.slice(i, i + SHARD_SIZE));
            }
            console.log(`      ℹ️  Cards är ${(cardsBytes / 1024).toFixed(0)} KB > 900 KB → shardas i ${shards.length} delar`);
            await uploadShardedLayer(db, 'cards',
                { updatedAt, shardCount: shards.length, totalEvents: cards.length },
                shards.map((events, i) => ({ updatedAt, shardIndex: i, events })));
            console.log(`      ✅ Uploaded "cards" + ${shards.length} shards`);
        }
    } catch (e) {
        console.error('      ❌ "cards" upload failed:', (e as Error).message);
    }

    // Descriptions: shardas likt cards om för stort
    try {
        const descBytes = Buffer.byteLength(JSON.stringify(descriptionsPayload), 'utf-8');
        if (descBytes < 900_000) {
            await db.collection('aggregatedEvents').doc('descriptions').set(descriptionsPayload);
            await deleteShards(db, 'descriptions_');
            console.log(`      ✅ Uploaded "descriptions" document (${(descBytes / 1024).toFixed(0)} KB)`);
        } else {
            // Packa på FAKTISKA bytes, inte antal: beskrivningar varierar vilt i
            // längd, och klumpar långa texter ihop sig spräcker en antal-baserad
            // shard 1 MB-taket (descriptions_0 låg på 1024 KB 2026-06-12 — en
            // hårsmån från write-fail). 700 KB-budget ger marginal för
            // Firestore-overhead (fältnamn/index) ovanpå JSON-måttet.
            const SHARD_BYTE_BUDGET = 700_000;
            const entries = Object.entries(descriptions);
            const shards: Record<string, string>[] = [];
            let current: Record<string, string> = {};
            let currentBytes = 50;   // klammer + updatedAt/shardIndex-overhead
            for (const [id, desc] of entries) {
                const entryBytes = Buffer.byteLength(JSON.stringify(id), 'utf8')
                    + Buffer.byteLength(JSON.stringify(desc ?? ''), 'utf8') + 2;
                if (currentBytes + entryBytes > SHARD_BYTE_BUDGET && Object.keys(current).length > 0) {
                    shards.push(current);
                    current = {};
                    currentBytes = 50;
                }
                current[id] = desc;
                currentBytes += entryBytes;
            }
            if (Object.keys(current).length > 0) shards.push(current);
            console.log(`      ℹ️  Descriptions är ${(descBytes / 1024).toFixed(0)} KB > 900 KB → shardas i ${shards.length} delar`);
            await uploadShardedLayer(db, 'descriptions',
                { updatedAt, shardCount: shards.length, totalEntries: entries.length },
                shards.map((data, i) => ({ updatedAt, shardIndex: i, data })));
            console.log(`      ✅ Uploaded "descriptions" + ${shards.length} shards`);
        }
    } catch (e) {
        console.error('      ❌ "descriptions" upload failed:', (e as Error).message);
    }

    console.log('   🎉 Event aggregation completed successfully.');
}

/** Radera cards_<N> shards som inte längre används. */
async function deleteCardsShards(db: FirebaseFirestore.Firestore, keepBelow: number = 0): Promise<void> {
    return deleteShards(db, 'cards_', keepBelow);
}

/**
 * Shardad uppladdning i LÄSSÄKER ordning: alla shards FÖRST, index-dokumentet
 * SIST, städning av överblivna shards därefter. Webbens API-route läser index
 * → shards och CACHAR resultatet nycklat på index-docens updatedAt — skrevs
 * indexet först (som t.o.m. 31/8) kunde en läsare mitt i fönstret få nytt
 * index + gamla shards, och den blandningen fastnade i cachen en hel
 * aggregatgeneration (hände skarpt 2026-08-31 ~13:26Z). Med index sist pekar
 * en färsk updatedAt alltid på fullt skrivna shards.
 */
export async function uploadShardedLayer(
    db: FirebaseFirestore.Firestore,
    baseDocId: string,
    indexPayload: Record<string, unknown>,
    shardPayloads: Record<string, unknown>[],
): Promise<void> {
    const prefix = `${baseDocId}_`;
    for (let i = 0; i < shardPayloads.length; i++) {
        await db.collection('aggregatedEvents').doc(`${prefix}${i}`).set(shardPayloads[i]);
    }
    await db.collection('aggregatedEvents').doc(baseDocId).set(indexPayload);
    await deleteShards(db, prefix, shardPayloads.length);
}

/**
 * Generisk shard-radering. Tar prefix typ "cards_" eller "descriptions_".
 *
 * listDocuments() — ALDRIG get(): vi behöver bara dokument-ID:na för att matcha
 * "<prefix><N>", och shard-dokumenten är ~684 KB styck. En get() laddade ner
 * HELA kollektionen (33,6 MB) — tre gånger per aggregatkörning, en per
 * payload-grupp — enbart för att läsa ID-strängar. Aggregatet körs om varje
 * gång audit-daemonen betat av en batch, så det blev ~100 MB egress per
 * körning och den överlägset största posten på Firebase-fakturan:
 * 134 GiB / 144 kr i augusti = 76 % av notan. listDocuments() hämtar bara
 * namnen och kostar i praktiken ingenting.
 */
export async function deleteShards(db: FirebaseFirestore.Firestore, prefix: string, keepBelow: number = 0): Promise<void> {
    try {
        const refs = await db.collection('aggregatedEvents').listDocuments();
        const re = new RegExp(`^${prefix}(\\d+)$`);
        for (const ref of refs) {
            const m = ref.id.match(re);
            if (m && parseInt(m[1], 10) >= keepBelow) {
                await ref.delete();
            }
        }
    } catch { /* ignore */ }
}

// Executed directly
if (require.main === module) {
    const includeUnpublished = process.argv.includes('--include-unpublished');
    runAggregation({ includeUnpublished }).catch(console.error);
}
