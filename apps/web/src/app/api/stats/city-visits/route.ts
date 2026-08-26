// /api/stats/city-visits — stadssidornas besökssiffror till topplistan på
// /evenemang: { <slug>: { week, total } } för alla städer i CITIES (0 när
// inget räknats). week = de senaste 7 dagarna (idag + 6 bakåt, svensk tid).
//
// EN dokumentläsning (outreachStats/cityVisits) per CDN-miss — svaret CDN-
// cachas i 5 min (s-maxage) med en timmes stale-while-revalidate, så
// Firestore-reads inte skalar med besökarna (repo-regeln: reads är den
// största driftkostnaden). Collectionen är stängd i firestore.rules; den här
// server-routen är enda läsvägen.

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firestore-admin';
import { CITY_VISITS_DOC, lastNDayKeys } from '@/lib/outreach/visits';
import { CITIES } from '@/app/(v1)/evenemang/cityData';

export const dynamic = 'force-dynamic';

type CityVisitEntry = { total?: number; days?: Record<string, number> };

export async function GET() {
    const out: Record<string, { week: number; total: number }> = {};
    for (const c of CITIES) out[c.slug] = { week: 0, total: 0 };

    const db = getAdminDb();
    if (db) {
        try {
            const snap = await db.collection('outreachStats').doc(CITY_VISITS_DOC).get();
            const cities = (snap.data()?.cities ?? {}) as Record<string, CityVisitEntry>;
            const weekDays = lastNDayKeys(7, Date.now());
            for (const slug of Object.keys(out)) {
                const entry = cities[slug];
                if (!entry) continue;
                out[slug].total = typeof entry.total === 'number' ? entry.total : 0;
                out[slug].week = weekDays.reduce((sum, day) => sum + (entry.days?.[day] ?? 0), 0);
            }
        } catch (e) {
            console.error('[stats/city-visits]', e);
        }
    }

    return NextResponse.json(out, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
}
