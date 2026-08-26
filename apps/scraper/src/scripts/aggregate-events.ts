/**
 * Publik länk = rå URL minus FRÄMMANDE affiliate-parametrar. Ticketmaster-
 * skrapern klistrade 31 maj–28 jul ?c=8469859&ac=1 på länkarna — koden är
 * inte vår (Impact-publisher 7528311) och att servera den är precis vad
 * TM/Impact-compliance underkänner vid programansökan. URL:en i DB rörs
 * inte (primärnyckel + share-slug-bas); städningen sker här i utkanten.
 * När vårt Impact-program är godkänt: lägg den RIKTIGA spårningslänken här.
 */
const FOREIGN_AFFILIATE_PARAMS: Record<string, string[]> = {
    'ticketmaster.': ['c', 'ac'],
    'universe.com': ['c', 'ac', 'ref'],
};
/** Impact Radius-/affiliate-redirectdomäner: länken bär destinationen i ?u= */
const AFFILIATE_REDIRECT_HOST = /\.(evyy\.net|sjv\.io|pxf\.io|7eer\.net|ojrq\.net|i\d+\.net|prf\.hn|go2cloud\.org)$/i;
export function publicUrl(raw: string): string {
    try {
        let u = new URL(raw);
        // Någon ANNANS Impact-redirect ("ticketmaster.evyy.net/c/8469859/…?u=…"):
        // packa upp till den riktiga sidan — vi ska aldrig skicka trafik genom
        // främmande spårningslänkar, oavsett vems.
        if (AFFILIATE_REDIRECT_HOST.test(u.hostname)) {
            const inner = u.searchParams.get('u') || u.searchParams.get('url');
            if (inner && /^https?:\/\//.test(inner)) u = new URL(inner);
        }
        for (const [hostPart, params] of Object.entries(FOREIGN_AFFILIATE_PARAMS)) {
            if (!u.hostname.includes(hostPart)) continue;
            if (u.searchParams.get('c') !== '8469859' && !u.searchParams.has('ref')) continue;
            params.forEach((k) => u.searchParams.delete(k));
        }
        if (u.searchParams.get('utm_medium') === 'affiliate') u.searchParams.delete('utm_medium');
        return u.toString().replace(/\?$/, '');
    } catch { return raw; }
}

import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';
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
}

interface CardLayer {
    id: string;
    title: string;
    time: string;
    /** Validerat slutdatum (ISO) — bara med när det finns (flerdagarsevent). */
    endDate?: string;
    /** false = källan gav bara datum — webben visar då ingen klocktid. */
    hasSpecificTime: boolean;
    locationName: string;
    category: string;
    coverImage: string;
    hostName: string;
    attendees: number;
    price: string;
    isLocationVerified: boolean;
    isHostVerified: boolean;
    url: string;
    /** Per-event-emoji från AI-audit. */
    emoji?: string;
    /** true = koordinaten är stadens mittpunkt (geoPrecision='stad-centroid'). */
    approxGeo?: boolean;
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
    const safeCoord = (lat: number, lng: number): [number, number] => {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return [lat, lng];
        droppedCoords++;
        return [0, 0];
    };

    let skippedNoUrl = 0;
    rows.forEach(row => {
        const id = row.url; // Use url as unique identifier
        // Utan url finns ingen nyckel: alla sådana rader delar id "" och skriver
        // över varandra i descriptions-mappen — och en tom mapp-nyckel avvisas
        // dessutom av Firestore ("Element at index 0 should not be an empty
        // string"), vilket fällde HELA descriptions-uppladdningen. VADKUL-värdade
        // event saknar url by design och läses live, inte härifrån.
        if (!id) { skippedNoUrl++; return; }
        const [safeLat, safeLng] = safeCoord(Number(row.lat) || 0, Number(row.lng) || 0);
        // NULL (legacy-rad som inte backfillats) tolkas som "har tid" bara om
        // klockslaget inte är midnatt — samma heuristik som webben använt.
        const t = new Date(row.time);
        const hasSpecificTime = row.hasSpecificTime != null
            ? row.hasSpecificTime === 1
            : !((t.getHours() === 0 && t.getMinutes() === 0) || (t.getUTCHours() === 0 && t.getUTCMinutes() === 0));

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
            emoji: row.emoji || undefined
        });

        cards.push({
            id,
            title: row.title || '',
            time: row.time,
            endDate: row.endDate || undefined,
            hasSpecificTime,
            locationName: row.locationName || '',
            category: row.category || 'other',
            coverImage: row.coverImage || '',
            hostName: row.hostName || '',
            attendees: Number(row.attendees) || 0,
            price: row.price || '',
            isLocationVerified: row.isLocationVerified === 1,
            isHostVerified: row.isHostVerified === 1,
            url: publicUrl(row.url),
            emoji: row.emoji || undefined,
            // Positionen är stadens mittpunkt, inte platsen — låter webben visa
            // "ungefär i {stad}" i stället för att låtsas vara en exakt nål.
            // Utelämnas helt annars (bytes × 30k event i aggregatet).
            approxGeo: row.geoPrecision === 'stad-centroid' ? true : undefined
        });

        descriptions[id] = row.description || '';
    });

    if (skippedNoUrl > 0) {
        console.log(`   ⏭  ${skippedNoUrl} event utan url hoppades över (saknar aggregat-nyckel).`);
    }
    if (droppedCoords > 0) {
        console.log(`   ⚠️  ${droppedCoords} event hade ogiltiga koordinater (utanför WGS84) — sanerade till 0,0 i kartlagret`);
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
            await db.collection('aggregatedEvents').doc('destinations').set({
                updatedAt, shardCount: shards.length, totalEvents: destinations.length,
            });
            for (let i = 0; i < shards.length; i++) {
                await db.collection('aggregatedEvents').doc(`destinations_${i}`).set({
                    updatedAt, shardIndex: i, events: shards[i],
                });
            }
            await deleteShards(db, 'destinations_', shards.length);
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
            await db.collection('aggregatedEvents').doc('cards').set({
                updatedAt, shardCount: shards.length, totalEvents: cards.length,
            });
            for (let i = 0; i < shards.length; i++) {
                await db.collection('aggregatedEvents').doc(`cards_${i}`).set({
                    updatedAt, shardIndex: i, events: shards[i],
                });
            }
            await deleteShards(db, 'cards_', shards.length);
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
            await db.collection('aggregatedEvents').doc('descriptions').set({
                updatedAt, shardCount: shards.length, totalEntries: entries.length,
            });
            for (let i = 0; i < shards.length; i++) {
                await db.collection('aggregatedEvents').doc(`descriptions_${i}`).set({
                    updatedAt, shardIndex: i, data: shards[i],
                });
            }
            await deleteShards(db, 'descriptions_', shards.length);
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
