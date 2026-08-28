#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Great Lake Run #49 — tipsat som KOMMENTAR på Facebook 2026-08-28
 * ("Det roligaste har ni ju skippat, Great Lake run den 5/9").
 *
 * OBS: det är INTE ett löplopp (RaceID-källan täcker det inte) — det är SHRA
 * Östersunds klassiska motorcruising runt Storsjön, 49:e året. Enda publika
 * kanalen är arrangörens FB-event (id 1034169505658417, hittat via SHRA
 * Östersunds /upcoming_hosted_events); FB-flödet har inte fångat det eftersom
 * söket är dött sedan juli och sidan inte står i sidbevakningen. Id:t läggs
 * samtidigt i fb-seed-urls.json så framtida körningar berikar eventet.
 *
 * Fakta ur FB-eventet (läst 2026-08-28): lördag 5 september 2026 kl 14:00,
 * start vid Arenaparkeringen, Stadsdel Norr (Östersund Arena) — samma
 * startplats som #47. Koordinat: Östersund Arena via Nominatim.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-great-lake-run.ts --dry
 *   npx ts-node src/scripts/oneoff-great-lake-run.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';

const DRY = process.argv.includes('--dry');

const URL = 'https://www.facebook.com/events/1034169505658417/';

/** Östersund Arena (Arenaparkeringen, Stadsdel Norr) — Nominatim 2026-08-28. */
const ARENA = { lat: 63.196044, lng: 14.6609381 };

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    const existing = await db.collection('linkEvents').where('url', '==', URL).get();
    if (!existing.empty) {
        console.log('⏭  Great Lake Run #49 finns redan — inget att göra.');
        process.exit(0);
    }

    const data = stamped({
        title: 'Great Lake Run #49',
        url: URL,
        time: Timestamp.fromDate(new Date(2026, 8, 5, 14, 0, 0)),
        hasSpecificTime: true,
        locationName: 'Arenaparkeringen, Stadsdel Norr, Östersund',
        extractedAddress: 'Östersund Arena, Fågelkullevägen, Östersund',
        geocodedQuery: 'community-tips (FB-kommentar 2026-08-28)',
        lat: ARENA.lat,
        lng: ARENA.lng,
        hostName: 'SHRA Östersund',
        category: 'other',
        emoji: '🚗',
        description:
            'SHRA Östersunds klassiska motorcruising runt Storsjön — 49:e året. En dag med ' +
            'gemenskap, kluriga utmaningar längs vägen och festlig kväll med mat, musik och ' +
            'prisutdelning. Start kl 14 från Arenaparkeringen på Stadsdel Norr.',
        createdAt: Timestamp.now(),
        isLocationVerified: true,
        status: 'published',
    });

    if (DRY) {
        console.log('▸ 2026-09-05 14:00  Great Lake Run #49');
        console.log(`    ${data.locationName}  [${data.lat}, ${data.lng}]  · ${data.hostName}`);
        console.log(`    ${URL}`);
        process.exit(0);
    }

    const ref = await db.collection('linkEvents').add(data);
    console.log(`✅ Great Lake Run #49 skriven → linkEvents/${ref.id}`);
    process.exit(0);
}

main();
