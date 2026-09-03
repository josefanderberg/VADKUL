import { describe, it, expect } from 'vitest';
import { mapGotEventTeaser, isSeasonTeaser, parseLocalIso } from './gotevent';

const CFG = { defaultCity: 'Göteborg' };
const NOW = new Date(2026, 8, 4, 12, 0);

// Riktiga kort ur GetEventsTeasers 2026-09-04 (nedskalade).
const BOB_DYLAN = {
    title: 'Bob Dylan',
    shortBody: '<p>Bob Dylan till Scandinavium.</p>',
    imageUrl: 'https://gotevent.se/media/x/bob.png?width=640',
    toPageUrl: { text: '', url: '/evenemang/bob-dylan/' },
    dateSpan: 'måndag 19 oktober, 2026, 20:00',
    eventStartDate: '2026-10-19T20:00:00.0000000',
    arena: 'Scandinavium',
    arenaInfo: { postalCode: '402 22', streetAddress: 'Valhallagatan 1', city: 'Göteborg' },
};

const GAIS_SEASON = {
    title: 'GAIS',
    toPageUrl: { url: '/evenemang/gais/' },
    dateSpan: 'Fotbollssäsongen 2026',
    eventStartDate: '2026-09-05T15:00:00.0000000',
    arena: 'Gamla Ullevi',
    arenaInfo: { city: 'Göteborg' },
};

describe('parseLocalIso', () => {
    it('läser .NET-tidsstämpeln som lokal tid (ingen zon i strängen)', () => {
        const d = parseLocalIso('2026-10-19T20:00:00.0000000')!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(9);
        expect(d.getDate()).toBe(19);
        expect(d.getHours()).toBe(20);
    });
    it('avvisar skräp', () => {
        expect(parseLocalIso('')).toBeNull();
        expect(parseLocalIso(undefined)).toBeNull();
        expect(parseLocalIso('19 oktober')).toBeNull();
    });
});

describe('isSeasonTeaser', () => {
    it('känner igen lagsidor på dateSpan', () => {
        expect(isSeasonTeaser(GAIS_SEASON)).toBe(true);
        expect(isSeasonTeaser({ dateSpan: 'Säsongen 2026/2027' })).toBe(true);
        expect(isSeasonTeaser(BOB_DYLAN)).toBe(false);
    });
});

describe('mapGotEventTeaser', () => {
    it('mappar konsertkort med tid, arena, adress och bild', () => {
        const ev = mapGotEventTeaser(BOB_DYLAN, CFG, NOW)!;
        expect(ev.title).toBe('Bob Dylan');
        expect(ev.url).toBe('https://gotevent.se/evenemang/bob-dylan/');
        expect(ev.startDate.getHours()).toBe(20);
        expect(ev.venueName).toBe('Scandinavium');
        expect(ev.address).toBe('Valhallagatan 1');
        expect(ev.city).toBe('Göteborg');
        expect(ev.description).toBe('Bob Dylan till Scandinavium.');
        expect(ev.imageUrl).toContain('bob.png');
        expect(ev.hasSpecificTime).toBe(true);
        expect(ev.endDate).toBeUndefined();
    });

    it('flerdagars-span ger endDate', () => {
        const ev = mapGotEventTeaser({
            ...BOB_DYLAN,
            title: 'Disney On Ice',
            toPageUrl: { url: '/evenemang/disney-on-ice/' },
            dateSpan: '15 januari – 17 januari, 2027',
            eventStartDate: '2027-01-15T15:00:00.0000000',
        }, CFG, NOW)!;
        expect(ev.endDate?.getFullYear()).toBe(2027);
        expect(ev.endDate?.getMonth()).toBe(0);
        expect(ev.endDate?.getDate()).toBe(17);
    });

    it('lagsidor ("Fotbollssäsongen 2026") filtreras — sport-motorerna äger matcherna', () => {
        expect(mapGotEventTeaser(GAIS_SEASON, CFG, NOW)).toBeNull();
    });

    it('midnatt utan klockslag → ingen specifik tid', () => {
        const ev = mapGotEventTeaser({
            ...BOB_DYLAN,
            title: 'Gothenburg Horse Show',
            toPageUrl: { url: '/evenemang/gothenburg-horse-show/' },
            dateSpan: '24 mars – 28 mars, 2027',
            eventStartDate: '2027-03-24T00:00:00.0000000',
        }, CFG, NOW)!;
        expect(ev.hasSpecificTime).toBeUndefined();
    });

    it('kort utan länk eller titel avvisas', () => {
        expect(mapGotEventTeaser({ ...BOB_DYLAN, toPageUrl: null }, CFG, NOW)).toBeNull();
        expect(mapGotEventTeaser({ ...BOB_DYLAN, title: '' }, CFG, NOW)).toBeNull();
    });
});
