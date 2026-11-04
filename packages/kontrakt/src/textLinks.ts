/**
 * KLICKBARA LÄNKAR I FRI TEXT - eventbeskrivningarna (Josef 4/11 2026, andra
 * betalande kunden: "gör så att länkarna blir klickbara ... Den har ju 2
 * Spotify-länkar bland annat"). Bor i kontraktet så webben (kartans
 * LinkEventCard, stadssidornas EventExpanded) och appen (EventKort) delar
 * texten på EXAKT samma ställen - en länk som är klickbar på webben ska vara
 * det i appen också.
 *
 * Reglerna:
 *  - http(s)://… och www.… räknas som länkar; www-länkar får https:// som
 *    adress. Värdnamnet måste ha en punkt ("www" ensamt är text).
 *  - Skiljetecken som hör till meningen, inte länken, lämnas kvar i texten:
 *    "se www.spotify.com." / "(https://x.se)" / "länk: https://x.se!" - en
 *    avslutande parentes följer bara med när länken själv öppnade en
 *    (sv.wikipedia.org/wiki/Foo_(bar)).
 *  - Ingen tolkning av mejladresser eller nakna domäner ("spotify.com") -
 *    de senare ger för många falska träffar ("t.ex.", "kl.19").
 *
 * Ren logik, inget DOM: webben renderar <a>, appen <Text onPress>.
 */

export interface TextSegment {
    text: string;
    /** Satt = segmentet är en länk och det här är adressen att öppna. */
    href?: string;
}

const URL_START = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** Tecken som i slutet av en länk nästan alltid hör till meningen. */
const TRAILING = new Set(['.', ',', ';', ':', '!', '?', "'", '"', '»', '”', '’', ']', '}']);

function trimTrailing(raw: string): string {
    let s = raw;
    for (;;) {
        const c = s[s.length - 1];
        if (!c) break;
        if (TRAILING.has(c)) { s = s.slice(0, -1); continue; }
        if (c === ')') {
            const opens = s.split('(').length - 1;
            const closes = s.split(')').length - 1;
            if (closes > opens) { s = s.slice(0, -1); continue; }
        }
        break;
    }
    return s;
}

/** Värden efter protokollet/www. måste ha en punkt och något efter den. */
function looksLikeUrl(s: string): boolean {
    const host = s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];
    return /^[^.]+\.[^.]+/.test(host);
}

/**
 * Dela texten i textbitar och länkar, i ordning. Tom text → tom lista.
 * Bitarna sammanfogade är alltid exakt originaltexten.
 */
export function splitTextLinks(text: string): TextSegment[] {
    if (!text) return [];
    const out: TextSegment[] = [];
    const re = new RegExp(URL_START.source, 'gi');
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const start = m.index;
        // Ett ord mitt i annan text ("foowww.x.se") är ingen länk.
        if (start > 0 && /[\p{L}\p{N}]/u.test(text[start - 1])) continue;
        const link = trimTrailing(m[0]);
        if (!link || !looksLikeUrl(link)) continue;
        if (start > last) out.push({ text: text.slice(last, start) });
        out.push({ text: link, href: /^https?:\/\//i.test(link) ? link : `https://${link}` });
        last = start + link.length;
        re.lastIndex = last;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
}

/** Finns det någon länk alls i texten? */
export function hasTextLinks(text: string): boolean {
    return splitTextLinks(text).some(s => !!s.href);
}
