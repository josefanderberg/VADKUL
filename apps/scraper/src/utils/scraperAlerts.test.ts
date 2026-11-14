import { describe, it, expect } from 'vitest';
import { detectRunProblems, detectVolumeDrops, detectDayClusters, detectNullIsland, detectForeignCoords, quarantineAlerts, sortAlerts, RunRow } from './scraperAlerts';

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

describe('detectVolumeDrops — källan lever men har tappat det mesta', () => {
    const NOW = new Date('2026-11-14T12:00:00Z');
    const at = (iso: string, found: number, dup = 0): RunRow =>
        ({ source_id: 'x', started_at: `${iso}T00:30:00Z`, found, skipped_duplicate: dup, error_count: 0 });

    it('under registrets golv: Naturskyddsföreningen gav 27 av 239 (golv 100)', () => {
        const runs = [at('2026-11-14', 27, 25), at('2026-11-13', 26, 25), at('2026-11-12', 27, 24), at('2026-11-11', 26, 25)];
        const a = detectVolumeDrops(new Map([['naturskyddsforeningen', runs]]), new Set(), new Map([['naturskyddsforeningen', 100]]), NOW);
        expect(a).toHaveLength(1);
        expect(a[0]).toMatchObject({ level: 'varning', kind: 'volymras', source: 'naturskyddsforeningen', since: '2026-11-12' });
        expect(a[0].message).toContain('under källans golv 100');
        // Efter rättningen (239 per körning) är det tyst.
        const fixed = [at('2026-11-17', 239, 230), at('2026-11-16', 239, 230), at('2026-11-15', 239, 205), ...runs];
        expect(detectVolumeDrops(new Map([['naturskyddsforeningen', fixed]]), new Set(), new Map([['naturskyddsforeningen', 100]]), NOW)).toEqual([]);
    });

    it('utan golv: under 40 % av källans egen nivå för två veckor sedan', () => {
        const before = ['2026-10-10', '2026-10-13', '2026-10-16', '2026-10-19', '2026-10-22'].map((d) => at(d, 150));
        const runs = [at('2026-11-14', 30), at('2026-11-11', 28), at('2026-11-08', 31), ...before];
        const a = detectVolumeDrops(new Map([['kommun', runs]]), new Set(), new Map(), NOW);
        expect(a).toHaveLength(1);
        expect(a[0].message).toContain('30 event per körning mot 150 tidigare');
    });

    it('en motor som hoppar över kända adresser rasar inte bara för att få är NYA', () => {
        // found 3 en vanlig natt, 150 på full-refresh — de överhoppade bokförs som dubbletter.
        const before = ['2026-10-10', '2026-10-13', '2026-10-16', '2026-10-19'].map((d) => at(d, 150, 140));
        const runs = [at('2026-11-14', 3, 148), at('2026-11-11', 2, 149), at('2026-11-08', 151, 147), ...before];
        expect(detectVolumeDrops(new Map([['sitemapkalla', runs]]), new Set(), new Map(), NOW)).toEqual([]);
    });

    it('en enstaka dålig natt, en liten källa och en säsongsdipp larmar inte', () => {
        const before = ['2026-10-10', '2026-10-13', '2026-10-16', '2026-10-19'].map((d) => at(d, 150));
        expect(detectVolumeDrops(new Map([['x', [at('2026-11-14', 10), at('2026-11-11', 148), at('2026-11-08', 152), ...before]]]), new Set(), new Map(), NOW)).toEqual([]);
        const small = ['2026-10-10', '2026-10-13', '2026-10-16', '2026-10-19'].map((d) => at(d, 12));
        expect(detectVolumeDrops(new Map([['liten', [at('2026-11-14', 3), at('2026-11-11', 3), at('2026-11-08', 3), ...small]]]), new Set(), new Map(), NOW)).toEqual([]);
        expect(detectVolumeDrops(new Map([['sasong', [at('2026-11-14', 80), at('2026-11-11', 82), at('2026-11-08', 85), ...before]]]), new Set(), new Map(), NOW)).toEqual([]);
    });

    it('tysta källor (0) har sitt eget larm, karantänsatta hoppas, för kort historik döms inte', () => {
        const before = ['2026-10-10', '2026-10-13', '2026-10-16', '2026-10-19'].map((d) => at(d, 150));
        const dead = [at('2026-11-14', 0), at('2026-11-11', 0), at('2026-11-08', 0), ...before];
        expect(detectVolumeDrops(new Map([['x', dead]]), new Set(), new Map([['x', 100]]), NOW)).toEqual([]);
        const low = [at('2026-11-14', 20), at('2026-11-11', 20), at('2026-11-08', 20), ...before];
        expect(detectVolumeDrops(new Map([['x', low]]), new Set(['x']), new Map(), NOW)).toEqual([]);
        expect(detectVolumeDrops(new Map([['ny', [at('2026-11-14', 5), at('2026-11-11', 5)]]]), new Set(), new Map([['ny', 100]]), NOW)).toEqual([]);
    });

    it('volymras sorteras efter tyst, före datumkluster', () => {
        const sorted = sortAlerts([
            { level: 'varning', kind: 'datumkluster', source: 'a', message: '' },
            { level: 'varning', kind: 'volymras', source: 'b', message: '' },
            { level: 'varning', kind: 'tyst', source: 'c', message: '' },
        ]);
        expect(sorted.map((x) => x.kind)).toEqual(['tyst', 'volymras', 'datumkluster']);
    });
});
