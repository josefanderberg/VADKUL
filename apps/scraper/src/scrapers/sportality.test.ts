import { describe, it, expect } from 'vitest';
import { swedishTeamCodes, swedishInstanceIds, logoInstanceId, mapSportalityGame, type SportalityConfig } from './sportality';

const CFG: SportalityConfig = { baseUrl: 'https://www.shl.se', leagueName: 'SHL', sport: 'ishockey' };
const SWE = new Set(['BIF', 'DIF', 'RBK']);

const GAME = {
    uuid: 'qQ1-5b5l4FMaL',
    startDateTime: '2026-09-20T17:00:00.000Z',
    played: false,
    venue: 'Monitor ERP Arena',
    seriesCode: 'SHL',
    roundLabel: 'Omgång 3',
    homeTeam: { name: 'Brynäs', code: 'BIF' },
    awayTeam: { name: 'Djurgårdens IF Hockey', code: 'DIF' },
};

describe('swedishInstanceIds + logoInstanceId (SDHL-fallet 13/9)', () => {
    it('plockar ownerInstanceId för svenska lag', () => {
        const s = swedishInstanceIds({
            allTeamsInSite: [
                { ownerInstanceId: 'fhc1_fhc', nationality: 'sv' },
                { ownerInstanceId: 'plz1_plz', nationality: 'SE' },
            ],
        });
        expect([...s]).toEqual(['fhc1_fhc']);
    });

    it('läser instans-id ur logo-URL:en', () => {
        expect(logoInstanceId('https://sportality.cdn.s8y.se/team-logos/fhc1_fhc.svg')).toBe('fhc1_fhc');
        expect(logoInstanceId('https://example.com/nagot-annat.svg')).toBeNull();
        expect(logoInstanceId(undefined)).toBeNull();
    });

    it('SDHL: teamCode "DAM" på alla lag → matchen släpps in via logo-instansen', () => {
        // Kodmängden matchar inte (settings säger DAM, matchen säger FHC) men
        // instans-id:t i loggan gör det — matchen ska INTE klassas som utomlands.
        const game = {
            ...GAME,
            homeTeam: { name: 'Frölunda HC', code: 'FHC', logo: 'https://sportality.cdn.s8y.se/team-logos/fhc1_fhc.svg' },
            awayTeam: { name: 'Brynäs IF', code: 'BIF' },
        };
        const ev = mapSportalityGame(game, { baseUrl: 'https://www.sdhl.se', leagueName: 'SDHL' }, new Set(['DAM']), new Set(['fhc1_fhc']));
        expect(ev).not.toBeNull();
        expect(ev!.title).toBe('Frölunda HC – Brynäs IF');
    });

    it('utländskt hemmalag släpps fortfarande inte in (varken kod eller instans)', () => {
        const game = {
            ...GAME,
            homeTeam: { name: 'EV Zug', code: 'ZUG', logo: 'https://sportality.cdn.s8y.se/team-logos/zug1_zug.svg' },
        };
        expect(mapSportalityGame(game, CFG, SWE, new Set(['fhc1_fhc']))).toBeNull();
    });
});

describe('swedishTeamCodes', () => {
    it('plockar bara nationality "sv" — "SE" sitter felaktigt på utländska lag', () => {
        const s = swedishTeamCodes({
            allTeamsInSite: [
                { teamCode: 'BIF', nationality: 'sv' },
                { teamCode: 'PLZ', nationality: 'SE' },
                { teamCode: 'NIT', nationality: 'SK' },
            ],
        });
        expect([...s]).toEqual(['BIF']);
    });

    it('avdubblerar lag som ligger i flera serier', () => {
        const s = swedishTeamCodes({
            allTeamsInSite: [
                { teamCode: 'RBK', nationality: 'sv' },
                { teamCode: 'RBK', nationality: 'sv' },
            ],
        });
        expect(s.size).toBe(1);
    });

    it('ger tom mängd på trasig eller tom input', () => {
        expect(swedishTeamCodes(undefined).size).toBe(0);
        expect(swedishTeamCodes({}).size).toBe(0);
        expect(swedishTeamCodes({ allTeamsInSite: 'nope' }).size).toBe(0);
    });
});

