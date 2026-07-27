import { describe, it, expect } from 'vitest';
import {
    parseGotlandTime,
    slugifyName,
    pickOccurrence,
    mapGotlandComEvent,
} from './gotlandcom';

const FROM = new Date(2026, 6, 27); // 2026-07-27

describe('parseGotlandTime', () => {
    it('HH.MM / HH:MM / HH,MM', () => {
        expect(parseGotlandTime('14.00')).toEqual({ h: 14, m: 0 });
        expect(parseGotlandTime('9:30')).toEqual({ h: 9, m: 30 });
        expect(parseGotlandTime('20,00')).toEqual({ h: 20, m: 0 });
    });

    it('intervall tar starttiden', () => {
        expect(parseGotlandTime('14-16')).toEqual({ h: 14, m: 0 });
        expect(parseGotlandTime('14.00-16.00')).toEqual({ h: 14, m: 0 });
        expect(parseGotlandTime('13-14.30')).toEqual({ h: 13, m: 0 });
    });

    it('kompakt och kl-prefix', () => {
        expect(parseGotlandTime('1400')).toEqual({ h: 14, m: 0 });
        expect(parseGotlandTime('kl 11-17')).toEqual({ h: 11, m: 0 });
    });

    it('tomt/skräp → null', () => {
        expect(parseGotlandTime('')).toBeNull();
        expect(parseGotlandTime(undefined)).toBeNull();
        expect(parseGotlandTime('hela dagen')).toBeNull();
        expect(parseGotlandTime('99.99')).toBeNull();
    });
});

describe('slugifyName', () => {
    it('svenska tecken och skiljetecken', () => {
        expect(slugifyName('Åkessonger')).toBe('akessonger');
        expect(slugifyName('Kritcirkeln - Teater på Närsakar')).toBe('kritcirkeln-teater-pa-narsakar');
        expect(slugifyName('"Soleld"- en konstpromenad')).toBe('soleld-en-konstpromenad');
    });
});

describe('pickOccurrence', () => {
    it('första kommande tillfället vinner', () => {
        const occ = pickOccurrence([
            { date: ['2026-07-01', '2026-07-01'], time: '19.00' },
            { date: ['2026-08-10', '2026-08-10'], time: '19.00' },
            { date: ['2026-08-03', '2026-08-03'], time: '19.00' },
        ], FROM);
        expect(occ?.start.getDate()).toBe(3);
        expect(occ?.start.getMonth()).toBe(7);
    });

    it('pågående långkörare ankras på from-dagen', () => {
        const occ = pickOccurrence([{ date: ['2026-06-01', '2026-08-30'], time: '' }], FROM);
        expect(occ?.start.getFullYear()).toBe(2026);
        expect(occ?.start.getMonth()).toBe(6);
        expect(occ?.start.getDate()).toBe(27);
        expect(occ?.end?.getMonth()).toBe(7);
    });

    it('helt passerade → null', () => {
        expect(pickOccurrence([{ date: ['2026-05-01', '2026-05-02'], time: '' }], FROM)).toBeNull();
        expect(pickOccurrence([], FROM)).toBeNull();
        expect(pickOccurrence(undefined, FROM)).toBeNull();
    });
});

describe('mapGotlandComEvent', () => {
    const base = {
        id: 85021,
        name: 'Vi pratar om HAVET',
        description: '<div>&nbsp;</div><div><strong>MPA-Day</strong> l&auml;ser h&ouml;gt</div>',
        contact: {
            street: 'Vamlingbo prästgård', zip: '62331', city: 'Burgsvik',
            socken: 'vamlingbo', telephone: '', email: 'info@vamlingboprastgard.se',
            web: 'vamlingboprastgard.se',
        },
        coordinates: { lat: 56.9694462, lng: 18.2305805 },
        images: ['https://cdn.example/x.jpg'],
        category: 'Friluftsliv och Natur',
        company: { name: 'Vamlingbo Prästgård', logo: '' },
        prices: [{ info: 'Vuxen', price: '250' }],
        dates: [{ date: ['2026-08-01', '2026-08-01'] as [string, string], time: '14.00' }],
    };
    const urlFor = () => 'https://gotland.com/events/vi-pratar-om-havet/';

    it('mappar fullt event', () => {
        const ev = mapGotlandComEvent(base, urlFor, FROM, 'Gotland');
        expect(ev?.title).toBe('Vi pratar om HAVET');
        expect(ev?.startDate.getHours()).toBe(14);
        expect(ev?.city).toBe('Burgsvik');
        expect(ev?.coords?.[0]).toBeCloseTo(56.969, 2);
        expect(ev?.hostName).toBe('Vamlingbo Prästgård');
        expect(ev?.price).toBe('Vuxen 250');
        expect(ev?.hasSpecificTime).toBe(true);
        expect(ev?.description).not.toContain('&auml;');
        expect(ev?.description).toContain('läser högt');
    });

    it('SvK-event skippas (svk-flood-policyn)', () => {
        const svk = { ...base, contact: { ...base.contact, web: 'svenskakyrkan.se/visby' } };
        expect(mapGotlandComEvent(svk, urlFor, FROM, 'Gotland')).toBeNull();
    });

    it('skräp-city "." → socken; skräp-company "." → ingen host', () => {
        const junk = {
            ...base,
            contact: { ...base.contact, city: '.', socken: 'vamlingbo' },
            company: { name: '.', logo: '' },
        };
        const ev = mapGotlandComEvent(junk, urlFor, FROM, 'Gotland');
        expect(ev?.city).toBe('Vamlingbo');
        expect(ev?.hostName).toBeUndefined();
    });

    it('VERSAL-city normaliseras', () => {
        const caps = { ...base, contact: { ...base.contact, city: 'VISBY' } };
        expect(mapGotlandComEvent(caps, urlFor, FROM, 'Gotland')?.city).toBe('Visby');
    });

    it('koordinater utanför Gotland förkastas', () => {
        const off = { ...base, coordinates: { lat: 59.33, lng: 18.06 } }; // Stockholm
        expect(mapGotlandComEvent(off, urlFor, FROM, 'Gotland')?.coords).toBeUndefined();
    });

    it('utan tid → hasSpecificTime undefined', () => {
        const noTime = { ...base, dates: [{ date: ['2026-08-01', '2026-08-01'] as [string, string], time: '' }] };
        const ev = mapGotlandComEvent(noTime, urlFor, FROM, 'Gotland');
        expect(ev?.hasSpecificTime).toBeUndefined();
    });
});
