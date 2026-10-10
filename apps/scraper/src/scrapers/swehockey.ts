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
 * seriekolumn — använd delserierna. U18/U20 (~40 serier, Nationell → Div 2)
 * hittas av `discover`-läget i stället för fasta id:n, se discoverSeries.
 *
 * TVÅ TABELLAYOUTER, se parseSchedule: seniorligornas är grupperad per datum
 * (följande matcher samma dag ÄRVER datumet — utan carry-forward tappar man
 * 306 av 364 SHL-matcher), ungdomsseriernas har "datum tid" i tooltipen.
 *
 * INGEN matchlänk finns — varken här eller på /GamesByDate. Matchnumret ligger
 * i en tooltip (`title="90001002"`), och url:en syntetiseras ur den. Det är
 * nödvändigt: url är primärnyckel i hela pipelinen, och utan unik url hade
 * hela säsongen dedupats till en enda match.
 *
 * Ingen koordinat i datan; arenanamnet geokodas av runnern (known_venues
 * täcker SHL/HA-arenorna). Hockeyettans och ungdomsseriernas arenor bär
 * sponsornamn som sällan finns i OSM och ibland krockar mellan orter — orten
 * kommer ur data/hockeyArenas.ts, se arenaGeo.
 */

import { Engine, RawEvent } from '../sources/types';
import type { LeagueSport } from '../utils/leagueSport';
import { HOCKEY_ARENAS } from '../data/hockeyArenas';
import { SWEDISH_GEO_CITIES } from '../utils/venueCoordinates';
import { FB_SEARCH_CITIES } from '../utils/swedishPlaces';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SweHockeyConfig {
    /** Liga-id i stats.swehockey.se, t.ex. '20961' för SHL. Utelämnas med `discover`. */
    leagueId?: string;
    /** Visas som värd, t.ex. "SHL". Med `discover` bär varje match sin serie. */
    leagueName: string;
    /** Sporten — styr kartpinnens emoji (utils/leagueSport). */
    sport?: LeagueSport;
    /**
     * Hitta serierna själv i stället för ett fast id (se discoverSeries):
     * `series` matchar både navigeringens etiketter och sidornas titlar
     * (regex, skiftlägesokänsligt), `exclude` sållar bort det som inte är
     * seriespel (landslag, preseason, cuper).
     */
    discover?: { series: string; exclude?: string };
}

export interface SweHockeyGame {
    gameNo: string;
    startsAt: Date;
    /** false när schemat säger 00:00 — förbundets "tid ej satt", ingen match nattetid. */
    timeSet: boolean;
    home: string;
    away: string;
    arena: string;
}

/** Entiteter → tecken. Sidorna kodar ÅÄÖ och hårt mellanslag (&#xA0;) numeriskt. */
export function decodeEntities(s: string): string {
    return s
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&nbsp;/g, ' ')
        .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&aring;/g, 'å')
        .replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Aring;/g, 'Å')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

