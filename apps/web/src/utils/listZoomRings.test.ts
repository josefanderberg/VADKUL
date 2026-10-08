import { describe, it, expect } from 'vitest';
import { nearestOutsideBounds, listSegmentKey, splitDaysIntoRings } from './listZoomRings';

const id = (r: string) => [r];

describe('splitDaysIntoRings', () => {
    const days = [
        { dayOffset: 0, rows: ['a', 'x', 'b'] },
        { dayOffset: 1, rows: ['c', 'y'] },
        { dayOffset: 2, rows: ['z'] },
    ];

    it('utan utzoomning är allt ring 0 i dagordning', () => {
        expect(splitDaysIntoRings(days, [], id)).toEqual([
            { dayOffset: 0, ring: 0, rows: ['a', 'x', 'b'] },
            { dayOffset: 1, ring: 0, rows: ['c', 'y'] },
            { dayOffset: 2, ring: 0, rows: ['z'] },
        ]);
    });

    it('det som redan fanns står kvar överst, de nya börjar om från första dagen', () => {
        const rings = [new Set(['a', 'b', 'c'])];
        expect(splitDaysIntoRings(days, rings, id)).toEqual([
            { dayOffset: 0, ring: 0, rows: ['a', 'b'] },
            { dayOffset: 1, ring: 0, rows: ['c'] },
            { dayOffset: 0, ring: 1, rows: ['x'] },
            { dayOffset: 1, ring: 1, rows: ['y'] },
            { dayOffset: 2, ring: 1, rows: ['z'] },
        ]);
    });

    it('en rad hör till den FÖRSTA ringen som kände den (ringarna är kumulativa)', () => {
        const rings = [new Set(['a']), new Set(['a', 'x'])];
        const out = splitDaysIntoRings(days, rings, id);
        expect(out.filter(d => d.ring === 0).flatMap(d => d.rows)).toEqual(['a']);
        expect(out.filter(d => d.ring === 1).flatMap(d => d.rows)).toEqual(['x']);
        expect(out.filter(d => d.ring === 2).flatMap(d => d.rows)).toEqual(['b', 'c', 'y', 'z']);
    });

    it('en dubblettrad stannar i den tidigaste ring något av tillfällena fanns i', () => {
        const grouped = [{ dayOffset: 0, rows: [{ rep: 'ny', dups: ['gammal'] }, { rep: 'x', dups: [] }] }];
        const out = splitDaysIntoRings(grouped, [new Set(['gammal'])], r => [r.rep, ...r.dups]);
        expect(out).toEqual([
            { dayOffset: 0, ring: 0, rows: [{ rep: 'ny', dups: ['gammal'] }] },
            { dayOffset: 0, ring: 1, rows: [{ rep: 'x', dups: [] }] },
        ]);
    });

    it('en ring utan rader ger inga dagar (inget att visa under en avdelare)', () => {
        const rings = [new Set(['a', 'x', 'b', 'c', 'y', 'z'])];
        expect(splitDaysIntoRings(days, rings, id).every(d => d.ring === 0)).toBe(true);
    });
});

describe('nearestOutsideBounds', () => {
    // Växjö-ish ruta.
    const bounds = { west: 14.7, south: 56.85, east: 14.9, north: 56.9 };
    const center = { lat: 56.875, lng: 14.8 };

    it('tar det närmaste UTANFÖR rutan, aldrig något inuti', () => {
        const evts = [
            { id: 'inne', lat: 56.876, lng: 14.81 },
            { id: 'langt', lat: 57.5, lng: 15.5 },
            { id: 'nara', lat: 56.95, lng: 14.8 },
        ];
        expect(nearestOutsideBounds(evts, bounds, center)?.id).toBe('nara');
    });

    it('longituden skalas: en grad öster är kortare än en grad norr på 57°', () => {
        const evts = [
            { id: 'norr', lat: 56.875 + 0.6, lng: 14.8 },
            { id: 'oster', lat: 56.875, lng: 14.8 + 1.0 },
        ];
        // 1,0° öster ≈ 61 km, 0,6° norr ≈ 67 km.
        expect(nearestOutsideBounds(evts, bounds, center)?.id).toBe('oster');
    });

    it('include smalnar urvalet, koordinatlösa och 0/0 hoppas över', () => {
        const evts = [
            { id: 'noll', lat: 0, lng: 0 },
            { id: 'utan' },
            { id: 'nara', lat: 56.95, lng: 14.8 },
            { id: 'ok', lat: 57.2, lng: 14.8 },
        ];
        expect(nearestOutsideBounds(evts, bounds, center, e => e.id !== 'nara')?.id).toBe('ok');
    });

    it('inget utanför → null', () => {
        expect(nearestOutsideBounds([{ lat: 56.876, lng: 14.81 }], bounds, center)).toBeNull();
    });
});

