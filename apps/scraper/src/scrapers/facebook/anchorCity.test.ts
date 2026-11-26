import { describe, it, expect } from 'vitest';
import { anchorCityOverride, anchorCityEvidence, addressAnchorCity, preferTextHit, titleSegments, registerTownsInText, type PlaceLookup } from './anchorCity';
import type { GeoHit } from '../../utils/venueCoordinates';
import { replaceTatorter } from '../../utils/sqliteHelper';

describe('anchorCityOverride', () => {
    it('Skönsmon-rapporten 25/9: "Umeå, Väven" ur Sundsvalls-kön → Umeå', () => {
        expect(anchorCityOverride({
            contextCity: 'Sundsvall',
            title: 'Christoffer Nyqvist - Lejonet Från Norden - Umeå, Väven',
            address: 'Väven',
            description: 'Lejonet från Norden kommer till Väven!',
        })).toBe('Umeå');
    });

    it('kontextstad i egna texten = bekräftad → ingen override', () => {
        // Hemmalag: "IF Sundsvall Hockey – Leksands IF" nämner kön-staden.
        expect(anchorCityOverride({
            contextCity: 'Sundsvall',
            title: 'IF Sundsvall Hockey – Leksands IF',
            address: 'Gärdehov',
            description: '',
        })).toBeNull();
        // Beskrivningen räcker som bekräftelse.
        expect(anchorCityOverride({
            contextCity: 'Uppsala',
            title: 'Malmö i våra hjärtan – hyllningskväll',
            address: 'Katalin',
            description: 'Konsertkväll i Uppsala med skånska visor.',
        })).toBeNull();
    });

    it('adressen väger tyngre än titeln (gästspel spelas där adressen står)', () => {
        expect(anchorCityOverride({
            contextCity: 'Sundsvall',
            title: 'De sår vind och skall skörda storm - Piteå Kammaropera',
            address: 'Härnösands Riksteaterförening',
            description: '',
        })).toBe('Härnösand');
    });

    it('två olika städer i titeln = tvetydigt → ingen override', () => {
        expect(anchorCityOverride({
            contextCity: 'Sundsvall',
            title: 'Buss Göteborg – Malmö, supporterresa',
            address: 'Uppsamlingsplats',
            description: '',
        })).toBeNull();
    });

    it('ingen kontextstad eller ingen främmande stad → ingen override', () => {
        expect(anchorCityOverride({
            contextCity: undefined,
            title: 'Konsert i Umeå',
            address: 'Väven',
            description: '',
        })).toBeNull();
        expect(anchorCityOverride({
            contextCity: 'Sundsvall',
            title: 'Sopplunch i församlingshemmet',
            address: 'Församlingshemmet',
            description: '',
        })).toBeNull();
    });

    it('bortalagstitel utan hemmastadsnamn pekar ut fel stad — anroparens poi/gata-krav är skyddet', () => {
        // "Timrå IK – Skellefteå AIK" (SCA Arena, Timrå): Timrå finns inte i
        // SWEDISH_GEO_CITIES, så bortalagets stad blir kandidat. Overriden får
        // därför bara vinna med en SPECIFIK träff nära kandidatstaden (och
        // "SCA Arena, Skellefteå" ger ingen) — dokumenterat kontrakt, se index.ts.
        expect(anchorCityOverride({
            contextCity: 'Sundsvall',
            title: 'Timrå IK – Skellefteå AIK',
            address: 'SCA Arena',
            description: '',
        })).toBe('Skellefteå');
    });
});

describe('addressAnchorCity (#247: postorten slår köns stad)', () => {
    const towns = new Set(['mölnlycke', 'karlskoga', 'delsbo']);
    const isPlace = (n: string) => towns.has(n.toLowerCase());

    it('svenskt postnummer + känd ort: postorten', () => {
        expect(addressAnchorCity('Långenäsvägen 5, 435 33 Mölnlycke', 'Uppsala', isPlace)).toBe('Mölnlycke');
        expect(addressAnchorCity('Folkets hus, 691 31 KARLSKOGA', 'Eskilstuna', isPlace)).toBe('Karlskoga');
        expect(addressAnchorCity('Delsbo Forngård, 820 60 Delsbo', null, isPlace)).toBe('Delsbo');
    });

    it('utan postnummer eller med okänd postort: kontextstaden', () => {
        expect(addressAnchorCity('Långenäsvägen 5, Mölnlycke', 'Uppsala', isPlace)).toBe('Uppsala');
        expect(addressAnchorCity('Mannerheimintie 1, 00100 Helsinki', 'Uppsala', isPlace)).toBe('Uppsala');
        expect(addressAnchorCity('Okänd plats', null, isPlace)).toBeUndefined();
    });
});

