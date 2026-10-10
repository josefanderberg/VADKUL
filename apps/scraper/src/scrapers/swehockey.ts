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
 * högsta — hette SDHL, och omdöpningen är varför den gamla `sdhl`-källan dog),
 * Hockeyettan Norra 21043 och Södra 21044 (tredjenivån — Västerviks IK m.fl.;
 * saknades till 10/10). Hockeyettans sammanslagna vy 21041 har en extra
 * seriekolumn — använd delserierna. Resten av listan är ungdom, preseason,
 * distriktsserier och cuper.
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
 * täcker SHL/HA-arenorna). Hockeyettans arenor bär sponsornamn som sällan
 * finns i OSM och ibland krockar mellan orter — se ARENA_PLACES.
 */

import { Engine, RawEvent } from '../sources/types';
import type { LeagueSport } from '../utils/leagueSport';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SweHockeyConfig {
    /** Liga-id i stats.swehockey.se, t.ex. '20961' för SHL. */
    leagueId: string;
    /** Visas som värd, t.ex. "SHL". */
    leagueName: string;
    /** Sporten — styr kartpinnens emoji (utils/leagueSport). */
    sport?: LeagueSport;
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

/**
 * Arena → ort för Hockeyettan (schemat har bara arenanamnet). Orten ger
 * runnern nearCity-skyddet och stadscentroiden som golv — utan den:
 *   - "LF Arena" finns i BÅDE Västervik och Piteå (Piteås event ligger redan
 *     i datan) → utan ort kan Västerviks hemmamatcher hamna i Norrbotten;
 *   - "Stora Hallen, Nyköping" träffar en gård i Missmyra i Nominatim;
 *   - sponsornamnen ("KFK Mekan Arena", "Tranås Åkeri Arena" …) saknas i OSM,
 *     och en miss utan ort blir 0,0 (HA-arenorna 28/9, se venueFixes).
 * `osm` = byggnadens namn i OpenStreetMap när sponsornamnet inte finns där —
 * provas först (ishallen/idrottsplatsen Nominatim gav i hemmalagets ort,
 * 2026-10-10).
 * Säsong 2026/27; nya lag/arenor faller tillbaka på enbart arenanamnet.
 */
export const ARENA_PLACES: Record<string, { city: string; osm?: string }> = {
    // Hockeyettan Norra (21043)
    'Bahcohallen': { city: 'Enköping' },
    'Borlänge Ishall': { city: 'Borlänge' },
    'Brandcode Center': { city: 'Sundsvall' },
    'CYLOQ Arena': { city: 'Sollentuna' },
    'HIVE Arena': { city: 'Boden' },
    'Holmen Center': { city: 'Hudiksvall' },
    'Isstadion LF Arena': { city: 'Piteå', osm: 'LF Arena' },
    'Järfälla Ishall': { city: 'Järfälla' },
    'Lindehov': { city: 'Lindesberg' },
    'Lombiahallen': { city: 'Kiruna', osm: 'Lombia ishall' },
    'Norra Finans Arena': { city: 'Haparanda' },
    'PART Arena': { city: 'Kalix' },
    'Pinbackshallen': { city: 'Märsta' },
    'Roslagens Sparbank Arena': { city: 'Norrtälje' },
    'Skyttishallen': { city: 'Örnsköldsvik' },
    'Testebo Arena': { city: 'Gävle' },
    'Vallentuna Ishall': { city: 'Vallentuna' },
    'Vilundaparkens Ishall A': { city: 'Upplands Väsby' },
    'XLNT AKUSTIK Arena': { city: 'Surahammar', osm: 'Surahallen' },
    // Hockeyettan Södra (21044)
    'Billerudhallen': { city: 'Grums' },
    'Björkängshallen': { city: 'Huddinge' },
    'Borås Ishall': { city: 'Borås' },
    'Dackehallen': { city: 'Tingsryd' },
    'Halmstad Arena': { city: 'Halmstad' },
    'Himmelstalundshallen': { city: 'Norrköping' },
    'Husqvarna Garden': { city: 'Jönköping' },
    'Jössarinken A-hall': { city: 'Mörrum', osm: 'Jössarinken' },
    'KFK Mekan Arena': { city: 'Landsbro', osm: 'Borohallen' },   // ex Borohallen, Sävsjövägen 27 — INTE Vetlanda tätort
    'LF Arena': { city: 'Västervik' },
    'Mariehus Arena': { city: 'Mariestad' },
    'NKT Arena Karlskrona A-Hall': { city: 'Karlskrona', osm: 'NKT Arena Karlskrona' },
    'Oasen': { city: 'Kungälv', osm: 'Oasen sim- och ishall' },
    'ProTrain Arena': { city: 'Mjölby', osm: 'Mjölby ishall' },
    'SP Arena': { city: 'Ljungby' },
    'Smedjehov': { city: 'Norrahammar' },   // HC Dalens hemmahall, Jönköpings kommun
    'Stora Hallen': { city: 'Nyköping', osm: 'Rosvalla' },
    'Tranås Åkeri Arena': { city: 'Tranås' },
    'Tyresö Ishall': { city: 'Tyresö' },
    'Tyrs Hov Sportcentra': { city: 'Tyringe', osm: 'Tyrs hov' },
    'Åse & Viste Arena': { city: 'Grästorp' },
};

/** Geokodningsled för en känd arena: OSM-namnet, sponsornamnet, sist orten. */
export function arenaGeo(arena: string): Pick<RawEvent, 'city' | 'geocodeCandidates'> {
    const place = ARENA_PLACES[arena];
    if (!place) return {};
    return {
        city: place.city,
        geocodeCandidates: [
            ...(place.osm ? [`${place.osm}, ${place.city}`] : []),
            `${arena}, ${place.city}`,
            place.city,
        ],
    };
}

/** En schemarad → RawEvent. Ren funktion — exporterad för test. */
export function gameToRawEvent(config: SweHockeyConfig, g: SweHockeyGame): RawEvent {
    return {
        externalId: g.gameNo,
        title: `${g.home} – ${g.away}`,
        startDate: g.startsAt,
        url: gameUrl(config.leagueId, g.gameNo),
        venueName: g.arena || undefined,
        ...arenaGeo(g.arena),
        category: 'sport',
        hasSpecificTime: true,
        description: `${config.leagueName}: ${g.home} möter ${g.away}`
            + (g.arena ? ` i ${g.arena}.` : '.'),
    };
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

    return games.map(g => gameToRawEvent(config, g));
};
