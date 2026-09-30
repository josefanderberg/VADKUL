#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Östad Loppis säsongsavslutning — tipsat som KOMMENTAR på
 * Mörrum-inlägget i FB-gruppen "Mörrum - detta händer just nu.." (2026-09-29).
 *
 * Fanns i ingen källa: varken i aggregatet (3–4/10 kring Olofström/Östad)
 * eller bland userCreated-eventen (kollat 2026-09-30). Loppisen har bara en
 * FB-sida och ett Instagramkonto — inget skrapbart.
 *
 * Fakta ur kommentaren: säsongsavslutning 3 och 4 oktober kl 11–15,
 * Olofströmsvägen 950-3, 293 93 Olofström. Östad ligger i Bromölla kommun
 * (Näsums socken) på väg 116 mellan Olofström och Bromölla — postadressen är
 * Olofström. Koordinaten är loppisens egen GPS-uppgift på loppisar.com.
 *
 * Spåret är TIPS på userCreated-live-spåret (samma som oneoff-gavle-fb-tips):
 *   • userCreated + isTip, hostName = loppisen, hostUid = admin (styr
 *     Ta bort/Redigera — bilden går alltså att byta i webbens formulär).
 *   • repeatDays: 2 = lör + sön med samma klockslag — EN post, precis som
 *     webbformulärets "dagar i rad" skriver den.
 *   • stamped() på skrivningen — järnregeln för ALLA linkEvents-skrivningar.
 *
 * Bild: loppisen har ingen hämtbar bild (FB/IG-länkar går ut), så en fri
 * Unsplash-bild (Unsplash-licensen, ingen attribuering krävs) på hyllor
 * fulla av kuriosa. Den laddas upp i vår Storage via uploadEventImage —
 * permanent URL, samma cache-väg som skrapade omslag. Misslyckas uppladdningen
 * används Unsplash-adressen direkt (hotlänkning är tillåten där).
 * --dry skriver ut bildadressen så den kan tittas på först.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-ostad-loppis.ts --dry
 *   npx ts-node src/scripts/oneoff-ostad-loppis.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';
import { uploadEventImage } from '../utils/storageHelper';

const DRY = process.argv.includes('--dry');

/** Admin-kontot som står som ägare (samma som Gävle-/Hudiksvall-oneoffarna). */
const ADMIN_UID = 'H120TWAU4oTcQLsfqkIStXU6RAU2';

const TITLE = 'Östad Loppis – säsongsavslutning';
/** Lördag 3/10 kl 11 svensk sommartid (CEST, +02:00 till 25/10). */
const START = new Date('2026-10-03T11:00:00+02:00');
const FB_PAGE = 'https://www.facebook.com/p/%C3%96stad-Loppis-100058870422393/';
const OSTAD_LOPPIS = { lat: 56.2163579, lng: 14.5218053 };

/**
 * Unsplash-foton i prioritetsordning (id:t ur unsplash.com/photos/<slug>-<id>).
 * Första som går att slå upp vinner.
 */
const PHOTOS = [
    { id: '5KZHlffrL5w', what: 'hyllor fulla av kuriosa och samlarprylar' },
    { id: 'DeSmtBCYxbU', what: 'loppis utomhus med prylar på borden' },
];

/**
 * unsplash.com/photos/<id>/download redirectar till bildens CDN-adress
 * (images.unsplash.com/photo-…). Frågesträngen byts mot en storleksbegränsad
 * variant — originalen är ofta >8 MB, över storageHelpers tak.
 */
async function resolveUnsplash(id: string): Promise<string | null> {
    try {
        const res = await fetch(`https://unsplash.com/photos/${id}/download?force=true`, {
            redirect: 'manual',
            headers: { 'User-Agent': 'VadKul/1.0 (+https://vadkul.se)' },
        });
        const loc = res.headers.get('location');
        if (!loc) return null;
        const u = new URL(loc, 'https://unsplash.com');
        if (u.hostname !== 'images.unsplash.com') return null;
        return `${u.origin}${u.pathname}?w=1200&q=80&fm=jpg&fit=max`;
    } catch {
        return null;
    }
}

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    console.log(`\n📍 Östad — tips från FB-tråden i Mörrum-gruppen${DRY ? '  [DRY RUN]' : ''}\n`);

    const existing = await db.collection('linkEvents').where('title', '==', TITLE).get();
    if (!existing.empty) {
        console.log(`  ⏭  Finns redan: ${TITLE} → ${existing.docs.map(d => d.id).join(', ')}`);
        process.exit(0);
    }

    let remote: string | null = null;
    for (const p of PHOTOS) {
        remote = await resolveUnsplash(p.id);
        if (remote) { console.log(`  🖼  ${p.what}\n     ${remote}`); break; }
        console.log(`  ⚠️  Unsplash ${p.id} gick inte att slå upp — provar nästa`);
    }

    if (DRY) {
        console.log(`\n  ▸ ${START.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })} + söndag  ${TITLE}`);
        console.log(`      Olofströmsvägen 950-3, Östad  [${OSTAD_LOPPIS.lat}, ${OSTAD_LOPPIS.lng}]  · market`);
        console.log('\nInget skrivet. Kör utan --dry för att lägga in.\n');
        process.exit(0);
    }

    let coverImage = '';
    if (remote) {
        coverImage = (await uploadEventImage(remote, FB_PAGE)) ?? remote;
    }

    const data = stamped({
        title: TITLE,
        url: FB_PAGE,
        time: Timestamp.fromDate(START),
        repeatDays: 2,
        locationName: 'Östad Loppis, Olofströmsvägen 950-3, Östad',
        extractedAddress: 'Olofströmsvägen 950-3, 293 93 Olofström',
        geocodedQuery: 'community-tips (FB "Mörrum - detta händer just nu..", tipsat av Ann-Christin Hallberg Olsen)',
        lat: OSTAD_LOPPIS.lat,
        lng: OSTAD_LOPPIS.lng,
        hostName: 'Östad Loppis',
        hostUid: ADMIN_UID,
        userCreated: true,
        isTip: true,
        category: 'market',
        description:
            'Östad Loppis har säsongsavslutning! Sista chansen för säsongen att fynda ' +
            'second hand, antikt, kuriosa och retro på loppisen i Östad, vid väg 116 ' +
            'mellan Olofström och Näsum. Öppet kl 11–15 både lördag och söndag.',
        ...(coverImage ? { coverImage } : {}),
        createdAt: Timestamp.now(),
        isLocationVerified: true,
        hidden: 0,
        status: 'published',
    });

    const ref = await db.collection('linkEvents').add(data);
    console.log(`\n  ✅ ${TITLE} (lör 3/10 + sön 4/10, 11–15) → linkEvents/${ref.id}`);
    console.log(`     bild: ${coverImage || '(ingen)'}`);
    console.log('\nuserCreated-spåret läses LIVE av webben — eventet syns utan sync/aggregate.\n');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
