// /api/admin/outreach/contact — PATCH vitlistade fält på en kontakt.
//
// Body: { contactId, set: { ... } }. Bara fälten i VALIDATORS släpps igenom —
// mejluppföljningens knappar (replyStatus/followUpDueAt), avskrivning och
// admin-DM-anteckningar. Allt annat (identitet, historik, ranking-cache) ägs
// av import-skriptet och kö-/logg-routerna och ska inte kunna skrivas härifrån.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';

export const dynamic = 'force-dynamic';

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
    replyStatus: v => ['inget svar', 'svar', 'nej'].includes(v as string),
    followUpDueAt: v => typeof v === 'number' && Number.isFinite(v),
    doNotPost: v => typeof v === 'boolean',
    status: v => ['orörd', 'utkast', 'postad', 'väntar-godkännande', 'borttagen', 'avskriven'].includes(v as string),
    notes: v => typeof v === 'string',
    adminDmStatus: v => ['ej kontaktad', 'DM skickad', 'ja', 'nej', 'inget svar'].includes(v as string),
    adminDmSentAt: v => typeof v === 'number' && Number.isFinite(v),
    adminDmNote: v => typeof v === 'string',
};

export async function PATCH(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: { contactId?: unknown; set?: unknown };
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }

    const contactId = typeof body.contactId === 'string' ? body.contactId : '';
    const set = body.set && typeof body.set === 'object' ? body.set as Record<string, unknown> : null;
    if (!contactId || !set) return NextResponse.json({ error: 'contactId/set saknas' }, { status: 400 });

    const update: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(set)) {
        if (!VALIDATORS[field]) {
            return NextResponse.json({ error: `Fältet '${field}' får inte skrivas härifrån` }, { status: 400 });
        }
        if (!VALIDATORS[field](value)) {
            return NextResponse.json({ error: `Ogiltigt värde för '${field}'` }, { status: 400 });
        }
        update[field] = value;
    }
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: 'Inget att spara' }, { status: 400 });
    }
    update.updatedAt = Date.now();

    try {
        const ref = db.collection('outreachContacts').doc(contactId);
        if (!(await ref.get()).exists) {
            return NextResponse.json({ error: 'Kontakten finns inte' }, { status: 404 });
        }
        await ref.set(update, { merge: true });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[outreach/contact]', e);
        return NextResponse.json({ error: 'Sparning misslyckades' }, { status: 500 });
    }
}
