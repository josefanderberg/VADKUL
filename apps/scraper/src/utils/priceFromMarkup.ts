/**
 * priceFromMarkup.ts — pris ur DETALJSIDANS markup: faktarutan och JSON-LD.
 *
 * Bakgrund (jämförelsen 14/11 2026): 80 % av de kommande eventen saknade pris,
 * fast priset STÅR på eventsidan hos de flesta kommun-, besöks- och
 * studieförbundskällor. Det står bara inte i brödtexten som beskrivningens
 * prisletare (priceFromText) läser, utan i sidans faktaruta:
 *
 *   <dt>Pris</dt><dd>365 kr/st</dd>                     (Ljungby, ABF, Norrtälje)
 *   <div>Pris</div><div id="priceItem">200 kr</div>      (Studiefrämjandet)
 *   <span>Kostnad</span>…<p>Gratis</p>                   (Göteborgs Stad, Gävle)
 *   <p><strong>Pris:</strong> 90 Kr</p>                  (Hallstahammar)
 *   <div class="…info-field">Pris: från 540 kr.</div>    (Kalmar, Höganäs)
 *   <span>Om biljetter</span><p>Ordinarie: 195 kr …</p>  (Riksteatern)
 *   <li><strong>Fri entré</strong> <span>Ja</span></li>  (Bollnäs)
 *   "isAccessibleForFree": true / offers i JSON-LD       (Eslöv, Göteborg)
 *
 * Metod: sidan plattas till RADER (blockelement bryter rad, inline-taggar blir
 * mellanslag). En rad som bara är en prisetikett följs av värdet på nästa rad;
 * en rad som börjar med etiketten bär värdet själv. Värdet tolkas av
 * priceFromText, så spärrord, villkorad gratis och intervall följer samma
 * regler som för beskrivningar.
 *
 * PRECISION före täckning, som i priceFromText:
 *   - Bara rader med prisetikett räknas, eller en rad som ÄR ett pris
 *     ("395 kr - 725 kr"). Belopp i löptext lämnas.
 *   - Sidans prisuppgifter måste vara överens. Två etiketterade priser som
 *     inte går ihop (showen och middagspaketet) ger inget pris.
 *   - Navigering, sidfot och listor med andra evenemang rensas först.
 *   - Ett ensamt "Fri entré"-märke godtas bara om sidan har exakt ett
 *     (flera = en lista med andra evenemang).
 *   - JSON-LD: bara Event-noder, bara SEK, och flera noder måste vara överens.
 *     Flaggan isAccessibleForFree ensam räknas inte utan trustFreeFlag.
 *
 * Ren modul (ingen I/O). Utdata som priceFromText: "150 kr", "150–250 kr",
 * "från 150 kr", "Gratis".
 */

import * as cheerio from 'cheerio';
import { decodeHtmlEntities } from './text';
import { extractPriceFromText } from './priceFromText';

/** Prisetiketter (med bestämd form): det som står framför eller ovanför värdet. */
const LABEL_WORD = '(?:pris(?:er|et)?(?:\\s*/\\s*person)?|biljettpris(?:er|et)?|entr[ée](?:avgift|pris)?(?:en|et)?|intr[äa]de(?:savgift)?|kostnad(?:en)?|avgift(?:en)?|deltagaravgift(?:en)?|price|admission)';

/** Rad som BARA är en etikett: "Pris", "Kostnad:", "Om biljetter". Värdet står på nästa rad. */
const LABEL_LINE_RE = new RegExp(`^(?:${LABEL_WORD}|om biljetter|biljettinformation|biljetter\\s*(?:&|och)\\s*bokning|kostnad och information om anmälan)\\s*:?$`, 'iu');

/** Rad som börjar med etikett + kolon: "Pris: från 540 kr.", "Pris & anmälan: Kostnadsfritt". */
const PREFIX_COLON_RE = new RegExp(`^(?:${LABEL_WORD}|biljettinformation)(?:\\s*(?:&|och)\\s*\\p{L}+)?\\s*:\\s*(\\S.*)$`, 'iu');

/**
 * Etikett + värde på samma rad utan kolon ("Pris 100 kr", "Kostnad Gratis") —
 * två inline-element som plattats ihop. Värdet måste BÖRJA som ett pris, annars
 * är raden löptext ("Entré via Storgatan").
 */
