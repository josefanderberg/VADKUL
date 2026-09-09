import { describe, it, expect } from 'vitest';
import { parseSchedule, gameUrl } from './swehockey';

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
