import { describe, it, expect } from 'vitest';
import { websiteOf, rankVenueCandidates, regionSlug, candidateLine, unresolvedVenues, domainGuesses, looksLikeVenueSite } from './venueCandidates';

const poi = (tags: Record<string, string>) => ({ tags });

describe('websiteOf', () => {
    it('website, contact:website och url — med eller utan protokoll och sökväg', () => {
        expect(websiteOf({ website: 'https://www.chapterhouse.se/event-nyheter/' })).toEqual({ base: 'https://www.chapterhouse.se', domain: 'chapterhouse.se' });
        expect(websiteOf({ 'contact:website': 'keunjoo.se' })).toEqual({ base: 'https://keunjoo.se', domain: 'keunjoo.se' });
        expect(websiteOf({ url: 'http://Slottsstallarna.com' })).toEqual({ base: 'https://slottsstallarna.com', domain: 'slottsstallarna.com' });
        expect(websiteOf({ website: 'https://a.se; https://b.se' })?.domain).toBe('a.se');
    });

    it('sociala medier, boknings- och menytjänster är inte ställets egen sajt', () => {
        expect(websiteOf({ website: 'https://www.facebook.com/kafedeluxe' })).toBeNull();
        expect(websiteOf({ website: 'https://www.instagram.com/x/' })).toBeNull();
        expect(websiteOf({ website: 'https://krogen.bokabord.se' })).toBeNull();
        expect(websiteOf({ website: 'https://linktr.ee/baren' })).toBeNull();
        expect(websiteOf({ website: 'inte en adress' })).toBeNull();
        expect(websiteOf({})).toBeNull();
        expect(websiteOf(undefined)).toBeNull();
    });
});

describe('rankVenueCandidates', () => {
    it('livemusik och scener först, restauranger sist', () => {
        const ranked = rankVenueCandidates([
            poi({ name: 'Restaurang Exempel', amenity: 'restaurant', website: 'https://restaurangexempel.se' }),
            poi({ name: 'Kafé de luxe', amenity: 'cafe', live_music: 'yes', website: 'https://www.kafedeluxe.se' }),
            poi({ name: 'Chapter House', amenity: 'pub', website: 'https://chapterhouse.se' }),
            poi({ name: 'Palladium', amenity: 'theatre', website: 'https://palladiumvaxjo.se' }),
        ]);
        expect(ranked.map((c) => c.name)).toEqual(['Kafé de luxe', 'Palladium', 'Chapter House', 'Restaurang Exempel']);
        expect(ranked[0]).toMatchObject({ kind: 'cafe', score: 6, domain: 'kafedeluxe.se' });
    });

    it('platser utan namn, utan webbplats eller av annan typ hoppas', () => {
        expect(rankVenueCandidates([
            poi({ amenity: 'pub', website: 'https://namnlos.se' }),
            poi({ name: 'Baren utan sajt', amenity: 'bar' }),
            poi({ name: 'Apoteket', amenity: 'pharmacy', website: 'https://apoteket.se' }),
            poi({ name: 'Baren på Facebook', amenity: 'bar', website: 'https://facebook.com/baren' }),
        ])).toEqual([]);
    });

    it('en domän som delas av flera ställen i orten är en kedja eller galleria', () => {
        const chain = ['Centrum', 'Samarkand', 'Grand'].map((n) => poi({ name: `Espresso House ${n}`, amenity: 'cafe', website: 'https://espressohouse.com/se' }));
        const ranked = rankVenueCandidates([...chain, poi({ name: 'Mono', amenity: 'bar', website: 'https://monovaxjo.se' })]);
        expect(ranked.map((c) => c.domain)).toEqual(['monovaxjo.se']);
    });

    it('samma ställe taggat två gånger ger en kandidat', () => {
        const ranked = rankVenueCandidates([
            poi({ name: 'PM & Vänner', amenity: 'restaurant', website: 'https://pmrestauranger.se' }),
            poi({ name: 'PM & Vänner', tourism: 'hotel', website: 'https://pmrestauranger.se/hotell' }),
            poi({ name: 'PM & Vänner Bar', amenity: 'bar', website: 'https://pmrestauranger.se/bar' }),
        ]);
        expect(ranked).toHaveLength(1);
        expect(ranked[0]).toMatchObject({ name: 'PM & Vänner Bar', kind: 'bar' });
    });
});

describe('regionSlug / candidateLine', () => {
    it('ort → region-id och kandidatrad i snöbollens format', () => {
        expect(regionSlug('Växjö')).toBe('vaxjo');
        expect(regionSlug('Upplands Väsby')).toBe('upplands-vasby');
        expect(candidateLine({ name: 'Bar | Scen', base: 'https://baren.se', domain: 'baren.se', kind: 'bar', score: 3 }, 'Växjö'))
            .toBe('Bar / Scen|vaxjo|https://baren.se|Växjö|ställe');
    });
});

