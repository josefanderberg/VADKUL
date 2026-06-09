import { NextResponse } from 'next/server';
import { db } from '@/lib/sqlite';
import crypto from 'crypto';

// GET /api/events
// Hämtar alla framtida användarevent (och valfritt ett specifikt event via ?id=...)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // Hämta specifikt event
            const stmt = db.prepare('SELECT * FROM user_events WHERE id = ?');
            const row = stmt.get(id) as any;

            if (!row) {
                return NextResponse.json({ error: 'Event not found' }, { status: 404 });
            }

            // Deserialisera JSON
            return NextResponse.json({
                ...row,
                price: Number(row.price),
                minParticipants: Number(row.minParticipants),
                maxParticipants: Number(row.maxParticipants),
                minAge: Number(row.minAge),
                maxAge: Number(row.maxAge),
                requiresApproval: row.requiresApproval === 1,
                host: JSON.parse(row.host),
                attendees: JSON.parse(row.attendees),
            });
        }

        // Hämta alla framtida event (eller alla om ?all=true anges)
        const all = searchParams.get('all') === 'true';
        let rows = [];

        if (all) {
            const stmt = db.prepare('SELECT * FROM user_events ORDER BY time ASC');
            rows = stmt.all() as any[];
        } else {
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Start av idag
            const nowIso = now.toISOString();

            const stmt = db.prepare('SELECT * FROM user_events WHERE time >= ? ORDER BY time ASC');
            rows = stmt.all(nowIso) as any[];
        }

        // Deserialisera alla JSON-strängar
        const events = rows.map((row: any) => ({
            ...row,
            price: Number(row.price),
            minParticipants: Number(row.minParticipants),
            maxParticipants: Number(row.maxParticipants),
            minAge: Number(row.minAge),
            maxAge: Number(row.maxAge),
            requiresApproval: row.requiresApproval === 1,
            host: JSON.parse(row.host),
            attendees: JSON.parse(row.attendees),
        }));

        return NextResponse.json(events);
    } catch (error: any) {
        console.error('Error fetching user events from SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/events
// Skapar ett nytt användarevent
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            title, type, description, locationName, lat, lng, time,
            price, minParticipants, maxParticipants, minAge, maxAge,
            ageCategory, requiresApproval, coverImage, customCategory,
            host, attendees
        } = body;

        if (!title || !time || !host) {
            return NextResponse.json({ error: 'Missing required fields (title, time, host)' }, { status: 400 });
        }

        const id = body.id || crypto.randomUUID();
        const createdAt = body.createdAt || new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO user_events (
                id, type, title, description, locationName, lat, lng, time,
                price, minParticipants, maxParticipants, minAge, maxAge,
                ageCategory, requiresApproval, coverImage, customCategory,
                views, host, attendees, createdAt
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                0, ?, ?, ?
            )
        `);

        stmt.run(
            id,
            type || 'other',
            title,
            description || '',
            locationName || 'Vald plats',
            lat || 0,
            lng || 0,
            new Date(time).toISOString(),
            Number(price) || 0,
            Number(minParticipants) || 0,
            Number(maxParticipants) || 0,
            Number(minAge) || 0,
            Number(maxAge) || 0,
            ageCategory || 'adults',
            requiresApproval ? 1 : 0,
            coverImage || '',
            customCategory || '',
            JSON.stringify(host),
            JSON.stringify(attendees || []),
            createdAt
        );

        return NextResponse.json({ success: true, id });
    } catch (error: any) {
        console.error('Error creating user event in SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/events
// Uppdaterar ett befintligt användarevent (kräver ?id=...)
export async function PUT(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
        }

        const body = await request.json();
        const {
            title, type, description, locationName, lat, lng, time,
            price, minParticipants, maxParticipants, minAge, maxAge,
            ageCategory, requiresApproval, coverImage, customCategory,
            host, attendees, views
        } = body;

        // Kontrollera om det finns
        const checkStmt = db.prepare('SELECT 1 FROM user_events WHERE id = ?');
        const exists = checkStmt.get(id);

        if (!exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const stmt = db.prepare(`
            UPDATE user_events SET
                title = ?,
                type = ?,
                description = ?,
                locationName = ?,
                lat = ?,
                lng = ?,
                time = ?,
                price = ?,
                minParticipants = ?,
                maxParticipants = ?,
                minAge = ?,
                maxAge = ?,
                ageCategory = ?,
                requiresApproval = ?,
                coverImage = ?,
                customCategory = ?,
                host = ?,
                attendees = ?,
                views = COALESCE(?, views)
            WHERE id = ?
        `);

        stmt.run(
            title,
            type,
            description,
            locationName,
            lat,
            lng,
            new Date(time).toISOString(),
            Number(price),
            Number(minParticipants),
            Number(maxParticipants),
            Number(minAge),
            Number(maxAge),
            ageCategory,
            requiresApproval ? 1 : 0,
            coverImage,
            customCategory,
            JSON.stringify(host),
            JSON.stringify(attendees),
            views !== undefined ? Number(views) : null,
            id
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating user event in SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/events
// Tar bort ett användarevent (kräver ?id=...)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
        }

        const checkStmt = db.prepare('SELECT 1 FROM user_events WHERE id = ?');
        const exists = checkStmt.get(id);

        if (!exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        const stmt = db.prepare('DELETE FROM user_events WHERE id = ?');
        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting user event from SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
