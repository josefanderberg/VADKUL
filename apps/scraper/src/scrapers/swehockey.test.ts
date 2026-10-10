import { describe, it, expect } from 'vitest';
import {
    parseSchedule, gameUrl, gameToRawEvent, townFromTeam, ageGroup, seriesLinks, pageTitle, assignGames, isForeignArena,
} from './swehockey';
import { HOCKEY_ARENAS } from '../data/hockeyArenas';

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
        for (const [arena, place] of Object.entries(HOCKEY_ARENAS)) {
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

// Utdrag ur ungdomsserierna (2026-10-10): 21567 (U20 Div 1 Syd B), 21143
// (U20 Regional Syd), 21568, 21563 och 21551. Layout B: ingen dag-
// gruppering, tooltipen bär "datum tid" med HÅRT mellanslag (U+00A0), även
// runt lagens bindestreck. Status för uppskjutna står under lagnamnen.
const NB = ' ';
const YOUTH_HTML = `
<table>
<tr><td class="tdOdd d-none d-sm-table-cell">
                ${NB}
              </td><td class="tdOdd standardPaddingTop" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="93711028">2026-10-17${NB}14:00</span></div></td><td class="tdOdd standardPaddingTop">Västerviks IK
            ${NB}-${NB}
            Tranås AIF</td><td class="tdOdd standardPaddingTop" colspan="1">${NB}</td><td class="tdOdd standardPaddingTop d-none d-sm-table-cell" /><td class="tdOdd standardPaddingTop d-none d-md-table-cell" /><td class="tdOdd standardPaddingTop">LF Arena </td></tr>
<tr><td class="tdOdd standardPaddingTop d-none d-sm-table-cell">1</td><td class="tdOdd standardPaddingTop" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="93701003">2026-09-26 14:00</span></div></td><td class="tdOdd standardPaddingTop">Karlskrona HK
             - 
            Kungälvs IK</td><td class="tdOdd standardPaddingTop" style="white-space: nowrap;"><a href="&#xD;&#xA;                          javascript:openonlinewindow('/Game/Events/1113516','')&#xD;&#xA;                        ">1 - 3</a></td><td class="tdOdd standardPaddingTop d-none d-sm-table-cell" style="white-space: nowrap;">
              (0-1, 0-1, 1-1)
            </td><td class="tdOdd standardPaddingTop d-none d-md-table-cell" style="text-align: right"></td><td class="tdOdd standardPaddingTop">NKT Arena Karlskrona B-Hall</td></tr>
<tr><td class="tdNormal d-none d-sm-table-cell">
                 
              </td><td class="tdNormal standardPaddingTop" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="93712022">2026-10-10 14:00</span></div></td><td class="tdNormal standardPaddingTop">Olofströms IK
             - 
            Lund Giants HC<br /><i>
              Postponed
            </i></td><td class="tdNormal standardPaddingTop" colspan="1"> </td><td class="tdNormal standardPaddingTop d-none d-sm-table-cell" /><td class="tdNormal standardPaddingTop d-none d-md-table-cell" /><td class="tdNormal standardPaddingTop">Stålhallen</td></tr>
<tr><td class="tdNormal paddingTop d-none d-sm-table-cell">4</td><td class="tdNormal paddingTop" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="93772020">2026-10-11 00:00</span></div></td><td class="tdNormal paddingTop">Sörhaga/Alingsås HK
             - 
            IFK Falköping IK/Tidaholms HF<br /><i>Uppskjuten, ny tid kommer</i></td><td class="tdNormal paddingTop" colspan="1"> </td><td class="tdNormal paddingTop d-none d-sm-table-cell" /><td class="tdNormal paddingTop d-none d-md-table-cell" /><td class="tdNormal paddingTop">PUAHALLEN</td></tr>
</table>`;

describe('parseSchedule — layout B (ungdomsserierna)', () => {
    const games = parseSchedule(YOUTH_HTML);

    it('läser datum och tid ur tooltipen trots hårt mellanslag', () => {
        const g = games.find(x => x.gameNo === '93711028')!;
        expect(g.home).toBe('Västerviks IK');
        expect(g.away).toBe('Tranås AIF');
        expect(g.arena).toBe('LF Arena');
        expect([g.startsAt.getFullYear(), g.startsAt.getMonth(), g.startsAt.getDate()]).toEqual([2026, 9, 17]);
        expect([g.startsAt.getHours(), g.startsAt.getMinutes()]).toEqual([14, 0]);
        expect(g.timeSet).toBe(true);
    });

    it('tar lagen, inte resultatet ("1 - 3"), och arenan ur sista cellen', () => {
        const g = games.find(x => x.gameNo === '93701003')!;
        expect(g.home).toBe('Karlskrona HK');
        expect(g.away).toBe('Kungälvs IK');
        expect(g.arena).toBe('NKT Arena Karlskrona B-Hall');
    });

    it('hoppar över uppskjutna matcher — både "Postponed" och "Uppskjuten"', () => {
        expect(games.map(g => g.gameNo)).toEqual(['93711028', '93701003']);
        expect(games.some(g => /Postponed|Uppskjuten/.test(g.away))).toBe(false);
    });
});

// Utdrag ur 21551 (U20 Div 1 B Västra): layout A med "00:00" = tid ej satt.
const TBD_HTML = `
<table>
<tr><td class="tdNormal paddingTop d-none d-sm-table-cell">2026-11-29</td><td class="tdNormal paddingTop d-table-cell d-sm-none"><bold>2026-11-29</bold><br />00:00</td><td class="tdNormal paddingTop d-none d-sm-table-cell" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="94720021">00:00</span></div></td><td class="tdNormal paddingTop">Grums IK:2
             - 
            Kils AIK</td><td class="tdNormal paddingTop" colspan="1"> </td><td class="tdNormal paddingTop d-none d-sm-table-cell" /><td class="tdNormal paddingTop d-none d-md-table-cell" /><td class="tdNormal paddingTop">Billerudhallen</td></tr>
<tr><td class="tdNormal standardPaddingTop d-table-cell d-sm-none">00:00</td><td class="tdNormal standardPaddingTop d-none d-sm-table-cell" /><td class="tdNormal standardPaddingTop d-none d-sm-table-cell" style="white-space: nowrap;"><div class="dateLink"><span href="#" class="lnkTooltip" title="94720022">00:00</span></div></td><td class="tdNormal standardPaddingTop">Nora HC U23/HIK
             - 
            BIK Karlskoga:2/Karlskoga IK U23</td><td class="tdNormal standardPaddingTop" colspan="1"> </td><td class="tdNormal standardPaddingTop d-none d-sm-table-cell" /><td class="tdNormal standardPaddingTop d-none d-md-table-cell" /><td class="tdNormal standardPaddingTop">NEH Hallen</td></tr>
</table>`;

describe('parseSchedule — tid ej satt', () => {
    it('00:00 betyder att tiden inte är satt, och datumet ärvs', () => {
        const games = parseSchedule(TBD_HTML);
        expect(games).toHaveLength(2);
        expect(games.every(g => !g.timeSet)).toBe(true);
        expect(games[1].startsAt.getDate()).toBe(29);
        expect(games[1].home).toBe('Nora HC U23/HIK');
        expect(games[1].arena).toBe('NEH Hallen');
    });

    it('vanliga klockslag är satta', () => {
        expect(parseSchedule(HTML).every(g => g.timeSet)).toBe(true);
    });
});

describe('townFromTeam — reservort för okända arenor', () => {
    it('hittar orten i lagnamnet, med genitiv-s och sammansatta namn', () => {
        expect(townFromTeam('Västerviks IK')).toBe('Västervik');
        expect(townFromTeam('Borås HC')).toBe('Borås');
        expect(townFromTeam('IF Troja-Ljungby')).toBe('Ljungby');
        expect(townFromTeam('Visby/Roma HK')).toBe('Visby');
        expect(townFromTeam('Grums IK:2')).toBe('Grums');
    });

    it('gissar inte när lagnamnet saknar ort', () => {
        expect(townFromTeam('HC Dalen')).toBeUndefined();
        expect(townFromTeam('AIK')).toBeUndefined();
        expect(townFromTeam('HV 71')).toBeUndefined();
    });
});

describe('arenatabellen', () => {
    it('har ort på varje arena', () => {
        for (const [arena, a] of Object.entries(HOCKEY_ARENAS)) {
            expect(a.city.trim(), arena).not.toBe('');
        }
    });

    it('namnkrockarna pekar på rätt ort', () => {
        expect(HOCKEY_ARENAS['LF Arena'].city).toBe('Västervik');
        expect(HOCKEY_ARENAS['Isstadion LF Arena'].city).toBe('Piteå');
        expect(HOCKEY_ARENAS['Torvalla Ishall'].city).toBe('Handen');
    });

    it('verifierade koordinater ligger i Sverige och går före geokodningen', () => {
        for (const [arena, a] of Object.entries(HOCKEY_ARENAS)) {
            if (!a.coords) continue;
            const [lat, lng] = a.coords;
            expect(lat > 55 && lat < 69.1 && lng > 10.9 && lng < 24.2, arena).toBe(true);
        }
        const g = { ...parseSchedule(YOUTH_HTML)[0], arena: 'Railone Arena', home: 'Orsa IK' };
        const e = gameToRawEvent({ leagueName: 'U18/U20' }, g, { id: '21550', name: 'U18 Division 1 B Västra Herr' });
        expect(e.coords).toEqual([61.11223, 14.64558]);
        expect(e.city).toBe('Orsa');
    });

    it('KFK Mekan Arena är gamla Borohallen i Landsbro', () => {
        expect(HOCKEY_ARENAS['KFK Mekan Arena'].city).toBe('Landsbro');
    });

    it('utländska arenor hoppas över', () => {
        expect(isForeignArena('Rödovre Centrum Arena')).toBe(true);
        expect(isForeignArena('LF Arena')).toBe(false);
        expect(isForeignArena('Okänd hall')).toBe(false);
    });
});

describe('ungdomsserier (discover-läget)', () => {
    const U20 = { id: '21567', name: 'U20 Herr Division 1 Syd B' };
    const YOUTH = { leagueName: 'U18/U20', discover: { series: '^U ?(18|20)' } };

    it('ageGroup läser åldersklassen ur serienamnet', () => {
        expect(ageGroup('U20 Herr Division 1 Syd B')).toBe('U20');
        expect(ageGroup('U18H Allettan Östra')).toBe('U18');
        expect(ageGroup('Hockeyettan Södra')).toBeUndefined();
    });

    it('titeln bär åldersklassen, url:en serien och värden serienamnet', () => {
        const g = parseSchedule(YOUTH_HTML)[0];
        const e = gameToRawEvent(YOUTH, g, U20);
        expect(e.title).toBe('Västerviks IK – Tranås AIF (U20)');
        expect(e.url).toBe(gameUrl('21567', '93711028'));
        expect(e.hostName).toBe('U20 Herr Division 1 Syd B');
        expect(e.description).toBe('U20 Herr Division 1 Syd B: Västerviks IK möter Tranås AIF i LF Arena.');
        expect(e.city).toBe('Västervik');
        expect(e.hasSpecificTime).toBe(true);
    });

    it('tid ej satt blir heldag, inte midnatt', () => {
        const e = gameToRawEvent(YOUTH, parseSchedule(TBD_HTML)[1], U20);
        expect(e.hasSpecificTime).toBe(false);
    });

    it('seniorligorna får ingen åldersklass i titeln', () => {
        const e = gameToRawEvent(ETTAN, parseSchedule(ETTAN_HTML)[1]);
        expect(e.title).toBe('Västerviks IK – Nyköpings SK');
        expect(e.hostName).toBeUndefined();
    });

    it('okänd arena geokodas på hemmalagets ort', () => {
        const g = { ...parseSchedule(YOUTH_HTML)[0], arena: 'Nybyggda hallen' };
        const e = gameToRawEvent(YOUTH, g, U20);
        expect(e.city).toBe('Västervik');
        expect(e.geocodeCandidates).toEqual(['Nybyggda hallen, Västervik', 'Västervik']);
    });

    it('seriesLinks plockar serielänkar ur navigeringen och sållar', () => {
        // Utdrag ur rotsidans meny (2026-10-10).
        const nav = `
            <a onclick="pageVisited('/ScheduleAndResults/Live/21143','U20 Regional')" href="/ScheduleAndResults/Live/21143">U20 Regional</a>
            <a href="/ScheduleAndResults/Overview/21225" target="">U18 Div 1</a>
            <a href="/ScheduleAndResults/Schedule/21567">U20 Herr Division 1 Syd B</a>
            <a href="/ScheduleAndResults/Overview/21139" target="">Preseason Games U20H</a>
            <a href="/ScheduleAndResults/Overview/21971" target="">Preseason Games U19 D</a>
            <a href="/ScheduleAndResults/Live/21041">Hockeyettan</a>
            <a href="/ScheduleAndResults/Schedule/19392">U18 5-Nations</a>`;
        const links = seriesLinks(nav, /^U ?(18|20)/i, /nations|preseason/i);
        expect(links.map(l => l.id)).toEqual(['21143', '21225', '21567']);
        expect(links[0].label).toBe('U20 Regional');
    });

    it('pageTitle ger seriens namn, avkodat', () => {
        expect(pageTitle('<title>U20 Herr Nationell S&#xF6;dra | stats.swehockey.se</title>')).toBe('U20 Herr Nationell Södra');
        expect(pageTitle('<html></html>')).toBe('');
    });

    it('assignGames: en match på flera sidor hamnar i den mest specifika serien', () => {
        const [a, b] = parseSchedule(YOUTH_HTML);
        const combined = { series: { id: '21041', name: 'Sammanslagen' }, games: [a, b] };
        const sub = { series: { id: '21567', name: 'Delserie' }, games: [a] };
        const out = assignGames([combined, sub]);
        expect(out).toHaveLength(2);
        expect(out.find(x => x.game.gameNo === a.gameNo)!.series.id).toBe('21567');
        // Ordningen in påverkar inte valet — url:en måste vara stabil.
        expect(assignGames([sub, combined])).toEqual(out);
    });
});
