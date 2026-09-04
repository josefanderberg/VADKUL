import { describe, it, expect } from 'vitest';
import { matchVenueFix, VENUE_FIXES, type VenueFix } from './venueFixes';

const FIXES: VenueFix[] = [{
    names: ['Saga - Bio 3:an', 'Bio 3:an'],
    city: 'Piteå', lat: 65.32058, lng: 21.47594, note: 'test',
}];

describe('matchVenueFix', () => {
    it('matchar exakt, trim + case-okänsligt', () => {
        expect(matchVenueFix('Saga - Bio 3:an', FIXES)?.city).toBe('Piteå');
        expect(matchVenueFix('  saga - bio 3:AN ', FIXES)?.city).toBe('Piteå');
        expect(matchVenueFix('Bio 3:an', FIXES)?.lat).toBe(65.32058);
    });

    it('ALDRIG substring — landets alla Saga-biografer ska inte sugas in', () => {
        expect(matchVenueFix('Saga', FIXES)).toBeNull();
        expect(matchVenueFix('Sagabiografen Boden', FIXES)).toBeNull();
        expect(matchVenueFix('Saga - Bio 3:an, Piteå', FIXES)).toBeNull();
        expect(matchVenueFix('', FIXES)).toBeNull();
        expect(matchVenueFix(null, FIXES)).toBeNull();
    });

    it('skarpa listan: giltiga koordinater i Sverige och ifyllda fält', () => {
        for (const fix of VENUE_FIXES) {
            expect(fix.names.length).toBeGreaterThan(0);
            expect(fix.lat).toBeGreaterThan(55); expect(fix.lat).toBeLessThan(70);
            expect(fix.lng).toBeGreaterThan(10); expect(fix.lng).toBeLessThan(25);
            expect(fix.city).toBeTruthy();
            expect(fix.note).toBeTruthy();
        }
    });
});