const cellText = (cell: string): string =>
    decodeEntities(cell.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * Radens celler som rå HTML. Självstängande `<td … />` (mobil-/desktop-
 * kolumner) är egna, tomma celler — en naiv `<td>…</td>`-regex låter dem
 * svälja nästa cell.
 */
function rowCells(row: string): string[] {
    return [...row.matchAll(/<td\b[^>]*?(?:\/>|>([\s\S]*?)<\/td>)/gi)].map(m => m[1] ?? '');
}

/** Lokal tid → Date. Schemat är svensk tid; runnern lagrar UTC. */
function toDate(dateStr: string, timeStr: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const t = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
    if (!m || !t) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], 0, 0);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Uppskjutna/inställda matcher står kvar på ursprungsdatumet med status
 * under lagnamnen (`Lag A - Lag B<br /><i>Postponed</i>`, även "Uppskjuten,
 * ny tid kommer"). De spelas inte det datumet och får aldrig sparas där.
 */
const NOT_PLAYED = /\b(postponed|cancel+ed|uppskjuten|inställd|struken|avbruten)\b/i;

/**
 * Plocka matcherna ur en schemasida. Ren funktion — exporterad för test.
 *
 * Två layouter förekommer:
 *   A (SHL/HA/Hockeyettan): grupperad per speldag — första raden en dag har
 *     datumet i egen cell, följande rader ÄRVER det; tooltipen bär bara tiden.
 *   B (ungdomsserierna): ingen gruppering — tooltipen bär "datum tid" med
 *     hårt mellanslag emellan; första cellen är omgångsnumret.
 *
 * Rader utan matchnummer hoppas över: tabellen innehåller även rubrik- och
 * mellanrader, och en rad utan nummer kan inte få en unik url.
 */
export function parseSchedule(html: string): SweHockeyGame[] {
    const games: SweHockeyGame[] = [];
    let currentDate = '';

    for (const row of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []) {
        const raw = rowCells(row);
        if (raw.length < 5) continue;
        // Det som står efter <br> i en cell är status ("Postponed"), inte data.
        const cells = raw.map(c => cellText(c.replace(/<br\b[\s\S]*$/i, '')));

        // Layout A: en cell som är exakt ett datum inleder en ny speldag.
        const dateCell = cells.find(c => /^\d{4}-\d{2}-\d{2}$/.test(c));
        if (dateCell) currentDate = dateCell;

        // Matchnumret och tiden bor i tooltipen, inte i någon cell.
        const tip = /class="lnkTooltip"[^>]*title="(\d{4,})"[^>]*>([\s\S]*?)<\//.exec(row);
        if (!tip) continue;
        const gameNo = tip[1];
        const tipText = cellText(tip[2]);
        const dated = /^(\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})$/.exec(tipText);   // layout B
        const date = dated ? dated[1] : currentDate;
        const time = dated ? dated[2] : tipText;
        if (!date) continue;

        // Lagcellen: första "X - Y" som inte är ett resultat ("1 - 3").
        const teams = cells.find(c => / - /.test(c) && !/^\d+ - \d+$/.test(c));
        if (!teams) continue;
        const [home, away] = teams.split(' - ').map(s => s.trim());
        if (!home || !away) continue;

        if (NOT_PLAYED.test(cellText(row))) continue;

        const startsAt = toDate(date, time);
        if (!startsAt) continue;

        const arena = cells[cells.length - 1] || '';
        games.push({ gameNo, startsAt, timeSet: time !== '00:00', home, away, arena });
    }
    return games;
}

/** url = primärnyckel. Ingen matchsida finns, så numret bär unikheten. */
export function gameUrl(leagueId: string, gameNo: string): string {
    return `https://stats.swehockey.se/ScheduleAndResults/Schedule/${leagueId}?game=${gameNo}`;
}

// ─── Ort ────────────────────────────────────────────────────────────────────

/** Kända svenska orter, gemener → stavning. Tvetydiga namn (Mora, Kil …) är
 *  ofarliga här: lagen spelar redan i svenska serier. */
const TOWNS = new Map(
    [...SWEDISH_GEO_CITIES, ...FB_SEARCH_CITIES].map(t => [t.toLowerCase(), t] as [string, string]),
);

/**
 * Hemmalagets ort ur lagnamnet — reserv för arenor som saknas i
 * HOCKEY_ARENAS. Bara exakta ortnamn (genitiv-s tillåtet): "Västerviks IK"
 * → Västervik, "IF Troja-Ljungby" → Ljungby, "HC Dalen" → ingen gissning.
 */
export function townFromTeam(team: string): string | undefined {
    for (const word of team.split(/[\s/]+/)) {
        for (const part of [word, ...word.split('-')]) {
            const key = part.toLowerCase().replace(/:\d+$/, '');
            if (key.length < 3) continue;
            const town = TOWNS.get(key) ?? (key.endsWith('s') ? TOWNS.get(key.slice(0, -1)) : undefined);
            if (town) return town;
        }
    }
    return undefined;
}

/**
 * Geokodningsled för en match: OSM-namnet, arenan, sist orten — orten ur
 * HOCKEY_ARENAS, annars hemmalagets. Utan någon ort lämnas geokodningen åt
 * runnern (arenanamnet ensamt), som förut.
 */
