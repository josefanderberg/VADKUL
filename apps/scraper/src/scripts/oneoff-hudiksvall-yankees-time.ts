#!/usr/bin/env ts-node
/**
 * ENGÅNGS: The Yankees i Åkernäsparken fick klockslag (21:00, 15 aug 2026).
 *
 * Eventet lades in utan tid från FB-tråden och låg därför på lokal midnatt —
 * det är så live-spåret kodar "bara datum" (deriveHasSpecificTime i
 * linkEventService läser lokala timmar). Med ett riktigt klockslag härleds
 * hasSpecificTime automatiskt till true, så bara time behöver skrivas.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-hudiksvall-yankees-time.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const DOC_ID = 'zk6NfSgX2VijNXMMCti9';

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    const ref = db.collection('linkEvents').doc(DOC_ID);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`❌ Dokumentet ${DOC_ID} saknas.`); process.exit(1); }

    // Lokal tid — samma tolkning som klienten gör vid utläsning.
    const time = new Date(2026, 7, 15, 21, 0, 0);
    await ref.update({ time: Timestamp.fromDate(time), hasSpecificTime: true });

    console.log(`✅ "${snap.get('title')}" → ${time.toLocaleString('sv-SE', { dateStyle: 'full', timeStyle: 'short' })}`);
    console.log(`   Plats: ${snap.get('locationName')} [${snap.get('lat')}, ${snap.get('lng')}]`);
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
