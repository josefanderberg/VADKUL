import { describe, it, expect } from 'vitest';
import { extractStreetAddress, cleanCityName } from './geo-refine';

describe('cleanCityName', () => {
    it('strippar administrativa suffix', () => {
        expect(cleanCityName('Göteborgs Stad')).toBe('Göteborg');
        expect(cleanCityName('Stockholms kommun')).toBe('Stockholm');
        expect(cleanCityName('Malmö stad')).toBe('Malmö');
        expect(cleanCityName('Region Gotland')).toBe('Gotland');
        expect(cleanCityName('Växjö kommun')).toBe('Växjö');
    });

    it('rör INTE orter som genuint slutar på s', () => {
        expect(cleanCityName('Borås')).toBe('Borås');
        expect(cleanCityName('Höganäs')).toBe('Höganäs');
        expect(cleanCityName('Degerfors')).toBe('Degerfors');
        expect(cleanCityName('Grums')).toBe('Grums');
    });

    it('null/tomt → null', () => {
        expect(cleanCityName(null)).toBeNull();
        expect(cleanCityName('')).toBeNull();
    });
});

describe('extractStreetAddress', () => {
    it('hittar enkel gatuadress', () => {
        expect(extractStreetAddress('Vi ses på Storgatan 12 i centrum')).toBe('Storgatan 12');
    });

    it('hittar flerords-gata med genitiv', () => {
        expect(extractStreetAddress('Djulö idrottsplats, Hilding Hjelmbergs väg 5, Katrineholm'))
            .toBe('Hilding Hjelmbergs väg 5');
    });

    it('hittar adress med bokstavs-suffix', () => {
        expect(extractStreetAddress('Plats: Västra Esplanaden 9A, vån 2')).toBe('Västra Esplanaden 9A');
    });

    it('tar torget och allén', () => {
        expect(extractStreetAddress('Samling vid Stortorget 1')).toBe('Stortorget 1');
        expect(extractStreetAddress('Konsert i parken, Linnéallén 3')).toBe('Linnéallén 3');
    });

    it('matchar INTE vägnummer ("väg 23")', () => {
        expect(extractStreetAddress('Följ väg 23 norrut mot Älmhult')).toBeNull();
    });

    it('null/tomt → null', () => {
        expect(extractStreetAddress(null)).toBeNull();
        expect(extractStreetAddress('')).toBeNull();
        expect(extractStreetAddress('Ingen adress här alls')).toBeNull();
    });
});
