/**
 * listingBlocks.ts — event ur EN listsida som saknar detaljsidor. Ren modul
 * (ingen I/O); motorn bor i sources/engines/listing.ts.
 *
 * Bakgrund (jämförelsen mot Happymap 14/11 2026): krogar, biografer och små
 * scener lägger hela programmet på en sida — rubrik, datumrad, lite text —
 * utan kalenderplugin, sitemap eller JSON-LD. Snöbollens prob kunde bara läsa
 * strukturerad data, så Palladium och Chapter House i Växjö föll som FAIL
 * trots att programmet stod där i klartext.
 *
 * Läsaren är byggd för att hellre ge NOLL event än fel event:
 *
 *   1. DATUMRADEN är ankaret: en rad som BARA är ett datum ("Lördag 21
 *      november kl 19:00", "29 november - 13 december"). En mening som råkar
 *      nämna ett datum räknas inte.
 *   2. TITELN är rubriken i samma kort. Kortet = minsta behållaren i DOM:en
 *      som rymmer både datumraden och en rubrik. Finns en enda rubrik där är
 *      den titeln, oavsett ordning. Ligger alla event platt i samma behållare
 *      avgör sidans ordning (rubrik först eller datum först) vilken som hör
 *      till vilken — annars hamnar varje datum på grannens titel.
 *   3. RUBRIKBÄRAREN väljs per sida: riktiga rubriker (h2–h6), rader helt i
 *      fetstil, eller rader som är en enda länk. Den sort som ger flest OLIKA
 *      titlar vinner; en sidrubrik som delas av alla datum ("Vill du delta i
 *      något av våra event?") förlorar mot korten under den.
 *   4. LISTRADER ("Fre 21/11 Quiz med Kalle", tabellrader) räknas bara när
 *      minst tre syskon har samma form — en ensam rad som börjar med ett
 *      datum är oftare en öppettid än ett event.
 *
 * Det som blir kvar att göra för motorn och runnern är det vanliga: fönster,
 * dedupe, geokodning.
 */

import * as cheerio from 'cheerio';
import { decodeHtmlEntities, cleanDescription } from './text';
import { parseSwedishDateWeekdayChecked } from './swedishDate';
import { priceFromLabelledLines, priceFromBareLines } from './priceFromMarkup';

// ─── Rader ───────────────────────────────────────────────────────────────────

export interface ListingLine {
    idx: number;
    text: string;
    /** 1–6 för h1–h6, annars 0. */
    heading: number;
    /** All text på raden står i <strong>/<b> — en pseudorubrik. */
    bold: boolean;
    /** Hela raden är EN länk (titellänk). */
    link?: string;
    /** Blockelementens id:n från roten och inåt — gemensamt prefix = gemensam behållare. */
    path: number[];
}

interface ListingImage { src: string; at: number; path: number[] }

const BLOCK_TAGS = new Set([
    'address', 'article', 'aside', 'blockquote', 'body', 'center', 'dd', 'details', 'div', 'dl', 'dt',
    'fieldset', 'figcaption', 'figure', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'html',
    'li', 'main', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'tfoot', 'thead', 'tr', 'ul',
]);

/** Skiljer tabellceller på en rad — ett tecken som aldrig står i löptext. */
const CELL_SEP = '␟';

/**
 * Klassnamn som är sidkrom. Hela token måste stämma: "has-sidebar" på sidans
 * yttersta div får inte ta bort hela sidan.
 */
const CHROME_TOKEN_RE = /^(?:sidebar|widget-area|breadcrumbs?|site-footer|footer|site-header|masthead|navbar|nav-menu|main-menu|cookie[\w-]*|[\w-]*consent[\w-]*)$/i;

/**
 * Inläggets PUBLICERINGSDATUM (WordPress: <time class="entry-date published">,
 * .posted-on, .entry-meta). Det är inget eventdatum: ett nyhetsarkiv där varje
 * inlägg har rubrik + datumrad ser annars ut precis som ett program, och
 * dagens inlägg blir "event i dag".
 */
const PUBLISH_TOKEN_RE = /^(?:entry-date|post-date|posted-on|entry-meta|post-meta|byline|date-published|meta-date|post-info)$/i;
/** hAtom-klasserna sitter ibland på hela inlägget — räknas bara på små element. */
const PUBLISH_SMALL_TOKEN_RE = /^(?:published|updated)$/i;
const SMALL_TAGS = new Set(['time', 'span', 'abbr', 'small']);

const collapse = (s: string): string => s.replace(/[\s ]+/g, ' ').trim();

interface DomNode {
    type: string; name?: string; data?: string;
    attribs?: Record<string, string>; children?: DomNode[];
}

