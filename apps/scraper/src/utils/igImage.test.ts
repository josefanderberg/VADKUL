import { describe, it, expect } from 'vitest';
import { safeStorageKey } from './igImage';

describe('safeStorageKey', () => {
    it('translittererar åäö — Nyköping 2/9 föll på ett rått ö i bild-URL:en', () => {
        expect(safeStorageKey('nyköping-2026-09-02-07')).toBe('nykoping-2026-09-02-07');
        expect(safeStorageKey('Västerås-2026-09-05-06')).toBe('vasteras-2026-09-05-06');
        expect(safeStorageKey('Åmål-2026-09-03-08')).toBe('amal-2026-09-03-08');
    });

    it('lämnar ren ASCII orörd', () => {
        expect(safeStorageKey('landskrona-2026-09-02-06')).toBe('landskrona-2026-09-02-06');
        expect(safeStorageKey('provkor-landskrona')).toBe('provkor-landskrona');
    });

    it('ersätter mellanslag och annat skräp med ett bindestreck, aldrig tomt', () => {
        expect(safeStorageKey('Västra Frölunda-2026-08-31-06')).toBe('vastra-frolunda-2026-08-31-06');
        expect(safeStorageKey('Åkers styckebruk--2026-09-01-08')).toBe('akers-styckebruk-2026-09-01-08');
        expect(safeStorageKey('---')).toBe('bild');
    });
});
