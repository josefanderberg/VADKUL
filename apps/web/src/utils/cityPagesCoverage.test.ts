import { describe, it, expect } from 'vitest';
import { CITIES as CITY_PAGES } from './cityPages';
import { CITIES, getCity, haversineKm } from '@/lib/cityUtils';

/**
 * Varje ort med stadssida ska gå att välja som "din stad" (registreringen +
 * profilen). Listorna gled isär — Tranås hade stadssida men saknades i
 * ortvalet, och närmaste val låg 56 km bort medan helgtipset bara räknar
 * event inom 10 km (Tranås-kommentaren 30/9).
 */
describe('stadssidorna finns i ortvalet (kontraktets CITIES)', () => {
    it('varje stadssida har en ort med samma slug och namn', () => {
        const missing = CITY_PAGES.filter(p => getCity(p.slug)?.name !== p.name).map(p => p.slug);
        expect(missing).toEqual([]);
    });

    it('ortvalets centrum ligger där stadssidans gör (helgtipset och sidan räknar 10 km från samma punkt)', () => {
        for (const p of CITY_PAGES) {
            const c = getCity(p.slug)!;
            expect(haversineKm(p.lat, p.lng, c.lat, c.lng), p.slug).toBeLessThan(3);
        }
    });

    it('ortvalet har unika slugs', () => {
        expect(new Set(CITIES.map(c => c.slug)).size).toBe(CITIES.length);
    });
});
