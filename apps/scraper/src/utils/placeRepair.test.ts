import { describe, it, expect } from 'vitest';
import { deriveTownForRow, venueWithoutTown, decideMove } from './placeRepair';

const TOWNS = new Set(['falkenberg', 'storfors', 'arvika', 'karlstad', 'säffle', 'lund', 'umeå', 'östersund', 'övertorneå', 'delsbo', 'hallen']);
const isPlace = (s: string) => TOWNS.has(s.toLowerCase());
const postalTownOf = (s: string) => s.match(/\d{3}\s?\d{2}\s+([A-ZÅÄÖ][a-zåäö]+)/)?.[1] ?? null;
const km = (a: number, b: number, c: number, d: number) => Math.hypot(a - c, (b - d) * 0.5) * 111;

describe('deriveTownForRow (#247)', () => {
    it('lokalen, postorten, lokalens sista segment, sist den sparade frågan', () => {
        expect(deriveTownForRow('Övertorneå', 'Övertorneå', null, isPlace, postalTownOf))
            .toEqual({ town: 'Övertorneå', source: 'lokalen' });
        expect(deriveTownForRow('Finngatan 2D, SE-824 71 Delsbo, Sverige', 'x', null, isPlace, postalTownOf))
            .toEqual({ town: 'Delsbo', source: 'postort' });
        expect(deriveTownForRow('Ätrans bibliotek, Falkenberg', 'Falkenberg', null, isPlace, postalTownOf))
            .toEqual({ town: 'Falkenberg', source: 'lokalen' });
        expect(deriveTownForRow('Kino 2', 'Kino 2, Lund', null, isPlace, postalTownOf))
            .toEqual({ town: 'Lund', source: 'sparad-fråga' });
        expect(deriveTownForRow('Teaterbistron', 'stad: Östersund', null, isPlace, postalTownOf))
            .toEqual({ town: 'Östersund', source: 'sparad-fråga' });
        expect(deriveTownForRow('Någonstans', 'Storgatan 4', null, isPlace, postalTownOf)).toBeNull();
    });

    it('ortnamn mitt i lokalnamnet räknas inte ("KvB Hallen" ligger inte i Hallen)', () => {
        expect(deriveTownForRow('KvB Hallen', 'KvB Hallen, Umeå', null, isPlace, postalTownOf))
            .toEqual({ town: 'Umeå', source: 'sparad-fråga' });
    });

    it('venueWithoutTown stryker avslutande ortsegment', () => {
        expect(venueWithoutTown('Idun, Umeå Folkets Hus, Umeå', 'Umeå')).toBe('Idun, Umeå Folkets Hus');
        expect(venueWithoutTown('Umeå', 'Umeå')).toBe('Umeå');
    });
});

describe('decideMove (#247)', () => {
    const base = { storedLabelWrong: false, storedConflict: false, townSource: 'bibliotekets-ort' as const, distanceKm: km };

    it('Storfors i Arvika: annan ort när orten kommer ur lokalnamnet', () => {
        const stored = { lat: 59.6544, lng: 12.5916, precision: 'ort-centroid' };
        expect(decideMove({ ...base, stored, best: [59.5347, 14.2752, 'stad-centroid'] })).toBe('annan-ort');
        expect(decideMove({ ...base, townSource: 'sparad-fråga', stored, best: [59.5347, 14.2752, 'stad-centroid'] })).toBeNull();
    });

    it('lokal hittad: flytt; samma mittpunkt: inget; fel märkning: märkning', () => {
        const stored = { lat: 63.1794, lng: 14.6357, precision: 'stad-centroid' };
        expect(decideMove({ ...base, stored, best: [63.18, 14.64, 'poi'] })).toBe('flytt');
        expect(decideMove({ ...base, stored, best: [63.1794, 14.6357, 'stad-centroid'] })).toBeNull();
        expect(decideMove({ ...base, storedLabelWrong: true, stored, best: [63.1794, 14.6357, 'stad-centroid'] })).toBe('märkning');
        expect(decideMove({ ...base, stored, best: null })).toBeNull();
    });

    it('registerkonflikt: den sparade lokalträffen räknas inte', () => {
        const stored = { lat: 64.9112, lng: 19.4813, precision: 'poi' };
        expect(decideMove({ ...base, storedConflict: true, stored, best: [65.1872, 18.742, 'stad-centroid'] })).toBe('register-konflikt');
        expect(decideMove({ ...base, stored, best: [65.1872, 18.742, 'stad-centroid'] })).toBeNull();
    });
});
