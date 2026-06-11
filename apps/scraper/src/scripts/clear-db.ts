/**
 * clear-db — TÖMMER linkEvents-collectionen i vald DB_TARGET. Destruktivt!
 *
 * Skyddsräcken:
 *   --yes     krävs alltid (ingen interaktiv prompt i cron-miljöer)
 *   --prod    krävs DESSUTOM när DB_TARGET=1 (prod) — dubbelt opt-in
 *
 * Användning:
 *   DB_TARGET=2 npm run clear-db -- --yes          # töm lokala emulatorn
 *   npm run clear-db -- --yes --prod               # töm PROD (vet vad du gör)
 */
import { db, dbTarget } from '../config/firebase';

const args = process.argv.slice(2);

async function clearLinkEvents() {
    if (!db) {
        console.error('❌ Ingen DB initierad (saknas service-account / emulator nere).');
        process.exit(1);
    }
    if (!args.includes('--yes')) {
        console.error(`Detta RADERAR ALLA linkEvents i: ${dbTarget.name} (DB_TARGET=${dbTarget.key})`);
        console.error('Kör igen med --yes för att bekräfta. För prod krävs även --prod.');
        process.exit(1);
    }
    if (dbTarget.key === '1' && !args.includes('--prod')) {
        console.error('❌ DB_TARGET=1 är PROD. Lägg till --prod om du verkligen menar det.');
        process.exit(1);
    }

    console.log(`Tömmer linkEvents i ${dbTarget.name}…`);
    const snapshot = await db.collection('linkEvents').get();

    // Firestore-batchar tål max 500 operationer — chunka.
    let deleted = 0;
    for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = db.batch();
        for (const doc of snapshot.docs.slice(i, i + 500)) batch.delete(doc.ref);
        await batch.commit();
        deleted += Math.min(500, snapshot.docs.length - i);
        console.log(`  …${deleted}/${snapshot.docs.length}`);
    }
    console.log(`Klart — raderade ${deleted} events.`);
}

clearLinkEvents().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
});
