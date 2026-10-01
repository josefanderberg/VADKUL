import { describe, it, expect } from 'vitest';
import { parsePlatsParam, parseStartCity, START_CITY_MAX_AGE_MS } from './startCity';

// Kartan öppnar i den här staden vid nästa besök — allt som kommer ur
// webbläsarlagringen är alltså kamerainput. En ogiltig koordinat in i MapLibre
// fäller hela vyn, så parsern måste avvisa allt som inte är en riktig stad.
const NOW = 1_756_600_000_000;
const vaxjo = { lat: 56.8777, lng: 14.8091, zoom: 10, name: 'Växjö', savedAt: NOW - 60_000 };

describe('parseStartCity', () => {
    it('läser tillbaka en nyss sparad stad', () => {
        expect(parseStartCity(JSON.stringify(vaxjo), NOW)).toEqual(vaxjo);
    });

    it('tomt, trasigt eller icke-objekt ger null', () => {
        expect(parseStartCity(null, NOW)).toBeNull();
        expect(parseStartCity('', NOW)).toBeNull();
        expect(parseStartCity('{inte json', NOW)).toBeNull();
        expect(parseStartCity('"bara en sträng"', NOW)).toBeNull();
        expect(parseStartCity('null', NOW)).toBeNull();
    });

    it('ogiltiga koordinater avvisas (null island, projicerade, NaN)', () => {
        expect(parseStartCity(JSON.stringify({ ...vaxjo, lat: 0, lng: 0 }), NOW)).toBeNull();
        expect(parseStartCity(JSON.stringify({ ...vaxjo, lat: 6129956, lng: 1583912 }), NOW)).toBeNull();
        expect(parseStartCity(JSON.stringify({ ...vaxjo, lng: 'nej' }), NOW)).toBeNull();
    });

    it('saknad zoom, tomt namn eller saknad tidsstämpel avvisas', () => {
        expect(parseStartCity(JSON.stringify({ ...vaxjo, zoom: undefined }), NOW)).toBeNull();
        expect(parseStartCity(JSON.stringify({ ...vaxjo, name: '   ' }), NOW)).toBeNull();
        expect(parseStartCity(JSON.stringify({ ...vaxjo, savedAt: undefined }), NOW)).toBeNull();
    });

    it('för gammal stad glöms bort (flyttat, lånad dator)', () => {
        const gammal = { ...vaxjo, savedAt: NOW - START_CITY_MAX_AGE_MS - 1 };
        expect(parseStartCity(JSON.stringify(gammal), NOW)).toBeNull();
        const nätt = { ...vaxjo, savedAt: NOW - START_CITY_MAX_AGE_MS + 1000 };
        expect(parseStartCity(JSON.stringify(nätt), NOW)?.name).toBe('Växjö');
    });

    it('framtida tidsstämpel (ställd systemklocka) räknas som färsk', () => {
        expect(parseStartCity(JSON.stringify({ ...vaxjo, savedAt: NOW + 86_400_000 }), NOW)?.name).toBe('Växjö');
    });

    it('zoomen klampas till kartans spann', () => {
        expect(parseStartCity(JSON.stringify({ ...vaxjo, zoom: 1 }), NOW)?.zoom).toBe(4);
        expect(parseStartCity(JSON.stringify({ ...vaxjo, zoom: 22 }), NOW)?.zoom).toBe(16);
    });
});

// ?plats= i djuplänkarna (stadssidornas kartbild, arrangörssidan, mejlen) -
// samma krav som den sparade staden: en trasig koordinat fäller kartan.
describe('parsePlatsParam', () => {
    it('läser lat, lng och zoom', () => {
        expect(parsePlatsParam('58.41,15.62,11')).toEqual({ lat: 58.41, lng: 15.62, zoom: 11 });
    });

    it('utan zoom blir det 11, zoomen hålls inom 4-16', () => {
        expect(parsePlatsParam('58.41,15.62')).toEqual({ lat: 58.41, lng: 15.62, zoom: 11 });
        expect(parsePlatsParam('58.41,15.62,2')?.zoom).toBe(4);
        expect(parsePlatsParam('58.41,15.62,22')?.zoom).toBe(16);
    });

    it('saknat, tomt eller trasigt ger null', () => {
        expect(parsePlatsParam(null)).toBeNull();
        expect(parsePlatsParam('')).toBeNull();
        expect(parsePlatsParam(',,')).toBeNull();          // Number('') = 0 får inte bli null island
        expect(parsePlatsParam('58.41')).toBeNull();
        expect(parsePlatsParam('linkoping')).toBeNull();
        expect(parsePlatsParam('95,15.62,11')).toBeNull();
    });
});
