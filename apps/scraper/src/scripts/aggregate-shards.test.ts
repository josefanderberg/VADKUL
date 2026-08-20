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
import { deleteShards } from './aggregate-events';

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
