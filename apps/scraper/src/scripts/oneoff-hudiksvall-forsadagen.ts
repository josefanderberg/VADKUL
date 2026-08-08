#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Forsadagen tillbaka till den SKRAPADE pipelinen.
 *
 * Av de 14 community-eventen är Forsadagen det enda med en riktig källänk
 * (Facebook-eventet). Ett event som ligger på BÅDA spåren dubbleras på kartan:
 * emit() i linkEventService dedupar på id, men aggregatets id är url:en medan
 * live-spårets id är Firestore-dokumentets id — de matchar aldrig varandra.
 *
 * Med url hör eventet hemma i aggregatet (där får det favicon-värd och en
 * ANMÄL-länk ut till Facebook-eventet), så userCreated/hostUid tas bort igen.
 * Tiden återställs till 12:00Z — den normalisering dbHelper använder för
 * date-only-event, till skillnad från live-spårets lokala midnatt.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-hudiksvall-forsadagen.ts
 */

import { db } from '../config/firebase';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

const DOC_ID = '30EdVftgly7TeZV20Ql2';

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    const ref = db.collection('linkEvents').doc(DOC_ID);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`❌ Dokumentet ${DOC_ID} saknas.`); process.exit(1); }

    await ref.update({
        userCreated: FieldValue.delete(),
        hostUid: FieldValue.delete(),
        time: Timestamp.fromDate(new Date(Date.UTC(2026, 7, 15, 12, 0, 0))),
        hasSpecificTime: false,
    });

    console.log(`✅ "${snap.get('title')}" är tillbaka i den skrapade pipelinen (url: ${snap.get('url')}).`);
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
