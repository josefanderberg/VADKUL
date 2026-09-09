import { describe, it, expect } from 'vitest';
import {
    computeSourceMetrics, evaluateSource, buildBaseline,
    MIN_EVENTS, CLUSTER_MIN_SIZE,
    type InvariantEventRow, type SourceMetrics,
} from './invariants';

function rows(hostName: string, times: string[], opts: { hasClock?: boolean; venue?: string } = {}): InvariantEventRow[] {
    return times.map((time) => ({
        hostName,
        time,
        hasSpecificTime: (opts.hasClock ?? true) ? 1 : 0,
        locationName: opts.venue ?? 'Testscenen, Malmö',
    }));
}

/** KB-kapningen 29/8 i miniatyr: 19 event på exakt samma stämpel, 7 unika totalt. */
function kbScenario(): InvariantEventRow[] {
    const out: InvariantEventRow[] = [];
    const clusters: Array<[string, number]> = [
        ['2026-09-09T17:00:00.000Z', 19],
        ['2026-09-10T16:00:00.000Z', 11],
        ['2026-09-11T16:00:00.000Z', 7],
        ['2026-09-23T16:00:00.000Z', 10],
        ['2026-09-24T16:00:00.000Z', 4],
        ['2026-09-27T16:00:00.000Z', 4],
        ['2026-10-01T16:00:00.000Z', 1],
    ];
    for (const [time, n] of clusters) out.push(...rows('Kulturbolaget', Array(n).fill(time)));
    return out;
}

describe('computeSourceMetrics', () => {
    it('KB-scenariot: 56 event, 7 unika tider, kluster på 19, snitt 8.0', () => {
        const [m] = computeSourceMetrics(kbScenario());
        expect(m.events).toBe(56);
        expect(m.clockedEvents).toBe(56);
        expect(m.distinctTimes).toBe(7);
        expect(m.meanClusterSize).toBeCloseTo(8.0, 3);
        expect(m.largestClusterSize).toBe(19);
        expect(m.largestClusterTime).toBe('2026-09-09T17:00:00.000Z');
    });

    it('källor under MIN_EVENTS bedöms inte', () => {
        const small = rows('Liten källa', Array(MIN_EVENTS - 1).fill('2026-09-09T17:00:00.000Z'));
        expect(computeSourceMetrics(small)).toHaveLength(0);
    });

    it('event utan hostName ignoreras, källor separeras', () => {
        const mixed = [
            ...rows('A', Array(12).fill('2026-09-09T17:00:00.000Z')),
            ...rows('B', Array(12).fill('2026-09-10T17:00:00.000Z')),
            { hostName: '', time: '2026-09-09T17:00:00.000Z', hasSpecificTime: 1, locationName: null },
        ];
        expect(computeSourceMetrics(mixed).map((m) => m.hostName).sort()).toEqual(['A', 'B']);
    });

    it('event utan klockslag räknas varken i kluster eller snitt (defaulttids-klumpar)', () => {
        const m = computeSourceMetrics(rows('Dagslös', Array(20).fill('2026-09-12T00:00:00.000Z'), { hasClock: false }))[0];
        expect(m.clockedEvents).toBe(0);
        expect(m.largestClusterSize).toBe(0);
        expect(m.meanClusterSize).toBe(0);
        expect(m.noClockPct).toBe(100);
    });
});

