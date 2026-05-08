import { db } from './src/config/firebase';

async function clearOldLinkEvents() {
    console.log("Clearing old linkEvents...");
    const snapshot = await db!.collection('linkEvents').get();
    const batch = db!.batch();
    snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`Deleted ${snapshot.docs.length} events.`);
}

clearOldLinkEvents().then(() => process.exit(0)).catch(console.error);