function absoluteUrl(href: string | undefined, base: string): string | undefined {
    if (!href) return undefined;
    const h = href.trim();
    if (!h || /^(?:#|javascript:|mailto:|tel:|data:)/i.test(h)) return undefined;
    try { return new URL(h, base).toString(); } catch { return undefined; }
}

/**
 * Sidan som rader i dokumentordning, med varje rads plats i DOM:en. Skript,
 * navigering, sidfot, formulärkontroller och sidhuvud är borta. Ett <header>
 * INNE i ett kort (WordPress: <article><header><h2>) står kvar — bara sidans
 * eget huvud tas bort.
 */
export function listingLines(html: string, pageUrl: string): { lines: ListingLine[]; images: ListingImage[] } {
    const $ = cheerio.load(html);
    $('script, style, noscript, template, svg, nav, footer, select, option, button, input, textarea, iframe').remove();
    $('header').each((_i, el) => {
        const $el = $(el);
        const marks = `${$el.attr('class') ?? ''} ${$el.attr('id') ?? ''} ${$el.attr('role') ?? ''}`;
        if ($el.parent().is('body') || $el.find('nav').length > 0 || /banner|site-header|masthead|main-header|navbar|page-header/i.test(marks)) $el.remove();
    });
    $('[class], [id]').each((_i, el) => {
        const attribs = (el as unknown as DomNode).attribs ?? {};
        const tokens = `${attribs.class ?? ''} ${attribs.id ?? ''}`.split(/\s+/).filter(Boolean);
        const small = SMALL_TAGS.has(((el as unknown as DomNode).name ?? '').toLowerCase());
        if (tokens.some((t) => CHROME_TOKEN_RE.test(t) || PUBLISH_TOKEN_RE.test(t) || (small && PUBLISH_SMALL_TOKEN_RE.test(t)))) $(el).remove();
    });
    $('time[pubdate], [itemprop="datePublished"], [itemprop="dateModified"]').remove();

    const lines: ListingLine[] = [];
    const images: ListingImage[] = [];
    let nextId = 1;
    let buf = { parts: [] as string[], chars: 0, boldChars: 0, linkChars: 0, links: [] as string[], heading: 0, path: null as number[] | null };
    const flush = () => {
        const text = collapse(decodeHtmlEntities(buf.parts.join('')));
        if (text && buf.path) {
            lines.push({
                idx: lines.length, text,
                heading: buf.heading,
                bold: buf.chars > 0 && buf.boldChars === buf.chars,
                link: buf.links.length === 1 && buf.linkChars === buf.chars ? buf.links[0] : undefined,
                path: buf.path,
            });
        }
        buf = { parts: [], chars: 0, boldChars: 0, linkChars: 0, links: [], heading: 0, path: null };
    };

    const walk = (node: DomNode, path: number[], st: { bold: boolean; heading: number; href?: string }) => {
        if (node.type === 'text') {
            const data = node.data ?? '';
            const n = data.replace(/[\s ]/g, '').length;
            if (n === 0) { buf.parts.push(' '); return; }
            if (!buf.path) { buf.path = path; buf.heading = st.heading; }
            buf.parts.push(data);
            buf.chars += n;
            if (st.bold) buf.boldChars += n;
            if (st.href) { buf.linkChars += n; if (!buf.links.includes(st.href)) buf.links.push(st.href); }
            return;
        }
        if (node.type !== 'tag') return;
        const name = (node.name ?? '').toLowerCase();
        if (name === 'br') { flush(); return; }
        if (name === 'img') {
            const a = node.attribs ?? {};
            const src = absoluteUrl(a['data-src'] ?? a['data-lazy-src'] ?? a.src, pageUrl);
            if (src && !/logo|icon|sprite|placeholder|avatar|spacer/i.test(src)) images.push({ src, at: lines.length, path });
            return;
        }
        const isBlock = BLOCK_TAGS.has(name);
        const myPath = isBlock ? [...path, nextId++] : path;
        if (isBlock) flush();
        // Två länkar i rad ("Jazzkväll" + "Läs mer") är två rader, inte en titel.
        if (name === 'a' && buf.chars > 0 && buf.linkChars === buf.chars) flush();
        if ((name === 'td' || name === 'th') && buf.chars > 0) buf.parts.push(` ${CELL_SEP} `);
        const heading = /^h[1-6]$/.test(name) ? Number(name[1]) : st.heading;
        const href = name === 'a' ? (absoluteUrl(node.attribs?.href, pageUrl) ?? st.href) : st.href;
        const child = { bold: st.bold || name === 'strong' || name === 'b', heading, href };
        // Inline-element skiljs åt med mellanslag: <span>11 november</span><span>Sonic
        // Stories</span> står intill varandra i källan men inte på skärmen.
        if (!isBlock) buf.parts.push(' ');
        for (const c of node.children ?? []) walk(c, myPath, child);
        if (isBlock) flush(); else buf.parts.push(' ');
    };
    const body = $('body').get(0) as unknown as DomNode | undefined;
    if (body) walk(body, [], { bold: false, heading: 0 });
    flush();
    return { lines, images };
}

// ─── Datumrader ──────────────────────────────────────────────────────────────

const MONTH_NAMES = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
const MONTH_SRC = 'januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|okt|nov|dec';
const WEEKDAY_SRC = '(?:mån|tis|ons|tors|fre|lör|sön)dag(?:en|ar)?|mån|tis|ons|tors|tor|fre|lör|sön';
/** Tecken som inte får stå intill ett ord — \b fungerar inte för å/ä/ö. */
const L = 'a-zåäöé';

const DATE_RE = new RegExp(
    `(?<![${L}\\d:.,/-])(?:(${WEEKDAY_SRC})\\.?,?\\s+)?(?:den\\s+)?(\\d{1,2})(?::?e|:a|\\.)?\\s*(${MONTH_SRC})\\.?(?![${L}])(?:,?\\s+(20\\d{2}))?`,
    'giu',
);
const ISO_RE = /(?<![\d-])(20\d{2})-(\d{2})-(\d{2})(?![\d-])/g;
/** "21/11", "21/11-26", "21/11 2026". Aldrig "24/7" (dygnet runt) eller bråk mitt i ett tal. */
const NUMERIC_RE = new RegExp(
    `(?<![${L}\\d/.,:-])(?:(${WEEKDAY_SRC})\\.?,?\\s+)?(?:den\\s+)?(\\d{1,2})\\/(\\d{1,2})(?:(?:\\s+|-|\\/)(20\\d{2})|-(\\d{2})(?![\\d:.]))?(?![\\d/])`,
    'giu',
);
/** "6-7 november", "26–27 okt" → båda dagarna får månaden utskriven. */
const SAME_MONTH_RANGE_RE = new RegExp(`(?<![${L}\\d:.,/])(\\d{1,2})(?::?e)?\\s*[-–—]\\s*(\\d{1,2})(?::?e)?\\s+(${MONTH_SRC})\\.?(?![${L}])`, 'giu');

const TIME_SRC = `(?:kl(?:ockan)?\\.?\\s*)?(?<![\\d:.])(\\d{1,2})[:.](\\d{2})(?![\\d:.])`;
const HOUR_SRC = `kl(?:ockan)?\\.?\\s*(\\d{1,2})(?![\\d:.])`;
const TIME_RE = new RegExp(`${TIME_SRC}|${HOUR_SRC}`, 'iu');
/** Allt som är klockslag på en rad, även spann ("14-16", "17.00–19.00") — plockas bort före resträkningen. */
const TIME_STRIP_RE = new RegExp(
    `(?:kl(?:ockan)?\\.?\\s*)?(?<![\\d:.])\\d{1,2}[:.]\\d{2}(?![\\d:.])(?:\\s*[-–—]\\s*\\d{1,2}(?:[:.]\\d{2})?)?`
    + `|kl(?:ockan)?\\.?\\s*\\d{1,2}(?:\\s*[-–—]\\s*\\d{1,2})?(?![\\d:.])`,
    'giu',
);
/** Klockslaget som står direkt efter datumet på en listrad: ", kl 19:00 – " före titeln. */
const LEADING_TIME_RE = new RegExp(
    `^[\\s,;:|–—-]*(?:(?:kl(?:ockan)?\\.?\\s*)?\\d{1,2}[:.]\\d{2}(?:\\s*[-–—]\\s*\\d{1,2}(?:[:.]\\d{2})?)?|kl(?:ockan)?\\.?\\s*\\d{1,2}(?:\\s*[-–—]\\s*\\d{1,2})?(?![\\d:.]))?`,
    'iu',
);
/** …eller sist på raden: "Quiz med Kalle kl 19". */
const TRAILING_TIME_RE = new RegExp(
    `[\\s,;:|–—-]*(?:(?:kl(?:ockan)?\\.?\\s*)?\\d{1,2}[:.]\\d{2}(?:\\s*[-–—]\\s*\\d{1,2}(?:[:.]\\d{2})?)?|kl(?:ockan)?\\.?\\s*\\d{1,2}(?:\\s*[-–—]\\s*\\d{1,2})?)\\s*$`,
    'iu',
);
const WEEKDAY_STRIP_RE = new RegExp(`(?<![${L}])(?:${WEEKDAY_SRC})(?![${L}])\\.?`, 'giu');
/** Småord som hör till datum och tid, inte till en titel. */
const FILLER_RE = new RegExp(`(?<![${L}])(?:den|till|t\\.?o\\.?m|från|fr\\.?o\\.?m|och|datum|tid|när|start(?:ar|tid)?|börjar|insläpp|dörrarna|dörrar|öppnar|ca|c:a|uhr)(?![${L}])\\.?`, 'giu');

const letters = (s: string): number => (s.match(/\p{L}/gu) ?? []).length;
/** Datumbrickans månad på egen rad: "nov.", "December". */
const MONTH_ONLY_RE = new RegExp(`^(?:${MONTH_SRC})\\.?$`, 'i');

/**
 * Statusord som står PÅ datumraden i en spelplan ("27 nov Fullbokat", "17 dec
 * Nytt datum", "5 dec Få platser kvar"). Raden är fortfarande bara ett datum:
 * titeln är rubriken ovanför, inte statusen.
 */
const STATUS_WORDS_RE = new RegExp(`(?<![${L}])(?:fullbokat|slutsålt|utsålt|inställt|flyttat|nytt datum|extra(?:insatt)?(?: föreställning| datum| kväll)?|få (?:platser|biljetter)(?: kvar)?|platser kvar|biljetter(?: kvar)?|boka(?: här| nu)?|köp(?: biljett(?:er)?)?|sold out|premiär)(?![${L}])[!.]?`, 'giu');

function monthIndex(raw: string): number {
    const m = raw.toLowerCase().slice(0, 3);
    return ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'].indexOf(m);
}

/** Veckodagen i den form swedishDate känner igen ("lördagen" → "lördag"). */
const weekdayBase = (raw: string | undefined): string => (raw ?? '').toLowerCase().replace(/(?<=dag)(?:en|ar)$/, '');

export interface DateLine {
    start: Date;
    end?: Date;
    hasTime: boolean;
    /** Radens text utan datum, klockslag, veckodagar och småord — tom för en ren datumrad. */
    rest: string;
    /** Texten efter datumet och dess klockslag, orörd i övrigt — listradens titel. */
    tail: string;
    /** Datumet står först på raden (bara veckodag och småord före). */
    atStart: boolean;
    /** Raden säger uttryckligen "till <datum>" — ett slutdatum, inte ett eget tillfälle. */
    endMarker: boolean;
}

/** Ett datum utan år och veckodag som hamnar så här långt fram är oftare ett passerat datum på en kvarglömd sida. */
const STALE_GUESS_DAYS = 270;

/**
 * Dag + månad (+ år, + veckodag) → datum. Året gissas framåt när det saknas,
 * och veckodagen är facit på gissningen (swedishDate). null när veckodagen
 * inte går ihop med något närliggande år, när ett datum UTAN både år och
 * veckodag skulle hamna mer än nio månader fram ("12 september" på en
 * höstprogramsida som står kvar i november är inte nästa års event), eller
 * när veckodagen bara går ihop med ett år mer än tolv månader bort.
 */
function resolveDate(day: number, month: number, year: string | undefined, weekday: string | undefined, now: Date): Date | null {
    const wd = weekdayBase(weekday);
    const d = parseSwedishDateWeekdayChecked(`${wd} ${day} ${MONTH_NAMES[month]}${year ? ` ${year}` : ''}`.trim(), now);
    if (!d) return null;
    const ahead = (d.getTime() - now.getTime()) / 86_400_000;
    if (!year && !wd && ahead > STALE_GUESS_DAYS) return null;
    // Veckodagen stämde först med ett år längre bort ("söndag 26 dec" i en
    // text från 2021 stämmer med 2027): en kvarglömd rad, inte ett event om 13 månader.
    if (!year && ahead > 366) return null;
    return d;
}

/**
 * Tolka en rad som börjar med eller består av ett datum. null när raden inte
 * bär något datum, eller när datumet inte går att lita på (se resolveDate).
 */
export function parseDateLine(text: string, now: Date = new Date()): DateLine | null {
    if (text.length > 220) return null;
    const expanded = text.replace(SAME_MONTH_RANGE_RE, (_m, d1: string, d2: string, mon: string) => `${d1} ${mon} – ${d2} ${mon}`);

    interface Hit { index: number; length: number; date: Date | null }
    const hits: Hit[] = [];
    for (const m of expanded.matchAll(DATE_RE)) {
        const month = monthIndex(m[3]);
        if (month < 0) continue;
        hits.push({ index: m.index ?? 0, length: m[0].length, date: resolveDate(Number(m[2]), month, m[4], m[1], now) });
    }
    for (const m of expanded.matchAll(ISO_RE)) {
        const month = Number(m[2]) - 1;
        if (month < 0 || month > 11) continue;
        hits.push({ index: m.index ?? 0, length: m[0].length, date: resolveDate(Number(m[3]), month, m[1], undefined, now) });
    }
    for (const m of expanded.matchAll(NUMERIC_RE)) {
        const day = Number(m[2]); const month = Number(m[3]);
        if (month < 1 || month > 12 || day < 1 || day > 31) continue;
        const bare = !m[1] && !m[4] && !m[5];
        if (bare && day === 24 && month === 7) continue;          // "öppet 24/7"
        if (bare && day <= 2 && month <= 4) continue;             // "1/2 kyckling", "2/4 personer"
        if (hits.some((h) => (m.index ?? 0) >= h.index && (m.index ?? 0) < h.index + h.length)) continue;
        hits.push({ index: m.index ?? 0, length: m[0].length, date: resolveDate(day, month - 1, m[4] ?? (m[5] ? `20${m[5]}` : undefined), m[1], now) });
    }
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.index - b.index);
    const first = hits[0];
    if (!first.date) return null;

    // Klockslaget: första efter datumet. "kl 19", "19.00", "Klockan 14-16".
    const start = new Date(first.date);
    let hasTime = false;
    const after = expanded.slice(first.index + first.length);
    const t = after.match(TIME_RE);
    if (t) {
        const h = Number(t[1] ?? t[3]); const min = Number(t[2] ?? 0);
        if (h <= 23 && min <= 59) { start.setHours(h, min, 0, 0); hasTime = true; }
    }

    // Spann: ett andra datum direkt efter det första — med streck, "till" eller
    // bara klockslaget emellan ("lör 14 nov. 21:00 sön 15 nov. 00:00").
    let end: Date | undefined;
    const second = hits[1];
    if (second?.date) {
        const between = expanded.slice(first.index + first.length, second.index);
        if (/^\s*(?:[-–—]|till|t\.?o\.?m\.?)?\s*$/i.test(between.replace(TIME_STRIP_RE, ' ').replace(FILLER_RE, (w) => (/till|t\.?o\.?m/i.test(w) ? w : ' ')))) {
            const e = new Date(second.date);
            if (e < start) e.setFullYear(e.getFullYear() + 1);
            if (e.getTime() - start.getTime() <= 400 * 86_400_000) end = e;
        }
    }

    let rest = expanded;
    for (const h of [...hits].sort((a, b) => b.index - a.index)) rest = `${rest.slice(0, h.index)} ${rest.slice(h.index + h.length)}`;
    rest = rest.replace(TIME_STRIP_RE, ' ').replace(WEEKDAY_STRIP_RE, ' ').replace(FILLER_RE, ' ');
    const before = expanded.slice(0, first.index).replace(WEEKDAY_STRIP_RE, ' ').replace(FILLER_RE, ' ');
    const lastHit = end && second ? second : first;
    const tail = expanded.slice(lastHit.index + lastHit.length).replace(LEADING_TIME_RE, '');
    // "till 15 nov.", "– 15 nov.": raden är ett slutdatum (datumträffen börjar vid veckodagen).
    const endMarker = /(?:^|\s)(?:till|t\.?o\.?m\.?|[-–—])\s*$/i.test(expanded.slice(0, first.index));
    return { start, end, hasTime, rest: collapse(rest), tail: collapse(tail), atStart: letters(before) === 0, endMarker };
}

/** En rad som bara är ett klockslag: "Klockan 14-16", "Kl. 19", "19:00", "Start 19.00". */
function timeOnly(text: string): { h: number; min: number } | null {
    if (text.length > 40) return null;
    const m = text.match(TIME_RE);
    if (!m) return null;
    if (letters(text.replace(TIME_STRIP_RE, ' ').replace(FILLER_RE, ' ')) > 0) return null;
    const h = Number(m[1] ?? m[3]); const min = Number(m[2] ?? 0);
    return h <= 23 && min <= 59 ? { h, min } : null;
}

// ─── Titlar ──────────────────────────────────────────────────────────────────

/** Knappar och statusrader — aldrig en titel. */
const CTA_RE = /^[*\s]*(?:läs (?:mer|vidare)|mer info(?:rmation)?|info|boka(?: bord| nu| här| plats| biljett(?:er)?)?|köp(?: biljett(?:er)?)?(?: här| nu)?|biljett(?:er|info)?(?: här)?|anmäl(?:an| dig)?(?: här)?|visas(?: på [^,.]{1,30})?(?: fr\.?o\.?m\.?)?|visas nu|premiär|till (?:pub(?:en)?|facebook\S*|evenemanget|eventet|biljetter(?:na)?|kalendern|programmet|bokning(?:en)?)|visa (?:mer|alla)|se (?:mer|alla)|read more|tickets?|buy tickets?|book(?: now)?|facebook|instagram|dela|share|slutsålt|fullbokat|inställt|eventet är (?:fullbokat|slutsålt|inställt)|få platser kvar|sold out|nyhet|new)[\s!.*]*$/iu;

/** Sidans egna avdelningsrubriker — "Kommande evenemang" är inget event. */
const GENERIC_RE = /^(?:(?:våra|alla|kommande|aktuella|tidigare|fler|mer)\s+)?(?:evenemang|event|events|program(?:met)?|kalender|kalendarium|på gång|aktuellt|nyheter|biljetter|öppettider|calendar of events|upcoming events|event calendar|kontakt(?:a oss)?|hitta hit|meny|om oss|välkommen|nyhetsbrev|följ oss|information|boka bord|lunch|priser|pris|detaljer|beskrivning|om evenemanget|tid och plats|datum|plats|tid|när|var|arrangör|dela)\s*[:!]?$/iu;

const OPENING_RE = /(?<![a-zåäö])(?:öppet|stängt|öppettider|closed|open|helgstängt|semesterstängt)(?![a-zåäö])/iu;

const BARE_PRICE_RE = /^(?:(?:från|fr\.?|pris:?)\s+)?\d[\d ]*\s*(?:kr|:-|sek|kronor)\b.{0,20}$/i;

function titleOk(text: string): boolean {
    if (text.length < 3 || text.length > 110 || letters(text) < 3) return false;
    if (CTA_RE.test(text) || GENERIC_RE.test(text)) return false;
    if (/[▼▾▸►⌄]/.test(text) || letters(text.replace(STATUS_WORDS_RE, ' ')) < 3) return false;   // menyrad eller bara status
    if (/[@:]$|@\S+\.\w{2,}/.test(text)) return false;                  // etikett eller e-postadress
    if (/^[-•·*–]\s*\S/.test(text) && !/^\*.*\*$/.test(text)) return false;   // listpunkt
    if (BARE_PRICE_RE.test(text) || timeOnly(text)) return false;
    return true;
}

const cleanTitle = (s: string): string => collapse(s.replace(new RegExp(CELL_SEP, 'g'), ' ').replace(/^[\s"“”*:–—|·,;/-]+|[\s"“”*:–—|·,;/-]+$/g, ''));

type CarrierClass = 'heading' | 'bold' | 'link';

const lcp = (a: number[], b: number[]): number => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const within = (line: { path: number[] }, prefix: number[]): boolean => lcp(line.path, prefix) === prefix.length;

/** Så många rader får ligga mellan rubriken och dess datumrad. */
const MAX_GAP = 30;
/** Så många rader läses som ett events text. */
const MAX_BLOCK = 40;
/** En listrad räknas först när så många syskon har samma form. */
const MIN_ROWS = 3;

interface Assigned { title: string; titleIdx: number; dateIdx: number; date: DateLine; link?: string }

function assign(lines: ListingLine[], dates: Map<number, DateLine>, dateish: Set<number>, cls: CarrierClass): { events: Assigned[]; carriers: ListingLine[] } {
    const h1Count = lines.filter((l) => l.heading === 1).length;
    const isCarrier = (l: ListingLine): boolean => {
        if (dateish.has(l.idx) || !titleOk(l.text)) return false;
        if (cls === 'heading') return l.heading >= 2 || (l.heading === 1 && h1Count >= 2);
        if (l.heading > 0) return false;
        return cls === 'bold' ? l.bold : !l.bold && !!l.link;
    };
    const carriers = lines.filter(isCarrier);
    if (carriers.length === 0) return { events: [], carriers };
    const dateIdxs = [...dates.keys()].sort((a, b) => a - b);
    const out: Assigned[] = [];
    for (const di of dateIdxs) {
        const d = lines[di];
        const near = carriers.filter((c) => Math.abs(c.idx - di) <= MAX_GAP);
        if (near.length === 0) continue;
        const depth = Math.max(...near.map((c) => lcp(c.path, d.path)));
        const cands = near.filter((c) => lcp(c.path, d.path) === depth);
        let chosen: ListingLine | undefined;
        if (cands.length === 1) {
            chosen = cands[0];
        } else {
            // Platt behållare: vad kommer först i den, rubrik eller datum?
            const prefix = d.path.slice(0, depth);
            const firstCarrier = carriers.find((c) => within(c, prefix));
            const firstDate = dateIdxs.find((i) => within(lines[i], prefix));
            const titleFirst = (firstCarrier?.idx ?? Infinity) < (firstDate ?? Infinity);
            if (titleFirst) {
                chosen = [...cands].reverse().find((c) => c.idx < di);
            } else {
                const nextDate = dateIdxs.find((i) => i > di) ?? Infinity;
                chosen = cands.find((c) => c.idx > di && c.idx < nextDate);
            }
        }
        if (!chosen) continue;
        let title = chosen.text;
        let titleIdx = chosen.idx;
        // Titeln är bruten på två rader ("Julinspirerad Ölprovning" / "inkl.
        // 4-rätters middag"): en rubrik börjar inte med liten bokstav.
        const prev = carriers.find((c) => c.idx === chosen!.idx - 1);
        if (/^\p{Ll}/u.test(title) && prev && lcp(prev.path, chosen.path) >= chosen.path.length - 1) {
            title = `${prev.text} ${title}`;
            titleIdx = prev.idx;
        }
        title = cleanTitle(title);
        if (!titleOk(title)) continue;
        out.push({ title, titleIdx, dateIdx: di, date: dates.get(di)!, link: chosen.link });
    }
    return { events: out, carriers };
}

/**
 * Två datumrader för SAMMA event är inte två event. Kalenderteman skriver
 * datumet två gånger i kortet (en datumbricka och en rad med klockslag), och
 * en konsert som slutar efter midnatt får sitt slutdatum på egen rad ("lördag
 * 14 november 21:00" / "söndag 15 november 01:00"). Utan sammanslagningen blev
 * varje spelning hos Kafé de luxe också ett tidlöst event dagen efter.
 *
 *   - samma titel, samma dag → ett event; raden med klockslag vinner
 *     (två OLIKA klockslag samma dag är två föreställningar och står kvar)
 *   - samma titel, dagen efter, skriven som "till 15 nov." → slutdatum på det första
 *
 * En serie ("Musikquiz" 18/11, 25/11, 2/12), en spelplan med kvällar i rad
 * ("27 nov", "28 nov") och en tvådagarsmarknad rörs inte.
 */
function mergeSameEvent(assigned: Assigned[]): Assigned[] {
    const byTitle = new Map<string, Assigned[]>();
    for (const a of assigned) {
        const key = a.title.toLowerCase();
        byTitle.set(key, [...(byTitle.get(key) ?? []), a]);
    }
    const dayOf = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dropped = new Set<Assigned>();
    for (const group of byTitle.values()) {
        const sorted = [...group].sort((x, y) => dayOf(x.date.start) - dayOf(y.date.start) || Number(y.date.hasTime) - Number(x.date.hasTime) || x.date.start.getTime() - y.date.start.getTime());
        let kept: Assigned | null = null;
        for (const cur of sorted) {
            if (!kept) { kept = cur; continue; }
            const gap = Math.round((dayOf(cur.date.start) - dayOf(kept.date.start)) / 86_400_000);
            if (gap === 0 && (!cur.date.hasTime || !kept.date.hasTime || cur.date.start.getTime() === kept.date.start.getTime())) { dropped.add(cur); continue; }
            if (gap === 1 && !cur.date.hasTime && cur.date.endMarker) {
                if (!kept.date.end) kept.date.end = cur.date.end ?? cur.date.start;
                dropped.add(cur);
                continue;
            }
            kept = cur;
        }
    }
    return assigned.filter((a) => !dropped.has(a));
}

// ─── Hela sidan ──────────────────────────────────────────────────────────────

export interface ListingEvent {
    title: string;
    start: Date;
    end?: Date;
    hasTime: boolean;
    description: string;
    price?: string;
    imageUrl?: string;
    /** Eventets adress: titellänken eller listsidan, alltid med datumfragment så varje tillfälle får sin nyckel. */
    url: string;
}

/**
 * Priset ur eventets egna rader: etiketterad rad ("Pris: 300:-") eller en rad
 * som bara är ett belopp — även "349 kr per person" och "525kr / person".
 * Flera olika belopp i samma kort ger inget pris (priceFromBareLines).
 */
function blockPrice(texts: string[]): string | undefined {
    return priceFromLabelledLines(texts)
        ?? priceFromBareLines(texts.map((t) => t.replace(/\s*(?:\/|per)\s*(?:person|pers\.?|p\.?p\.?|biljett|st)\.?$/i, '')));
}

const pad = (n: number): string => String(n).padStart(2, '0');
const dayStamp = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "Quiz med Kalle!" → "quiz-med-kalle" — fragmentets titel-del. */
export function titleSlug(title: string): string {
    return title.toLowerCase()
        .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[éè]/g, 'e').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}

