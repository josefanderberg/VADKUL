#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Säffle HC:s Hockeykul 10/10 — "Prova på skridskor" för barn i
 * Somashallen. Tipsat av Christoffer Andersson i Messenger (2026-10-01) med
 * länk till klubbens FB-inlägg (postat 1/9). Finns inte i någon källa —
 * klubben annonserar bara på FB och svenskalag.se, och inlägget är inget
 * FB-event.
 *
 * Samma spår som oneoff-gavle-fb-tips.ts (userCreated-live-spåret):
 *   • userCreated: true → läses LIVE av fetchUserCreatedEvents — ingen
 *     sync/aggregate behövs för att det ska synas.
 *   • isTip: true → visas som tips, aldrig som VADKUL-värdat event.
 *   • hostName = Säffle HC, hostUid = admin (styr Ta bort-knappen).
 *   • stamped() på skrivningen — järnregeln för ALLA linkEvents-skrivningar.
 *
 * Fakta enligt klubbens inlägg: lördag 10 oktober kl 10.00–11.00,
 * Somashallen. Alla barn välkomna, inga förkunskaper; ta med hjälm,
 * skridskor och handskar om man har — viss utrustning finns att låna.
 * Sluttiden står i beskrivningen: live-spåret läser inte endDate.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-saffle-hockeykul.ts --dry
 *   npx ts-node src/scripts/oneoff-saffle-hockeykul.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';

const DRY = process.argv.includes('--dry');

/** Admin-kontot som står som ägare (samma som Gävle-/Hudiksvall-oneoffarna). */
const ADMIN_UID = 'H120TWAU4oTcQLsfqkIStXU6RAU2';

const TITLE = 'Hockeykul – prova på skridskor';

/** Klubbens FB-inlägg (delningslänken från tipset, utan mibextid-spårningen)
 *  — inget FB-event finns, så inlägget är det närmaste en eventsida. */
const URL = 'https://www.facebook.com/share/p/1DT3Mzxbzp/';

/** Somashallen, Stjärngatan 1 (Höglunda), Säffle — koordinater enligt koordinater.se. */
const SOMASHALLEN = { lat: 59.1298, lng: 12.9018 };

/** 10.00 svensk sommartid (sommartiden slutar 25/10) — explicit offset så
 *  skriptet ger rätt tid oavsett maskinens tidszon. */
const START = new Date('2026-10-10T10:00:00+02:00');

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    // Dedup på titel + kalenderdag (samma resonemang som Gävle-oneoffen).
    const dayStart = new Date('2026-10-10T00:00:00+02:00');
    const dayEnd = new Date('2026-10-11T00:00:00+02:00');
    const sameTitle = await db.collection('linkEvents').where('title', '==', TITLE).get();
    const dupe = sameTitle.docs.some(d => {
        const t = d.get('time')?.toDate?.();
        return t instanceof Date && t >= dayStart && t < dayEnd;
    });
    if (dupe) {
        console.log(`⏭  Finns redan: ${TITLE}`);
        process.exit(0);
    }

    const data = stamped({
        title: TITLE,
        url: URL,
        time: Timestamp.fromDate(START),
        hasSpecificTime: true,
        locationName: 'Somashallen, Säffle',
        extractedAddress: 'Stjärngatan 1, Säffle',
        geocodedQuery: 'community-tips (Messenger, tipsat av Christoffer Andersson — Säffle HC:s FB-inlägg 2026-09-01)',
        lat: SOMASHALLEN.lat,
        lng: SOMASHALLEN.lng,
        hostName: 'Säffle HC',
        hostUid: ADMIN_UID,
        userCreated: true,
        isTip: true,
        category: 'family',
        description:
            'Säffle HC bjuder in alla barn att prova på hockey och skridskoåkning i en trygg ' +
            'och rolig miljö, kl 10.00–11.00 i Somashallen. Inga förkunskaper behövs och ' +
            'klubbens ledare finns på plats och hjälper till. Ta med hjälm, skridskor och ' +
            'handskar om du har — viss utrustning finns att låna.',
        // Inlägget säger inget om pris — hellre tomt än gissat "Gratis".
        price: null,
        createdAt: Timestamp.now(),
        isLocationVerified: true,
        status: 'published',
    });

    if (DRY) {
        console.log(`▸ ${START.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}  ${TITLE}`);
        console.log(`    ${data.locationName}  [${data.lat}, ${data.lng}]  · ${data.hostName} · ${data.category}`);
        console.log(`    ${URL}`);
        process.exit(0);
    }

    const ref = await db.collection('linkEvents').add(data);
    console.log(`✅ ${TITLE} skriven → linkEvents/${ref.id}`);
    console.log('userCreated-spåret läses LIVE av webben — eventet syns utan sync/aggregate.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
