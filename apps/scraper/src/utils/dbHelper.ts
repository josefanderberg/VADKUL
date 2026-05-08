import { db } from '../config/firebase';

export async function eventExistsInDb(url: string): Promise<boolean> {
    if (!db) return false;
    const snapshot = await db.collection('linkEvents').where('url', '==', url).get();
    return !snapshot.empty;
}

export async function addEventToDb(eventData: any) {
    if (!db) {
        console.warn('Firebase not initialized. Cannot save to DB:', eventData.title);
        return;
    }

    try {
        if (await eventExistsInDb(eventData.url)) {
            console.log(`Event already exists: ${eventData.title}`);
            return;
        }

        await db.collection('linkEvents').add(eventData);
        console.log(`Successfully added to DB: ${eventData.title}`);
    } catch (error) {
        console.error('Failed to add event to DB:', error);
    }
}