describe('ställen utan webbadress i OSM (Växjö 14/11)', () => {
    it('unresolvedVenues: scener och krogar, restauranger bara med livemusik', () => {
        const list = unresolvedVenues([
            poi({ name: 'Chapter House', amenity: 'bar' }),
            poi({ name: 'Slottsstallarna', amenity: 'nightclub' }),
            poi({ name: 'keun joo:', amenity: 'restaurant' }),
            poi({ name: 'Livekrogen', amenity: 'restaurant', live_music: 'yes' }),
            poi({ name: 'Växjö Teater', amenity: 'theatre' }),
            poi({ name: 'The Bishops Arms', amenity: 'pub', website: 'https://www.bishopsarms.com' }),
            poi({ name: 'Espresso House', amenity: 'cafe' }),
        ]);
        expect(list.map((v) => v.name)).toEqual(['Livekrogen', 'Slottsstallarna', 'Växjö Teater', 'Chapter House']);
    });

    it('unresolvedVenues med includeFood: restauranger och caféer sist', () => {
        const list = unresolvedVenues([
            poi({ name: 'keun joo:', amenity: 'restaurant' }),
            poi({ name: 'Slottsstallarna', amenity: 'nightclub' }),
            poi({ name: 'Café Fontaine', amenity: 'cafe' }),
            poi({ name: 'Apoteket', amenity: 'pharmacy' }),
        ], true);
        expect(list.map((v) => v.name)).toEqual(['Slottsstallarna', 'Café Fontaine', 'keun joo:']);
    });

    it('looksLikeVenueSite: orten räcker i metadata när namnet står i texten (Slottsstallarna)', () => {
        const filler = 'Pub, disco och konserter i gamla stallet. '.repeat(10);
        const page = `<html><head><meta name="description" content="Nattklubb i Växjö"></head><body><h1>Slottsstallarna</h1><p>${filler}</p></body></html>`;
        expect(looksLikeVenueSite(page, 'Slottsstallarna', 'Växjö')).toBe(true);
        expect(looksLikeVenueSite(page.replace('Nattklubb i Växjö', 'Nattklubb'), 'Slottsstallarna', 'Växjö')).toBe(false);
    });

    it('domainGuesses: ihopskrivet, med ort, med bindestreck — beskrivande ord skalas av', () => {
        expect(domainGuesses('Chapter House', 'Växjö')).toEqual(['chapterhouse.se', 'chapterhouse.com', 'chapterhousevaxjo.se', 'chapter-house.se', 'chapterhouse.nu']);
        expect(domainGuesses('keun joo:', 'Växjö')).toContain('keunjoo.se');
        expect(domainGuesses('Slottsstallarna', 'Växjö')).toEqual(['slottsstallarna.se', 'slottsstallarna.com', 'slottsstallarnavaxjo.se', 'slottsstallarna.nu']);
        expect(domainGuesses('Mono', 'Växjö')).toContain('monovaxjo.se');
        expect(domainGuesses('PM & Vänner Bistro', 'Växjö')).toContain('pmvanner.se');
        expect(domainGuesses('The Bishops Arms', 'Växjö')).toContain('bishopsarms.se');
        expect(domainGuesses('Växjö Teater', 'Växjö')[0]).toBe('vaxjoteater.se');
    });

    it('för korta namn och rena ortnamn ger inga gissningar', () => {
        expect(domainGuesses('Oas', 'Växjö')).toEqual([]);
        expect(domainGuesses('Bar', 'Växjö')).toEqual([]);
        expect(domainGuesses('Växjö', 'Växjö')).toEqual([]);
    });

    it('looksLikeVenueSite: sidan måste nämna både orten och ställets namn', () => {
        const filler = 'Välkommen in på en öl och en bit mat. '.repeat(12);
        const own = `<html><body><h1>Chapter House</h1><p>Craft Beer Excellence i Växjö. ${filler}</p></body></html>`;
        expect(looksLikeVenueSite(own, 'Chapter House', 'Växjö')).toBe(true);
        // Samma namn, annan ort: en bokhandel i Lund.
        expect(looksLikeVenueSite(own.replace('Växjö', 'Lund'), 'Chapter House', 'Växjö')).toBe(false);
        // Rätt ort, annat ställe.
        expect(looksLikeVenueSite(`<html><body><h1>Hotell Statt</h1><p>Mitt i Växjö. ${filler}</p></body></html>`, 'Chapter House', 'Växjö')).toBe(false);
        // Namnet ihopskrivet i sidhuvudet räcker ("keunjoo").
        expect(looksLikeVenueSite(`<html><body><p>Välkommen till keunjoo i Växjö. ${filler}</p></body></html>`, 'keun joo:', 'Växjö')).toBe(true);
    });

    it('looksLikeVenueSite: parkerade domäner och tomma sidor räknas inte', () => {
        const filler = 'Lorem ipsum dolor sit amet. '.repeat(20);
        expect(looksLikeVenueSite(`<html><body><h1>chapterhouse.se</h1><p>Domänen är till salu. Chapter House Växjö. ${filler}</p></body></html>`, 'Chapter House', 'Växjö')).toBe(false);
        expect(looksLikeVenueSite('<html><body>Chapter House Växjö</body></html>', 'Chapter House', 'Växjö')).toBe(false);
    });
});
