/**
 * swehockey — Svenska Ishockeyförbundets officiella statistiksystem
 * (stats.swehockey.se). HELA säsongsschemat, server-renderat.
 *
 * Varför den finns: `sportality`-motorn (shl.se m.fl.) kan bara se ett
 * RULLANDE ~5-dagarsfönster, så hela SHL låg på ~7 kommande matcher i DB:n mot
 * säsongens 364. Vägen till ligans eget säsongs-API är bevisat stängd (se
 * sportality.ts). Förbundet publicerar däremot samma data öppet:
 *
 *   GET /ScheduleAndResults/Schedule/<ligaId>   → hela säsongen i en HTML-tabell
 *
 * Ligorna med publik: SHL 20961, HockeyAllsvenskan 20962, NDHL 20958 (damernas
 * högsta — hette SDHL, och omdöpningen är varför den gamla `sdhl`-källan dog).
 * Resten av registrets 86 ligor är ungdom, preseason och cuper.
 *
 * TABELLEN ÄR GRUPPERAD PER DATUM: första matchen ett visst datum har en rad
 * med 6 celler där cell 0 är datumet; efterföljande matcher samma dag har 5
 * celler och ÄRVER datumet. Utan carry-forward tappar man 306 av 364 matcher.
 *
 * INGEN matchlänk finns — varken här eller på /GamesByDate. Matchnumret ligger
 * i en tooltip (`title="90001002"`), och url:en syntetiseras ur den. Det är
 * nödvändigt: url är primärnyckel i hela pipelinen, och utan unik url hade
 * hela säsongen dedupats till en enda match.
 *
 * Ingen koordinat i datan; arenanamnet geokodas av runnern (known_venues
 * täcker de flesta hockeyarenor).
 */

import { Engine, RawEvent } from '../sources/types';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SweHockeyConfig {
    /** Liga-id i stats.swehockey.se, t.ex. '20961' för SHL. */
    leagueId: string;
    /** Visas som värd, t.ex. "SHL". */
    leagueName: string;
}

export interface SweHockeyGame {
    gameNo: string;
    startsAt: Date;
    home: string;
    away: string;
    arena: string;
}

const cellText = (cell: string): string =>
    cell.replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#xE4;|&auml;/gi, 'ä')
        .replace(/&#xF6;|&ouml;/gi, 'ö')
        .replace(/&#xE5;|&aring;/gi, 'å')
        .replace(/\s+/g, ' ')
        .trim();

/** Lokal tid → Date. Schemat är svensk tid; runnern lagrar UTC. */
function toDate(dateStr: string, timeStr: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const t = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
    if (!m || !t) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], 0, 0);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Plocka matcherna ur en schemasida. Ren funktion — exporterad för test.
 *
 * Rader utan matchnummer hoppas över: tabellen innehåller även rubrik- och
 * mellanrader, och en rad utan nummer kan inte få en unik url.
 */
export function parseSchedule(html: string): SweHockeyGame[] {
    const games: SweHockeyGame[] = [];
    let currentDate = '';

    for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
        const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(cellText);
        if (cells.length < 5) continue;

        // 6-cellsraden inleder en ny speldag; 5-cellsraderna ärver datumet.
        const leadIsDate = /^\d{4}-\d{2}-\d{2}$/.test(cells[0]);
        if (leadIsDate) currentDate = cells[0];
        if (!currentDate) continue;

        const rest = leadIsDate ? cells.slice(1) : cells;
        const time = (rest[0].match(/(\d{1,2}:\d{2})\s*$/) ?? [])[1] ?? rest[0];
        const teams = rest.find(c => c.includes(' - '));
        if (!teams) continue;
        const [home, away] = teams.split(' - ').map(s => s.trim());
        if (!home || !away) continue;

        // Matchnumret bor i tooltipen, inte i någon cell.
        const gameNo = (row.match(/class="lnkTooltip"[^>]*title="(\d{4,})"/) ?? [])[1]
            ?? (row.match(/title="(\d{6,})"/) ?? [])[1];
        if (!gameNo) continue;

        const startsAt = toDate(currentDate, time);
        if (!startsAt) continue;

        const arena = rest[rest.length - 1] || '';
        games.push({ gameNo, startsAt, home, away, arena });
    }
    return games;
}

/** url = primärnyckel. Ingen matchsida finns, så numret bär unikheten. */
export function gameUrl(leagueId: string, gameNo: string): string {
    return `https://stats.swehockey.se/ScheduleAndResults/Schedule/${leagueId}?game=${gameNo}`;
}

export const sweHockeyEngine: Engine = async (config: SweHockeyConfig, ctx) => {
    const url = `https://stats.swehockey.se/ScheduleAndResults/Schedule/${config.leagueId}`;
    let html: string;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctx.signal });
        if (!res.ok) { ctx.log(`HTTP ${res.status} från ${url}`); return []; }
        html = await res.text();
    } catch (err) {
        ctx.log(`fetch misslyckades: ${(err as Error).message}`);
        return [];
    }

    const games = parseSchedule(html);
    ctx.log(`${config.leagueName}: ${games.length} matcher i säsongsschemat`);

    return games.map((g): RawEvent => ({
        externalId: g.gameNo,
        title: `${g.home} – ${g.away}`,
        startDate: g.startsAt,
        url: gameUrl(config.leagueId, g.gameNo),
        venueName: g.arena || undefined,
        category: 'sport',
        hasSpecificTime: true,
        description: `${config.leagueName}: ${g.home} möter ${g.away}`
            + (g.arena ? ` i ${g.arena}.` : '.'),
    }));
};
