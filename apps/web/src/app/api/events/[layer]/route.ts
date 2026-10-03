import { NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { gzipSync, gunzipSync, brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'zlib';
import { readFile, writeFile, rename, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { getAdminDb } from '@/lib/firestore-admin';
import { applyVenueFixInPlace } from '@/data/venueFixes';
import { CITIES } from '@/lib/cityUtils';
import { buildCardIndex } from '@/utils/eventKey';
import { parseTileKey, parseDescBucket } from '@/utils/eventTiles';
import { sliceDestinations, sliceCards, buildDescBuckets, type SliceSpec } from '@/lib/eventLayerSlices';
import { countPerDay } from '@/utils/dayCounts';

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

/**
 * APP-FLÖDETS lager (plattformsplanen fas 1): app-<region> för varje län i
 * CITIES — slimmade per-region-payloader som appen hämtar i stället för hela
 * destinations. BLOB-ONLY: scrapern laddar upp förpackade blobbar nattligen
 * (utils/appFeed i scrapern); indexdokumentet bär bara metadata, så det finns
 * ingen JSON-byggväg — saknas blobben svarar vi 503 och nästa natt läker.
 */
const APP_LAYERS = new Set(CITIES.map(c => `app-${c.region}`));

const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    Vary: 'Accept-Encoding',
} as const;

/**
 * Kodningar vi håller färdigpackade. Brotli är ~37 % mindre än gzip på de här
 * payloaderna (destinations: 2,01 MB gzip → 1,26 MB br) och alla webbläsare
 * som når kartan stödjer det; gzip finns kvar som fallback för allt annat.
 *
 * Kvalitet 6, inte 11: uppmätt på destinations-lagret ger q=6 37 % på 342 ms
 * medan q=11 ger 47 % på 29 SEKUNDER. Packningen sker visserligen bara en gång
 * per datauppdatering och instans (memo + diskcache nedan), men en kall instans
 * som råkar bli den som packar får inte hänga en halv minut på en besökare.
 */
type Enc = 'br' | 'gzip';
const BROTLI_QUALITY = 6;

function packBoth(raw: Uint8Array): Record<Enc, Uint8Array> {
    return {
        gzip: new Uint8Array(gzipSync(raw)),
        br: new Uint8Array(brotliCompressSync(raw, {
            params: {
                [zlibConstants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
                [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
            },
        })),
    };
}

/** Bäst kodning klienten accepterar. Okänd/utelämnad header → okomprimerat. */
function negotiate(request: Request): Enc | null {
    const ae = (request.headers.get('accept-encoding') || '').toLowerCase();
    if (ae.includes('br')) return 'br';
    if (ae.includes('gzip')) return 'gzip';
    return null;
}

// Varm funktionsinstans slipper läsa om shards + packa om när updatedAt är
// oförändrad (t.ex. CDN-missar från olika kant-noder samma timme).
const memo = new Map<string, { updatedAt: string; enc: Record<Enc, Uint8Array> }>();

// ── Slices: tidsfönster, ruta och beskrivningshink ──────────────────────────
// Snabbstartsväg för kartan: dagens ~1 400 event är ~90 % mindre än hela lagret
// (22 000+ event, ~1,6 MB gzippad) → första markörerna kan ritas på en bråkdel
// av tiden. CDN:en cachar per URL inkl. query, och alla besökare i samma
// tidszon bygger IDENTISKA from/to-strängar (lokal midnatt→midnatt som UTC-ISO)
// → en cache-post per dag, inte per besökare.
//
// ?tile=<lat>_<lng> (destinations + cards, utils/eventTiles): bara eventen i en
// FAST geografisk ruta (~55 × 55 km) — kartan hämtar rutorna runt vyn i
// stället för hela landet (Stockholms 14-dagarsfönster ~0,11 MB mot landets
// ~1,2 MB). Kombineras fritt med from/to. Kort-slicen följer destinations-
// raderna i samma ruta/fönster (korten bär inga koordinater).
//
// ?bucket=<n> (descriptions): en av DESC_BUCKETS hinkar på id:ts hash — ett
// öppnat eventkort behöver EN beskrivning, inte hela lagret (~2 MB brotli).
//
// ?counts=day (destinations): antal event per svensk dag för HELA landet
// (~1 kB) — välkomstrutans landssiffror, som kartan inte längre kan räkna
// själv när den bara laddat rutorna runt sig.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
// Vakt: rymmer dagsslicen OCH 14-dagarsfönstret (utils/timelineWindow) med
// marginal — men inget godtyckligt spann; kvantiserade nycklar är CDN-skyddet.
const SLICE_MAX_SPAN_MS = 16 * 24 * 60 * 60 * 1000;

// Färdigpackade slices per (updatedAt|lager|slice). Taket rymmer en varm
// instans rutor (~100 med event i landet) + hinkar; äldsta åker ut först.
// Rutorna är små (Stockholms fönster ~0,3 MB för båda kodningarna, de flesta
// några kB), så taket kostar högst tiotals MB.
const sliceMemo = new Map<string, Record<Enc, Uint8Array>>();
const SLICE_MEMO_MAX = 400;

function memoSlice(key: string, enc: Record<Enc, Uint8Array>) {
    // Äldsta posten ut när taket nås (Map itererar i insättningsordning).
    if (sliceMemo.size >= SLICE_MEMO_MAX) {
        const oldest = sliceMemo.keys().next().value;
        if (oldest !== undefined) sliceMemo.delete(oldest);
    }
    sliceMemo.set(key, enc);
}

// Parsad events-array för HELA destinations-lagret (för att slippa gunzip+parse
// av ~8 MB per slice-miss). Nycklad på updatedAt — en post räcker. Venue-
// fixarna tvingas här också (blob-vägen bär bara scraperns), så rut-
// tillhörigheten räknas på samma koordinater som kartan ritar.
let parsedDest: { updatedAt: string; events: any[] } | null = null;
// Kortlagrets uppslag (buildCardIndex) för kort-slicen, nycklat på updatedAt.
let parsedCards: { updatedAt: string; lookup: (destId: string) => unknown } | null = null;
// Beskrivningslagret uppdelat i hinkar, nycklat på updatedAt.
let parsedDescBuckets: { updatedAt: string; buckets: Record<string, string>[] } | null = null;

const parseEntry = (entry: { enc: Record<Enc, Uint8Array> }): any =>
    JSON.parse(new TextDecoder().decode(gunzipSync(entry.enc.gzip)));

function destEventsFor(entry: { updatedAt: string; enc: Record<Enc, Uint8Array> }): any[] {
    const { updatedAt } = entry;
    // !updatedAt = oversionerad data → parsa alltid om (ingen nyckel att lita på).
    if (!parsedDest || !updatedAt || parsedDest.updatedAt !== updatedAt) {
        const full = parseEntry(entry);
        const events = Array.isArray(full?.events) ? full.events : [];
        for (const e of events) applyVenueFixInPlace(e);
        parsedDest = { updatedAt, events };
    }
    return parsedDest.events;
}

function cardLookupFor(entry: { updatedAt: string; enc: Record<Enc, Uint8Array> }): (destId: string) => unknown {
    const { updatedAt } = entry;
    if (!parsedCards || !updatedAt || parsedCards.updatedAt !== updatedAt) {
        const full = parseEntry(entry);
        parsedCards = { updatedAt, lookup: buildCardIndex(Array.isArray(full?.events) ? full.events : []) };
    }
    return parsedCards.lookup;
}

function descBucketsFor(entry: { updatedAt: string; enc: Record<Enc, Uint8Array> }): Record<string, string>[] {
    const { updatedAt } = entry;
    if (!parsedDescBuckets || !updatedAt || parsedDescBuckets.updatedAt !== updatedAt) {
        const full = parseEntry(entry);
        parsedDescBuckets = { updatedAt, buckets: buildDescBuckets(full?.data && typeof full.data === 'object' ? full.data : {}) };
    }
    return parsedDescBuckets.buckets;
}

// Diskcache i temp-mappen (nycklad på updatedAt i filnamnet): framför allt för
// DEV, där varje omstart/hot reload nollar memo:t och annars tvingar fram en
// full shard-omläsning + gzip (~10–20 s). Hjälper också omstartade prod-
// instanser under samma dygn. Misslyckade läs/skriv ignoreras — cachen är
// alltid bara en genväg, aldrig sanningskälla.
const diskPath = (layer: string, updatedAt: string, enc: Enc) =>
    path.join(tmpdir(), `vadkul-events-${layer}-${encodeURIComponent(updatedAt)}.json.${enc}`);

/** Båda kodningarna måste finnas på disk — och gå att packa upp — för att
 *  träffen ska räknas. En avklippt fil (processen dog mitt i en skrivning
 *  före den atomiska skrivningen nedan) fick förut gunzip att kasta i
 *  slice-vägarna → 503 för kartan. */
async function readDiskCache(layer: string, updatedAt: string): Promise<Record<Enc, Uint8Array> | null> {
    try {
        const [gzip, br] = await Promise.all([
            readFile(diskPath(layer, updatedAt, 'gzip')),
            readFile(diskPath(layer, updatedAt, 'br')),
        ]);
        gunzipSync(gzip);
        brotliDecompressSync(br);
        return { gzip: new Uint8Array(gzip), br: new Uint8Array(br) };
    } catch {
        return null;
    }
}

/** Skriv cachefilerna ATOMISKT (tempfil + rename), så en läsare aldrig ser en
 *  halvskriven fil. Misslyckas något är cachen bara en genväg — tyst. */
async function writeDiskCache(layer: string, updatedAt: string, enc: Record<Enc, Uint8Array>): Promise<void> {
    for (const e of ['gzip', 'br'] as Enc[]) {
        const target = diskPath(layer, updatedAt, e);
        const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
        try {
            await writeFile(tmp, enc[e]);
            await rename(tmp, target);
        } catch {
            unlink(tmp).catch(() => { /* fanns inte */ });
        }
    }
}

/**
 * Färdigpackad blob från scrapern (utils/aggregateBlobs): brotli q11 + gzip 9,
 * packade en gång per natt i stället för q6 per kallstartande instans. −12 till
 * −16 % över tråden, och kallstarten läser ~5 MB bytes i stället för ~35 MB
 * JSON-shards + packning (~35 s → sekunder).
 *
 * Blobben används BARA när dess updatedAt är EXAKT lagrets — allt annat
 * (saknad blob, äldre aggregat, hotfix-aggregate-venue som stämplat nytt
 * updatedAt på JSON-lagret) → null och q6-vägen tar över. Trasig blob får
 * aldrig ge 503: varje avvikelse → null.
 *
 * OBS: venue-läsvakten (applyVenueFixInPlace i bygg-vägen nedan) kan inte
 * patcha färdigpackade bytes. Blobben bär scraperns venue-fixar från
 * aggregeringstillfället; en fix som bara hunnit deployas till webben når
 * blob-svaret först när minin pullat + aggregerat (≤1 dygn). Brådskande fix →
 * data-hotfix-workflown, som stämplar nytt updatedAt → blobben missmatchar
 * och bygg-vägen (med webbens färska fixar) tar över.
 */
async function readPrepackedBlobs(
    db: Firestore,
    layer: string,
    updatedAt: string,
): Promise<Record<Enc, Uint8Array> | null> {
    try {
        const idxSnap = await db.collection('aggregatedEvents').doc(`blob_${layer}`).get();
        const idx: any = idxSnap.exists ? idxSnap.data() : null;
        if (!idx || !updatedAt || idx.updatedAt !== updatedAt) return null;
        const out: Partial<Record<Enc, Uint8Array>> = {};
        for (const e of ['br', 'gzip'] as Enc[]) {
            const meta = idx.encodings?.[e];
            if (!meta || typeof meta.shardCount !== 'number' || meta.shardCount < 1) return null;
            const refs = Array.from({ length: meta.shardCount }, (_, i) =>
                db.collection('aggregatedEvents').doc(`blob_${layer}_${e}_${i}`));
            const snaps = await db.getAll(...refs);
            const parts: Buffer[] = [];
            for (const s of snaps) {
                const d: any = s.exists ? s.data() : null;
                // Shard från fel generation (städning mitt i läsningen) → hela
                // blobben underkänns hellre än att servera ihopklippt data.
                if (!d?.data || d.updatedAt !== updatedAt) return null;
                parts.push(Buffer.from(d.data));
            }
            const buf = Buffer.concat(parts);
            if (typeof meta.bytes === 'number' && buf.length !== meta.bytes) return null;
            out[e] = new Uint8Array(buf);
        }
        // Sista äkthetskontroll: gzip-blobben måste gå att packa upp — slice-
        // vägen gunzippar den, och ett korrupt svar där vore ett 503 för kartan.
        gunzipSync(out.gzip!);
        return out as Record<Enc, Uint8Array>;
    } catch {
        return null;
    }
}

type LayerEntry = { updatedAt: string; enc: Record<Enc, Uint8Array> };

/**
 * Hela lagret färdigpackat: memo → diskcache → scraperns blob → bygg ur
 * JSON-shards. null = app-lager utan blob (blob-only, se APP_LAYERS).
 */
async function loadLayerEntry(db: Firestore, layer: string, indexData: any, updatedAt: string): Promise<LayerEntry | null> {
    let entry = updatedAt ? memo.get(layer) : undefined;
    if (entry && entry.updatedAt !== updatedAt) entry = undefined;

    // Kall process men samma data som sist → hämta färdigpackat från disk
    // i stället för att läsa om alla shards (~26 MB) och packa igen.
    if (!entry && updatedAt) {
        const enc = await readDiskCache(layer, updatedAt);
        if (enc) {
            entry = { updatedAt, enc };
            memo.set(layer, entry);
        }
    }

    // Scraperns förpackade blob (q11) — bättre komprimerad än något vi
    // hinner packa här, och långt billigare än att bygga från JSON-shards.
    if (!entry && updatedAt) {
        const enc = await readPrepackedBlobs(db, layer, updatedAt);
        if (enc) {
            entry = { updatedAt, enc };
            memo.set(layer, entry);
            void writeDiskCache(layer, updatedAt, enc);
        }
    }

    // App-lagren är blob-only: indexdokumentet bär bara metadata (ingen
    // events-array), så bygg-vägen nedan hade serverat metadatat som
    // payload. Utan blob → null; anroparen svarar 503 utan cache.
    if (!entry && APP_LAYERS.has(layer)) return null;

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
        // LÄS-VAKT (Piteå 5/9): minins re-aggregat kan bära gamla
        // koordinater tills dess SQLite synkat — manuellt verifierade
        // venue-koordinater (data/venueFixes) tvingas därför även vid
        // UTLÄMNING, så kartan alltid får rätt punkt oavsett vad som
        // laddats upp. Bara destinations bär koordinater. Körs en gång
        // per datauppdatering och instans (packningen cachas).
        if (layer === 'destinations' && Array.isArray(body?.events)) {
            for (const e of body.events) applyVenueFixInPlace(e);
        }
        // Packa här i stället för att lita på att CDN:en komprimerar
        // funktions-svar — garanterat färre fakturerade byte.
        const enc = packBoth(new TextEncoder().encode(JSON.stringify(body)));
        entry = { updatedAt, enc };
        if (updatedAt) {
            memo.set(layer, entry);
            void writeDiskCache(layer, updatedAt, enc);
        }
    }
    return entry;
}

/** Index-doc för ett lager som slicen behöver UTÖVER det begärda (kort-slicen
 *  behöver destinations för koordinater och tider). Själva lagret laddas först
 *  efter 304-kollen — en oförändrad ruta ska inte kosta en lagerladdning. */
async function readAuxIndex(db: Firestore, layer: string): Promise<{ indexData: any; updatedAt: string } | null> {
    const snap = await db.collection('aggregatedEvents').doc(layer).get();
    if (!snap.exists) return null;
    const indexData: any = snap.data();
    return { indexData, updatedAt: typeof indexData?.updatedAt === 'string' ? indexData.updatedAt : '' };
}

const badRequest = (error: string) =>
    NextResponse.json({ error }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

export async function GET(
    request: Request,
    { params }: { params: Promise<{ layer: string }> },
) {
    const { layer } = await params;
    if (!LAYERS.has(layer) && !APP_LAYERS.has(layer)) {
        return NextResponse.json({ error: 'Okänt lager' }, { status: 404 });
    }
    // Tidsfönster-slice: destinations och cards, och bara när BÅDA gränserna
    // är giltig UTC-ISO och fönstret rimligt. Allt annat → hela lagret som förut.
    const url = new URL(request.url);
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const sliceable = layer === 'destinations' || layer === 'cards';
    let time: { from: number; to: number; key: string } | null = null;
    if (sliceable && fromStr && toStr && ISO_RE.test(fromStr) && ISO_RE.test(toStr)) {
        const from = Date.parse(fromStr);
        const to = Date.parse(toStr);
        if (Number.isFinite(from) && Number.isFinite(to) && to > from && to - from <= SLICE_MAX_SPAN_MS) {
            time = { from, to, key: `${fromStr}|${toStr}` };
        }
    }
    // Ruta/hink: en ogiltig nyckel är ett klientfel, inte "hela lagret" — ett
    // tyst helt lager vore 2 MB per påhittad URL förbi CDN-cachen.
    const tileStr = url.searchParams.get('tile');
    const tile = tileStr === null ? null : (sliceable && parseTileKey(tileStr) ? tileStr : undefined);
    if (tile === undefined) return badRequest('Ogiltig ruta');
    const bucketStr = url.searchParams.get('bucket');
    const bucket = bucketStr === null ? null : (layer === 'descriptions' ? parseDescBucket(bucketStr) : null);
    if (bucketStr !== null && bucket === null) return badRequest('Ogiltig hink');
    const countsStr = url.searchParams.get('counts');
    if (countsStr !== null && (layer !== 'destinations' || countsStr !== 'day' || time || tile)) return badRequest('Ogiltig räkning');
    const counts = countsStr !== null;
    // Kort-slicen utan ruta (bara tid) har ingen användare — och vore ett nytt
    // landsomfattande lager per dygn. Den finns bara tillsammans med en ruta.
    if (layer === 'cards' && time && !tile) time = null;
    const spec: SliceSpec | null = time || tile
        ? { ...(time ? { from: time.from, to: time.to } : {}), ...(tile ? { tile } : {}) }
        : null;
    const sliceKey = `${time ? time.key : ''}|${tile ?? ''}|${bucket ?? ''}|${counts ? 'cday' : ''}`;

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

        // Kort-slicen hänger på destinations (koordinater + tider): dess
        // version ingår i nyckeln, annars kunde en ruta svara 304 med gamla
        // kort efter att bara destinations byggts om.
        let destIndex: { indexData: any; updatedAt: string } | null = null;
        if (layer === 'cards' && spec) {
            destIndex = await readAuxIndex(db, 'destinations');
            if (!destIndex) {
                return NextResponse.json({ error: 'Lagret saknas' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
            }
        }
        const version = destIndex ? `${updatedAt}+${destIndex.updatedAt}` : updatedAt;
        const etag = `"${layer}:${version}${time ? `:${time.key}` : ''}${tile ? `:t${tile}` : ''}${bucket !== null ? `:b${bucket}` : ''}${counts ? ':cday' : ''}"`;

        // Oförändrat sedan klienten/CDN:en senast såg det → 304 utan kropp.
        if (updatedAt && request.headers.get('if-none-match') === etag) {
            return new NextResponse(null, { status: 304, headers: { ...CACHE_HEADERS, ETag: etag } });
        }

        const entry = await loadLayerEntry(db, layer, indexData, updatedAt);
        if (!entry) {
            return NextResponse.json(
                { error: 'App-flödet är inte byggt ännu' },
                { status: 503, headers: { 'Cache-Control': 'no-store' } },
            );
        }

        // Slice begärd → filtrera fram delmängden ur det fulla lagret och packa
        // separat. Memoiseras per (version|lager|slice); de parsade lagren
        // återanvänds mellan slices (en gunzip+parse per lager och version).
        let out = entry.enc;
        if (spec || bucket !== null || counts) {
            const memoKey = `${version}|${layer}|${sliceKey}`;
            // Utan updatedAt finns ingen versionsnyckel → memoisera inte (annars
            // kan en gammal slice överleva en datauppdatering).
            let sEnc = updatedAt ? sliceMemo.get(memoKey) : undefined;
            if (!sEnc) {
                let body: unknown;
                if (counts) {
                    body = { updatedAt, perDay: countPerDay(destEventsFor(entry)) };
                } else if (layer === 'descriptions') {
                    body = { updatedAt, data: descBucketsFor(entry)[bucket!] };
                } else if (layer === 'cards') {
                    const destEntry = await loadLayerEntry(db, 'destinations', destIndex!.indexData, destIndex!.updatedAt);
                    if (!destEntry) throw new Error('destinations saknas för kort-slicen');
                    body = { updatedAt, events: sliceCards(destEventsFor(destEntry), cardLookupFor(entry), spec!) };
                } else {
                    body = { updatedAt, events: sliceDestinations(destEventsFor(entry), spec!) };
                }
                sEnc = packBoth(new TextEncoder().encode(JSON.stringify(body)));
                if (updatedAt) memoSlice(memoKey, sEnc);
            }
            out = sEnc;
        }

        const enc = negotiate(request);
        const payload = enc ? out[enc] : new Uint8Array(gunzipSync(out.gzip));
        // TS DOM-lib räknar inte Uint8Array<ArrayBufferLike> som BodyInit — casten är ofarlig.
        return new NextResponse(payload as unknown as BodyInit, {
            status: 200,
            headers: {
                ...CACHE_HEADERS,
                'Content-Type': 'application/json; charset=utf-8',
                ...(updatedAt ? { ETag: etag } : {}),
                ...(enc ? { 'Content-Encoding': enc } : {}),
            },
        });
    } catch (e) {
        console.error(`[api/events/${layer}]`, e);
        return NextResponse.json({ error: 'Läsfel' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