export function arenaGeo(arena: string, homeTeam = ''): Pick<RawEvent, 'city' | 'geocodeCandidates'> {
    const known = HOCKEY_ARENAS[arena];
    const city = known?.city ?? townFromTeam(homeTeam);
    if (!city) return {};
    return {
        city,
        geocodeCandidates: [
            ...(known?.osm ? [`${known.osm}, ${city}`] : []),
            ...(arena ? [`${arena}, ${city}`] : []),
            city,
        ],
    };
}

export const isForeignArena = (arena: string): boolean => HOCKEY_ARENAS[arena]?.foreign === true;

// ─── Serier ─────────────────────────────────────────────────────────────────

export interface SweHockeySeries {
    id: string;
    /** Seriens namn ur sidtiteln, t.ex. "U20 Herr Division 1 Syd B". */
    name: string;
}

/** "U20 Herr Division 1 Syd B" → "U20" — åldersklassen till titeln. */
export function ageGroup(seriesName: string): string | undefined {
    const m = /^U\s?(\d{2})/i.exec(seriesName.trim());
    return m ? `U${m[1]}` : undefined;
}

/** En schemarad → RawEvent. Ren funktion — exporterad för test. */
export function gameToRawEvent(config: SweHockeyConfig, g: SweHockeyGame, series?: SweHockeySeries): RawEvent {
    const leagueName = series?.name ?? config.leagueName;
    // Ungdomsmatcherna heter som A-lagens ("Västerviks IK – Nässjö HC") —
    // åldersklassen skiljer dem åt på kartan och i dedupen (titel + tid).
    const age = series ? ageGroup(series.name) : undefined;
    return {
        externalId: g.gameNo,
        title: `${g.home} – ${g.away}${age ? ` (${age})` : ''}`,
        startDate: g.startsAt,
        url: gameUrl(series?.id ?? config.leagueId ?? '', g.gameNo),
        venueName: g.arena || undefined,
        ...arenaGeo(g.arena, g.home),
        ...(series ? { hostName: series.name } : {}),
        category: 'sport',
        hasSpecificTime: g.timeSet,
        description: `${leagueName}: ${g.home} möter ${g.away}`
            + (g.arena ? ` i ${g.arena}.` : '.'),
    };
}

/** Serielänkar på en sida (navigeringen + syskonserier) vars etikett matchar. */
export function seriesLinks(html: string, include: RegExp, exclude?: RegExp): { id: string; label: string }[] {
    const found = new Map<string, string>();
    for (const m of html.matchAll(/\/ScheduleAndResults\/(?:Schedule|Overview|Live|Standings)\/(\d+)[^>]*>([^<]{2,80})</g)) {
        const label = cellText(m[2]);
        if (!include.test(label) || exclude?.test(label) || found.has(m[1])) continue;
        found.set(m[1], label);
    }
    return [...found].map(([id, label]) => ({ id, label }));
}

/** "U20 Herr Division 1 Syd B | stats.swehockey.se" → "U20 Herr Division 1 Syd B". */
export function pageTitle(html: string): string {
    const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
    return m ? cellText(m[1]).replace(/\s*\|\s*stats\.swehockey\.se\s*$/i, '').trim() : '';
}

/**
 * En match kan stå på flera sidor (sammanslagna vyer som Hockeyettans 21041).
 * Behåll den mest specifika sidan — minst schema, lika → lägst id — så att
 * url:en (primärnyckeln) aldrig byter serie mellan körningar.
 */
export function assignGames(
    pages: { series: SweHockeySeries; games: SweHockeyGame[] }[],
): { series: SweHockeySeries; game: SweHockeyGame }[] {
    const ordered = [...pages].sort((a, b) => a.games.length - b.games.length || Number(a.series.id) - Number(b.series.id));
    const seen = new Set<string>();
    const out: { series: SweHockeySeries; game: SweHockeyGame }[] = [];
    for (const p of ordered) {
        for (const game of p.games) {
            if (seen.has(game.gameNo)) continue;
            seen.add(game.gameNo);
            out.push({ series: p.series, game });
        }
    }
    return out;
}

