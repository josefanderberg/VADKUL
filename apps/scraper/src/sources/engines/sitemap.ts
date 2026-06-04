/**
 * Sitemap engine — CMS-oberoende eventhämtning via /sitemap.xml.
 *
 * Steg per körning:
 *   1. Hämta `config.sitemapUrl` (kan vara sitemap.xml ELLER sitemap_index.xml)
 *   2. Om index → expandera prioriterade sub-sitemaps
 *   3. Filtrera URLs genom `config.urlPatterns` (RegExp[])
 *   4. Filtrera bort URLs som matchar `config.urlBlacklist` (för att skippa
 *      möten/protokoll som ligger i samma kalender)
 *   5. För varje kvarvarande URL: hämta HTML, försök JSON-LD Event-extraction
 *   6. Om JSON-LD saknas → minimal cheerio-fallback (h1 + meta-tags)
 *
 * Config (alla optional utom `sitemapUrl` + `urlPatterns`):
 *   sitemapUrl:    string             — startpunkt
 *   urlPatterns:   RegExp[]           — minst en måste matcha
 *   urlBlacklist?: RegExp[]           — om någon matchar — skippa URL
 *   defaultCity?:  string             — fallback om JSON-LD saknar
 *   userAgent?:    string
 *   maxUrls?:      number             — cap per körning, default 500
 *   maxSubSitemaps?: number           — hur många sub-sitemaps att expandera, default 10
 *   timeoutMs?:    number             — default 15000
 *   concurrency?:  number             — fetch-concurrency, default 6
 *
 * Engine-författarens kontrakt: returnerar RawEvent[] osorterat. Runnern
 * fönsterfiltrerar och dedup:ar.
 */

import * as cheerio from 'cheerio';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { extractJsonLdBlocks, collectEvents, jsonLdToRawEvent, DEFAULT_EVENT_TYPES } from './json-ld';
import { findFirstDateInText } from '../../utils/swedishDate';

const gunzip = promisify(zlib.gunzip);

export interface SitemapConfig {
    sitemapUrl: string;
    urlPatterns: RegExp[];
    urlBlacklist?: RegExp[];
    defaultCity?: string;
    userAgent?: string;
    maxUrls?: number;
    maxSubSitemaps?: number;
    timeoutMs?: number;
    concurrency?: number;
    /**
     * Aktivera early-exit baserat på "N i rad utanför fönster". Default off.
     * Sätt true på stora sajter där lastmod är pålitlig signal för event-datum.
     */
    aggressiveEarlyExit?: boolean;
    /**
     * Regex som extraherar år+månad (och ev. dag) ur URL. När satt:
     * pre-filtrerar URL:er INNAN fetch — sparar enorm tid på stora sajter
     * som Studiefrämjandet (1500+ URLs) där bara veckans har relevans.
     *
     * Måste ha named groups: (?<year>\d{4}), (?<month>\d{1,2}|jan|feb|...)
     * och optionalt (?<day>\d{1,2}). Månadsnamn kan vara svenska eller siffra.
     *
     * Exempel: /kalenderhandelser/2026/september/...
     *   urlDateRegex: /\/(?<year>\d{4})\/(?<month>\w+)\//
     */
    urlDateRegex?: RegExp;
}

/**
 * Map svensk månadsnamn → 1-indexerad månadssiffra.
 */
const SV_MONTHS: Record<string, number> = {
    januari: 1, jan: 1,
    februari: 2, feb: 2,
    mars: 3, mar: 3,
    april: 4, apr: 4,
    maj: 5,
    juni: 6, jun: 6,
    juli: 7, jul: 7,
    augusti: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
};

