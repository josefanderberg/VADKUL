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
    const addedDocs: any[] = [];
    const state = {
        autoId: 0,
        queryCount: 0,                                   // antal where-queries mot Firestore
        queryResult: { empty: true, docs: [] as any[] }, // svar på nästa query
    };
    const fakeDb = {
        batch: () => {
            const ops: any[] = [];
            return {
                set: (ref: any, data: any) => ops.push({ id: ref.id, data }),
                commit: async () => { committedBatches.push(ops); },
            };
        },
        collection: () => ({
            doc: () => ({ id: `auto-${++state.autoId}` }),
            where: () => ({
                limit: () => ({
                    get: async () => { state.queryCount++; return state.queryResult; },
                }),
            }),
            add: async (data: any) => {
                addedDocs.push(data);
                return { id: `added-${++state.autoId}` };
            },
        }),
    };
    return { committedBatches, upsertCalls, addedDocs, state, fakeDb };
});

vi.mock('../config/firebase', () => ({ db: h.fakeDb }));
vi.mock('./sqliteHelper', () => ({
    upsertEvent: vi.fn((e: any) => h.upsertCalls.push(e)),
    sqliteEventExists: vi.fn(() => false),
    getSqliteEvent: vi.fn(() => null),
    getSqlitePath: vi.fn(() => ':memory:'),
    setEventTime: vi.fn(),
}));

import { addEventsBatch, addEventToDb, getEventFromDb, eventExistsInDb, chunkArray } from './dbHelper';
import { getSqliteEvent, sqliteEventExists } from './sqliteHelper';

const mockedGetSqliteEvent = vi.mocked(getSqliteEvent);
const mockedSqliteEventExists = vi.mocked(sqliteEventExists);

const committedBatches = h.committedBatches;
const upsertCalls = h.upsertCalls;

beforeEach(() => {
    committedBatches.length = 0;
    upsertCalls.length = 0;
    h.addedDocs.length = 0;
    h.state.autoId = 0;
    h.state.queryCount = 0;
    h.state.queryResult = { empty: true, docs: [] };
    vi.clearAllMocks();
    // Explicita defaults — mockReturnValue i ett test får inte läcka till nästa.
    mockedGetSqliteEvent.mockReturnValue(null);
    mockedSqliteEventExists.mockReturnValue(false);
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

    it('batch-skrivna dokument får updatedAt-stämpel (krav för inkrementell sync)', async () => {
        await addEventsBatch([ev('stamp')]);
        expect(committedBatches[0][0].data.updatedAt).toBeInstanceOf(Date);
    });
});

describe('addEventToDb — dubblettkoll mot SQLite-spegeln', () => {
    const ev = { title: 'E', url: 'https://t.se/known', time: new Date('2026-07-01T19:00:00'), hasSpecificTime: true };

    it('rad med firestoreId i spegeln → INGEN Firestore-query, ingen add', async () => {
        mockedGetSqliteEvent.mockReturnValue({ url: ev.url, firestoreId: 'fs-123' });
        await addEventToDb({ ...ev });
        expect(h.state.queryCount).toBe(0);
        expect(h.addedDocs).toHaveLength(0);
        expect(upsertCalls).toHaveLength(1);   // lokala spegeln uppdateras ändå
    });

    it('rad utan firestoreId + doc finns i Firestore → query + id-backfill, ingen add', async () => {
        mockedGetSqliteEvent.mockReturnValue({ url: ev.url, firestoreId: null });
        h.state.queryResult = { empty: false, docs: [{ id: 'fs-found' }] as any[] };
        await addEventToDb({ ...ev });
        expect(h.state.queryCount).toBe(1);
        expect(h.addedDocs).toHaveLength(0);
        expect(upsertCalls[upsertCalls.length - 1].firestoreId).toBe('fs-found');
    });

    it('okänd URL → query + add med updatedAt-stämpel', async () => {
        await addEventToDb({ ...ev, url: 'https://t.se/new' });
        expect(h.state.queryCount).toBe(1);
        expect(h.addedDocs).toHaveLength(1);
        expect(h.addedDocs[0].updatedAt).toBeInstanceOf(Date);
        expect(upsertCalls[upsertCalls.length - 1].firestoreId).toMatch(/^added-/);
    });
});

describe('getEventFromDb — SQLite-spegeln först', () => {
    it('träff i spegeln → ingen Firestore-query', async () => {
        const row = { url: 'https://t.se/x', title: 'Lokal', firestoreId: 'fs-1' };
        mockedGetSqliteEvent.mockReturnValue(row);
        expect(await getEventFromDb('https://t.se/x')).toBe(row);
        expect(h.state.queryCount).toBe(0);
    });

    it('miss i spegeln → Firestore-fallback', async () => {
        h.state.queryResult = { empty: false, docs: [{ id: 'fs-2', data: () => ({ title: 'Fjärr' }) }] as any[] };
        const got = await getEventFromDb('https://t.se/y');
        expect(got.title).toBe('Fjärr');
        expect(h.state.queryCount).toBe(1);
    });

    it('miss överallt → null', async () => {
        expect(await getEventFromDb('https://t.se/z')).toBeNull();
        expect(h.state.queryCount).toBe(1);
    });
});

describe('eventExistsInDb', () => {
    it('träff i spegeln → ingen Firestore-query', async () => {
        mockedSqliteEventExists.mockReturnValue(true);
        expect(await eventExistsInDb('https://t.se/finns')).toBe(true);
        expect(h.state.queryCount).toBe(0);
    });

    it('miss i spegeln → Firestore-fallback', async () => {
        expect(await eventExistsInDb('https://t.se/saknas')).toBe(false);
        expect(h.state.queryCount).toBe(1);
    });
});
