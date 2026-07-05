import { NextResponse } from 'next/server';
import { gzipSync, gunzipSync } from 'zlib';
import { readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { getAdminDb } from '@/lib/firestore-admin';

/**
 * CDN-cachad utlämning av event-aggregaten (destinations/cards/descriptions).
 *
 * Bakgrund: klienten läste aggregat-sharden direkt ur Firestore → ~26 MB
 * OKOMPRIMERAD egress per ny besökare = den stora posten på GCP-fakturan
 * ("Cloud Firestore Internet Data Transfer Out"). Den här routen flyttar
 * läsningen till servern och låter Firebase Hostings CDN + gzip ta trafiken:
 *
 *   besökare → Hosting-CDN (cache-träff, gzippad ~5:1) → [vid miss] denna
 *   route → Firestore (serverläsning, ingen internet-egress per besökare)
 *
 * s-maxage=3600: skrapern bygger om aggregaten 1×/dygn (06:00), så en timmes
 * CDN-cache betyder färskt innehåll senast 07:00 — och att routen (och
 * Firestore) bara träffas några gånger i timmen totalt, inte per besökare.
 */
export const dynamic = 'force-dynamic';

const LAYERS = new Set(['destinations', 'cards', 'descriptions']);

const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    Vary: 'Accept-Encoding',
} as const;

// Varm funktionsinstans slipper läsa om shards + gzippa när updatedAt är
// oförändrad (t.ex. CDN-missar från olika kant-noder samma timme).
const memo = new Map<string, { updatedAt: string; gz: Uint8Array }>();

// Diskcache i temp-mappen (nycklad på updatedAt i filnamnet): framför allt för
// DEV, där varje omstart/hot reload nollar memo:t och annars tvingar fram en
// full shard-omläsning + gzip (~10–20 s). Hjälper också omstartade prod-
// instanser under samma dygn. Misslyckade läs/skriv ignoreras — cachen är
// alltid bara en genväg, aldrig sanningskälla.
const diskPath = (layer: string, updatedAt: string) =>
    path.join(tmpdir(), `vadkul-events-${layer}-${encodeURIComponent(updatedAt)}.json.gz`);

async function readDiskCache(layer: string, updatedAt: string): Promise<Uint8Array | null> {
    try {
        return new Uint8Array(await readFile(diskPath(layer, updatedAt)));
    } catch {
        return null;
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ layer: string }> },
) {
    const { layer } = await params;
    if (!LAYERS.has(layer)) {
        return NextResponse.json({ error: 'Okänt lager' }, { status: 404 });
    }
    const db = getAdminDb();
    if (!db) {
        // Ingen cache på fel — klienten faller vidare till sina reservvägar.
        return NextResponse.json({ error: 'Firestore ej tillgänglig' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }

    try {
        const indexSnap = await db.collection('aggregatedEvents').doc(layer).get();
        if (!indexSnap.exists) {
            return NextResponse.json({ error: 'Lagret saknas' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
        }
        const indexData: any = indexSnap.data();
        const updatedAt: string = typeof indexData?.updatedAt === 'string' ? indexData.updatedAt : '';
        const etag = `"${layer}:${updatedAt}"`;

        // Oförändrat sedan klienten/CDN:en senast såg det → 304 utan kropp.
        if (updatedAt && request.headers.get('if-none-match') === etag) {
            return new NextResponse(null, { status: 304, headers: { ...CACHE_HEADERS, ETag: etag } });
        }

        let entry = updatedAt ? memo.get(layer) : undefined;
        if (entry && entry.updatedAt !== updatedAt) entry = undefined;

        // Kall process men samma data som sist → hämta färdig-gzippat från disk
        // i stället för att läsa om alla shards (~26 MB) och gzippa igen.
        if (!entry && updatedAt) {
            const gz = await readDiskCache(layer, updatedAt);
            if (gz) {
                entry = { updatedAt, gz };
                memo.set(layer, entry);
            }
        }

        if (!entry) {
            // Samma sammanslagning som klienten gjorde: index-doc med shardCount
            // → läs och slå ihop alla shards; annars ligger allt i index-docen.
            let body: any = indexData;
            const shardCount: number = typeof indexData?.shardCount === 'number' ? indexData.shardCount : 0;
            if (shardCount > 0) {
                const refs = Array.from({ length: shardCount }, (_, i) =>
                    db.collection('aggregatedEvents').doc(`${layer}_${i}`));
                const snaps = await db.getAll(...refs);
                if (layer === 'descriptions') {
                    const data: Record<string, string> = {};
                    for (const s of snaps) if (s.exists) Object.assign(data, (s.data() as any)?.data || {});
                    body = { updatedAt, data };
                } else {
                    const events: any[] = [];
                    for (const s of snaps) if (s.exists) events.push(...(((s.data() as any)?.events) || []));
                    body = { updatedAt, events };
                }
            }
            // gzip här i stället för att lita på att CDN:en komprimerar
            // funktions-svar — garanterat ~5:1 färre fakturerade byte.
            const gz = new Uint8Array(gzipSync(new TextEncoder().encode(JSON.stringify(body))));
            entry = { updatedAt, gz };
            if (updatedAt) {
                memo.set(layer, entry);
                writeFile(diskPath(layer, updatedAt), gz).catch(() => { /* cache är bara en genväg */ });
            }
        }

        const wantsGzip = (request.headers.get('accept-encoding') || '').includes('gzip');
        const payload = wantsGzip ? entry.gz : new Uint8Array(gunzipSync(entry.gz));
        // TS DOM-lib räknar inte Uint8Array<ArrayBufferLike> som BodyInit — casten är ofarlig.
        return new NextResponse(payload as unknown as BodyInit, {
            status: 200,
            headers: {
                ...CACHE_HEADERS,
                'Content-Type': 'application/json; charset=utf-8',
                ...(updatedAt ? { ETag: etag } : {}),
                ...(wantsGzip ? { 'Content-Encoding': 'gzip' } : {}),
            },
        });
    } catch (e) {
        console.error(`[api/events/${layer}]`, e);
        return NextResponse.json({ error: 'Läsfel' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
