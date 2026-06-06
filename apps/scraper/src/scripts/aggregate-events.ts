import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';
import * as path from 'path';
import * as fs from 'fs';

interface DestinationLayer {
    id: string;
    title: string;
    time: string;
    lat: number;
    lng: number;
    locationName: string;
    category: string;
}

interface CardLayer {
    id: string;
    title: string;
    time: string;
    locationName: string;
    category: string;
    coverImage: string;
    hostName: string;
    attendees: number;
    isLocationVerified: boolean;
    isHostVerified: boolean;
    url: string;
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

    rows.forEach(row => {
        const id = row.url; // Use url as unique identifier

        destinations.push({
            id,
            title: row.title || '',
            time: row.time,
            lat: Number(row.lat) || 0,
            lng: Number(row.lng) || 0,
            locationName: row.locationName || '',
            category: row.category || 'other'
        });

        cards.push({
            id,
            title: row.title || '',
            time: row.time,
            locationName: row.locationName || '',
            category: row.category || 'other',
            coverImage: row.coverImage || '',
            hostName: row.hostName || '',
            attendees: Number(row.attendees) || 0,
            isLocationVerified: row.isLocationVerified === 1,
            isHostVerified: row.isHostVerified === 1,
            url: row.url
        });

        descriptions[id] = row.description || '';
    });

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
    try {
        await db.collection('aggregatedEvents').doc('destinations').set(destinationsPayload);
        console.log('      ✅ Uploaded "destinations" document');
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
            const entries = Object.entries(descriptions);
            const SHARD_SIZE = Math.max(50, Math.floor(entries.length / Math.ceil(descBytes / 800_000)));
            const shards: Record<string, string>[] = [];
            for (let i = 0; i < entries.length; i += SHARD_SIZE) {
                shards.push(Object.fromEntries(entries.slice(i, i + SHARD_SIZE)));
            }
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

/** Generisk shard-radering. Tar prefix typ "cards_" eller "descriptions_". */
async function deleteShards(db: FirebaseFirestore.Firestore, prefix: string, keepBelow: number = 0): Promise<void> {
    try {
        const snap = await db.collection('aggregatedEvents').get();
        const re = new RegExp(`^${prefix}(\\d+)$`);
        for (const doc of snap.docs) {
            const m = doc.id.match(re);
            if (m && parseInt(m[1], 10) >= keepBelow) {
                await doc.ref.delete();
            }
        }
    } catch { /* ignore */ }
}

// Executed directly
if (require.main === module) {
    const includeUnpublished = process.argv.includes('--include-unpublished');
    runAggregation({ includeUnpublished }).catch(console.error);
}
