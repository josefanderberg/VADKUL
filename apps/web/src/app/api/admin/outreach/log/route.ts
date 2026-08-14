// /api/admin/outreach/log — utfall, engagemang och "postat"-bekräftelsen.
//
// PATCH { logId, outcome?, likes?, comments?, shares?, ownRepliesCount?,
// notes?, avskriv? }. outcome sätter status (mappningen nedan) +
// outcomeCheckedAt — det enda som stänger de kroniska '?'-raderna i
// TodayPanel. Engagemangssiffror sätter engagementCheckedAt. Utfallet
// denormaliseras till kontakten (lastOutcome + status), och avskriv=true
// sätter doNotPost — grinden 'doNotPost' i rules.ts tar sedan gruppen ur kön.
//
// POST { logId } = "jag har postat det här nu". Först då startar karensen och
// först då räknas inlägget mot dagskvoten — loggregeln är att ingenting är
// postat förrän ägaren säger det (konsolen kan inte se Facebook).

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { KARENS_DAGAR } from '@/lib/outreach/rules';
import type {
    ContactStatus, LogOutcome, LogStatus, OutreachContact, OutreachLogEntry,
} from '@/types/outreach';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

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

/**
 * POST — bekräfta att ett utkast ur delningskön nu ligger uppe i gruppen.
 *
 * Utfallet lämnas medvetet 'okänt': om det släpptes igenom, kölades eller
 * plockades bort vet vi först när ägaren tittat. TodayPanel påminner om det
 * efter 24 h (repo.ts), och PATCH stänger raden. Att gissa utfallet här vore
 * att fylla statistiken med siffror ingen kontrollerat.
 */
export async function POST(request: Request) {
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

    const now = Date.now();
    const nextAllowedAt = now + KARENS_DAGAR * DAY_MS;

    try {
        const logRef = db.collection('outreachLog').doc(logId);

        const result = await db.runTransaction(async tx => {
            const logSnap = await tx.get(logRef);
            if (!logSnap.exists) return { error: 'Loggraden finns inte', httpStatus: 404 } as const;

            const entry = logSnap.data() as OutreachLogEntry;
            if (entry.confirmedByOwner) {
                return { error: 'Raden är redan bekräftad som postad', httpStatus: 409 } as const;
            }

            const contactRef = db.collection('outreachContacts').doc(entry.contactId);
            const contactSnap = await tx.get(contactRef);
            const contact = contactSnap.exists ? contactSnap.data() as OutreachContact : undefined;

            // Godkännandekö ⇒ inlägget ligger osynligt tills en moderator
            // släpper det. Direktläge ⇒ det är uppe nu.
            const queued = (contact?.postingMode ?? 'unknown') !== 'direct';
            const status: LogStatus = queued ? 'i-godkännandekö' : 'postat';

            tx.set(logRef, {
                postedAt: now,
                confirmedByOwner: true,
                status,
                nextAllowedAt,
            }, { merge: true });

            if (contactSnap.exists) {
                const contactStatus: ContactStatus = queued ? 'väntar-godkännande' : 'postad';
                tx.set(contactRef, {
                    lastPostedAt: now,
                    nextAllowedAt,
                    postCount: FieldValue.increment(1),
                    status: contactStatus,
                    updatedAt: now,
                    ...(entry.variant ? { usedVariants: FieldValue.arrayUnion(entry.variant) } : {}),
                }, { merge: true });
            }

            return { ok: true, status, nextAllowedAt } as const;
        });

        if ('error' in result) {
            return NextResponse.json({ error: result.error }, { status: result.httpStatus });
        }
        return NextResponse.json(result);
    } catch (e) {
        console.error('[outreach/log POST]', e);
        return NextResponse.json({ error: 'Bekräftelsen kunde inte sparas' }, { status: 500 });
    }
}

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
