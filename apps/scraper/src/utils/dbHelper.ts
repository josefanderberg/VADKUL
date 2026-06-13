import { db } from '../config/firebase';
import { upsertEvent, sqliteEventExists, getSqliteEvent, getSqlitePath, setEventTime } from './sqliteHelper';

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

/**
 * Uppdatera tiden för ett KÄNT event (full-refresh-körningar i runnern).
 * Skriver SQLite + Firestore. Returnerar true om något faktiskt ändrades.
 *
 * Skyddsregler:
 *  - <1 min skillnad → ingen ändring (ISO-brus).
 *  - Nedgradera aldrig: ett riktigt klockslag ersätts inte av en ren
 *    datum-rad (midnatt) på samma lokala dag — det betyder bara att källan
 *    visade serie-/listvyn denna gång. Flyttas DAGEN uppdaterar vi dock,
 *    även om nya tiden saknar klockslag.
 */
export async function refreshEventTime(
    url: string,
    newTime: Date,
    newHasSpecificTime: boolean,
): Promise<boolean> {
    const row = getSqliteEvent(url);
    if (!row?.time) return false;

    const stored = new Date(row.time);
    if (isNaN(stored.getTime())) return false;
    if (Math.abs(stored.getTime() - newTime.getTime()) < 60_000) return false;

    const sameLocalDay = stored.toLocaleDateString('sv-SE') === newTime.toLocaleDateString('sv-SE');
    const storedHasTime = row.hasSpecificTime === 1
        || (row.hasSpecificTime == null
            && !(stored.getHours() === 0 && stored.getMinutes() === 0)
            && !(stored.getUTCHours() === 0 && stored.getUTCMinutes() === 0));
    if (sameLocalDay && storedHasTime && !newHasSpecificTime) return false;

    try {
        setEventTime(url, newTime.toISOString(), newHasSpecificTime);
    } catch (err) {
        console.error('refreshEventTime: SQLite-uppdatering misslyckades:', err);
        return false;
    }
    if (db && row.firestoreId) {
        try {
            await db.collection('linkEvents').doc(row.firestoreId).update({ time: newTime });
        } catch (err: any) {
            // NOT_FOUND (kod 5) = dokumentet rensat ur Firestore — SQLite räcker.
            if (err?.code !== 5) console.error('refreshEventTime: Firestore-uppdatering misslyckades:', err?.message);
        }
    }
    return true;
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
        console.log(`✅ Saved: ${eventData.title}`);
    } catch (error) {
        console.error('Failed to add event to Firestore (SQLite-versionen är sparad):', error);
    }
}
