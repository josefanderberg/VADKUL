import { describe, it, expect } from 'vitest';
import { normalizePriceLabel } from './priceLabel';

describe('normalizePriceLabel', () => {
    it('tomt/saknat pris → null (chip döljs)', () => {
        expect(normalizePriceLabel(undefined)).toBeNull();
        expect(normalizePriceLabel(null)).toBeNull();
        expect(normalizePriceLabel('')).toBeNull();
        expect(normalizePriceLabel('   ')).toBeNull();
    });

    it('gratis-varianter → "Gratis" (inkl. källornas typo)', () => {
        expect(normalizePriceLabel('Gratis')).toBe('Gratis');
        expect(normalizePriceLabel('fri entré')).toBe('Gratis');
        expect(normalizePriceLabel('Fri entre')).toBe('Gratis');
        expect(normalizePriceLabel('Avgiftsfritt')).toBe('Gratis');
        expect(normalizePriceLabel('kostnadsfritt')).toBe('Gratis');
        expect(normalizePriceLabel('konstnadsfritt')).toBe('Gratis'); // vanlig typo i källorna
        expect(normalizePriceLabel('free')).toBe('Gratis');
        expect(normalizePriceLabel(0)).toBe('Gratis');
        expect(normalizePriceLabel('0')).toBe('Gratis');
    });

    it('svensk valutanotation normaliseras till "N kr"', () => {
        expect(normalizePriceLabel('160:-')).toBe('160 kr');
        expect(normalizePriceLabel('30kr')).toBe('30 kr');
        expect(normalizePriceLabel('40 SEK')).toBe('40 kr');
        expect(normalizePriceLabel('695 kr')).toBe('695 kr');
        expect(normalizePriceLabel(120)).toBe('120 kr');
    });

    it('intervall och decimaler behålls', () => {
        expect(normalizePriceLabel('20-50')).toBe('20-50 kr');
        expect(normalizePriceLabel('12,50')).toBe('12,50 kr');
    });

    it('oigenkännlig text lämnas orörd', () => {
        expect(normalizePriceLabel('Medlemmar halva priset')).toBe('Medlemmar halva priset');
    });
});