function extractDateFromUrl(url: string, re: RegExp): Date | null {
    const m = url.match(re);
    if (!m || !m.groups) return null;
    const year = parseInt(m.groups.year, 10);
    if (isNaN(year)) return null;
    let month: number;
    const monthRaw = (m.groups.month || '').toLowerCase();
    if (/^\d+$/.test(monthRaw)) {
        month = parseInt(monthRaw, 10);
    } else {
        month = SV_MONTHS[monthRaw] || 0;
    }
    if (!month || month < 1 || month > 12) return null;
    const day = m.groups.day ? parseInt(m.groups.day, 10) : 1;
    if (day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
}

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Default URL-blacklist — exkluderar kommunala protokoll, nämnd-möten,
 * trafikinformation och annat som ofta ligger i samma kalender-mönster men
 * inte är publika events.
 */
const DEFAULT_URL_BLACKLIST: RegExp[] = [
    /protokoll/i,
    /sammantrade/i,
    /sammantradesprotokoll/i,
    /kommunfullmaktige/i,
    /kommunstyrelse/i,
    /\bnamnd(?:en|er|ens)?\b/i,
    /styrelsemote/i,
    /arsmote/i,
    /bygglov/i,
    /overformyndar/i,
    // Trafik/infrastruktur — inte event
    /trafikstorning/i,
    /parkering(?:en|ar)?-av/i,
    /avstangd/i,
    /vagarbete/i,
    /omledning/i,
];

/**
 * Default title-blacklist — sidor vars titel innehåller dessa är inte events
 * (cookie-banners, site-index, generiska fallbacks).
 */
const DEFAULT_TITLE_BLACKLIST: RegExp[] = [
    /^startsida$/i,
    /^hem$/i,
    /^vi (använder|anvander) kakor/i,
    /^cookie/i,
    /^sok\s*resultat/i,
    /^404\b/,
    // Trafik/parkering i titel
    /^\d+ parkeringar.*avst[äa]ngd/i,
    /trafikst[öo]rning/i,
    /v[äa]garbete/i,
];

const DEFAULT_MAX_URLS = 300;
const DEFAULT_MAX_SUB_SITEMAPS = 10;
const DEFAULT_TIMEOUT = 30000;  // höjt från 15s — stora sitemap-XML (1.7MB+) tar tid
const DEFAULT_CONCURRENCY = 6;

/**
 * Hämta text från URL med retry på transienta fel + transparent gzip-stöd.
 *
 * Många stora svenska sajter (Yoast SEO default) komprimerar sitemap-XML som
 * `.xml.gz`. Vi detekterar via:
 *   1. URL slutar på `.gz`
 *   2. Content-Encoding: gzip
 *   3. Content-Type är gzip
 * och dekomprimerar med zlib.gunzip. Utan detta missar vi events från
 * Lund, Visit Lund, Växjö m.fl.
 *
 * Returnerar HTML/XML-strängen eller null om alla försök misslyckas.
 */
async function fetchText(url: string, cfg: SitemapConfig, signal?: AbortSignal): Promise<string | null> {
    const maxAttempts = 3;
    const isGzUrl = url.toLowerCase().endsWith('.gz');
    let lastErr = '';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await domainLimiter.wait(url);
        const ac = new AbortController();
        const timeout = setTimeout(() => ac.abort(), cfg.timeoutMs ?? DEFAULT_TIMEOUT);
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                    // OBS: */* måste vara med — utan den ger Studiefrämjandet 406.
                    'Accept': 'text/html,application/xml,application/xhtml+xml,application/gzip,*/*;q=0.1',
                    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
                },
                signal: signal ?? ac.signal,
                redirect: 'follow',
            });
            if (res.ok) {
                const ct = (res.headers.get('content-type') || '').toLowerCase();
                const ce = (res.headers.get('content-encoding') || '').toLowerCase();
                const isGzResponse = isGzUrl || ce.includes('gzip') || ct.includes('gzip');
                if (isGzResponse) {
                    const buf = Buffer.from(await res.arrayBuffer());
                    // fetch dekomprimerar automatiskt om Content-Encoding: gzip
                    // var satt — i så fall är buf redan plain text
                    if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
                        const out = await gunzip(buf);
                        return out.toString('utf8');
                    }
                    return buf.toString('utf8');
                }
                return await res.text();
            }
            if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                return null;
            }
            lastErr = `HTTP ${res.status}`;
        } catch (e) {
            const err = e as Error;
            lastErr = err.name === 'AbortError' ? 'timeout' : err.message;
        } finally {
            clearTimeout(timeout);
        }
        if (attempt < maxAttempts) {
            const backoff = attempt === 1 ? 1000 : 3000;
            await new Promise(r => setTimeout(r, backoff));
        }
    }
    return null;
}