describe('splitDaysIntoRings - Från idag', () => {
    // Visade dagen = 2 (t.ex. imorgon-bumpen eller en vald dag); 0 och 1 är tidigare.
    const days = [
        { dayOffset: 0, rows: ['t0', 'n0'] },
        { dayOffset: 1, rows: ['t1'] },
        { dayOffset: 2, rows: ['a', 'x'] },
        { dayOffset: 3, rows: ['b'] },
    ];

    it('utan valet visas inget före den visade dagen', () => {
        expect(splitDaysIntoRings(days, [], id, { shownDay: 2, todayAt: null })).toEqual([
            { dayOffset: 2, ring: 0, rows: ['a', 'x'] },
            { dayOffset: 3, ring: 0, rows: ['b'] },
        ]);
    });

    it('Från idag lägger de tidigare dagarna sist, i ett eget avsnitt', () => {
        expect(splitDaysIntoRings(days, [], id, { shownDay: 2, todayAt: 0 })).toEqual([
            { dayOffset: 2, ring: 0, rows: ['a', 'x'] },
            { dayOffset: 3, ring: 0, rows: ['b'] },
            { dayOffset: 0, ring: 0, fromToday: true, rows: ['t0', 'n0'] },
            { dayOffset: 1, ring: 0, fromToday: true, rows: ['t1'] },
        ]);
    });

    it('zoomar man ut efter Från idag börjar den nya ringen om från idag', () => {
        // Ringen frös hela rutan (alla dagar) - n0 och x kom in vid utzoomningen.
        const rings = [new Set(['t0', 't1', 'a', 'b'])];
        expect(splitDaysIntoRings(days, rings, id, { shownDay: 2, todayAt: 0 })).toEqual([
            { dayOffset: 2, ring: 0, rows: ['a'] },
            { dayOffset: 3, ring: 0, rows: ['b'] },
            { dayOffset: 0, ring: 0, fromToday: true, rows: ['t0'] },
            { dayOffset: 1, ring: 0, fromToday: true, rows: ['t1'] },
            { dayOffset: 0, ring: 1, rows: ['n0'] },
            { dayOffset: 2, ring: 1, rows: ['x'] },
        ]);
    });

    it('Från idag efter en utzoomning tar med de tidigare dagarna ur båda ringarna', () => {
        const rings = [new Set(['t1', 'a', 'b'])];
        expect(splitDaysIntoRings(days, rings, id, { shownDay: 2, todayAt: 1 })).toEqual([
            { dayOffset: 2, ring: 0, rows: ['a'] },
            { dayOffset: 3, ring: 0, rows: ['b'] },
            { dayOffset: 2, ring: 1, rows: ['x'] },
            { dayOffset: 0, ring: 1, fromToday: true, rows: ['t0', 'n0'] },
            { dayOffset: 1, ring: 1, fromToday: true, rows: ['t1'] },
        ]);
    });

    it('avsnittsnyckeln lägger Från idag mellan sin ring och nästa', () => {
        expect(listSegmentKey({ ring: 1 })).toBeLessThan(listSegmentKey({ ring: 1, fromToday: true }));
        expect(listSegmentKey({ ring: 1, fromToday: true })).toBeLessThan(listSegmentKey({ ring: 2 }));
    });
});
