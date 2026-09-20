import { describe, it, expect } from 'vitest';
import { pickHeroMarkers, isPastEv, type HeroLiveEvent } from './heroMarkers';

const NOW = Date.parse('2026-09-20T12:00:00+02:00');
const DAY = '2026-09-20';

let n = 0;
const ev = (o: Partial<HeroLiveEvent> = {}): HeroLiveEvent => ({
    id: `e${n++}`,
    href: '/?event=x',
    dx: 0,
    dy: 0,
    // lat/lng används bara av GL-reservvägen — urvalet här rör dem aldrig.
    lat: 57,
    lng: 14,
    emoji: '🎵',
    hex: null,
    // Default: senare idag (inte passerat).
    t: NOW + 3 * 3_600_000,
    hour: 17,
    day: DAY,
    category: 'music',
    ...o,
});

describe('isPastEv', () => {
    it('event med klockslag är passerat först en timme efter start', () => {
        expect(isPastEv({ t: NOW - 30 * 60_000, hour: 12 }, NOW)).toBe(false);
        expect(isPastEv({ t: NOW - 61 * 60_000, hour: 11 }, NOW)).toBe(true);
    });

    it('event utan klockslag passerar vid kvällsgränsen, inte vid midnatt', () => {
        const morgon = Date.parse('2026-09-20T00:00:00+02:00');
        expect(isPastEv({ t: morgon, hour: null }, NOW)).toBe(false);
        const igar = Date.parse('2026-09-19T00:00:00+02:00');
        expect(isPastEv({ t: igar, hour: null }, NOW)).toBe(true);
    });
});

describe('pickHeroMarkers', () => {
    it('filtrerar bort passerade event', () => {
        const out = pickHeroMarkers(
            [ev({ dx: 0, t: NOW - 5 * 3_600_000, hour: 7 }), ev({ dx: 100 })],
            { dayKeys: null, category: null, now: NOW },
        );
        expect(out).toHaveLength(1);
        expect(out[0].e.dx).toBe(100);
    });

    it('filtrerar på dagurval och kategori', () => {
        const markers = [
            ev({ dx: 0, day: DAY, category: 'music' }),
            ev({ dx: 100, day: '2026-09-21', category: 'music' }),
            ev({ dx: 200, day: DAY, category: 'sport' }),
        ];
        expect(pickHeroMarkers(markers, { dayKeys: [DAY], category: null, now: NOW })
            .map(m => m.e.dx)).toEqual([0, 200]);
        expect(pickHeroMarkers(markers, { dayKeys: null, category: 'music', now: NOW })
            .map(m => m.e.dx)).toEqual([0, 100]);
        // dayKeys null = alla dagar
        expect(pickHeroMarkers(markers, { dayKeys: null, category: null, now: NOW })).toHaveLength(3);
    });

    it('slår ihop event på samma plats till EN bricka med räknare', () => {
        const out = pickHeroMarkers(
            [ev({ dx: 50, dy: 10 }), ev({ dx: 50, dy: 10 }), ev({ dx: 50, dy: 10 })],
            { dayKeys: null, category: null, now: NOW },
        );
        expect(out).toHaveLength(1);
        expect(out[0].count).toBe(3);
    });

    it('gruppens FÖRSTA event blir brickans ansikte (tidigast-först)', () => {
        const tidig = ev({ dx: 50, emoji: '🎸' });
        const sen = ev({ dx: 50, emoji: '🎺' });
        const out = pickHeroMarkers([tidig, sen], { dayKeys: null, category: null, now: NOW });
        expect(out[0].e.emoji).toBe('🎸');
    });

    it('gallrar bort brickor som hamnar för nära en redan placerad', () => {
        const out = pickHeroMarkers(
            [ev({ dx: 0 }), ev({ dx: 10 }), ev({ dx: 100 })],
            { dayKeys: null, category: null, now: NOW, minDistPx: 40 },
        );
        expect(out.map(m => m.e.dx)).toEqual([0, 100]);
    });

    it('gallringen mäts i BÅDA led, inte bara x', () => {
        const out = pickHeroMarkers(
            [ev({ dx: 0, dy: 0 }), ev({ dx: 0, dy: 10 }), ev({ dx: 0, dy: 100 })],
            { dayKeys: null, category: null, now: NOW, minDistPx: 40 },
        );
        expect(out.map(m => m.e.dy)).toEqual([0, 100]);
    });

    it('respekterar taket på antal brickor', () => {
        const many = Array.from({ length: 30 }, (_, i) => ev({ dx: i * 100 }));
        expect(pickHeroMarkers(many, { dayKeys: null, category: null, now: NOW, maxLive: 5 }))
            .toHaveLength(5);
    });

    it('tomt urval ger tom lista, inte krasch', () => {
        expect(pickHeroMarkers([], { dayKeys: [DAY], category: null, now: NOW })).toEqual([]);
        expect(pickHeroMarkers([ev()], { dayKeys: [], category: null, now: NOW })).toEqual([]);
    });
});
