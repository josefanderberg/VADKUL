import { describe, it, expect } from 'vitest';
import { wishesNearCity, wishAgeLabel, CITY_WISHES_MAX } from './cityWishes';
import type { EventWish } from '@/types';

const UPPSALA = { lat: 59.8586, lng: 17.6389 };
const NOW = new Date(2026, 8, 14, 12, 0);

const wish = (id: string, daysAgo: number, extra: Partial<EventWish> = {}): EventWish => ({
    id,
    title: `Önskan ${id}`,
    category: 'other',
    lat: UPPSALA.lat,
    lng: UPPSALA.lng,
    uid: 'u1',
    hostName: 'Testare',
    createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    ...extra,
} as EventWish);

describe('wishesNearCity', () => {
    it('filtrerar på radien och sorterar nyaste först', () => {
        const inTown = wish('a', 3);
        const newer = wish('b', 1);
        const stockholm = wish('c', 0, { lat: 59.3293, lng: 18.0686 }); // ~63 km bort
        const res = wishesNearCity([inTown, stockholm, newer], UPPSALA, 35);
        expect(res.map(w => w.id)).toEqual(['b', 'a']);
    });

    it('hoppar över önskningar utan riktig position (0,0)', () => {
        const res = wishesNearCity([wish('nollo', 1, { lat: 0, lng: 0 })], UPPSALA, 35);
        expect(res).toEqual([]);
    });

    it('kapar vid maxantalet', () => {
        const many = Array.from({ length: 10 }, (_, i) => wish(`w${i}`, i));
        expect(wishesNearCity(many, UPPSALA, 35)).toHaveLength(CITY_WISHES_MAX);
    });
});

describe('wishAgeLabel', () => {
    it('idag / igår / för X dagar sedan', () => {
        expect(wishAgeLabel(new Date(NOW.getTime() - 3_600_000), NOW)).toBe('idag');
        expect(wishAgeLabel(new Date(NOW.getTime() - 30 * 3_600_000), NOW)).toBe('igår');
        expect(wishAgeLabel(new Date(NOW.getTime() - 5 * 86_400_000), NOW)).toBe('för 5 dagar sedan');
    });
});
