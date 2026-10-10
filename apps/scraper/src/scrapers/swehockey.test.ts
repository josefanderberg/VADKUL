import { describe, it, expect } from 'vitest';
import { parseSchedule, gameUrl, gameToRawEvent, ARENA_PLACES } from './swehockey';

// Utdrag ur stats.swehockey.se/ScheduleAndResults/Schedule/20961 (2026-09-09).
// Första matchen en speldag bär datumet i egen cell; nästa match samma dag
// har FEM celler och ärver det. Det är hela poängen med testet.
const HTML = `
<table>
<tr>
  <td class="tdNormal">2026-09-19</td>
  <td class="tdNormal">2026-09-19 15:15</td>
  <td class="tdNormal"><div class="dateLink"><span href="#" class="lnkTooltip" title="90001001">15:15</span></div></td>
  <td class="tdNormal">Fr&#xF6;lunda HC
             -
            V&#xE4;xj&#xF6; Lakers HC</td>
  <td class="tdNormal"> </td>
  <td class="tdNormal">Scandinavium</td>
</tr>
<tr>
  <td class="tdNormal">15:15</td>
  <td class="tdNormal"><div class="dateLink"><span href="#" class="lnkTooltip" title="90001002">15:15</span></div></td>
  <td class="tdNormal">HV 71
             -
            IF Malm&#xF6; Redhawks</td>
  <td class="tdNormal"> </td>
  <td class="tdNormal">Husqvarna Garden</td>
</tr>
<tr>
  <td class="tdTitle">Rubrikrad utan matchnummer</td><td/><td/><td/><td/>
</tr>
</table>`;

describe('parseSchedule', () => {
    it('läser matchen som bär datumet', () => {
        const g = parseSchedule(HTML)[0];
        expect(g.home).toBe('Frölunda HC');
        expect(g.away).toBe('Växjö Lakers HC');
        expect(g.arena).toBe('Scandinavium');
        expect(g.gameNo).toBe('90001001');
        expect(g.startsAt.getFullYear()).toBe(2026);
        expect(g.startsAt.getMonth()).toBe(8);
        expect(g.startsAt.getDate()).toBe(19);
        expect(g.startsAt.getHours()).toBe(15);
        expect(g.startsAt.getMinutes()).toBe(15);
    });

    it('ÄRVER datumet till femcellsraden — annars tappas 306 av 364 matcher', () => {
        const games = parseSchedule(HTML);
        expect(games).toHaveLength(2);
        const second = games[1];
        expect(second.home).toBe('HV 71');
        expect(second.away).toBe('IF Malmö Redhawks');
        expect(second.arena).toBe('Husqvarna Garden');
        expect(second.startsAt.getDate()).toBe(19);   // ärvt, inte gissat
        expect(second.startsAt.getMonth()).toBe(8);
    });

    it('hoppar över rader utan matchnummer', () => {
        expect(parseSchedule(HTML).every(g => /^\d+$/.test(g.gameNo))).toBe(true);
    });

    it('avkodar svenska tecken ur entiteterna', () => {
        expect(parseSchedule(HTML)[0].away).toContain('Växjö');
    });

    it('ger tom lista för sidor utan schema', () => {
        expect(parseSchedule('<table><tr><td>inget</td></tr></table>')).toEqual([]);
        expect(parseSchedule('')).toEqual([]);
    });
});

describe('gameUrl', () => {
    it('ger unik och stabil url per match — url är primärnyckel', () => {
        const a = gameUrl('20961', '90001001');
        const b = gameUrl('20961', '90001002');
        expect(a).not.toBe(b);
        expect(a).toBe(gameUrl('20961', '90001001'));
        expect(a.startsWith('https://stats.swehockey.se/')).toBe(true);
    });
});

