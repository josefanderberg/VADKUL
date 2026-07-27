// /api/admin/outreach/log — PATCH utfall + engagemang för en loggrad.
//
// Body: { logId, outcome?, likes?, comments?, shares?, ownRepliesCount?,
// notes?, avskriv? }. outcome sätter status (mappningen nedan) +
// outcomeCheckedAt — det enda som stänger de kroniska '?'-raderna i
// TodayPanel. Engagemangssiffror sätter engagementCheckedAt. Utfallet
// denormaliseras till kontakten (lastOutcome + status), och avskriv=true
// sätter doNotPost — grinden 'doNotPost' i rules.ts tar sedan gruppen ur kön.
// POST (bekräfta postat från utkast) byggs med utkastgeneratorn i etapp 2.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import type { ContactStatus, LogOutcome, LogStatus } from '@/types/outreach';

export const dynamic = 'force-dynamic';

const STATUS_BY_OUTCOME: Record<LogOutcome, LogStatus> = {
    'publicerat-direkt': 'postat',
    'krävde-godkännande': 'i-godkännandekö',
    'godkänt-uppe': 'godkänt-uppe',
    'borttagen': 'borttagen',
    'nekad': 'nekad',
    'okänt': 'okänt',
};

// nekad/okänt lämnar kontaktstatusen orörd — 'nekad' finns inte i
// ContactStatus och ska inte låtsas vara 'borttagen'.
const CONTACT_STATUS_BY_OUTCOME: Partial<Record<LogOutcome, ContactStatus>> = {
    'publicerat-direkt': 'postad',
    'godkänt-uppe': 'postad',
    'krävde-godkännande': 'väntar-godkännande',
    'borttagen': 'borttagen',
};

const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined;

export async function PATCH(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Ogiltig JSON' }, { status: 400 });
    }

    const logId = typeof body.logId === 'string' ? body.logId : '';
    if (!logId) return NextResponse.json({ error: 'logId saknas' }, { status: 400 });

    const outcome = Object.hasOwn(STATUS_BY_OUTCOME, body.outcome as string)
        ? body.outcome as LogOutcome : undefined;

    const now = Date.now();
    const update: Record<string, unknown> = {};
    if (outcome) {
        update.outcome = outcome;
        update.status = STATUS_BY_OUTCOME[outcome];
        update.outcomeCheckedAt = now;
        if (outcome === 'borttagen') update.removedAt = now;
        if (outcome === 'godkänt-uppe') update.approvalReleasedAt = now;
    }
    let hasEngagement = false;
    for (const field of ['likes', 'comments', 'shares', 'ownRepliesCount'] as const) {
        const v = num(body[field]);
        if (v !== undefined) { update[field] = v; hasEngagement = true; }
    }
    if (hasEngagement) update.engagementCheckedAt = now;
    if (typeof body.notes === 'string' && body.notes.trim()) update.notes = body.notes.trim();

    const avskriv = body.avskriv === true;
    if (Object.keys(update).length === 0 && !avskriv) {
        return NextResponse.json({ error: 'Inget att spara' }, { status: 400 });
    }

    try {
        const ref = db.collection('outreachLog').doc(logId);
        const snap = await ref.get();
        if (!snap.exists) return NextResponse.json({ error: 'Loggraden finns inte' }, { status: 404 });
        if (Object.keys(update).length > 0) await ref.set(update, { merge: true });

        const contactId = (snap.data() as { contactId?: string }).contactId;
        if (contactId) {
            const cUpdate: Record<string, unknown> = { updatedAt: now };
            if (outcome) {
                cUpdate.lastOutcome = outcome;
                const cs = CONTACT_STATUS_BY_OUTCOME[outcome];
                if (cs) cUpdate.status = cs;
            }
            if (avskriv) { cUpdate.doNotPost = true; cUpdate.status = 'avskriven'; }
            await db.collection('outreachContacts').doc(contactId).set(cUpdate, { merge: true });
        }
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[outreach/log]', e);
        return NextResponse.json({ error: 'Sparning misslyckades' }, { status: 500 });
    }
}
