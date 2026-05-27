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

export async function runAggregation() {
    console.log('\n📊 Starting VADKUL Event Aggregator...');
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    const nowIso = now.toISOString();

    // 1. Fetch active events from SQLite
    const rows = sqlite.prepare(`
        SELECT * FROM link_events 
        WHERE hidden = 0 AND time >= ? 
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

    try {
        console.log('   📤 Uploading aggregated layers to Firestore collection "aggregatedEvents"...');
        
        await db.collection('aggregatedEvents').doc('destinations').set(destinationsPayload);
        console.log('      ✅ Uploaded "destinations" document');

        await db.collection('aggregatedEvents').doc('cards').set(cardsPayload);
        console.log('      ✅ Uploaded "cards" document');

        await db.collection('aggregatedEvents').doc('descriptions').set(descriptionsPayload);
        console.log('      ✅ Uploaded "descriptions" document');

        console.log('   🎉 Event aggregation completed successfully.');
    } catch (dbErr) {
        console.error('   ❌ Failed to upload aggregated documents to Firestore:', dbErr);
    }
}

// Executed directly
if (require.main === module) {
    runAggregation().catch(console.error);
}
