import { describe, it, expect } from 'vitest';
import {
    SAME_DISTANCE_KM,
    SEARCH_TIER,
    categoryForWord,
    eventSearchTier,
    filterSearchMatches,
    highlightSegments,
    isFilterQuery,
    nearestOrigin,
    normalizeSearchQuery,
    parseCategoryQuery,
    rankSearchResults,
    searchEvents,
    sortNearestFirst,
    splitCityFromQuery,
} from './search';

const ev = (title: string, extra: { locationName?: string; hostName?: string; url?: string; time?: Date; lat?: number; lng?: number } = {}) => ({
    title,
    time: new Date(2026, 9, 21, 19, 0),
    locationName: '',
    hostName: '',
    url: 'https://example.se/e/1',
    ...extra,
});

describe('normalizeSearchQuery', () => {
    it('trimmar mobilens efterhängda mellanslag och gör gemener', () => {
        expect(normalizeSearchQuery('Håkan ')).toBe('håkan');
        expect(normalizeSearchQuery('  Håkan   Hellström  ')).toBe('håkan hellström');
        expect(normalizeSearchQuery('   ')).toBe('');
    });
});

describe('eventSearchTier', () => {
    it('titelns början slår ordbörjan, som slår mitt i ordet', () => {
        expect(eventSearchTier(ev('Jazzkväll på Pustervik'), 'jazz')).toBe(SEARCH_TIER.TITLE_START);
        expect(eventSearchTier(ev('Kväll med jazz'), 'jazz')).toBe(SEARCH_TIER.TITLE_WORD);
        expect(eventSearchTier(ev('Afrojazz-festival'), 'jazz')).toBe(SEARCH_TIER.TITLE_ANY);
    });
    it('bästa förekomsten vinner när titeln har flera', () => {
        expect(eventSearchTier(ev('Afrojazz och jazz'), 'jazz')).toBe(SEARCH_TIER.TITLE_WORD);
    });
    it('citattecken och emoji först räknas inte bort från början', () => {
        expect(eventSearchTier(ev('”Hamlet” på Dramaten'), 'ham')).toBe(SEARCH_TIER.TITLE_START);
        expect(eventSearchTier(ev('🎃 Halloweenfest'), 'hall')).toBe(SEARCH_TIER.TITLE_START);
    });
    it('åäö och skiftläge', () => {
        expect(eventSearchTier(ev('HÅKAN HELLSTRÖM'), 'håk')).toBe(SEARCH_TIER.TITLE_START);
        expect(eventSearchTier(ev('Konsert: Håkan Hellström'), 'hellström')).toBe(SEARCH_TIER.TITLE_WORD);
    });
    it('plats, arrangör och URL efter titeln - i den ordningen', () => {
        expect(eventSearchTier(ev('Konsert', { locationName: 'Pustervik, Göteborg', hostName: 'Pustervik' }), 'pustervik'))
            .toBe(SEARCH_TIER.LOCATION);
        expect(eventSearchTier(ev('Konsert', { hostName: 'Svenska kyrkan' }), 'kyrkan')).toBe(SEARCH_TIER.HOST);
        expect(eventSearchTier(ev('Konsert', { url: 'https://www.tickster.com/se/x' }), 'tickster')).toBe(SEARCH_TIER.URL);
    });
    it('ingen träff → -1, och saknade fält kastar inte', () => {
        expect(eventSearchTier({ title: 'Loppis' }, 'jazz')).toBe(-1);
    });
});

