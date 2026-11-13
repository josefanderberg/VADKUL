import { describe, it, expect } from 'vitest';
import { CITIES as CITY_PAGES } from './cityPages';
import { CITIES, getCity, haversineKm } from '@/lib/cityUtils';
import { CITY_POINTS } from './cityPoints';

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

/**
 * Varje ort med stadssida ska gå att SÖKA fram i kartan och appen (kontraktets
 * CITY_POINTS, 291 orter). Ticket #175: Hudiksvall misstänktes saknas - testet
 * håller listorna ihop så att nästa stadssida inte glider ur söket.
 */
describe('stadssidorna finns i stadssöket (kontraktets CITY_POINTS)', () => {
    it('varje stadssida har en sökbar ort med samma namn', () => {
        const names = new Set(CITY_POINTS.map(c => c.name));
        const missing = CITY_PAGES.filter(p => !names.has(p.name)).map(p => p.name);
        expect(missing).toEqual([]);
    });

    it('sökortens centrum ligger där stadssidans gör (söket landar kartan på samma ort)', () => {
        for (const p of CITY_PAGES) {
            const c = CITY_POINTS.find(x => x.name === p.name);
            if (!c) continue; // fångas av testet ovan
            expect(haversineKm(p.lat, p.lng, c.lat, c.lng), p.slug).toBeLessThan(3);
        }
    });
});
