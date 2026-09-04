/**
 * Regelstyrd emoji som går FÖRE LLM-auditens och kategorins val, på alla
 * skrivvägar (runner, audit, daemon, backfill): 🎬 för biovisningar
 * (utils/cinema) och entydiga aktiviteter (utils/activityEmoji: 🥏 discgolf,
 * 🧭 orientering …). null = ingen regel, låt auditen/kategorin bestämma.
 */
import { looksLikeCinema, CINEMA_EMOJI } from './cinema';
import { activityEmojiFor } from './activityEmoji';

export function ruleEmojiFor(title: string | null | undefined, venueName: string | null | undefined): string | null {
    if (looksLikeCinema(title, venueName)) return CINEMA_EMOJI;
    return activityEmojiFor(title);
}
