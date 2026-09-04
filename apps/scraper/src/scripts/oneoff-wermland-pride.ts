#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Wermland Pride 2026 — tipsat som KOMMENTAR på Facebook 2026-08-28
 * ("imorgon är det Pride-festival").
 *
 * Festivalen finns ingenstans i våra källor: TURID/Visit Värmland listar bara
 * kringeventen (After Pride, Tipspromenad: Pride), wermlandpride.se resolvar
 * inte, och FB-eventet (id 800312329827213, hittat på sidan VarmlandPride)
 * har inte fångats av FB-flödet — söket är dött sedan juli och sidan står
 * inte i sidbevakningen. Id:t är nu tillagt i fb-seed-urls.json för framtida
 * körningar; det här skriptet skriver in själva festivalen direkt.
 *
 * Fakta enligt arrangörens FB-event + regionvarmland.se/pride-2026:
 * lördag 29 augusti, Sundsta (grönytan vid Sundsta-Älvkullegymnasiet),
 * festivalområdet öppnar 11:00, paraden går 15:00.
 *
 * Följer Haninge-mönstret (oneoff-haninge-utebio.ts):
 *   • hostName = arrangören (Wermland Pride), aldrig VADKUL
 *   • userCreated sätts INTE
 *   • tipset spåras i geocodedQuery
 * ...men till skillnad från det äldre skriptet går skrivningen via stamped()
 * — regeln i CLAUDE.md, annars missar inkrementella SQLite-synken dokumentet.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-wermland-pride.ts --dry
 *   npx ts-node src/scripts/oneoff-wermland-pride.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';

const DRY = process.argv.includes('--dry');

/** Arrangörens eget FB-event — samma URL-form som facebook-scrapern lagrar. */
const URL = 'https://www.facebook.com/events/800312329827213/';

/** Sundsta-Älvkullegymnasiet, Karlstad (grönytan intill) — kontrollerad mot OSM 2026-08-28. */
const SUNDSTA = { lat: 59.3868, lng: 13.5216 };

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    const existing = await db.collection('linkEvents').where('url', '==', URL).get();
    if (!existing.empty) {
        console.log('⏭  Wermland Pride 2026 finns redan — inget att göra.');
        process.exit(0);
    }

    const data = stamped({
        title: 'Wermland Pride 2026',
        url: URL,
        // 11:00 lokal tid — festivalområdet öppnar; paraden går 15:00.
        time: Timestamp.fromDate(new Date(2026, 7, 29, 11, 0, 0)),
        hasSpecificTime: true,
        locationName: 'Sundsta, Karlstad',
        extractedAddress: 'Sundsta-Älvkullegymnasiet, Karlstad',
        geocodedQuery: 'community-tips (FB-kommentar 2026-08-28)',
        lat: SUNDSTA.lat,
        lng: SUNDSTA.lng,
        hostName: 'Wermland Pride',
        category: 'social',
        emoji: '🏳️‍🌈',
        description:
            'Värmlands största Pridefestival på Sundsta i Karlstad. Festivalområdet vid ' +
            'Sundsta-Älvkullegymnasiet öppnar kl 11 med tältgator, aktiviteter och scen — ' +
            'paraden avgår kl 15. Fri entré.',
        price: 'Gratis',
        createdAt: Timestamp.now(),
        isLocationVerified: true,
        status: 'published',
    });

    if (DRY) {
        console.log('▸ 2026-08-29 11:00  Wermland Pride 2026');
        console.log(`    ${data.locationName}  [${data.lat}, ${data.lng}]  · ${data.hostName} · ${data.category}`);
        console.log(`    ${URL}`);
        process.exit(0);
    }

    const ref = await db.collection('linkEvents').add(data);
    console.log(`✅ Wermland Pride 2026 skriven → linkEvents/${ref.id}`);
    process.exit(0);
}

main();
