import { describe, expect, it } from 'vitest';
import { chunk, groupOrganizers, nearestPlace, OrganizerEventRow, siteDomain } from './organizerStats';

const NOW = '2026-09-28T00:00:00.000Z';
const PLACES = [
    { name: 'Växjö', lat: 56.88, lng: 14.81 },
    { name: 'Göteborg', lat: 57.71, lng: 11.97 },
];
const placeOf = (lat: number | null, lng: number | null) => nearestPlace(PLACES, lat, lng);

function ev(p: Partial<OrganizerEventRow> & { url: string }): OrganizerEventRow {
    return { title: 'Event', time: '2026-10-01T18:00:00.000Z', hostName: 'ABF', category: 'music', lat: 56.88, lng: 14.81, ...p };
}

describe('siteDomain', () => {
    it('tar bort www och gör gemener', () => {
        expect(siteDomain('https://WWW.Abf.se/evenemang/1')).toBe('abf.se');
    });
    it('ger null för icke-URL:er', () => {
        expect(siteDomain('abc123')).toBeNull();
    });
});

describe('nearestPlace', () => {
    it('hittar närmaste ort inom gränsen', () => {
        expect(placeOf(56.9, 14.8)).toBe('Växjö');
    });
    it('ger null utan koordinat eller för långt bort', () => {
        expect(placeOf(null, null)).toBeNull();
        expect(placeOf(65.5, 22.1)).toBeNull();
    });
});

describe('groupOrganizers', () => {
    it('grupperar på namn + domän och räknar kommande', () => {
        const rows = [
            ev({ url: 'https://abf.se/1' }),
            ev({ url: 'https://abf.se/2', title: 'Annat' }),
            ev({ url: 'https://abf.se/3', title: 'Tredje' }),
            ev({ url: 'https://abf.se/gammal', time: '2026-09-10T18:00:00.000Z' }),
        ];
        const [o] = groupOrganizers(rows, { nowIso: NOW, placeOf });
        expect(o.namn).toBe('ABF');
        expect(o.doman).toBe('abf.se');
        expect(o.kanal).toBe('mejl');
        expect(o.kommande).toBe(3);
        expect(o.eventTotalt).toBe(4);
        expect(o.urls).toHaveLength(4);
        expect(o.orter).toEqual(['Växjö']);
    });

    it('håller isär samma namn på olika sajter', () => {
        const rows = [1, 2, 3].flatMap(i => [
            ev({ url: `https://goteborg.se/${i}`, hostName: 'Stadsbiblioteket', lat: 57.7, lng: 11.9 }),
            ev({ url: `https://malmo.se/${i}`, hostName: 'Stadsbiblioteket' }),
        ]);
        expect(groupOrganizers(rows, { nowIso: NOW, placeOf }).map(o => o.nyckel).sort())
            .toEqual(['stadsbiblioteket|goteborg.se', 'stadsbiblioteket|malmo.se']);
    });

    it('slänger biljettplattformar och generiska källnamn', () => {
        const rows = [1, 2, 3].flatMap(i => [
            ev({ url: `https://www.tickster.com/${i}`, hostName: 'Någon arrangör' }),
            ev({ url: `https://facebook.com/events/${i}`, hostName: 'Facebook' }),
        ]);
        expect(groupOrganizers(rows, { nowIso: NOW, placeOf })).toEqual([]);
    });

    it('Facebook-arrangörer får kanalen facebook', () => {
        const rows = [1, 2, 3].map(i => ev({ url: `https://www.facebook.com/events/${i}`, hostName: 'Kulturföreningen' }));
        expect(groupOrganizers(rows, { nowIso: NOW, placeOf })[0].kanal).toBe('facebook');
    });

    it('kräver minst minUpcoming kommande event', () => {
        const rows = [ev({ url: 'https://abf.se/1' }), ev({ url: 'https://abf.se/2' })];
        expect(groupOrganizers(rows, { nowIso: NOW, placeOf })).toEqual([]);
        expect(groupOrganizers(rows, { nowIso: NOW, placeOf, minUpcoming: 2 })).toHaveLength(1);
    });

    it('exemplen är närmaste kommande, en per titel', () => {
        const rows = [
            ev({ url: 'https://abf.se/3', title: 'Sist', time: '2026-10-09T10:00:00.000Z' }),
            ev({ url: 'https://abf.se/1', title: 'Först', time: '2026-10-01T10:00:00.000Z' }),
            ev({ url: 'https://abf.se/2', title: 'Först', time: '2026-10-02T10:00:00.000Z' }),
        ];
        const [o] = groupOrganizers(rows, { nowIso: NOW, placeOf });
        expect(o.exempel.map(e => e.titel)).toEqual(['Först', 'Sist']);
        expect(o.exempel[0].ort).toBe('Växjö');
    });

    it('visar den vanligaste stavningen av namnet', () => {
        const rows = [
            ev({ url: 'https://abf.se/1', hostName: 'ABF Växjö' }),
            ev({ url: 'https://abf.se/2', hostName: 'abf växjö' }),
            ev({ url: 'https://abf.se/3', hostName: 'ABF Växjö' }),
        ];
        const res = groupOrganizers(rows, { nowIso: NOW, placeOf });
        expect(res).toHaveLength(1);
        expect(res[0].namn).toBe('ABF Växjö');
    });
});

describe('chunk', () => {
    it('delar i bitar om 30', () => {
        const parts = chunk(Array.from({ length: 65 }, (_, i) => i));
        expect(parts.map(p => p.length)).toEqual([30, 30, 5]);
    });
});