// Ett litet SCB-register för testerna (riktiga DB:n används aldrig i test).
const REGISTER = [
    'Säffle', 'Köping', 'Ludvika', 'Vara', 'Nacka', 'Uppsala', 'Skellefteå', 'Örnsköldsvik',
    'Kopparberg', 'Marieholm', 'Gnosjö', 'Danmark', 'Upplands Väsby', 'Väsby',
];
const places: PlaceLookup = {
    scanNames: () => REGISTER.filter((n) => n.length >= 5).sort((a, b) => b.length - a.length),
    isTown: (n) => REGISTER.some((r) => r.toLowerCase() === n.toLowerCase()),
};

describe('registerTownsInText (#291: vakterna mot fel ort)', () => {
    it('ortnamnet i lokalnamnet, även i genitiv', () => {
        expect(registerTownsInText('Medborgarhuset i Säffle', places)).toEqual(['Säffle']);
        expect(registerTownsInText('Köpings Kyrka', places)).toEqual(['Köping']);
    });

    it('storleksprefix gör det till en annan plats: Stora Kopparbergs kyrka ligger i Falun', () => {
        expect(registerTownsInText('Stora Kopparbergs kyrka', places)).toEqual([]);
    });

    it('landsnamn är ingen ort, fast Danmark är en tätort i Uppsala', () => {
        expect(registerTownsInText('Kirkevej 10, 7160 Tørring, Danmark', places)).toEqual([]);
    });

    it('två orter i adressen ges båda (anroparen ser tvetydigheten)', () => {
        expect(registerTownsInText('Marieholm, Gnosjö kommun', places)).toEqual(['Marieholm', 'Gnosjö']);
    });

    it('ett namn inuti ett längre träffat namn räknas inte för sig', () => {
        expect(registerTownsInText('Messingen, Upplands Väsby', places)).toEqual(['Upplands Väsby']);
    });

    it('inte mitt i ett ord', () => {
        expect(registerTownsInText('Säfflegatan 3', places)).toEqual([]);
    });
});

describe('titleSegments', () => {
    it('delar på pipe, tankstreck, komma och versalt I', () => {
        expect(titleSegments('Viktor Norén | Julturné | Säffle')).toEqual(['Viktor Norén', 'Julturné', 'Säffle']);
        expect(titleSegments('Christoffer Nyqvist - Lejonet Från Norden - Umeå, Väven'))
            .toEqual(['Christoffer Nyqvist', 'Lejonet Från Norden', 'Umeå', 'Väven']);
        expect(titleSegments('Historia Nu I Malmö I 14 nov 2026')).toEqual(['Historia Nu', 'Malmö', '14 nov 2026']);
        expect(titleSegments('Al Pitcher – Testar nya skämt • 26/11 • Vänersborg'))
            .toEqual(['Al Pitcher', 'Testar nya skämt', '26/11', 'Vänersborg']);
        // Bindestreck UTAN mellanslag är en del av namnet.
        expect(titleSegments('Vinberg-Ljungby marknad')).toEqual(['Vinberg-Ljungby marknad']);
    });
});