// ─── Motorn ─────────────────────────────────────────────────────────────────

const BASE = 'https://stats.swehockey.se';
/** Tak för upptäckten — säsongen 2026/27 har ~40 U18/U20-serier. */
const MAX_SERIES_PAGES = 120;

async function fetchPage(url: string, ctx: Parameters<Engine>[1]): Promise<string | null> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctx.signal });
        if (!res.ok) { ctx.log(`HTTP ${res.status} från ${url}`); return null; }
        return await res.text();
    } catch (err) {
        ctx.log(`fetch misslyckades (${url}): ${(err as Error).message}`);
        return null;
    }
}

/**
 * Upptäck serierna: rotsidans navigering → varje träffad serie-sida →
 * dess syskonserier (Div 1 Syd A → B, C …), tills inget nytt dyker upp.
 * Serie-id:n byts varje säsong och vårserier tillkommer mitt i säsongen —
 * hårdkodade id:n hade tappat dem.
 */
async function discoverSeries(
    config: SweHockeyConfig,
    ctx: Parameters<Engine>[1],
): Promise<{ series: SweHockeySeries; games: SweHockeyGame[] }[]> {
    const include = new RegExp(config.discover!.series, 'i');
    const exclude = config.discover!.exclude ? new RegExp(config.discover!.exclude, 'i') : undefined;
    const root = await fetchPage(`${BASE}/`, ctx);
    if (!root) return [];

    const queue = seriesLinks(root, include, exclude).map(l => l.id);
    const seen = new Set(queue);
    const pages: { series: SweHockeySeries; games: SweHockeyGame[] }[] = [];
    let fetched = 0;
    while (queue.length && fetched < MAX_SERIES_PAGES) {
        const id = queue.shift()!;
        const html = await fetchPage(`${BASE}/ScheduleAndResults/Schedule/${id}`, ctx);
        fetched++;
        if (!html) continue;
        for (const l of seriesLinks(html, include, exclude)) {
            if (!seen.has(l.id)) { seen.add(l.id); queue.push(l.id); }
        }
        // Sidans titel avgör — navigeringens korta etiketter ("U18") leder
        // även till landslagsturneringar ("U18 5-Nations").
        const name = pageTitle(html);
        if (!include.test(name) || exclude?.test(name)) continue;
        pages.push({ series: { id, name }, games: parseSchedule(html) });
    }
    if (queue.length) ctx.log(`⚠️ upptäckten stannade vid taket ${MAX_SERIES_PAGES} sidor — ${queue.length} serier ohämtade`);
    return pages;
}

export const sweHockeyEngine: Engine = async (config: SweHockeyConfig, ctx) => {
    let games: { series?: SweHockeySeries; game: SweHockeyGame }[];
    if (config.discover) {
        const pages = await discoverSeries(config, ctx);
        games = assignGames(pages);
        ctx.log(`${config.leagueName}: ${pages.length} serier, ${games.length} matcher`);
    } else if (config.leagueId) {
        const html = await fetchPage(`${BASE}/ScheduleAndResults/Schedule/${config.leagueId}`, ctx);
        if (!html) return [];
        games = parseSchedule(html).map(game => ({ game }));
        ctx.log(`${config.leagueName}: ${games.length} matcher i säsongsschemat`);
    } else {
        ctx.log('config saknar både leagueId och discover');
        return [];
    }

    const foreign = games.filter(x => isForeignArena(x.game.arena));
    if (foreign.length) ctx.log(`${foreign.length} matcher på utländska arenor hoppas över`);
    const unknown = [...new Set(games.map(x => x.game.arena).filter(a => a && !HOCKEY_ARENAS[a]))];
    if (config.discover && unknown.length) {
        ctx.log(`okänd arena (${unknown.length}, geokodas på hemmalagets ort — lägg till i data/hockeyArenas.ts): ${unknown.slice(0, 10).join(', ')}`);
    }

    return games
        .filter(x => !isForeignArena(x.game.arena))
        .map(x => gameToRawEvent(config, x.game, x.series));
};
