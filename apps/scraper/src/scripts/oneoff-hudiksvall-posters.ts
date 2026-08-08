#!/usr/bin/env ts-node
/**
 * ENGÅNGS: applicera informationen från affischerna Josef fick in.
 *
 * Affischerna gav klockslag, arrangörer, entré och beskrivningar som saknades
 * när eventen lades in från FB-kommentarerna, plus två event som inte fanns
 * med i tråden alls.
 *
 * OBS geografi: "Slätthögs Hembygdsförening" och "Soldattorpet i Grönaberg"
 * ligger i ALVESTA KOMMUN, Kronobergs län — inte i Hälsingland. Den affischen
 * hör alltså inte ihop med Hudiksvallstråden och placeras i Småland.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-hudiksvall-posters.ts --dry
 *   npx ts-node src/scripts/oneoff-hudiksvall-posters.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry');
const ADMIN_UID = 'H120TWAU4oTcQLsfqkIStXU6RAU2';

/** Uppdateringar av befintliga dokument. */
const PATCHES: { id: string; label: string; patch: Record<string, unknown> }[] = [
    {
        id: 'sJeQXvoqlxQTdwOFLpbe',
        label: 'Stintarocken → kl 15 (15–22) + program',
        patch: {
            // Affischen: "KL. 15-22, LIVE MUSIK, QUIZ, MM."
            time: Timestamp.fromDate(new Date(2026, 7, 8, 15, 0, 0)),
            hasSpecificTime: true,
            description: 'Stintarocken i Delsbo bygdegård, kl 15–22. Livemusik, quiz med mera. '
                + 'Arrangeras av Dellenbygdens kultur- och konsertförening tillsammans med '
                + 'Hudiksvalls kommun, Hälsinglands Sparbank och Studiefrämjandet.',
        },
    },
    {
        id: 'tpSVHgDE9sxbfyjUnAGh',
        label: 'Sommarkrysset → Forsa-Högs församling + program',
        patch: {
            // Affischen anger församlingen, inte bara "Forsa församling".
            hostName: 'Svenska kyrkan Forsa-Högs församling',
            description: 'Vi sjunger somriga sånger och psalmer tillsammans, lyssnar på solister, '
                + 'blandar allvar och strunt och löser ett melodikryss — en härlig blandning av '
                + 'bland annat schlager, musikal och Disney, samt en smula galenskap. Dessutom fika, '
                + 'aftonbön och skön gemenskap. Torsdag 13/8 kl 18 på Mariagården i Forsa. '
                + 'Arrangeras av Sensus och Svenska kyrkan Forsa-Högs församling.',
        },
    },
    {
        id: 'zk6NfSgX2VijNXMMCti9',
        label: 'The Yankees → Sommarfesten 2026 + entré 150 kr',
        patch: {
            title: 'The Yankees – Sommarfesten 2026',
            price: '150 kr',
            description: 'The Yankees spelar egna låtar och covers på Sommarfesten 2026 i '
                + 'Åkernäsparken i Forsa. Lördag 15 augusti kl 21. Entré 150 kr.',
        },
    },
    // Veckoserierna: nu finns stödet, så dart och pubquiz blir riktiga
    // upprepningar i stället för ett ensamt tillfälle.
    {
        id: 'kvYQlswjVOcY8Qjb7Chi',
        label: 'Pubquiz → veckoserie (varje onsdag)',
        patch: { repeatWeekly: true },
    },
    {
        id: 'CVoQEARTlTi1qmwfXTjS',
        label: 'Dart → veckoserie (varje torsdag)',
        patch: { repeatWeekly: true },
    },
];

/** Helt nya event från affischerna. */
const NEW_EVENTS: {
    label: string;
    title: string;
    time: Date;
    hasSpecificTime: boolean;
    locationName: string;
    lat: number;
    lng: number;
    hostName: string;
    category: string;
    description: string;
    price?: string;
}[] = [
    {
        label: 'Grilleftermiddag (Grönaberg, ALVESTA — inte Hudiksvall)',
        title: 'Grilleftermiddag vid Soldattorpet',
        time: new Date(2026, 7, 9, 15, 0, 0),
        hasSpecificTime: true,
        locationName: 'Soldattorpet, Grönaberg',
        lat: 57.079894,
        lng: 14.503096,
        hostName: 'Slätthögs Hembygdsförening',
        category: 'food',
        description: 'Slätthögs Hembygdsförening bjuder in till grilleftermiddag vid Soldattorpet '
            + 'i Grönaberg. Ta med det du vill ha grillat samt dryck — föreningen står för grillandet '
            + 'och tillbehör, och bjuder på kaffe/te och kaka. Ingen kostnad eller föranmälan. '
            + 'Efter maten erbjuds lite aktiviteter.',
    },
    {
        label: 'Cruising i samband med Hälsingemarknaden',
        title: 'Cruising i samband med Hälsingemarknaden',
        time: new Date(2026, 8, 5, 0, 0, 0), // 5/9, klockslag saknas på affischen
        hasSpecificTime: false,
        locationName: 'Hudiksvall',
        lat: 61.7274,
        lng: 17.1057,
        hostName: 'Hälsingemarknaden',
        category: 'social',
        description: 'Cruising i Hudiksvall i samband med Hälsingemarknaden, 5 september.',
    },
];

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    console.log(`\n🖼  Affischinfo${DRY ? '  [DRY RUN]' : ''}\n`);

    for (const { id, label, patch } of PATCHES) {
        const ref = db.collection('linkEvents').doc(id);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`  ⚠️  Saknas: ${label} (${id})`); continue; }
        if (!DRY) await ref.update(patch);
        console.log(`  ${DRY ? '▸' : '✅'} ${label}`);
    }

    for (const e of NEW_EVENTS) {
        // Dedup på titel + dag, samma som i det första importskriptet.
        const dayStart = new Date(e.time); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
        const sameTitle = await db.collection('linkEvents').where('title', '==', e.title).get();
        if (sameTitle.docs.some(d => {
            const t = d.get('time')?.toDate?.();
            return t instanceof Date && t >= dayStart && t < dayEnd;
        })) {
            console.log(`  ⏭  Finns redan: ${e.label}`);
            continue;
        }

        const data: Record<string, unknown> = {
            title: e.title,
            url: '',
            time: Timestamp.fromDate(e.time),
            hasSpecificTime: e.hasSpecificTime,
            locationName: e.locationName,
            lat: e.lat,
            lng: e.lng,
            hostName: e.hostName,
            category: e.category,
            description: e.description,
            // Live-spåret (userCreated) — url-lösa event kan inte ligga i
            // aggregatet, som nycklar på url. Se oneoff-hudiksvall-to-usercreated.
            userCreated: true,
            hostUid: ADMIN_UID,
            status: 'published',
            hidden: 0,
            isLocationVerified: true,
            createdAt: Timestamp.now(),
        };
        if (e.price) data.price = e.price;

        if (DRY) { console.log(`  ▸ NY: ${e.label}`); continue; }
        const ref = await db.collection('linkEvents').add(data);
        console.log(`  ✅ NY: ${e.label} → ${ref.id}`);
    }

    console.log('');
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
