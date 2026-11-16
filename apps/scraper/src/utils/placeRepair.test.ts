import { describe, it, expect } from 'vitest';
import { deriveTownForRow, venueWithoutTown, decideMove } from './placeRepair';

const TOWNS = new Set(['falkenberg', 'storfors', 'arvika', 'karlstad', 'säffle', 'lund', 'umeå', 'östersund']);
const isPlace = (s: string) => TOWNS.has(s.toLowerCase());
const townInText = (s: string) => {
    const hit = [...TOWNS].find(t => new RegExp(`(^|[^\\p{L}])${t}s?([^\\p{L}]|$)`, 'iu').test(s));
    return hit ? hit[0].toUpperCase() + hit.slice(1) : null;
};
const km = (a: number, b: number, c: number, d: number) => Math.hypot(a - c, (b - d) * 0.5) * 111;

describe('deriveTownForRow (#247)', () => {
    it('lokalens sista segment, sedan orten i namnet, sist den sparade frågan', () => {
        expect(deriveTownForRow('Ätrans bibliotek, Falkenberg', 'Falkenberg', townInText, isPlace))
            .toEqual({ town: 'Falkenberg', source: 'lokalens-sista-segment' });
        expect(deriveTownForRow('Storfors bibliotek', 'Storfors bibliotek, Arvika', townInText, isPlace))
            .toEqual({ town: 'Storfors', source: 'ort-i-lokalnamnet' });
        expect(deriveTownForRow('Skaparverkstan i Karlstad', 'Skaparverkstan i Karlstad, Säffle', townInText, isPlace))
            .toEqual({ town: 'Karlstad', source: 'ort-i-lokalnamnet' });
        expect(deriveTownForRow('Kino 2', 'Kino 2, Lund', townInText, isPlace))
            .toEqual({ town: 'Lund', source: 'sparad-fråga' });
        expect(deriveTownForRow('Teaterbistron', 'stad: Östersund', townInText, isPlace))
            .toEqual({ town: 'Östersund', source: 'sparad-fråga' });
        expect(deriveTownForRow('Någonstans', 'Storgatan 4', townInText, isPlace)).toBeNull();
    });

    it('venueWithoutTown stryker avslutande ortsegment', () => {
        expect(venueWithoutTown('Idun, Umeå Folkets Hus, Umeå', 'Umeå')).toBe('Idun, Umeå Folkets Hus');
        expect(venueWithoutTown('Umeå', 'Umeå')).toBe('Umeå');
    });
});

describe('decideMove (#247)', () => {
    const base = { storedLabelWrong: false, storedConflict: false, townSource: 'ort-i-lokalnamnet' as const, distanceKm: km };

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
