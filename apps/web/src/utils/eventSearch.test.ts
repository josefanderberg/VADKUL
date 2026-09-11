import { describe, it, expect } from 'vitest';
import {
    SEARCH_TIER,
    eventSearchTier,
    highlightSegments,
    normalizeSearchQuery,
    rankSearchResults,
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
