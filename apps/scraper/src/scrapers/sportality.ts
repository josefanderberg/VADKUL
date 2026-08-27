/**
 * sportality — Engine för de svenska hockeyligornas gemensamma plattform
 * (Sportality; CDN:en heter sportality.cdn.s8y.se).
 *
 * Upptäckt 2026-08-26 när vi vägde Everysports betal-API mot gratisvägar:
 * shl.se, hockeyallsvenskan.se och sdhl.se kör IDENTISKT API på var sin domän.
 *
 *   GET <base>/api/site/settings        → ligans lag, med nationalitet
 *   GET <base>/api/gameday/gameheader   → { "YYYY-MM-DD": [ match, … ] }
 *
 * Öppet, ingen auth. Matcherna bär venue, exakt starttid (UTC) och lagnamn.
 *
 * FÄLLOR:
 *  - `gameheader` är ett RULLANDE fönster på ~5 speldatum och tar INGA
 *    datumparametrar (`?date=`/`?from=` ignoreras tyst — samma svar). Hela
 *    säsongsschemat ligger bakom `/api/sports-v2/game-schedule`, som kräver
 *    seasonUuid + seriesUuid; seriesUuid finns i settings men seasonUuid har
 *    vi inte hittat (spelschema-sidan gör inget anrop att sniffa). Med
 *    every-3d-kadens fångas matcherna ändå in efterhand, ~5 dagar i förväg.
 *  - Feeden blandar in CHL-matcher spelade UTOMLANDS (Logspeed CZ Aréna i
 *    Plzeň dök upp i SHL-feeden). Vi tar bara matcher där HEMMALAGET är
 *    svenskt — hemmalaget avgör arenans land.
 *  - `nationality` i settings är rörig: svenska lag har `sv`, medan `SE`
 *    felaktigt sitter på flera tjeckiska/slovakiska lag. Matcha på `sv`.
 *  - Samma lagkod förekommer flera gånger i `allTeamsInSite` (en post per
 *    serie laget spelar i) — bygg ett Set, räkna inte.
 *
 * Ingen koordinat i datan; arenanamnet geokodas av runnern (known_venues
 * täcker de flesta hockeyarenor).
 */

import { Engine, RawEvent } from '../sources/types';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SportalityConfig {
    /** Ligans domän utan avslutande slash, t.ex. https://www.shl.se */
    baseUrl: string;
    /** Visas som värd i UI:t, t.ex. "SHL" */
    leagueName: string;
}

interface SportalityTeam { name?: string; code?: string }
interface SportalityGame {
    uuid?: string;
    startDateTime?: string;      // ISO UTC
    played?: boolean;
    venue?: string;
    seriesCode?: string;
    roundLabel?: string;
    homeTeam?: SportalityTeam;
    awayTeam?: SportalityTeam;
}

/**
 * Lagkoder för klubbar med svensk nationalitet. `sv` är markören — `SE`
 * förekommer på utländska lag och får INTE användas. Exporterad för test.
 */
export function swedishTeamCodes(settings: unknown): Set<string> {
    const teams = (settings as { allTeamsInSite?: { teamCode?: string; nationality?: string }[] })?.allTeamsInSite;
    const out = new Set<string>();
    if (!Array.isArray(teams)) return out;
    for (const t of teams) {
        if (t?.nationality === 'sv' && t.teamCode) out.add(t.teamCode);
    }
    return out;
}

/**
 * En match → RawEvent. Returnerar null för spelade matcher, matcher utan
 * hemmalag i `swedish` (= arena utomlands) och ofullständiga poster.
 * Exporterad för test.
 */
export function mapSportalityGame(
    game: SportalityGame,
    cfg: SportalityConfig,
    swedish: Set<string>,
): RawEvent | null {
    if (game.played) return null;
    const home = game.homeTeam?.name?.trim();
    const away = game.awayTeam?.name?.trim();
    const code = game.homeTeam?.code;
    if (!home || !away || !game.uuid || !game.startDateTime) return null;
    // Hemmalaget avgör arenans land — utan svenskt hemmalag spelas matchen utomlands.
    if (!code || !swedish.has(code)) return null;

    const start = new Date(game.startDateTime);
    if (isNaN(start.getTime())) return null;

    const venue = game.venue?.trim() || undefined;
    const series = game.seriesCode?.trim();
    const parts = [series && series !== cfg.leagueName ? series : cfg.leagueName, game.roundLabel?.trim()]
        .filter(Boolean);

    return {
        externalId: game.uuid,
        title: `${home} – ${away}`,
        startDate: start,
        url: `${cfg.baseUrl.replace(/\/$/, '')}/match/${game.uuid}`,
        venueName: venue,
        // Ingen ort i datan — arenanamnet ensamt är den bästa geokodningsfrågan.
        geocodeCandidates: venue ? [venue] : undefined,
        description: parts.length ? parts.join(' · ') : undefined,
        organizer: cfg.leagueName,
        hostName: cfg.leagueName,
        category: 'sport',
        hasSpecificTime: true,
    };
}

export const sportalityEngine: Engine = async (config: SportalityConfig, ctx) => {
    const base = config.baseUrl.replace(/\/$/, '');
    const headers = { 'User-Agent': UA, Accept: 'application/json' };

    let swedish: Set<string>;
    try {
        const res = await fetch(`${base}/api/site/settings`, { headers, signal: ctx.signal ?? AbortSignal.timeout(30_000) });
        if (!res.ok) { ctx.log(`settings HTTP ${res.status}`); return []; }
        swedish = swedishTeamCodes(await res.json());
    } catch (err) {
        ctx.log(`settings-fel: ${(err as Error).message}`);
        return [];
    }
    // Utan laglista skulle Sverige-filtret släppa igenom allt — avbryt hellre.
    if (swedish.size === 0) { ctx.log('inga svenska lag i settings — hoppar över'); return []; }

    let byDate: Record<string, SportalityGame[]>;
    try {
        const res = await fetch(`${base}/api/gameday/gameheader`, { headers, signal: ctx.signal ?? AbortSignal.timeout(30_000) });
        if (!res.ok) { ctx.log(`gameheader HTTP ${res.status}`); return []; }
        byDate = await res.json();
    } catch (err) {
        ctx.log(`gameheader-fel: ${(err as Error).message}`);
        return [];
    }

    const events: RawEvent[] = [];
    const seen = new Set<string>();
    let skippedAbroad = 0;
    for (const games of Object.values(byDate ?? {})) {
        if (!Array.isArray(games)) continue;
        for (const g of games) {
            const ev = mapSportalityGame(g, config, swedish);
            if (!ev) { if (!g.played && g.homeTeam?.code && !swedish.has(g.homeTeam.code)) skippedAbroad++; continue; }
            if (seen.has(ev.url)) continue;
            seen.add(ev.url);
            events.push(ev);
        }
    }
    ctx.log(`${config.leagueName}: ${events.length} matcher (${skippedAbroad} utomlands bortfiltrerade, ${swedish.size} svenska lag)`);
    return events;
};
