import { describe, it, expect } from 'vitest';
import { detectRunProblems, detectDayClusters, detectNullIsland, detectForeignCoords, quarantineAlerts, sortAlerts, RunRow } from './scraperAlerts';

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

describe('detectForeignCoords', () => {
    it('Mexiko-turen larmar, Norden och 0,0 gör det inte (billetto-fallet 18/10)', () => {
        const a = detectForeignCoords([
            { host: 'Billetto', lat: 19.36, lng: -99.16 },   // Mexico City
            { host: 'Billetto', lat: 42.52, lng: -70.88 },   // Salem, USA
            { host: 'Ticketmaster', lat: 55.67, lng: 12.56 }, // Köpenhamn — medveten källa
            { host: 'USF Verftet', lat: 60.4, lng: 5.31 },    // Bergen — inom Norden
            { host: 'NBV', lat: 0, lng: 0 },                  // null-ön har egen rad
            { host: 'Okänd', lat: null, lng: null },
        ]);
        expect(a).toHaveLength(1);
        expect(a[0]).toMatchObject({ kind: 'utlandskoordinat', level: 'varning', source: '2 event' });
        expect(a[0].message).toContain('Billetto 2');
        expect(a[0].message).not.toContain('Ticketmaster');
    });

    it('allt inom Norden → inget larm', () => {
        expect(detectForeignCoords([
            { host: 'A', lat: 59.33, lng: 18.07 },
            { host: 'B', lat: 67.86, lng: 20.23 },
        ])).toEqual([]);
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