describe('anchorCityEvidence (#291: orten utanför de 95 städerna)', () => {
    it('Säffle-rapporten: "Medborgarhuset i Säffle" ur Uppsala-kön → Säffle, starkt via adressen', () => {
        expect(anchorCityEvidence({
            contextCity: 'Uppsala',
            title: 'Viktor Norén | Julturné | Säffle',
            address: 'Medborgarhuset i Säffle',
            description: 'I slutet av året åker Viktor Norén ut på sin första julturné helt själv och den 26 november kommer han till Säffle.',
        }, places)).toEqual({ city: 'Säffle', strength: 'stark', from: 'adress' });
    });

    it('lokalnamn med orten sist: "Forumteatern Köping" → Köping', () => {
        expect(anchorCityEvidence({
            contextCity: 'Uppsala', title: 'Viktor Norén | Julturné | Köping',
            address: 'Forumteatern Köping', description: '',
        }, places)).toEqual({ city: 'Köping', strength: 'stark', from: 'adress' });
    });

    it('orten som helt titelsegment när adressen saknar ort (Vara: fyra tecken, under skanningsgolvet)', () => {
        expect(anchorCityEvidence({
            contextCity: 'Göteborg',
            title: 'Carola | Jag är Carola – en musikalisk livsberättelse | Vara',
            address: 'Vara Konserthus', description: '',
        }, places)).toEqual({ city: 'Vara', strength: 'stark', from: 'titel' });
        expect(anchorCityEvidence({
            contextCity: 'Uppsala', title: 'Viktor Norén | Julturné | Ludvika',
            address: 'Folkets Hus', description: '',
        }, places)).toEqual({ city: 'Ludvika', strength: 'stark', from: 'titel' });
        expect(anchorCityEvidence({
            contextCity: 'Göteborg', title: 'Arne Alligator | Nacka | 15 november 2026',
            address: 'Diselverkstaden Stora Scen', description: '',
        }, places)).toEqual({ city: 'Nacka', strength: 'stark', from: 'titel' });
    });

    it('"… i <ort>" i slutet av ett segment räknas som orten', () => {
        expect(anchorCityEvidence({
            contextCity: 'Uppsala', title: 'Viktor Norén – julkonsert i Säffle',
            address: 'Medborgarhuset', description: '',
        }, places)).toEqual({ city: 'Säffle', strength: 'stark', from: 'titel' });
    });

    it('bortalagstiteln är fortfarande svag (laget heter mer än orten)', () => {
        expect(anchorCityEvidence({
            contextCity: 'Sundsvall', title: 'Timrå IK – Skellefteå AIK',
            address: 'SCA Arena', description: '',
        }, places)).toEqual({ city: 'Skellefteå', strength: 'svag', from: 'titel' });
    });

    it('kontextstaden nämnd i texten → ingen override, även med ort i adressen', () => {
        expect(anchorCityEvidence({
            contextCity: 'Uppsala', title: 'Viktor Norén | Julturné | Säffle',
            address: 'Medborgarhuset i Säffle', description: 'Buss från Uppsala kl 16.',
        }, places)).toBeNull();
    });

    it('adressen pekar på två orter: gamla regeln (ensam känd stad, svag)', () => {
        expect(anchorCityEvidence({
            contextCity: 'Karlstad', title: 'Julbord',
            address: 'Restaurang Stockholm, Säffle', description: '',
        }, places)).toEqual({ city: 'Stockholm', strength: 'svag', from: 'adress' });
        // Ingen av orterna i de 95 städerna → ingen override alls.
        expect(anchorCityEvidence({
            contextCity: 'Jönköping', title: 'Julmarknad i Gamla Fabriken - Marieholm',
            address: 'Marieholm, Gnosjö kommun', description: '',
        }, places)).toBeNull();
    });

    it('Stora Kopparbergs kyrka (Falun) ur en annan kö: ingen override', () => {
        expect(anchorCityEvidence({
            contextCity: 'Borlänge', title: 'Gnistrande jul med Falu Kammarkör',
            address: 'Stora Kopparbergs kyrka', description: '',
        }, places)).toBeNull();
    });

    it('lokalnamn som bara bär ett ortnamn är svagt (Nordanå-kvarteret i Skellefteå ≠ tätorten)', () => {
        expect(anchorCityEvidence({
            contextCity: 'Skellefteå', title: 'Julshow 2026',
            address: 'Nordanå teatern', description: '',
        }, { ...places, scanNames: () => ['Nordanå'] })).toEqual({ city: 'Nordanå', strength: 'svag', from: 'adress' });
    });

    it('beskrivningen kan bekräfta orten i lokalnamnet (Köpings kyrka, inte den på Öland)', () => {
        expect(anchorCityEvidence({
            contextCity: 'Kalmar', title: 'Julkonsert, tidig',
            address: 'Köpings Kyrka', description: 'Med Köpings kyrkas kammarkör och Munktorps kyrkokör.',
        }, places)).toEqual({ city: 'Köping', strength: 'stark', from: 'adress' });
    });

    it('tätort som också är ett vanligt ord räknas bara med versal', () => {
        expect(registerTownsInText('Lillstrimma hallen', { ...places, scanNames: () => ['Hallen'] })).toEqual([]);
    });

    it('anchorCityOverride ger bara staden', () => {
        expect(anchorCityOverride({
            contextCity: 'Uppsala', title: 'Viktor Norén | Julturné | Säffle',
            address: 'Medborgarhuset i Säffle', description: '',
        }, places)).toBe('Säffle');
    });
});

