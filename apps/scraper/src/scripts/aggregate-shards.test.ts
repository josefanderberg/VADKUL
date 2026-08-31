/**
 * Kostnadsskydd: shard-raderingen får ALDRIG läsa dokumentens innehåll.
 *
 * aggregatedEvents är 76 dokument à ~684 KB (33,6 MB). Tidigare hämtade
 * deleteShards() hela kollektionen med get() bara för att matcha ID:n mot
 * "<prefix><N>" — tre gånger per aggregatkörning, och aggregatet körs om varje
 * gång audit-daemonen betat av en batch. Det stod för 134 GiB egress i augusti
 * (144 kr, 76 % av Firebase-notan). listDocuments() hämtar bara namnen.
 */
import { describe, it, expect } from 'vitest';
import { deleteShards, uploadShardedLayer } from './aggregate-events';

function fakeDb(ids: string[]) {
    const deleted: string[] = [];
    let getCalls = 0, listCalls = 0;
    const db: any = {
        collection: () => ({
            get: async () => { getCalls++; return { docs: [] }; },
            listDocuments: async () => {
                listCalls++;
                return ids.map(id => ({ id, delete: async () => { deleted.push(id); } }));
            },
        }),
    };
    return { db, deleted, stats: () => ({ getCalls, listCalls }) };
}

const IDS = ['cards', 'cards_0', 'cards_1', 'cards_2', 'descriptions_0', 'descriptions_1', 'destinations_0'];

describe('deleteShards', () => {
    it('läser ALDRIG dokumentinnehåll — bara dokumentnamn', async () => {
        const f = fakeDb(IDS);
        await deleteShards(f.db, 'cards_');
        expect(f.stats().getCalls).toBe(0);   // en get() här = 33,6 MB egress
        expect(f.stats().listCalls).toBe(1);
    });

    it('raderar alla shards för prefixet och rör inte andra', async () => {
        const f = fakeDb(IDS);
        await deleteShards(f.db, 'cards_');
        expect(f.deleted).toEqual(['cards_0', 'cards_1', 'cards_2']);
    });

    it('keepBelow sparar de shards som fortfarande används', async () => {
        const f = fakeDb(IDS);
        await deleteShards(f.db, 'cards_', 2);   // cards_0 och cards_1 är i bruk
        expect(f.deleted).toEqual(['cards_2']);
    });

    it('rör inte basdokumentet utan suffix', async () => {
        const f = fakeDb(['cards', 'cards_0']);
        await deleteShards(f.db, 'cards_');
        expect(f.deleted).toEqual(['cards_0']);
    });
});

/**
 * Ordningsvakt: API-routen cachar på index-docens updatedAt, så indexet får
 * ALDRIG skrivas före shardsen — en läsare mitt i fönstret cachar annars
 * nytt index + gamla shards en hel aggregatgeneration (hände 2026-08-31).
 */
function orderedFakeDb(existingIds: string[]) {
    const ops: string[] = [];
    const db: any = {
        collection: () => ({
            doc: (id: string) => ({ set: async () => { ops.push(`set:${id}`); } }),
            listDocuments: async () =>
                existingIds.map(id => ({ id, delete: async () => { ops.push(`del:${id}`); } })),
        }),
    };
    return { db, ops };
}

describe('uploadShardedLayer', () => {
    it('skriver ALLA shards före index-dokumentet, städar sist', async () => {
        const f = orderedFakeDb(['cards', 'cards_0', 'cards_1', 'cards_2']);
        await uploadShardedLayer(f.db, 'cards', { shardCount: 2 }, [{ shardIndex: 0 }, { shardIndex: 1 }]);
        expect(f.ops).toEqual(['set:cards_0', 'set:cards_1', 'set:cards', 'del:cards_2']);
    });

    it('krympande shard-antal: gamla överskott raderas först EFTER att indexet pekar rätt', async () => {
        const f = orderedFakeDb(['descriptions_0', 'descriptions_1', 'descriptions_2']);
        await uploadShardedLayer(f.db, 'descriptions', { shardCount: 1 }, [{ shardIndex: 0 }]);
        const idxAt = f.ops.indexOf('set:descriptions');
        for (const op of f.ops.filter(o => o.startsWith('del:'))) {
            expect(f.ops.indexOf(op)).toBeGreaterThan(idxAt);
        }
        expect(f.ops.filter(o => o.startsWith('del:'))).toEqual(['del:descriptions_1', 'del:descriptions_2']);
    });
});
