/**
 * Kostnadsskydd: aggregatedEvents får listas EN gång per aggregatkörning.
 * ListDocuments debiteras ett read per dokument (~240 st), och en listning per
 * städsteg (~25 per körning, var ~22:a minut) var ~430 000 reads/dygn (14/10).
 */
import { describe, it, expect } from 'vitest';
import { AggregatedDocIds } from './aggregatedDocIds';
import { uploadPrepackedBlobs } from './aggregateBlobs';
import { deleteShards, uploadShardedLayer } from '../scripts/aggregate-events';

function fakeCol(ids: string[], opts: { failFirst?: boolean } = {}) {
    const deleted: string[] = [];
    let listCalls = 0;
    const col = {
        doc: (id: string) => ({ set: async () => { /* skrivning */ } }),
        listDocuments: async () => {
            listCalls++;
            if (opts.failFirst && listCalls === 1) throw new Error('DEADLINE_EXCEEDED');
            return ids.map((id) => ({ id, delete: async () => { deleted.push(id); } }));
        },
    };
    const db: any = { collection: () => col };
    return { col, db, deleted, listCalls: () => listCalls };
}

describe('AggregatedDocIds', () => {
    it('listar en gång oavsett hur många städsteg som körs', async () => {
        const f = fakeCol(['cards_0', 'cards_1', 'descriptions_0', 'descriptions_3']);
        const ids = new AggregatedDocIds(f.col);
        await ids.deleteNumbered('cards_', 1);
        await ids.deleteNumbered('descriptions_', 1);
        await ids.deleteNumbered('destinations_');
        expect(f.listCalls()).toBe(1);
        expect(f.deleted).toEqual(['cards_1', 'descriptions_3']);
    });

    it('raderar inte samma dokument två gånger', async () => {
        const f = fakeCol(['cards_0', 'cards_1']);
        const ids = new AggregatedDocIds(f.col);
        await ids.deleteNumbered('cards_');
        await ids.deleteNumbered('cards_');
        expect(f.deleted).toEqual(['cards_0', 'cards_1']);
    });

    it('rör aldrig basdokumentet eller längre namn med samma början', async () => {
        const f = fakeCol(['cards', 'cards_0', 'cards_x', 'blob_cards_br_0', 'cards_0_old']);
        await new AggregatedDocIds(f.col).deleteNumbered('cards_');
        expect(f.deleted).toEqual(['cards_0']);
    });

    it('prefix med regex-tecken matchas bokstavligt (app-regionernas lagernamn)', async () => {
        const f = fakeCol(['blob_app-skane_br_0', 'blob_app-skane_br_2', 'blob_appXskane_br_5']);
        await new AggregatedDocIds(f.col).deleteNumbered('blob_app-skane_br_', 1);
        expect(f.deleted).toEqual(['blob_app-skane_br_2']);
    });

    it('en misslyckad listning fastnar inte: nästa steg listar om', async () => {
        const f = fakeCol(['cards_0'], { failFirst: true });
        const ids = new AggregatedDocIds(f.col);
        await expect(ids.deleteNumbered('cards_')).rejects.toThrow('DEADLINE_EXCEEDED');
        await ids.deleteNumbered('cards_');
        expect(f.listCalls()).toBe(2);
        expect(f.deleted).toEqual(['cards_0']);
    });
});

describe('runAggregations städsteg med delad listning', () => {
    it('blobbar för tre lager + app-region + shardade lager = EN listning', async () => {
        const f = fakeCol([
            'blob_destinations_br_4', 'blob_cards_gzip_9', 'blob_app-skane_br_3',
            'cards_0', 'cards_5', 'descriptions_0', 'destinations_2',
        ]);
        const ids = new AggregatedDocIds(f.col);
        const raw = Buffer.from('{"events":[]}');
        for (const layer of ['destinations', 'cards', 'descriptions', 'app-skane']) {
            await uploadPrepackedBlobs(f.db, layer, '2026-10-14T00:00:00Z', raw, ids);
        }
        await deleteShards(f.db, 'destinations_', 0, ids);
        await uploadShardedLayer(f.db, 'cards', { shardCount: 1 }, [{ shardIndex: 0 }], ids);
        await deleteShards(f.db, 'descriptions_', 0, ids);

        expect(f.listCalls()).toBe(1);
        expect(f.deleted.sort()).toEqual([
            'blob_app-skane_br_3', 'blob_cards_gzip_9', 'blob_destinations_br_4',
            'cards_5', 'descriptions_0', 'destinations_2',
        ]);
    });

    it('utan delad listning beter sig fristående anrop som förut (en listning per anrop)', async () => {
        const f = fakeCol(['cards_0', 'cards_1']);
        await deleteShards(f.db, 'cards_', 1);
        await deleteShards(f.db, 'cards_', 1);
        expect(f.listCalls()).toBe(2);
        expect(f.deleted).toEqual(['cards_1', 'cards_1']);
    });
});