interface SitemapEntry {
    url: string;
    lastmod?: Date;
}

/**
 * Plocka ut <url><loc>…</loc><lastmod>…</lastmod></url>-block ur sitemap-XML.
 * Namespace-agnostisk. Returnerar entries med ev. lastmod.
 */
function extractEntries(xml: string): SitemapEntry[] {
    const out: SitemapEntry[] = [];
    // Matcha varje <url>-block (eller <sitemap>-block i index) som innehåller en <loc>
    const urlBlock = /<(?:url|sitemap)\b[^>]*>([\s\S]*?)<\/(?:url|sitemap)>/gi;
    let m: RegExpExecArray | null;
    while ((m = urlBlock.exec(xml)) !== null) {
        const block = m[1];
        const locM = /<loc>\s*([^<\s]+)\s*<\/loc>/i.exec(block);
        if (!locM) continue;
        const lastmodM = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i.exec(block);
        let lastmod: Date | undefined;
        if (lastmodM) {
            const d = new Date(lastmodM[1]);
            if (!isNaN(d.getTime())) lastmod = d;
        }
        out.push({ url: locM[1].trim(), lastmod });
    }
    return out;
}

/** Plocka ut bara <loc>-element ur sitemap-XML (legacy-helper). */
function extractLocs(xml: string): string[] {
    return extractEntries(xml).map(e => e.url);
}

