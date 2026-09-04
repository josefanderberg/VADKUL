import { describe, it, expect } from 'vitest';
import { isPlayableStatus, mapSportomediaMatch } from './sportomedia';

const CFG = { league: 'allsvenskan', leagueName: 'Allsvenskan', siteBase: 'https://allsvenskan.se' };

const M = {
    id: 6529830,
    startDate: '2026-08-29T13:00:00.000Z',
    homeTeamName: 'BK Häcken',
    visitingTeamName: 'Västerås SK',
    status: 'UPCOMING',
    arenaName: 'Nordic Wellness Arena',
    round: 21,
};

describe('isPlayableStatus', () => {
    it('släpper igenom kommande och pågående', () => {
        expect(isPlayableStatus('UPCOMING')).toBe(true);
        expect(isPlayableStatus('ONGOING')).toBe(true);
    });

    it('stoppar spelade, inställda och skjutna', () => {
        for (const s of ['FINISHED', 'POSTPONED', 'INTERRUPTED', 'CANCELED', undefined, '']) {
            expect(isPlayableStatus(s)).toBe(false);
        }
    });
});

describe('mapSportomediaMatch', () => {
    it('bygger titel, URL och tid', () => {
        const e = mapSportomediaMatch(M, CFG)!;
        expect(e.title).toBe('BK Häcken – Västerås SK');
        expect(e.url).toBe('https://allsvenskan.se/matcher/2026/6529830');
        expect(e.startDate.toISOString()).toBe('2026-08-29T13:00:00.000Z');
        expect(e.hasSpecificTime).toBe(true);
        expect(e.category).toBe('sport');
        expect(e.hostName).toBe('Allsvenskan');
    });

    it('tar året ur matchdatumet, inte ur dagens datum', () => {
        const e = mapSportomediaMatch({ ...M, startDate: '2027-04-03T15:00:00.000Z' }, CFG)!;
        expect(e.url).toContain('/matcher/2027/');
    });

    it('geokodar på arenanamnet', () => {
        const e = mapSportomediaMatch(M, CFG)!;
        expect(e.venueName).toBe('Nordic Wellness Arena');
        expect(e.geocodeCandidates).toEqual(['Nordic Wellness Arena']);
    });

    it('skriver omgång i beskrivningen när den finns', () => {
        expect(mapSportomediaMatch(M, CFG)!.description).toBe('Allsvenskan · Omgång 21');
        expect(mapSportomediaMatch({ ...M, round: undefined }, CFG)!.description).toBe('Allsvenskan');
    });

    it('hanterar omgång 0 utan att tappa den', () => {
        expect(mapSportomediaMatch({ ...M, round: 0 }, CFG)!.description).toBe('Allsvenskan · Omgång 0');
    });

    it('tål avslutande slash i siteBase', () => {
        expect(mapSportomediaMatch(M, { ...CFG, siteBase: 'https://allsvenskan.se/' })!.url)
            .toBe('https://allsvenskan.se/matcher/2026/6529830');
    });

    it('släpper spelade och inställda matcher', () => {
        expect(mapSportomediaMatch({ ...M, status: 'FINISHED' }, CFG)).toBeNull();
        expect(mapSportomediaMatch({ ...M, status: 'POSTPONED' }, CFG)).toBeNull();
    });

    it('avvisar ofullständiga poster', () => {
        expect(mapSportomediaMatch({ ...M, id: undefined }, CFG)).toBeNull();
        expect(mapSportomediaMatch({ ...M, startDate: undefined }, CFG)).toBeNull();
        expect(mapSportomediaMatch({ ...M, homeTeamName: '' }, CFG)).toBeNull();
        expect(mapSportomediaMatch({ ...M, visitingTeamName: undefined }, CFG)).toBeNull();
        expect(mapSportomediaMatch({ ...M, startDate: 'aldrig' }, CFG)).toBeNull();
    });

    it('klarar match utan arena', () => {
        const e = mapSportomediaMatch({ ...M, arenaName: undefined }, CFG)!;
        expect(e.venueName).toBeUndefined();
        expect(e.geocodeCandidates).toBeUndefined();
    });
});
