import { describe, it, expect } from 'vitest';
import { swedishTeamCodes, mapSportalityGame } from './sportality';

const CFG = { baseUrl: 'https://www.shl.se', leagueName: 'SHL' };
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
        expect(e.description).toContain('CHL');
    });

    it('nämner inte serien dubbelt när den är samma som ligan', () => {
        expect(mapSportalityGame(GAME, CFG, SWE)!.description).toBe('SHL · Omgång 3');
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
