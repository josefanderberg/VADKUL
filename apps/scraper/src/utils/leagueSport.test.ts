import { describe, it, expect } from 'vitest';
import { isLeagueSport, leagueHostSports, leagueSiteHost, leagueSportForUrl } from './leagueSport';

const SOURCES = [
    { engine: 'sportality', config: { baseUrl: 'https://www.ssl.se', sport: 'innebandy' } },
    { engine: 'sportality', config: { baseUrl: 'https://www.shl.se', sport: 'ishockey' } },
    { engine: 'sportomedia', config: { siteBase: 'https://allsvenskan.se', sport: 'fotboll' } },
    { engine: 'swehockey', config: { leagueId: '20961', sport: 'ishockey' } },
    { engine: 'sportality', config: { baseUrl: 'https://www.sbldam.se' } },                       // saknar sport
    { engine: 'json-ld', config: { baseUrl: 'https://www.ssl.se/kalender', sport: 'fotboll' } },  // ingen ligamotor
];
const MAP = leagueHostSports(SOURCES);

describe('leagueSportForUrl', () => {
    it('SSL-matchen från 15/9 är innebandy — inte 🥒', () => {
        expect(leagueSportForUrl('https://www.ssl.se/match/ef6unkoa54', MAP)).toBe('innebandy');
    });

    it('alla tre ligamotorernas url-former', () => {
        expect(leagueSportForUrl('https://www.shl.se/match/wza53fczpy', MAP)).toBe('ishockey');
        expect(leagueSportForUrl('https://allsvenskan.se/matcher/2026/123456', MAP)).toBe('fotboll');
        expect(leagueSportForUrl('https://stats.swehockey.se/ScheduleAndResults/Schedule/20961?game=90001002', MAP)).toBe('ishockey');
    });

    it('www-prefix och skiftläge spelar ingen roll', () => {
        expect(leagueSportForUrl('https://SSL.se/match/x', MAP)).toBe('innebandy');
    });

    it('null för källa utan sport, okänd värd och trasig url', () => {
        expect(leagueSportForUrl('https://www.sbldam.se/match/jaet6rlsxo', MAP)).toBeNull();
        expect(leagueSportForUrl('https://visitlinkoping.se/evenemang/sdhl-lhc-skelleftea-aik-4/', MAP)).toBeNull();
        expect(leagueSportForUrl('inte en url', MAP)).toBeNull();
        expect(leagueSportForUrl('', MAP)).toBeNull();
        expect(leagueSportForUrl(null, MAP)).toBeNull();
    });

    it('andra motorer på samma värd skriver inte över ligans sport', () => {
        expect(MAP.get('ssl.se')).toBe('innebandy');
    });
});

describe('leagueSiteHost + isLeagueSport', () => {
    it('värd bara för ligamotorer', () => {
        expect(leagueSiteHost(SOURCES[3])).toBe('stats.swehockey.se');
        expect(leagueSiteHost(SOURCES[5])).toBeNull();
    });

    it('bara kända sporter — inte prototyp-nycklar', () => {
        expect(isLeagueSport('innebandy')).toBe(true);
        expect(isLeagueSport('toString')).toBe(false);
        expect(isLeagueSport(undefined)).toBe(false);
    });
});