describe('evaluateSource', () => {
    it('KB-scenariot larmar på både tidskluster och likriktade-tider', () => {
        const [m] = computeSourceMetrics(kbScenario());
        const larm = evaluateSource(m, null).filter((f) => f.level === 'alarm');
        expect(larm.map((f) => f.rule).sort()).toEqual(['likriktade-tider', 'tidskluster']);
        expect(larm[0].message).toContain('Kulturbolaget');
    });

    it('frisk källa med spridda tider larmar inte', () => {
        const times = Array.from({ length: 30 }, (_, i) => `2026-09-${String(10 + (i % 18)).padStart(2, '0')}T${17 + (i % 4)}:00:00.000Z`);
        const [m] = computeSourceMetrics(rows('Frisk', times));
        expect(evaluateSource(m, null).filter((f) => f.level === 'alarm')).toHaveLength(0);
    });

    it('legitimt "kl 19:00"-mönster larmar inte — olika datum ger olika stämplar', () => {
        const times = Array.from({ length: 20 }, (_, i) => `2026-09-${String(10 + i).padStart(2, '0')}T17:00:00.000Z`);
        const [m] = computeSourceMetrics(rows('Kvällsscen', times));
        expect(evaluateSource(m, null).filter((f) => f.level === 'alarm')).toHaveLength(0);
    });

    it('stor frisk källa med naturliga krockar går fri (Tickster-mönstret, snitt < 4)', () => {
        // 300 event på 100 stämplar = snitt 3.0 och största kluster 3.
        const times: string[] = [];
        for (let i = 0; i < 100; i++) {
            const stamp = `2026-${String(9 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}T${17 + (i % 3)}:00:00.000Z`;
            times.push(stamp, stamp, stamp);
        }
        const [m] = computeSourceMetrics(rows('Biljettjätte', times));
        expect(m.meanClusterSize).toBeCloseTo(3.0, 3);
        expect(evaluateSource(m, null).filter((f) => f.level === 'alarm')).toHaveLength(0);
    });

    it('klockslagslös festivalklump larmar inte på likriktade-tider', () => {
        const m = computeSourceMetrics(rows('Skördefest', Array(27).fill('2026-09-25T00:00:00.000Z'), { hasClock: false }))[0];
        expect(evaluateSource(m, null).some((f) => f.rule === 'likriktade-tider')).toBe(false);
        expect(evaluateSource(m, null).some((f) => f.rule === 'tidskluster')).toBe(false);
    });

    it('baslinje: klusterväxt ≥3× larmar under absoluttröskeln', () => {
        // 9 av 40 klockade = 22 % — under CLUSTER_MIN_SHARE, men baslinjen låg på 2.
        const times = [
            ...Array(9).fill('2026-09-09T17:00:00.000Z'),
            ...Array.from({ length: 31 }, (_, i) => `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T${17 + (i % 3)}:30:00.000Z`),
        ];
        const [m] = computeSourceMetrics(rows('Växande', times));
        expect(m.largestClusterSize).toBeGreaterThanOrEqual(CLUSTER_MIN_SIZE);
        const baseline = { meanClusterSize: 1.1, noClockPct: 5, largestClusterSize: 2 };
        expect(evaluateSource(m, baseline).some((f) => f.rule === 'tidskluster')).toBe(true);
        expect(evaluateSource(m, null).some((f) => f.rule === 'tidskluster')).toBe(false);
    });

    it('klockslag-tappade kräver baslinje och stort hopp', () => {
        const m = computeSourceMetrics(rows('Strukturbyte', Array(20).fill('2026-09-12T00:00:00.000Z'), { hasClock: false }))[0];
        const baseline = { meanClusterSize: 1.1, noClockPct: 10, largestClusterSize: 1 };
        expect(evaluateSource(m, baseline).some((f) => f.rule === 'klockslag-tappade')).toBe(true);
        expect(evaluateSource(m, null).some((f) => f.rule === 'klockslag-tappade')).toBe(false);
    });

    it('venue-koncentration är info, aldrig larm', () => {
        const times = Array.from({ length: 20 }, (_, i) => `2026-09-${String(10 + i).padStart(2, '0')}T17:00:00.000Z`);
        const [m] = computeSourceMetrics(rows('Venuekälla', times, { venue: 'Slagthuset, Malmö' }));
        const venue = evaluateSource(m, null).filter((f) => f.rule === 'venue-koncentration');
        expect(venue).toHaveLength(1);
        expect(venue[0].level).toBe('info');
    });
});

describe('buildBaseline', () => {
    const metric = (over: Partial<SourceMetrics>): SourceMetrics => ({
        hostName: 'X', events: 20, clockedEvents: 18, distinctTimes: 16, meanClusterSize: 1.1,
        largestClusterSize: 2, largestClusterTime: null, noClockPct: 10,
        topVenueShare: 50, topVenue: null, ...over,
    });

    it('kräver minst 3 körningar', () => {
        expect(buildBaseline([metric({}), metric({})])).toBeNull();
    });

    it('tar medianen — en enskild dålig natt förgiftar inte baslinjen', () => {
        const b = buildBaseline([
            metric({ meanClusterSize: 1.1, noClockPct: 10 }),
            metric({ meanClusterSize: 1.2, noClockPct: 12 }),
            metric({ meanClusterSize: 8.0, noClockPct: 95 }), // kapnings-natten
        ]);
        expect(b!.meanClusterSize).toBeCloseTo(1.2);
        expect(b!.noClockPct).toBe(12);
    });
});
