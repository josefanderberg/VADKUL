#!/usr/bin/env ts-node
/**
 * ENGÅNGS: två rättelser ur kommentarstråden på Gävle-sidinlägget (30/8).
 *
 * 1) RÄTTA "Carola!" 2/9 (alvkarleby.se). Gabriella Carlbom påpekade att det
 *    är FILMEN, inte en konsert. Källsidan säger "Plats: Rio Bio Gävlevägen 24"
 *    men kommun-skraparen läser inte "Plats:"-fältet — den satte locationName
 *    till kommunnamnet ("Älvkarleby") och extractedAddress till kommunhusets
 *    besöksadress (Centralgatan 3) ur sidfoten. Resultat: fel ort på kartan,
 *    kategori 'other' och skräpbeskrivning (kommunens öppettider).
 *    Här sätts rätt venue/koordinat/kategori/pris/beskrivning.
 *
 *    OBS: rättningen skrivs till BÅDE Firestore och SQLite-spegeln. Spegeln är
 *    det aggregate läser, och en ny skrapning av samma url upsertar spegeln med
 *    källans råa värden igen (dbHelper.addEventToDb skriver ALLTID SQLite först,
 *    dubblettkollen kommer efteråt). Kör om skriptet om eventet hoppar tillbaka
 *    till "Älvkarleby" före 2/9.
 *
 * 2) LÄGG IN bordsloppisen på Gävletravet 6/9 — tips från Jennifer Liljeqvist
 *    i samma tråd. Länklöst ⇒ userCreated-tips-spåret (järnregeln: url är
 *    primärnyckel, länklösa event får inte ligga på det skrapade spåret).
 *    Samma mönster som oneoff-gavle-fb-tips.ts (29/8).
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-gavle-tradsvar-30aug.ts --dry
 *   npx ts-node src/scripts/oneoff-gavle-tradsvar-30aug.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';
import { upsertEvent, getSqliteEvent } from '../utils/sqliteHelper';

const DRY = process.argv.includes('--dry');

/** Admin-kontot som står som ägare (samma som tidigare Gävle-oneoffar). */
const ADMIN_UID = 'H120TWAU4oTcQLsfqkIStXU6RAU2';

// ─── 1. Carola!-rättelsen ────────────────────────────────────────────────────

const CAROLA_URL =
    'https://www.alvkarleby.se/uppleva-och-gora/evenemang/evenemang/2026-08-05-carola.html';

/** Folkets Hus/Rio Bio, Gävlevägen, Skutskär (Nominatim, verifierad 30/8). */
const CAROLA_FIX = {
    title: 'Carola! — film på Rio Bio',
    locationName: 'Rio Bio, Folkets Hus Skutskär',
    extractedAddress: 'Gävlevägen 24, 814 31 Skutskär',
    geocodedQuery: 'manuell rättelse 30/8 (källans "Plats:"-fält)',
    lat: 60.6326291,
    lng: 17.4080803,
    geoPrecision: 'poi',
    hostName: 'Folkets Hus Rio Bio Skutskär',
    category: 'stage',
    emoji: '🎭',
    price: '110 kr',
    description:
        'Dokumentärfilmen Carola! visas på Rio Bio i Skutskär. Med ett unikt material ger filmen en inblick i människan Carola Häggkvists liv — artisten som älskats av publiken i decennier, och som vid 60 tagit kontroll över sitt eget liv. Regi: My Sandström. Biljettkassan öppnar kl 18.15 (Swish, kontanter och kort).',
    isLocationVerified: true,
};

async function fixCarola(): Promise<boolean> {
    if (!db) return false;

    const snap = await db.collection('linkEvents')
        .where('url', '==', CAROLA_URL).limit(1).get();
    if (snap.empty) {
        console.log('  ⚠️  Hittade inget Carola-dokument på url:en — hoppar över.');
        return false;
    }
    const doc = snap.docs[0];
    console.log(`  ▸ ${doc.id}  "${doc.get('title')}" @ ${doc.get('locationName')}`);
    console.log(`      → "${CAROLA_FIX.title}" @ ${CAROLA_FIX.locationName}`);
    console.log(`      → [${CAROLA_FIX.lat}, ${CAROLA_FIX.lng}]  ${CAROLA_FIX.category} ${CAROLA_FIX.emoji}  ${CAROLA_FIX.price}`);
    if (DRY) return true;

    await doc.ref.update(stamped({ ...CAROLA_FIX }));

    // Spegeln också — aggregate läser SQLite, inte Firestore.
    const row = getSqliteEvent(CAROLA_URL);
    if (row) {
        upsertEvent({ ...row, ...CAROLA_FIX, url: CAROLA_URL, firestoreId: doc.id });
        console.log('  ✅ Rättad i Firestore + SQLite-spegeln.');
    } else {
        console.log('  ✅ Rättad i Firestore (ingen spegelrad hittades).');
    }
    return true;
}

