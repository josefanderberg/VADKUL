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