describe('rankSearchResults', () => {
    const uuid = ev('Morgonbön', { url: 'https://www.svenskakyrkan.se/kalender?event=5b578cb9524541bebfca945d4c5569e1' });

    it('titelträffar först, och UUID-bruset i URL:en följer inte med när annat träffar (klagomålet 11/9)', () => {
        const events = [uuid, ev('Kvällscafé'), ev('Musikcafé', { locationName: 'Café Norra' }), ev('Café Ellen')];
        expect(rankSearchResults(events, 'ca').map(e => e.title))
            .toEqual(['Café Ellen', 'Kvällscafé', 'Musikcafé']);
    });

    it('bara länkträffar = det är sökningen ("tickster" → plattformens event)', () => {
        const tickster = ev('Stå upp', { url: 'https://www.tickster.com/sv/events/abc' });
        expect(rankSearchResults([ev('Loppis'), tickster], 'tickster')).toEqual([tickster]);
    });

    it('tid inom samma nivå, sist listans ordning, och icke-träffar bort', () => {
        const sen = ev('Jazz sen', { time: new Date(2026, 9, 21, 21, 0) });
        const tidig = ev('Jazz tidig', { time: new Date(2026, 9, 21, 18, 0) });
        const lika = ev('Jazz lika', { time: new Date(2026, 9, 21, 21, 0) });
        expect(rankSearchResults([sen, ev('Loppis'), lika, tidig, ev('Kväll med jazz')], 'jazz').map(e => e.title))
            .toEqual(['Jazz tidig', 'Jazz sen', 'Jazz lika', 'Kväll med jazz']);
    });

    it('titel → plats/arrangör → kategori, oavsett detaljnivå inom dem', () => {
        const plats = ev('Kväll', { locationName: 'Jazzklubben' });
        const värd = ev('Afton', { hostName: 'Jazzföreningen' });
        const titel = ev('Afrojazz');
        expect(rankSearchResults([värd, plats, titel], 'jazz')).toEqual([titel, plats, värd]);
    });

    it('NÄROMRÅDET först inom nivån (ägarbeslut 21/10), före titelns detaljnivå och tiden', () => {
        const växjö = { lat: 56.88, lng: 14.81 };
        const stockholm = ev('Jazz i Stockholm', { lat: 59.33, lng: 18.06, time: new Date(2026, 9, 21, 12, 0) });
        const hemma = ev('Kväll med jazz', { lat: 56.87, lng: 14.80, time: new Date(2026, 9, 25, 19, 0) });
        expect(rankSearchResults([stockholm, hemma], 'jazz', växjö)).toEqual([hemma, stockholm]);
        // Utan närområde: detaljnivån (titelns början) som förut.
        expect(rankSearchResults([stockholm, hemma], 'jazz')).toEqual([stockholm, hemma]);
    });

    it('närområdet slår inte nivån: en titelträff långt bort före en platsträff hemma', () => {
        const växjö = { lat: 56.88, lng: 14.81 };
        const titelLångt = ev('Jazz i Stockholm', { lat: 59.33, lng: 18.06 });
        const platsHemma = ev('Kväll', { locationName: 'Jazzklubben', lat: 56.87, lng: 14.80 });
        expect(rankSearchResults([platsHemma, titelLångt], 'jazz', växjö)).toEqual([titelLångt, platsHemma]);
    });

    it('ISO-strängar som tid (appflödet) rankas likadant', () => {
        const sen = { title: 'Jazz sen', time: '2026-10-21T19:00:00.000Z' };
        const tidig = { title: 'Jazz tidig', time: '2026-10-21T16:00:00.000Z' };
        expect(rankSearchResults([sen, tidig], 'jazz')).toEqual([tidig, sen]);
    });

    it('appflödets id ÄR länken när url saknas', () => {
        const app = { title: 'Stå upp', time: '2026-10-21T19:00:00.000Z', id: 'https://www.tickster.com/sv/events/abc' };
        expect(rankSearchResults([app], 'tickster')).toEqual([app]);
    });

    it('tom söktext → listan orörd', () => {
        const events = [ev('A'), ev('B')];
        expect(rankSearchResults(events, '')).toEqual(events);
    });
});

describe('filterSearchMatches', () => {
    it('samma länkregel som rankningen - kartan visar det listan visar', () => {
        const uuid = ev('Morgonbön', { url: 'https://example.se/kalender?event=jazz12' });
        const titel = ev('Jazzkväll');
        expect(filterSearchMatches([uuid, ev('Loppis'), titel], 'jazz')).toEqual([titel]);
        expect(filterSearchMatches([uuid, ev('Loppis')], 'jazz12')).toEqual([uuid]);
    });
});

