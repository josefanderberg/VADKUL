import { describe, it, expect } from 'vitest';
import {
    cityOptInDefault, parseStoredSources, filterDaysBySource, mergeListedDays, cityOptInJsonHref,
    type MergeDay, type MergeRow,
} from './cityOptIn';

describe('parseStoredSources', () => {
    it('läser en JSON-lista med kända nycklar, sorterad och utan dubbletter', () => {
        expect(parseStoredSources('["pro","svenskakyrkan","pro"]')).toEqual(['pro', 'svenskakyrkan']);
        expect(parseStoredSources('[]')).toEqual([]);
    });

    it('okända nycklar släpps, skräp ger null (= inget val)', () => {
        expect(parseStoredSources('["pro","hembygd"]')).toEqual(['pro']);
        expect(parseStoredSources('1')).toBeNull();
        expect(parseStoredSources('{"pro":true}')).toBeNull();
        expect(parseStoredSources(null)).toBeNull();
        expect(parseStoredSources('')).toBeNull();
    });
});

describe('cityOptInDefault', () => {
    it('utloggad och inloggad under 65 = inga källor', () => {
        expect(cityOptInDefault(null, false, undefined)).toEqual([]);
        expect(cityOptInDefault(null, true, 40)).toEqual([]);
        expect(cityOptInDefault(null, true, undefined)).toEqual([]);
    });

    it('inloggad 65+ = kyrkan + PRO förvalda, inte Korpen (samma som kartan)', () => {
        expect(cityOptInDefault(null, true, 65)).toEqual(['pro', 'svenskakyrkan']);
        expect(cityOptInDefault(null, true, 80)).toEqual(['pro', 'svenskakyrkan']);
    });

    it('användarens eget val vinner — även ett tomt', () => {
        expect(cityOptInDefault('["korpen"]', false, undefined)).toEqual(['korpen']);
        expect(cityOptInDefault('[]', true, 70)).toEqual([]);
    });
});

describe('cityOptInJsonHref', () => {
    it('pekar på stadens route handler', () => {
        expect(cityOptInJsonHref('goteborg')).toBe('/evenemang/goteborg/opt-in.json');
    });
});

type Row = MergeRow & { id: string };
type Day = MergeDay<Row>;
const row = (id: string, t: number, hour: number | null, opts: { coverImage?: string; source?: string; dups?: Row[] } = {}): Row =>
    ({ id, t, hour, ...opts });
const day = (key: string, events: Row[], hourCounts: number[] = Array(24).fill(0)): Day =>
    ({ key, label: key, short: key, hourCounts, events });

describe('filterDaysBySource', () => {
    const days: Day[] = [
        day('2026-09-03', [
            row('k1', 100, 10, { source: 'svenskakyrkan' }),
            row('p1', 200, 14, { source: 'pro', dups: [row('p1b', 250, 15, { source: 'pro' })] }),
            row('c1', 300, 18, { source: 'korpen' }),
        ], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0]),
        day('2026-09-04', [row('c2', 400, 9, { source: 'korpen' })]),
    ];

    it('behåller bara valda källors rader och räknar om staplarna', () => {
        const out = filterDaysBySource(days, ['pro']);
        expect(out.map(d => d.key)).toEqual(['2026-09-03']);
        expect(out[0].events.map(r => r.id)).toEqual(['p1']);
        expect(out[0].hourCounts[14]).toBe(1);
        expect(out[0].hourCounts[15]).toBe(1); // dupens timme räknas
        expect(out[0].hourCounts[10]).toBe(0);
    });

    it('flera källor, tom lista och rader utan källa', () => {
        expect(filterDaysBySource(days, ['korpen', 'svenskakyrkan']).map(d => d.events.map(r => r.id))).toEqual([['k1', 'c1'], ['c2']]);
        expect(filterDaysBySource(days, [])).toEqual([]);
        expect(filterDaysBySource([day('x', [row('n', 1, null)])], ['pro'])).toEqual([]);
    });
});

describe('mergeListedDays', () => {
    const base: Day[] = [
        day('2026-09-03', [row('a', 300, 10, { coverImage: 'img' }), row('b', 100, 8)], Array.from({ length: 24 }, (_, h) => (h === 10 || h === 8 ? 1 : 0))),
        day('2026-09-05', [row('c', 500, 12)]),
    ];

    it('utan extra dagar returneras serverns lista orörd (samma referens)', () => {
        expect(mergeListedDays(base, null)).toBe(base);
        expect(mergeListedDays(base, [])).toBe(base);
    });

    it('samma dag: raderna slås ihop, bildsatta först, tidsordning inom grupperna', () => {
        const extra = [day('2026-09-03', [row('x', 200, 9, { coverImage: 'img' }), row('y', 50, 7)], Array.from({ length: 24 }, (_, h) => (h === 9 || h === 7 ? 1 : 0)))];
        const out = mergeListedDays(base, extra);
        expect(out.map(d => d.key)).toEqual(['2026-09-03', '2026-09-05']);
        expect(out[0].events.map(r => r.id)).toEqual(['x', 'a', 'y', 'b']);
        expect([7, 8, 9, 10].map(h => out[0].hourCounts[h])).toEqual([1, 1, 1, 1]);
    });

    it('en dag som bara finns i opt-in-listan läggs till på rätt plats', () => {
        const extra = [day('2026-09-04', [row('z', 400, 18)])];
        const out = mergeListedDays(base, extra);
        expect(out.map(d => d.key)).toEqual(['2026-09-03', '2026-09-04', '2026-09-05']);
        expect(out[1].events.map(r => r.id)).toEqual(['z']);
    });

    it('beyond bara när båda halvorna är utanför fönstret', () => {
        const server: Day[] = [{ ...day('2026-10-01', [row('s', 1, 9)]), beyond: true }];
        const optInBeyond: Day[] = [{ ...day('2026-10-01', [row('o', 2, 10)]), beyond: true }];
        const optInWindow: Day[] = [day('2026-10-01', [row('o', 2, 10)])];
        expect(mergeListedDays(server, optInBeyond)[0].beyond).toBe(true);
        expect(mergeListedDays(server, optInWindow)[0].beyond).toBeUndefined();
    });

    it('rör inte serverns dagobjekt', () => {
        const extra = [day('2026-09-05', [row('w', 600, 20)])];
        const out = mergeListedDays(base, extra);
        expect(base[1].events.map(r => r.id)).toEqual(['c']);
        expect(out[1].events.map(r => r.id)).toEqual(['c', 'w']);
    });
});
