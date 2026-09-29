/**
 * hockeyallsvenskan — HockeyAllsvenskans egen sajt efter plattformsbytet
 * hösten 2026 (Next.js + Strapi, "Multi-tenant hockey social network",
 * `data-tenant="ha"`).
 *
 * Varför egen motor: ligan lämnade Sportality. `www.hockeyallsvenskan.se`
 * 301:ar till apex-domänen, och där svarar `/api/site/settings` med en
 * Next-404 i HTML — sportality-motorn dog med "Unexpected token '<'"
 * (dry-run 28/9). `/api/gameday/gameheader` finns inte heller längre.
 *
 * Nya vägen — HELA säsongen i ett anrop:
 *
 *   GET https://hockeyallsvenskan.se/pages/matcher
 *
 * Sidan server-renderar spelschemat som RSC-flight (`self.__next_f.push`)
 * med komponent-props `{"season":"current", "games":[…364 matcher…]}`.
 * Varje match bär `slug`, `scheduledDateTime` (UTC), `venue`, `round`,
 * `isCompleted` och hela hemmalaget — inklusive `teamArena` och ligans egna
 * `arenaLatitude`/`arenaLongitude` (stämmer med OSM inom ~100 m för alla 14
 * arenor, kontrollerat 28/9).
 *
 * FÄLLOR:
 *  - `/api/games` finns men kräver `documentIds=` — ingen listning. Strapi-
 *    CMS:et bakom (cms-ha…) svarar 404 utan token. Schemasidan är vägen.
 *  - Hemmalagets arena ≠ matchens arena ibland: AIK:s matcher i Avicii Arena
 *    bär Hovets koordinat, Moras "Wibe Arena" har teamArena "Smidjegrav
 *    Arena" (samma hall, nytt sponsornamn). Koordinaten används därför BARA
 *    när venue och teamArena är samma namn — annars geokodar runnern venuen
 *    (data/venueFixes täcker hockeyarenorna Nominatim inte hittar).
 *  - Alla okända sökvägar svarar 200 (mjuk 404) — ett 200 bevisar ingenting,
 *    räkna matcherna.
 *  - Matchsidan är `/games/<slug>/view` (sajtens egen länkbyggare). De
 *    gamla sportality-url:erna (`www.hockeyallsvenskan.se/match/<uuid>`)
 *    går inte att översätta — de ligger bara på redan spelade matcher.
 */

import { Engine, RawEvent } from '../sources/types';
import { LEAGUE_SPORTS, type LeagueSport } from '../utils/leagueSport';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface HockeyAllsvenskanConfig {
    /** Sajtens domän utan avslutande slash, t.ex. https://hockeyallsvenskan.se */
    baseUrl: string;
    /** Visas som värd i UI:t, t.ex. "HockeyAllsvenskan" */
    leagueName: string;
    /** Sporten — står först i beskrivningen och styr kartpinnens emoji (utils/leagueSport). */
    sport?: LeagueSport;
    /** Sidan som bär spelschemat. Default /pages/matcher. */
    schedulePath?: string;
}

interface HaTeam {
    name?: string;
    teamArena?: string | null;
    arenaLatitude?: string | number | null;
    arenaLongitude?: string | number | null;
}

export interface HaGame {
    documentId?: string;
    slug?: string;
    round?: string | null;
    scheduledDateTime?: string | null;
    venue?: string | null;
    isCompleted?: boolean | null;
    homeTeam?: HaTeam | null;
    awayTeam?: HaTeam | null;
}

/**
 * Next-sidans RSC-flight: alla `self.__next_f.push([1,"…"])`-strängar,
 * avkodade och ihopslagna. Strängarna är JSON-kodade (JSON.stringify på
 * serversidan), så JSON.parse av literalen ger råtexten. Exporterad för test.
 */
export function extractFlight(html: string): string {
    const out: string[] = [];
    const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) {
        try { out.push(JSON.parse(m[1])); } catch { /* trasig bit — hoppa */ }
    }
    return out.join('');
}

/**
 * JSON-arrayen som börjar på `start` (ett '['), sträng-medvetet
 * hakparentes-räknad. null om den aldrig sluts.
 */