function isSitemapIndex(xml: string): boolean {
    return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Hämta event-URL-kandidater från sitemap. Expanderar index en nivå,
 * prioriterar sub-sitemaps med event-relaterade ord, och sorterar URL:er på
 * `lastmod` desc — så att nyligen modifierade events hämtas först. När 90%
 * av URL:erna är historiska sparar det enorm tid.
 */
async function discoverEntries(cfg: SitemapConfig, ctx: EngineContext): Promise<SitemapEntry[]> {
    const root = await fetchText(cfg.sitemapUrl, cfg, ctx.signal);
    if (!root) {
        ctx.log(`sitemap: kunde inte hämta ${cfg.sitemapUrl}`);
        return [];
    }

    let candidates: SitemapEntry[] = [];

    if (isSitemapIndex(root)) {
        const subs = extractEntries(root);
        // Prioritera sub-sitemaps som troligen innehåller events
        subs.sort((a, b) => {
            const score = (u: string) => /(event|evenemang|kalender|aktivitet|arrangemang|upplev|happening)/i.test(u) ? 0 : 1;
            return score(a.url) - score(b.url);
        });
        const limit = cfg.maxSubSitemaps ?? DEFAULT_MAX_SUB_SITEMAPS;
        const chosen = subs.slice(0, limit);
        ctx.log(`sitemap-index: ${subs.length} sub-sitemaps, expanderar ${chosen.length}`);
        for (const sub of chosen) {
            const child = await fetchText(sub.url, cfg, ctx.signal);
            if (child && !isSitemapIndex(child)) {
                candidates.push(...extractEntries(child));
            }
        }
    } else {
        candidates = extractEntries(root);
    }

    // Filtrera genom urlPatterns
    const matching = candidates.filter(e =>
        cfg.urlPatterns.some(re => re.test(e.url))
    );

    // Skippa blacklistade — alltid default-blacklist + ev. custom
    const allBlacklist = [...DEFAULT_URL_BLACKLIST, ...(cfg.urlBlacklist || [])];
    let filtered = matching.filter(e => !allBlacklist.some(re => re.test(e.url)));

    // urlDateRegex: pre-filtrera URL:er som inte ligger i ctx-fönstret. Sparar
    // massa fetch-tid på stora sajter (Studiefrämjandet 1500+ URLs).
    if (cfg.urlDateRegex) {
        const before = filtered.length;
        filtered = filtered.filter(e => {
            const d = extractDateFromUrl(e.url, cfg.urlDateRegex!);
            if (!d) return true;  // håll URL om vi inte kan parsa datum
            // Tolerera 1 månad bakåt (för flerdagars-events som börjat tidigt)
            const cutoffPast = new Date(ctx.windowStart.getTime() - 31 * 24 * 3600 * 1000);
            return d >= cutoffPast && d <= ctx.windowEnd;
        });
        ctx.log(`sitemap: urlDateRegex pre-filter ${before} → ${filtered.length}`);
    }

    // Sortera på lastmod desc. URL:er UTAN lastmod antas vara nya/färska och
    // hamnar tidigt — annars riskerar sajter som inte sätter lastmod att
    // tappa events när early-exit triggar innan de hinner fetchas.
    const now = Date.now();
    filtered.sort((a, b) => {
        const ta = a.lastmod?.getTime() ?? now;
        const tb = b.lastmod?.getTime() ?? now;
        return tb - ta;
    });

    const cap = cfg.maxUrls ?? DEFAULT_MAX_URLS;
    const final = filtered.slice(0, cap);
    const withLastmod = final.filter(e => e.lastmod).length;
    ctx.log(`sitemap: ${candidates.length} totalt → ${matching.length} matchande → ${filtered.length} efter blacklist → ${final.length} efter cap (${withLastmod} med lastmod)`);
    return final;
}

/**
 * Cheerio-fallback för sidor utan JSON-LD. Plockar h1 + og:title/description/image,
 * + microdata om finns. Datum är svårt utan JSON-LD — vi returnerar null om vi
 * inte hittar något datumlikt.
 */
function titleFromUrl(url: string): string {
    try {
        const u = new URL(url);
        const slug = u.pathname.split('/').filter(Boolean).pop() || '';
        return slug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
    } catch {
        return '';
    }
}

function cheerioFallback(html: string, url: string, defaultCity?: string): RawEvent | null {
    const $ = cheerio.load(html);
    // Title-fallback: h1 → og:title → <title> → URL-slug (avlägsna sajtnamnet)
    let title = ($('h1').first().text() || '').trim();
    if (!title) title = ($('meta[property="og:title"]').attr('content') || '').trim();
    if (!title) {
        const docTitle = ($('title').first().text() || '').trim();
        // Strippa " | Sajtnamn" / " - Kommun" från <title>
        title = docTitle.split(/\s+[|–-]\s+/)[0].trim();
    }
    if (!title) title = titleFromUrl(url);
    if (!title) return null;

    // Skippa sidor vars titel matchar blacklist (cookie-banners, trafikinfo etc)
    if (DEFAULT_TITLE_BLACKLIST.some(re => re.test(title))) return null;

    // 1) Strukturerade datumkällor (microdata + <time datetime>)
    let startDate: Date | null = null;
    let hasSpecificTime = false;
    const microStr =
        $('[itemprop="startDate"]').attr('content') ||
        $('[itemprop="startDate"]').attr('datetime') ||
        $('time[itemprop="startDate"]').attr('datetime') ||
        $('meta[itemprop="startDate"]').attr('content') ||
        $('time[datetime]').first().attr('datetime') || '';
    if (microStr) {
        const d = new Date(microStr);
        if (!isNaN(d.getTime())) {
            startDate = d;
            // ISO med tid (innehåller "T") räknas som specifik tid
            hasSpecificTime = /T\d{2}:\d{2}/.test(microStr);
        }
    }

    // 2) Svensk text-fallback — skanna body-text efter datumtext
    if (!startDate) {
        // Prioritera text nära header/event-info, fall sedan tillbaka till hela body
        const candidateText = [
            $('.event-info, .event-date, .event-date-time, #event-dates-list, .evenemang-datum, .datum, .date').text(),
            $('main, article, .content').first().text(),
            $('body').text(),
        ].join('\n').slice(0, 5000); // cap för parser-prestanda
        const parsed = findFirstDateInText(candidateText);
        if (parsed) {
            startDate = parsed;
            // hasSpecificTime: gissa via om datumet har tid != 00:00 lokalt
            hasSpecificTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
        }
    }

    if (!startDate) return null;

    const description =
        ($('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') || '').trim();
    const imageUrl = $('meta[property="og:image"]').attr('content') || undefined;
    const venueName =
        $('[itemprop="location"] [itemprop="name"]').first().text().trim() ||
        $('.event-location, .plats, .location, .venue').first().text().trim() ||
        undefined;

    return {
        title,
        startDate,
        url,
        description: description || undefined,
        imageUrl,
        venueName,
        city: defaultCity,
    };
}

/**
 * Försök extrahera en RawEvent från en detalj-sida. JSON-LD först, cheerio
 * som fallback.
 */
function extractFromHtml(html: string, url: string, defaultCity?: string): RawEvent | null {
    // 1) JSON-LD
    const blocks = extractJsonLdBlocks(html);
    const nodes: any[] = [];
    for (const b of blocks) collectEvents(b, DEFAULT_EVENT_TYPES, nodes);
    for (const node of nodes) {
        const ev = jsonLdToRawEvent(node, url);
        if (ev) {
            if (!ev.city && defaultCity) ev.city = defaultCity;
            return ev;
        }
    }
    // 2) Cheerio-fallback
    return cheerioFallback(html, url, defaultCity);
}

async function pMap<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
    const queue = items.slice();
    const out: R[] = [];
    const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
        while (queue.length > 0) {
            const it = queue.shift();
            if (it === undefined) break;
            out.push(await fn(it));
        }
    });
    await Promise.all(workers);
    return out;
}