const PREFIX_BARE_RE = new RegExp(`^${LABEL_WORD}\\s+((?:(?:från|fr\\.?)\\s+)?\\d[\\d .]*\\s*(?:kr(?:onor)?|:-|sek)(?!\\p{L}).*|(?:gratis|kostnadsfri(?:tt)?|fri\\s+entr[ée])(?!\\p{L}).*)$`, 'iu');

/** Ja/nej-fält: "Fri entré Ja" (Bollnäs). */
const FREE_FLAG_RE = /^fri(?:tt)?\s+(?:entr[ée]|inträde)\s*:?\s*ja\.?$/i;

/** Ensamt gratismärke på egen rad: <p>Fri entré</p>, <span>Gratis inträde</span>. */
const FREE_BADGE_RE = /^(?:fri\s+entr[ée]|gratis\s+(?:entr[ée]|inträde)|fritt\s+inträde|free\s+(?:entry|admission))\s*[!.]?$/i;

/** En rad som bär ett belopp — fortsättning på en pristabell. */
const HAS_AMOUNT_RE = /\d\s*(?:kr(?!\p{L})|:-|sek(?!\p{L})|kronor(?!\p{L}))/iu;

/** "495 kr + serviceavgift": avgiftssvansen är inte priset, men fäller annars hela raden på spärrordet. */
const SERVICE_FEE_TAIL_RE = /\s*(?:\+|plus|exkl(?:usive|\.)?|och)\s*(?:service|boknings|expeditions|biljett)avgift\w*\.?/giu;

/** Block som inte hör till eventet: listor med andra evenemang. */
const RELATED_RE = /related|similar|liknande|andra.?evenemang|other.?events?|more.?events?|fler.?evenemang|upcoming/i;

/** Rubriken som inleder en lista med andra evenemang: "Liknande kurser", "Fler evenemang", "Du kanske också gillar". */
const RELATED_HEADING_RE = /^(?:(?:liknande|relaterade?|fler|andra|mer|kommande|övriga)\s+(?:evenemang|event|kurser|arrangemang|händelser|aktiviteter|föreställningar|konserter)|du kanske också|mer som liknar|se även|upptäck (?:fler|mer)|missa inte)\b/i;

