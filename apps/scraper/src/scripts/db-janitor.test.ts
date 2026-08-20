/**
 * Regressionsskydd för kostnadsincidenten 2026-08-19: janitorns raderingsloop
 * körde om SAMMA query varje varv och litade på att träffmängden krympte när
 * raderingarna landade. Firestores query-index uppdateras asynkront, så samma
 * 1000 dokument kom tillbaka varv efter varv — 1 709 frågor à ~1000 dokument =
 * 1,7 M reads för 37 800 raderingar.
 *
 * Fejk-Firestoren nedan HÄRMAR det släpet: en sida utan markör ger alltid
 * första sidan igen, oavsett hur mycket som raderats. Klarar loopen det är den
 * markörsdriven; snurrar den läser den samma dokument om och om igen.
 */
import { describe, it, expect } from 'vitest';
import { cleanCollection } from './db-janitor';

const PAGE_SIZE = 1000;

function makeFakeFirestore(docCount: number) {
    const all = Array.from({ length: docCount }, (_, i) => ({
        id: `doc${i}`,
        ref: { id: `doc${i}` },
        get: (_f: string) => i,
    }));
    const stats = { docsRead: 0, pageQueries: 0, deletes: [] as string[], roundsWithoutCursor: 0 };

    const makeQuery = (cursorDoc: any | null) => ({
        orderBy: () => makeQuery(cursorDoc),
        select: () => makeQuery(cursorDoc),
        limit: () => makeQuery(cursorDoc),
        startAfter: (doc: any) => makeQuery(doc),
        count: () => ({ get: async () => ({ data: () => ({ count: docCount }) }) }),
        get: async () => {
            stats.pageQueries++;
            // Indexsläpet: utan markör serveras första sidan om och om igen.
            const from = cursorDoc ? all.findIndex(d => d.id === cursorDoc.id) + 1 : 0;
            if (!cursorDoc) stats.roundsWithoutCursor++;
            const docs = all.slice(from, from + PAGE_SIZE);
            stats.docsRead += docs.length;
            return { empty: docs.length === 0, size: docs.length, docs };
        },
    });

    const fdb: any = {
        collection: () => ({ where: () => makeQuery(null) }),
        bulkWriter: () => ({
            delete: (ref: any) => { stats.deletes.push(ref.id); },
            flush: async () => {},
            close: async () => {},
        }),
    };
    return { fdb, stats };
}

const RULE = { collection: 'eventReminders', field: 'eventTime' };
const CUTOFF: any = { toMillis: () => 0 };

describe('db-janitor cleanCollection', () => {
    it('läser varje dokument EXAKT en gång trots indexsläp', async () => {
        const { fdb, stats } = makeFakeFirestore(2500);
        const deleted = await cleanCollection(fdb, RULE, CUTOFF, false);

        expect(deleted).toBe(2500);
        expect(stats.docsRead).toBe(2500);              // inte 2500 × antal varv
        expect(stats.pageQueries).toBe(3);              // ceil(2500/1000)
        expect(stats.roundsWithoutCursor).toBe(1);      // bara allra första sidan
        expect(new Set(stats.deletes).size).toBe(2500); // inga dubbelraderingar
    });

    it('raderar exakt en jämn sidbredd utan extra varv', async () => {
        const { fdb, stats } = makeFakeFirestore(PAGE_SIZE);
        const deleted = await cleanCollection(fdb, RULE, CUTOFF, false);

        expect(deleted).toBe(PAGE_SIZE);
        // 2 frågor: en full sida + en tom som bekräftar att det är slut.
        expect(stats.pageQueries).toBe(2);
        expect(stats.docsRead).toBe(PAGE_SIZE);
    });

    it('--dry kostar en enda count-fråga och raderar ingenting', async () => {
        const { fdb, stats } = makeFakeFirestore(46920);
        const n = await cleanCollection(fdb, RULE, CUTOFF, true);

        expect(n).toBe(46920);
        expect(stats.pageQueries).toBe(0);
        expect(stats.deletes).toHaveLength(0);
    });

    it('tom träffmängd rör inte databasen', async () => {
        const { fdb, stats } = makeFakeFirestore(0);
        expect(await cleanCollection(fdb, RULE, CUTOFF, false)).toBe(0);
        expect(stats.pageQueries).toBe(0);
    });
});
