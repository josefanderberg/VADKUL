import { describe, it, expect } from 'vitest';
import { mapHembygdActivity } from './hembygd';

const forening = { siteId: 'vaxjo-hembygdsforening', name: 'Växjö Hembygdsförening', lat: 56.88, lng: 14.81, region: 'Småland' };
const baseActivity = {
    id: 987,
    published: true,
    archived: false,
    header: 'Slåttergille',
    date: '2026-07-04T14:00:00',   // lokal Stockholmstid, ingen TZ
    location: 'Hembygdsgården',
    lat: 0,
    long: 0,
    image: 'https://filer.hembygd.se/x.jpg',
    isPaid: false,
    preamble: 'Traditionellt <em>slåttergille</em> med lie',
};

describe('mapHembygdActivity', () => {
    it('mappar en komplett aktivitet med föreningens koordinater som fallback', () => {
        const e = mapHembygdActivity(baseActivity, forening)!;
        expect(e.url).toBe('https://www.hembygd.se/vaxjo-hembygdsforening?a=987');
        expect(e.title).toBe('Slåttergille');
        expect(e.startDate.getHours()).toBe(14);
        expect(e.coords).toEqual([56.88, 14.81]);     // aktivitet saknar → föreningens
        expect(e.hostName).toBe('Växjö Hembygdsförening');
        expect(e.venueName).toBe('Hembygdsgården, Växjö Hembygdsförening');
        expect(e.price).toBe('Gratis');               // isPaid === false
        expect(e.description).toBe('Traditionellt slåttergille med lie');
    });

    it('aktivitetens egna koordinater vinner över föreningens', () => {
        const e = mapHembygdActivity({ ...baseActivity, lat: 57.5, long: 15.5 }, forening)!;
        expect(e.coords).toEqual([57.5, 15.5]);
    });

    it('opublicerade och arkiverade aktiviteter hoppas över', () => {
        expect(mapHembygdActivity({ ...baseActivity, published: false }, forening)).toBeNull();
        expect(mapHembygdActivity({ ...baseActivity, archived: true }, forening)).toBeNull();
        expect(mapHembygdActivity({ ...baseActivity, header: '' }, forening)).toBeNull();
    });

    it('prislogiken: betald aktivitet → icke-medlemspris, okänt → tomt', () => {
        expect(mapHembygdActivity({ ...baseActivity, isPaid: true, priceForNonMembers: '50 kr' }, forening)!.price).toBe('50 kr');
        expect(mapHembygdActivity({ ...baseActivity, isPaid: undefined }, forening)!.price).toBe('');
    });

    it('förening utan koordinater + plats → geocode-kandidat "<plats>, Sverige"', () => {
        const utanKoord = { ...forening, lat: 0, lng: 0 };
        const e = mapHembygdActivity(baseActivity, utanKoord)!;
        expect(e.coords).toBeUndefined();
        expect(e.geocodeCandidates).toEqual(['Hembygdsgården, Sverige']);
    });
});
