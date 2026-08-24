/**
 * Rena hjälpare i geokodningskedjan (24/8 — Växjö-granskningen):
 * församlings-strippning, suffixkedjan, första-ords-orten och gata/poi-
 * klassningen. Ingen nätverks-I/O — Nominatim-vägarna testas inte här.
 */
import { describe, it, expect } from 'vitest';
import {
    stripParishSegments, suffixQueries, firstWordPlaceQuery, classifyQueryPrecision,
} from './venueCoordinates';
import { isGenericLookupName, lookupVenueSmart, upsertKnownVenue } from './sqliteHelper';

describe('lookupVenueSmart utan stadskontext (Malmö Seriefest-incidenten)', () => {
    it('generiska namn matchar ALDRIG utan stad, även om tabellen har exakt en rad', () => {
        upsertKnownVenue('Folkets Park', 56.883, 14.803, 'Växjö');
        expect(lookupVenueSmart('Folkets Park')).toBeNull();          // kapningen som flyttade Malmö-eventet till Växjö
        expect(lookupVenueSmart('Folkets Park', 'Växjö')).toEqual([56.883, 14.803]);  // med rätt stad ok
        expect(lookupVenueSmart('Folkets Park', 'Malmö')).toBeNull(); // fel stad → Nominatim får avgöra
    });

    it('specifika unika namn matchar även utan stad', () => {
        upsertKnownVenue('Tallgårdens bibliotek', 56.86, 14.82, 'Växjö');
        expect(lookupVenueSmart('Tallgårdens bibliotek')).toEqual([56.86, 14.82]);
    });

    it('isGenericLookupName känner igen rikstäckande namn', () => {
        for (const n of ['Folkets Park', 'folkets hus', 'Stortorget', 'Konserthuset', 'Nöjesfabriken', 'Domkyrkan']) {
            expect(isGenericLookupName(n), n).toBe(true);
        }
        expect(isGenericLookupName('Tallgårdens bibliotek')).toBe(false);
        expect(isGenericLookupName('Vida Arena')).toBe(false);
    });
});

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
