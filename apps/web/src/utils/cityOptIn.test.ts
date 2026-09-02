import { describe, it, expect } from 'vitest';
import { cityOptInDefault, mergeListedDays, cityOptInJsonHref, type MergeDay, type MergeRow } from './cityOptIn';

describe('cityOptInDefault', () => {
    it('utloggad = av, inloggad under 65 = av', () => {
        expect(cityOptInDefault(null, false, undefined)).toBe(false);
        expect(cityOptInDefault(null, true, 40)).toBe(false);
        expect(cityOptInDefault(null, true, undefined)).toBe(false);
    });

    it('inloggad 65+ = på (samma regel som kartan)', () => {
        expect(cityOptInDefault(null, true, 65)).toBe(true);
        expect(cityOptInDefault(null, true, 80)).toBe(true);
    });

    it('användarens eget val vinner åt båda hållen', () => {
        expect(cityOptInDefault('1', false, undefined)).toBe(true);
        expect(cityOptInDefault('0', true, 70)).toBe(false);
    });

    it('skräp i lagringen ignoreras', () => {
        expect(cityOptInDefault('ja', true, 70)).toBe(true);
        expect(cityOptInDefault('', false, undefined)).toBe(false);
    });
});

describe('cityOptInJsonHref', () => {
    it('pekar på stadens route handler', () => {
        expect(cityOptInJsonHref('goteborg')).toBe('/evenemang/goteborg/opt-in.json');
    });
});

type Row = MergeRow & { id: string };
type Day = MergeDay<Row>;
const row = (id: string, t: number, hour: number | null, coverImage?: string): Row => ({ id, t, hour, coverImage });
const day = (key: string, events: Row[], hourCounts: number[] = Array(24).fill(0)): Day =>
    ({ key, label: key, short: key, hourCounts, events });

describe('mergeListedDays', () => {
    const base: Day[] = [
        day('2026-09-03', [row('a', 300, 10, 'img'), row('b', 100, 8)], Array.from({ length: 24 }, (_, h) => (h === 10 || h === 8 ? 1 : 0))),
        day('2026-09-05', [row('c', 500, 12)]),
    ];

    it('utan extra dagar returneras serverns lista orörd (samma referens)', () => {
        expect(mergeListedDays(base, null)).toBe(base);
        expect(mergeListedDays(base, [])).toBe(base);
    });

    it('samma dag: raderna slås ihop, bildsatta först, tidsordning inom grupperna', () => {
        const extra = [day('2026-09-03', [row('x', 200, 9, 'img'), row('y', 50, 7)], Array.from({ length: 24 }, (_, h) => (h === 9 || h === 7 ? 1 : 0)))];
        const out = mergeListedDays(base, extra);
        expect(out.map(d => d.key)).toEqual(['2026-09-03', '2026-09-05']);
        expect(out[0].events.map(r => r.id)).toEqual(['x', 'a', 'y', 'b']);
        expect(out[0].hourCounts[7]).toBe(1);
        expect(out[0].hourCounts[8]).toBe(1);
        expect(out[0].hourCounts[9]).toBe(1);
        expect(out[0].hourCounts[10]).toBe(1);
    });

    it('en dag som bara finns i opt-in-listan läggs till på rätt plats', () => {
        const extra = [day('2026-09-04', [row('z', 400, 18)])];
        const out = mergeListedDays(base, extra);
        expect(out.map(d => d.key)).toEqual(['2026-09-03', '2026-09-04', '2026-09-05']);
        expect(out[1].events.map(r => r.id)).toEqual(['z']);
    });

    it('rör inte serverns dagobjekt', () => {
        const extra = [day('2026-09-05', [row('w', 600, 20)])];
        const out = mergeListedDays(base, extra);
        expect(base[1].events.map(r => r.id)).toEqual(['c']);
        expect(out[1].events.map(r => r.id)).toEqual(['c', 'w']);
    });
});
