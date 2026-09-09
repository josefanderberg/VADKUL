import { describe, it, expect } from 'vitest';
import { matchTatortInText, namesEligibleForScan } from './sqliteHelper';

// Utsnitt ur SCB-registret — testet ska inte bero på DB-innehåll.
const REGISTER = namesEligibleForScan([
    'Töreboda', 'Skurup', 'Mariestad', 'Haninge', 'Västerhaninge', 'Lund',
    'Gustavsberg', 'Vi', 'Vad', 'Bara', 'Ås', 'kyrkan', 'Tranås',
]);

describe('namesEligibleForScan', () => {
    it('slänger namn under fem tecken och stoppord', () => {
        expect(REGISTER).not.toContain('Vi');
        expect(REGISTER).not.toContain('Vad');
        expect(REGISTER).not.toContain('Bara');
        expect(REGISTER).not.toContain('Ås');
        expect(REGISTER).not.toContain('kyrkan');
    });

    it('sorterar längsta först så Västerhaninge slår Haninge', () => {
        expect(REGISTER.indexOf('Västerhaninge')).toBeLessThan(REGISTER.indexOf('Haninge'));
    });
});

describe('matchTatortInText', () => {
    it('hittar orten efter "i" (paraply-källornas vanligaste form)', () => {
        expect(matchTatortInText('Naturskyddsföreningen i Töreboda', REGISTER)).toBe('Töreboda');
    });

    it('hittar orten sist i strängen', () => {
        expect(matchTatortInText('Naturskyddsföreningen Skurup', REGISTER)).toBe('Skurup');
    });

    it('klarar genitiv-s', () => {
        expect(matchTatortInText('Mariestads Naturskyddsförening', REGISTER)).toBe('Mariestad');
    });

    it('väljer LÄNGSTA orten, inte den som står först', () => {
        expect(matchTatortInText('Tingshuset i Västerhaninge, Naturskyddsföreningen i Haninge', REGISTER))
            .toBe('Västerhaninge');
    });

    it('kräver ordgräns — matchar inte inuti ett ord', () => {
        expect(matchTatortInText('Lundgrensgatan 4', REGISTER)).toBeNull();
        expect(matchTatortInText('Tranåsvägen 12', REGISTER)).toBeNull();
    });

    it('matchar inte vanliga ord som råkar vara ortnamn', () => {
        expect(matchTatortInText('Vi ses i kyrkan', REGISTER)).toBeNull();
        expect(matchTatortInText('Vad händer sen', REGISTER)).toBeNull();
        expect(matchTatortInText('Endast bara för medlemmar', REGISTER)).toBeNull();
    });

    it('ger null för strängar utan ortnamn', () => {
        expect(matchTatortInText('Svenska Naturskyddsföreningen', REGISTER)).toBeNull();
        expect(matchTatortInText('', REGISTER)).toBeNull();
    });
});
