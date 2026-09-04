#!/usr/bin/env ts-node
/**
 * ENGÅNGS: lägg in eventtipsen från kommentarerna på Gävle-sidinlägget i
 * FB-gruppen "Vad händer i Gävle?" (inlägget delat 2026-08-29).
 *
 * Kvällens tips (cruising, karaoke i Sätra 29/8) läggs INTE in — de har
 * passerat innan de hinner synas (ägarbeslut i tråden).
 *
 * Spåret är TIPS på userCreated-live-spåret (lärdomen från Hudiksvall-oneoffen,
 * som först skrev länklösa "skrapade" event och fällde spegeln på tomma
 * url-nyckeln — se oneoff-hudiksvall-to-usercreated.ts):
 *   • userCreated: true → läses LIVE av fetchUserCreatedEvents, utanför
 *     aggregatet — ingen sync/aggregate behövs för att de ska synas.
 *   • isTip: true → presenteras som tips, ALDRIG som grönt VADKUL-värdat
 *     event med anmälan (isVadkulHostedEvent kräver !isTip).
 *   • hostName = verklig arrangör, hostUid = admin (styr Ta bort-knappen).
 *   • stamped() på skrivningen — järnregeln för ALLA linkEvents-skrivningar.
 *
 * Datum utan klockslag = LOKAL midnatt (klienten härleder hasSpecificTime ur
 * klockan 00:00) — inte 12:00Z som gamla oneoffen (visades som "kl 14").
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-gavle-fb-tips.ts --dry
 *   npx ts-node src/scripts/oneoff-gavle-fb-tips.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';

const DRY = process.argv.includes('--dry');

/** Admin-kontot som står som ägare (samma som Hudiksvall-migrationen). */
const ADMIN_UID = 'H120TWAU4oTcQLsfqkIStXU6RAU2';

interface Seed {
    title: string;
    /** 'YYYY-MM-DD HH:MM' för känd tid, 'YYYY-MM-DD' för bara datum. */
    when: string;
    locationName: string;
    lat: number;
    lng: number;
    hostName: string;
    category: string;
    description: string;
    url?: string;
    /** Vem i tråden som tipsade — hamnar i geocodedQuery som spårbarhet. */
    tippedBy: string;
}

const SEEDS: Seed[] = [
    {
        title: 'Å-Draget — kulturfestival längs Gavleån',
        when: '2026-09-05',
        locationName: 'Å-rummet, centrala Gävle',
        // Gavleån vid Rådhuset — festivalen sträcker sig Gammelbron–Gävle Strand.
        lat: 60.6747, lng: 17.1425,
        hostName: 'Gävle kommun',
        category: 'culture',
        description: 'Årlig kulturfestival längs Gavleån, från Gammelbron till Gävle Strand. Konst, musik, historia och familjeunderhållning hela dagen — konstinstallationer i och vid ån, smÅ-Draget med cirkus för barnen, vernissage på Konstcentrum kl 12, konsert med Antons Orkester och scener längs ån på kvällen. Kl 20 tänds tusentals facklor i centrala Gävle och programmet rullar till kl 22.',
        url: 'https://www.gavle.se/kultur-och-fritid/a-draget-bjuder-pa-ett-maxat-program-for-hela-familjen-den-5-september/',
        tippedBy: 'Christian Dalin',
    },
    {
        title: 'Loppis på Villa Holmsundsallén',
        when: '2026-09-13 11:00',
        locationName: 'Utflyktsmålet Villa Holmsundsallén, Holmsundsallén 29',
        lat: 60.6779571, lng: 17.2202355,
        hostName: 'Villa Holmsundsallén',
        category: 'market',
        description: 'Loppis hos Utflyktsmålet Villa Holmsundsallén i Holmsund, Bomhus — den gamla lanthandeln från 1929 som numera rymmer café och butik med vintage, keramik och inredning. Öppet söndagar 11–15.',
        url: 'https://villaholmsundsallen.se/',
        tippedBy: 'Sofia Marmegård',
    },
    {
        title: 'Höstmarknad på Villa Holmsundsallén',
        when: '2026-09-27 11:00',
        locationName: 'Utflyktsmålet Villa Holmsundsallén, Holmsundsallén 29',
        lat: 60.6779571, lng: 17.2202355,
        hostName: 'Villa Holmsundsallén',
        category: 'market',
        description: 'Höstmarknad hos Utflyktsmålet Villa Holmsundsallén i Holmsund, Bomhus — café och butik i den gamla lanthandeln från 1929. Öppet söndagar 11–15.',
        url: 'https://villaholmsundsallen.se/',
        tippedBy: 'Sofia Marmegård',
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

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    console.log(`\n📍 Gävle — ${SEEDS.length} tips från FB-tråden${DRY ? '  [DRY RUN]' : ''}\n`);

    let written = 0, skipped = 0;
    for (const s of SEEDS) {
        const { time, hasSpecificTime } = parseWhen(s.when);

        // Dedup på titel + kalenderdag (samma resonemang som Hudiksvall-oneoffen).
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
            url: s.url ?? '',
            time: Timestamp.fromDate(time),
            hasSpecificTime,
            locationName: s.locationName,
            extractedAddress: '',
            geocodedQuery: `community-tips (FB "Vad händer i Gävle?", tipsat av ${s.tippedBy})`,
            lat: s.lat,
            lng: s.lng,
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

        const stamp = hasSpecificTime
            ? time.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
            : `${s.when} (bara datum)`;

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

    console.log(`\n${DRY ? 'Skulle skriva' : 'Skrev'} ${written} event, hoppade över ${skipped}.`);
    if (!DRY && written > 0) {
        console.log('userCreated-spåret läses LIVE av webben — eventen syns utan sync/aggregate.\n');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