const BLOCK_TAG_RE =/<\/?(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|fieldset|figcaption|figure|h[1-6]|header|hr|li|main|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

const collapse = (s: string): string => s.replace(/[\s ]+/g, ' ').trim();

/**
 * Sidan som rader: blockelement bryter rad, inline-taggar blir mellanslag.
 * Skript, navigering, sidfot och andra-evenemang-listor är borta. Exporterad
 * för test och felsökning.
 */
export function markupLines(html: string): string[] {
    const $ = cheerio.load(html);
    $('script, style, noscript, template, svg, nav, footer, select, button, iframe').remove();
    $('[class], [id]').each((_i, el) => {
        const attribs = (el as { attribs?: Record<string, string> }).attribs ?? {};
        if (RELATED_RE.test(`${attribs.class ?? ''} ${attribs.id ?? ''}`)) $(el).remove();
    });
    const body = $('body').html() ?? '';
    const h1 = collapse(decodeHtmlEntities($('h1').first().text()));
    const lines = body
        .replace(BLOCK_TAG_RE, '\n')
        .replace(/<[^>]+>/g, ' ')
        .split('\n')
        .map((line) => collapse(decodeHtmlEntities(line)))
        .filter(Boolean);
    // Allt efter rubriken "Liknande kurser" / "Fler evenemang" hör till ANDRA
    // event. Klassnamnen avslöjar inte alltid blocket (ABF: <h2 class=
    // "heading-md">), och korten där bär egna "Pris: Gratis"-rader. Bara
    // rubriker EFTER sidans h1 räknas — före den står sidhuvudets länkar.
    const start = h1 ? Math.max(0, lines.indexOf(h1)) : 0;
    const cut = lines.findIndex((line, i) => i > start && RELATED_HEADING_RE.test(line));
    return cut >= 0 ? lines.slice(0, cut) : lines;
}

/** "316/268/120 kr" → "316 kr, 268 kr, 120 kr" — bara tal-grupper som slutar i en valuta, aldrig datum ("24/12"). */
const SLASH_GROUP_RE = /((?:\d[\d ]*\s*\/\s*)+\d[\d ]*)\s*(kr(?:onor)?|:-|sek)(?!\p{L})/giu;

/** Beloppen i ett pris som priceFromText formaterat: "150 kr", "60–100 kr", "från 99 kr", "12,50 kr". */
function amountsOf(price: string): number[] {
    return (price.match(/\d+(?:,\d{2})?/g) ?? []).map((s) => parseFloat(s.replace(',', '.')));
}

const fmtKr = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

/** Prisfältet förklarar att beloppet gäller något annat än entrén: ett paket, en buffé, något som köps separat. */
const ADDON_NOTE_RE = /priset\s+(?:avser|gäller|inkluderar)|köp(?:es|s)\s+separat|(?:biljett|entr[ée])\s+(?:ingår\s+ej|tillkommer)/iu;

/** Åldersgräns i samma mening som en gratisfras: gäller inte alla, alltså inte eventets pris. */
const AGE_LIMITED_RE = /(?:under|upp\s+till|t\.?\s?o\.?\s?m\.?|till\s+och\s+med)\s+\d{1,2}\s*(?:år|månader)/iu;

/**
 * Tolka ett värde som stod vid en prisetikett. undefined = inget säkert pris.
 *
 * Värdet är ett PRISFÄLT, så alla meningar i det hör till priset: "250 kronor
 * för medlemmar. Ordinarie pris 300 kronor." är 250–300 kr, inte 250. Varje
 * mening tolkas för sig av priceFromText (spärrord och villkorad gratis gäller
 * per mening) och beloppen slås ihop. Säger första tolkningsbara meningen
 * gratis är eventet gratis ("Fri entré. Lunch 95 kr.").
 */
function interpretValue(raw: string): string | undefined {
    const v = collapse(raw).replace(SERVICE_FEE_TAIL_RE, '').slice(0, 240)
        .replace(SLASH_GROUP_RE, (_m, group: string, cur: string) => `${group.split('/').map((s) => s.trim()).join(` ${cur}, `)} ${cur}`);
    if (!v) return undefined;
    // Tilläggets pris, inte eventets: "345 kronor/person. Priset avser endast
    // konsertbuffé, showbiljett köpes separat." (Helsingborg Arena).
    if (ADDON_NOTE_RE.test(v)) return undefined;
    // Bart tal direkt efter etiketten: "499" (valutan i ett eget element), "0".
    const bare = v.match(/^(\d{1,5})(?:[.,]00)?$/);
    if (bare) {
        const n = parseInt(bare[1], 10);
        return n === 0 ? 'Gratis' : `${n} kr`;
    }
    const parts = v.split(/(?<=[.!?])\s+/)
        .map((sentence) => {
            const p = extractPriceFromText(`Pris: ${sentence}`);
            // "Fri entré för alla riddare, prinsar och prinsessor under 18 år"
            // (Livrustkammaren): åldersgränsen står längre bort än priceFromText
            // letar. I ett prisfält gör den gratis villkorad var den än står.
            return p === 'Gratis' && AGE_LIMITED_RE.test(sentence) ? null : p;
        })
        .filter((p): p is string => !!p);
    if (parts.length === 0) return undefined;
    if (parts[0] === 'Gratis') return 'Gratis';
    const paid = parts.filter((p) => p !== 'Gratis');
    if (paid.length === 1) return paid[0];
    const amounts = paid.flatMap(amountsOf);
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return min === max ? `${fmtKr(max)} kr` : `${fmtKr(min)}–${fmtKr(max)} kr`;
}

/** Värdet under en etikettrad: nästa rad, eller ett par rader ner i nästlad markup. */
function valueBelow(lines: string[], i: number): string | undefined {
    let acc = '';
    for (let j = i + 1; j < lines.length && j <= i + 4; j++) {
        if (LABEL_LINE_RE.test(lines[j])) break;   // nästa etikett — värdet saknades
        acc = acc ? `${acc} ${lines[j]}` : lines[j];
        if (acc.length > 240) break;
        const price = interpretValue(acc);
        if (!price) continue;
        // Pristabell: följande rader som bär belopp hör till samma pris
        // ("Vuxen: 100 kr" / "Barn: 50 kr"). Första raden utan belopp avslutar.
        let table = acc;
        let k = j + 1;
        while (k < lines.length && k <= j + 6 && lines[k].length <= 80 && HAS_AMOUNT_RE.test(lines[k])) {
            table += `, ${lines[k]}`;
            k++;
        }
        return (k > j + 1 ? interpretValue(table) : undefined) ?? price;
    }
    return undefined;
}

/**
 * Är sidans prisuppgifter överens? Flera etiketterade priser på en sida är
 * antingen samma pris skrivet två gånger (mobil- och skrivbordsvy, "från 150
 * kr" i huvudet och "150–250 kr" i faktarutan) eller OLIKA saker: Helsingborg
 * Arena skriver "Pris: 1300 kronor/person" om terrasspaketet och "Pris: 575
 * kronor/person" om julbuffén under en show som kostar 395–725 kr. Går
 * intervallen inte ihop finns inget säkert pris. Första uppgiften vinner
 * annars — faktarutan står före tilläggen.
 */
function agreedPrice(prices: string[]): string | undefined {
    if (prices.length === 0) return undefined;
    const free = prices.filter((p) => p === 'Gratis').length;
    if (free === prices.length) return 'Gratis';
    if (free > 0) return undefined;
    const ranges = prices.map(amountsOf).map((a) => [Math.min(...a), Math.max(...a)]);
    const lowestMax = Math.min(...ranges.map((r) => r[1]));
    const highestMin = Math.max(...ranges.map((r) => r[0]));
    return highestMin <= lowestMax ? prices[0] : undefined;
}

/** Pris ur sidans faktaruta (etiketterade rader). Exporterad för test. */
export function priceFromLabelledLines(lines: string[]): string | undefined {
    const found: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 300) continue;
        if (FREE_FLAG_RE.test(line)) { found.push('Gratis'); continue; }
        if (LABEL_LINE_RE.test(line)) {
            const below = valueBelow(lines, i);
            if (below) found.push(below);
            continue;
        }
        const prefixed = line.match(PREFIX_COLON_RE) ?? line.match(PREFIX_BARE_RE);
        if (prefixed) {
            const price = interpretValue(prefixed[1]);
            if (price) found.push(price);
        }
    }
    return agreedPrice(found);
}

