import { describe, it, expect } from 'vitest';
import { extractFlight, extractGames, homeArenaCoords, mapHaGame, type HaGame, type HockeyAllsvenskanConfig } from './hockeyallsvenskan';

const CFG: HockeyAllsvenskanConfig = { baseUrl: 'https://hockeyallsvenskan.se', leagueName: 'HockeyAllsvenskan', sport: 'ishockey' };

const ALMTUNA = { name: 'Almtuna', teamArena: 'Gränby Ishall', arenaLatitude: '59.880620', arenaLongitude: '17.655971' };
const SSK = { name: 'Södertälje', teamArena: 'Scaniarinken', arenaLatitude: '59.189466', arenaLongitude: '17.570269' };
const AIK = { name: 'AIK', teamArena: 'Hovet', arenaLatitude: '59.294722', arenaLongitude: '18.081944' };

const GAME: HaGame = {
    documentId: 't3f3eob8r5yvdthc02wxfobu',
    slug: '20260930-ais-ssk',
    round: '6',
    scheduledDateTime: '2026-09-30T17:00:00.000Z',
    venue: 'Gränby ishall',
    isCompleted: null,
    homeTeam: ALMTUNA,
    awayTeam: SSK,
};

/** Sidan som Next renderar den: flighten JSON-kodad i push-anrop, delad mitt i. */
function pageWith(props: unknown): string {
    const row = `4b:${JSON.stringify(['$', '$L4d', 'games.game-calendar-264-0', props])}\n`;
    const cut = Math.floor(row.length / 2);
    const push = (s: string) => `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`;
    return `<!DOCTYPE html><html><body>${push('0:["$","html"]\n')}${push(row.slice(0, cut))}${push(row.slice(cut))}</body></html>`;
}

describe('extractFlight + extractGames', () => {
    it('läser matcherna ur schemasidans RSC-flight, även när raden delats över två push', () => {
        const done = { ...GAME, documentId: 'x1', slug: '20260918-aik-modo', isCompleted: true };
        const games = extractGames(extractFlight(pageWith({ season: 'current', games: [done, GAME] })));
        expect(games.map(g => g.slug)).toEqual(['20260918-aik-modo', '20260930-ais-ssk']);
        expect(games[1].homeTeam?.teamArena).toBe('Gränby Ishall');
    });

    it('klarar strängar med hakparenteser och escapade citattecken i props', () => {
        const odd = { ...GAME, venue: 'Hallen "A" [nya]' };
        const games = extractGames(extractFlight(pageWith({ title: 'Matcher ]}', games: [odd] })));
        expect(games).toHaveLength(1);
        expect(games[0].venue).toBe('Hallen "A" [nya]');
    });

    it('dedupar samma match från flera komponenter och hoppar över icke-matcher', () => {
        const flight = `1:{"games":[${JSON.stringify(GAME)}]}\n2:{"games":[${JSON.stringify(GAME)},{"id":1}]}\n3:{"games":[]}`;
        expect(extractGames(flight)).toHaveLength(1);
    });

    it('tom lista på en sida utan flight (mjuk 404)', () => {
        expect(extractGames(extractFlight('<html><body>Page Not Found</body></html>'))).toEqual([]);
    });
});

describe('homeArenaCoords', () => {
    it('hemmalagets arenakoordinat när matchen spelas i hemmaarenan (skiftläge oviktigt)', () => {
        expect(homeArenaCoords(GAME)).toEqual([59.88062, 17.655971]);
    });

    it('INTE när venue är en annan arena — AIK i Avicii Arena bär Hovets punkt', () => {
        expect(homeArenaCoords({ ...GAME, venue: 'Avicii Arena', homeTeam: AIK })).toBeUndefined();
        // Sponsorbyte: samma hall men olika namn → hellre venueFixes än gissning.
        expect(homeArenaCoords({ ...GAME, venue: 'Wibe Arena', homeTeam: { ...ALMTUNA, teamArena: 'Smidjegrav Arena' } })).toBeUndefined();
    });

    it('tomma eller omkastade koordinater släpps', () => {
        expect(homeArenaCoords({ ...GAME, homeTeam: { ...ALMTUNA, arenaLatitude: '', arenaLongitude: '' } })).toBeUndefined();
        expect(homeArenaCoords({ ...GAME, homeTeam: { ...ALMTUNA, arenaLatitude: null, arenaLongitude: null } })).toBeUndefined();
        expect(homeArenaCoords({ ...GAME, homeTeam: { ...ALMTUNA, arenaLatitude: '17.655971', arenaLongitude: '59.880620' } })).toBeUndefined();
        expect(homeArenaCoords({ ...GAME, venue: null })).toBeUndefined();
    });
});

describe('mapHaGame', () => {
    it('kommande match → RawEvent med matchsidans url, arena och källkoordinat', () => {
        const ev = mapHaGame(GAME, CFG)!;
        expect(ev).toMatchObject({
            externalId: 't3f3eob8r5yvdthc02wxfobu',
            title: 'Almtuna – Södertälje',
            url: 'https://hockeyallsvenskan.se/games/20260930-ais-ssk/view',
            venueName: 'Gränby ishall',
            coords: [59.88062, 17.655971],
            category: 'sport',
            hasSpecificTime: true,
            hostName: 'HockeyAllsvenskan',
        });
        expect(ev.startDate.toISOString()).toBe('2026-09-30T17:00:00.000Z');
        expect(ev.geocodeCandidates).toBeUndefined();
        expect(ev.description).toBe('Ishockeymatch i HockeyAllsvenskan: Almtuna möter Södertälje i Gränby ishall (omgång 6).');
    });

    it('annan arena än hemmalagets → ingen koordinat, arenanamnet geokodas', () => {
        const ev = mapHaGame({ ...GAME, venue: 'Avicii Arena', homeTeam: AIK }, CFG)!;
        expect(ev.coords).toBeUndefined();
        expect(ev.geocodeCandidates).toEqual(['Avicii Arena']);
    });

    it('spelade och ofullständiga matcher släpps', () => {
        expect(mapHaGame({ ...GAME, isCompleted: true }, CFG)).toBeNull();
        expect(mapHaGame({ ...GAME, slug: undefined }, CFG)).toBeNull();
        expect(mapHaGame({ ...GAME, awayTeam: null }, CFG)).toBeNull();
        expect(mapHaGame({ ...GAME, scheduledDateTime: 'inte ett datum' }, CFG)).toBeNull();
        expect(mapHaGame({ ...GAME, scheduledDateTime: '2001-01-01T00:00:00.000Z' }, CFG)).toBeNull();
    });

    it('icke-numerisk omgång skrivs inte ut', () => {
        expect(mapHaGame({ ...GAME, round: 'Kvartsfinal' }, CFG)!.description).toBe(
            'Ishockeymatch i HockeyAllsvenskan: Almtuna möter Södertälje i Gränby ishall.',
        );
    });
});
