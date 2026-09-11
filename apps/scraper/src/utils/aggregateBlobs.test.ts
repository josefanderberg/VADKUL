import { describe, it, expect } from 'vitest';
import { brotliDecompressSync, gunzipSync } from 'zlib';
import { packEncodings, chunkBuffer, uploadPrepackedBlobs, BLOB_SHARD_BYTES } from './aggregateBlobs';

describe('packEncodings', () => {
    it('båda kodningarna packar upp till exakt originalet', () => {
        const raw = Buffer.from(JSON.stringify({ events: Array.from({ length: 500 }, (_, i) => ({ id: `https://example.se/e/${i}`, title: `Event ${i}` })) }));
        const enc = packEncodings(raw);
        expect(brotliDecompressSync(enc.br).equals(raw)).toBe(true);
        expect(gunzipSync(enc.gzip).equals(raw)).toBe(true);
        // q11 ska slå gzip på JSON-payloads — annars är parametrarna fel.
        expect(enc.br.length).toBeLessThan(enc.gzip.length);
    });
});

describe('chunkBuffer', () => {
    it('shards + concat är identitet, ingen del över taket', () => {
        const buf = Buffer.from(Array.from({ length: 2_000_001 }, (_, i) => i % 251));
        const parts = chunkBuffer(buf, BLOB_SHARD_BYTES);
        expect(parts.length).toBe(3);
        for (const p of parts) expect(p.length).toBeLessThanOrEqual(BLOB_SHARD_BYTES);
        expect(Buffer.concat(parts).equals(buf)).toBe(true);
    });

    it('exakt jämn delning ger ingen tom svans-shard', () => {
        expect(chunkBuffer(Buffer.alloc(1400), 700).length).toBe(2);
    });
});

/** Fake-db som loggar skrivordning — samma mönster som aggregate-shards.test.ts. */
function orderedFakeDb(existingIds: string[]) {
    const writes: string[] = [];
    const deleted: string[] = [];
    const db: any = {
        collection: () => ({
            doc: (id: string) => ({ set: async (payload: any) => { writes.push(id); (writes as any)[id] = payload; } }),
            listDocuments: async () => existingIds.map(id => ({ id, delete: async () => { deleted.push(id); } })),
        }),
    };
    return { db, writes, deleted };
}

describe('uploadPrepackedBlobs', () => {
    it('skriver alla shards FÖRE indexet och städar överblivna shards', async () => {
        const f = orderedFakeDb(['blob_cards_br_0', 'blob_cards_br_7', 'blob_cards_gzip_9', 'cards_0', 'blob_destinations_br_5']);
        await uploadPrepackedBlobs(f.db, 'cards', '2026-09-11T00:00:00Z', Buffer.from('{"events":[]}'));
        // Index sist.
        expect(f.writes[f.writes.length - 1]).toBe('blob_cards');
        expect(f.writes.slice(0, -1).every(id => /^blob_cards_(br|gzip)_\d+$/.test(id))).toBe(true);
        // Bara det egna lagrets överblivna shards städas — aldrig JSON-shards
        // eller andra lagers blobbar.
        expect(f.deleted.sort()).toEqual(['blob_cards_br_7', 'blob_cards_gzip_9']);
    });
});
