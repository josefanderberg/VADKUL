// POST /api/boost/credit/settle - avräkna anroparens boost-kvitton vars event
// hunnit vara och svara med kreditsaldot { days, settled }. Kräver Bearer-
// token (lib/authHeaders). Logiken bor i server/boostCredit.ts, regeln i
// @vadkul/kontrakt boostCredit.ts. Se docs/stripe-event-boost.md.
import { NextResponse } from 'next/server';
import { creditErrorResponse, requireAccount, requireDb, settleBoostCredits } from '@/server/boostCredit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const uid = await requireAccount(request);
        const db = requireDb();
        const balance = await settleBoostCredits(db, uid);
        return NextResponse.json(balance, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
        const { status, error } = creditErrorResponse(e);
        return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
    }
}
