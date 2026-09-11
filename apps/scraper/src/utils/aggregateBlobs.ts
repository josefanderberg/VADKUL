/**
 * Förpackade aggregat-blobbar: brotli q11 + gzip 9, packade EN gång per natt
 * här i scrapern i stället för q6 per funktionsinstans i request-vägen.
 *
 * Varför: /api/events/[layer] packar q6 med motiveringen att q11 tar ~30 s —
 * sant i request-vägen, men aggregatet byggs en gång per körning på minin där
 * 30 s är gratis. Mätt 2026-09-11 på skarpa datat: destinations 1,96 → 1,66,
 * cards 1,19 → 1,04, descriptions 3,80 → 3,19 MB (−12 till −16 %). Bonus:
 * routens kallstart slipper läsa ~35 MB JSON-shards och packa om (~35 s) —
 * den läser färdiga bytes (~5 MB) och strömmar.
 *
 * Lagras i aggregatedEvents som blob_<layer> (index, skrivs SIST — samma
 * läsordningslärdom som uploadShardedLayer) + blob_<layer>_<enc>_<N>-shards
 * med Bytes-fält. Routen använder blobben BARA när dess updatedAt är exakt
 * lagrets — annars faller den tillbaka på gamla q6-vägen. Därför skrivs
 * blobbarna FÖRE JSON-lagren i aggregatorn. Vägar som patchar JSON-shards
 * utan omaggregering (hotfix-aggregate-venue) stämplar nytt updatedAt →
 * blobben missmatchar av sig själv och routen bygger q6 tills nästa aggregat.
 */
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'zlib';

/** Samma kodningsnamn som routens Enc. */
export type BlobEncoding = 'br' | 'gzip';

/** 700 KB — marginal mot Firestores 1 MiB-doc-tak inkl. fältoverhead. */
export const BLOB_SHARD_BYTES = 700_000;

/** Packar payloaden i bägge kodningarna routen serverar. q11/gz9 — se modulhuvudet. */
export function packEncodings(raw: Buffer): Record<BlobEncoding, Buffer> {
    return {
        br: brotliCompressSync(raw, {
            params: {
                [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
                [zlibConstants.BROTLI_PARAM_SIZE_HINT]: raw.length,
            },
        }),
        gzip: gzipSync(raw, { level: 9 }),
    };
}

/** Delar en buffert i shards om max `max` bytes (sista sharden kortare). */
export function chunkBuffer(buf: Buffer, max = BLOB_SHARD_BYTES): Buffer[] {
    const parts: Buffer[] = [];
    for (let i = 0; i < buf.length; i += max) parts.push(buf.subarray(i, i + max));
    return parts.length ? parts : [Buffer.alloc(0)];
}

/**
 * Ladda upp färdigpackade blobbar för ett lager. Skrivordning per lärdomen
 * 2026-08-31: alla shards FÖRST, indexet SIST, städning av överblivna shards
 * därefter — en läsare mitt i fönstret ska aldrig kunna se index utan shards.
 */
export async function uploadPrepackedBlobs(
    db: FirebaseFirestore.Firestore,
    layer: string,
    updatedAt: string,
    raw: Buffer,
): Promise<void> {
    const t0 = Date.now();
    const enc = packEncodings(raw);
    const col = db.collection('aggregatedEvents');

    const meta: Record<string, { shardCount: number; bytes: number }> = {};
    for (const e of ['br', 'gzip'] as BlobEncoding[]) {
        const shards = chunkBuffer(enc[e]);
        for (let i = 0; i < shards.length; i++) {
            await col.doc(`blob_${layer}_${e}_${i}`).set({ updatedAt, shardIndex: i, data: shards[i] });
        }
        meta[e] = { shardCount: shards.length, bytes: enc[e].length };
    }
    await col.doc(`blob_${layer}`).set({ updatedAt, encodings: meta });

    // Städa överblivna shards från en generation med fler delar. listDocuments()
    // — ALDRIG get(): bara namnen behövs (33,6 MB-läxan i deleteShards).
    const refs = await col.listDocuments();
    for (const ref of refs) {
        for (const e of ['br', 'gzip'] as BlobEncoding[]) {
            const m = ref.id.match(new RegExp(`^blob_${layer}_${e}_(\\d+)$`));
            if (m && parseInt(m[1], 10) >= meta[e].shardCount) await ref.delete();
        }
    }
    console.log(`      📦 Blob "${layer}": br ${(enc.br.length / 1e6).toFixed(2)} MB (${meta.br.shardCount} shards)`
        + ` + gzip ${(enc.gzip.length / 1e6).toFixed(2)} MB (${meta.gzip.shardCount} shards)`
        + ` på ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
