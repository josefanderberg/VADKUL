/**
 * Tester för gatuadress-extraktionen ur fritext.
 */
import { describe, it, expect } from 'vitest';
import { extractStreetAddress } from './swedishAddress';

describe('extractStreetAddress', () => {
    it('plockar sammansatta gatunamn', () => {
        expect(extractStreetAddress('Ligger på Gävlevägen 24 i Skutskär')).toBe('Gävlevägen 24');
        expect(extractStreetAddress('Kungsträdgårdsgatan 8B')).toBe('Kungsträdgårdsgatan 8B');
    });

    it('plockar fristående vägord efter namnord', () => {
        expect(extractStreetAddress('Hilding Hjelmbergs väg 5')).toBe('Hilding Hjelmbergs väg 5');
    });

    it('avvisar vägnummer i löptext', () => {
        expect(extractStreetAddress('Följ väg 23 norrut')).toBeNull();
    });

    it('avvisar biljettinformation som råkar matcha mönstret', () => {
        // "Biljettpris På plats 150" — två namnord + platsord + nummer
        expect(extractStreetAddress('Biljettpris På plats 150 kr')).toBeNull();
        expect(extractStreetAddress('Entré vid plats 40')).toBeNull();
    });

    it('returnerar null utan träff', () => {
        expect(extractStreetAddress('Ingen adress alls här')).toBeNull();
        expect(extractStreetAddress(null)).toBeNull();
    });
});
