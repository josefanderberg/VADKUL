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
import type { Browser } from 'puppeteer';
import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { extractJsonLdBlocks, collectEvents, jsonLdToRawEvent, DEFAULT_EVENT_TYPES } from './json-ld';
import { findFirstDateInText } from '../../utils/swedishDate';
import { decodeHtmlEntities } from '../../utils/text';
import { extractStreetAddress } from '../../utils/swedishAddress';
import { isInNordic } from '../../utils/venueCoordinates';

const gunzip = promisify(zlib.gunzip);

/**
 * Lazy-loaded Puppeteer-browser för SPA-sajter. Delas av alla sitemap-källor
 * med useBrowser=true i denna process. Sparar startup-tid + minne.
 */
let _sitemapBrowser: Browser | null = null;
async function getSitemapBrowser(): Promise<Browser> {
    if (_sitemapBrowser) return _sitemapBrowser;
    const puppeteer = await import('puppeteer');
    _sitemapBrowser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    return _sitemapBrowser;
}

export async function closeSitemapBrowser(): Promise<void> {
    if (_sitemapBrowser) { await _sitemapBrowser.close(); _sitemapBrowser = null; }
}

export interface SitemapConfig {
    /**
     * URL till sitemap.xml ELLER en HTML-katalog-sida.
     * När `isHtmlCatalog: true`, behandlas sitemapUrl som HTML och vi extraherar
     * <a href>-länkar som matchar urlPatterns. Användbart för sajter som inte
     * exponerar individuella event-URLs i sin XML-sitemap (Visit Lund m.fl.).
     */
    sitemapUrl: string;
    /** Om true: behandla sitemapUrl som HTML-katalog, inte XML-sitemap. */
    isHtmlCatalog?: boolean;
    /**
     * Om true: sitemapUrl är ett JSON-svar (sök-API) — alla citerade URL-
     * strängar i svaret blir kandidater (urlPatterns filtrerar). Katalog-
     * fetchen skickar X-Requested-With: XMLHttpRequest (content-negotiation).
     */
    isJsonCatalog?: boolean;
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
     * Plats-endpoint: [sökmönster, ersättning] som mappar event-URL → en
     * separat plats-sida (Kulturbiljetter: /evenemang/<id>/ → /evenemang/map/<id>/).
     * Hämtas BARA när eventet saknar venue efter ordinarie extraktion; parsas
     * efter <h3>Venue / Stad</h3> + adress-<p> (svensk postnummer-signatur).
     */
    placeUrlReplace?: [RegExp, string];
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
    /**
     * Använd Puppeteer för att hämta detalj-sidor. Krävs för SPAer där
     * event-datum/titel renderas av JavaScript (Visit Dalarna, Falkenberg,
     * Hedemora m.fl. — sidor som returnerar "skal" via curl).
     *
     * VARNING: ~10-20x långsammare per sida. Sätt bara där det behövs.
     * Sitemap-fetching använder fortfarande vanlig fetch (sitemaps är XML).
     */
    useBrowser?: boolean;
    /** Vänta så här länge efter networkidle2 innan vi läser DOM (default 2000ms) */
    browserSettleMs?: number;
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
    // Kommun-sajt site-namn fångas ofta som JSON-LD WebPage-titel
    /\bkommuns?\s+webbplats\b/i,
    /\bofficiella?\s+webbplats\b/i,
    // Trafikinformation i titel (specifika mönster — bredare "avstängd" är
    // för risky då legitima event kan nämna det)
    /^trafikstart/i,
    /^\d+\s+(parkering|p-plats|p-rute)/i,
    /\bv[äa]g(en|s|arna)?\s+avst[äa]ngd/i,
];

const DEFAULT_MAX_URLS = 300;
const DEFAULT_MAX_SUB_SITEMAPS = 10;
const DEFAULT_TIMEOUT = 30000;  // höjt från 15s — stora sitemap-XML (1.7MB+) tar tid
const DEFAULT_CONCURRENCY = 6;

/**
 * Hämta sida via Puppeteer — för SPAer där JS-rendering är nödvändig.
 */
async function fetchRenderedHtml(url: string, cfg: SitemapConfig): Promise<string | null> {
    await domainLimiter.wait(url);
    const browser = await getSitemapBrowser();
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent(cfg.userAgent ?? DEFAULT_UA);
        // Blockera bilder/fonter/media för snabbhet — vi vill bara HTML
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: cfg.timeoutMs ?? 30000 });
        await new Promise((r) => setTimeout(r, cfg.browserSettleMs ?? 2000));
        return await page.content();
    } catch {
        return null;
    } finally {
        await page.close();
    }
}

