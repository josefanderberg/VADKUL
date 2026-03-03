/**
 * Script: deleteAllLinkEvents.ts
 * Usage: npx ts-node src/scripts/deleteAllLinkEvents.ts
 *
 * Deletes ALL documents in the 'linkEvents' Firestore collection.
 * Run this before re-scraping to get a clean slate.
 */
import { db } from '../config/firebase';

async function deleteAllLinkEvents() {
    if (!db) {
        console.error('Firebase not initialized!');
        return;
    }
    console.log('Fetching all linkEvents...');
    const snapshot = await db.collection('linkEvents').get();

    if (snapshot.empty) {
        console.log('No events found. Nothing to delete.');
        return;
    }

    console.log(`Found ${snapshot.size} events. Deleting in batches...`);

    // Firestore allows max 500 operations per batch
    const BATCH_SIZE = 400;
    const docs = snapshot.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + BATCH_SIZE);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`Deleted ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length}`);
    }

    console.log('✅ All linkEvents deleted successfully!');
}

deleteAllLinkEvents().catch(console.error);
