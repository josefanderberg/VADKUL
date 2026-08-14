// /api/admin/outreach/plan — morgonkörningen som fyller delningskön.
//
// POST → plockar dagens mogna grupper ur kön, skriver ett färdigt inlägg per
// grupp (samma motor som ✨-knappen) och sparar dem som utkast i outreachLog.
// Ägaren hämtar dem sedan via GET /api/admin/outreach/ready och klistrar in
// dem i grupperna för hand. Routen postar ALDRIG något till Facebook — det
// finns ingen laglig väg dit för grupper (§0 i docs/outreach/admin-konsol-plan.md).
//
// Två sätt att anropa:
//   1. Cronen  — Authorization: Bearer <OUTREACH_CRON_SECRET>
//   2. Ägaren  — Authorization: Bearer <Firebase-ID-token>  (requireAdmin)
//
// Idempotent per dygn: grupper som redan har ett färskt oanvänt utkast hoppas
// över, så en andra körning skapar noll nya rader.

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { isCronCall } from '@/lib/outreach/cronAuth';
import { buildQueueResponse, getRecentLog } from '@/lib/outreach/repo';
import { MAX_POSTS_PER_DAY } from '@/lib/outreach/rules';
import { DraftError, generateDraft, persistDraft } from '@/lib/outreach/draftGenerator';
import { draftFreshness, selectForPlanning } from '@/lib/outreach/planner';
import type { PlanResponse } from '@/types/outreach';

export const dynamic = 'force-dynamic';
// Upp till tre Opus-anrop parallellt — SSR-funktionens standardtimeout räcker inte.
export const maxDuration = 300;

const DAY_MS = 86_400_000;

export async function POST(request: Request) {
    if (!isCronCall(request)) {
        const denied = await requireAdmin(request);
        if (denied) return denied;
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    let body: { limit?: unknown; force?: unknown } = {};
    try { body = await request.json(); } catch { /* tom body är giltig — cronen skickar ingen */ }
    const force = body.force === true;
    const askedLimit = typeof body.limit === 'number' && Number.isFinite(body.limit)
        ? Math.max(0, Math.min(MAX_POSTS_PER_DAY, Math.round(body.limit)))
        : undefined;

    const now = Date.now();

    try {
        const [queueResponse, recentLog] = await Promise.all([
            buildQueueResponse(db),
            getRecentLog(db, now - 3 * DAY_MS),
        ]);

        // Utkast som ligger kvar oanvända OCH fortfarande är postbara. De tar
        // upp dagsplatser — annars skulle kön svälla med text ingen hinner posta.
        const freshPending = recentLog.filter(l =>
            l.status === 'utkast' && !l.confirmedByOwner && draftFreshness(l, now).fresh);
        const alreadyDrafted = new Set(freshPending.map(l => l.contactId));

        const postedToday = queueResponse.quota.postedToday;
        const room = Math.max(0, MAX_POSTS_PER_DAY - postedToday - freshPending.length);
        const limit = force ? (askedLimit ?? MAX_POSTS_PER_DAY) : Math.min(askedLimit ?? room, room);

        const { picked, skipped } = selectForPlanning(queueResponse.queue, { limit, alreadyDrafted });

        const created: PlanResponse['created'] = [];
        const failed: PlanResponse['failed'] = [];

        // Parallellt: tre Opus-anrop i följd spränger tidsbudgeten, och
        // grupperna är oberoende av varandra. Priset är att ingen av dem ser de
        // andras text i "skriv inte likadant"-underlaget — därför jämför
        // /ready satsen mot sig själv (flagNearDuplicates) innan den visas.
        const results = await Promise.allSettled(
            picked.map(c => generateDraft(db, c).then(g => ({ contact: c, generation: g }))),
        );

        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const contact = picked[i];
            if (r.status === 'rejected') {
                const err = r.reason;
                const message = err instanceof DraftError ? err.message : 'Utkastet kunde inte genereras';
                if (!(err instanceof DraftError)) console.error('[outreach/plan]', contact.name, err);
                failed.push({ contactId: contact.id, contactName: contact.name, error: message });
                continue;
            }

            // En misslyckad skrivning får fälla sin egen rad, aldrig hela satsen:
            // de utkast som redan hamnat i kön ska finnas kvar och rapporteras.
            try {
                const saved = await persistDraft(db, contact, r.value.generation, 'auto');
                created.push({
                    logId: saved.logId, contactId: contact.id, contactName: contact.name, variant: saved.variant,
                });
            } catch (e) {
                console.error('[outreach/plan] sparning misslyckades', contact.name, e);
                failed.push({ contactId: contact.id, contactName: contact.name, error: 'Utkastet kunde inte sparas' });
            }
        }

        const payload: PlanResponse = {
            generatedAt: now,
            limit,
            created,
            skipped,
            failed,
            quota: { postedToday, maxPerDay: MAX_POSTS_PER_DAY, freshPending: freshPending.length },
        };
        console.log(`[outreach/plan] ${created.length} utkast skapade, ${skipped.length} överhoppade, ${failed.length} misslyckade`);
        return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('[outreach/plan]', e);
        return NextResponse.json({ error: 'Planeringen misslyckades' }, { status: 500 });
    }
}
