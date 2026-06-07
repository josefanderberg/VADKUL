/**
 * GET /api/admin/review
 *
 * Returnerar events att granska manuellt:
 *   - aiAudit.verdict ∈ ('suspect', 'junk'), eller
 *   - hidden=true (för revisionsmöjlighet)
 *
 * Query-params:
 *   ?verdict=suspect|junk|all  — filtrera på AI-verdict (default: all)
 *   ?showHidden=true            — inkludera redan-hidden events (default: false)
 *   ?limit=N                    — default 100
 */

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { Timestamp } from 'firebase-admin/firestore';

function toDate(value: any): Date {
    if (!value) return new Date(0);
    if (value instanceof Timestamp) return value.toDate();
    if (value?.seconds !== undefined) return new Date(value.seconds * 1000);
    return new Date(value);
}

export async function GET(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { searchParams } = new URL(request.url);
        const verdictFilter = searchParams.get('verdict') || 'all';
        const showHidden = searchParams.get('showHidden') === 'true';
        const limit = parseInt(searchParams.get('limit') || '100', 10);

        // Vi måste hämta brett och filtrera i JS — Firestore composite indexes
        // på aiAudit.verdict + time + hidden skulle krävas annars.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const snap = await db.collection('linkEvents')
            .where('time', '>=', Timestamp.fromDate(todayStart))
            .orderBy('time', 'asc')
            .limit(2000)
            .get();

        const events = snap.docs
            .map(d => {
                const data = d.data();
                return {
                    firestoreId: d.id,
                    url: data.url || '',
                    title: data.title || '',
                    time: toDate(data.time),
                    locationName: data.locationName || '',
                    extractedAddress: data.extractedAddress || '',
                    lat: Number(data.lat) || 0,
                    lng: Number(data.lng) || 0,
                    hostName: data.hostName || '',
                    category: data.category || 'other',
                    coverImage: data.coverImage || '',
                    description: data.description || '',
                    hidden: !!data.hidden,
                    isLocationVerified: !!data.isLocationVerified,
                    aiAudit: data.aiAudit || null,
                };
            })
            .filter(e => {
                // Filtrera baserat på verdict
                if (verdictFilter === 'all') {
                    // Visa allt som behöver granskning: suspect/junk eller hidden (om showHidden)
                    if (e.aiAudit && (e.aiAudit.verdict === 'suspect' || e.aiAudit.verdict === 'junk')) return true;
                    if (showHidden && e.hidden) return true;
                    return false;
                }
                if (verdictFilter === 'suspect') return e.aiAudit?.verdict === 'suspect';
                if (verdictFilter === 'junk') return e.aiAudit?.verdict === 'junk';
                if (verdictFilter === 'hidden') return e.hidden;
                if (verdictFilter === 'foreign') return e.aiAudit?.inSweden === false;
                return false;
            })
            .slice(0, limit);

        // Summary counts för UI
        const allSnap = snap.docs.map(d => d.data());
        const counts = {
            total: allSnap.length,
            suspect: allSnap.filter(d => d.aiAudit?.verdict === 'suspect').length,
            junk: allSnap.filter(d => d.aiAudit?.verdict === 'junk').length,
            hidden: allSnap.filter(d => d.hidden).length,
            foreign: allSnap.filter(d => d.aiAudit?.inSweden === false).length,
            auditedTotal: allSnap.filter(d => d.aiAudit).length,
        };

        return NextResponse.json({ events, counts });
    } catch (error: any) {
        console.error('[api/admin/review] GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