describe('preferTextHit (#291)', () => {
    const saffle: GeoHit = [59.133, 12.921, 'ort-centroid'];
    const uppsalaMitt: GeoHit = [59.859, 17.639, 'stad-centroid'];
    const uppsalaLokal: GeoHit = [59.86, 17.65, 'poi'];
    const stark = { city: 'Säffle', strength: 'stark', from: 'adress' } as const;
    const starkTitel = { city: 'Säffle', strength: 'stark', from: 'titel' } as const;
    const svag = { city: 'Skellefteå', strength: 'svag', from: 'titel' } as const;

    it('Säffle-fallet: köns mittpunkt (eller miss) förlorar mot textens ort', () => {
        expect(preferTextHit(stark, saffle, uppsalaMitt)).toBe(true);
        expect(preferTextHit(stark, saffle, null)).toBe(true);
        expect(preferTextHit(starkTitel, saffle, uppsalaMitt)).toBe(true);
    });

    it('en mittpunkt slår aldrig en lokal som köns kedja faktiskt hittade', () => {
        expect(preferTextHit(stark, saffle, uppsalaLokal)).toBe(false);
        expect(preferTextHit(starkTitel, saffle, uppsalaLokal)).toBe(false);
    });

    it('svagt bevis (bortalaget): bara en specifik träff vinner, aldrig en mittpunkt', () => {
        const skellefteaMitt: GeoHit = [64.75, 20.97, 'stad-centroid'];
        const skellefteaArena: GeoHit = [64.75, 20.95, 'poi'];
        expect(preferTextHit(svag, skellefteaMitt, uppsalaMitt)).toBe(false);
        expect(preferTextHit(svag, skellefteaMitt, null)).toBe(false);
        expect(preferTextHit(svag, skellefteaArena, uppsalaMitt)).toBe(true);
    });

    it('ingen evidens eller ingen träff i textens ort → aldrig', () => {
        expect(preferTextHit(null, saffle, uppsalaMitt)).toBe(false);
        expect(preferTextHit(stark, null, uppsalaMitt)).toBe(false);
    });
});

describe('registret på riktigt (in-memory): småorter som namnar räknas inte (#291)', () => {
    it('Säffle (8 823 inv.) räknas, Lindholmen (1 264, Vallentuna) inte — "Front Lindholmen" ligger i Göteborg', () => {
        replaceTatorter([
            { name: 'Säffle', kommun: 'Säffle', lan: 'Värmland', lat: 59.133, lng: 12.921, bef: 8823 },
            { name: 'Lindholmen', kommun: 'Vallentuna', lan: 'Stockholm', lat: 59.58, lng: 18.11, bef: 1264 },
            { name: 'Bjurholm', kommun: 'Bjurholm', lan: 'Västerbotten', lat: 63.93, lng: 19.21, bef: 1300 },
        ]);
        expect(anchorCityEvidence({
            contextCity: 'Uppsala', title: 'Viktor Norén | Julturné | Säffle',
            address: 'Medborgarhuset i Säffle', description: '',
        })).toEqual({ city: 'Säffle', strength: 'stark', from: 'adress' });
        expect(anchorCityEvidence({
            contextCity: 'Stockholm', title: 'Julfest | Lindholmen',
            address: 'Front Lindholmen', description: '',
        })).toBeNull();
        // Centralorten räknas oavsett storlek.
        expect(anchorCityEvidence({
            contextCity: 'Umeå', title: 'Julkonsert',
            address: 'Kyrkan i Bjurholm', description: '',
        })).toEqual({ city: 'Bjurholm', strength: 'stark', from: 'adress' });
        replaceTatorter([]);
    });
});
