import { describe, it, expect } from 'vitest';
import { eventDays, isPopularListed, popularDays, takeRows } from './popularList';

// Fast "nu": onsdag 23/9 kl 12 lokal tid.
const NOW = new Date(2026, 8, 23, 12, 0);
const at = (day: number, hour: number) => new Date(2026, 8, 23 + day, hour, 0);
const never = () => false;

describe('isPopularListed', () => {
    it('pop-flaggan räcker', () => {
        expect(isPopularListed({ time: NOW, pop: true }, NOW.getTime())).toBe(true);
        expect(isPopularListed({ time: NOW }, NOW.getTime())).toBe(false);
    });
    it('aktiv boost räknas, utgången gör det inte', () => {
        const nowMs = NOW.getTime();
        expect(isPopularListed({ time: NOW, featuredUntil: new Date(nowMs + 1000) }, nowMs)).toBe(true);
        expect(isPopularListed({ time: NOW, featuredUntil: new Date(nowMs - 1000) }, nowMs)).toBe(false);
    });
});

describe('popularDays', () => {
    it('grupperar per dag i ordning, tidsordning inom dagen, bara populära', () => {
        const evts = [
            { id: 'b', time: at(1, 20), pop: true },
            { id: 'a', time: at(0, 18), pop: true },
            { id: 'x', time: at(0, 19) },
            { id: 'c', time: at(1, 10), pop: true },
            { id: 'd', time: at(3, 10), pop: true },
        ];
        const days = popularDays(evts, 0, NOW, never);
        expect(days.map(d => d.dayOffset)).toEqual([0, 1, 3]);
        expect(days[1].events.map(e => e.id)).toEqual(['c', 'b']);
        expect(days.flatMap(d => d.events).some(e => e.id === 'x')).toBe(false);
    });
    it('börjar på den visade dagen', () => {
        const evts = [
            { id: 'idag', time: at(0, 18), pop: true },
            { id: 'imorgon', time: at(1, 18), pop: true },
        ];
        expect(popularDays(evts, 1, NOW, never).map(d => d.dayOffset)).toEqual([1]);
    });
    it('passerade sorteras bort', () => {
        const evts = [
            { id: 'passerat', time: at(0, 9), pop: true },
            { id: 'kvar', time: at(0, 18), pop: true },
        ];
        const days = popularDays(evts, 0, NOW, e => e.id === 'passerat');
        expect(days[0].events.map(e => e.id)).toEqual(['kvar']);
    });
});

describe('takeRows', () => {
    const days = [
        { dayOffset: 0, rows: [1, 2, 3] },
        { dayOffset: 1, rows: [4, 5] },
        { dayOffset: 2, rows: [6] },
    ];
    it('kapar över dagsgränsen och släpper dagar utan rader', () => {
        expect(takeRows(days, 4)).toEqual([
            { dayOffset: 0, rows: [1, 2, 3] },
            { dayOffset: 1, rows: [4] },
        ]);
    });
    it('gränsen större än allt → allt', () => {
        expect(takeRows(days, 99)).toEqual(days);
    });
});

describe('eventDays', () => {
    it('tar med alla event (inte bara populära), dag för dag i tidsordning', () => {
        const evts = [
            { id: 'b', time: at(0, 20) },
            { id: 'a', time: at(0, 18), pop: true },
            { id: 'c', time: at(2, 10) },
        ];
        const days = eventDays(evts, 0, NOW, never);
        expect(days.map(d => d.dayOffset)).toEqual([0, 2]);
        expect(days[0].events.map(e => e.id)).toEqual(['a', 'b']);
    });
    it('släpper passerade och dagar före den visade', () => {
        const evts = [
            { id: 'igar', time: at(-1, 18) },
            { id: 'passerat', time: at(0, 9) },
            { id: 'ikvall', time: at(0, 19) },
        ];
        const days = eventDays(evts, 0, NOW, e => e.id === 'passerat');
        expect(days.flatMap(d => d.events).map(e => e.id)).toEqual(['ikvall']);
    });
});
