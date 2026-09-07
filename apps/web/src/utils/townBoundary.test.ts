import { describe, it, expect } from 'vitest';
import { belongsToTown, nearestTown, townsMentioned, distanceKm, type TownPoint } from './townBoundary';

/** Utdrag ur webbens cityPoints — orterna som spelade roll i avslaget 1/9. */
const TOWNS: TownPoint[] = [
    { name: 'Stockholm', lat: 59.33, lng: 18.06 },
    { name: 'Uppsala', lat: 59.86, lng: 17.64 },
    { name: 'Västerås', lat: 59.61, lng: 16.55 },
    { name: 'Eskilstuna', lat: 59.37, lng: 16.51 },
    { name: 'Järfälla', lat: 59.42, lng: 17.83 },
    { name: 'Vallentuna', lat: 59.53, lng: 18.08 },
    { name: 'Märsta', lat: 59.62, lng: 17.86 },
    { name: 'Torshälla', lat: 59.42, lng: 16.48 },
    { name: 'Helsingborg', lat: 56.05, lng: 12.69 },
    { name: 'Landskrona', lat: 55.87, lng: 12.83 },
    { name: 'Kävlinge', lat: 55.79, lng: 13.11 },
    { name: 'Lomma', lat: 55.67, lng: 13.07 },
    { name: 'Svalöv', lat: 55.91, lng: 13.11 },
];
const landskrona = TOWNS.find(t => t.name === 'Landskrona')!;
const marsta = TOWNS.find(t => t.name === 'Märsta')!;

describe('townsMentioned', () => {
    it('hittar ortnamnet i plats- och adressfältet', () => {
        expect(townsMentioned({ locationName: 'Landskrona Teater', lat: 0, lng: 0 }, TOWNS))
            .toEqual(['Landskrona']);
        expect(townsMentioned({ locationName: 'Kavallerigatan 4', extractedAddress: '261 31 Landskrona', lat: 0, lng: 0 }, TOWNS))
            .toEqual(['Landskrona']);
    });

    it('fastnar inte mitt i ett längre ord', () => {
        // \b i JS räknar å/ä/ö som icke-bokstav — "Lomma" får inte matcha
        // "Lommaryd", och ortnamn ska inte hittas inuti sammansättningar.
        expect(townsMentioned({ locationName: 'Lommaryds bygdegård', lat: 0, lng: 0 }, TOWNS))
            .toEqual([]);
    });

    it('tar inget alls ur en plats utan ortnamn', () => {
        expect(townsMentioned({ locationName: 'Sundspärlan', lat: 0, lng: 0 }, TOWNS)).toEqual([]);
    });
});

describe('belongsToTown — fallen som fällde Landskrona-inlägget 1/9', () => {
    const i = (locationName: string, lat: number, lng: number, extractedAddress?: string) =>
        ({ locationName, extractedAddress, lat, lng });

    it('behåller det som ligger i kommunen', () => {
        expect(belongsToTown(i('Landskrona Teater', 55.87, 12.83), landskrona, TOWNS)).toBe(true);
        expect(belongsToTown(i('Slottsparken', 55.87, 12.84), landskrona, TOWNS)).toBe(true);
        // Borstahusen: inget ortnamn i platsen, men nära nog och närmast Landskrona.
        expect(belongsToTown(i('Sjöfartsgatan', 55.90, 12.81), landskrona, TOWNS)).toBe(true);
    });

    it('kastar grannkommunernas event — namnet räcker som bevis', () => {
        // Låg 10 km från Landskrona men heter Kävlinge.
        expect(belongsToTown(i('Friluftsfrämjandet Lödde-Kävlinge', 55.80, 12.95), landskrona, TOWNS)).toBe(false);
        expect(belongsToTown(i('Silvavägen 49, Kävlinge', 55.79, 13.00), landskrona, TOWNS)).toBe(false);
        expect(belongsToTown(i('Bjärreds församling', 55.72, 13.01), landskrona, TOWNS)).toBe(false);
    });

    it('kastar grannkommunens event även utan ortnamn — geometrin avgör', () => {
        // Sundspärlan säger inte "Helsingborg", men ligger där.
        expect(belongsToTown(i('Sundspärlan', 56.04, 12.70), landskrona, TOWNS)).toBe(false);
        // Rydebäcksskolan, mellan städerna men närmare Helsingborg.
        expect(belongsToTown(i('Rydebäcksskolan', 55.98, 12.76), landskrona, TOWNS)).toBe(false);
    });

    it('Märsta-inlägget slipper Järfälla, Vallentuna och Uppsala', () => {
        expect(belongsToTown(i('Järfälla', 59.42, 17.83), marsta, TOWNS)).toBe(false);
        expect(belongsToTown(i('Vallentuna kyrka', 59.53, 18.08), marsta, TOWNS)).toBe(false);
        expect(belongsToTown(i('Gottsunda Dans & Teater', 59.82, 17.62), marsta, TOWNS)).toBe(false);
    });

    it('Torshälla-inlägget slutar vara ett Västerås-inlägg', () => {
        const torshalla = TOWNS.find(t => t.name === 'Torshälla')!;
        expect(belongsToTown(i('Västerås domkyrka', 59.61, 16.55), torshalla, TOWNS)).toBe(false);
        expect(belongsToTown(i('Stora torget Västerås', 59.61, 16.55), torshalla, TOWNS)).toBe(false);
        expect(belongsToTown(i('Torshälla kyrka', 59.42, 16.48), torshalla, TOWNS)).toBe(true);
    });

    it('kastar gränsfallet där grannorten är nästan lika nära', () => {
        // Rydebäck: 11,0 km till Landskrona, 11,3 km till Helsingborg —
        // närmast Landskrona, men i Helsingborgs kommun. Marginalen fäller den.
        expect(belongsToTown(i('Rydebäcksskolan', 55.9651, 12.782, 'Ängesögatan 15'), landskrona, TOWNS)).toBe(false);
    });

    it('säkerhetsventilen räddar orter som saknas i listan', () => {
        // En ort utan egen cityPoint: allt inom närradien behålls även om en
        // grannort råkar vara marginellt närmare mittpunkten.
        const nara = i('Bygdegården', landskrona.lat + 0.01, landskrona.lng);
        expect(belongsToTown(nara, landskrona, TOWNS)).toBe(true);
    });
});

describe('nearestTown + distanceKm', () => {
    it('pekar ut orten eventet ligger närmast', () => {
        expect(nearestTown({ lat: 56.04, lng: 12.70 }, TOWNS)?.name).toBe('Helsingborg');
        expect(nearestTown({ lat: 55.87, lng: 12.83 }, TOWNS)?.name).toBe('Landskrona');
    });
    it('mäter i kilometer', () => {
        expect(distanceKm(55.87, 12.83, 56.05, 12.69)).toBeGreaterThan(15);
        expect(distanceKm(55.87, 12.83, 56.05, 12.69)).toBeLessThan(30);
    });
});