/**
 * Hämta text från URL med retry (via fetchWithRetry) + transparent gzip-stöd.
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
    const isGzUrl = url.toLowerCase().endsWith('.gz');
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                // OBS: */* måste vara med — utan den ger Studiefrämjandet 406.
                'Accept': 'text/html,application/xml,application/xhtml+xml,application/gzip,*/*;q=0.1',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
                // JSON-kataloger (Studiefrämjandets kurssök) content-förhandlar
                // på XHR-headern: med den svarar samma URL med JSON i stället
                // för HTML-skalet. Sätts bara för själva katalog-fetchen.
                ...(cfg.isJsonCatalog && url === cfg.sitemapUrl
                    ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
            },
            redirect: 'follow',
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? DEFAULT_TIMEOUT, label: url });

        if (!res.ok) return null;

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
    } catch {
        return null;
    }
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
/**
 * Plocka ut <a href>-länkar ur en HTML-katalog-sida som ofta listar event-
 * detaljsidor som länkar (utan att exponera dem i sitemap.xml).
 *
 * Fångar även RSS-flöden: `<link>https://…/evenemang/foo</link>` (länken ligger
 * i element-innehållet, inte i href). Lunds universitets kalender exponerar bara
 * sina event så här — detaljsidan har sen svensk text-datum som plockas vidare.
 * RSS-mönstret kräver innehåll MELLAN taggarna, så HTML:ens self-closing
 * `<link rel=stylesheet href=…>` matchas aldrig av misstag.
 */
function extractLinksFromHtml(html: string, baseUrl: string): SitemapEntry[] {
    const out: SitemapEntry[] = [];
    const seen = new Set<string>();
    const push = (raw: string) => {
        let href = raw.trim();
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        try { href = new URL(href, baseUrl).toString(); } catch { return; }
        if (seen.has(href)) return;
        seen.add(href);
        out.push({ url: href });
    };
    const aRe = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = aRe.exec(html)) !== null) push(m[1]);
    const rssRe = /<link>\s*(https?:\/\/[^<\s]+)\s*<\/link>/gi;
    while ((m = rssRe.exec(html)) !== null) push(m[1]);
    return out;
}

