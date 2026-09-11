#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Höstloppisen utanför Arboga 19/9 — besökarklagomål 2026-09-11
 * ("Hur ser man all information? Finns t.ex. en karta?").
 *
 * Två fel i samma event:
 *   1. Källan (visitvastramalardalen.se, SiteVision) döpte om eventet
 *      "Höstloppis i trakterna av södra Arboga" → "Höstloppis i Arbogas
 *      södra trakter". Datumslug-URL:en byggs av titeln, så vår sparade URL
 *      (primärnyckeln) 404:ar medan eventet lever vidare på ny URL.
 *   2. Beskrivningen är tom — RESTApp-API:t har content="" (gäller hela
 *      källan; fixas framåt av detailBodyDesc i sitevision-motorn).
 *
 * Skriptet byter url + titel IN PLACE (Firestore-doc:et och SQLite-raden
 * behålls, så ingen spökrad/dubblett uppstår) och sätter beskrivningen från
 * detaljsidans brödtext. OBS: Mac minins spegel bär den gamla raden tills
 * dess sync hämtar det omstämplade doc:et — MEN url-nyckeln är ny där, så
 * minins gamla rad måste raderas för hand (Kulturbolaget-mönstret):
 *   ssh mini "sqlite3 ~/Repos/VADKUL/apps/scraper/events.db \"DELETE FROM link_events WHERE url='<GAMLA URL:EN>'\""
 *
 * Kör:  npx ts-node src/scripts/oneoff-arboga-hostloppis-rename.ts [--dry]
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';

const DRY = process.argv.includes('--dry');

const OLD_URL = 'https://visitvastramalardalen.se/evenemang/evenemang/2026-08-27-hostloppis-i-trakterna-av-sodra-arboga.html';
const NEW_URL = 'https://visitvastramalardalen.se/evenemang/evenemang/2026-08-27-hostloppis-i-arbogas-sodra-trakter.html';
const NEW_TITLE = 'Höstloppis i Arbogas södra trakter';

// Detaljsidans brödtext, läst 2026-09-11 (sv-text-portlet-content).
const DESCRIPTION = [
    'Hitta härliga fynd, rolig kuriosa hos 20 säljare på 13 säljställen.',
    '',
    'Vi har fyllt vår bygdegård Hjälmareborg med säljare och det finns loppis på flera gårdar efter vägen.',
    'Upplev vårt vackra område när du tar dig mot Hjälmaren.',
    '',
    'Vägbeskrivning från Arboga: åk mot Säterbo kyrka eller Västermo/Herrfallet.',
    'Vägbeskrivning från Eskilstuna/Katrineholm: Efter Alberga åk mot Västermo/Herrfallet. Första stopp efter 9 km, strax efter Hjälmare kanal.',
    'Karta finns på www.bygdegardarna.se/tyringe',
    '',
    'Fika och korv kommer att finnas längs rundan.',
].join('\n');

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    const snap = await db.collection('linkEvents').where('url', '==', OLD_URL).get();
    if (snap.empty) { console.log('⏭  Gamla URL:en finns inte i Firestore — redan fixad?'); }
    for (const doc of snap.docs) {
        if (DRY) { console.log(`▸ skulle uppdatera linkEvents/${doc.id}`); continue; }
        await doc.ref.update(stamped({ url: NEW_URL, title: NEW_TITLE, description: DESCRIPTION }));
        console.log(`✅ Firestore: linkEvents/${doc.id} → ny url + titel + beskrivning`);
    }

    const sqlite = new Database(path.join(__dirname, '..', '..', 'events.db'));
    const row = sqlite.prepare('SELECT url FROM link_events WHERE url = ?').get(OLD_URL);
    if (!row) {
        console.log('⏭  Gamla URL:en finns inte i lokala SQLite.');
    } else if (DRY) {
        console.log('▸ skulle uppdatera SQLite-raden in place');
    } else {
        sqlite.prepare('UPDATE link_events SET url = ?, title = ?, description = ? WHERE url = ?')
            .run(NEW_URL, NEW_TITLE, DESCRIPTION, OLD_URL);
        console.log('✅ SQLite: rad omnycklad till nya URL:en + beskrivning satt');
    }
    process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
