import { describe, it, expect } from 'vitest';
import { countsSentence } from './cityData';

describe('countsSentence — sifferfrasen i Googles utdrag', () => {
    it('tar med alla tre i ordningen idag, helgen, veckan', () => {
        // Ägarbeslut 20/8: helgen kvar (egen sökfras), veckotalet EFTER.
        expect(countsSentence(9, 8, 53)).toBe(' 9 idag, 8 i helgen, 53 i veckan.');
    });

    it('utelämnar nolltal — "0 i helgen" säljer ingenting i ett sökresultat', () => {
        expect(countsSentence(0, 8, 53)).toBe(' 8 i helgen, 53 i veckan.');
        expect(countsSentence(9, 0, 53)).toBe(' 9 idag, 53 i veckan.');
    });

    it('tar bara med veckotalet när det säger något nytt', () => {
        // Allt som händer i veckan händer idag → "3 idag, 3 i veckan" vore dumt.
        expect(countsSentence(3, 0, 3)).toBe(' 3 idag.');
        // Allt i veckan ligger på helgen.
        expect(countsSentence(0, 5, 5)).toBe(' 5 i helgen.');
        // Ett enda extra event i veckan räcker för att talet ska bära info.
        expect(countsSentence(3, 0, 4)).toBe(' 3 idag, 4 i veckan.');
    });

    it('ger tom sträng när ingenting finns — då hoppas frasen över helt', () => {
        expect(countsSentence(0, 0, 0)).toBe('');
    });

    it('inleds med mellanslag så den kan limmas direkt efter en punkt', () => {
        const s = countsSentence(9, 8, 53);
        expect(s.startsWith(' ')).toBe(true);
        expect(`Text.${s} Mer text.`).toBe('Text. 9 idag, 8 i helgen, 53 i veckan. Mer text.');
    });

    it('håller sig kort — hela beskrivningen ska rymmas i Googles ~155 tecken', () => {
        // Värsta rimliga fallet: fyrsiffriga tal i alla tre positionerna.
        expect(countsSentence(9999, 9999, 99999).length).toBeLessThan(45);
    });
});
