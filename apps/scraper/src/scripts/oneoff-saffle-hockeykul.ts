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
 * Omslaget är klubbens affisch (assets/oneoff-saffle-hockeykul.jpg, 900 px
 * som pipelinens egna bilder). Den laddas upp under event-images/<admin>/ —
 * samma mapp som webbens användarbilder — och INTE under scraped-events/:
 * SQLite-spegeln hoppar över userCreated-event, så orphan-svepet i
 * cleanup-storage-images skulle se affischen som föräldralös och radera den.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-saffle-hockeykul.ts --dry
 *   npx ts-node src/scripts/oneoff-saffle-hockeykul.ts
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db, bucket, STORAGE_BUCKET } from '../config/firebase';
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

const POSTER_FILE = path.join(__dirname, 'assets', 'oneoff-saffle-hockeykul.jpg');

/** Laddar upp affischen (innehållsadresserad sökväg → idempotent) och
 *  returnerar dess publika URL. */
async function uploadPoster(buf: Buffer, objectPath: string): Promise<string> {
    if (!bucket) throw new Error('Storage-bucket ej initialiserad.');
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
        await file.save(buf, {
            contentType: 'image/jpeg',
            metadata: {
                metadata: { sourceUrl: URL, uploadedAt: new Date().toISOString() },
                // Innehållsadresserad sökväg — byter aldrig innehåll under samma namn.
                cacheControl: 'public, max-age=31536000, immutable',
            },
            resumable: false,
        });
        await file.makePublic();
    }
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${objectPath}`;
}

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

    const poster = fs.readFileSync(POSTER_FILE);
    const posterHash = crypto.createHash('sha1').update(poster).digest('hex').slice(0, 16);
    const posterPath = `event-images/${ADMIN_UID}/saffle-hockeykul-${posterHash}.jpg`;
    const coverImage = DRY
        ? `(dry) https://storage.googleapis.com/${STORAGE_BUCKET}/${posterPath}`
        : await uploadPoster(poster, posterPath);

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
        coverImage,
        createdAt: Timestamp.now(),
        isLocationVerified: true,
        status: 'published',
    });

    if (DRY) {
        console.log(`▸ ${START.toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}  ${TITLE}`);
        console.log(`    ${data.locationName}  [${data.lat}, ${data.lng}]  · ${data.hostName} · ${data.category}`);
        console.log(`    ${URL}`);
        console.log(`    omslag: ${POSTER_FILE} (${(poster.length / 1024).toFixed(0)} kB) → ${posterPath}`);
        process.exit(0);
    }

    const ref = await db.collection('linkEvents').add(data);
    console.log(`✅ ${TITLE} skriven → linkEvents/${ref.id}`);
    console.log('userCreated-spåret läses LIVE av webben — eventet syns utan sync/aggregate.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
