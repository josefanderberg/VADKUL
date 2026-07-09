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

// ── Tidsfönster-slice (?from=…&to=…, bara destinations) ─────────────────────
// Snabbstartsväg för kartan: dagens ~1 400 event är ~90 % mindre än hela lagret
// (22 000+ event, ~1,6 MB gzippad) → första markörerna kan ritas på en bråkdel
// av tiden. CDN:en cachar per URL inkl. query, och alla besökare i samma
// tidszon bygger IDENTISKA from/to-strängar (lokal midnatt→midnatt som UTC-ISO)
// → en cache-post per dag, inte per besökare.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const SLICE_MAX_SPAN_MS = 8 * 24 * 60 * 60 * 1000; // vakt: max 8 dygn per slice

// Färdig-gzippade slices per (updatedAt|from|to). Litet tak — i praktiken lever
// bara "idag" (+ ev. gårdag runt midnatt) här; äldsta åker ut först.
const sliceMemo = new Map<string, Uint8Array>();
const SLICE_MEMO_MAX = 8;

// Parsad events-array för HELA destinations-lagret (för att slippa gunzip+parse
// av ~8 MB per slice-miss). Nycklad på updatedAt — en post räcker.
let parsedDest: { updatedAt: string; events: any[] } | null = null;

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
    // Tidsfönster-slice: bara för destinations och bara när BÅDA gränserna är
    // giltig UTC-ISO och fönstret rimligt. Allt annat → hela lagret som förut.
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    let slice: { from: number; to: number; key: string } | null = null;
    if (layer === 'destinations' && fromStr && toStr && ISO_RE.test(fromStr) && ISO_RE.test(toStr)) {
        const from = Date.parse(fromStr);
        const to = Date.parse(toStr);
        if (Number.isFinite(from) && Number.isFinite(to) && to > from && to - from <= SLICE_MAX_SPAN_MS) {
            slice = { from, to, key: `${fromStr}|${toStr}` };
        }
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
        const etag = `"${layer}:${updatedAt}${slice ? `:${slice.key}` : ''}"`;

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

        // Slice begärd → filtrera fram tidsfönstret ur det fulla lagret och
        // gzippa separat. Memoiseras per (updatedAt|from|to); det fulla lagrets
        // parsade events-array återanvänds mellan slices (en gunzip+parse totalt).
        let outGz = entry.gz;
        if (slice) {
            const sliceKey = `${updatedAt}|${slice.key}`;
            // Utan updatedAt finns ingen versionsnyckel → memoisera inte (annars
            // kan en gammal slice överleva en datauppdatering).
            let sgz = updatedAt ? sliceMemo.get(sliceKey) : undefined;
            if (!sgz) {
                // !updatedAt = oversionerad data → parsa alltid om (ingen nyckel
                // att lita på för cache-träffen).
                if (!parsedDest || !updatedAt || parsedDest.updatedAt !== updatedAt) {
                    const full = JSON.parse(new TextDecoder().decode(gunzipSync(entry.gz)));
                    parsedDest = { updatedAt, events: Array.isArray(full?.events) ? full.events : [] };
                }
                const events = parsedDest.events.filter((e: any) => {
                    const t = Date.parse(e?.time);
                    return Number.isFinite(t) && t >= slice!.from && t <= slice!.to;
                });
                sgz = new Uint8Array(gzipSync(new TextEncoder().encode(JSON.stringify({ updatedAt, events }))));
                if (updatedAt) {
                    // Äldsta posten ut när taket nås (Map itererar i insättningsordning).
                    if (sliceMemo.size >= SLICE_MEMO_MAX) {
                        const oldest = sliceMemo.keys().next().value;
                        if (oldest !== undefined) sliceMemo.delete(oldest);
                    }
                    sliceMemo.set(sliceKey, sgz);
                }
            }
            outGz = sgz;
        }

        const wantsGzip = (request.headers.get('accept-encoding') || '').includes('gzip');
        const payload = wantsGzip ? outGz : new Uint8Array(gunzipSync(outGz));
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
