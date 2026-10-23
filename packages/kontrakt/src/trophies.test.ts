import { describe, expect, it } from 'vitest';
import { describeTrophy, planTrophyAwards, readTrophies } from './trophies';

describe('readTrophies', () => {
    it('läser giltiga poster i ordning', () => {
        expect(readTrophies([{ id: 'fortur-2026-2', type: 'fortur-2026', number: 2, of: 4 }]))
            .toEqual([{ id: 'fortur-2026-2', type: 'fortur-2026', number: 2, of: 4 }]);
    });
    it('tål saknat och trasigt fält', () => {
        expect(readTrophies(undefined)).toEqual([]);
        expect(readTrophies('🏆')).toEqual([]);
        expect(readTrophies([null, 3, { id: '' }])).toEqual([]);
    });
    it('hoppar över okänd typ, felaktiga nummer och dubbletter', () => {
        const ok = { id: 'fortur-2026-1', type: 'fortur-2026', number: 1, of: 4 };
        expect(readTrophies([
            { id: 'x', type: 'okand', number: 1, of: 1 },
            { id: 'y', type: 'fortur-2026', number: 5, of: 4 },
            { id: 'z', type: 'fortur-2026', number: 0, of: 4 },
            { id: 'w', type: 'fortur-2026', number: 1.5, of: 4 },
            ok,
            { ...ok },
        ])).toEqual([ok]);
    });
});

describe('describeTrophy', () => {
    it('ger profilraden och förklaringen med numret', () => {
        expect(describeTrophy({ id: 'fortur-2026-2', type: 'fortur-2026', number: 2, of: 4 })).toEqual({
            symbol: '✦',
            title: 'Förtur till appen',
            text: 'En av de 4 som bjöd in en vän innan appen släpptes. Nr 2 av 4.',
            line: '✦ Förtur till appen · nr 2 av 4',
        });
    });
});

describe('planTrophyAwards', () => {
    const tid = '2026-10-23T12:00:00.000Z';
    it('numrerar efter när de kvalade, alla med samma antal', () => {
        const plan = planTrophyAwards('fortur-2026', [
            { uid: 'b', qualifiedAt: 200 },
            { uid: 'a', qualifiedAt: 100 },
            { uid: 'c', qualifiedAt: 300 },
        ], tid);
        expect(plan.map(p => [p.id, p.doc.owner, p.doc.number, p.doc.of])).toEqual([
            ['fortur-2026-1', 'a', 1, 3],
            ['fortur-2026-2', 'b', 2, 3],
            ['fortur-2026-3', 'c', 3, 3],
        ]);
    });
    it('en trofé per person, den tidigaste kvalningen räknas', () => {
        const plan = planTrophyAwards('fortur-2026', [
            { uid: 'a', qualifiedAt: 500 },
            { uid: 'b', qualifiedAt: 200 },
            { uid: 'a', qualifiedAt: 100 },
        ], tid);
        expect(plan.map(p => p.doc.owner)).toEqual(['a', 'b']);
        expect(plan[0].doc.of).toBe(2);
    });
    it('lika tid avgörs av uid, så ordningen är stabil', () => {
        const plan = planTrophyAwards('fortur-2026', [{ uid: 'z', qualifiedAt: 1 }, { uid: 'm', qualifiedAt: 1 }], tid);
        expect(plan.map(p => p.doc.owner)).toEqual(['m', 'z']);
    });
    it('objektet har historik och spegeln samma id', () => {
        const [p] = planTrophyAwards('fortur-2026', [{ uid: 'a', qualifiedAt: 1 }], tid);
        expect(p.doc.history).toEqual([{ owner: 'a', since: tid }]);
        expect(p.mirror).toEqual({ id: 'fortur-2026-1', type: 'fortur-2026', number: 1, of: 1 });
        expect(readTrophies([p.mirror])).toEqual([p.mirror]);
    });
});
