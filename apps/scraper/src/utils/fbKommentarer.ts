/**
 * fbKommentarer.ts — ren logik för att exportera kommentarerna på Vad kuls inlägg i
 * Facebookgrupper (skriptet scripts/fb-kommentarer.ts gör själva webbläsardelen).
 *
 * CSV:n som byggs här läses direkt av Vad kul-studions omdömesimport (vadkulyt,
 * sidan Omdömen): kolumnerna kommentar/ort/grupp/datum/id/positiv känns igen där,
 * och bara rader med positiv=ja importeras. Namn skrivs med för din egen skull
 * (t.ex. för att fråga om lov) men importeras aldrig.
 */

export type Positiv = 'ja' | 'kanske' | 'nej';

export interface FbKommentar {
    id: string;              // kommentarens id (comment_id/reply_comment_id), annars tomt
    namn: string;
    text: string;
    svar: boolean;           // svar på en annan kommentar
    relativTid: string;      // som Facebook visar den: "30 min", "2 tim", "3 d" ...
}

export interface KommentarRad extends FbKommentar {
    grupp: string;
    lank: string;            // länk till inlägget
    datum: string;           // YYYY-MM-DD (uppskattat från relativTid), eller tomt
    positiv: Positiv;
    ort: string;
}

// --- länkar till gruppinlägg ----------------------------------------------------

/**
 * Normalisera en länk till ett gruppinlägg så att samma inlägg bara räknas en gång.
 * Ger null för allt som inte är ett gruppinlägg (gruppens flöde, profiler, foton ...).
 */
export function normaliseraInlaggsUrl(href: string): string | null {
    let u: URL;
    try {
        u = new URL(href, 'https://www.facebook.com');
    } catch {
        return null;
    }
    if (!/(^|\.)facebook\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/groups\/([^/]+)\/(?:posts|permalink)\/(\d+)/);
    if (m) return `https://www.facebook.com/groups/${m[1]}/posts/${m[2]}/`;
    const multi = u.searchParams.get('multi_permalinks');
    const g = u.pathname.match(/^\/groups\/([^/]+)\/?$/);
    if (g && multi && /^\d+$/.test(multi)) return `https://www.facebook.com/groups/${g[1]}/posts/${multi}/`;
    return null;
}

// --- ort ur gruppnamnet ---------------------------------------------------------

