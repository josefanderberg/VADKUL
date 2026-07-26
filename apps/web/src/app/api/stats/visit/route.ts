// /api/stats/visit — publik dagsbesöks-beacon (ingen auth, ingen PII).
//
// Räknar upp outreachStats/siteVisits { days.<ÅÅÅÅ-MM-DD>, total } med Admin
// SDK — collectionen är stängd i firestore.rules, så klienter kan aldrig läsa
// eller skriva den direkt. Skrivningen är ETT fast dokument med increments:
// spam kan blåsa upp siffran men aldrig skapa nya rader eller läsa något.
// Svarar alltid 204 — sendBeacon bryr sig inte om svaret.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firestore-admin';
import { stockholmDayKey, VISITS_DOC } from '@/lib/outreach/visits';

export const dynamic = 'force-dynamic';

const BOT_RE = /bot|crawler|spider|preview|headless|lighthouse/i;
const NO_CONTENT = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
    if (BOT_RE.test(request.headers.get('user-agent') ?? '')) return NO_CONTENT();
    const db = getAdminDb();
    if (!db) return NO_CONTENT();
    const day = stockholmDayKey(Date.now());
    try {
        await db.collection('outreachStats').doc(VISITS_DOC).set({
            days: { [day]: FieldValue.increment(1) },
            total: FieldValue.increment(1),
            updatedAt: Date.now(),
        }, { merge: true });
    } catch (e) {
        console.error('[stats/visit]', e);
    }
    return NO_CONTENT();
}