function sliceJsonArray(text: string, start: number): string | null {
    let depth = 0;
    let inStr = false;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (inStr) {
            if (c === '\\') i++;
            else if (c === '"') inStr = false;
            continue;
        }
        if (c === '"') inStr = true;
        else if (c === '[' || c === '{') depth++;
        else if (c === ']' || c === '}') {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

/**
 * Plocka matcherna ur flighten: varje `"games":[…]`-prop som innehåller
 * matchobjekt (scheduledDateTime), deduplicerat på documentId/slug — samma
 * match kan renderas i flera komponenter (karusell + kalender).
 * Exporterad för test.
 */
export function extractGames(flight: string): HaGame[] {
    const out: HaGame[] = [];
    const seen = new Set<string>();
    const needle = '"games":[';
    for (let at = flight.indexOf(needle); at !== -1; at = flight.indexOf(needle, at + needle.length)) {
        const raw = sliceJsonArray(flight, at + needle.length - 1);
        if (!raw) continue;
        let arr: unknown;
        try { arr = JSON.parse(raw); } catch { continue; }
        if (!Array.isArray(arr)) continue;
        for (const g of arr as HaGame[]) {
            if (!g || typeof g !== 'object' || !g.scheduledDateTime) continue;
            const key = g.documentId || g.slug;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            out.push(g);
        }
    }
    return out;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Hemmalagets arenakoordinat — BARA när matchen spelas i hemmalagets egen
 * arena (venue = teamArena). AIK i Avicii Arena bär annars Hovets punkt.
 * Exporterad för test.
 */
export function homeArenaCoords(game: HaGame): [number, number] | undefined {
    const home = game.homeTeam;
    if (!home || !norm(game.venue) || norm(game.venue) !== norm(home.teamArena)) return undefined;
    const lat = Number(home.arenaLatitude);
    const lng = Number(home.arenaLongitude);
    // Grov Sverige-ruta: tomma fält blir 0 via Number(''), och en omkastad
    // lat/lng får inte hamna i havet (runnern validerar Norden, inte Sverige).
    if (!(lat > 55 && lat < 70 && lng > 10 && lng < 25)) return undefined;
    return [lat, lng];
}

/**
 * En match → RawEvent. null för spelade matcher och ofullständiga poster.
 * Exporterad för test.
 */
export function mapHaGame(game: HaGame, cfg: HockeyAllsvenskanConfig): RawEvent | null {
    if (game.isCompleted === true) return null;
    const home = game.homeTeam?.name?.trim();
    const away = game.awayTeam?.name?.trim();
    if (!home || !away || !game.slug || !game.scheduledDateTime) return null;

    const start = new Date(game.scheduledDateTime);
    if (isNaN(start.getTime()) || start.getFullYear() < 2020) return null;

    const venue = game.venue?.trim() || undefined;
    const coords = homeArenaCoords(game);
    const round = game.round?.trim();
    const sportMatch = cfg.sport ? LEAGUE_SPORTS[cfg.sport]?.match : undefined;

    return {
        externalId: game.documentId || game.slug,
        title: `${home} – ${away}`,
        startDate: start,
        url: `${cfg.baseUrl.replace(/\/$/, '')}/games/${encodeURIComponent(game.slug)}/view`,
        venueName: venue,
        coords,
        // Ingen ort i datan — arenanamnet ensamt är den bästa geokodningsfrågan
        // när källkoordinaten saknas (annan arena än hemmalagets).
        geocodeCandidates: !coords && venue ? [venue] : undefined,
        description: `${sportMatch ? `${sportMatch} i ${cfg.leagueName}` : cfg.leagueName}: ${home} möter ${away}`
            + (venue ? ` i ${venue}` : '')
            + (round && /^\d+$/.test(round) ? ` (omgång ${round})` : '')
            + '.',
        organizer: cfg.leagueName,
        hostName: cfg.leagueName,
        category: 'sport',
        hasSpecificTime: true,
    };
}

export const hockeyAllsvenskanEngine: Engine = async (config: HockeyAllsvenskanConfig, ctx) => {
    const base = config.baseUrl.replace(/\/$/, '');
    const url = `${base}${config.schedulePath ?? '/pages/matcher'}`;
    let html: string;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'text/html' },
            signal: ctx.signal ?? AbortSignal.timeout(60_000),
        });
        if (!res.ok) { ctx.log(`HTTP ${res.status} från ${url}`); return []; }
        html = await res.text();
    } catch (err) {
        ctx.log(`schemasidan misslyckades: ${(err as Error).message}`);
        return [];
    }

    const games = extractGames(extractFlight(html));
    // Mjuk 404 (200 + tom sida) eller omgjord sajt → säg det högt i stället
    // för att tyst leverera 0 matcher.
    if (games.length === 0) { ctx.log(`inga matcher i ${url} — har sajten byggts om?`); return []; }

    const events: RawEvent[] = [];
    const seen = new Set<string>();
    let withCoords = 0;
    for (const g of games) {
        const ev = mapHaGame(g, config);
        if (!ev || seen.has(ev.url)) continue;
        seen.add(ev.url);
        if (ev.coords) withCoords++;
        events.push(ev);
    }
    ctx.log(`${config.leagueName}: ${events.length} kommande av ${games.length} matcher i säsongsschemat (${withCoords} med arenakoordinat)`);
    return events;
};
