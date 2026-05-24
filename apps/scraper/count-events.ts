import { db } from './src/config/firebase';

async function countEvents() {
    if (!db) {
        console.error("Firebase db is not initialized.");
        process.exit(1);
    }
    console.log("Counting events in Firestore...");
    
    const eventsSnap = await db.collection('events').get();
    console.log(`- events: ${eventsSnap.size}`);
    
    const linkEventsSnap = await db.collection('linkEvents').get();
    console.log(`- linkEvents: ${linkEventsSnap.size}`);
    
    // Let's also fetch and count upcoming/total events
    const now = new Date();
    
    const upcomingEventsSnap = await db.collection('events')
        .where('time', '>=', now)
        .get().catch(() => ({ size: 'N/A' }));
    
    const upcomingLinkEventsSnap = await db.collection('linkEvents')
        .where('time', '>=', now)
        .get().catch(() => ({ size: 'N/A' }));

    console.log(`- upcoming events: ${upcomingEventsSnap.size}`);
    console.log(`- upcoming linkEvents: ${upcomingLinkEventsSnap.size}`);
}

countEvents().then(() => process.exit(0)).catch(console.error);
