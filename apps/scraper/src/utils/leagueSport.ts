/**
 * Ligakällornas sport — deterministisk emoji för matcher från ligornas egna
 * sajter (sportality, sportomedia, swehockey).
 *
 * Matchtitlarna bär bara lagnamn ("Växjö Vipers – Team Thorengruppen"), så
 * titelreglerna i utils/activityEmoji träffar aldrig och LLM-auditen vet inte
 * vilken sport det är. Aggregatet 2026-09-15: SSL-innebandyn ⚽ 12 · 🥅 3 ·
 * 🥒 1, stats.swehockey.se 🥏 69, SBL Dam ⚽. Källan VET sporten — den står
 * som `sport` i registryts config — och matchens url (primärnyckeln, finns på
 * alla skrivvägar) pekar ut källan via värdnamnet.
 */

export const LEAGUE_SPORTS = {
    ishockey: { emoji: '🏒', match: 'Ishockeymatch' },
    // Det finns ingen innebandy-emoji; klubba + boll är praxis.
    innebandy: { emoji: '🏑', match: 'Innebandymatch' },
    basket: { emoji: '🏀', match: 'Basketmatch' },
    fotboll: { emoji: '⚽', match: 'Fotbollsmatch' },
} as const;

export type LeagueSport = keyof typeof LEAGUE_SPORTS;

export function isLeagueSport(value: unknown): value is LeagueSport {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEAGUE_SPORTS, value);
}

/** Ligamotorerna och var matchernas url:er bor. */
const LEAGUE_ENGINE_SITE: Record<string, (config: Record<string, any>) => string | undefined> = {
    sportality: (c) => c.baseUrl,
    sportomedia: (c) => c.siteBase,
    swehockey: () => 'https://stats.swehockey.se',
};

type SourceLike = { engine: string; config: Record<string, any> };

function hostOf(url: string | null | undefined): string | null {
    try {
        return new URL(url ?? '').hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return null;
    }
}

/** Värdnamnet där en ligakällas matcher bor, null för andra motorer. */
export function leagueSiteHost(source: SourceLike): string | null {
    if (!Object.prototype.hasOwnProperty.call(LEAGUE_ENGINE_SITE, source.engine)) return null;
    return hostOf(LEAGUE_ENGINE_SITE[source.engine](source.config ?? {}));
}

/** Värdnamn → sport. Ligakällor utan giltig sport hoppas över (registry.test larmar). */
export function leagueHostSports(sources: readonly SourceLike[]): Map<string, LeagueSport> {
    const out = new Map<string, LeagueSport>();
    for (const s of sources) {
        const host = leagueSiteHost(s);
        if (host && isLeagueSport(s.config?.sport)) out.set(host, s.config.sport);
    }
    return out;
}

/** Sporten för en match-url på en ligas egen sajt, annars null. */
export function leagueSportForUrl(url: string | null | undefined, hostSports: Map<string, LeagueSport>): LeagueSport | null {
    const host = hostOf(url);
    return (host && hostSports.get(host)) || null;
}