describe('searchEvents', () => {
    const göteborg = { lat: 57.71, lng: 11.97 };
    const iGbg = ev('Jazz på Pustervik', { lat: 57.70, lng: 11.95 });
    const iSthlm = ev('Jazz på Fasching', { lat: 59.33, lng: 18.06 });

    it('ortnamnet begränsar till ortcirkeln', () => {
        expect(searchEvents([iSthlm, iGbg], 'jazz göteborg')).toEqual([iGbg]);
    });

    it('utan ort rankas närområdet först', () => {
        expect(searchEvents([iSthlm, iGbg], 'jazz', göteborg)).toEqual([iGbg, iSthlm]);
    });

    it('bara orten = allt i cirkeln i tidsordning; tom text = inget', () => {
        const sent = ev('Sent', { lat: 57.71, lng: 11.97, time: new Date(2026, 9, 21, 22, 0) });
        expect(searchEvents([sent, iSthlm, iGbg], 'i göteborg')).toEqual([iGbg, sent]);
        expect(searchEvents([iGbg], '   ')).toEqual([]);
    });
});

describe('highlightSegments', () => {
    it('fetar ALLA förekomster i originalets skiftläge', () => {
        expect(highlightSegments('Jazz på Jazzklubben', 'jazz')).toEqual([
            { text: 'Jazz', hit: true },
            { text: ' på ', hit: false },
            { text: 'Jazz', hit: true },
            { text: 'klubben', hit: false },
        ]);
    });
    it('träff mitt i och i slutet', () => {
        expect(highlightSegments('Kväll med HÅKAN', 'håkan')).toEqual([
            { text: 'Kväll med ', hit: false },
            { text: 'HÅKAN', hit: true },
        ]);
    });
    it('ingen träff eller tom söktext → hela texten ofetad', () => {
        expect(highlightSegments('Loppis', 'jazz')).toEqual([{ text: 'Loppis', hit: false }]);
        expect(highlightSegments('Loppis', '')).toEqual([{ text: 'Loppis', hit: false }]);
    });
    it('gemener med annan längd (İ) → ingen fetstil hellre än fel bokstäver', () => {
        expect(highlightSegments('İstanbul-kväll', 'kväll')).toEqual([{ text: 'İstanbul-kväll', hit: false }]);
    });
});

// 16/9 - användarfeedback: "söka på stad och event" + "bara sport eller musik".
const evc = (title: string, extra: { locationName?: string; hostName?: string; category?: string } = {}) => ({
    title,
    time: new Date(2026, 9, 21, 19, 0),
    locationName: '',
    hostName: '',
    url: 'https://example.se/e/1',
    ...extra,
});

describe('eventSearchTier - flera ord', () => {
    it('hela frasen vinner som förut', () => {
        expect(eventSearchTier(evc('Jazz på Pustervik'), 'jazz på')).toBe(SEARCH_TIER.TITLE_START);
    });

    it('varje ord får matcha ett eget fält - sämsta ordets nivå gäller', () => {
        const e = evc('Jazzkväll', { locationName: 'Pustervik' });
        expect(eventSearchTier(e, 'jazz pustervik')).toBe(SEARCH_TIER.LOCATION);
    });

    it('ett ord som inte matchar något fält fäller hela raden', () => {
        expect(eventSearchTier(evc('Jazzkväll', { locationName: 'Pustervik' }), 'jazz hamnen')).toBe(-1);
    });
});

describe('eventSearchTier - kategoriord', () => {
    it('"sport" hittar sportevent utan ordet i titeln', () => {
        expect(eventSearchTier(evc('Lördagsmatch', { category: 'sport' }), 'sport')).toBe(SEARCH_TIER.CATEGORY);
    });

    it('prefix och böjning räcker ("spo", "marknader")', () => {
        expect(eventSearchTier(evc('Match', { category: 'sport' }), 'spo')).toBe(SEARCH_TIER.CATEGORY);
        expect(eventSearchTier(evc('Höstloppis', { category: 'market' }), 'marknader')).toBe(SEARCH_TIER.CATEGORY);
    });

    it('"festival" drar inte in hela Fest & uteliv', () => {
        expect(eventSearchTier(evc('Klubbkväll', { category: 'party' }), 'festival')).toBe(-1);
    });

    it('Övrigt är inget sökord, och titelträff rankas före kategoriträff', () => {
        expect(eventSearchTier(evc('Något', { category: 'other' }), 'övrigt')).toBe(-1);
        const titel = evc('Sportlov på badet', { category: 'family' });
        const kategori = evc('Innebandy', { category: 'sport' });
        expect(rankSearchResults([kategori, titel], 'sport')).toEqual([titel, kategori]);
    });

    it('kategoriord fungerar som ett av flera ord', () => {
        expect(eventSearchTier(evc('Derby', { category: 'sport', locationName: 'Ullevi' }), 'sport ullevi'))
            .toBe(SEARCH_TIER.CATEGORY);
    });
});