// Utdrag ur Schedule/21044 (Hockeyettan Södra, 2026-10-10). Annan markup än
// SHL-sidan: självstängande <td/>-celler och en mobil datumcell
// ("<bold>datum</bold><br />tid").
const ETTAN_HTML = `
<table>
<tr><td class="tdOdd paddingTop d-none d-sm-table-cell">2026-10-18</td><td class="tdOdd paddingTop d-table-cell d-sm-none"><bold>2026-10-18</bold><br />14:00</td><td class="tdOdd paddingTop d-none d-sm-table-cell" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="90256203">14:00</span></div></td><td class="tdOdd paddingTop">Hanvikens SK
             - 
            Tyringe SoSS</td><td class="tdOdd paddingTop" colspan="1"> </td><td class="tdOdd paddingTop d-none d-sm-table-cell" /><td class="tdOdd paddingTop d-none d-md-table-cell" /><td class="tdOdd paddingTop">Tyresö Ishall</td></tr>
<tr><td class="tdOdd standardPaddingTop d-table-cell d-sm-none">16:00</td><td class="tdOdd standardPaddingTop d-none d-sm-table-cell" /><td class="tdOdd standardPaddingTop d-none d-sm-table-cell" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="90256261">16:00</span></div></td><td class="tdOdd standardPaddingTop">Västerviks IK
             - 
            Nyköpings SK</td><td class="tdOdd standardPaddingTop" colspan="1"> </td><td class="tdOdd standardPaddingTop d-none d-sm-table-cell" /><td class="tdOdd standardPaddingTop d-none d-md-table-cell" /><td class="tdOdd standardPaddingTop">LF Arena </td></tr>
</table>`;

const ETTAN = { leagueId: '21044', leagueName: 'Hockeyettan Södra' };

describe('Hockeyettan (21044)', () => {
    it('läser båda raderna och ärver datumet', () => {
        const games = parseSchedule(ETTAN_HTML);
        expect(games).toHaveLength(2);
        const vik = games[1];
        expect(vik.home).toBe('Västerviks IK');
        expect(vik.away).toBe('Nyköpings SK');
        expect(vik.arena).toBe('LF Arena');
        expect(vik.gameNo).toBe('90256261');
        expect(vik.startsAt.getDate()).toBe(18);
        expect(vik.startsAt.getMonth()).toBe(9);
        expect(vik.startsAt.getHours()).toBe(16);
    });

    it('LF Arena geokodas i Västervik — namnet finns även i Piteå', () => {
        const e = gameToRawEvent(ETTAN, parseSchedule(ETTAN_HTML)[1]);
        expect(e.title).toBe('Västerviks IK – Nyköpings SK');
        expect(e.venueName).toBe('LF Arena');
        expect(e.city).toBe('Västervik');
        expect(e.geocodeCandidates).toEqual(['LF Arena, Västervik', 'Västervik']);
        expect(e.url).toBe(gameUrl('21044', '90256261'));
    });

    it('provar OSM-namnet före sponsornamnet', () => {
        const g = { ...parseSchedule(ETTAN_HTML)[1], arena: 'Stora Hallen' };
        expect(gameToRawEvent(ETTAN, g).geocodeCandidates)
            .toEqual(['Rosvalla, Nyköping', 'Stora Hallen, Nyköping', 'Nyköping']);
    });

    it('slutar alltid på orten — en arenamiss får inte bli 0,0', () => {
        for (const [arena, place] of Object.entries(ARENA_PLACES)) {
            const g = { ...parseSchedule(ETTAN_HTML)[0], arena };
            const candidates = gameToRawEvent(ETTAN, g).geocodeCandidates ?? [];
            expect(candidates[candidates.length - 1]).toBe(place.city);
        }
    });

    it('okänd arena lämnas åt runnerns vanliga geokodning', () => {
        const e = gameToRawEvent({ leagueId: '20961', leagueName: 'SHL' }, parseSchedule(HTML)[0]);
        expect(e.venueName).toBe('Scandinavium');
        expect(e.city).toBeUndefined();
        expect(e.geocodeCandidates).toBeUndefined();
    });
});
