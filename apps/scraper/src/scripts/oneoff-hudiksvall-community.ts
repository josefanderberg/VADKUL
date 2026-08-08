#!/usr/bin/env ts-node
/**
 * ENGÅNGS: lägg in de Hudiksvalls-event som kom in som KOMMENTARER på
 * Facebook-inlägget i "Händer i Hudiksvall!" (2026-08-08).
 *
 * De är inte skrapade — de är tipsade av folk i gruppen och skrivs in på
 * arrangörens vägnar. Därför:
 *   • hostName = den verkliga arrangören (aldrig VADKUL, aldrig tipsaren)
 *   • userCreated sätts INTE — de ska presenteras som vanliga event, inte som
 *     "eget event" med grön VADKUL-profil (se isVadkulHostedEvent)
 *   • url är tom när det inte finns någon riktig källa att länka till. Korten
 *     guardar på `linkEvent.url &&` så ANMÄL-knappen uteblir då.
 *
 * Koordinaterna är geokodade via Nominatim och manuellt kontrollerade — flera
 * lokaler (Mariagården, Kungsvallen) saknas i OSM och har fått ortens position
 * i stället för stadskärnans fallback, som annars lagt Forsa-event i Hudiksvall.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-hudiksvall-community.ts --dry
 *   npx ts-node src/scripts/oneoff-hudiksvall-community.ts
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

const DRY = process.argv.includes('--dry');

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

// Positioner (Nominatim, kontrollerade 2026-08-08).
const P = {
    delsboBygdegard: [61.799999, 16.555431],
    akernasparken: [61.710661, 16.972474],   // Åkernäsparken, Sörforsa — riktig träff
    forsaNasviken: [61.755352, 16.873883],   // Mariagården saknas i OSM → Forsa/Näsviken
    hogsKyrka: [61.766321, 17.040896],       // Kungsvallen saknas i OSM → Hög
    ystegarn: [61.736253, 16.880992],
    hudiksvallHamn: [61.722448, 17.123537],  // Strandpiren/inre fjärden
    halsinglandsMuseum: [61.727974, 17.107613],
    hastaholmen: [61.716379, 17.108301],
    malnvagen10: [61.724246, 17.167608],
} as const;

const SEEDS: Seed[] = [
    {
        title: 'Stintarocken',
        when: '2026-08-08',
        locationName: 'Delsbo bygdegård',
        lat: P.delsboBygdegard[0], lng: P.delsboBygdegard[1],
        hostName: 'Dellenbygdens kultur- och konsertförening',
        category: 'music',
        description: 'Stintarocken i Delsbo bygdegård, arrangerad av Dellenbygdens kultur- och konsertförening.',
        tippedBy: 'Maria Bengtson / Anette Sandström',
    },
    {
        title: 'Engelsk pubquiz på Steam Brew Taproom',
        when: '2026-08-12 19:00',
        locationName: 'Steam Brew Taproom, Håstaholmen 5, Hudiksvall',
        lat: P.hastaholmen[0], lng: P.hastaholmen[1],
        hostName: 'Steam Brew Taproom',
        category: 'social',
        description: 'Engelsk pubquiz på Steam Brew Taproom. Återkommer varje onsdag kl 19–21.',
        tippedBy: 'Tina Hansback',
    },
    {
        title: 'Sommarkrysset i Forsa',
        when: '2026-08-13 18:00',
        locationName: 'Mariagården, Forsa',
        lat: P.forsaNasviken[0], lng: P.forsaNasviken[1],
        hostName: 'Forsa församling',
        category: 'social',
        description: 'Sommarkrysset på Mariagården i Forsa.',
        tippedBy: 'Kantor Maria',
    },
    {
        title: 'Prova på dart hos Hudiksvalls Dartklubb',
        when: '2026-08-13 19:00',
        locationName: 'Malnvägen 10, Hudiksvall',
        lat: P.malnvagen10[0], lng: P.malnvagen10[1],
        hostName: 'Hudiksvalls Dartklubb',
        category: 'sport',
        description: 'Prova på dart hos Hudiksvalls Dartklubb. Återkommer varje torsdag kl 19–21.',
        tippedBy: 'Hudiksvalls Dartklubb',
    },
    {
        title: 'Forsadagen 2026',
        when: '2026-08-15',
        locationName: 'Forsa',
        lat: P.forsaNasviken[0], lng: P.forsaNasviken[1],
        hostName: 'Forsadagen',
        category: 'social',
        description: 'Forsadagen 2026.',
        url: 'https://facebook.com/events/s/forsadagen-2026/2154188462091570/',
        tippedBy: 'Ulrika Brodin',
    },
    {
        title: 'The Yankees i Åkernäsparken',
        when: '2026-08-15',
        locationName: 'Åkernäsparken, Sörforsa',
        lat: P.akernasparken[0], lng: P.akernasparken[1],
        hostName: 'Åkernäsparken',
        category: 'music',
        description: 'The Yankees spelar egna låtar och covers i Åkernäsparken i Forsa.',
        tippedBy: 'Lotta Wiik',
    },
    {
        title: 'Familjedag på Kungsvallen',
        when: '2026-08-15',
        locationName: 'Kungsvallen, Hög',
        lat: P.hogsKyrka[0], lng: P.hogsKyrka[1],
        hostName: 'Högsgårdens bygdegårdsförening och Högs SK',
        category: 'family',
        description: 'Högsgårdens bygdegårdsförening och Högs SK bjuder in till familjedag på Kungsvallen i Hög. Kostnadsfritt. Kiosk och popcornmaskin på plats.',
        tippedBy: 'Högsgårdens Bygdegårdsförening',
    },
    {
        title: 'Utomhusbio: Grannfejden',
        when: '2026-08-15 21:00',
        locationName: 'Kungsvallen, Hög',
        lat: P.hogsKyrka[0], lng: P.hogsKyrka[1],
        hostName: 'Högsgårdens bygdegårdsförening och Högs SK',
        category: 'art',
        description: 'Familjedagen avslutas med utomhusbio på en av gräsplanerna: filmen Grannfejden. Kostnadsfritt. Ta med något att sitta på och gärna en filt.',
        tippedBy: 'Högsgårdens Bygdegårdsförening',
    },
    {
        title: 'HSSS 150 år: båtquiz och knytkalas',
        when: '2026-08-15 14:00',
        locationName: 'Hudiksvalls Segelsällskap, inre fjärden',
        lat: P.hudiksvallHamn[0], lng: P.hudiksvallHamn[1],
        hostName: 'Hudiksvalls Segelsällskap',
        category: 'social',
        description: 'Jubileumsveckan inleds med båtquiz i inre fjärden, start kl 14 (samling kl 13 vid kansliet). Tio frågor placeras ut på vattnet och i land. Kl 18 tänds grillen för gemensamt knytkalas vid kansliet, med prisutdelning under kvällen. Anmälan till kansliet: info@hsss.se.',
        tippedBy: 'Oscar Wiklund',
    },
    {
        title: 'HSSS 150 år: båtkavalkad i hamnen',
        when: '2026-08-16 14:00',
        locationName: 'Hudiksvalls hamn',
        lat: P.hudiksvallHamn[0], lng: P.hudiksvallHamn[1],
        hostName: 'Hudiksvalls Segelsällskap',
        category: 'social',
        description: 'Stor båtkavalkad i den inre hamnbassängen. Ångbåten Fortuna går i täten, följd av klubbens båtar. Sjöräddningssällskapet och Kustbevakningen medverkar. Samling vid kansliet kl 13 för genomgång.',
        tippedBy: 'Oscar Wiklund',
    },
    {
        title: 'HSSS 150 år: öppna bryggor och marin utställning',
        when: '2026-08-17 16:00',
        locationName: 'Hudiksvalls Segelsällskap, hamnplan',
        lat: P.hudiksvallHamn[0], lng: P.hudiksvallHamn[1],
        hostName: 'Hudiksvalls Segelsällskap',
        category: 'social',
        description: 'HSSS öppnar hamnen för allmänheten kl 16–20. Besökare får träffa båtägare, Sjöräddningssällskapet och Kustbevakningen. Gävleborgs Museum visar en marin utställning på hamnplan.',
        tippedBy: 'Oscar Wiklund',
    },
    {
        title: 'Barnens dag på Ystegårn',
        when: '2026-08-17',
        locationName: 'Ystegårn Café & Bistro, Forsa',
        lat: P.ystegarn[0], lng: P.ystegarn[1],
        hostName: 'Ystegårn Café & Bistro',
        category: 'family',
        description: 'Barnens dag på Ystegårn i Forsa.',
        tippedBy: 'Cecilia Henning',
    },
    {
        title: 'Filmvisning: Vinterskepp',
        when: '2026-08-18 18:00',
        locationName: 'Hälsinglands museum, Hudiksvall',
        lat: P.halsinglandsMuseum[0], lng: P.halsinglandsMuseum[1],
        hostName: 'Hudiksvalls Segelsällskap',
        category: 'art',
        description: 'Filmen Vinterskepp visas på museet. Filmens skapare Deborah Shapiro närvarar och svarar på frågor efter visningen. Anmälan till info@hsss.se för medlemmar.',
        tippedBy: 'Oscar Wiklund',
    },
    {
        title: 'SM för Neptunkryssare',
        when: '2026-08-20',
        locationName: 'Hudiksvallsfjärden',
        lat: P.hudiksvallHamn[0], lng: P.hudiksvallHamn[1],
        hostName: 'Hudiksvalls Segelsällskap',
        category: 'sport',
        description: 'Jubileumsveckan avslutas med Svenska Mästerskapen för Neptunkryssare i fjärden, 20–22 augusti. Tävlingarna samlar seglare från hela landet och kan följas från strandpromenaden öster om Strandpiren.',
        tippedBy: 'Oscar Wiklund',
    },
];

/**
 * 'YYYY-MM-DD HH:MM' → exakt lokal tid. 'YYYY-MM-DD' → 12:00Z (≈ 14 lokal),
 * samma normalisering som dbHelper gör för date-only-event så de inte glider
 * till föregående dag vid serialisering.
 */
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

    console.log(`\n📍 Hudiksvall — ${SEEDS.length} event från FB-tråden${DRY ? '  [DRY RUN]' : ''}\n`);

    let written = 0, skipped = 0;
    for (const s of SEEDS) {
        const { time, hasSpecificTime } = parseWhen(s.when);

        // Dedup på titel + kalenderdag (url duger inte — de flesta saknar url,
        // och tom url skulle matcha alla andra tomma). Bara titel-likheten går
        // mot Firestore; dagsjämförelsen görs i minnet, annars krävs ett
        // composite-index på (title, time) som projektet inte har.
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

        const data = {
            title: s.title,
            url: s.url ?? '',
            time: Timestamp.fromDate(time),
            hasSpecificTime,
            locationName: s.locationName,
            extractedAddress: '',
            geocodedQuery: `community-tips (FB "Händer i Hudiksvall", tipsat av ${s.tippedBy})`,
            lat: s.lat,
            lng: s.lng,
            hostName: s.hostName,
            category: s.category,
            description: s.description,
            price: null,
            createdAt: Timestamp.now(),
            isLocationVerified: true,
            status: 'published',
        };

        const stamp = hasSpecificTime
            ? time.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
            : `${time.toISOString().slice(0, 10)} (bara datum)`;

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

    console.log(`\n${DRY ? 'Skulle skriva' : 'Skrev'} ${written} event, hoppade över ${skipped}.\n`);
    if (!DRY && written > 0) {
        console.log('Nästa steg för att de ska synas på kartan:');
        console.log('  npm run sync-to-sqlite && npm run aggregate\n');
    }
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