/** En rad som BARA är ett pris: "320 kr", "395 kr - 725 kr", "från 150 kr", "595-795:-". */
const BARE_PRICE_LINE_RE = /^(?:(?:från|fr\.?)\s+)?\d[\d ]*(?:\s*(?:kr|:-|sek))?(?:\s*[-–]\s*\d[\d ]*)?\s*(?:kr|:-|sek)$/i;

/**
 * Prisrad utan etikett: biljettrutans "395 kr - 725 kr" (Helsingborg Arena),
 * hjältebildens "320 kr" (Visit Linköping). Godtas bara när sidans alla
 * sådana rader säger samma sak — en lista med andra evenemang ger flera
 * olika belopp, och då är inget av dem säkert eventets. Exporterad för test.
 */
export function priceFromBareLines(lines: string[]): string | undefined {
    const prices = lines
        .filter((line) => line.length <= 40 && BARE_PRICE_LINE_RE.test(line))
        .map((line) => interpretValue(line))
        .filter((p): p is string => !!p && p !== 'Gratis');
    return new Set(prices).size === 1 ? prices[0] : undefined;
}

// ───────────────────────────────────────────────────────────────────────────
//  JSON-LD
// ───────────────────────────────────────────────────────────────────────────

/** price: offers gav ett belopp. free/notFree: isAccessibleForFree stod uttryckligen som true/false. */
export interface LdPrice { price?: string; free?: true; notFree?: true }

function isEventNode(node: Record<string, unknown>): boolean {
    const t = node['@type'];
    const types = Array.isArray(t) ? t : [t];
    return types.some((x) => typeof x === 'string' && /Event$/.test(x));
}

function collectLdEvents(value: unknown, out: Record<string, unknown>[], depth = 0): void {
    if (!value || typeof value !== 'object' || depth > 6) return;
    if (Array.isArray(value)) { value.forEach((v) => collectLdEvents(v, out, depth + 1)); return; }
    const node = value as Record<string, unknown>;
    if (isEventNode(node)) out.push(node);
    if (node['@graph']) collectLdEvents(node['@graph'], out, depth + 1);
}

