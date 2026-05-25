import { NextResponse } from 'next/server';
import { db } from '@/lib/sqlite';

// GET /api/link-events
// Hämtar alla framtida skrapade link events (eller alla om ?all=true anges)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const all = searchParams.get('all') === 'true';
        let rows = [];

        if (all) {
            const stmt = db.prepare('SELECT * FROM link_events ORDER BY time ASC');
            rows = stmt.all() as any[];
        } else {
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Start av idag
            const nowIso = now.toISOString();

            const stmt = db.prepare('SELECT * FROM link_events WHERE hidden = 0 AND time >= ? ORDER BY time ASC');
            rows = stmt.all(nowIso) as any[];
        }

        // Konvertera SQLite rader till LinkEvent objekt (såsom att parses integer hidden till boolean, etc.)
        const events = rows.map((row: any) => ({
            id: row.url, // Vi mappar 'url' till 'id' eftersom frontend förväntar sig 'id'
            url: row.url,
            title: row.title,
            time: new Date(row.time),
            createdAt: new Date(row.createdAt || row.updatedAt || new Date()),
            locationName: row.locationName || '',
            extractedAddress: row.extractedAddress || '',
            geocodedQuery: row.geocodedQuery || '',
            lat: row.lat || 0,
            lng: row.lng || 0,
            hostName: row.hostName || '',
            category: row.category || 'other',
            coverImage: row.coverImage || '',
            description: row.description || '',
            attendees: Number(row.attendees) || 0,
            isLocationVerified: row.isLocationVerified === 1,
            isHostVerified: row.isHostVerified === 1,
            hidden: row.hidden === 1,
            firestoreId: row.firestoreId || null,
        }));

        return NextResponse.json(events);
    } catch (error: any) {
        console.error('Error fetching link events from SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/link-events
// Hanterar bulk- operationer samt individuella insättningar
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        // 1. BULK CREATE
        if (action === 'bulkCreate') {
            const { events } = body;
            if (!Array.isArray(events)) {
                return NextResponse.json({ error: 'Missing events array' }, { status: 400 });
            }

            const stmt = db.prepare(`
                INSERT INTO link_events (
                    url, title, time, locationName, extractedAddress, geocodedQuery,
                    lat, lng, hostName, category, coverImage, description,
                    attendees, createdAt, isLocationVerified, isHostVerified, hidden,
                    firestoreId, updatedAt
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?
                )
                ON CONFLICT(url) DO UPDATE SET
                    title = excluded.title,
                    time = excluded.time,
                    locationName = excluded.locationName,
                    lat = excluded.lat,
                    lng = excluded.lng,
                    hostName = excluded.hostName,
                    category = excluded.category,
                    coverImage = excluded.coverImage,
                    description = excluded.description,
                    updatedAt = excluded.updatedAt
            `);

            // Kör allt i en SQLite transaction för maximal hastighet
            const transaction = db.transaction((evts: any[]) => {
                for (const event of evts) {
                    stmt.run(
                        event.url,
                        event.title,
                        new Date(event.time).toISOString(),
                        event.locationName || '',
                        event.extractedAddress || '',
                        event.geocodedQuery || '',
                        event.lat || 0,
                        event.lng || 0,
                        event.hostName || '',
                        event.category || 'other',
                        event.coverImage || '',
                        event.description || '',
                        Number(event.attendees) || 0,
                        new Date(event.createdAt || new Date()).toISOString(),
                        event.isLocationVerified ? 1 : 0,
                        event.isHostVerified ? 1 : 0,
                        event.hidden ? 1 : 0,
                        event.firestoreId || null,
                        new Date().toISOString()
                    );
                }
            });

            transaction(events);
            return NextResponse.json({ success: true, count: events.length });
        }

        // 2. BULK DELETE
        if (action === 'bulkDelete') {
            const { ids } = body;
            if (!Array.isArray(ids)) {
                return NextResponse.json({ error: 'Missing ids array' }, { status: 400 });
            }

            const stmt = db.prepare('DELETE FROM link_events WHERE url = ?');
            
            const transaction = db.transaction((urls: string[]) => {
                for (const url of urls) {
                    stmt.run(url);
                }
            });

            transaction(ids);
            return NextResponse.json({ success: true, count: ids.length });
        }

        // 3. SKAPA ENSTAKA LINK EVENT
        const { title, url, time, locationName, lat, lng, hostName, category, coverImage, price } = body;
        if (!title || !url || !time) {
            return NextResponse.json({ error: 'Missing required fields (title, url, time)' }, { status: 400 });
        }

        const stmt = db.prepare(`
            INSERT INTO link_events (
                url, title, time, locationName, lat, lng, hostName, category, coverImage, hidden, createdAt, updatedAt
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?
            )
            ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                time = excluded.time,
                locationName = excluded.locationName,
                lat = excluded.lat,
                lng = excluded.lng,
                hostName = excluded.hostName,
                category = excluded.category,
                coverImage = excluded.coverImage,
                updatedAt = excluded.updatedAt
        `);

        stmt.run(
            url,
            title,
            new Date(time).toISOString(),
            locationName || '',
            lat || 0,
            lng || 0,
            hostName || '',
            category || 'other',
            coverImage || '',
            new Date().toISOString(),
            new Date().toISOString()
        );

        return NextResponse.json({ success: true, id: url });
    } catch (error: any) {
        console.error('Error handling link event POST in SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/link-events
// Tar bort ett skrapad link event (kräver ?id=...)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
        }

        const stmt = db.prepare('DELETE FROM link_events WHERE url = ?');
        stmt.run(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting link event from SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/link-events
// Uppdaterar/gömmer ett link event (kräver ?id=...)
export async function PUT(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing event ID' }, { status: 400 });
        }

        const body = await request.json();
        const { hidden, category, title, locationName, lat, lng } = body;

        const checkStmt = db.prepare('SELECT 1 FROM link_events WHERE url = ?');
        const exists = checkStmt.get(id);

        if (!exists) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        // Uppdatera gömd-flagga och fält
        const stmt = db.prepare(`
            UPDATE link_events SET
                hidden = COALESCE(?, hidden),
                category = COALESCE(?, category),
                title = COALESCE(?, title),
                locationName = COALESCE(?, locationName),
                lat = COALESCE(?, lat),
                lng = COALESCE(?, lng),
                updatedAt = ?
            WHERE url = ?
        `);

        stmt.run(
            hidden !== undefined ? (hidden ? 1 : 0) : null,
            category || null,
            title || null,
            locationName || null,
            lat !== undefined ? Number(lat) : null,
            lng !== undefined ? Number(lng) : null,
            new Date().toISOString(),
            id
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating link event in SQLite:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
