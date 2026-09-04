/**
 * sportomedia — Engine för de svenska fotbollsligornas gemensamma GraphQL-API.
 *
 * Upptäckt 2026-08-26: allsvenskan.se, superettan.se, damallsvenskan.se och
 * elitettan.se svarar 403 på vanlig curl, men i browsern går all data via
 *
 *   POST https://gql.sportomedia.se/graphql
 *   query matchesForLeague(configLeagueName, configSeasonStartYear,
 *                          startDate, endDate) { matches { … } }
 *
 * Ingen auth. Till skillnad från hockeyns rullande gameday-fönster tar det här
 * ett RIKTIGT datumintervall — hela spelschemat är tillgängligt i förväg.
 *
 * Fältkvalitet (allsvenskan, 30-dagarsfönster 2026-08-26):
 *   - startDate    ISO UTC med exakt avsparkstid, 100 %
 *   - arenaName    100 %
 *   - status       UPCOMING / FINISHED / ONGOING / INTERRUPTED / POSTPONED
 *
 * FÄLLOR:
 *  - GraphQL-endpointen är öppen men LIGASAJTERNA blockar botar (403). Länkarna
 *    vi lagrar fungerar i en riktig webbläsare — testa dem inte med curl och
 *    tro att de är döda.
 *  - `configLeagueName` går inte att lista via API:t (ingen leagues-query) —
 *    värdena är hårdkodade per källa. `ettan`, `ettanNorra` m.fl. gav 0.
 *  - Match-URL:en är `<sajt>/matcher/<år>/<id>` — slug-delen efter id:t är
 *    valfri, vi utelämnar den.
 *  - Introspection är påslagen; använd den när fält saknas (`arena` finns inte,
 *    fältet heter `arenaName`).
 *
 * Ingen koordinat i datan; arenanamnet geokodas av runnern.
 */

import { Engine, RawEvent } from '../sources/types';

const API = 'https://gql.sportomedia.se/graphql';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const QUERY = `query matchesForLeague($configLeagueName: String!, $configSeasonStartYear: Int!, $startDate: String, $endDate: String) {
  matchesForLeague(configLeagueName: $configLeagueName, configSeasonStartYear: $configSeasonStartYear, startDate: $startDate, endDate: $endDate) {
    matches { id startDate homeTeamName visitingTeamName status arenaName round }
  }
}`;

export interface SportomediaConfig {
    /** API:ts liga-nyckel, t.ex. 'allsvenskan' */
    league: string;
    /** Visas som värd i UI:t, t.ex. 'Allsvenskan' */
    leagueName: string;
    /** Ligans publika sajt, t.ex. https://allsvenskan.se */
    siteBase: string;
}

interface SportomediaMatch {
    id?: number;
    startDate?: string;
    homeTeamName?: string;
    visitingTeamName?: string;
    status?: string;
    arenaName?: string;
    round?: number;
}

/** Spelas matchen? Allt utom kommande/pågående är ointressant. Exporterad för test. */
export function isPlayableStatus(status: string | undefined): boolean {
    return status === 'UPCOMING' || status === 'ONGOING';
}

/** Mappa en match → RawEvent. Exporterad för test. */
export function mapSportomediaMatch(
    m: SportomediaMatch,
    cfg: SportomediaConfig,
): RawEvent | null {
    const home = m.homeTeamName?.trim();
    const away = m.visitingTeamName?.trim();
    if (!home || !away || m.id == null || !m.startDate) return null;
    if (!isPlayableStatus(m.status)) return null;

    const start = new Date(m.startDate);
    if (isNaN(start.getTime())) return null;

    const venue = m.arenaName?.trim() || undefined;
    const year = start.getFullYear();

    return {
        externalId: `${m.id}`,
        title: `${home} – ${away}`,
        startDate: start,
        // Slug-delen efter id:t är valfri.
        url: `${cfg.siteBase.replace(/\/$/, '')}/matcher/${year}/${m.id}`,
        venueName: venue,
        // Ingen ort i datan — arenanamnet ensamt är bästa geokodningsfrågan.
        geocodeCandidates: venue ? [venue] : undefined,
        description: m.round != null ? `${cfg.leagueName} · Omgång ${m.round}` : cfg.leagueName,
        organizer: cfg.leagueName,
        hostName: cfg.leagueName,
        category: 'sport',
        hasSpecificTime: true,
    };
}

async function fetchSeason(
    cfg: SportomediaConfig,
    year: number,
    from: string,
    to: string,
    signal: AbortSignal | undefined,
): Promise<SportomediaMatch[]> {
    const res = await fetch(API, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/json',
            // Ligasajten som origin — API:t svarar utan, men var en god gäst.
            Origin: cfg.siteBase,
            Referer: `${cfg.siteBase}/`,
        },
        body: JSON.stringify({
            query: QUERY,
            operationName: 'matchesForLeague',
            variables: { configLeagueName: cfg.league, configSeasonStartYear: year, startDate: from, endDate: to },
        }),
        signal: signal ?? AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { errors?: { message: string }[]; data?: { matchesForLeague?: { matches?: SportomediaMatch[] } } };
    if (json.errors?.length) throw new Error(json.errors[0].message.slice(0, 120));
    return json.data?.matchesForLeague?.matches ?? [];
}

export const sportomediaEngine: Engine = async (config: SportomediaConfig, ctx) => {
    const from = ctx.windowStart.toISOString().slice(0, 10);
    const to = ctx.windowEnd.toISOString().slice(0, 10);
    // Säsongen namnges efter startåret. Ett fönster som korsar nyår hör till
    // två säsonger — fråga båda hellre än att tappa januarimatcherna.
    const years = [...new Set([ctx.windowStart.getFullYear(), ctx.windowEnd.getFullYear()])];

    const all: SportomediaMatch[] = [];
    for (const year of years) {
        try {
            all.push(...await fetchSeason(config, year, from, to, ctx.signal));
        } catch (err) {
            ctx.log(`${config.leagueName} ${year}: ${(err as Error).message}`);
        }
    }

    const events: RawEvent[] = [];
    const seen = new Set<string>();
    for (const m of all) {
        const ev = mapSportomediaMatch(m, config);
        if (!ev || seen.has(ev.url)) continue;
        seen.add(ev.url);
        events.push(ev);
    }
    ctx.log(`${config.leagueName}: ${all.length} matcher i svaret → ${events.length} spelbara`);
    return events;
};
