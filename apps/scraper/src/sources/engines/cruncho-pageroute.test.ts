import { describe, it, expect } from 'vitest';
import { mapCrunchoPageEvent, decodeCrunchoImage, type CrunchoPageEvent } from './cruncho';

const CFG = { pageUrl: 'https://www.almhult.se/evenemang', defaultCity: 'Älmhult' } as any;
// 7 sep 2026 = måndag.
const NOW = new Date(2026, 8, 7, 12, 0, 0);

// Riktig post ur almhult.se 2026-09-07.
const EV: CrunchoPageEvent = {
    id: '6a87cdadd4654250c98415d6',
    name: "Oasis: Don't Look Back In Anger",
    link: '/upplevgora/evenemang/visaevenemang.4144.html?sv.target=12.18df5c95&id=6a87cdadd4654250c98415d6',
    venue: 'Folkets Hus',
    description: 'OASIS: DON\'T LOOK BACK IN ANGER\r\n16 år efter splittringen…',
    date: { nextDate: 'fredag 11 sep', nextTime: '20.00', additionalOccasions: null },
    categories: [{ name: 'Filmer' }],
};

describe('mapCrunchoPageEvent', () => {
    it('tolkar datum utan år med veckodagen som facit', () => {
        const ev = mapCrunchoPageEvent(EV, CFG, NOW)!;
        expect(ev.startDate.getFullYear()).toBe(2026);
        expect(ev.startDate.getMonth()).toBe(8);
        expect(ev.startDate.getDate()).toBe(11);
        expect(ev.startDate.getHours()).toBe(20);
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('gör link absolut — url är primärnyckel och måste vara unik', () => {
        const a = mapCrunchoPageEvent(EV, CFG, NOW)!;
        const b = mapCrunchoPageEvent({ ...EV, id: 'annat', link: EV.link!.replace('6a87cdadd4654250c98415d6', 'annat') }, CFG, NOW)!;
        expect(a.url.startsWith('https://www.almhult.se/')).toBe(true);
        expect(a.url).not.toBe(b.url);
    });

    it('sätter ort och venue', () => {
        const ev = mapCrunchoPageEvent(EV, CFG, NOW)!;
        expect(ev.city).toBe('Älmhult');
        expect(ev.venueName).toBe('Folkets Hus');
    });

    it('lägger kategorin i classifyHints, inte i beskrivningen', () => {
        const ev = mapCrunchoPageEvent(EV, CFG, NOW)!;
        expect(ev.classifyHints).toBe('Filmer');
        expect(ev.description).not.toContain('Filmer');
    });

    it('slänger poster utan datum, titel eller link', () => {
        expect(mapCrunchoPageEvent({ ...EV, date: null }, CFG, NOW)).toBeNull();
        expect(mapCrunchoPageEvent({ ...EV, name: '  ' }, CFG, NOW)).toBeNull();
        expect(mapCrunchoPageEvent({ ...EV, link: undefined }, CFG, NOW)).toBeNull();
    });

    it('slänger posten hellre än att datera fel när veckodagen inte går ihop', () => {
        // 14 dec 2026 är måndag; "söndag 14 dec" stämmer inte något närliggande år framåt.
        expect(mapCrunchoPageEvent(
            { ...EV, date: { nextDate: 'söndag 14 dec', nextTime: '16.30' } }, CFG, NOW,
        )).toBeNull();
    });

    it('klarar heldagspost utan klockslag', () => {
        const ev = mapCrunchoPageEvent({ ...EV, date: { nextDate: 'fredag 11 sep' } }, CFG, NOW)!;
        expect(ev.hasSpecificTime).toBeUndefined();
    });
});

describe('decodeCrunchoImage', () => {
    it('plockar bild-URL ur JWT-payloaden', () => {
        const payload = Buffer.from(JSON.stringify({
            url: encodeURIComponent('https://ik.imagekit.io/cruncho/scrapers/kaxig-22410-0.jpg'),
        })).toString('base64url');
        expect(decodeCrunchoImage(`header.${payload}.sig`))
            .toBe('https://ik.imagekit.io/cruncho/scrapers/kaxig-22410-0.jpg');
    });

    it('ger undefined för skräp i stället för att kasta', () => {
        expect(decodeCrunchoImage(undefined)).toBeUndefined();
        expect(decodeCrunchoImage('inte-en-jwt')).toBeUndefined();
        expect(decodeCrunchoImage('a.inte-base64-json.c')).toBeUndefined();
    });
});
