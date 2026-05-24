#!/usr/bin/env ts-node
/**
 * Tar bort alla linkEvents vars starttid är före dagens 00:00 lokal tid.
 *
 * Körs först varje dag innan scraperna så listan är fräsch.
 *
 * Skriver en kort JSON-rad till stdout (`{"deleted": N}`) så wrappern kan
 * plocka upp siffran för Teams-notisen.
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

async function main() {
    if (!db) throw new Error('Firestore not initialized');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    console.log(`🗑️  Rensar linkEvents där time < ${startOfToday.toISOString()}`);

    const snap = await db.collection('linkEvents')
        .where('time', '<', Timestamp.fromDate(startOfToday))
        .get();

    if (snap.empty) {
        console.log('✅ Inget att rensa.');
        console.log(JSON.stringify({ deleted: 0 }));
        return;
    }

    // Firestore-batchar har en gräns på 500 ops — chunka för säkerhets skull
    const docs = snap.docs;
    let deleted = 0;
    for (let i = 0; i < docs.length; i += 400) {
        const batch = db.batch();
        const slice = docs.slice(i, i + 400);
        slice.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deleted += slice.length;
        console.log(`   ...raderade ${deleted}/${docs.length}`);
    }

    console.log(`✅ Klar. Raderade ${deleted} event.`);
    console.log(JSON.stringify({ deleted }));
}

if (require.main === module) {
    main()
        .catch(err => {
            console.error('❌ Cleanup kraschade:', err);
            process.exitCode = 1;
        })
        .finally(() => process.exit(process.exitCode || 0));
}
