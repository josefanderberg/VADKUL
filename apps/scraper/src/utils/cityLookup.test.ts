import { describe, it, expect } from 'vitest';
describe('citySlugFor (stadssidornas lista i utils/cityPages.ts)', () => {
    it('hittar stadssidorna, inte 0 träffar (regressionen 3/11 2026)', async () => {
        const { citySlugFor, cityNameForSlug } = await import('./cityLookup');
        expect(citySlugFor('Göteborg')).toBe('goteborg');
        expect(citySlugFor('Växjö')).toBe('vaxjo');
        expect(cityNameForSlug('goteborg')).toBe('Göteborg');
        expect(citySlugFor('Hudiksvall')).toBeNull();
    });
});

describe('cityPages (kartbildernas mitt + folkmängd)', () => {
    it('alla stadssidor med cityPages.ts egna koordinater och folkmängd', async () => {
        const { cityPages, cityPageFor, citySlugFor } = await import('./cityLookup');
        const sidor = cityPages();
        expect(sidor.length).toBeGreaterThanOrEqual(60);
        // Samma lista som slugarna (formatet får inte tappa en stad).
        for (const s of sidor) expect(citySlugFor(s.name)).toBe(s.slug);
        expect(sidor.every(s => s.lat > 55 && s.lat < 69 && s.lng > 10 && s.lng < 25)).toBe(true);
        expect(sidor.every(s => (s.population ?? 0) > 0)).toBe(true);
        expect(cityPageFor('göteborg')).toMatchObject({ slug: 'goteborg', lat: 57.71, lng: 11.97 });
        expect(cityPageFor('Hudiksvall')).toBeNull();
    });
});
