/**
 * Rena hjälpare i geokodningskedjan (24/8 — Växjö-granskningen):
 * församlings-strippning, suffixkedjan, första-ords-orten och gata/poi-
 * klassningen. Ingen nätverks-I/O — Nominatim-vägarna testas inte här.
 */
import { describe, it, expect } from 'vitest';
import {
    stripParishSegments, suffixQueries, firstWordPlaceQuery, standaloneVenueQuery, classifyQueryPrecision, isForeignAddress,
    isCoarseSourceCoord, placeOnlyPrecision, isPlaceSegment, reconcileCityCentroid, isSettlementResult,
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

    it('stadens namn i genitiv är heller ingen by (Götabiblioteken 2/10)', () => {
        expect(firstWordPlaceQuery('Linköpings huvudbibliotek', 'Linköping')).toBeNull();
        expect(firstWordPlaceQuery('Växjös stadsbibliotek', 'Växjö')).toBeNull();
        // ...men en annan orts genitiv är fortfarande en kandidat
        expect(firstWordPlaceQuery('Borensbergs bibliotek', 'Linköping')).toBe('Borensbergs, Linköping');
    });

    it('bara huvudsegmentet används, inte adress-svansen', () => {
        expect(firstWordPlaceQuery('Rottne bibliotek, Storgatan 3', 'Växjö')).toBe('Rottne, Växjö');
    });
});

describe('standaloneVenueQuery (Oviken-fallet 2026-10-08)', () => {
    it('platsen i grannkommunen provas utan stadsankaret', () => {
        expect(standaloneVenueQuery('Ovikens gamla kyrka, Östersund', 'Östersund')).toBe('Ovikens gamla kyrka');
        expect(standaloneVenueQuery('Gemla bibliotek, Växjö', 'Växjö')).toBe('Gemla bibliotek');
    });

    it('generiska och stadens egna namn provas aldrig ensamma', () => {
        expect(standaloneVenueQuery('Stora kyrkan, Östersund', 'Östersund')).toBeNull();
        expect(standaloneVenueQuery('Folkets Hus, Östersund', 'Östersund')).toBeNull();
        expect(standaloneVenueQuery('Scandic Hotel, Östersund', 'Östersund')).toBeNull();
        expect(standaloneVenueQuery('Östersunds stadsbibliotek, Östersund', 'Östersund')).toBeNull();
        expect(standaloneVenueQuery('Storsjöteatern, Östersund', 'Östersund')).toBeNull();
    });

    it('bara "Plats, Stad": mellansegment och fel stad lämnas åt suffixkedjan', () => {
        expect(standaloneVenueQuery('VAIS-torpet, Fylleryd, Växjö', 'Växjö')).toBeNull();
        expect(standaloneVenueQuery('Ovikens gamla kyrka, Berg', 'Östersund')).toBeNull();
        expect(standaloneVenueQuery('Ovikens gamla kyrka', 'Östersund')).toBeNull();
    });
});

