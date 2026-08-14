// /api/admin/outreach/ready — delningskön: färdiga inlägg att klistra in.
//
// GET → { ready, stale }. `ready` är inlägg som går att posta som de är, ett
// per namngiven grupp, med gruppnamn + gruppens URL så att det bara är att
// öppna, klistra in och posta. `stale` är utkast vars eventrader hunnit
// passera — de ska INTE postas (LÄRDOM 30/7), utan genereras om.
//
// Läsvägen är avsiktligt separerad från plan-routen: morgonkörningen kan ta
// en minut och kosta Claude-anrop, medan den här är billig och kan läsas hur
// ofta som helst — från konsolen eller med en curl mot cron-hemligheten.
//
// Bekräfta postat: POST /api/admin/outreach/log (sätter karens + dagskvot).

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { isCronCall } from '@/lib/outreach/cronAuth';
import { getAllContacts, getRecentLog } from '@/lib/outreach/repo';
import { MAX_POSTS_PER_DAY } from '@/lib/outreach/rules';
import { flagNearDuplicates, toReadyPost } from '@/lib/outreach/planner';
import type { OutreachContact, ReadyResponse } from '@/types/outreach';

export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

export async function GET(request: Request) {
    if (!isCronCall(request)) {
        const denied = await requireAdmin(request);
        if (denied) return denied;
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    const now = Date.now();

    try {
        // Fönstret hålls litet med enbart draftCreatedAt i villkoret — då räcker
        // Firestores automatiska enfältsindex och inget sammansatt index behövs.
        const [recentLog, contacts] = await Promise.all([
            getRecentLog(db, now - 3 * DAY_MS),
            getAllContacts(db),
        ]);

        const byId = new Map<string, OutreachContact>(contacts.map(c => [c.id, c]));

        const drafts = recentLog
            .filter(l => l.status === 'utkast' && !l.confirmedByOwner)
            .sort((a, b) => b.draftCreatedAt - a.draftCreatedAt)
            .map(l => toReadyPost(l, byId.get(l.contactId), now));

        const ready = drafts.filter(p => p.fresh);
        const stale = drafts.filter(p => !p.fresh);
        flagNearDuplicates(ready);

        const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
        const postedToday = recentLog.filter(l =>
            l.channel === 'fb-grupp' && l.confirmedByOwner && (l.postedAt ?? 0) >= startOfDay.getTime()).length;

        const payload: ReadyResponse = {
            generatedAt: now,
            quota: { postedToday, maxPerDay: MAX_POSTS_PER_DAY },
            ready,
            stale,
        };
        return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (e) {
        console.error('[outreach/ready]', e);
        return NextResponse.json({ error: 'Delningskön kunde inte hämtas' }, { status: 500 });
    }
}