describe('splitCityFromQuery', () => {
    it('ort sist eller först blir plats, resten eventsök', () => {
        expect(splitCityFromQuery('jazz göteborg')).toMatchObject({ city: { name: 'Göteborg' }, text: 'jazz' });
        expect(splitCityFromQuery('göteborg jazz')).toMatchObject({ city: { name: 'Göteborg' }, text: 'jazz' });
    });

    it('bindeord närmast orten tas bort', () => {
        expect(splitCityFromQuery('jazz i göteborg')).toMatchObject({ city: { name: 'Göteborg' }, text: 'jazz' });
        expect(splitCityFromQuery('i göteborg')).toMatchObject({ city: { name: 'Göteborg' }, text: '' });
    });

    it('alias fungerar (sthlm → Stockholm)', () => {
        expect(splitCityFromQuery('quiz sthlm')).toMatchObject({ city: { name: 'Stockholm' }, text: 'quiz' });
    });

    it('ren ortsökning och text utan ort lämnas orörda', () => {
        expect(splitCityFromQuery('göteborg')).toEqual({ city: null, text: 'göteborg' });
        expect(splitCityFromQuery('håkan hellström')).toEqual({ city: null, text: 'håkan hellström' });
    });

    it('gissar aldrig på ett prefix ("jazz kar" är ingen ort)', () => {
        expect(splitCityFromQuery('jazz kar')).toEqual({ city: null, text: 'jazz kar' });
    });
});

describe('kategoriord i söket (20/10)', () => {
    it('hela ord och svenska böjningar räknas', () => {
        expect(categoryForWord('konst')).toBe('art');
        expect(categoryForWord('konsten')).toBe('art');
        expect(categoryForWord('musik')).toBe('music');
        expect(categoryForWord('barnen')).toBe('family');
        expect(categoryForWord('marknader')).toBe('market');
        expect(categoryForWord('träning')).toBe('sport');
    });

    it('synonymerna räknas', () => {
        expect(categoryForWord('teater')).toBe('stage');
        expect(categoryForWord('konserter')).toBe('music');
        expect(categoryForWord('loppis')).toBe('market');
        expect(categoryForWord('utställningar')).toBe('art');
        expect(categoryForWord('vernissage')).toBe('art');
    });

    it('quiz är ingen kategori (21/10) - smalare än Socialt & spel, söks på titeln', () => {
        expect(categoryForWord('quiz')).toBeNull();
        expect(parseCategoryQuery('quiz').size).toBe(0);
    });

    it('halvskrivna ord och ord som bara börjar likadant räknas inte', () => {
        expect(categoryForWord('kon')).toBeNull();
        expect(categoryForWord('match')).toBeNull();
        expect(categoryForWord('mats')).toBeNull();
        expect(categoryForWord('festival')).toBeNull();
        expect(categoryForWord('konstnär')).toBeNull();
    });

    it('källorna kyrkan/PRO och Övrigt är inga kategoriord', () => {
        expect(categoryForWord('kyrkan')).toBeNull();
        expect(categoryForWord('pro')).toBeNull();
        expect(categoryForWord('övrigt')).toBeNull();
    });

    it('bara kategoriord och bindeord ger en kategorisökning', () => {
        expect([...parseCategoryQuery('konst')]).toEqual(['art']);
        expect([...parseCategoryQuery('musik och teater')].sort()).toEqual(['music', 'stage']);
        expect([...parseCategoryQuery('mat & dryck')]).toEqual(['food']);
        expect(parseCategoryQuery('konst jazz').size).toBe(0);
        expect(parseCategoryQuery('jazz').size).toBe(0);
        expect(parseCategoryQuery('och').size).toBe(0);
        expect(parseCategoryQuery('').size).toBe(0);
    });

    it('"konst växjö": orten lossnar först, sedan blir resten kategorin', () => {
        const { city, text } = splitCityFromQuery('konst växjö');
        expect(city?.name).toBe('Växjö');
        expect([...parseCategoryQuery(text)]).toEqual(['art']);
    });
});

