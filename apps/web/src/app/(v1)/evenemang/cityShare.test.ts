import { describe, it, expect } from 'vitest';
import { formatCount, truncateTitle, pickShareLines } from './cityShare';
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
            expect(l.when).toMatch(/^[A-ZÅÄÖ][a-zåäö]{2} \d{1,2}\/\d{1,2}( · \d{2}\.\d{2})?$/);
        }
        const loppis = lines.find(l => l.title === 'Loppis på torget');
        if (loppis) expect(loppis.when).not.toContain('·');   // utan klockslag → bara dagen
    });
    it('tom lista → tom lista', () => {
        expect(pickShareLines([], 5)).toEqual([]);
    });
});
