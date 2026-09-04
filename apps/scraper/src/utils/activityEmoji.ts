/**
 * Deterministisk emoji för aktiviteter där LLM-auditen gissar generiskt.
 *
 * Auditen väljer fri emoji per event och träffar oftast rätt (paddling 🛶
 * 93/97, schack ♟️ 90/96, klättring 🧗 74/74 i aggregatet 2026-09-04), men
 * för smalare sporter blev det ⚽/⛳: discgolf ⛳/⚽ 4/4, padel/tennis ⚽ 9/26,
 * orientering spritt. Ägaren 4/9: "KM Piteå discgolf — finns det ingen
 * frisbee-emoji?" Det finns: 🥏. Ordgränser med Unicode så "bad" inte
 * träffar "badminton" och "golf" inte "discgolf".
 *
 * Reglerna är avsiktligt få och entydiga: bara aktiviteter där en enda emoji
 * är självklar. Allt annat lämnas åt auditen. Bio hanteras i utils/cinema.
 */

const RULES: { re: RegExp; emoji: string }[] = [
    { re: /(?<!\p{L})(?:disc ?golf|frisbee(?:golf)?|ultimate)(?!\p{L})/iu, emoji: '🥏' },
    { re: /(?<!\p{L})orientering(?:s\p{L}*)?(?!\p{L})/iu, emoji: '🧭' },
    { re: /(?<!\p{L})(?:padel|tennis|pickleball)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🎾' },
    { re: /(?<!\p{L})(?:bordtennis|pingis)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏓' },
    { re: /(?<!\p{L})badminton(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏸' },
    { re: /(?<!\p{L})(?:simning|simskola|simhopp|simtävling|simträning)(?!\p{L})/iu, emoji: '🏊' },
    { re: /(?<!\p{L})bowling(?:\p{L}*)?(?!\p{L})/iu, emoji: '🎳' },
    { re: /(?<!\p{L})(?:ishockey|hockey)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏒' },
    { re: /(?<!\p{L})(?:basket|basketboll)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏀' },
    { re: /(?<!\p{L})volleyboll(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏐' },
    { re: /(?<!\p{L})handboll(?:\p{L}*)?(?!\p{L})/iu, emoji: '🤾' },
    { re: /(?<!\p{L})curling(?:\p{L}*)?(?!\p{L})/iu, emoji: '🥌' },
    { re: /(?<!\p{L})(?:skridsko|skridskor|konståkning)(?:\p{L}*)?(?!\p{L})/iu, emoji: '⛸️' },
    { re: /(?<!\p{L})(?:längdskid|skidåkning|skidskola|slalom|skidor)(?:\p{L}*)?(?!\p{L})/iu, emoji: '⛷️' },
    { re: /(?<!\p{L})(?:ridning|ridskola|ridläger|hästhoppning|dressyr)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏇' },
    { re: /(?<!\p{L})(?:boxning|thaiboxning|kickboxning)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🥊' },
    { re: /(?<!\p{L})(?:segling|seglarskola)(?:\p{L}*)?(?!\p{L})/iu, emoji: '⛵' },
    { re: /(?<!\p{L})(?:dykning|snorkling)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🤿' },
    { re: /(?<!\p{L})bågskytte(?:\p{L}*)?(?!\p{L})/iu, emoji: '🏹' },
    { re: /(?<!\p{L})(?:dart|darttävling)(?!\p{L})/iu, emoji: '🎯' },
    { re: /(?<!\p{L})(?:biljard|snooker)(?:\p{L}*)?(?!\p{L})/iu, emoji: '🎱' },
    { re: /(?<!\p{L})(?:schack|schackklubb)(?:\p{L}*)?(?!\p{L})/iu, emoji: '♟️' },
];

/** Emoji för en aktivitet som titeln entydigt pekar ut, annars null. */
export function activityEmojiFor(title: string | null | undefined): string | null {
    const t = (title ?? '').trim();
    if (!t) return null;
    for (const r of RULES) if (r.re.test(t)) return r.emoji;
    return null;
}
