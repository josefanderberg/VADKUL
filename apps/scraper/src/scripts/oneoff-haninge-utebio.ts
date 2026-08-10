#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Utomhusbio på Poseidons torg i Handen — tipsat som KOMMENTAR på
 * Facebook-inlägget i Haninge-gruppen (2026-08-10, tipsat av Maria Hamren).
 *
 * Haninge kommuns egen kalender är JS-renderad och källan `haninge-kommun`
 * står som `status: 'dead'` i registry.ts sedan 2026-06-12 — allt vi har från
 * haninge.se i dag kommer från bibliotek.haninge.se. Kommunens arrangemang på
 * Poseidons torg faller alltså helt utanför skrapningen och skrivs in för hand.
 *
 * Följer Hudiksvalls-mönstret (oneoff-hudiksvall-community.ts):
 *   • hostName = den verkliga arrangören (Haninge kommun), aldrig VADKUL
 *   • userCreated sätts INTE — eventen ska presenteras som vanliga länk-event
 *   • tipsaren spåras i geocodedQuery, aldrig som arrangör
 *
 * De två visningarna delar EN programsida, men url är primärnyckel i både
 * SQLite och aggregatet — därför får de var sitt #fragment, precis som
 * bibliotek.haninge.se-eventen redan gör. Utan det skulle den ena skriva över
 * den andra vid sync-to-sqlite.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-haninge-utebio.ts --dry
 *   npx ts-node src/scripts/oneoff-haninge-utebio.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry');

/** Programsidan som listar båda visningarna (haninge.se, hämtad 2026-08-10). */
const PROGRAM_URL =
    'https://www.haninge.se/uppleva-och-gora/evenemang-och-aktiviteter/sommar-i-haninge/sommar-pa-torget/';

/** Poseidons torg, Handen — Nominatim way/29307922, kontrollerad 2026-08-10. */
const POSEIDONS_TORG = { lat: 59.1674062, lng: 18.1387645 };

const TIPPED_BY = 'Maria Hamren';

/** Matchar de skrapade utomhusbio-eventen; `stage`-defaulten är annars 🎭. */
const EMOJI = '🎬';

interface Seed {
    title: string;
    /** 'YYYY-MM-DD HH:MM' för känd tid, 'YYYY-MM-DD' för bara datum. */
    when: string;
    /** #fragment som skiljer visningarna åt på den gemensamma programsidan. */
    fragment: string;
    description: string;
}

const SEEDS: Seed[] = [
    {
        title: 'Utomhusbio på torget: GOAT – bäst i världen',
        when: '2026-08-29 15:00',
        fragment: 'utomhusbio-goat',
        description:
            'Gratis utomhusbio på Poseidons torg i Handen. Bioduken sätts upp mitt på torget ' +
            'och "GOAT – bäst i världen" visas kl 15.00–17.00. Del av Haninge kommuns program ' +
            'Sommar på torget 2026 — allt helt gratis.',
    },
    {
        title: 'Utomhusbio på torget: Elvis Presley in Concert',
        when: '2026-08-29 18:00',
        fragment: 'utomhusbio-elvis',
        description:
            'Gratis utomhusbio på Poseidons torg i Handen. "Elvis Presley in Concert" visas ' +
            'kl 18.00–21.00 och avslutar Haninge kommuns program Sommar på torget 2026 — ' +
            'allt helt gratis.',
    },
];

function parseWhen(when: string): { time: Date; hasSpecificTime: boolean } {
    const m = when.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/);
    if (!m) throw new Error(`Ogiltigt datumformat: "${when}"`);
    const [, y, mo, d, hh, mm] = m;
    if (hh === undefined) {
        return { time: new Date(Date.UTC(+y, +mo - 1, +d, 12, 0, 0)), hasSpecificTime: false };
    }
    return { time: new Date(+y, +mo - 1, +d, +hh, +mm, 0), hasSpecificTime: true };
}

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }

    console.log(`\n🎬 Haninge — ${SEEDS.length} utebio-event från FB-tråden${DRY ? '  [DRY RUN]' : ''}\n`);

    let written = 0, skipped = 0;
    for (const s of SEEDS) {
        const { time, hasSpecificTime } = parseWhen(s.when);
        const url = `${PROGRAM_URL}#${s.fragment}`;

        // Dedup på url — den är primärnyckel i SQLite och aggregatet, och
        // fragmentet gör den unik per visning.
        const existing = await db.collection('linkEvents').where('url', '==', url).get();
        if (!existing.empty) {
            // Kategori-defaulten för `stage` är 🎭, men de skrapade utomhusbio-
            // eventen bär 🎬 (satt av LLM-auditen). Sätt samma här i stället för
            // att köra den globala backfill-emoji, som rör ~975 andra event.
            if (!DRY) {
                for (const d of existing.docs) {
                    if (d.get('emoji') !== EMOJI) await d.ref.update({ emoji: EMOJI });
                }
            }
            console.log(`  ⏭  Finns redan: ${s.title}  (emoji ${EMOJI} säkerställd)`);
            skipped++;
            continue;
        }

        const data = {
            title: s.title,
            url,
            time: Timestamp.fromDate(time),
            hasSpecificTime,
            locationName: 'Poseidons torg, Handen',
            extractedAddress: 'Poseidons torg, 136 40 Handen',
            geocodedQuery: `community-tips (FB Haninge-gruppen, tipsat av ${TIPPED_BY})`,
            lat: POSEIDONS_TORG.lat,
            lng: POSEIDONS_TORG.lng,
            hostName: 'Haninge kommun',
            category: 'stage',
            emoji: EMOJI,
            description: s.description,
            price: 'Gratis',
            createdAt: Timestamp.now(),
            isLocationVerified: true,
            status: 'published',
        };

        const stamp = time.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

        if (DRY) {
            console.log(`  ▸ ${stamp}  ${s.title}`);
            console.log(`      ${data.locationName}  [${data.lat}, ${data.lng}]  · ${data.hostName} · ${data.category}`);
            console.log(`      ${url}`);
            written++;
            continue;
        }

        const ref = await db.collection('linkEvents').add(data);
        console.log(`  ✅ ${stamp}  ${s.title}  → ${ref.id}`);
        written++;
    }

    console.log(`\n${DRY ? 'Skulle skriva' : 'Skrev'} ${written} event, hoppade över ${skipped}.\n`);
    if (!DRY && written > 0) {
        console.log('Nästa steg för att de ska synas på kartan:');
        console.log('  npm run sync-to-sqlite && npm run backfill-emoji && npm run aggregate\n');
    }
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
