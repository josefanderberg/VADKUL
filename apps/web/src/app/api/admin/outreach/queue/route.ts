// /api/admin/outreach/queue — publiceringskonsolens kö + dagsvy.
//
// GET: { quota, actions, queue, blocked, counts } — se QueueResponse i
// types/outreach.ts. Endast admin (requireAdmin verifierar Bearer-token +
// users/{uid}.isAdmin ELLER admin@admin.com — samma dubbla väg som
// firestore.rules isAdmin()).

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { buildQueueResponse } from '@/lib/outreach/repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const payload = await buildQueueResponse(db);
        return NextResponse.json(payload, {
            // Aldrig CDN-cachad: dagskvoten och att-göra-listan ska vara färska,
            // och svaret innehåller intern outreach-data.
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (e) {
        console.error('[outreach/queue]', e);
        return NextResponse.json({ error: 'Queue build failed' }, { status: 500 });
    }
}
