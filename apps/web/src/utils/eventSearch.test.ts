import { describe, it, expect } from 'vitest';
import {
    SEARCH_TIER,
    eventSearchTier,
    highlightSegments,
    normalizeSearchQuery,
    rankSearchResults,
    splitCityFromQuery,
} from './eventSearch';

const ev = (title: string, extra: { locationName?: string; hostName?: string; url?: string } = {}) => ({
    title,
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
    it('plats, arrangör och URL efter titeln — i den ordningen', () => {
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
    it('UUID-bruset i URL:en hamnar sist, titelträffar först (klagomålet 11/9)', () => {
        const events = [
            ev('Morgonbön', { url: 'https://www.svenskakyrkan.se/kalender?event=5b578cb9524541bebfca945d4c5569e1' }),
            ev('Kvällscafé'),
            ev('Musikcafé', { locationName: 'Café Norra' }),
            ev('Café Ellen'),
        ];
        expect(rankSearchResults(events, 'ca').map(e => e.title))
            .toEqual(['Café Ellen', 'Kvällscafé', 'Musikcafé', 'Morgonbön']);
    });
    it('behåller listans (tid-)ordning inom samma nivå och slänger icke-träffar', () => {
        const events = [ev('Jazz tidig'), ev('Loppis'), ev('Jazz sen'), ev('Kväll med jazz')];
        expect(rankSearchResults(events, 'jazz').map(e => e.title))
            .toEqual(['Jazz tidig', 'Jazz sen', 'Kväll med jazz']);
    });
    it('tom söktext → listan orörd', () => {
        const events = [ev('A'), ev('B')];
        expect(rankSearchResults(events, '')).toBe(events);
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

// 16/9 — användarfeedback: "söka på stad och event" + "bara sport eller musik".
const evc = (title: string, extra: { locationName?: string; hostName?: string; category?: string } = {}) => ({
    title,
    locationName: '',
    hostName: '',
    url: 'https://example.se/e/1',
    ...extra,
});

describe('eventSearchTier — flera ord', () => {
    it('hela frasen vinner som förut', () => {
        expect(eventSearchTier(evc('Jazz på Pustervik'), 'jazz på')).toBe(SEARCH_TIER.TITLE_START);
    });

    it('varje ord får matcha ett eget fält — sämsta ordets nivå gäller', () => {
        const e = evc('Jazzkväll', { locationName: 'Pustervik' });
        expect(eventSearchTier(e, 'jazz pustervik')).toBe(SEARCH_TIER.LOCATION);
    });

    it('ett ord som inte matchar något fält fäller hela raden', () => {
        expect(eventSearchTier(evc('Jazzkväll', { locationName: 'Pustervik' }), 'jazz hamnen')).toBe(-1);
    });
});

describe('eventSearchTier — kategoriord', () => {
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
