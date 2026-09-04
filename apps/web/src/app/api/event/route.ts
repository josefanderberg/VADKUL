import { NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firestore-admin';
import { buildDeepLinkEventIndex, type DeepLinkEvent } from '@/lib/deepLinkEventIndex';

/**
 * ETT event ur aggregaten: /api/event?id=<eventId>
 *
 * Djuplänksvägen (/?event= från stadssidor, delade länkar, IG) lät kortet
 * vänta på HELA lagerkedjan (destinations 16 MB → kartmålning → cards 30 MB →
 * descriptions 14 MB rå JSON) innan värd/bild/beskrivning fanns — det ENDA
 * eventet besökaren bad om kom sist. Den här routen svarar med precis det
 * eventets kortfält (~1 kB) så kortet kan stå komplett innan lagren ens
 * börjat laddas.
 *
 * Samma dataväg som /api/events/[layer]: Firestore-aggregaten (färska efter
 * nattkörningen, till skillnad från deploy-snapshoten i public/). Läskostnad:
 * 1 index-doc-read per CDN-miss för versionskollen; själva indexet byggs om
 * först när updatedAt ändrats (1×/dygn per instans — shard-reads är interna,
 * ingen internet-egress). Query-param i stället för path-segment: event-id:n
 * ÄR url:er, och %2F i path-segment normaliseras/avvisas av CDN-lager.
 *
 * OBS: användarskapade event (linkEvents) finns INTE i aggregaten och svarar
 * 404 här — deras djuplänkar täcks av kartans egna user-events-hämtning som
 * i praktiken alltid är före aggregaten.
 */
export const dynamic = 'force-dynamic';

const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
} as const;
// Missar cachas kortare: eventet kan dyka upp i nästa nattbygge.
const MISS_HEADERS = { 'Cache-Control': 'public, max-age=60, s-maxage=600' } as const;

type LayerDoc = { updatedAt?: string; events?: unknown[]; data?: Record<string, string> };

/** Läs ett lager som [layer]-routen gör: index-doc med shardCount → slå ihop
 *  shards, annars ligger allt i index-docen. `indexData` kan skickas in när
 *  docen redan är läst (versionskollen) så den inte läses två gånger. */
async function readLayer(
    db: Firestore,
    layer: 'destinations' | 'cards' | 'descriptions',
    indexData?: LayerDoc | null,
): Promise<LayerDoc | null> {
    let data = indexData;
    if (data === undefined) {
        const snap = await db.collection('aggregatedEvents').doc(layer).get();
        data = snap.exists ? (snap.data() as LayerDoc) : null;
    }
    if (!data) return null;
    const shardCount = typeof (data as any).shardCount === 'number' ? (data as any).shardCount : 0;
    if (shardCount <= 0) return data;
    const refs = Array.from({ length: shardCount }, (_, i) =>
        db.collection('aggregatedEvents').doc(`${layer}_${i}`));
    const snaps = await db.getAll(...refs);
    if (layer === 'descriptions') {
        const merged: Record<string, string> = {};
        for (const s of snaps) if (s.exists) Object.assign(merged, (s.data() as any)?.data || {});
        return { updatedAt: data.updatedAt, data: merged };
    }
    const events: unknown[] = [];
    for (const s of snaps) if (s.exists) events.push(...(((s.data() as any)?.events) || []));
    return { updatedAt: data.updatedAt, events };
}

// Index per datauppdatering (destinations.updatedAt = versionsnyckel — lagren
// byggs ihop av samma nattkörning). Singleflight: samtidiga CDN-missar under
// en ombyggnad ska inte trippla shard-läsningarna.
let indexMemo: { updatedAt: string; index: Map<string, DeepLinkEvent> } | null = null;
let indexBuild: Promise<Map<string, DeepLinkEvent>> | null = null;

async function getIndex(
    db: Firestore,
    updatedAt: string,
    destIndexData: LayerDoc,
): Promise<Map<string, DeepLinkEvent>> {
    if (indexMemo && (!updatedAt || indexMemo.updatedAt === updatedAt)) return indexMemo.index;
    if (!indexBuild) {
        indexBuild = (async () => {
            const [dest, cards, descs] = await Promise.all([
                readLayer(db, 'destinations', destIndexData),
                readLayer(db, 'cards'),
                readLayer(db, 'descriptions'),
            ]);
            const index = buildDeepLinkEventIndex(
                dest?.events || [],
                cards?.events || [],
                descs?.data || {},
            );
            indexMemo = { updatedAt, index };
            return index;
        })().finally(() => { indexBuild = null; });
    }
    return indexBuild;
}

export async function GET(request: Request) {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
        return NextResponse.json({ error: 'id saknas' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const db = getAdminDb();
    if (!db) {
        // Ingen cache på fel — klienten väntar på aggregaten som förut.
        return NextResponse.json({ error: 'Firestore ej tillgänglig' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    try {
        const indexSnap = await db.collection('aggregatedEvents').doc('destinations').get();
        if (!indexSnap.exists) {
            return NextResponse.json({ error: 'Aggregaten saknas' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
        }
        const destIndexData = indexSnap.data() as LayerDoc;
        const updatedAt = typeof destIndexData.updatedAt === 'string' ? destIndexData.updatedAt : '';

        const etag = `"e:${updatedAt}"`;
        if (updatedAt && request.headers.get('if-none-match') === etag) {
            return new NextResponse(null, { status: 304, headers: { ...CACHE_HEADERS, ETag: etag } });
        }

        const index = await getIndex(db, updatedAt, destIndexData);
        const event = index.get(id);
        if (!event) {
            return NextResponse.json({ error: 'Okänt event' }, { status: 404, headers: MISS_HEADERS });
        }
        return NextResponse.json({ updatedAt, event }, {
            headers: { ...CACHE_HEADERS, ...(updatedAt ? { ETag: etag } : {}) },
        });
    } catch (e) {
        console.error('[api/event]', e);
        return NextResponse.json({ error: 'Läsfel' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
