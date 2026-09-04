import { describe, it, expect } from 'vitest';
import { formatCount, truncateTitle, pickShareLines } from './cityShare';
import { cityBricks } from './cityShareImage';
import type { CityEvent } from './cityData';

const ev = (over: Partial<CityEvent>): CityEvent => ({
    id: 'x', title: 'Event', time: new Date(Date.now() + 864e5).toISOString(), hasSpecificTime: true,
    lat: 65.3, lng: 21.5, locationName: 'Piteå', category: 'music', emoji: '🎵', repeatCount: 1, ...over,
});

describe('formatCount', () => {
    it('svensk tusentalsavgränsning', () => {
        expect(formatCount(7)).toBe('7');
        expect(formatCount(118)).toBe('118');
        expect(formatCount(1234)).toBe('1 234');
        expect(formatCount(12466)).toBe('12 466');
    });
    it('negativt/decimaler → golv ≥ 0', () => {
        expect(formatCount(-3)).toBe('0');
        expect(formatCount(9.9)).toBe('9');
    });
});

describe('truncateTitle', () => {
    it('kort titel orörd', () => {
        expect(truncateTitle('Skuggor')).toBe('Skuggor');
    });
    it('lång titel kapas vid ordgräns med ellips', () => {
        const t = truncateTitle('Framnäs trädgårdsfest med musik, mat och marknad hela dagen', 30);
        expect(t.length).toBeLessThanOrEqual(30);
        expect(t.endsWith('…')).toBe(true);
        expect(t).toBe('Framnäs trädgårdsfest med…');
    });
});

describe('pickShareLines', () => {
    it('bara kommande inom 7 dagar, max n, med emoji/kapad titel/dag + klockslag', () => {
        const now = Date.now();
        const lines = pickShareLines([
            ev({ id: 'past', title: 'Igår', time: new Date(now - 3 * 864e5).toISOString() }),
            ev({ id: 'far', title: 'Om tre veckor', time: new Date(now + 21 * 864e5).toISOString() }),
            ev({ id: 'a', title: 'Konsert i Acusticum', category: 'music', emoji: '🎵' }),
            ev({ id: 'b', title: 'Loppis på torget', category: 'market', emoji: '🛍️', locationName: 'Torget', hasSpecificTime: false }),
            ev({ id: 'c', title: 'Familjedag', category: 'family', emoji: '🧸', locationName: 'Parken' }),
            ev({ id: 'd', title: 'Match', category: 'sport', emoji: '⚽', locationName: 'Arenan' }),
            ev({ id: 'e', title: 'Schack på biblioteket', category: 'social', emoji: '♟️', locationName: 'Biblioteket' }),
            ev({ id: 'f', title: 'Vernissage', category: 'art', emoji: '🎨', locationName: 'Galleriet' }),
        ], 5, now);
        expect(lines).toHaveLength(5);
        const titles = lines.map(l => l.title);
        expect(titles).not.toContain('Igår');
        expect(titles).not.toContain('Om tre veckor');
        for (const l of lines) {
            expect(l.emoji.length).toBeGreaterThan(0);
            expect(l.when).toMatch(/^[A-ZÅÄÖ][a-zåäö]{2} \d{1,2}\/\d{1,2}( · \d{2}[:.]\d{2})?$/);
        }
        const loppis = lines.find(l => l.title === 'Loppis på torget');
        if (loppis) expect(loppis.when).not.toContain('·');   // utan klockslag → bara dagen
    });
    it('raderna ligger i datumordning oavsett rankning/inmatningsordning', () => {
        // Olika ord i titlarna: dedupKey ser "Dag 1"–"Dag 5" som samma titel.
        const now = Date.now();
        const at = (d: number) => new Date(now + d * 864e5 + 3600e3).toISOString();
        const lines = pickShareLines([
            ev({ id: 'd4', title: 'Match', time: at(4), category: 'sport', emoji: '⚽', locationName: 'Arenan' }),
            ev({ id: 'd1', title: 'Konsert', time: at(1), category: 'music', emoji: '🎵', locationName: 'Scenen' }),
            ev({ id: 'd5', title: 'Vernissage', time: at(5), category: 'art', emoji: '🎨', locationName: 'Galleriet' }),
            ev({ id: 'd2', title: 'Familjedag', time: at(2), category: 'family', emoji: '🧸', locationName: 'Parken' }),
            ev({ id: 'd3', title: 'Loppis', time: at(3), category: 'market', emoji: '🛍️', locationName: 'Torget' }),
        ], 5, now);
        expect(lines.map(l => l.title)).toEqual(['Konsert', 'Familjedag', 'Loppis', 'Match', 'Vernissage']);
    });
    it('tom lista → tom lista', () => {
        expect(pickShareLines([], 5)).toEqual([]);
    });
});

describe('cityBricks', () => {
    const pitea = { lat: 65.3170, lng: 21.4795 };
    it('event nära staden hamnar i kartans högerdel, glest och max 12', () => {
        const now = Date.now();
        const events: CityEvent[] = Array.from({ length: 30 }, (_, i) => ev({
            id: `e${i}`, title: `Event ${i}`, category: ['music', 'sport', 'family', 'art', 'market'][i % 5],
            lat: 65.3170 + (i % 6) * 0.004, lng: 21.4795 + Math.floor(i / 6) * 0.01,
            locationName: `Plats ${i}`, time: new Date(now + 864e5 + i * 36e5).toISOString(),
        }));
        const bricks = cityBricks(pitea, events, now);
        expect(bricks.length).toBeGreaterThan(0);
        expect(bricks.length).toBeLessThanOrEqual(12);
        for (const b of bricks) { expect(b.left).toBeGreaterThanOrEqual(640); expect(b.left).toBeLessThanOrEqual(1170); }
        for (let i = 0; i < bricks.length; i++) for (let j = i + 1; j < bricks.length; j++)
            expect(Math.hypot(bricks[i].left - bricks[j].left, bricks[i].top - bricks[j].top)).toBeGreaterThanOrEqual(48);
    });
    it('brickorna bär kategori-gradient och exakt den första har stjärna', () => {
        const now = Date.now();
        const events: CityEvent[] = Array.from({ length: 6 }, (_, i) => ev({
            id: `e${i}`, title: `Event ${i}`, category: ['music', 'sport', 'family'][i % 3],
            lat: 65.3170 + i * 0.006, lng: 21.4795 + i * 0.008,
            locationName: `Plats ${i}`, time: new Date(now + 864e5 + i * 36e5).toISOString(),
        }));
        const bricks = cityBricks(pitea, events, now);
        expect(bricks.length).toBeGreaterThan(1);
        for (const b of bricks) expect(b.bg).toMatch(/gradient/);
        expect(bricks.map(b => b.star)).toEqual(bricks.map((_, i) => i === 0));
    });
    it('event utan koordinater, förbi eller >7 dagar bort ger inga brickor', () => {
        const now = Date.now();
        expect(cityBricks(pitea, [
            ev({ id: 'a', lat: 0, lng: 0 }),
            ev({ id: 'b', time: new Date(now - 2 * 864e5).toISOString() }),
            ev({ id: 'c', time: new Date(now + 20 * 864e5).toISOString() }),
        ], now)).toEqual([]);
    });
});
