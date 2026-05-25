import { db } from '../config/firebase';
import { upsertEvent, sqliteEventExists, getSqliteEvent, getSqlitePath } from './sqliteHelper';

console.log(`🗃️  SQLite-spegel: ${getSqlitePath()}`);

export async function eventExistsInDb(url: string): Promise<boolean> {
    // Snabb lokal check först — undviker Firestore-läsning om vi redan har eventet.
    if (sqliteEventExists(url)) return true;
    if (!db) return false;
    const snapshot = await db.collection('linkEvents').where('url', '==', url).get();
    return !snapshot.empty;
}

export async function getEventFromDb(url: string): Promise<any | null> {
    // Föredra Firestore (auktoritativ källa) men fall tillbaka på SQLite om DB är otillgänglig.
    if (db) {
        const snapshot = await db.collection('linkEvents').where('url', '==', url).limit(1).get();
        if (!snapshot.empty) return snapshot.docs[0].data();
    }
    return getSqliteEvent(url);
}

export async function addEventToDb(eventData: any) {
    // 1. Skriv ALLTID till lokal SQLite först — snabbt, offline-säkert.
    try {
        upsertEvent(eventData);
    } catch (err) {
        console.error('Failed to write event to local SQLite:', err);
    }

    // 2. Skriv till Firestore om initialiserat.
    if (!db) {
        console.warn(`Firebase not initialized. Sparat endast lokalt: ${eventData.title}`);
        return;
    }

    try {
        const existing = await db.collection('linkEvents').where('url', '==', eventData.url).limit(1).get();
        if (!existing.empty) {
            console.log(`Event already in Firestore: ${eventData.title}`);
            // Backfill firestoreId i SQLite om vi inte har den
            const firestoreId = existing.docs[0].id;
            upsertEvent({ ...eventData, firestoreId });
            return;
        }

        const ref = await db.collection('linkEvents').add(eventData);
        // Spara firestoreId tillbaka i SQLite så vi kan korsa referenser
        upsertEvent({ ...eventData, firestoreId: ref.id });
        console.log(`Successfully added to DB: ${eventData.title}`);
    } catch (error) {
        console.error('Failed to add event to Firestore (SQLite-versionen är sparad):', error);
    }
}
