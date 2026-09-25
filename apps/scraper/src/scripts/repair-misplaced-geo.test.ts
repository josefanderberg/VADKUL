import { describe, it, expect } from 'vitest';
import { deriveExpectedCity, deriveExpectedCityWithSource } from './repair-misplaced-geo';

describe('deriveExpectedCity', () => {
    it('församlings-mönstret vinner: "kyrka, X församling" → ort', () => {
        expect(deriveExpectedCity('S:t Nikolai kyrka, Halmstads församling', null, null)).toBe('Halmstad');
        expect(deriveExpectedCity('Vasa församlingshem, Göteborgs Vasa församling', null, null)).toBe('Göteborg');
        expect(deriveExpectedCity('Västerås domkyrka, Västerås domkyrkoförsamling', null, null)).toBe('Västerås');
    });

    it('hostName används när locationName saknar mönstret', () => {
        expect(deriveExpectedCity('Sockenstugan', 'Lidköpings församling', null)).toBe('Lidköping');
    });

    it('känd stad inbäddad i locationName/geocodedQuery (genitiv ok)', () => {
        expect(deriveExpectedCity('Stadsparken, Örebro', null, null)).toBe('Örebro');
        expect(deriveExpectedCity(null, null, 'Konserthuset, Helsingborgs kommun')).toBe('Helsingborg');
    });

    it('sista komma-segmentet vinner vid flera städer', () => {
        expect(deriveExpectedCity('Restaurang Stockholm, Göteborg', null, null)).toBe('Göteborg');
    });

    it('ingen ledtråd → null', () => {
        expect(deriveExpectedCity('Sockenstugan', 'PRO Norrahammar', null)).toBeNull();
        expect(deriveExpectedCity(null, null, null)).toBeNull();
    });

    it('alias-församlingar (namn ≠ stad) mappas till sin riktiga stad', () => {
        // Sundsvall-tråden 6/8: båda låg geokodade i Sundsvallstrakten.
        expect(deriveExpectedCity('Katarina kyrka, Katarina församling', null, null)).toBe('Stockholm');
        expect(deriveExpectedCity(null, 'Rödöns församling', null)).toBe('Östersund');
    });

    it('tvetydiga småorter avvisas — bara kända städer godkänns', () => {
        // "Stenkyrka" finns både på Tjörn och Gotland; "Edsberg" i Närke och
        // Sollentuna. Centroid-geokodning av dem träffar fel → ingen reparation.
        expect(deriveExpectedCity('Skärhamns kyrka, Stenkyrka församling', null, null)).toBeNull();
        expect(deriveExpectedCity('Hackvads kyrka, Edsbergs församling', null, null)).toBeNull();
    });

    it('sammansatta ortnamn matchar INTE stadsnamnet de innehåller', () => {
        // Östra Ljungby (Skåne) ≠ Ljungby (Småland); Vinberg-Ljungby (Halland);
        // Västra Sandviken (Grums) ≠ Sandviken; Nora-Skogs (Ångermanland) ≠ Nora.
        expect(deriveExpectedCity('Östra Ljungby kyrka, Östra Ljungby församling', null, null)).toBeNull();
        expect(deriveExpectedCity('Vinberg-Ljungby Hembygdsförening', null, null)).toBeNull();
        expect(deriveExpectedCity('Grums hembygdsgård, Västra Sandviken, Grums.', null, null)).toBeNull();
        expect(deriveExpectedCity('Nora församlingsgård, Nora-Skogs församling', null, null)).toBeNull();
        // …men äkta sista-segment-stad vinner förbi kompound-brus tidigare i strängen
        expect(deriveExpectedCity('Slätteberg 202, 31195 Falkenberg, Vinberg-Ljungby Hembygdsförening', null, null)).toBe('Falkenberg');
    });

    it('byadresser "<Ortnamn> <nummer>" är inte stadsbevis', () => {
        // "Sandviken 130" är en gård på Frösön — inte staden Sandviken.
        expect(deriveExpectedCity('Sandviken 130, 832 93 Frösön, Sweden', null, null)).toBeNull();
        // …men "Storgatan 5, Sandviken" pekar på staden.
        expect(deriveExpectedCity('Storgatan 5, Sandviken', null, null)).toBe('Sandviken');
    });
});

describe('deriveExpectedCityWithSource (titeln som sista utväg — FB-turnéklassen)', () => {
    it('fältvägarna vinner alltid; titeln flaggas fromTitle', () => {
        // Skönsmon-rapporten 25/9: "Umeå, Väven" felplacerad i Sundsvall.
        expect(deriveExpectedCityWithSource(
            'Väven', null, 'Väven', 'Christoffer Nyqvist - Lejonet Från Norden - Umeå, Väven',
        )).toEqual({ city: 'Umeå', fromTitle: true });
        // locationName-stad slår titeln (och flaggas inte).
        expect(deriveExpectedCityWithSource(
            'Stadsparken, Örebro', null, null, 'Konsert – Umeå',
        )).toEqual({ city: 'Örebro', fromTitle: false });
    });

    it('två städer i titeln = tvetydigt, ingen titel = fältvägarna avgör', () => {
        expect(deriveExpectedCityWithSource(null, null, 'Uppsamlingsplats', 'Buss Göteborg – Malmö')).toBeNull();
        expect(deriveExpectedCityWithSource('Sockenstugan', null, null, null)).toBeNull();
    });

    it('församlingssegment behåller sin "aldrig vidare till svagare signal"-regel', () => {
        // Okänd småorts-församling → avbrott, även när titeln nämner en stad.
        expect(deriveExpectedCityWithSource(
            'Skärhamns kyrka, Stenkyrka församling', null, null, 'Utflykt till Göteborg',
        )).toBeNull();
    });

    it('bortalagstitlar ger kandidat — huvudloopens korroborering är skyddet', () => {
        // "Timrå IK – Skellefteå AIK" (SCA Arena, Timrå): Skellefteå blir
        // kandidat men fromTitle=true tvingar reverse-korroborering + no-zero.
        expect(deriveExpectedCityWithSource(
            'SCA Arena', null, 'SCA Arena', 'Timrå IK – Skellefteå AIK',
        )).toEqual({ city: 'Skellefteå', fromTitle: true });
    });
});