function ldPriceOf(node: Record<string, unknown>): LdPrice {
    const nums: number[] = [];
    let foreign = false;
    const take = (o: unknown): void => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(take); return; }
        const offer = o as Record<string, unknown>;
        const cur = offer.priceCurrency;
        if (typeof cur === 'string' && cur.trim() && !/^(?:sek|kr)$/i.test(cur.trim())) { foreign = true; return; }
        for (const key of ['price', 'lowPrice', 'highPrice', 'minPrice', 'maxPrice']) {
            const v = offer[key];
            if (v === undefined || v === null || v === '') continue;
            const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
            if (Number.isFinite(n) && n >= 0 && n <= 20000) nums.push(n);
        }
        take(offer.priceSpecification);
    };
    take(node.offers);
    if (foreign) return {};
    const flag = String(node.isAccessibleForFree ?? '').toLowerCase();
    if (nums.length === 0) return flag === 'true' ? { free: true } : flag === 'false' ? { notFree: true } : {};
    // Hela kronor: biljettsajternas avgiftspåslag ger "662.44", och ören säger inget på ett kort.
    const min = Math.round(Math.min(...nums));
    const max = Math.round(Math.max(...nums));
    if (max === 0) return { price: 'Gratis' };
    return { price: min === max ? `${max} kr` : `${min}–${max} kr` };
}

/** Event-nodernas pris i sidans JSON-LD. Flera noder måste vara överens. Exporterad för test. */
export function priceFromJsonLd(html: string): LdPrice {
    const nodes: Record<string, unknown>[] = [];
    // `ld&#x2B;json`: vastsverige.com maskerar plustecknet.
    const re = /<script[^>]*type\s*=\s*["']application\/ld(?:\+|&#x2B;|&#43;)json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
        try { collectLdEvents(JSON.parse(m[1].trim()), nodes); } catch { /* trasig JSON-LD — hoppa */ }
    }
    if (nodes.length === 0) return {};
    const results = nodes.map(ldPriceOf);
    const prices = new Set(results.map((r) => r.price).filter(Boolean));
    if (prices.size > 1) return {};
    const price = [...prices][0];
    if (price) return { price };
    if (results.every((r) => r.free === true)) return { free: true };
    return results.some((r) => r.notFree === true) ? { notFree: true } : {};
}

/** Vilken väg priset kom: faktarutan, JSON-LD offers, en ensam prisrad, ensamt gratismärke eller bara JSON-LD-flaggan. */
export type PriceVia = 'etikett' | 'ld-offers' | 'prisrad' | 'gratismärke' | 'ld-gratisflagga';

export interface MarkupPrice {
    price?: string;
    via?: PriceVia;
    /** Sidans JSON-LD säger uttryckligen isAccessibleForFree=false. */
    flagFalse?: boolean;
}

/**
 * Detaljsidans pris med ursprung. Ordning: faktarutans etiketterade rader →
 * JSON-LD offers → ensam prisrad → ensamt gratismärke → JSON-LD
 * isAccessibleForFree ensam.
 * Den sista är svagast: se priceFromMarkup.
 */
export function readMarkupPrice(html: string | null | undefined): MarkupPrice {
    if (!html || html.length < 200) return {};
    const ld = priceFromJsonLd(html);
    const flagFalse = ld.notFree === true;
    const lines = markupLines(html);
    const labelled = priceFromLabelledLines(lines);
    if (labelled) return { price: labelled, via: 'etikett', flagFalse };
    if (ld.price) return { price: ld.price, via: 'ld-offers', flagFalse };
    const bare = priceFromBareLines(lines);
    if (bare) return { price: bare, via: 'prisrad', flagFalse };
    if (lines.filter((line) => FREE_BADGE_RE.test(line)).length === 1) return { price: 'Gratis', via: 'gratismärke', flagFalse };
    if (ld.free) return { price: 'Gratis', via: 'ld-gratisflagga', flagFalse };
    return { flagFalse };
}

/**
 * Eventets pris ur detaljsidans markup. undefined när inget SÄKERT pris finns.
 *
 * JSON-LD-flaggan isAccessibleForFree=true räknas som pris bara med
 * `trustFreeFlag`. En sajt kan sätta true på allt (Hörby: 8 av 8 sidor, ingen
 * enda false), och på en enskild sida går det inte att skilja från en sajt där
 * flaggan betyder något (Kalmar: false på betalevent). price-refine ser många
 * sidor per värd och litar på flaggan först när värden också visat false.
 */
export function priceFromMarkup(html: string | null | undefined, opts: { trustFreeFlag?: boolean } = {}): string | undefined {
    const r = readMarkupPrice(html);
    if (r.via === 'ld-gratisflagga' && !opts.trustFreeFlag) return undefined;
    return r.price;
}
