#!/usr/bin/env ts-node
/**
 * ENGÅNGS: Laxön Hälsofestival (Tre Hjärtan Retreats) — tipsat som KOMMENTAR
 * på Halmstad-inlägget på Facebook 2026-08-28.
 *
 * Fanns i ingen källa: destinationhalmstad.se listar den, men deras portlet
 * hämtar från Crunchos hostade API där festivalen ligger bortom svarets
 * 200-postersgräns (verifierat: size=250 klipps till 200; direktuppslag på
 * id:t 404:ar). Peach (biljettplattformen) har ingen skrapbar katalog.
 * Den nya källan cruncho-halmstad (registreras samtidigt) fångar framtida
 * Halmstad-event — men just den här skrivs in för hand.
 *
 * Fakta ur peach.nu/c/trehjartanretreats/laxonfestival (läst 2026-08-28):
 * fre 28/8 15–22, lör 29/8 9–22, sön 30/8 9–15. Entré 200–250 kr/dag
 * (+50 kr i entrén), gratis 0–12 år. Laxön-koordinat via Nominatim.
 *
 * Tre dagar = tre poster med #fragment (url är primärnyckel, Haninge-mönstret).
 *
 * Kör:  npx ts-node src/scripts/oneoff-laxon-halsofestival.ts [--dry]
 */

import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { stamped } from '../utils/firestoreStamp';

const DRY = process.argv.includes('--dry');
const BASE_URL = 'https://peach.nu/c/trehjartanretreats/laxonfestival';
const LAXON = { lat: 56.6853752, lng: 12.8722576 };

const DAYS = [
    { frag: 'fredag', when: [2026, 7, 28, 15, 0], label: 'Fredag 15–22', price: '200 kr' },
    { frag: 'lordag', when: [2026, 7, 29, 9, 0], label: 'Lördag 9–22', price: '250 kr' },
    { frag: 'sondag', when: [2026, 7, 30, 9, 0], label: 'Söndag 9–15', price: '200 kr' },
] as const;

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    for (const d of DAYS) {
        const url = `${BASE_URL}#${d.frag}`;
        const existing = await db.collection('linkEvents').where('url', '==', url).get();
        if (!existing.empty) { console.log(`⏭  finns redan: ${d.frag}`); continue; }
        const [y, mo, day, h, mi] = d.when;
        const data = stamped({
            title: `Laxön Hälsofestival – ${d.frag.charAt(0).toUpperCase() + d.frag.slice(1)}`,
            url,
            time: Timestamp.fromDate(new Date(y, mo, day, h, mi, 0)),
            hasSpecificTime: true,
            locationName: 'Laxön, Halmstad',
            extractedAddress: 'Laxön, Furet, Halmstad',
            geocodedQuery: 'community-tips (FB-kommentar på Halmstad-inlägget 2026-08-28)',
            lat: LAXON.lat,
            lng: LAXON.lng,
            hostName: 'Tre Hjärtan Retreats',
            category: 'sport',
            emoji: '🧘',
            description:
                `Tre dagar av yoga, breathwork, träning, workshops, bastu, marknad och återhämtning ` +
                `i naturen på Laxön, ett stenkast från Halmstads centrum. ${d.label}. Eldstad, glamping, ` +
                `morgondopp och kvällsbad — entrén inkluderar öns aktiviteter, utvalda klasser, marknad, ` +
                `bastu och utegym. Gratis för barn 0–12 år.`,
            price: d.price,
            createdAt: Timestamp.now(),
            isLocationVerified: true,
            status: 'published',
        });
        if (DRY) { console.log(`▸ ${d.frag}: ${data.title}`); continue; }
        const ref = await db.collection('linkEvents').add(data);
        console.log(`✅ ${d.frag} → linkEvents/${ref.id}`);
    }
    process.exit(0);
}
main();
