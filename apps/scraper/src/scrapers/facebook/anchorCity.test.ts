import { describe, it, expect } from 'vitest';
import { anchorCityOverride } from './anchorCity';

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