const ORT_MONSTER = [
    /vad (?:som )?händer (?:det )?i ([^?!.,(|]+)/i,
    /händer i ([^?!.,(|]+)/i,
    /vi som bor i ([^?!.,(|]+)/i,
    /evenemang i ([^?!.,(|]+)/i,
];

/** "Vad händer i Hallsta?" -> "Hallsta". Ger tom sträng om gruppnamnet inte säger orten. */
export function ortFranGrupp(grupp: string): string {
    for (const rx of ORT_MONSTER) {
        const m = grupp.match(rx);
        if (!m) continue;
        const ort = m[1]
            .replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/gu, '')
            .replace(/\s+(med omnejd|och omnejd|kommun|stad|län)\b.*$/i, '')
            .replace(/\s+(och|&)\s+.*$/i, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (ort) return ort;
    }
    return '';
}

// --- positiv eller inte ----------------------------------------------------------

const POSITIVA = [
    'tack', 'grym', 'grymt', 'smart', 'bra idé', 'bra ide', 'bra jobbat', 'bra initiativ', 'bra grej',
    'bra sida', 'kul idé', 'toppen', 'kanon', 'perfekt', 'älskar', 'äntligen', 'wow', 'fantastisk',
    'underbar', 'härlig', 'snyggt', 'genialt', 'klockrent', 'lysande', 'kreativ', 'behövs', 'guld',
    'jättebra', 'superbra', 'så bra', 'bästa', 'najs', 'nice', 'awesome', 'great', 'love', 'amazing',
];
const NEGATIVA = [
    'inte', 'fel', 'saknas', 'saknar', 'borttag', 'reklam', 'spam', 'varför', 'tyvärr', 'dålig',
    'sämre', 'kass', 'skräp', 'irriter', 'stämmer ej', 'funkar ej',
];
const POSITIVA_EMOJI = /[👏❤♥😍🙌👍🥰💯🔥⭐🤩💪😊🙏🤗]/u;

// Ord matchas från ordets början: "tack" träffar "tacksam", men "fel" träffar inte "trafel".
const traffar = (text: string, ord: string[]) =>
    ord.filter((o) => new RegExp(`(^|[^\\p{L}])${o}`, 'iu').test(text)).length;

/**
 * Grov bedömning, gjord för att sortera – inte för att bestämma. "ja" importeras av studion,
 * "kanske" (beröm blandat med invändningar) är värt att titta på för hand, "nej" är resten
 * (frågor, tips om event, kritik).
 */
export function bedomPositiv(text: string): Positiv {
    const t = text.trim();
    if (!t) return 'nej';
    const pos = traffar(t, POSITIVA) + (POSITIVA_EMOJI.test(t) ? 1 : 0);
    const neg = traffar(t, NEGATIVA);
    if (pos === 0) return 'nej';
    return neg === 0 ? 'ja' : 'kanske';
}

// --- datum -------------------------------------------------------------------------

const ENHETER: [RegExp, number][] = [
    [/^(\d+)\s*(s|sek|sekunder?)$/i, 0],
    [/^(\d+)\s*(m|min|minuter?)$/i, 0],
    [/^(\d+)\s*(h|t|tim|timmar?|timme)$/i, 0],
    [/^(\d+)\s*(d|dag|dagar)$/i, 1],
    [/^(\d+)\s*(v|w|vecka|veckor)$/i, 7],
    [/^(\d+)\s*(år|y)$/i, 365],
];

/** "3 d" -> datumet för tre dagar sedan (YYYY-MM-DD). Ger tom sträng om formatet är okänt. */
export function datumFranRelativ(rel: string, nu: Date = new Date()): string {
    const s = rel.trim().replace(/\.$/, '');
    for (const [rx, dagar] of ENHETER) {
        const m = s.match(rx);
        if (!m) continue;
        const d = new Date(nu);
        d.setDate(d.getDate() - Number(m[1]) * dagar);
        return d.toISOString().slice(0, 10);
    }
    return '';
}

// --- CSV ------------------------------------------------------------------------------

export const CSV_KOLUMNER = ['kommentar', 'ort', 'grupp', 'länk', 'datum', 'id', 'namn', 'svar', 'positiv'] as const;

const cell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Semikolon och BOM, så att Excel/Numbers på svenska öppnar filen med rätt kolumner och å/ä/ö. */
export function tillCsv(rader: KommentarRad[]): string {
    const rad = (r: KommentarRad) => [
        r.text, r.ort, r.grupp, r.lank, r.datum, r.id, r.namn, r.svar ? 'ja' : 'nej', r.positiv,
    ].map((v) => cell(String(v ?? ''))).join(';');
    return '﻿' + [CSV_KOLUMNER.join(';'), ...rader.map(rad)].join('\r\n') + '\r\n';
}

/** Bygg exportraderna för ett inlägg. Sidans egna svar (t.ex. "Vadkul") tas inte med. */
export function byggRader(
    kommentarer: FbKommentar[], grupp: string, lank: string, egenSida: string, nu: Date = new Date(),
): KommentarRad[] {
    const egen = egenSida.trim().toLowerCase();
    const sedda = new Set<string>();
    const ort = ortFranGrupp(grupp);
    const ut: KommentarRad[] = [];
    for (const k of kommentarer) {
        const text = k.text.trim();
        if (!text || k.namn.trim().toLowerCase() === egen) continue;
        const nyckel = k.id || `${k.namn}|${text}`;
        if (sedda.has(nyckel)) continue;
        sedda.add(nyckel);
        ut.push({
            ...k, text, grupp, lank, ort,
            datum: datumFranRelativ(k.relativTid, nu),
            positiv: bedomPositiv(text),
        });
    }
    return ut;
}