// ─── 2. Bordsloppisen på Gävletravet ─────────────────────────────────────────

interface Seed {
    title: string;
    /** 'YYYY-MM-DD HH:MM' för känd tid, 'YYYY-MM-DD' för bara datum. */
    when: string;
    locationName: string;
    extractedAddress: string;
    lat: number;
    lng: number;
    hostName: string;
    category: string;
    description: string;
    /** Vem i tråden som tipsade — hamnar i geocodedQuery som spårbarhet. */
    tippedBy: string;
}

const SEEDS: Seed[] = [
    {
        title: 'Bordsloppis på Gävletravet',
        when: '2026-09-06 11:00',
        locationName: 'Gävletravet',
        extractedAddress: 'Gavlehovsvägen 14, 806 33 Gävle',
        // Nominatim: Gavlehovsvägen 14, Stigslund, Gävle (verifierad 30/8).
        lat: 60.6912292,
        lng: 17.1392375,
        hostName: 'Gävletravet',
        category: 'market',
        description: 'Bordsloppis på Gävletravet, söndag 6 september kl 11–14. Beskrivs som Gävles största bordsloppis. Gavlehovsvägen 14.',
        tippedBy: 'Jennifer Liljeqvist',
    },
];

/** 'YYYY-MM-DD HH:MM' → exakt lokal tid. 'YYYY-MM-DD' → lokal midnatt (= "bara datum"). */
function parseWhen(when: string): { time: Date; hasSpecificTime: boolean } {
    const m = when.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!m) throw new Error(`Ogiltigt datumformat: "${when}"`);
    const [, y, mo, d, hh, mm] = m;
    if (hh === undefined) {
        return { time: new Date(+y, +mo - 1, +d, 0, 0, 0), hasSpecificTime: false };
    }
    return { time: new Date(+y, +mo - 1, +d, +hh, +mm, 0), hasSpecificTime: true };
}

async function addTips(): Promise<{ written: number; skipped: number }> {
    if (!db) return { written: 0, skipped: 0 };

    let written = 0, skipped = 0;
    for (const s of SEEDS) {
        const { time, hasSpecificTime } = parseWhen(s.when);

        // Dedup på titel + kalenderdag (samma resonemang som tidigare oneoffar).
        const dayStart = new Date(time); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
        const sameTitle = await db.collection('linkEvents')
            .where('title', '==', s.title).get();
        const dupe = sameTitle.docs.some(d => {
            const t = d.get('time')?.toDate?.();
            return t instanceof Date && t >= dayStart && t < dayEnd;
        });
        if (dupe) {
            console.log(`  ⏭  Finns redan: ${s.title}`);
            skipped++;
            continue;
        }

        const data = stamped({
            title: s.title,
            url: '',
            time: Timestamp.fromDate(time),
            hasSpecificTime,
            locationName: s.locationName,
            extractedAddress: s.extractedAddress,
            geocodedQuery: `community-tips (FB "Vad händer i Gävle?", tipsat av ${s.tippedBy})`,
            lat: s.lat,
            lng: s.lng,
            geoPrecision: 'gata',
            hostName: s.hostName,
            hostUid: ADMIN_UID,
            userCreated: true,
            isTip: true,
            category: s.category,
            description: s.description,
            price: null,
            createdAt: Timestamp.now(),
            isLocationVerified: true,
            status: 'published',
        });

        const stamp = time.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
        if (DRY) {
            console.log(`  ▸ ${stamp}  ${s.title}`);
            console.log(`      ${s.locationName}  [${s.lat}, ${s.lng}]  · ${s.hostName} · ${s.category}`);
            written++;
            continue;
        }

        const ref = await db.collection('linkEvents').add(data);
        console.log(`  ✅ ${stamp}  ${s.title}  → ${ref.id}`);
        written++;
    }
    return { written, skipped };
}

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    console.log(`\n🔧 Gävle-trådens rättelser${DRY ? '  [DRY RUN]' : ''}\n`);

    console.log('1) Carola! 2/9 — fel plats/kategori:');
    await fixCarola();

    console.log(`\n2) Tips från tråden — ${SEEDS.length} event:`);
    const { written, skipped } = await addTips();

    console.log(`\n${DRY ? 'Skulle skriva' : 'Skrev'} ${written} tips, hoppade över ${skipped}.`);
    if (!DRY) {
        console.log('Tipsen ligger på userCreated-spåret och läses LIVE — inget aggregate behövs.');
        console.log('Carola-rättelsen syns i aggregatet efter: npm run sync-to-sqlite && npm run aggregate\n');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
