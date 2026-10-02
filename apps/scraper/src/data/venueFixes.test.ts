import { describe, it, expect } from 'vitest';
import { matchVenueFix, applyVenueFixInPlace, VENUE_FIXES, type VenueFix } from './venueFixes';

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

describe('applyVenueFixInPlace', () => {
    const fixes: VenueFix[] = [{ names: ['Testhallen'], city: 'Piteå', lat: 65.32058, lng: 21.47594, note: 'test' }];

    it('tvingar verifierade koordinater över källans', () => {
        const e = { locationName: 'Testhallen', lat: 65.2523, lng: 21.2211 };
        expect(applyVenueFixInPlace(e, fixes)).toBe(true);
        expect(e).toMatchObject({ lat: 65.32058, lng: 21.47594, isLocationVerified: true, geoPrecision: 'poi' });
    });

    it('rör inte event utan träff — även utan koordinater', () => {
        const e = { locationName: 'Annan plats', lat: 1, lng: 2 };
        expect(applyVenueFixInPlace(e, fixes)).toBe(false);
        expect(e).toMatchObject({ lat: 1, lng: 2 });
        expect(applyVenueFixInPlace({ locationName: null }, fixes)).toBe(false);
    });

    it('sätter koordinater även när eventet saknar dem (källa utan geo)', () => {
        const e: { locationName: string; lat?: number; lng?: number } = { locationName: 'testhallen ' };
        expect(applyVenueFixInPlace(e, fixes)).toBe(true);
        expect(e.lat).toBe(65.32058);
    });
});

describe('Umeå-husen i venueFixes (FB-kritiken 30/9)', () => {
    it('Ordenshusets FB- och Tickster-namn landar på Skolgatan 48', () => {
        for (const name of ['Ordenshuset Umeå', 'Ordenshuset, Umeå']) {
            expect(matchVenueFix(name)?.city, name).toBe('Umeå');
        }
    });

    it('bara "Ordenshuset" matchar inte — namnet finns i flera orter', () => {
        expect(matchVenueFix('Ordenshuset')).toBeNull();
        expect(matchVenueFix('Ordenshuset, Fjärde Tvärgatan 12, Skutskär')).toBeNull();
    });

    it('Ersboda Folkets Hus i båda stavningarna', () => {
        for (const name of ['Ersboda Folkets Hus', 'Ersboda Folketshus']) {
            expect(matchVenueFix(name)?.lat, name).toBeCloseTo(63.8578, 3);
        }
    });
});

describe('hockeyarenorna i venueFixes (0,0-matcherna 28/9)', () => {
    // Exakt de namn swehockey/sportality levererade och som låg på 0,0.
    const ZERO_ZERO: Record<string, string> = {
        'Be-Ge Hockey Center': 'Oskarshamn',
        'Gränby Ishallar A-hall': 'Uppsala',
        'Wibe Arena': 'Mora',
        'Coop Norrbotten Arena': 'Luleå',
        'VBO Arena': 'Vimmerby',
        'Hägglunds Arena': 'Örnsköldsvik',
        'Hatstore Arena': 'Kalmar',
        'Visby Ishall': 'Visby',
        'Enebybergs Ishall': 'Danderyd',
        'Östersund Arena Hall A': 'Östersund',
        // HA-sajtens stavning av Almtunas hall.
        'Gränby ishall': 'Uppsala',
    };

    it('varje arena har en verifierad fix i rätt stad', () => {
        for (const [name, city] of Object.entries(ZERO_ZERO)) {
            expect(matchVenueFix(name)?.city, name).toBe(city);
        }
    });

    it('inget namn förekommer i två fixar (exakt matchning ska vara entydig)', () => {
        // Per fix dedupat: skiftlägesvarianter inom samma fix är ofarliga.
        const all = VENUE_FIXES.flatMap(f => [...new Set(f.names.map(n => n.trim().toLowerCase()))]);
        expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
    });
});

describe('Växjö/Linköping-granskningen i venueFixes (ägarrapport 2/10)', () => {
    it('domkyrkan, konserthuset och teatern landar på OSM-objekten', () => {
        expect(matchVenueFix('Växjö domkyrka, Växjö stads- och domkyrkoförsamling')?.lat).toBeCloseTo(56.8774, 4);
        expect(matchVenueFix('Växjö domkyrka')?.lng).toBeCloseTo(14.81213, 4);
        expect(matchVenueFix('Växjö Konserthus')?.lat).toBeCloseTo(56.8804, 4);
        expect(matchVenueFix('Växjö Teater')?.lng).toBeCloseTo(14.80348, 4);
        expect(matchVenueFix('Växjö teater')?.lng).toBeCloseTo(14.80348, 4);
        expect(matchVenueFix('Linköpings huvudbibliotek')?.city).toBe('Linköping');
        expect(matchVenueFix('Linköping Konsert & Kongress')?.lat).toBeCloseTo(58.41369, 4);
    });

    it('generiska namn matchar INTE — matchningen är stadsblind', () => {
        for (const generic of ['Domkyrkan', 'Konserthuset', 'Teatern', 'Palladium', 'Huvudbiblioteket',
            'Huvudbiblioteket, Scenen', 'Agora', 'Skylten', 'Filmstaden', 'Stadsbiblioteket', 'Spiris Arena']) {
            expect(matchVenueFix(generic), generic).toBeNull();
        }
        // Grannstädernas konserthus/K&K får aldrig sugas till Linköping/Växjö.
        expect(matchVenueFix('Jönköping Konsert & Kongress')).toBeNull();
        expect(matchVenueFix('Uppsala Konsert & Kongress')).toBeNull();
    });

    it('inget namn förekommer i två fixar (första träffen vinner annars tyst)', () => {
        // Dubbletter INOM en fix (skiftlägesvarianter) är ofarliga — samma punkt.
        const seen = new Map<string, number>();
        VENUE_FIXES.forEach((fix, i) => {
            for (const n of fix.names) {
                const k = n.trim().toLowerCase();
                const prev = seen.get(k);
                expect(prev === undefined || prev === i, `"${n}" finns redan i ${VENUE_FIXES[prev ?? 0].city}-fixen`).toBe(true);
                seen.set(k, i);
            }
        });
    });
});
