import * as admin from 'firebase-admin';

// Initialize in case it hasn't been (though it should be in index.ts)
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const db = admin.firestore();

export async function eventExistsInDb(url: string): Promise<boolean> {
    const snapshot = await db.collection('linkEvents').where('url', '==', url).get();
    return !snapshot.empty;
}

export async function addEventToDb(eventData: any) {
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
