import { describe, it, expect } from 'vitest';
import { CITIES, CITY_PAGE_MAX_KM, cityPageDistanceKm, cityPageHref, nearestCityPage } from './cityPages';

describe('CITIES — stadssidornas lista', () => {
    it('har unika slugs och koordinater inom Sverige', () => {
        const slugs = new Set(CITIES.map(c => c.slug));
        expect(slugs.size).toBe(CITIES.length);
        for (const c of CITIES) {
            expect(c.slug).toMatch(/^[a-z0-9-]+$/);
            expect(c.lat).toBeGreaterThan(55);
            expect(c.lat).toBeLessThan(70);
            expect(c.lng).toBeGreaterThan(10);
            expect(c.lng).toBeLessThan(25);
        }
    });

    it('cityPageHref pekar på /evenemang/<slug>', () => {
        const malmo = CITIES.find(c => c.slug === 'malmo')!;
        expect(cityPageHref(malmo)).toBe('/evenemang/malmo');
    });
});

describe('cityPageDistanceKm', () => {
    it('Stockholm–Göteborg är ~40 mil', () => {
        const km = cityPageDistanceKm(59.33, 18.06, 57.71, 11.97);
        expect(km).toBeGreaterThan(390);
        expect(km).toBeLessThan(410);
    });
    it('samma punkt är 0', () => {
        expect(cityPageDistanceKm(59.33, 18.06, 59.33, 18.06)).toBe(0);
    });
});

describe('nearestCityPage', () => {
    it('Stockholms centrum → stockholm', () => {
        expect(nearestCityPage(59.33, 18.06)?.slug).toBe('stockholm');
    });

    it('Solna (ingen egen stadssida) → stockholm', () => {
        expect(nearestCityPage(59.36, 18.00)?.slug).toBe('stockholm');
    });

    it('Kiruna — 30 mil från närmaste stadssida → null (indexet är rätt mål)', () => {
        expect(nearestCityPage(67.86, 20.23)).toBeNull();
    });

    it('en småort med egen sida vinner över storstaden längre bort', () => {
        // Borgholm (small) ligger ~4 mil från Kalmar — Borgholms centrum ska
        // ändå landa på borgholm, inte på kalmar.
        expect(nearestCityPage(56.88, 16.66)?.slug).toBe('borgholm');
    });

    it('maxKm styr gränsen', () => {
        // Södra Gotland (Burgsvik): ~50 km från Visby, allt annat är hav.
        expect(nearestCityPage(57.19, 18.30)?.slug).toBe('visby');
        expect(nearestCityPage(57.19, 18.30, 40)).toBeNull();
        expect(CITY_PAGE_MAX_KM).toBe(60);
    });

    it('ogiltig punkt → null', () => {
        expect(nearestCityPage(NaN, 18)).toBeNull();
        expect(nearestCityPage(59, Infinity)).toBeNull();
    });
});
