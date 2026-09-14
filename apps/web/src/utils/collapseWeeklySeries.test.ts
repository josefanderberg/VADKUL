import { describe, it, expect } from 'vitest';
import { collapseWeeklySeries } from './collapseWeeklySeries';
import type { LinkEvent } from '@/types';

/** Fast "nu" så testerna aldrig blir tidsbomber. */
const NOW = Date.parse('2026-09-14T12:00:00.000Z');

const evt = (id: string, timeIso: string, over: Partial<LinkEvent> = {}): LinkEvent => ({
    id,
    url: '',
    title: id,
    time: new Date(timeIso),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    locationName: 'Testorten',
    lat: 59, lng: 17,
    hostName: 'Test',
    category: 'social',
    coverImage: '',
    description: '',
    attendees: 0,
    isLocationVerified: true,
    hasSpecificTime: true,
    userCreated: true,
    ...over,
} as LinkEvent);

/** Ett utvecklat serietillfälle som expandWeekly bygger dem. */
const occ = (baseId: string, timeIso: string) =>
    evt(`${baseId}__${timeIso.slice(0, 10)}`, timeIso, { seriesId: baseId, repeatWeekly: true });

describe('collapseWeeklySeries', () => {
    it('en serie blir EN rad — nästa kommande tillfälle representerar', () => {
        const out = collapseWeeklySeries([
            occ('fre', '2026-09-18T15:00:00.000Z'),
            occ('fre', '2026-09-25T15:00:00.000Z'),
            occ('fre', '2026-10-02T15:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('fre__2026-09-18');
    });

    it('redan passerade tillfällen väljs inte som representant', () => {
        const out = collapseWeeklySeries([
            occ('fre', '2026-09-11T15:00:00.000Z'),
            occ('fre', '2026-09-18T15:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('fre__2026-09-18');
    });

    it('en helt passerad serie representeras av sitt SENASTE tillfälle', () => {
        const out = collapseWeeklySeries([
            occ('gammal', '2026-08-07T15:00:00.000Z'),
            occ('gammal', '2026-08-14T15:00:00.000Z'),
        ], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('gammal__2026-08-14');
    });

    it('vanliga event passerar orörda och helheten är i tidsordning', () => {
        const out = collapseWeeklySeries([
            occ('lor', '2026-09-19T16:00:00.000Z'),
            evt('engangs', '2026-09-17T18:00:00.000Z'),
            occ('lor', '2026-09-26T16:00:00.000Z'),
            occ('fre', '2026-09-18T15:00:00.000Z'),
        ], NOW);
        expect(out.map(e => e.id)).toEqual([
            'engangs', 'fre__2026-09-18', 'lor__2026-09-19',
        ]);
    });

    it('serie-fallback utan seriesId grupperar på id-stammen före "__"', () => {
        const a = evt('bas__2026-09-18', '2026-09-18T15:00:00.000Z', { repeatWeekly: true });
        const b = evt('bas__2026-09-25', '2026-09-25T15:00:00.000Z', { repeatWeekly: true });
        const out = collapseWeeklySeries([a, b], NOW);
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe('bas__2026-09-18');
    });

    it('tom lista ger tom lista', () => {
        expect(collapseWeeklySeries([], NOW)).toEqual([]);
    });
});
