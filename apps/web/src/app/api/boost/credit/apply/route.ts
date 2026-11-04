// POST /api/boost/credit/apply { eventId } - lägg hela kreditsaldot på eventet
// (ingen Stripe). Svarar { applied, until, days, daysLeft }. Kräver Bearer-
// token (lib/authHeaders). Logiken bor i server/boostCredit.ts.
import { NextResponse } from 'next/server';
import { applyBoostCredit, BoostCreditError, creditErrorResponse, requireAccount, requireDb } from '@/server/boostCredit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const uid = await requireAccount(request);
        const db = requireDb();
        let eventId = '';
        try {
            const body = await request.json();
            if (body && typeof body.eventId === 'string') eventId = body.eventId;
        } catch { /* tom/otolkbar kropp → "Inget event angivet" nedan */ }
        if (!eventId.trim()) throw new BoostCreditError(400, 'Inget event angivet.');
        const result = await applyBoostCredit(db, uid, eventId);
        return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
        const { status, error } = creditErrorResponse(e);
        return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
}
