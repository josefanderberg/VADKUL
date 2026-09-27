import { describe, it, expect } from 'vitest';
import { matchVenueFix, applyVenueFixInPlace, VENUE_FIXES } from './venueFixes';

// Webbens exemplar är SPEGLAT från apps/scraper/src/data/venueFixes.ts —
// testet låser samma regler så speglarna inte glider isär i beteende.
describe('venueFixes (webbspegeln)', () => {
    it('matchar exakt, aldrig substring', () => {
        expect(matchVenueFix('Saga - Bio 3:an')?.city).toBe('Piteå');
        expect(matchVenueFix('  saga - bio 3:AN ')?.city).toBe('Piteå');
        expect(matchVenueFix('Sagabiografen Boden')).toBeNull();
        expect(matchVenueFix(null)).toBeNull();
    });

    it('tvingar verifierade koordinater över felaktiga', () => {
        const e = { locationName: 'Saga - Bio 3:an', lat: 65.2523, lng: 21.2211 };
        expect(applyVenueFixInPlace(e)).toBe(true);
        expect(e.lat).toBe(65.32058);
        expect(e.lng).toBe(21.47594);
        expect(applyVenueFixInPlace({ locationName: 'Annan plats' })).toBe(false);
    });

    it('Väven hör hemma i Umeå (Skönsmon-rapporten 25/9)', () => {
        // "Väven" ur Sundsvalls-kön geokodades till en namne i Sundsvall —
        // läsvakten ska flytta hem den tills pipelinens data är läkt.
        const e = { locationName: 'Väven', lat: 62.4066957, lng: 17.3347606 };
        expect(applyVenueFixInPlace(e)).toBe(true);
        expect(e.lat).toBe(63.8256568);
        expect(e.lng).toBe(20.2630745);
        expect(matchVenueFix('Program i Väven')?.city).toBe('Umeå');
        // Exakt matchning: scennamnen med egna (korrekta) koordinater berörs inte.
        expect(matchVenueFix('Vävenscenen')).toBeNull();
        expect(matchVenueFix('Kajen, Väven')).toBeNull();
    });

    it('skarpa listan ligger i Sverige med ifyllda fält', () => {
        for (const f of VENUE_FIXES) {
            expect(f.names.length).toBeGreaterThan(0);
            expect(f.lat).toBeGreaterThan(55);
            expect(f.lat).toBeLessThan(69.5);
            expect(f.lng).toBeGreaterThan(10.5);
            expect(f.lng).toBeLessThan(24.6);
            expect(f.city.length).toBeGreaterThan(0);
        }
    });
});
