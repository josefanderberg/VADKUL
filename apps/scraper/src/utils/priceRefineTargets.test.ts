import { describe, it, expect } from 'vitest';
import { priceRefineFetchUrl, refineHost, templatePrice, roundRobin } from './priceRefineTargets';

describe('priceRefineFetchUrl', () => {
    it('vanliga detaljsidor hämtas som de är', () => {
        expect(priceRefineFetchUrl('https://www.abf.se/halland/kurs/musikquiz-3928257/')).toBe('https://www.abf.se/halland/kurs/musikquiz-3928257/');
        expect(priceRefineFetchUrl('https://goteborg.se/wps/portal/kalendarium/kalendarium-start?activityId=f50497d8'))
            .toBe('https://goteborg.se/wps/portal/kalendarium/kalendarium-start?activityId=f50497d8');
    });

    it('datumfragment tas bort så speldatumen delar en hämtning', () => {
        expect(priceRefineFetchUrl('https://www.riksteatern.se/forestallningar/quinnorna2/202611291300-140301G#2026-11-29'))
            .toBe('https://www.riksteatern.se/forestallningar/quinnorna2/202611291300-140301G');
        expect(priceRefineFetchUrl('https://visitvarmland.com/evenemang/marknad/julkvall-vid-hyttan#2026-11-20'))
            .toBe('https://visitvarmland.com/evenemang/marknad/julkvall-vid-hyttan');
    });

    it('SPA-rutter i fragmentet hoppas över (bibliotekens evenemangssidor)', () => {
        expect(priceRefineFetchUrl('https://www.bibliotekfh.se/evenemang#6cd45a6e-4b99-48bf-af0a-acb61a332d6c')).toBeNull();
        expect(priceRefineFetchUrl('https://bibliotekfh.se/evenemang#/events/2c4475ca-c86a-4043-b035-ecd468e480b7')).toBeNull();
    });

    it('värdar utan pris i HTML:en hoppas över', () => {
        expect(priceRefineFetchUrl('https://www.svenskakyrkan.se/kalender?event=4a1b')).toBeNull();
        expect(priceRefineFetchUrl('https://www.facebook.com/events/1320061696749703/')).toBeNull();
        expect(priceRefineFetchUrl('https://www.tickster.com/se/sv/events/kaapwm5651a88dx/2026-11-14/larz-kristerz')).toBeNull();
        expect(priceRefineFetchUrl('https://www.ticketmaster.se/event/12345')).toBeNull();
        expect(priceRefineFetchUrl('https://stats.swehockey.se/Game/Events/1234')).toBeNull();
        expect(priceRefineFetchUrl('https://korpenstockholm.zoezi.se/activity/1')).toBeNull();
    });

    it('en värd som bara LIKNAR en spärrad värd hämtas', () => {
        expect(priceRefineFetchUrl('https://minatickster.com.example.se/e/1')).toBe('https://minatickster.com.example.se/e/1');
    });

    it('skräp och andra protokoll ger null', () => {
        expect(priceRefineFetchUrl('')).toBeNull();
        expect(priceRefineFetchUrl('inte en url')).toBeNull();
        expect(priceRefineFetchUrl('mailto:info@example.se')).toBeNull();
    });
});

describe('refineHost', () => {
    it('www. bort, gemener', () => {
        expect(refineHost('https://WWW.Kalmar.com/evenemang/x')).toBe('kalmar.com');
        expect(refineHost('skräp')).toBeNull();
    });
});

describe('templatePrice', () => {
    const pages = (price: string, n: number, title = (i: number) => `Föredrag nummer ${'abcdefghijklmnop'[i]}`) =>
        Array.from({ length: n }, (_, i) => ({ price, title: title(i) }));

    it('samma belopp på många olika event = sidmallens pris', () => {
        expect(templatePrice(pages('120 kr', 12))).toBe('120 kr');
        expect(templatePrice([...pages('120 kr', 10), { price: '80 kr', title: 'Barnlördag' }])).toBe('120 kr');
    });

    it('ett återkommande event med en sida per datum är ingen mall (Trosas escape room)', () => {
        expect(templatePrice(pages('250–360 kr', 12, (i) => `Escape room – promenadspel ${15 + i}/11`))).toBeNull();
    });

    it('blandade belopp är riktiga priser', () => {
        const mixed = ['100 kr', '250 kr', '100 kr', '395 kr', '50 kr', '100 kr', '150 kr', '200 kr']
            .map((price, i) => ({ price, title: `Konsert ${'abcdefgh'[i]}` }));
        expect(templatePrice(mixed)).toBeNull();
    });

    it('gratis överallt hålls inte tillbaka, och få event räcker inte för att döma', () => {
        expect(templatePrice(pages('Gratis', 16))).toBeNull();
        expect(templatePrice([...pages('Gratis', 16), ...pages('120 kr', 5)])).toBeNull();
        expect(templatePrice(pages('120 kr', 7))).toBeNull();
    });
});

describe('roundRobin', () => {
    it('en per värd och varv, upp till taket', () => {
        expect(roundRobin([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']], 10)).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
        expect(roundRobin([['a1', 'a2', 'a3'], ['b1'], ['c1', 'c2']], 4)).toEqual(['a1', 'b1', 'c1', 'a2']);
        expect(roundRobin([], 5)).toEqual([]);
    });
});

describe('priceRefineFetchUrl — listing-motorns fragment', () => {
    it('en programsida med många event hämtas inte för ETT events pris', () => {
        expect(priceRefineFetchUrl('https://www.palladiumvaxjo.se/evenemang/#2026-11-21-en-kvall-med-shan-atci')).toBeNull();
        expect(priceRefineFetchUrl('https://chapterhouse.se/event-nyheter/#2026-12-05-julinspirerad-olprovning')).toBeNull();
    });

    it('en egen detaljsida med bara datum i fragmentet hämtas som förut', () => {
        expect(priceRefineFetchUrl('https://x.se/pa-scen/jazzkvall/#2026-11-21')).toBe('https://x.se/pa-scen/jazzkvall/');
    });
});
