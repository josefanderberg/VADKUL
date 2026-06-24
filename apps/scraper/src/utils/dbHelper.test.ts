/**
 * dbHelper.addEventsBatch — batchad Firestore-skrivning.
 *
 * Firestore mockas helt (en fejk-db som fångar batch.set/commit) så testet
 * ALDRIG rör riktiga Firestore. SQLite-upsert mockas och inspekteras.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock hissas till toppen — delade fångster måste skapas via vi.hoisted.
const h = vi.hoisted(() => {
    const committedBatches: any[][] = [];
    const upsertCalls: any[] = [];
    const state = { autoId: 0 };
    const fakeDb = {
        batch: () => {
            const ops: any[] = [];
            return {
                set: (ref: any, data: any) => ops.push({ id: ref.id, data }),
                commit: async () => { committedBatches.push(ops); },
            };
        },
        collection: () => ({ doc: () => ({ id: `auto-${++state.autoId}` }) }),
    };
    return { committedBatches, upsertCalls, state, fakeDb };
});

vi.mock('../config/firebase', () => ({ db: h.fakeDb }));
vi.mock('./sqliteHelper', () => ({
    upsertEvent: vi.fn((e: any) => h.upsertCalls.push(e)),
    sqliteEventExists: vi.fn(() => false),
    getSqliteEvent: vi.fn(() => null),
    getSqlitePath: vi.fn(() => ':memory:'),
    setEventTime: vi.fn(),
}));

import { addEventsBatch, chunkArray } from './dbHelper';

const committedBatches = h.committedBatches;
const upsertCalls = h.upsertCalls;

beforeEach(() => {
    committedBatches.length = 0;
    upsertCalls.length = 0;
    h.state.autoId = 0;
    vi.clearAllMocks();
});

describe('chunkArray', () => {
    it('delar i bitar om size', () => {
        expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });
    it('tom array → tom', () => {
        expect(chunkArray([], 10)).toEqual([]);
    });
    it('size större än längd → en bit', () => {
        expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
    });
});

describe('addEventsBatch', () => {
    const ev = (url: string, extra: any = {}) => ({
        title: `E ${url}`, url, time: new Date('2026-07-01T19:00:00'), hasSpecificTime: true, ...extra,
    });

    it('skriver alla event till SQLite + en Firestore-batch', async () => {
        const r = await addEventsBatch([ev('a'), ev('b'), ev('c')]);
        expect(r.written).toBe(3);
        expect(r.errors).toEqual([]);
        expect(committedBatches).toHaveLength(1);           // en commit
        expect(committedBatches[0]).toHaveLength(3);
        // SQLite: 3 initiala upserts + 3 firestoreId-backfills
        const withId = upsertCalls.filter((e) => e.firestoreId);
        expect(withId).toHaveLength(3);
        expect(withId[0].firestoreId).toMatch(/^auto-/);
    });

    it('dedupar på url inom batchen (sista vinner)', async () => {
        const r = await addEventsBatch([ev('dup', { title: 'första' }), ev('dup', { title: 'andra' })]);
        expect(r.written).toBe(1);
        expect(committedBatches[0]).toHaveLength(1);
        expect(committedBatches[0][0].data.title).toBe('andra');
    });

    it('chunkar > 450 event i flera commits', async () => {
        const many = Array.from({ length: 1000 }, (_, i) => ev(`e${i}`));
        const r = await addEventsBatch(many);
        expect(r.written).toBe(1000);
        expect(committedBatches).toHaveLength(3);           // 450 + 450 + 100
        expect(committedBatches.map((b) => b.length)).toEqual([450, 450, 100]);
    });

    it('tom array → ingen Firestore-trafik', async () => {
        const r = await addEventsBatch([]);
        expect(r.written).toBe(0);
        expect(committedBatches).toHaveLength(0);
    });
});
