// /api/admin/outreach/organizers — Arrangörer-flikens data (14/9).
//
// GET → eventStats grupperat per arrangör (bara KLICKADE dokument lämnar
// Firestore — kostnadsskyddet bor i organizerStats) + join mot arrangörs-
// kontakterna. Hämtas först när fliken öppnas, aldrig i kö-anropet.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { buildOrganizerStats } from '@/lib/outreach/organizerStats';
import type { OrganizerListResponse } from '@/types/outreach';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { organizers, dayDataSince } = await buildOrganizerStats(db);
        const body: OrganizerListResponse = { generatedAt: Date.now(), organizers, dayDataSince };
        return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('[outreach/organizers]', e);
        return NextResponse.json({ error: 'Kunde inte sammanställa arrangörsstatistiken.' }, { status: 500 });
    }
}
