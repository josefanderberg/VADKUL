// /api/admin/outreach/geocode — sätt lat/lng på facebookgrupperna ur deras namn.
//
// GET  = torrkörning: visar vad geokodaren skulle sätta, skriver ingenting.
// POST = skriver (bara de kontakter som saknar koordinat).
//
// Varför en route och inte ett scraper-skript? apps/scraper har rootDir ./src
// och kan inte importera apps/web/src/utils/cityPoints. Att duplicera 291
// orter i två appar är precis hur listorna glider isär. Geokodningen bor
// därför här, där CITY_POINTS redan finns, och triggas från kartan.
//
// Rör ALDRIG en koordinat som redan är satt: geoSource 'manuell' är ägarens
// rättelse och 'stadssida' kommer från CITIES. Idempotent — kan köras om.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { cityFromGroupName } from '@/lib/outreach/geo';
import type { OutreachContact } from '@/types/outreach';

export const dynamic = 'force-dynamic';

interface Plan {
    contactId: string;
    name: string;
    /** null ⇒ namnet gick inte att tyda; kontakten måste sättas för hand. */
    city: string | null;
    lat?: number;
    lng?: number;
    confidence?: 'exakt' | 'gissad';
    matchedOn?: string;
}

async function buildPlan(db: FirebaseFirestore.Firestore) {
    const snap = await db.collection('outreachContacts').where('kind', '==', 'fb-grupp').get();

    const plans: Plan[] = [];
    let redanSatta = 0;

    for (const doc of snap.docs) {
        const c = doc.data() as OutreachContact;
        if (typeof c.lat === 'number' && typeof c.lng === 'number') { redanSatta++; continue; }

        const hit = cityFromGroupName(c.name);
        plans.push(hit
            ? {
                contactId: doc.id, name: c.name, city: hit.name,
                lat: hit.lat, lng: hit.lng, confidence: hit.confidence, matchedOn: hit.matchedOn,
            }
            : { contactId: doc.id, name: c.name, city: null });
    }

    const träffar = plans.filter(p => p.city !== null);
    return {
        summering: {
            totalt: snap.size,
            redanSatta,
            kanSättas: träffar.length,
            varavGissade: träffar.filter(p => p.confidence === 'gissad').length,
            gickInteAttTyda: plans.length - träffar.length,
        },
        plans,
    };
}

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { summering, plans } = await buildPlan(db);
        return NextResponse.json({ torrkörning: true, summering, plans });
    } catch (e) {
        console.error('[outreach/geocode GET]', e);
        return NextResponse.json({ error: 'Geokodningen misslyckades' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { summering, plans } = await buildPlan(db);
        const skrivbara = plans.filter(p => p.city !== null);

        // 85 kontakter ryms i en batch (taket är 500), men skriv i klumpar
        // ändå så det inte spricker den dagen listan blivit tre gånger längre.
        for (let i = 0; i < skrivbara.length; i += 400) {
            const batch = db.batch();
            for (const p of skrivbara.slice(i, i + 400)) {
                batch.set(db.collection('outreachContacts').doc(p.contactId), {
                    city: p.city,
                    lat: p.lat,
                    lng: p.lng,
                    geoSource: 'gissad-ur-namnet',
                    updatedAt: Date.now(),
                }, { merge: true });
            }
            await batch.commit();
        }

        return NextResponse.json({ torrkörning: false, skrivna: skrivbara.length, summering, plans });
    } catch (e) {
        console.error('[outreach/geocode POST]', e);
        return NextResponse.json({ error: 'Geokodningen misslyckades' }, { status: 500 });
    }
}
