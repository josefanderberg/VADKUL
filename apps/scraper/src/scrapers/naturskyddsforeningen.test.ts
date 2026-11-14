import { describe, it, expect } from 'vitest';
import { mapNsfEvent, parseStartTime } from './naturskyddsforeningen';

const baseResult = {
    title: 'Slåtterkurs på ängen',
    url: '/kalender/slatterkurs-pa-angen-2026-07-12/',
    timeString: '10.00–14.00',
    dateString: '12 juli 2026',
    organizer: 'Naturskyddsföreningen Sollentuna',
    location: 'Törnskogens naturreservat',
    coordinates: { lat: 59.46, lng: 17.94 },
    image: { url: 'https://cms.naturskyddsforeningen.se/bild.jpg' },
    excerpt: 'Lär dig slåtter med lie <b>och</b> räfsa […]',
};

describe('parseStartTime', () => {
    it('plockar starttid ur intervall och enkeltid, punkt eller kolon', () => {
        expect(parseStartTime('18.00–20.00')).toEqual({ h: 18, m: 0 });
        expect(parseStartTime('9:30')).toEqual({ h: 9, m: 30 });
        expect(parseStartTime('')).toBeNull();
        expect(parseStartTime('99.99')).toBeNull();
    });
});

describe('mapNsfEvent', () => {
    it('mappar ett komplett GraphQL-result med slug-datum + timeString', () => {
        const e = mapNsfEvent(baseResult)!;
        expect(e.url).toBe('https://www.naturskyddsforeningen.se/kalender/slatterkurs-pa-angen-2026-07-12/');
        expect(e.startDate.getFullYear()).toBe(2026);
        expect(e.startDate.getMonth()).toBe(6);       // juli
        expect(e.startDate.getDate()).toBe(12);
        expect(e.startDate.getHours()).toBe(10);      // ur timeString, lokal tid
        expect(e.coords).toEqual([59.46, 17.94]);
        expect(e.hostName).toBe('Naturskyddsföreningen Sollentuna');
        expect(e.venueName).toBe('Törnskogens naturreservat, Naturskyddsföreningen Sollentuna');
        expect(e.imageUrl).toBe('https://cms.naturskyddsforeningen.se/bild.jpg');
    });

    it('slug utan ISO-datum hoppas över (dateString kan vara intervall — opålitlig)', () => {
        expect(mapNsfEvent({ ...baseResult, url: '/kalender/standig-utstallning/' })).toBeNull();
    });

    // 1/11 2026: sajten lägger ett numeriskt id efter datumet i slugen och
    // flyttade kalendern under /engagera-dig/ — regexen krävde datumet SIST
    // och 291 av 291 event föll bort (källan låg i karantän en månad).
    it('slug med id-suffix efter datumet (…-2026-09-09-97344/) ger datumet ändå', () => {
        const e = mapNsfEvent({ ...baseResult, url: '/engagera-dig/kalender/kalmar-sygrupp-lappa-laga-2026-09-09-97344/' })!;
        expect(e).not.toBeNull();
        expect([e.startDate.getFullYear(), e.startDate.getMonth(), e.startDate.getDate()]).toEqual([2026, 8, 9]);
        expect(e.url).toBe('https://www.naturskyddsforeningen.se/engagera-dig/kalender/kalmar-sygrupp-lappa-laga-2026-09-09-97344/');
    });

    // 14/11 2026: id-suffixet är HEXADECIMALT. Regexen från 1/11 tog bara
    // siffror, så bara vart tionde event (idel-siffer-suffix) kom igenom: 27
    // av 239, bl.a. föll Växjökretsens julverkstad (…-306c9) bort.
    it('hexadecimalt id-suffix (…-2026-11-14-306c9/, …-a0768/) ger datumet', () => {
        for (const [slug, day] of [
            ['vaxjo-julverkstad-2026-11-14-306c9', 14],
            ['vaxjo-lagningsverkstad-2026-11-26-4feed', 26],
            ['trollhattan-kladbytardag-i-sjuntorp-2026-11-15-a0768', 15],
            ['blekinge-lan-konferens-om-biologisk-mangfald-i-blekinge-2026-11-14-0044c', 14],
        ] as const) {
            const e = mapNsfEvent({ ...baseResult, url: `/engagera-dig/kalender/${slug}/` })!;
            expect(e, slug).not.toBeNull();
            expect([e.startDate.getFullYear(), e.startDate.getMonth(), e.startDate.getDate()]).toEqual([2026, 10, day]);
        }
        // Ett datum mitt i slugen följt av ord är fortfarande inget eventdatum.
        expect(mapNsfEvent({ ...baseResult, url: '/engagera-dig/kalender/arsmote-2026-03-01-flyttat-till-varen/' })).toBeNull();
    });

    it('utan timeString blir starttiden 00:00 (runnerns heldags-heuristik tar över)', () => {
        const e = mapNsfEvent({ ...baseResult, timeString: '' })!;
        expect(e.startDate.getHours()).toBe(0);
        expect(e.hasSpecificTime).toBeUndefined();
    });

    it('koordinater saknas → location blir geocode-kandidat', () => {
        const e = mapNsfEvent({ ...baseResult, coordinates: undefined })!;
        expect(e.coords).toBeUndefined();
        expect(e.geocodeCandidates).toEqual(['Törnskogens naturreservat']);
    });

    it('excerpt städas från HTML och WP-excerpt-rester ("[…]")', () => {
        expect(mapNsfEvent(baseResult)!.description).toBe('Lär dig slåtter med lie och räfsa');
    });
});
