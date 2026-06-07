/**
 * /api/link-events — Firestore-backed API för skrapade events
 *
 * GET    → Hämtar framtida events (hidden=false), sorterat på tid
 * PUT    → Uppdaterar ett event (hidden, category, title, locationName, lat, lng)
 * DELETE → Tar bort ett event
 * POST   → bulkCreate / bulkDelete (admin-operationer)
 */

import { NextResponse } from 'next/server';
import { getAdminDb, requireAdmin } from '@/lib/firestore-admin';
import { Timestamp } from 'firebase-admin/firestore';

// ── Hjälpfunktioner ──────────────────────────────────────────────────────────

function toDate(value: any): Date {
    if (!value) return new Date(0);
    if (value instanceof Timestamp) return value.toDate();
    if (value?.seconds !== undefined) return new Date(value.seconds * 1000);
    return new Date(value);
}

function docToEvent(id: string, data: FirebaseFirestore.DocumentData) {
    return {
        id:                  data.url ?? id,
        url:                 data.url ?? id,
        title:               data.title               ?? '',
        time:                toDate(data.time),
        createdAt:           toDate(data.createdAt),
        locationName:        data.locationName        ?? '',
        extractedAddress:    data.extractedAddress    ?? '',
        geocodedQuery:       data.geocodedQuery       ?? '',
        lat:                 Number(data.lat)          || 0,
        lng:                 Number(data.lng)          || 0,
        hostName:            data.hostName            ?? '',
        category:            data.category            ?? 'other',
        coverImage:          data.coverImage          ?? '',
        description:         data.description         ?? '',
        price:               data.price               ?? '',
        attendees:           Number(data.attendees)   || 0,
        isLocationVerified:  !!data.isLocationVerified,
        isHostVerified:      !!data.isHostVerified,
        hidden:              !!data.hidden,
        firestoreId:         id,
    };
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { searchParams } = new URL(request.url);
        const all = searchParams.get('all') === 'true';

        let query: FirebaseFirestore.Query = db.collection('linkEvents');

        if (!all) {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            query = query.where('time', '>=', Timestamp.fromDate(todayStart));
        }

        query = query.orderBy('time', 'asc').limit(2000);

        const snapshot = await query.get();

        const events = snapshot.docs
            .map(doc => docToEvent(doc.id, doc.data()))
            .filter(e => !e.hidden);   // filtrera dolda i JS — undviker composite index

        return NextResponse.json(events);
    } catch (error: any) {
        console.error('[api/link-events] GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');   // Kan vara url eller firestoreId
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const body = await request.json();
        const { hidden, category, title, locationName, lat, lng } = body;

        // Hitta dokumentet — försök med url-fältet om id inte är ett Firestore-ID
        let docRef: FirebaseFirestore.DocumentReference | null = null;

        const byUrl = await db.collection('linkEvents').where('url', '==', id).limit(1).get();
        if (!byUrl.empty) {
            docRef = byUrl.docs[0].ref;
        } else {
            // Fallback: försök direkt med Firestore-ID
            const direct = db.collection('linkEvents').doc(id);
            const snap = await direct.get();
            if (snap.exists) docRef = direct;
        }

        if (!docRef) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

        const update: Record<string, any> = { updatedAt: Timestamp.now() };
        if (hidden    !== undefined) update.hidden       = hidden;
        if (category  !== undefined) update.category     = category;
        if (title     !== undefined) update.title        = title;
        if (locationName !== undefined) update.locationName = locationName;
        if (lat       !== undefined) update.lat          = Number(lat);
        if (lng       !== undefined) update.lng          = Number(lng);

        await docRef.update(update);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[api/link-events] PUT error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const byUrl = await db.collection('linkEvents').where('url', '==', id).limit(1).get();
        if (!byUrl.empty) {
            await byUrl.docs[0].ref.delete();
        } else {
            await db.collection('linkEvents').doc(id).delete();
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[api/link-events] DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 503 });

    try {
        const body = await request.json();
        const { action } = body;

        // ── bulkCreate ──────────────────────────────────────────────────────
        if (action === 'bulkCreate') {
            const { events } = body;
            if (!Array.isArray(events)) {
                return NextResponse.json({ error: 'Missing events array' }, { status: 400 });
            }

            const batch = db.batch();
            for (const event of events) {
                // Använd url som Firestore-ID (urlencodat för att undvika slash)
                const docId = Buffer.from(event.url ?? '').toString('base64url').slice(0, 100);
                const ref = db.collection('linkEvents').doc(docId);
                batch.set(ref, {
                    ...event,
                    time:      event.time      ? Timestamp.fromDate(new Date(event.time))      : null,
                    createdAt: event.createdAt ? Timestamp.fromDate(new Date(event.createdAt)) : Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }, { merge: true });
            }
            await batch.commit();
            return NextResponse.json({ success: true, count: events.length });
        }

        // ── bulkDelete ──────────────────────────────────────────────────────
        if (action === 'bulkDelete') {
            const { ids } = body;
            if (!Array.isArray(ids)) {
                return NextResponse.json({ error: 'Missing ids array' }, { status: 400 });
            }

            const batch = db.batch();
            for (const id of ids) {
                const byUrl = await db.collection('linkEvents').where('url', '==', id).limit(1).get();
                if (!byUrl.empty) {
                    batch.delete(byUrl.docs[0].ref);
                } else {
                    batch.delete(db.collection('linkEvents').doc(id));
                }
            }
            await batch.commit();
            return NextResponse.json({ success: true, count: ids.length });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('[api/link-events] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