describe('isFilterQuery', () => {
    const filterQuery = (q: string) => {
        const { city, text } = splitCityFromQuery(q);
        return isFilterQuery(city, text, parseCategoryQuery(text));
    };

    it('kategoriord och/eller bara en ort är en filterlista', () => {
        expect(filterQuery('konst växjö')).toBe(true);
        expect(filterQuery('konst')).toBe(true);
        expect(filterQuery('musik och teater i göteborg')).toBe(true);
        expect(filterQuery('i växjö')).toBe(true);
    });

    it('fritt sökord och ren ortsökning är det inte', () => {
        expect(filterQuery('jazz växjö')).toBe(false);
        expect(filterQuery('håkan hellström')).toBe(false);
        expect(filterQuery('växjö')).toBe(false);
    });
});

describe('nearestOrigin', () => {
    const bounds = { west: 14.7, south: 56.8, east: 14.9, north: 56.95 };
    const inside = { lat: 56.88, lng: 14.81 };
    const outside = { lat: 59.33, lng: 18.06 };

    it('sökets ort vinner, sedan positionen i rutan', () => {
        expect(nearestOrigin({ lat: 57.7, lng: 11.97 }, inside, bounds)).toEqual({ lat: 57.7, lng: 11.97 });
        expect(nearestOrigin(null, inside, bounds)).toEqual(inside);
    });

    it('positionen utanför rutan väljs bort - då kartans mitt', () => {
        expect(nearestOrigin(null, outside, bounds)).toEqual({ lat: 56.875, lng: 14.8 });
        expect(nearestOrigin(null, null, bounds)).toEqual({ lat: 56.875, lng: 14.8 });
    });

    it('utan ruta: positionen eller inget', () => {
        expect(nearestOrigin(null, outside, null)).toEqual(outside);
        expect(nearestOrigin(null, null, null)).toBeNull();
    });
});

describe('sortNearestFirst', () => {
    const växjö = { lat: 56.8777, lng: 14.8094 };
    const at = (id: string, h: number, lat: number, lng: number) =>
        ({ id, time: new Date(2026, 9, 20, h, 0), lat, lng });
    const nära = at('nara', 21, 56.88, 14.81);
    const mitt = at('mitt', 18, 57.78, 14.16);
    const långt = at('langt', 13, 59.33, 18.06);

    it('närmast först, oavsett klockslag', () => {
        expect(sortNearestFirst([långt, mitt, nära], växjö).map(e => e.id)).toEqual(['nara', 'mitt', 'langt']);
    });

    it(`inom ${SAME_DISTANCE_KM} km gäller klockslaget, inte metrarna`, () => {
        // ~0,1 km kl 21 och ~1 km kl 14 - samma band, tidigast först.
        const enKm = at('enkm', 14, 56.886, 14.81);
        expect(sortNearestFirst([nära, enKm], växjö).map(e => e.id)).toEqual(['enkm', 'nara']);
    });

    it('lika klockslag i samma band behåller indataordningen', () => {
        const a = at('a', 19, 56.88, 14.81);
        const b = at('b', 19, 56.881, 14.811);
        expect(sortNearestFirst([b, a], växjö).map(e => e.id)).toEqual(['b', 'a']);
        expect(sortNearestFirst([a, b], växjö).map(e => e.id)).toEqual(['a', 'b']);
    });

    it('event utan koordinater hamnar sist', () => {
        const utan = { id: 'utan', time: new Date(2026, 9, 20, 8, 0) };
        const nollnoll = at('nollnoll', 9, 0, 0);
        expect(sortNearestFirst([utan, nollnoll, långt, nära], växjö).map(e => e.id))
            .toEqual(['nara', 'langt', 'utan', 'nollnoll']);
    });
});