/**
 * Tröskel för early-exit: aktiveras opt-in via `aggressiveEarlyExit: true`
 * i config. Default OFF för att inte tappa events från sajter där lastmod
 * inte korrelerar med event-datum (många svenska kommun-sajter).
 *
 * Aktivera den på enskilda källor som har ÖVER ~500 URL:er och där tester
 * visar att lastmod-sortering är pålitlig.
 */
const EARLY_EXIT_CONSECUTIVE_OUTSIDE = 100;
const EARLY_EXIT_MIN_FETCHED = 80;

export const sitemapEngine = async (
    config: SitemapConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const entries = await discoverEntries(config, ctx);
    if (entries.length === 0) return [];

    const concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
    let extracted = 0;
    let failed = 0;
    let noEvent = 0;
    let fetched = 0;
    let consecutiveOutside = 0;
    let aborted = false;

    const events: (RawEvent | null)[] = [];
    const queue = entries.slice();

    async function worker() {
        while (queue.length > 0 && !aborted) {
            const entry = queue.shift();
            if (!entry) break;
            const html = await fetchText(entry.url, config, ctx.signal);
            fetched++;
            if (!html) { failed++; events.push(null); continue; }
            const ev = extractFromHtml(html, entry.url, config.defaultCity);
            if (!ev) { noEvent++; events.push(null); continue; }
            extracted++;
            events.push(ev);

            // Early-exit-detektor: aktiveras endast om aggressiveEarlyExit är på.
            // När vi sett N URL:er i rad utanför fönster antar vi att resten är
            // arkivdata och avbryter.
            if (config.aggressiveEarlyExit) {
                const inWindow = ev.startDate >= ctx.windowStart && ev.startDate <= ctx.windowEnd;
                if (inWindow) {
                    consecutiveOutside = 0;
                } else {
                    consecutiveOutside++;
                    if (
                        fetched >= EARLY_EXIT_MIN_FETCHED &&
                        consecutiveOutside >= EARLY_EXIT_CONSECUTIVE_OUTSIDE
                    ) {
                        aborted = true;
                        ctx.log(`sitemap: early-exit efter ${fetched} URL:er (${consecutiveOutside} utanför fönster i rad)`);
                    }
                }
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, entries.length) }, () => worker());
    await Promise.all(workers);

    const exitNote = aborted ? ` [early-exit ${fetched}/${entries.length}]` : '';
    ctx.log(`sitemap: ${extracted} events extraherade (${failed} fetch-fel, ${noEvent} utan event-struktur)${exitNote}`);
    return events.filter((e): e is RawEvent => e !== null);
};