describe('deGenitiveFirstWord + overpassNameVariants (Tallgården-fallet)', () => {
    it('strippar genitiv-s ur första ordet', async () => {
        const { deGenitiveFirstWord } = await import('./venueCoordinates');
        expect(deGenitiveFirstWord('Ingelstads bibliotek')).toBe('Ingelstad bibliotek');
        expect(deGenitiveFirstWord('Lammhults bibliotek')).toBe('Lammhult bibliotek');
        expect(deGenitiveFirstWord('Braås bibliotek')).toBeNull();     // äkta -ås-ort
        expect(deGenitiveFirstWord('Konserthuset')).toBeNull();        // ett ord
        expect(deGenitiveFirstWord('Mora kyrka')).toBeNull();          // inget s
    });

    it('bygger varianterna full → av-genitiviserad → byggnadsnamn', async () => {
        const { overpassNameVariants } = await import('./overpassVenue');
        expect(overpassNameVariants('Tallgårdens bibliotek'))
            .toEqual(['Tallgårdens bibliotek', 'Tallgården bibliotek', 'Tallgården']);
        expect(overpassNameVariants('Gemla bibliotek'))
            .toEqual(['Gemla bibliotek', 'Gemla']);
        expect(overpassNameVariants('Vida Arena')).toEqual(['Vida Arena']);
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

describe('isForeignAddress', () => {
    it('känner igen FB:s svenska landsnamn (Salem 2026-09-11)', () => {
        expect(isForeignAddress('Salem, Amerikas förenta stater')).toBe(true);
        expect(isForeignAddress('West Salem, Amerikas förenta stater')).toBe(true);
        expect(isForeignAddress('Calea Giulesti 16, București, Rumänien')).toBe(true);
    });

    it('känner igen inhemska landsnamn, även med å/ä/ö först (Unicode-gräns)', () => {
        expect(isForeignAddress('Liège, Belgique')).toBe(true);
        expect(isForeignAddress('Dornbacherstraße 85, 1170 Wien, Österreich')).toBe(true);
        expect(isForeignAddress('Salzburg, österrike')).toBe(true);
    });

    it('rör inte svenska adresser eller grannländer', () => {
        expect(isForeignAddress('Pizzeria Italia, Storgatan 5, Sala')).toBe(false);
        expect(isForeignAddress('Eesti Maja, Wallingatan 32, Stockholm')).toBe(false);
        expect(isForeignAddress('Folkets Hus, Sala')).toBe(false);
        expect(isForeignAddress('Savoy Terrasse, Fredrikstad, Norge')).toBe(false);
    });
});

describe('isCoarseSourceCoord (#199: ortsmittpunkter från källan)', () => {
    it('exakta bågminuter i båda leden är en ortsmittpunkt', () => {
        expect(isCoarseSourceCoord(57.05, 14.316667)).toBe(true);      // Hestra vid Rydaholm (Värnamo-Cruncho)
        expect(isCoarseSourceCoord(56.733333, 13.116667)).toBe(true);  // Simlångsdalen
        expect(isCoarseSourceCoord(56.05, 12.7)).toBe(true);           // Helsingborg
        expect(isCoarseSourceCoord(55, 10)).toBe(true);
    });

    it('riktiga platskoordinater flaggas inte', () => {
        expect(isCoarseSourceCoord(57.0523419, 14.3171234)).toBe(false);
        expect(isCoarseSourceCoord(55.70742, 13.194263)).toBe(false);   // Edens Hörsal, Lund
        expect(isCoarseSourceCoord(57.05, 14.3171234)).toBe(false);     // bara ena ledet på rutnätet
    });

    it('null-ön och trasiga värden är inte grova (de hanteras på annat håll)', () => {
        expect(isCoarseSourceCoord(0, 0)).toBe(false);
        expect(isCoarseSourceCoord(NaN, 14)).toBe(false);
    });
});

describe('placeOnlyPrecision (#247: "Östersund, Östersund" märktes som lokal)', () => {
    // Ortregistret i liten skala — produktionen frågar SCB-tabellen.
    const TOWNS = new Set(['östersund', 'gemla', 'växjö', 'sturefors', 'linköping', 'vilhelmina', 'strömsund', 'reftele']);
    const isPlace = (s: string) => TOWNS.has(s.toLowerCase());

    it('orten upprepad, ensam eller med Sverige är stadens mittpunkt', () => {
        expect(placeOnlyPrecision('Östersund, Östersund', 'Östersund', isPlace)).toBe('stad-centroid');
        expect(placeOnlyPrecision('Östersund, Östersund', undefined, isPlace)).toBe('stad-centroid');
        expect(placeOnlyPrecision('Vilhelmina', undefined, isPlace)).toBe('stad-centroid');
        expect(placeOnlyPrecision('Strömsund, Sverige', undefined, isPlace)).toBe('stad-centroid');
        expect(placeOnlyPrecision('Strömsunds kommun', undefined, isPlace)).toBe('stad-centroid');
    });

    it('en mer specifik ort än staden är ortens mittpunkt', () => {
        expect(placeOnlyPrecision('Gemla, Växjö', undefined, isPlace)).toBe('ort-centroid');
        expect(placeOnlyPrecision('Gemla', 'Växjö', isPlace)).toBe('ort-centroid');
        expect(placeOnlyPrecision('Sturefors, Linköpings kommun', undefined, isPlace)).toBe('ort-centroid');
    });

    it('allt som inte är en ort ger vanlig märkning', () => {
        expect(placeOnlyPrecision('Gemla bibliotek, Växjö', 'Växjö', isPlace)).toBeNull();
        expect(placeOnlyPrecision('Storgatan 4, Östersund', 'Östersund', isPlace)).toBeNull();
        expect(placeOnlyPrecision('831 30 Östersund', undefined, isPlace)).toBeNull();
        expect(placeOnlyPrecision('Sverige', undefined, isPlace)).toBeNull();
        expect(placeOnlyPrecision('', undefined, isPlace)).toBeNull();
    });

    it('isPlaceSegment: kända städer och stadshintsen räknas utan registret', () => {
        const none = () => false;
        expect(isPlaceSegment('Göteborg', undefined, none)).toBe(true);
        expect(isPlaceSegment('Testby', 'Testby', none)).toBe(true);
        expect(isPlaceSegment('Testby', undefined, none)).toBe(false);
        expect(isPlaceSegment('Reftele', undefined, isPlace)).toBe(true);
    });
});

describe('reconcileCityCentroid (#247: Nominatims stadssvar var kommunens mitt)', () => {
    it('kommunmitt på hela bågminuter ersätts av tätortens punkt', () => {
        // Strömsund: Nominatim 64.25, 15.366667 — orten ligger 45 km söderut.
        expect(reconcileCityCentroid([64.25, 15.366667], [63.8539, 15.5661])).toEqual([63.8539, 15.5661]);
    });

    it('en namne långt bort ersätts, ortens centrum behålls', () => {
        expect(reconcileCityCentroid([56.0, 13.0], [60.6, 16.4])).toEqual([60.6, 16.4]);
        // Göteborg: Nominatims centrum 4,8 km från tätortens geometriska mitt.
        expect(reconcileCityCentroid([57.7072, 11.9668], [57.6637, 11.9611])).toEqual([57.7072, 11.9668]);
        // Karlskrona: Stortorget, inte tätortens mitt 4,4 km bort.
        expect(reconcileCityCentroid([56.1621, 15.5866], [56.1926, 15.6315])).toEqual([56.1621, 15.5866]);
    });

    it('utan tätort gäller Nominatim, utan Nominatim gäller tätorten', () => {
        expect(reconcileCityCentroid([59.1, 18.1], null)).toEqual([59.1, 18.1]);
        expect(reconcileCityCentroid(null, [59.5347, 14.2752])).toEqual([59.5347, 14.2752]);
        expect(reconcileCityCentroid(null, null)).toBeNull();
    });
});

describe('isSettlementResult (#247: första-ordsorten måste vara en ort)', () => {
    it('byar och orter godtas, järnvägar, parker och flygplatser inte', () => {
        expect(isSettlementResult({ class: 'place', addresstype: 'village' })).toBe(true);
        expect(isSettlementResult({ class: 'boundary', addresstype: 'suburb' })).toBe(true);
        expect(isSettlementResult({ class: 'railway', addresstype: 'track' })).toBe(false);
        expect(isSettlementResult({ class: 'leisure', addresstype: 'park' })).toBe(false);
        expect(isSettlementResult({ class: 'aeroway', addresstype: 'aeroway' })).toBe(false);
        expect(isSettlementResult({})).toBe(false);
    });
});
