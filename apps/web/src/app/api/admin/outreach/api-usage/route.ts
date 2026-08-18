// /api/admin/outreach/api-usage — POST { action: 'key-rotated' } nollställer
// 30-dagars rotationspåminnelsen i konsolens API-kort (outreachStats/apiUsage.
// keyCreatedAt). Anropas från "Ny nyckel inlagd"-knappen när API-nyckeln
// faktiskt bytts i .env-filerna + WEB_ENV-secreten. Förbrukningssiffrorna
// rörs INTE — de är historik oavsett nyckel.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: { action?: unknown };
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }
    if (body.action !== 'key-rotated') {
        return NextResponse.json({ error: 'Okänd action' }, { status: 400 });
    }

    try {
        await db.collection('outreachStats').doc('apiUsage')
            .set({ keyCreatedAt: Date.now() }, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[outreach/api-usage]', e);
        return NextResponse.json({ error: 'Kunde inte nollställa' }, { status: 500 });
    }
}