describe('mapSportalityGame', () => {
    it('bygger titel, URL och tid', () => {
        const e = mapSportalityGame(GAME, CFG, SWE)!;
        expect(e.title).toBe('Brynäs – Djurgårdens IF Hockey');
        expect(e.url).toBe('https://www.shl.se/match/qQ1-5b5l4FMaL');
        expect(e.startDate.toISOString()).toBe('2026-09-20T17:00:00.000Z');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.category).toBe('sport');
        expect(e.hostName).toBe('SHL');
    });

    it('geokodar på arenanamnet — datan har ingen ort', () => {
        const e = mapSportalityGame(GAME, CFG, SWE)!;
        expect(e.venueName).toBe('Monitor ERP Arena');
        expect(e.geocodeCandidates).toEqual(['Monitor ERP Arena']);
    });

    it('släpper matcher med utländskt hemmalag — arenan ligger utomlands', () => {
        const chl = { ...GAME, seriesCode: 'CHL', venue: 'Logspeed CZ Aréna', homeTeam: { name: 'HC Plzeň', code: 'PLZ' } };
        expect(mapSportalityGame(chl, CFG, SWE)).toBeNull();
    });

    it('behåller CHL-matcher med svenskt hemmalag', () => {
        const chl = { ...GAME, seriesCode: 'CHL', homeTeam: { name: 'Rögle BK', code: 'RBK' } };
        const e = mapSportalityGame(chl, CFG, SWE)!;
        expect(e.title).toBe('Rögle BK – Djurgårdens IF Hockey');
        expect(e.description).toBe('Ishockeymatch i CHL: Rögle BK möter Djurgårdens IF Hockey i Monitor ERP Arena (omgång 3).');
    });

    it('beskrivningen är en hel mening — aldrig bara serie-koden', () => {
        expect(mapSportalityGame(GAME, CFG, SWE)!.description)
            .toBe('Ishockeymatch i SHL: Brynäs möter Djurgårdens IF Hockey i Monitor ERP Arena (omgång 3).');
        // HockeyAllsvenskans feed har seriesCode "HA" (namnets versaler) —
        // det ska bli hela liganamnet, inte koden.
        const ha = mapSportalityGame(
            { ...GAME, seriesCode: 'HA', roundLabel: undefined, venue: undefined },
            { baseUrl: 'https://www.hockeyallsvenskan.se', leagueName: 'HockeyAllsvenskan', sport: 'ishockey' },
            SWE,
        )!;
        expect(ha.description).toBe('Ishockeymatch i HockeyAllsvenskan: Brynäs möter Djurgårdens IF Hockey.');
    });

    it('sporten står först — SSL-lagnamnen säger inte att det är innebandy (🥒-fallet 15/9)', () => {
        const ssl = mapSportalityGame(
            {
                ...GAME, seriesCode: 'SSLDam', roundLabel: undefined, venue: 'Fortnox Arena',
                homeTeam: { name: 'Växjö Vipers', code: 'VV' }, awayTeam: { name: 'Team Thorengruppen', code: 'TT' },
            },
            { baseUrl: 'https://www.ssl.se', leagueName: 'SSL', sport: 'innebandy' },
            new Set(['VV']),
        )!;
        expect(ssl.description).toBe('Innebandymatch i SSLDam: Växjö Vipers möter Team Thorengruppen i Fortnox Arena.');
        // Utan sport i config: gamla formen, ingen krasch.
        expect(mapSportalityGame(GAME, { baseUrl: 'https://www.shl.se', leagueName: 'SHL' }, SWE)!.description)
            .toBe('SHL: Brynäs möter Djurgårdens IF Hockey i Monitor ERP Arena (omgång 3).');
    });

    it('hoppar över spelade matcher', () => {
        expect(mapSportalityGame({ ...GAME, played: true }, CFG, SWE)).toBeNull();
    });

    it('avvisar ofullständiga poster', () => {
        expect(mapSportalityGame({ ...GAME, uuid: undefined }, CFG, SWE)).toBeNull();
        expect(mapSportalityGame({ ...GAME, startDateTime: undefined }, CFG, SWE)).toBeNull();
        expect(mapSportalityGame({ ...GAME, awayTeam: {} }, CFG, SWE)).toBeNull();
        expect(mapSportalityGame({ ...GAME, homeTeam: { name: 'X' } }, CFG, SWE)).toBeNull();
        expect(mapSportalityGame({ ...GAME, startDateTime: 'aldrig' }, CFG, SWE)).toBeNull();
    });

    it('klarar match utan arena', () => {
        const e = mapSportalityGame({ ...GAME, venue: undefined }, CFG, SWE)!;
        expect(e.venueName).toBeUndefined();
        expect(e.geocodeCandidates).toBeUndefined();
    });
});