/**
 * Eventets nyckel. Leder titeln till en egen sida på samma sajt blir det den
 * + "#ÅÅÅÅ-MM-DD" (samma form som Riksteaterns spelplaner — flera datum delar
 * sida). Annars listsidan + "#ÅÅÅÅ-MM-DD-titel".
 */
export function listingEventUrl(pageUrl: string, title: string, start: Date, link?: string): string {
    const page = pageUrl.replace(/#.*$/, '');
    if (link) {
        try {
            const l = new URL(link); const p = new URL(page);
            const sameSite = l.hostname.replace(/^www\./, '') === p.hostname.replace(/^www\./, '');
            if (sameSite && l.pathname.replace(/\/+$/, '') !== p.pathname.replace(/\/+$/, '') && l.pathname !== '/') {
                l.hash = '';
                return `${l.toString()}#${dayStamp(start)}`;
            }
        } catch { /* trasig länk — listsidan gäller */ }
    }
    return `${page}#${dayStamp(start)}-${titleSlug(title)}`;
}

/**
 * Alla event på en listsida. Filtrerar inte på datum (det gör motorn) men
 * tappar event utan godtagbar titel, och sidor där ingen rubriksort ger en
 * titel per datum.
 */
export function parseListing(html: string, pageUrl: string, now: Date = new Date()): ListingEvent[] {
    const { lines, images } = listingLines(html, pageUrl);
    const dateOnly = new Map<number, DateLine>();
    const rows = new Map<number, DateLine>();
    for (const l of lines) {
        if (l.heading === 1 && lines.filter((x) => x.heading === 1).length < 2) continue;
        const d = parseDateLine(l.text, now);
        if (!d) continue;
        // "27 nov Fullbokat": utan statusordet är raden bara ett datum. Datumet
        // måste då stå först — "Köp biljett 17/12" är en knapp, inget tillfälle.
        const bare = letters(d.rest) === 0 ? d : (d.atStart ? parseDateLine(l.text.replace(STATUS_WORDS_RE, ' '), now) : null);
        if (bare && letters(bare.rest) === 0) dateOnly.set(l.idx, bare);
        else if (d.atStart && l.text.length <= 160 && letters(d.rest) >= 3) rows.set(l.idx, d);
    }

    // Ett klockslag på raden under datumet hör till det ("Lördag 14 november" / "Klockan 14-16").
    for (const [idx, d] of dateOnly) {
        if (d.hasTime) continue;
        const next = lines[idx + 1];
        const t = next && !dateOnly.has(next.idx) ? timeOnly(next.text) : null;
        if (t && lcp(next.path, lines[idx].path) >= lines[idx].path.length - 1) { d.start.setHours(t.h, t.min, 0, 0); d.hasTime = true; }
    }

    // Rubriksorten som ger flest olika titlar vinner; lika → riktig rubrik före fetstil före länk.
    let best: Assigned[] = [];
    let bestCarriers: ListingLine[] = [];
    let bestDistinct = 0;
    const dateish = new Set<number>([...dateOnly.keys(), ...rows.keys()]);
    for (const cls of ['heading', 'bold', 'link'] as CarrierClass[]) {
        const got = assign(lines, dateOnly, dateish, cls);
        const distinct = new Set(got.events.map((a) => a.title.toLowerCase())).size;
        if (distinct > bestDistinct) { best = got.events; bestCarriers = got.carriers; bestDistinct = distinct; }
    }

    best = mergeSameEvent(best);

    const out: ListingEvent[] = [];
    const seen = new Set<string>();
    const push = (ev: ListingEvent) => {
        const key = `${ev.title.toLowerCase()}|${ev.start.getTime()}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push(ev);
    };

    // Kortens gränser: varje events första rad, i dokumentordning.
    const firstLine = (a: Assigned): number => Math.min(a.titleIdx, a.dateIdx);
    const starts = [...new Set(best.map(firstLine))].sort((a, b) => a - b);
    for (const a of best) {
        const dLine = lines[a.dateIdx]; const tLine = lines[a.titleIdx];
        // Kortet: största behållaren som bara rymmer det här eventets datum.
        let depth = lcp(dLine.path, tLine.path);
        const foreign = (prefix: number[]): boolean => best.some((o) => o.title !== a.title && within(lines[o.dateIdx], prefix));
        // Rubriker på samma nivå som titeln: en till betyder att behållaren
        // rymmer ett ANNAT avsnitt (Byttan 15/11: "Jullunch" fick julshowens
        // text). Underrubriker och kortets kategorirad räknas inte.
        const peers = (prefix: number[]): number => bestCarriers.filter((c) => c.heading === tLine.heading && within(c, prefix)).length;
        let block: ListingLine[];
        let img: ListingImage | undefined;
        if (!foreign(dLine.path.slice(0, depth))) {
            while (depth > 1) {
                const wider = dLine.path.slice(0, depth - 1);
                if (foreign(wider) || peers(wider) > peers(dLine.path.slice(0, depth)) || lines.filter((l) => within(l, wider)).length > MAX_BLOCK) break;
                depth--;
            }
            const prefix = dLine.path.slice(0, depth);
            block = lines.filter((l) => within(l, prefix)).slice(0, MAX_BLOCK);
            img = images.find((i) => within(i, prefix));
        } else {
            // Platt sida: eventets rader löper från dess första rad till nästa events.
            const from = firstLine(a);
            const to = Math.min(starts.find((s) => s > from) ?? lines.length, from + MAX_BLOCK);
            block = lines.slice(from, to);
            img = images.find((i) => i.at > from && i.at <= to);
        }
        // Brödtexten: inte titeln, datumraderna, knapparna, rena länkrader
        // ("Google Kalender") eller datumbrickans spillror ("nov.", "14").
        const body = block.filter((l) => l.idx !== a.titleIdx && l.idx !== a.dateIdx && !dateOnly.has(l.idx)
            && !CTA_RE.test(l.text) && !l.link && letters(l.text) >= 3 && !MONTH_ONLY_RE.test(l.text));
        const texts = body.map((l) => l.text.replace(new RegExp(`\\s*${CELL_SEP}\\s*`, 'g'), ' · '));
        push({
            title: a.title,
            start: a.date.start, end: a.date.end, hasTime: a.date.hasTime,
            description: cleanDescription(texts.filter((t) => !timeOnly(t)).join('\n')),
            price: blockPrice(texts),
            imageUrl: img?.src,
            url: listingEventUrl(pageUrl, a.title, a.date.start, a.link),
        });
    }

    // Listrader: minst MIN_ROWS syskon med datum först och en titel efter.
    // Syskon = samma förälder, sedan radens egna omslag skalats av (<li><a><div>…):
    // ett omslag är en behållare som bara rymmer den raden.
    const groups = new Map<string, number[]>();
    for (const idx of rows.keys()) {
        let path = lines[idx].path;
        for (let i = 0; i < 3 && path.length > 2 && lines.filter((l) => within(l, path)).length === 1; i++) path = path.slice(0, -1);
        // Skalades inget av bär radens eget block flera rader (<br>-brutna): då är blocket listan.
        const key = (path === lines[idx].path && lines.filter((l) => within(l, path)).length === 1 ? path.slice(0, -1) : path).join('.');
        groups.set(key, [...(groups.get(key) ?? []), idx]);
    }
    for (const idxs of groups.values()) {
        if (idxs.length < MIN_ROWS) continue;
        for (const idx of idxs) {
            const d = rows.get(idx)!;
            const cells = d.tail.split(CELL_SEP).map((c) => cleanTitle(c.replace(TRAILING_TIME_RE, ''))).filter(Boolean);
            const title = cells.find((c) => titleOk(c) && !OPENING_RE.test(c));
            if (!title) continue;
            push({
                title,
                start: d.start, end: d.end, hasTime: d.hasTime,
                description: '',
                price: blockPrice(cells),
                url: listingEventUrl(pageUrl, title, d.start, lines[idx].link),
            });
        }
    }
    return out;
}
