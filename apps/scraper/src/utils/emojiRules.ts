/**
 * Regelstyrd emoji som går FÖRE LLM-auditens och kategorins val, på alla
 * skrivvägar (runner, audit, daemon, backfill): 🎬 för biovisningar
 * (utils/cinema), matcher från ligornas egna sajter (utils/leagueSport: 🏑
 * SSL, 🏒 SHL …) och entydiga aktiviteter (utils/activityEmoji: 🥏 discgolf,
 * 🧭 orientering …). null = ingen regel, låt auditen/kategorin bestämma.
 */
import { looksLikeCinema, CINEMA_EMOJI } from './cinema';
import { activityEmojiFor } from './activityEmoji';
import { LEAGUE_SPORTS, leagueHostSports, leagueSportForUrl, type LeagueSport } from './leagueSport';
import { SOURCES } from '../sources/registry';

let hostSports: Map<string, LeagueSport> | null = null;

export function ruleEmojiFor(
    title: string | null | undefined,
    venueName: string | null | undefined,
    url?: string | null,
): string | null {
    if (looksLikeCinema(title, venueName)) return CINEMA_EMOJI;
    if (!hostSports) hostSports = leagueHostSports(SOURCES);
    const sport = leagueSportForUrl(url, hostSports);
    if (sport) return LEAGUE_SPORTS[sport].emoji;
    return activityEmojiFor(title);
}
