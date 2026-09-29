import { describe, it, expect } from 'vitest';
import { detectRunProblems, detectDayClusters, detectNullIsland, quarantineAlerts, sortAlerts, RunRow } from './scraperAlerts';

const run = (day: string, found: number, over: Partial<RunRow> = {}): RunRow =>
    ({ source_id: 'x', started_at: `2026-09-${day}T01:00:00Z`, found, skipped_duplicate: 0, error_count: 0, ...over });

describe('detectRunProblems', () => {
    it('tyst: 3 tomma körningar efter en med event (Karlsborg/Spritmuseum-fallet)', () => {
        const a = detectRunProblems(new Map([['spritmuseum', [run('28', 0), run('25', 0), run('22', 0), run('19', 6)]]]), new Set());
        expect(a).toHaveLength(1);
        expect(a[0]).toMatchObject({ kind: 'tyst', source: 'spritmuseum', since: '2026-09-22' });
    });

    it('dubbletter = levande källa, inte tyst', () => {
        const runs = [run('28', 0, { skipped_duplicate: 14 }), run('25', 0), run('22', 0), run('19', 6)];
        expect(detectRunProblems(new Map([['x', runs]]), new Set())).toEqual([]);
    });

    it('aldrig gett något → inget larm (ny/experimentell källa)', () => {
        expect(detectRunProblems(new Map([['x', [run('28', 0), run('25', 0), run('22', 0), run('19', 0)]]]), new Set())).toEqual([]);
    });

    it('krasch: senaste körningen 0 event + fel', () => {
        const a = detectRunProblems(new Map([['hockey', [run('28', 0, { error_count: 1, first_error: 'Unexpected token <' })]]]), new Set());
        expect(a[0]).toMatchObject({ level: 'fel', kind: 'krasch' });
        expect(a[0].message).toContain('Unexpected token');
    });

    it('karantänsatta/avstängda hoppas', () => {
        const runs = [run('28', 0), run('25', 0), run('22', 0), run('19', 6)];
        expect(detectRunProblems(new Map([['x', runs]]), new Set(['x']))).toEqual([]);
    });
});

describe('detectDayClusters', () => {
    it('Malmö Live-fallet: 64 av 87 samma dag', () => {
        const rows = [
            ...Array.from({ length: 64 }, () => ({ host: 'Malmö Live', day: '2026-10-03' })),
            ...Array.from({ length: 23 }, (_, i) => ({ host: 'Malmö Live', day: `2026-10-${String(10 + (i % 15)).padStart(2, '0')}` })),
        ];
        const a = detectDayClusters(rows);
        expect(a).toHaveLength(1);
        expect(a[0].message).toContain('64 av 87');
    });

    it('utspritt eller för få event → inget larm', () => {
        const spread = Array.from({ length: 20 }, (_, i) => ({ host: 'A', day: `2026-10-${String(1 + i).padStart(2, '0')}` }));
        const few = Array.from({ length: 5 }, () => ({ host: 'B', day: '2026-10-03' }));
        expect(detectDayClusters([...spread, ...few])).toEqual([]);
    });
});

describe('detectNullIsland', () => {
    it('EN samlad rad med de värsta värdarna', () => {
        const hosts = [...Array(12).fill('NBV'), ...Array(3).fill('Liten')];
        const r = detectNullIsland(hosts);
        expect(r.total).toBe(15);
        expect(r.alerts).toHaveLength(1);
        expect(r.alerts[0].message).toContain('NBV 12, Liten 3');
    });

    it('under tröskeln → inget larm', () => {
        expect(detectNullIsland(['A', 'B']).alerts).toEqual([]);
    });
});

describe('quarantineAlerts + sortAlerts', () => {
    it('fel före varningar, tyst före karantän', () => {
        const q = quarantineAlerts({ karlskoga: { since: '2026-09-28', reason: '4 raka tomma körningar' } });
        const sorted = sortAlerts([
            ...q,
            { level: 'varning', kind: 'tyst', source: 'b', message: '' },
            { level: 'fel', kind: 'krasch', source: 'c', message: '' },
        ]);
        expect(sorted.map((a) => a.kind)).toEqual(['krasch', 'tyst', 'karantan']);
        expect(q[0].message).toContain('sedan 2026-09-28');
    });
});