async function discoverEntries(cfg: SitemapConfig, ctx: EngineContext): Promise<SitemapEntry[]> {
    // JS-renderad katalogsida: rendera den med Puppeteer så event-länkarna (som
    // injiceras av JS) blir synliga. Kräver isHtmlCatalog + useBrowser.
    const root = (cfg.isHtmlCatalog && cfg.useBrowser)
        ? await fetchRenderedHtml(cfg.sitemapUrl, cfg)
        : await fetchText(cfg.sitemapUrl, cfg, ctx.signal);
    if (!root) {
        ctx.log(`sitemap: kunde inte hämta ${cfg.sitemapUrl}`);
        return [];
    }

    let candidates: SitemapEntry[] = [];

    if (cfg.isJsonCatalog) {
        // JSON-katalog (sök-API:er à la Studiefrämjandets kurssök): plocka ALLA
        // citerade sträng-värden som ser ut som URL:er/paths — urlPatterns-
        // filtret nedströms avgör vilka som är event-sidor.
        const seen = new Set<string>();
        for (const m of root.matchAll(/"((?:https?:\/\/|\/)[^"\\\s]{4,300})"/g)) {
            let href = m[1];
            try { href = new URL(href, cfg.sitemapUrl).toString(); } catch { continue; }
            if (!seen.has(href)) { seen.add(href); candidates.push({ url: href }); }
        }
        ctx.log(`json-katalog: ${candidates.length} URL-kandidater hittade`);
    } else if (cfg.isHtmlCatalog) {
        candidates = extractLinksFromHtml(root, cfg.sitemapUrl);
        ctx.log(`html-katalog: ${candidates.length} länkar hittade`);
    } else if (isSitemapIndex(root)) {
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
    const matchingRaw = candidates.filter(e =>
        cfg.urlPatterns.some(re => re.test(e.url))
    );
    // Dedup identiska loc-URL:er — vissa sitemaps listar samma sida flera ggr
    // (t.ex. ALV: varje föreställning 3×). Behåll första (med ev. lastmod).
    const seenUrls = new Set<string>();
    const matching = matchingRaw.filter(e => {
        if (seenUrls.has(e.url)) return false;
        seenUrls.add(e.url);
        return true;
    });

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

/**
 * Sidans "chrome" (meny, sidhuvud/-fot, cookie-banner) bortplockad — bara
 * innehållet kvar. Används som datum-textkandidat på sajter utan semantiska
 * <main>/<article>-taggar, där menyn annars kommer först i body-texten.
 * <header> lämnas kvar: många artiklar lägger datumet i sitt eget artikel-
 * huvud, och navigationen fångas ändå av nav/meny-selektorerna.
 */
function stripChrome(html: string): string {
    const $c = cheerio.load(html);
    $c('script, style, noscript, nav, [role="navigation"], footer, .site-footer, '
        + '.menu, .main-menu, .nav-menu, .navbar, .breadcrumb, .breadcrumbs, .cookie, .cookies').remove();
    return $c('body').text();
}

function cheerioFallback(html: string, url: string, defaultCity?: string): RawEvent | null {
    const $ = cheerio.load(html);
    // Title-fallback: h1 → og:title → <title> → URL-slug (avlägsna sajtnamnet).
    // Multi-h1-sidor (Kalmar läns museum: h1#1 = sajtloggan, h1#2 = eventtiteln)
    // gjorde att .first() gav SAJTNAMNET på alla event — därför vinner den h1
    // som matchar sidtitelns första segment (og:title/<title> före " - Sajt").
    const ogTitle = ($('meta[property="og:title"]').attr('content') || '').trim();
    const docTitle = ($('title').first().text() || '').trim();
    const titleParts = (ogTitle || docTitle).split(/\s+[|–-]\s+/).map(s => s.trim());
    const pageName = (titleParts[0] || '').toLowerCase();
    // Sajtnamnet = svans-segmentet ("Eventtitel - Kalmar läns museum") — en h1
    // som ÄR sajtnamnet (logga-h1) får aldrig vinna som fallback.
    const siteName = (titleParts.length > 1 ? titleParts[titleParts.length - 1] : '').toLowerCase();
    let title = '';
    $('h1').each((_i, el) => {
        const t = $(el).text().replace(/\s+/g, ' ').trim();
        if (!t) return;
        const tl = t.toLowerCase();
        if (!title && tl !== siteName) title = t;   // första icke-logga som fallback
        if (pageName && tl === pageName) { title = t; return false; }
    });
    if (!title) title = ogTitle;
    if (!title) title = docTitle.split(/\s+[|–-]\s+/)[0].trim();
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

    // 1b) Zonlöst attribut som egentligen är UTC. Vissa sajter (landskrona.se
    //     m.fl. React-renderade) skriver UTC i datetime men LOKAL tid i texten:
    //         <time datetime="2026-07-29T17:00">29 juli 2026 19:00</time>
    //     new Date() tolkar en zonlös sträng som LOKAL tid → hela sajtens
    //     events hamnade två timmar för tidigt ("Film i parken" kl 17 istället
    //     för 19). Vi rör bara datumet när textens klockslag är EXAKT det som
    //     attributet ger om det läses som UTC — då vet vi att attributet är
    //     UTC. Sajter där attribut och text redan stämmer lämnas orörda.
    if (startDate && hasSpecificTime && !/(?:Z|[+-]\d{2}:?\d{2})$/.test(microStr)) {
        const textClock = $(`time[datetime="${microStr}"]`).first().text()
            .match(/\b(\d{1,2})[:.](\d{2})\b/);
        if (textClock) {
            const asUtc = new Date(`${microStr}Z`);
            if (!isNaN(asUtc.getTime()) &&
                asUtc.getHours() === parseInt(textClock[1], 10) &&
                asUtc.getMinutes() === parseInt(textClock[2], 10)) {
                startDate = asUtc;
            }
        }
    }

    // 2) Svensk text-fallback — skanna body-text efter datumtext.
    //    Körs när (a) ingen strukturerad datum hittades, ELLER (b) den
    //    strukturerade datumen ligger i DET FÖRFLUTNA. Många SiteVision-
    //    kommuner sätter <time datetime> till sidans PUBLICERINGSdatum, inte
    //    event-datumet: t.ex. Höganäs "Arilds Jazzfestival" hade
    //    time=2026-01-13 (publicerad) men eventet är 1 augusti 2026 enligt
    //    brödtexten. Utan detta föll ~100 SiteVision-kommuner bort som
    //    "outside window" för att deras sommarevents fick januari-datum.
    const structuredIsPast = startDate !== null && startDate.getTime() < Date.now();
    if (!startDate || structuredIsPast) {
        // Prioritera text nära header/event-info, fall sedan tillbaka till hela body
        const candidateText = [
            $('.event-info, .event-date, .event-date-time, #event-dates-list, .evenemang-datum, .datum, .date').text(),
            $('main, article, .content').first().text(),
            // Meny-strippad body FÖRE den orörda: sajter utan <main>/<article>
            // (Kalmar Slott m.fl.) har hundratals menylänkar före brödtexten,
            // och de åt upp hela teckenbudgeten innan "Tid 18 februari kl 19.00"
            // hanns med → 0 event trots att datumet stod på sidan.
            stripChrome(html),
            $('body').text(),
        ].join('\n').slice(0, 8000); // cap för parser-prestanda
        const parsed = findFirstDateInText(candidateText);
        if (parsed) {
            // Om vi inte hade något strukturerat datum: använd text rakt av.
            // Om det strukturerade var förflutet: föredra text BARA om den ger
            // ett framtida datum (annars är eventet genuint passerat och ska
            // filtreras bort av fönstret som vanligt).
            if (!startDate || (structuredIsPast && parsed.getTime() >= Date.now())) {
                startDate = parsed;
                hasSpecificTime = parsed.getHours() !== 0 || parsed.getMinutes() !== 0;
            }
        }
    }

    if (!startDate) return null;

    // Om datumet saknar specifik tid (midnatt), leta efter ett fristående HH:MM.
    // Visit Linköping m.fl. lägger datum och tid i SKILDA <time>-element, så
    // <time>.first() ovan ger bara datumet — tiden ligger i ett separat element.
    // Kolla BÅDE lokal och UTC midnatt: date-only "YYYY-MM-DD" parsas som
    // UTC-midnatt (= lokalt 02:00), så enbart getHours()===0 missar dem.
    const lacksTime =
        (startDate.getHours() === 0 && startDate.getMinutes() === 0) ||
        (startDate.getUTCHours() === 0 && startDate.getUTCMinutes() === 0);
    if (lacksTime) {
        const cands: { h: number; m: number }[] = [];
        const push = (h: number, m: number) => { if (h <= 23 && m <= 59) cands.push({ h, m }); };
        // 1. Fristående <time>-element med bara HH:MM (Visit Linköping m.fl.)
        $('time[datetime]').each((_i, el) => { const v = ($(el).attr('datetime') || '').match(/^(\d{1,2})[:.](\d{2})$/); if (v) push(+v[1], +v[2]); });
        $('time').each((_i, el) => { const v = $(el).text().trim().match(/^(\d{1,2})[:.](\d{2})$/); if (v) push(+v[1], +v[2]); });
        // 2. "kl HH:MM" eller bara HH.MM i HUVUDINNEHÅLLET (ej footer/nav) — venues
        //    (Nalen/Norrlandsoperan/Pustervik) lägger showtiden i renderad brödtext.
        //    Saknar sajten semantiska taggar (Louis De Geer m.fl. — varken
        //    <main>, <article> eller .content finns) blev strängen tom och ALLA
        //    konserter fick midnatt/heldag trots att "20:00" stod på sidan.
        //    Då: meny-strippad text ANKRAD vid rubriken, så vi läser eventets
        //    egen ingress och inte husets öppettider längre upp på sidan.
        const semantic = $('main, article, .content, .event-info, .single-event, .program, .evenemang').first().text();
        let content = (semantic || '').slice(0, 4000);
        if (!content.trim()) {
            const stripped = stripChrome(html).replace(/\s+/g, ' ');
            const anchor = stripped.indexOf(title.replace(/\s+/g, ' ').slice(0, 40));
            content = stripped.slice(anchor >= 0 ? anchor : 0, (anchor >= 0 ? anchor : 0) + 2500);
        }
        for (const mt of content.matchAll(/(?:kl[.\s]*)?\b(\d{1,2})[:.](\d{2})\b/gi)) push(parseInt(mt[1], 10), parseInt(mt[2], 10));
        if (cands.length) {
            // Heuristik: kvällstid (>=17) först (konserter); annars tidigaste kronologiskt.
            const evening = cands.find(c => c.h >= 17);
            const pick = evening || cands.slice().sort((a, b) => (a.h * 60 + a.m) - (b.h * 60 + b.m))[0];
            startDate.setHours(pick.h, pick.m, 0, 0);
        }
    }

    // decodeHtmlEntities: cheerio avkodar EN nivå — dubbelkodade sajter
    // (goteborg.com m.fl.) lämnar annars "&#8211;" synligt i texten.
    const description = decodeHtmlEntities(
        ($('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') || '').trim());
    const imageUrl = $('meta[property="og:image"]').attr('content') || undefined;
    // Key/value-metadata ("Plats" → värde) — Episerver-sajter (Studiefrämjandet
    // m.fl.) lägger platsen i c-articlemeta-par utan microdata. #placeItem är
    // Studiefrämjandets id; key-matchningen tar generiska nyckel/värde-listor.
    let kvPlats = $('#placeItem').first().text().trim();
    if (!kvPlats) {
        $('[class*="__key"], dt').each((_i, el) => {
            if ($(el).text().trim().toLowerCase() === 'plats') {
                kvPlats = $(el).next('[class*="__value"], dd').first().text().trim();
                return false;
            }
        });
    }
    const venueName =
        $('[itemprop="location"] [itemprop="name"]').first().text().trim() ||
        (kvPlats && kvPlats.toLowerCase() !== 'sverige' ? kvPlats : '') ||
        $('.event-location, .plats, .location, .venue').first().text().trim() ||
        undefined;

    // Gatuadress ur microdata/vanliga adress-element (regex-fallbacken för
    // båda extraktions-vägarna ligger i fallbackAddress nedan).
    // OBS: har sidan ett [itemprop="location"]-scope måste streetAddress läsas
    // DÄRIFRÅN — oscopad .first() träffar annars footer-microdata (Ticksters
    // LocalBusiness "Magasinsgatan 8" förgiftade 695 events extractedAddress).
    const locScope = $('[itemprop="location"]');
    let address =
        locScope.find('[itemprop="streetAddress"]').first().text().trim() ||
        (locScope.find('[itemprop="streetAddress"]').first().attr('content') || '').trim() ||
        (locScope.length === 0
            ? ($('[itemprop="streetAddress"]').first().text().trim() ||
                ($('[itemprop="streetAddress"]').first().attr('content') || '').trim())
            : '') ||
        $('.event-address, .adress, .address, .street-address').first().text().trim() ||
        undefined;
    if (address && address.length > 120) address = undefined;  // skräp-skydd

    return {
        title,
        startDate,
        url,
        description: description || undefined,
        imageUrl,
        venueName,
        address,
        city: defaultCity,
    };
}

/**
 * Försök extrahera en RawEvent från en detalj-sida. JSON-LD först, cheerio
 * som fallback.
 */
/**
 * Plockar HH:MM ur en `?startTime=HH:MM`-query. Vissa kalender-CMS:er (t.ex.
 * Mölndals) lägger den specifika förekomstens tid i URL-queryn medan sidan
 * bara visar serie-info. Returnerar null om ingen giltig tid finns.
 */
function timeFromUrlQuery(url: string): { h: number; m: number } | null {
    const m = url.match(/[?&]startTime=(\d{1,2})[:.](\d{2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return { h, m: min };
}

/**
 * Om eventet saknar specifik tid (midnatt) men URL:en har ?startTime=HH:MM,
 * applicera den på datumet. Datumet bevaras — bara klockan sätts.
 */
function applyUrlTime(ev: RawEvent, url: string): void {
    const d = ev.startDate;
    if (!d) return;
    const isMidnight =
        (d.getHours() === 0 && d.getMinutes() === 0) ||
        (d.getUTCHours() === 0 && d.getUTCMinutes() === 0);
    if (!isMidnight) return;
    const t = timeFromUrlQuery(url);
    if (t) d.setHours(t.h, t.m, 0, 0);
}

/**
 * Regex-fallback för gatuadress över sidans text — körs när varken JSON-LD
 * eller microdata gav någon. "Adress:/Besöksadress:"-etikett föredras,
 * annars första svenska gatuadressen i texten. Runnern geokodar adress före
 * venue-namn, så detta avgör ofta om eventet hamnar på rätt hus eller på
 * stadens mittpunkt.
 */
function fallbackAddress(html: string): string | undefined {
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000);
    const labelled = text.match(/(?:besöksadress|adress)\s*:\s*([^.|]{5,80})/i);
    return extractStreetAddress(labelled?.[1]) ?? extractStreetAddress(text) ?? undefined;
}

/**
 * Fyll TOMMA fält ur sidans HTML — additivt komplement till JSON-LD/cheerio.
 * Körs för BÅDA extraktions-vägarna men BARA när ett fält saknas, så friska
 * events aldrig skrivs över och cheerio-parsen hoppas helt när allt redan finns.
 *
 * Täcker källor där strukturerad data är ofullständig:
 *   - Malmö Pride: JSON-LD Event utan description → og:description
 *   - Ale (SiteVision): ingen og alls → första rejäla <p> + content-<img>
 *   - Västervik: hero ligger i CSS background-image, ingen og:image
 */
function backfillFromHtml(html: string, ev: RawEvent, pageUrl: string): void {
    const needsDesc = !ev.description || ev.description.trim().length < 20;
    const needsImg = !ev.imageUrl;
    if (!needsDesc && !needsImg) return;

    const $ = cheerio.load(html);

    if (needsDesc) {
        let d = decodeHtmlEntities($('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') || '')
            .replace(/\s+/g, ' ').trim();
        // Squarespace-platshållare ("Date: Time: Place: …") är ingen beskrivning
        if (/^date:\s*time:/i.test(d)) d = '';
        if (d.length < 20) {
            // Ale m.fl. utan og: ta första rejäla brödtext-stycket i huvudinnehållet.
            // OBS: sök över ALLA innehålls-containrar — .first() på container-listan
            // fastnade på en tom .content/portlet före <main> (Katrineholm) och
            // gav upp trots att brödtexten fanns längre ner i dokumentet.
            $('main p, article p, .content p, .sv-text-portlet p').each((_i, el) => {
                const t = $(el).text().replace(/\s+/g, ' ').trim();
                if (t.length >= 40) { d = t; return false; }
            });
        }
        if (d.length >= 20) ev.description = d.slice(0, 600);
    }

    if (needsImg) {
        let img = ($('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') || '').trim();
        if (!img) {
            // Västervik m.fl.: hero i inline style="background-image:url('…')"
            $('[style*="background-image"]').each((_i, el) => {
                const m = ($(el).attr('style') || '').match(/background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i);
                if (m) { img = m[2]; return false; }
            });
        }
        if (!img) {
            // Ale (SiteVision): content-<img> i main/article — ej logo/ikon/emoji/svg
            $('main img, article img').each((_i, el) => {
                const src = ($(el).attr('src') || $(el).attr('data-src') || '').trim();
                if (src && !/logo|icon|emoji|sprite|placeholder|pixel|avatar|\.svg(\?|$)/i.test(src)) { img = src; return false; }
            });
        }
        if (img) {
            try { img = new URL(img, pageUrl).href; } catch { /* behåll som-är */ }
            if (!/emoji\.php|static\.xx\.fbcdn/i.test(img)) ev.imageUrl = img;  // skippa FB-emoji-pixlar
        }
    }
}

/**
 * Koordinater + ort ur kart-länkar och microdata — additivt komplement som
 * BARA fyller tomma fält (samma kontrakt som backfillFromHtml).
 *
 * Tickster (1400+ framtida event) saknar JSON-LD men exponerar EXAKTA
 * koordinater i en Google Maps-länk på varje detaljsida:
 *   https://www.google.com/maps/search/?api=1&query=57.657,12.5106
 * samt samma koordinater i en staticmap-URL (…?center=57.657,12.5106…).
 * Utan detta föll ~46% av Tickster-eventen bort ur kartan: venue-namn utan
 * ort ("Sängfabriken", "Teatergläntan") geokodar inte i Nominatim.
 *
 * Orten ligger som schema.org-microdata. OBS: selektorn MÅSTE vara scopad
 * till [itemprop="location"] — Ticksters footer har egen LocalBusiness-
 * microdata med kontorsorter (Arvika/Göteborg) som annars läcker in.
 */
export function backfillPlaceFromHtml(html: string, ev: RawEvent): void {
    // 1) Koordinater ur kart-URL:er. Konservativ: kräver "map" i URL:en och
    //    ett lat,lng-par i query/center/q/ll/destination. Nordics-bounds-
    //    valideras så slumptal aldrig blir koordinater.
    if (!ev.coords) {
        const m = html.match(
            /https?:\/\/[^"'\s<>]*map[^"'\s<>]*?[?&](?:amp;)?(?:query|center|q|ll|destination)=(-?\d{1,2}\.\d+)(?:,|%2[cC])(-?\d{1,3}\.\d+)/i,
        );
        if (m) {
            const lat = parseFloat(m[1]);
            const lng = parseFloat(m[2]);
            if (isInNordic(lat, lng)) ev.coords = [lat, lng];
        }
    }
    // 2) Ort ur microdata (Tickster skriver den ibland gement: "karlstad").
    if (!ev.city) {
        const $ = cheerio.load(html);
        const raw = $('[itemprop="location"] [itemprop="addressLocality"]').first().text().trim();
        if (raw && raw.length <= 40 && !/\d/.test(raw)) {
            ev.city = raw.charAt(0).toUpperCase() + raw.slice(1);
        }
    }
    // 3) Schema-rader (regionteatern.se-mönstret, 2026-08-20): rubrik med
    //    svenskt datum följd av stycke "Venue, Stad | HH:MM | …":
    //      <h3>Fredag 28 augusti 2026</h3><p>Lokstallarna, Karlshamn | 20:00 | 45 min</p>
    //    Utan detta fick alla Regionteaterns event defaultCity (Växjö) och
    //    platshållartid — fast föreställningarna spelas i Karlshamn kl 20:00.
    //    Försiktighetsregler: klockslag bara från raden vars datum matchar
    //    eventets (eller när det bara finns en rad); stad/venue från matchande
    //    rad, annars bara när ALLA rader är eniga (turnéer får inte blandas).
    if (!ev.venueName || ev.hasSpecificTime !== true) {
        const $ = cheerio.load(html);
        const rows: { date: Date | null; venue: string; city: string; h: number; min: number }[] = [];
        $('h2, h3, h4').each((_i, el) => {
            const headText = $(el).text().replace(/\s+/g, ' ').trim();
            if (!headText || headText.length > 60) return;
            const date = findFirstDateInText(headText);
            if (!date) return;
            const p = $(el).nextAll('p').first().text().replace(/\s+/g, ' ').trim();
            const m = p.match(/^([^|]{2,60}?),\s*([A-ZÅÄÖ][A-Za-zåäöÅÄÖé -]{2,30}?)\s*\|\s*(\d{1,2})[:.](\d{2})\b/);
            if (!m) return;
            rows.push({ date, venue: m[1].trim(), city: m[2].trim(), h: parseInt(m[3], 10), min: parseInt(m[4], 10) });
        });
        if (rows.length) {
            const sameDay = ev.startDate instanceof Date
                ? rows.find(r => r.date && r.date.toDateString() === ev.startDate.toDateString())
                : undefined;
            const allSameCity = rows.every(r => r.city === rows[0].city);
            const allSameVenue = rows.every(r => r.venue === rows[0].venue);
            const cityPick = sameDay?.city ?? (allSameCity ? rows[0].city : undefined);
            const venuePick = sameDay?.venue ?? (allSameVenue ? rows[0].venue : undefined);
            if (venuePick && !ev.venueName) ev.venueName = venuePick;
            if (cityPick) ev.city = cityPick;   // radens stad slår defaultCity
            const timeRow = sameDay ?? (rows.length === 1 ? rows[0] : undefined);
            if (timeRow && ev.hasSpecificTime !== true && ev.startDate instanceof Date) {
                const d = new Date(ev.startDate);
                d.setHours(timeRow.h, timeRow.min, 0, 0);
                ev.startDate = d;
                ev.hasSpecificTime = true;
            }
        }
    }
}

/**
 * Parsa en separat PLATS-sida (se SitemapConfig.placeUrlReplace) och fyll
 * venue/adress/stad på eventet. Format (Kulturbiljetter):
 *   <h3>Mossbo fäbodar / Ovanåker</h3><p>Mossbo Fäbodar, Långhed, 822 92, Ovanåker</p>
 * Flera spelplatser → första behålls (serie-sidan listar alla datum ändå).
 * Exporterad för test.
 */
export function applyPlacePage(html: string, ev: RawEvent): void {
    const $ = cheerio.load(html);
    const h3 = $('h3').first().text().trim();
    if (h3) {
        const [venue, city] = h3.split('/').map(s => s.trim());
        if (venue && !ev.venueName) ev.venueName = venue;
        if (city && !ev.city) ev.city = city;
    }
    if (!ev.address) {
        // Första <p> med svensk postnummer-signatur ("822 92") är adressen.
        $('p').each((_i, el) => {
            const t = $(el).text().replace(/\s+/g, ' ').trim();
            if (/\b\d{3} ?\d{2}\b/.test(t) && t.length <= 120) { ev.address = t; return false; }
        });
    }
}

function extractFromHtml(html: string, url: string, defaultCity?: string): RawEvent | null {
    // 1) JSON-LD
    const blocks = extractJsonLdBlocks(html);
    const nodes: any[] = [];
    for (const b of blocks) collectEvents(b, DEFAULT_EVENT_TYPES, nodes);
    let ev: RawEvent | null = null;
    for (const node of nodes) {
        const candidate = jsonLdToRawEvent(node, url);
        if (candidate) {
            // Title-blacklist gäller oavsett källa — JSON-LD-events kan också
            // ha junk-titlar ("Startsida", "Nyköpings kommuns webbplats" m.fl.)
            if (DEFAULT_TITLE_BLACKLIST.some(re => re.test(candidate.title))) return null;
            if (!candidate.city && defaultCity) candidate.city = defaultCity;
            ev = candidate;
            break;
        }
    }
    // 2) Cheerio-fallback
    if (!ev) ev = cheerioFallback(html, url, defaultCity);
    // 2b) Backfilla TOMMA desc/bild ur HTML — gäller BÅDA vägarna (JSON-LD med
    //     ofullständiga noder + cheerio-sidor utan og). Additivt, no-op när fullt.
    if (ev) backfillFromHtml(html, ev, url);
    // 3) Tid ur URL-query om sidan inte gav specifik tid (host-agnostiskt).
    if (ev) applyUrlTime(ev, url);
    // 3b) Koordinater + ort ur kart-länkar/microdata — BARA tomma fält fylls.
    //     Körs FÖRE adress-fallbacken så att sidor med exakta koordinater
    //     slipper regex-gissad adress (se gate nedan).
    if (ev) backfillPlaceFromHtml(html, ev);
    // 4) Adress-fallback ur sidtexten — för BÅDA vägarna (JSON-LD utan
    //    streetAddress är vanligt på kommunsajter). Skippas när sidan gav
    //    exakta koordinater: regexen tar första gatuadressen i sidtexten,
    //    vilket på t.ex. Tickster är footerns kontorsadress ("Magasinsgatan 8",
    //    Arvika) — fel adress som visas för användaren i eventkortet, utan
    //    att behövas för geokodning (coords vinner alltid i runnern).
    if (ev && !ev.address && !ev.coords) ev.address = fallbackAddress(html);
    return ev;
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
    let skippedKnown = 0;
    let consecutiveOutside = 0;
    let aborted = false;

    const events: (RawEvent | null)[] = [];
    const queue = entries.slice();

    // Puppeteer för SPAer — singleton browser, mindre concurrency för stabilitet
    const detailFetch = config.useBrowser
        ? (url: string) => fetchRenderedHtml(url, config)
        : (url: string) => fetchText(url, config, ctx.signal);

    async function worker() {
        while (queue.length > 0 && !aborted) {
            const entry = queue.shift();
            if (!entry) break;
            // Skip-känt: detaljsidan är dyraste steget (1,5s/domän rate-limit).
            // URL:er vi redan har i DB hoppas över — utom på full-refresh-
            // körningar (ctx.refreshKnown), där ändrade event ska fångas.
            if (!ctx.refreshKnown && ctx.isKnownUrl && (await ctx.isKnownUrl(entry.url))) {
                skippedKnown++;
                continue;
            }
            const html = await detailFetch(entry.url);
            fetched++;
            if (!html) { failed++; events.push(null); continue; }
            const ev = extractFromHtml(html, entry.url, config.defaultCity);
            if (!ev) { noEvent++; events.push(null); continue; }
            // Plats-endpoint (Kulturbiljetter-mönstret): separat kart-sida bär
            // venue/adress/stad som detaljsidan saknar. Bara vid venue-miss.
            if (config.placeUrlReplace && !ev.venueName && !ev.coords) {
                const [re, repl] = config.placeUrlReplace;
                const placeUrl = entry.url.replace(re, repl);
                if (placeUrl !== entry.url) {
                    const placeHtml = await detailFetch(placeUrl);
                    if (placeHtml) applyPlacePage(placeHtml, ev);
                }
            }
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
    const knownNote = skippedKnown > 0 ? `, ${skippedKnown} kända URL:er skippade före fetch` : '';
    ctx.log(`sitemap: ${extracted} events extraherade (${failed} fetch-fel, ${noEvent} utan event-struktur${knownNote})${exitNote}`);
    return events.filter((e): e is RawEvent => e !== null);
};
