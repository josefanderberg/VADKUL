/**
 * Rena hjälpare i geokodningskedjan (24/8 — Växjö-granskningen):
 * församlings-strippning, suffixkedjan, första-ords-orten och gata/poi-
 * klassningen. Ingen nätverks-I/O — Nominatim-vägarna testas inte här.
 */
import { describe, it, expect } from 'vitest';
import {
    stripParishSegments, suffixQueries, firstWordPlaceQuery, classifyQueryPrecision,
} from './venueCoordinates';

describe('stripParishSegments', () => {
    it('stryker församlingssegmentet som fick Nominatim att missa domkyrkan', () => {
        expect(stripParishSegments('Växjö domkyrka, Växjö stads- och domkyrkoförsamling'))
            .toBe('Växjö domkyrka');
    });

    it('stryker pastorat men behåller venue + stad', () => {
        expect(stripParishSegments('Sövde kyrka, Sövde pastorat, Sjöbo'))
            .toBe('Sövde kyrka, Sjöbo');
    });

    it('rör INTE församlingsHEM/-GÅRD — de är riktiga hus', () => {
        expect(stripParishSegments('Johanneskyrkans församlingshem, Växjö'))
            .toBe('Johanneskyrkans församlingshem, Växjö');
        expect(stripParishSegments('Sundborns församlingsgård, Falun'))
            .toBe('Sundborns församlingsgård, Falun');
    });

    it('behåller originalet när ALLT är församlingssegment (hellre brus än tomt)', () => {
        expect(stripParishSegments('Bodarne pastorat')).toBe('Bodarne pastorat');
    });
});

describe('suffixQueries', () => {
    it('mellansegmenten kommer före kommunhuvudorten (VAIS-torpet-fallet)', () => {
        expect(suffixQueries('VAIS-torpet, Fylleryd, Växjö'))
            .toEqual(['Fylleryd, Växjö', 'Växjö']);
    });

    it('tvåsegmentsfråga ger bara sista delen', () => {
        expect(suffixQueries('Tallgårdens bibliotek, Växjö')).toEqual(['Växjö']);
    });

    it('utan komma finns inget att falla tillbaka på', () => {
        expect(suffixQueries('Växjödyksport')).toEqual([]);
    });
});

describe('firstWordPlaceQuery', () => {
    it('första ordet blir ortskandidat ("Gemla bibliotek" → "Gemla, Växjö")', () => {
        expect(firstWordPlaceQuery('Gemla bibliotek', 'Växjö')).toBe('Gemla, Växjö');
    });

    it('adjektiv-stopplistan blockerar ("Stora Teatern" ska inte ge "Stora, X")', () => {
        expect(firstWordPlaceQuery('Stora Teatern', 'Göteborg')).toBeNull();
        expect(firstWordPlaceQuery('Gamla Torshälla', 'Eskilstuna')).toBeNull();
    });

    it('enordsnamn, korta ord och stadens eget namn ger null', () => {
        expect(firstWordPlaceQuery('Konserthuset', 'Växjö')).toBeNull();
        expect(firstWordPlaceQuery('Bio Roy', 'Göteborg')).toBeNull();
        expect(firstWordPlaceQuery('Växjö domkyrka', 'Växjö')).toBeNull();
    });

    it('bara huvudsegmentet används, inte adress-svansen', () => {
        expect(firstWordPlaceQuery('Rottne bibliotek, Storgatan 3', 'Växjö')).toBe('Rottne, Växjö');
    });
});

describe('classifyQueryPrecision', () => {
    it('gatuadresser klassas som gata', () => {
        expect(classifyQueryPrecision('Storgatan 12, Växjö')).toBe('gata');
        expect(classifyQueryPrecision('Kaplansgatan 14, Orsa')).toBe('gata');
    });

    it('platsnamn utan husnummer klassas som poi', () => {
        expect(classifyQueryPrecision('Tallgårdens bibliotek, Växjö')).toBe('poi');
        expect(classifyQueryPrecision('Vida Arena')).toBe('poi');
    });
});
