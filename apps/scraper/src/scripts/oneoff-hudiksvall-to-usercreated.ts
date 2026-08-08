#!/usr/bin/env ts-node
/**
 * ENGÅNGS-RÄTTNING av de 14 Hudiksvalls-eventen från FB-tråden.
 *
 * De skrevs först som SKRAPADE event (userCreated saknades) med tom url. Det
 * går inte: både SQLite-spegeln och aggregate-events.ts nycklar på url, så alla
 * länklösa event delar nyckeln "" och skriver över varandra — 13 av 14 försvann
 * ur spegeln, och en tom mapp-nyckel fällde dessutom descriptions-uppladdningen.
 *
 * Rätt spår för event utan extern länk är userCreated: fetchUserCreatedEvents
 * läser dem LIVE ur Firestore vid varje poll, helt utanför aggregatet. Här
 * flyttas de dit — samma dokument, korrigerade fält.
 *
 * Tid: klienten härleder hasSpecificTime ur klockslaget (deriveHasSpecificTime
 * → lokal 00:00 = "bara datum"). Date-only-eventen låg på 12:00Z, vilket hade
 * visats som ett påhittat "kl 14". De flyttas till lokal midnatt.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-hudiksvall-to-usercreated.ts --dry
 *   npx ts-node src/scripts/oneoff-hudiksvall-to-usercreated.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry');

/** Admin-kontot som står som ägare (styr "Ta bort eventet" på kortet). */
const ADMIN_UID = 'H120TWAU4oTcQLsfqkIStXU6RAU2';

/** doc-id → 'YYYY-MM-DD' för de event som saknar klockslag. */
const DATE_ONLY: Record<string, string> = {
    sJeQXvoqlxQTdwOFLpbe: '2026-08-08', // Stintarocken
    '30EdVftgly7TeZV20Ql2': '2026-08-15', // Forsadagen
    zk6NfSgX2VijNXMMCti9: '2026-08-15', // The Yankees
    zRhgJS8V2xZGzrnBh4Sd: '2026-08-15', // Familjedag på Kungsvallen
    eHTDoq11oJFBnK3y9Xxj: '2026-08-17', // Barnens dag på Ystegårn
    WoRPJ4Qx8AJ49hYpHJSu: '2026-08-20', // SM för Neptunkryssare
};

/** Alla 14 dokument som skrevs av oneoff-hudiksvall-community.ts. */
const IDS = [
    'sJeQXvoqlxQTdwOFLpbe', 'kvYQlswjVOcY8Qjb7Chi', 'tpSVHgDE9sxbfyjUnAGh',
    'CVoQEARTlTi1qmwfXTjS', '30EdVftgly7TeZV20Ql2', 'zk6NfSgX2VijNXMMCti9',
    'zRhgJS8V2xZGzrnBh4Sd', 'AeowKVeNzry5PKjfhBkl', 'aZHPEp5PgwSjcpeLjrdQ',
    'nrjwBJED5GwQiemaM4sr', 'y2PR1D7Mh9Nfn1lp4p7B', 'eHTDoq11oJFBnK3y9Xxj',
    '8pUVt7EFHk7oYeQgkb2J', 'WoRPJ4Qx8AJ49hYpHJSu',
];

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    console.log(`\n🔧 Flyttar ${IDS.length} event till userCreated-spåret${DRY ? '  [DRY RUN]' : ''}\n`);

    let done = 0, missing = 0;
    for (const id of IDS) {
        const ref = db.collection('linkEvents').doc(id);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`  ⚠️  Saknas: ${id}`); missing++; continue; }

        const patch: Record<string, unknown> = {
            userCreated: true,
            hostUid: ADMIN_UID,
            hidden: 0,
        };

        const dateOnly = DATE_ONLY[id];
        if (dateOnly) {
            const [y, m, d] = dateOnly.split('-').map(Number);
            patch.time = Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0));
            patch.hasSpecificTime = false;
        }

        const title = snap.get('title');
        if (DRY) {
            console.log(`  ▸ ${title}${dateOnly ? `  (tid → lokal midnatt ${dateOnly})` : ''}`);
        } else {
            await ref.update(patch);
            console.log(`  ✅ ${title}${dateOnly ? `  (tid → lokal midnatt ${dateOnly})` : ''}`);
        }
        done++;
    }

    console.log(`\n${DRY ? 'Skulle uppdatera' : 'Uppdaterade'} ${done} event${missing ? `, ${missing} saknades` : ''}.\n`);
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
