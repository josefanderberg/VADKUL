// /api/stats/visit — publik dagsbesöks-beacon (ingen auth, ingen PII).
//
// Räknar upp outreachStats/siteVisits { days.<ÅÅÅÅ-MM-DD>, total } med Admin
// SDK — collectionen är stängd i firestore.rules, så klienter kan aldrig läsa
// eller skriva den direkt. Skrivningen är ETT fast dokument med increments:
// spam kan blåsa upp siffran men aldrig skapa nya rader eller läsa något.
// Svarar alltid 204 — sendBeacon bryr sig inte om svaret.
//
// PER STAD (Josef 26/8): med JSON-kroppen { stad: <slug> } räknas i stället
// stadssidans besök i outreachStats/cityVisits (cities.<slug>.total +
// cities.<slug>.days.<dag>). Sluggen valideras mot CITIES-listan — okända
// sluggar kastas, så spam aldrig kan skapa nya fält. Ett anrop räknar EN av
// räknarna (stad ELLER sajt), aldrig båda: sajträknaren pingas separat av
// SiteVisitBeacon och skulle annars dubbelräknas.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firestore-admin';
import { CITY_VISITS_DOC, stockholmDayKey, VISITS_DOC } from '@/lib/outreach/visits';
import { CITIES } from '@/app/(v1)/evenemang/cityData';

export const dynamic = 'force-dynamic';

const BOT_RE = /bot|crawler|spider|preview|headless|lighthouse/i;
const NO_CONTENT = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const CITY_SLUGS = new Set(CITIES.map(c => c.slug));

export async function POST(request: Request) {
    if (BOT_RE.test(request.headers.get('user-agent') ?? '')) return NO_CONTENT();
    const db = getAdminDb();
    if (!db) return NO_CONTENT();
    const day = stockholmDayKey(Date.now());
    // Kroppen är valfri (sajt-beaconen skickar ingen). Trasig JSON = ingen stad.
    let stad: string | null = null;
    try {
        const body = await request.json();
        if (body && typeof body.stad === 'string' && CITY_SLUGS.has(body.stad)) stad = body.stad;
    } catch { /* ingen/otolkbar kropp → sajträknaren */ }
    try {
        if (stad) {
            await db.collection('outreachStats').doc(CITY_VISITS_DOC).set({
                // Växer med ~en rad per stad och dag (31 städer ≈ 300 kB/år,
                // långt under 1 MB-taket) — behöver dokumentet bantas någon
                // gång framöver är det ett db-janitor-jobb, inte klientens.
                cities: { [stad]: { total: FieldValue.increment(1), days: { [day]: FieldValue.increment(1) } } },
                updatedAt: Date.now(),
            }, { merge: true });
        } else {
            await db.collection('outreachStats').doc(VISITS_DOC).set({
                days: { [day]: FieldValue.increment(1) },
                total: FieldValue.increment(1),
                updatedAt: Date.now(),
            }, { merge: true });
        }
    } catch (e) {
        console.error('[stats/visit]', e);
    }
    return NO_CONTENT();
}
