import { describe, it, expect } from 'vitest';
import { postalTown, placeFromLines } from './swedishAddress';

describe('postalTown', () => {
    it('ort efter postnummer, med eller utan mellanslag', () => {
        expect(postalTown('Vemdalsskalet Nya landsvägen 50, 846 94 Vemdalen')).toBe('Vemdalen');
        expect(postalTown('79160 Falun')).toBe('Falun');
        expect(postalTown('SE-846 94 Vemdalen')).toBe('Vemdalen');
    });

    it('postens versaler normaliseras, blandat skiftläge lämnas', () => {
        expect(postalTown('906 27  UMEÅ')).toBe('Umeå');
        expect(postalTown('660 10 DALS-ED')).toBe('Dals-Ed');
        expect(postalTown('194 30 Upplands Väsby')).toBe('Upplands Väsby');
    });

    it('stannar vid punkt och komma', () => {
        expect(postalTown('55322 Jönköping.')).toBe('Jönköping');
        expect(postalTown('702 28 Örebro, Jubileum, kulturarv')).toBe('Örebro');
    });

    it('inget postnummer → null; telefonnummer räknas inte', () => {
        expect(postalTown('Stadsgårdsterminalen')).toBeNull();
        expect(postalTown('Telefon: 0684-151 30')).toBeNull();
        expect(postalTown(undefined)).toBeNull();
    });
});

describe('placeFromLines (NBV:s eventkort)', () => {
    it('venue + gata, postort på egen rad', () => {
        expect(placeFromLines(['Ersboda Folkets Hus, Byttgränd 13', '906 27  UMEÅ'])).toEqual({
            venueName: 'Ersboda Folkets Hus',
            address: 'Ersboda Folkets Hus, Byttgränd 13',
            city: 'Umeå',
        });
    });

    it('bara gata + postort → gatan blir platsnamnet', () => {
        expect(placeFromLines(['Källgatan 11', '826 30 Söderhamn'])).toEqual({ venueName: 'Källgatan 11', city: 'Söderhamn' });
    });

    it('postnumret på samma rad som gatan hör inte till adressen', () => {
        expect(placeFromLines(['Adolf Mörners plan 2, 702 28 Örebro', '702 28 Örebro, Jubileum'])).toEqual({ venueName: 'Adolf Mörners plan 2', city: 'Örebro' });
    });

    it('online och platshållare ger ingen plats', () => {
        expect(placeFromLines(['Online'])).toEqual({});
        expect(placeFromLines(['Digitalt, skrivande i kursen görs på svenska'])).toEqual({});
        expect(placeFromLines(['Södra Sverige- exakt plats och tid uppdateras senare'])).toEqual({});
        expect(placeFromLines(['Se din stad nedan:'])).toEqual({});   // turné, orterna i texten
    });

    it('utan postort: venue behålls men ingen adress, och ingen ensam gatuadress', () => {
        expect(placeFromLines(['Stadsgårdsterminalen'])).toEqual({ venueName: 'Stadsgårdsterminalen' });
        expect(placeFromLines(['Ordenshuset, Skolgatan 48'])).toEqual({ venueName: 'Ordenshuset' });
        expect(placeFromLines(['Nygatan 38, Kulurpalatset, Ingång C'])).toEqual({});
    });

    it('tomma rader och blanksteg städas', () => {
        expect(placeFromLines(['  ', ' Stadsgårdsterminalen \n', '11645   Stockholm'])).toEqual({ venueName: 'Stadsgårdsterminalen', city: 'Stockholm' });
        expect(placeFromLines([])).toEqual({});
    });
});
