/**
 * SiteVision-engine — scrapar kalender-sidor som drivs av SiteVision's
 * `se.soleil.eventListingLocal`-app. Många svenska kommuner använder den
 * (~150 av 290).
 *
 * DOM-mönstret är konsekvent:
 *   <a href="..."><h3>Eventtitel</h3></a>
 *   <time datetime="2026-06-02">2 juni – 31 januari</time>
 *
 * Strategin:
 *   1. Hämta kalender-URL (server-renderad)
 *   2. För varje `<time datetime>` hitta närliggande titel-länk
 *   3. Returnera RawEvent (datum, titel, url)
 *   4. Runnern kör fetchDetailPage-liknande på detalsidor om vi vill ha desc/img
 *
 * Config:
 *   urls:        string[]            — kalender-sidor (en eller flera)
 *   defaultCity: string              — sätts på events som saknar venue
 *   pathFilter?: string              — kräv att event-URL innehåller substring
 *   maxItems?:   number              — säkerhetsspärr, default 200
 *   userAgent?, timeoutMs?
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import * as cheerio from 'cheerio';
import { decodeHtmlEntities, truncateAtBoundary, DEFAULT_DESCRIPTION_MAX } from '../../utils/text';
import { findFirstDateInText } from '../../utils/swedishDate';
import { getSharedBrowser } from './sitemap';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SiteVisionConfig {
    urls: string[];
    defaultCity?: string;
    /**
     * Kort där rubriken är hopklistrad av kategorietikett + titel + venue
     * ("Evenemang Mareld - Piratlajv Berghems Lajvby, Skillingaryd" på
     * vaggeryd.se). `titleStripRe` tar bort etiketten, `stripVenueFromTitle`
     * kapar venue-svansen — venue extraheras separat och exakt, så svansen är
     * ren dubbelinformation. Båda är OPT-IN: default rör vi inte titeln.
     */
    titleStripRe?: RegExp;
    stripVenueFromTitle?: boolean;
    /**
     * Flerkommuns-källor (regionala eventguider): orterna källan täcker.
     * Venue-namnen bär orten i klartext ("Arboga bibliotek", "Mötesplats
     * Tallåsgården, Kungsör") — matchar ett namn i listan sätts det som city
     * i stället för defaultCity, så geokodningen inte drar allt till en ort.
     */
    cities?: string[];
    /**
     * Rendera kalendersidan i Puppeteer innan extraktionen. Flera kommuner
     * (Trollhättan, Botkyrka, Mark, Dals-Ed …) skickar en tom skal-HTML och
     * bygger korten i JS — utan detta ser motorn noll <time datetime>, trots
     * att sidan är full av datum i browsern. Delar browser-instans med
     * sitemap-motorn. Kostar ~3 s per URL; slå bara på när HTML-läget ger 0.
     */
    useBrowser?: boolean;
    /**
     * Filtrera bort kommunala sammanträden ur kalendern. Botkyrkas och Marks
     * kommunkalendrar blandar nämndmöten med publika event i samma lista.
     * OPT-IN: sitemap-motorn har en URL-blacklist för samma sak, men den
     * körs inte här och ~150 befintliga sitevision-källor ska inte påverkas.
     */
    dropMunicipalMeetings?: boolean;
    pathFilter?: string;
    maxItems?: number;
    userAgent?: string;
    timeoutMs?: number;
    /**
     * Hämta detaljsidan för event som saknar beskrivning och ta meta/og-
     * description. Kostar ett throttlat fetch per desc-löst event — slå bara
     * på för källor där list-korten är text-tomma (Strömsund, Svenljunga).
     */
    fetchDetailDesc?: boolean;
    /**
     * Soleil eventListingLocal:s JSON-API (upptäckt på malmo.se 2026-07-09):
     *   GET <origin>/appresource/<pageId>/<portletId>/items?start=0&num=100
     *   → { count, items: [{ title, url, desc, image, place[], dates:{date,time} }] }
     * När satt hämtas HELA kalendern via API:t istället för list-sidans HTML
     * (som bara server-renderar första dagens ~18 kort). pageId/portletId
     * sniffas ur "Visa fler"-knappens XHR (xhr-sniff.cjs — klicka och läs
     * /appresource/<pageId>/<portletId>/items?start=N).
     */
    itemsApi?: { pageId: string; portletId: string };
    /**
     * SiteVision RESTApp "Evenemang" (upptäckt på visiteskilstuna.se 2026-07-22):
     *   GET <url>/events?num=200&query=&count=0&page=N&type=event&timestamp=0
     *       &filters={"type":"event"}
     *   → { hits: [{ id, title, description, url, uri, image:{src,...},
     *                info:{ start:"YYYY-MM-DD HH:MM", end, location:{name,id} } }],
     *       searchInfo: { totalHits, ... } }
     * Param-signaturen ur Vue-bundelns query-builder (oe/de i app.*.js);
     * `filters` MÅSTE med, annars 500. API-bas-URL:en ligger i sidans
     * AppRegistry.registerInitialState-blob ("api"-nyckeln).
     */
    restApi?: { url: string };
    /**
     * Soleil se.soleilit.eventSearch:s JSON-API (upptäckt på kalmar.com 2026-07-27):
     *   GET <origin>/appresource/<pageId>/<portletId>/events
     *       ?fromDate=<ISO>&toDate=<ISO>&categories=&limit=500
     *   → { hitCount, hits: [{ name, URl, image, description, local, location,
     *        fullStartDate, fullEndDate, startTime, endTime, categories }] }
     * Obs fältet "URl" (sic). local = venue-namn, location = gatuadress.
     * Datumfönstret styrs av anropet — enginen använder ctx-fönstret.
     */
    eventSearchApi?: { pageId: string; portletId: string };
    /**
     * SiteVision "events-list"-webappens REST-API (upptäckt på
     * visiteskilstuna.se 2026-07-27):
     *   GET <origin><basePath>/events?count=0&filters=%7B%7D&page=N&query=&timestamp=<ms>
     *   → { hits: [{ title, url, description, image:{src}, info:{start,end,location:{name}} }],
     *       searchInfo: { totalHits } }
     * Pagineringen är KUMULATIV: page=N returnerar de första N*12 träffarna,
     * så en enda request med page=ceil(totalHits/12) hämtar allt.
     * timestamp-parametern krävs (utan den kastar servern JSONException).
     */
    guideApi?: { basePath: string };
    /**
     * SiteVision-webappens `/search`-route (upptäckt på visit.norrkoping.se
     * 2026-08-09):
     *   GET <listUrl>?filters=%7B%7D&query=&page=N
     *       &sv.<portletId>.route=%2Fsearch&sv.target=<portletId>&timestamp=<ms>
     *   Header: X-Requested-With: XMLHttpRequest   ← UTAN den svarar servern
     *   med hela HTML-sidan i stället för JSON (Accept: application/json räcker inte).
     *   → { searchHits: [{ id, title, summary, date, image, url, categories, type }],
     *       searchInfo: { totalHits, totalPages, currentPage } }
     *
     * Pagineringen är INTE kumulativ (10 träffar/sida) — alla sidor måste hämtas.
     * `date` är renderad svensk text ("9 aug", "13 mar 2027", "5 aug - 6 sep")
     * och saknar klockslag; en återkommande serie ger EN träff per tillfälle,
     * alla med samma url. Tid/plats/adress/koordinater finns bara på detaljsidan
     * → `fetchDetail` hämtar varje unik URL en gång (throttlat) och delar
     * resultatet mellan seriens tillfällen.
     */
    searchAppApi?: { portletId: string; fetchDetail?: boolean };
    /**
     * SiteVision-webappens `/page`-route (upptäckt på varmdo.se 2026-08-26):
     *   GET <origin>/appresource/<pageId>/<portletId>/page?p=<N>&f=&t=&c=&svAjaxReqParam=ajax
     *   Header: X-Requested-With: XMLHttpRequest
     *   → { hitCount, items: [{ displayName, URI, startDate, endDate, eventDate,
     *                           img, text, id }] }
     *
     * startDate/endDate är EPOCH-MILLISEKUNDER (inte ISO) och bär riktig tid.
     * 9 träffar/sida, p är 1-indexerad och INTE kumulativ — alla sidor krävs.
     * Samma app kör degerfors.se; c-parametern (kategori) utelämnas där.
     */
    pageApi?: { pageId: string; portletId: string };
    /**
     * SiteVision RESTApp "EventService" (Dalarna-mallen — vansbro.se,
     * morakommun.se, orsa.se, alvdalen.se; upptäckt 2026-08-26):
     *   GET <origin>/rest-api/EventService/items?start=0&num=200&paths=<nodId>
     *   → { categories, data: [{ name, uri, startDate, endDate, startTime,
     *       endTime, location, description, image:{uri}, identifier }],
     *       meta:{ totalItems } }
     *
     * `paths` är OBLIGATORISK (utan den svarar servern med ett felmeddelande)
     * och är arkivnodens id. Den står som `"paths":["3.…"]` intill
     * `"eventServiceRoute"` i kalendersidans registerInitialState-blob.
     *
     * FÄLLA: sidan listar även GRANNKOMMUNERNAS endpoints med deras paths —
     * ta rätt id, annars skrapar du fel kommun (och ofta ett gammalt arkiv).
     * `location` bär hela adressen ("Medborgarhuset, Norra Allégatan 30, 78631
     * Vansbro"), `startDate` är ISO med offset.
     */
    eventServiceApi?: { paths: string };
}

/** Rått item ur soleil items-API:t (bara fälten vi läser). */
interface SoleilItem {
    id?: string;
    title?: string;
    url?: string;
    desc?: string;
    image?: string;
    place?: string[];
    dates?: {
        date?: string;          // "2026-07-10"
        time?: string | null;   // "18:00" | null
        locations?: string[];
    };
}

/** "2026-07-10" + ev. "18:00" → lokal Date. Exporterad för test. */
export function parseSoleilDate(
    date: string | undefined,
    time: string | null | undefined,
): { date: Date; hasClock: boolean } | null {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const [y, mo, da] = date.split('-').map((n) => parseInt(n, 10));
    const clock = time && /^\d{1,2}[:.]\d{2}$/.test(time.trim()) ? time.trim().replace('.', ':') : null;
    const [hh, mi] = clock ? clock.split(':').map((n) => parseInt(n, 10)) : [0, 0];
    const d = new Date(y, mo - 1, da, hh, mi);
    if (isNaN(d.getTime())) return null;
    return { date: d, hasClock: !!clock };
}

/** Mappa ett soleil-item → RawEvent. Exporterad för test. */
export function mapSoleilItem(
    item: SoleilItem,
    baseUrl: string,
    defaultCity: string | undefined,
): RawEvent | null {
    const title = (item.title || '').trim();
    const parsed = parseSoleilDate(item.dates?.date, item.dates?.time);
    const eventUrl = makeAbsoluteUrl(item.url, baseUrl);
    if (!title || !parsed || !eventUrl) return null;

    const venueName = item.place?.find(Boolean)?.trim()
        || item.dates?.locations?.find(Boolean)?.trim()
        || undefined;

    return {
        externalId: item.id,
        title,
        startDate: parsed.date,
        url: eventUrl,
        venueName,
        city: defaultCity,
        description: item.desc?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(item.image, baseUrl),
        hasSpecificTime: parsed.hasClock ? true : undefined,
    };
}

/**
 * Städa en kort-rubrik som bär kategorietikett och/eller venue-svans.
 * Venue-svansen kapas bara om något meningsfullt blir kvar (≥6 tecken och
 * inte ett hängande förhållandeord) — annars var venue-namnet en del av
 * titeln på riktigt ("Konsert i Berghems Lajvby"). Exporterad för test.
 */
export function cleanCardTitle(
    title: string,
    venueName: string | undefined,
    opts: { titleStripRe?: RegExp; stripVenue?: boolean } = {},
): string {
    let t = title.replace(/\s+/g, ' ').trim();
    if (opts.titleStripRe) t = t.replace(opts.titleStripRe, '').trim();
    if (opts.stripVenue && venueName) {
        const v = venueName.replace(/\s+/g, ' ').trim();
        if (v && t.toLowerCase().endsWith(v.toLowerCase())) {
            const rest = t.slice(0, t.length - v.length).replace(/[\s,–—-]+$/, '').trim();
            if (rest.length >= 6 && !/\b(i|på|vid|hos|med|till|från|och|för)$/i.test(rest)) t = rest;
        }
    }
    return t;
}

/**
 * Vilken ort hör eventet till? Regionala guider bär orten i venue-namnet.
 * Längsta träffen vinner ("Västra Ämtervik" före "Ämtervik"). Exporterad för test.
 */
/**
 * Kommunalt sammanträde snarare än publikt event? Matchar på titel ELLER URL
 * (sluggen bär oftast samma ord). "nämnden" matchas UTAN inledande ordgräns —
 * nämnderna heter nästan alltid något sammansatt ("utbildningsnämnden",
 * "socialnämnden"), men den bestämda ändelsen krävs så att "benämnd" går fri.
 * Exporterad för test.
 */
export function isMunicipalMeeting(title: string, url = ''): boolean {
    const hay = `${title} ${url}`.toLowerCase();
    return /sammantr(a|ä)d|kommunfullm(a|ä)ktige|kommunstyrelse|n(a|ä)mnd(en|er|ens)\b|\bn(a|ä)mnd\b|styrelsem(o|ö)te|(a|å)rsm(o|ö)te|protokoll|\butskott\b/.test(hay);
}

export function pickCityFromVenue(
    venueName: string | undefined,
    cities: string[] | undefined,
    defaultCity: string | undefined,
): string | undefined {
    if (!venueName || !cities?.length) return defaultCity;
    const hay = venueName.toLowerCase();
    let best: string | undefined;
    for (const c of cities) {
        if (!hay.includes(c.toLowerCase())) continue;
        if (!best || c.length > best.length) best = c;
    }
    return best ?? defaultCity;
}

/** Rått hit ur RESTApp-API:t (bara fälten vi läser). */
interface RestAppHit {
    id?: string;
    title?: string;
    description?: string;
    url?: string;
    uri?: string;
    image?: { src?: string; mediumSrc?: string };
    info?: {
        start?: string;     // "2026-07-24 18:00"
        end?: string;
        location?: { name?: string; id?: string };
    };
}

/**
 * "YYYY-MM-DD HH:MM" → lokal Date. Klockan "00:00" behandlas som datum-utan-
 * tid (8/556 vid upptäckt var heldags-/periodevent). Exporterad för test.
 */
export function parseRestAppDate(
    raw: string | undefined,
): { date: Date; hasClock: boolean } | null {
    const m = raw?.trim().match(/^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?$/);
    if (!m) return null;
    const time = m[2] && m[2] !== '00:00' ? m[2] : null;
    return parseSoleilDate(m[1], time);
}

/** Mappa ett RESTApp-hit → RawEvent. Exporterad för test. */
export function mapRestAppHit(
    hit: RestAppHit,
    baseUrl: string,
    defaultCity: string | undefined,
    cities?: string[],
): RawEvent | null {
    const title = (hit.title || '').trim();
    const parsed = parseRestAppDate(hit.info?.start);
    const eventUrl = hit.url || makeAbsoluteUrl(hit.uri, baseUrl);
    if (!title || !parsed || !eventUrl) return null;

    const end = parseRestAppDate(hit.info?.end);
    const venueName = hit.info?.location?.name?.trim() || undefined;
    const isDigital = !!venueName && /^digitalt/i.test(venueName);
    const city = pickCityFromVenue(venueName, cities, defaultCity);

    return {
        externalId: hit.id,
        title,
        startDate: parsed.date,
        endDate: end && end.date.getTime() >= parsed.date.getTime() ? end.date : undefined,
        url: eventUrl,
        venueName,
        city,
        // "Digitalt evenemang" är ingen geocodebar plats — ankra på staden.
        geocodeCandidates: isDigital && city ? [city] : undefined,
        description: hit.description?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(hit.image?.src || hit.image?.mediumSrc, baseUrl),
        hasSpecificTime: parsed.hasClock ? true : undefined,
    };
}

/** Paginera igenom RESTApp-API:t. num=200/sida; servern klarar allt-i-ett. */
async function scrapeRestAppApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const apiBase = config.restApi!.url.replace(/\/$/, '');
    const cap = config.maxItems ?? 1000;
    const num = 200;
    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();

    let totalHits = Infinity;
    for (let page = 1; events.length < cap && (page - 1) * num < totalHits; page++) {
        const params = new URLSearchParams({
            num: String(num),
            query: '',
            count: '0',
            page: String(page),
            type: 'event',
            timestamp: '0',
            filters: '{"type":"event"}',
        });
        const body = await fetchHtml(`${apiBase}/events?${params}`, config);
        if (!body) { ctx.log(`  RESTApp-API svarade inte (page=${page})`); break; }

        let data: { hits?: RestAppHit[]; searchInfo?: { totalHits?: number } };
        try { data = JSON.parse(body); } catch { ctx.log('  RESTApp-API gav icke-JSON'); break; }

        const hits = data.hits ?? [];
        if (typeof data.searchInfo?.totalHits === 'number') totalHits = data.searchInfo.totalHits;
        if (hits.length === 0) break;

        for (const hit of hits) {
            const ev = mapRestAppHit(hit, base, config.defaultCity, config.cities);
            if (!ev || seenUrls.has(ev.url)) continue;
            seenUrls.add(ev.url);
            events.push(ev);
        }
    }
    ctx.log(`RESTApp-API: ${events.length} event (totalHits=${totalHits})`);
    return events;
}

/** Paginera igenom items-API:t. 18/sida är serverns default; num=100 funkar. */
async function scrapeSoleilItemsApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const origin = new URL(base).origin;
    const { pageId, portletId } = config.itemsApi!;
    const cap = config.maxItems ?? 1000;
    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();

    let start = 0;
    let count = Infinity;
    while (start < count && events.length < cap) {
        const url = `${origin}/appresource/${pageId}/${portletId}/items?start=${start}&num=100`;
        const body = await fetchHtml(url, config);
        if (!body) { ctx.log(`  items-API svarade inte (start=${start})`); break; }

        let data: { count?: number; items?: SoleilItem[] };
        try { data = JSON.parse(body); } catch { ctx.log('  items-API gav icke-JSON'); break; }

        const items = data.items ?? [];
        if (typeof data.count === 'number') count = data.count;
        if (items.length === 0) break;

        for (const item of items) {
            const ev = mapSoleilItem(item, base, config.defaultCity);
            if (!ev || seenUrls.has(ev.url)) continue;
            seenUrls.add(ev.url);
            events.push(ev);
        }
        start += items.length;
    }
    ctx.log(`items-API: ${events.length} event (count=${count})`);
    return events;
}

/** Rått hit ur soleilit.eventSearch events-API:t (kalmar.com-varianten). */
interface EventSearchHit {
    id?: string;
    name?: string;
    URl?: string;               // sic — kalmar.com stavar fältet så
    URL?: string;               // osteraker.se stavar det så i stället
    image?: string;
    city?: string;              // ort per hit (osteraker.se) — saknas på kalmar.com
    description?: string;
    local?: string;             // venue-namn ("Kalmar läns museum")
    location?: string;          // gatuadress ("Skeppsbrogatan 51")
    fullStartDate?: string;     // "2026-06-22"
    fullEndDate?: string;
    startTime?: string;         // "10.30"
    endTime?: string;
}

/** Mappa ett eventSearch-hit → RawEvent. Exporterad för test. */
export function mapEventSearchHit(
    hit: EventSearchHit,
    baseUrl: string,
    defaultCity: string | undefined,
    windowStart: Date,
): RawEvent | null {
    const title = (hit.name || '').trim();
    const eventUrl = makeAbsoluteUrl(hit.URl ?? hit.URL, baseUrl);
    if (!title || !eventUrl) return null;

    // Pågående fleradagars-event (start i det förflutna, slut framåt) ankras på
    // windowStart så de inte klipps av runnerns datumfönster.
    let parsed = parseSoleilDate(hit.fullStartDate, hit.startTime);
    if (!parsed) return null;
    if (parsed.date < windowStart && hit.fullEndDate) {
        const end = parseSoleilDate(hit.fullEndDate, null);
        if (end && end.date >= windowStart) {
            parsed = { date: new Date(windowStart), hasClock: false };
        }
    }

    return {
        externalId: hit.id,
        title,
        startDate: parsed.date,
        url: eventUrl,
        venueName: hit.local?.trim() || undefined,
        address: hit.location?.trim() || undefined,
        city: hit.city?.trim() || defaultCity,
        description: hit.description?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(hit.image, baseUrl),
        hasSpecificTime: parsed.hasClock ? true : undefined,
    };
}

/** Rått item ur EventService (bara fälten vi läser). */
interface EventServiceItem {
    identifier?: string;
    name?: string;
    uri?: string;
    startDate?: string;      // "2026-01-09T21:00:00+01:00"
    endDate?: string;
    startTime?: string;      // "21:00"
    location?: string;       // hela adressen
    description?: string;
    image?: { uri?: string };
}

/** Mappa ett EventService-item → RawEvent. Exporterad för test. */
export function mapEventServiceItem(
    item: EventServiceItem,
    baseUrl: string,
    defaultCity: string | undefined,
): RawEvent | null {
    const title = decodeHtmlEntities(item.name || '').trim();
    const eventUrl = makeAbsoluteUrl(item.uri, baseUrl);
    if (!title || !eventUrl || !item.startDate) return null;
    const start = new Date(item.startDate);
    if (isNaN(start.getTime())) return null;
    const end = item.endDate ? new Date(item.endDate) : null;

    return {
        externalId: item.identifier,
        title,
        startDate: start,
        endDate: end && !isNaN(end.getTime()) && end > start ? end : undefined,
        url: eventUrl,
        address: item.location?.trim() || undefined,
        city: defaultCity,
        description: item.description?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(item.image?.uri, baseUrl),
        // startTime finns bara när arrangören satt klockslag.
        hasSpecificTime: item.startTime?.trim() ? true : undefined,
    };
}

/** SiteVision EventService — hela arkivnoden i ETT anrop. */
async function scrapeEventServiceApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const origin = new URL(base).origin;
    const cap = config.maxItems ?? 300;
    const url = `${origin}/rest-api/EventService/items?start=0&num=${cap}`
        + `&paths=${encodeURIComponent(config.eventServiceApi!.paths)}`;

    const body = await fetchHtml(url, config);
    if (!body) { ctx.log('EventService svarade inte'); return []; }
    let data: { data?: EventServiceItem[]; meta?: { totalItems?: number } };
    try { data = JSON.parse(body); } catch { ctx.log('EventService gav icke-JSON'); return []; }

    const events: RawEvent[] = [];
    const seen = new Set<string>();
    for (const it of data.data ?? []) {
        const ev = mapEventServiceItem(it, base, config.defaultCity);
        if (!ev || seen.has(ev.url)) continue;
        seen.add(ev.url);
        events.push(ev);
    }
    ctx.log(`EventService: ${events.length} event (totalItems=${data.meta?.totalItems})`);
    return events;
}

/** Rått item ur /page-routen (bara fälten vi läser). */
interface PageApiItem {
    id?: string;
    displayName?: string;
    URI?: string;
    startDate?: number;      // epoch ms
    endDate?: number;
    img?: string;
    text?: string;
}

/** Mappa ett /page-item → RawEvent. Exporterad för test. */
export function mapPageApiItem(
    item: PageApiItem,
    baseUrl: string,
    defaultCity: string | undefined,
): RawEvent | null {
    const title = decodeHtmlEntities(item.displayName || '').trim();
    const eventUrl = makeAbsoluteUrl(item.URI, baseUrl);
    if (!title || !eventUrl) return null;
    if (typeof item.startDate !== 'number' || !isFinite(item.startDate) || item.startDate <= 0) return null;

    const start = new Date(item.startDate);
    if (isNaN(start.getTime())) return null;
    const end = typeof item.endDate === 'number' && item.endDate > item.startDate
        ? new Date(item.endDate) : undefined;

    return {
        externalId: item.id,
        title,
        startDate: start,
        endDate: end,
        url: eventUrl,
        city: defaultCity,
        description: item.text?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(item.img, baseUrl),
    };
}

/** SiteVision-webappens /page-route — paginera igenom (9/sida, ej kumulativ). */
async function scrapePageApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const origin = new URL(base).origin;
    const { pageId, portletId } = config.pageApi!;
    const cap = config.maxItems ?? 400;
    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();

    let hitCount = Infinity;
    for (let page = 1; events.length < cap; page++) {
        const url = `${origin}/appresource/${pageId}/${portletId}/page?p=${page}&f=&t=&c=&svAjaxReqParam=ajax`;
        const body = await fetchHtml(url, config, { 'X-Requested-With': 'XMLHttpRequest' });
        if (!body) { ctx.log(`  /page svarade inte (p=${page})`); break; }

        let data: { hitCount?: number; items?: PageApiItem[] };
        try { data = JSON.parse(body); } catch { ctx.log('  /page gav icke-JSON'); break; }
        if (typeof data.hitCount === 'number') hitCount = data.hitCount;

        const items = data.items ?? [];
        if (items.length === 0) break;
        for (const it of items) {
            const ev = mapPageApiItem(it, base, config.defaultCity);
            if (!ev || seenUrls.has(ev.url)) continue;
            seenUrls.add(ev.url);
            events.push(ev);
        }
        if (page * items.length >= hitCount) break;
    }
    ctx.log(`/page-API: ${events.length} event (hitCount=${hitCount})`);
    return events;
}

/** soleilit.eventSearch: hela kalendern i ETT anrop (fönsterstyrt). */
async function scrapeEventSearchApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const origin = new URL(base).origin;
    const { pageId, portletId } = config.eventSearchApi!;
    const cap = config.maxItems ?? 1000;

    const url = `${origin}/appresource/${pageId}/${portletId}/events`
        + `?fromDate=${encodeURIComponent(ctx.windowStart.toISOString())}`
        + `&toDate=${encodeURIComponent(ctx.windowEnd.toISOString())}`
        + `&categories=&limit=${cap}`;
    const body = await fetchHtml(url, config);
    if (!body) { ctx.log('eventSearch-API svarade inte'); return []; }

    let data: { hitCount?: number; hits?: EventSearchHit[] };
    try { data = JSON.parse(body); } catch { ctx.log('eventSearch-API gav icke-JSON'); return []; }

    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();
    for (const hit of data.hits ?? []) {
        const ev = mapEventSearchHit(hit, base, config.defaultCity, ctx.windowStart);
        if (!ev || seenUrls.has(ev.url)) continue;
        seenUrls.add(ev.url);
        events.push(ev);
    }
    ctx.log(`eventSearch-API: ${events.length} event (hitCount=${data.hitCount})`);
    return events;
}

/** Rått hit ur events-list-webappens guide-API (visiteskilstuna-varianten). */
interface GuideHit {
    id?: string;
    title?: string;
    url?: string;
    description?: string;
    image?: { src?: string };
    info?: {
        start?: string;         // "2026-07-27 14:00"
        end?: string;
        location?: { name?: string };
    };
}

/** "2026-07-27 14:00" → lokal Date. Exporterad för test. */
export function parseGuideDate(s: string | undefined): { date: Date; hasClock: boolean } | null {
    const m = s?.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    const [y, mo, da, hh, mi] = m.slice(1).map((n) => parseInt(n, 10));
    const d = new Date(y, mo - 1, da, hh, mi);
    if (isNaN(d.getTime())) return null;
    // "00:00" = ingen specifik tid i guiden (heldags-/fleradagars-event).
    return { date: d, hasClock: !(hh === 0 && mi === 0) };
}

/** Mappa ett guide-hit → RawEvent. Exporterad för test. */
export function mapGuideHit(
    hit: GuideHit,
    baseUrl: string,
    defaultCity: string | undefined,
    windowStart: Date,
): RawEvent | null {
    const title = (hit.title || '').trim();
    const eventUrl = makeAbsoluteUrl(hit.url, baseUrl);
    let parsed = parseGuideDate(hit.info?.start);
    if (!title || !eventUrl || !parsed) return null;

    // Pågående fleradagars-event ankras på windowStart (samma som eventSearch).
    if (parsed.date < windowStart && hit.info?.end) {
        const end = parseGuideDate(hit.info.end);
        if (end && end.date >= windowStart) {
            parsed = { date: new Date(windowStart), hasClock: false };
        }
    }

    return {
        externalId: hit.id,
        title,
        startDate: parsed.date,
        url: eventUrl,
        venueName: hit.info?.location?.name?.trim() || undefined,
        city: defaultCity,
        description: hit.description?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(hit.image?.src, baseUrl),
        hasSpecificTime: parsed.hasClock ? true : undefined,
    };
}

/** events-list-webappen: kumulativ paginering → allt i ETT stort anrop. */
async function scrapeGuideApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const origin = new URL(base).origin;
    const basePath = config.guideApi!.basePath.replace(/\/$/, '');
    const cap = config.maxItems ?? 1000;
    const mkUrl = (page: number) =>
        `${origin}${basePath}/events?count=0&filters=%7B%7D&page=${page}&query=&timestamp=${Date.now()}`;

    // Första sidan avslöjar totalHits; sedan EN request som täcker allt (12/sida).
    const first = await fetchHtml(mkUrl(1), config);
    if (!first) { ctx.log('guide-API svarade inte'); return []; }
    let data: { hits?: GuideHit[]; searchInfo?: { totalHits?: number } };
    try { data = JSON.parse(first); } catch { ctx.log('guide-API gav icke-JSON'); return []; }

    const total = Math.min(data.searchInfo?.totalHits ?? data.hits?.length ?? 0, cap);
    const perPage = Math.max(data.hits?.length ?? 12, 1);
    if (total > perPage) {
        const body = await fetchHtml(mkUrl(Math.ceil(total / perPage)), config);
        if (body) { try { data = JSON.parse(body); } catch { /* behåll första sidan */ } }
    }

    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();
    for (const hit of data.hits ?? []) {
        const ev = mapGuideHit(hit, base, config.defaultCity, ctx.windowStart);
        if (!ev || seenUrls.has(ev.url)) continue;
        seenUrls.add(ev.url);
        events.push(ev);
    }
    ctx.log(`guide-API: ${events.length} event (totalHits=${data.searchInfo?.totalHits})`);
    return events;
}

/** Rått hit ur webappens /search-route (visit.norrkoping-varianten). */
interface SearchAppHit {
    id?: string;
    title?: string;
    summary?: string;
    date?: string;              // "9 aug" | "13 mar 2027" | "5 aug - 6 sep"
    image?: string;
    url?: string;
    categories?: string;
    type?: string;              // 'event' — andra typer filtreras bort
}

const SV_MONTHS: Record<string, number> = {
    jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, mars: 2, apr: 3, april: 3,
    maj: 4, jun: 5, juni: 5, jul: 6, juli: 6, aug: 7, augusti: 7,
    sep: 8, september: 8, okt: 9, oktober: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * Tolka webappens renderade datumtext. Exporterad för test.
 *
 * Format (alla observerade på visit.norrkoping.se 2026-08-09):
 *   "9 aug"                      — år underförstått
 *   "13 mar 2027"                — explicit år
 *   "5 aug - 6 sep"              — intervall, år underförstått
 *   "13 - 15 aug"                — intervall, månad bara på slutdatumet
 *   "25 sep 2026 - 27 jan 2027"  — intervall, explicita år
 *
 * Kalendern listar bara pågående/kommande event, så ett årslöst datum tolkas
 * som innevarande år — utom när det då hamnar mer än 120 dagar bakåt, vilket
 * betyder att det syftar på nästa år ("5 feb" sett i augusti).
 */
export function parseSearchAppDate(
    raw: string | undefined,
    now: Date = new Date(),
): { start: Date; end?: Date } | null {
    const s = raw?.trim().replace(/[‐-―]/g, '-');   // – — → -
    if (!s) return null;

    const mkDate = (day: number, month: number, year: number | null): Date => {
        const y = year ?? now.getFullYear();
        let d = new Date(y, month, day);
        if (year === null) {
            const daysOff = (d.getTime() - now.getTime()) / 86_400_000;
            if (daysOff < -120) d = new Date(y + 1, month, day);
        }
        return d;
    };
    // "13 mar 2027" / "9 aug" / "13" (månadslöst, bara i intervallets vänsterled)
    const PART = /^(\d{1,2})(?:\s+([a-zåäö]+))?(?:\s+(\d{4}))?$/i;

    const [lhs, rhs] = s.split(/\s+-\s+/);
    const parse = (part: string, fallbackMonth?: number, fallbackYear?: number | null) => {
        const m = part.trim().match(PART);
        if (!m) return null;
        const day = parseInt(m[1], 10);
        const monthKey = m[2]?.toLowerCase();
        const month = monthKey ? SV_MONTHS[monthKey] : fallbackMonth;
        if (month === undefined || !(day >= 1 && day <= 31)) return null;
        const year = m[3] ? parseInt(m[3], 10) : (fallbackYear ?? null);
        const d = mkDate(day, month, year);
        return isNaN(d.getTime()) ? null : d;
    };

    if (!rhs) {
        const start = parse(lhs);
        return start ? { start } : null;
    }
    // Slutdatumet parsas först — "13 - 15 aug" saknar månad i vänsterledet.
    const end = parse(rhs);
    if (!end) return null;
    const start = parse(lhs, end.getMonth(), end.getFullYear() === now.getFullYear() ? null : end.getFullYear());
    if (!start) return null;
    // "25 sep 2026 - 27 jan 2027" utan explicit år i vänsterledet: slutet före
    // starten betyder att intervallet spänner över ett årsskifte.
    if (end < start) end.setFullYear(end.getFullYear() + 1);
    return { start, end };
}

/** Mappa ett searchApp-hit → RawEvent. Exporterad för test. */
export function mapSearchAppHit(
    hit: SearchAppHit,
    baseUrl: string,
    defaultCity: string | undefined,
    windowStart: Date,
    now: Date = new Date(),
): RawEvent | null {
    const title = (hit.title || '').trim();
    const eventUrl = makeAbsoluteUrl(hit.url, baseUrl);
    const parsed = parseSearchAppDate(hit.date, now);
    if (!title || !eventUrl || !parsed) return null;
    if (hit.type && hit.type !== 'event') return null;

    // Pågående fleradagars-event ankras på windowStart (samma som eventSearch/guide).
    let start = parsed.start;
    if (start < windowStart && parsed.end && parsed.end >= windowStart) {
        start = new Date(windowStart);
    }

    return {
        externalId: hit.id,
        title,
        startDate: start,
        endDate: parsed.end && parsed.end > start ? parsed.end : undefined,
        url: eventUrl,
        city: defaultCity,
        description: hit.summary?.trim() || undefined,
        imageUrl: makeAbsoluteUrl(hit.image, baseUrl),
    };
}

/**
 * Plocka tid/plats/adress/koordinater ur detaljsidan. Exporterad för test.
 *
 * Markup (vn-object-page, stabila klassnamn):
 *   <div class="…occasion-item-metadata-row"><span …/><span class="show-for-sr">Tid:</span>19:00–20:40</div>
 *   …samma rad-mönster för "Plats:"
 *   <div class="…metadata-item-title">…Adress</div><div class="…metadata-item-value">Holmengatan 4, 602 32 Norrköping</div>
 *   <iframe src="https://www.google.com/maps/embed?pb=…!2d<lng>!3d<lat>!…">
 */
export function parseSearchAppDetail(html: string): {
    time?: string;
    venueName?: string;
    address?: string;
    coords?: [number, number];
} {
    const $ = cheerio.load(html);
    const out: { time?: string; venueName?: string; address?: string; coords?: [number, number] } = {};

    $('.vn-object-page__occasion-item-metadata-row').each((_, el) => {
        const label = $(el).find('.show-for-sr').first().text().trim().replace(/:$/, '');
        const value = decodeHtmlEntities($(el).clone().children('span').remove().end().text())
            .replace(/\s+/g, ' ').trim();
        if (!value) return;
        if (/^tid$/i.test(label) && !out.time) out.time = value;
        if (/^plats$/i.test(label) && !out.venueName) out.venueName = value;
    });

    $('.vn-object-page__information-box-metadata-item').each((_, el) => {
        const title = $(el).find('.vn-object-page__information-box-metadata-item-title').text().trim();
        if (!/^adress$/i.test(title)) return;
        const value = decodeHtmlEntities(
            $(el).find('.vn-object-page__information-box-metadata-item-value').text(),
        ).replace(/\s+/g, ' ').trim();
        if (value && !out.address) out.address = value;
    });

    // Kartans embed-URL bär venue-koordinaterna exakt → hoppa över geokodning.
    const mapSrc = $('.vn-object-page__information-map iframe').attr('src') || '';
    const geo = mapSrc.match(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/);
    if (geo) {
        const lng = parseFloat(geo[1]);
        const lat = parseFloat(geo[2]);
        if (lat > 55 && lat < 70 && lng > 10 && lng < 25) out.coords = [lat, lng];
    }
    return out;
}

/** "19:00-20:40" / "19.00" → starttimme+minut, eller null för heldag. */
function parseClock(time: string | undefined): { hh: number; mi: number } | null {
    const m = time?.trim().match(/^(\d{1,2})[:.](\d{2})/);
    if (!m) return null;
    const hh = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (hh > 23 || mi > 59) return null;
    // 00:00 = heldagsmarkering, inte ett riktigt klockslag.
    return hh === 0 && mi === 0 ? null : { hh, mi };
}

/** Webappens /search-route: paginera + (valfritt) berika ur detaljsidorna. */
async function scrapeSearchAppApi(
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const base = config.urls[0];
    const { portletId, fetchDetail } = config.searchAppApi!;
    const cap = config.maxItems ?? 1000;
    const timestamp = Date.now();
    const mkUrl = (page: number) =>
        `${base}?filters=%7B%7D&query=&page=${page}`
        + `&sv.${portletId}.route=%2Fsearch&sv.target=${portletId}&timestamp=${timestamp}`;

    const events: RawEvent[] = [];
    let totalPages = 1;
    let totalHits: number | undefined;

    for (let page = 1; page <= totalPages && events.length < cap; page++) {
        const body = await fetchHtml(mkUrl(page), config, { 'X-Requested-With': 'XMLHttpRequest' });
        if (!body) { ctx.log(`  searchApp-API svarade inte (page=${page})`); break; }

        let data: { searchHits?: SearchAppHit[]; searchInfo?: { totalHits?: number; totalPages?: number } };
        try { data = JSON.parse(body); } catch { ctx.log('  searchApp-API gav icke-JSON (saknas X-Requested-With?)'); break; }

        if (page === 1) {
            totalPages = data.searchInfo?.totalPages ?? 1;
            totalHits = data.searchInfo?.totalHits;
        }
        const hits = data.searchHits ?? [];
        if (hits.length === 0) break;

        for (const hit of hits) {
            const ev = mapSearchAppHit(hit, base, config.defaultCity, ctx.windowStart);
            if (ev) events.push(ev);
        }
    }
    ctx.log(`searchApp-API: ${events.length} tillfällen (totalHits=${totalHits}, sidor=${totalPages})`);

    if (!fetchDetail || events.length === 0) return events;

    // Ett fetch per UNIK url — en återkommande serie delar detaljsida.
    const byUrl = new Map<string, RawEvent[]>();
    for (const ev of events) {
        const list = byUrl.get(ev.url);
        if (list) list.push(ev); else byUrl.set(ev.url, [ev]);
    }
    let enriched = 0, withClock = 0, withCoords = 0;
    for (const [url, group] of byUrl) {
        const html = await fetchHtml(url, config);
        if (!html) continue;
        const d = parseSearchAppDetail(html);
        if (!d.time && !d.venueName && !d.address && !d.coords) continue;
        enriched++;
        const clock = parseClock(d.time);
        if (clock) withClock++;
        if (d.coords) withCoords++;
        for (const ev of group) {
            if (d.venueName) ev.venueName = d.venueName;
            if (d.address) ev.address = d.address;
            if (d.coords) ev.coords = d.coords;
            if (clock) {
                ev.startDate = new Date(ev.startDate);
                ev.startDate.setHours(clock.hh, clock.mi, 0, 0);
                ev.hasSpecificTime = true;
            }
        }
    }
    ctx.log(`  detaljsidor: ${enriched}/${byUrl.size} berikade (${withClock} med klockslag, ${withCoords} med koordinater)`);
    return events;
}

async function fetchHtml(
    url: string,
    cfg: SiteVisionConfig,
    extraHeaders?: Record<string, string>,
): Promise<string | null> {
    await domainLimiter.wait(url);
    // API-lägena skickar extraHeaders och ska ALLTID gå via fetch — browsern
    // används bara för att rendera list-sidans HTML.
    if (cfg.useBrowser && !extraHeaders) return fetchHtmlViaBrowser(url, cfg);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), cfg.timeoutMs ?? 20000);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
                ...extraHeaders,
            },
            redirect: 'follow',
            signal: ac.signal,
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    } finally {
        clearTimeout(t);
    }
}

/** Rendera sidan i den delade Puppeteer-browsern och returnera DOM:en. */
async function fetchHtmlViaBrowser(url: string, cfg: SiteVisionConfig): Promise<string | null> {
    let page: Awaited<ReturnType<Awaited<ReturnType<typeof getSharedBrowser>>['newPage']>> | null = null;
    try {
        const browser = await getSharedBrowser();
        page = await browser.newPage();
        await page.setUserAgent(cfg.userAgent ?? DEFAULT_UA);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: cfg.timeoutMs ?? 45000 });
        // Korten kommer ofta ett andetag efter networkidle.
        await new Promise((r) => setTimeout(r, 3000));
        return await page.content();
    } catch {
        return null;
    } finally {
        if (page) await page.close().catch(() => { });
    }
}

function makeAbsoluteUrl(url: string | undefined, base: string): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    try { return new URL(url, base).toString(); } catch { return url; }
}

export const sitevisionEngine = async (
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    if (config.restApi) return scrapeRestAppApi(config, ctx);
    if (config.itemsApi) return scrapeSoleilItemsApi(config, ctx);
    if (config.eventSearchApi) return scrapeEventSearchApi(config, ctx);
    if (config.guideApi) return scrapeGuideApi(config, ctx);
    if (config.searchAppApi) return scrapeSearchAppApi(config, ctx);
    if (config.pageApi) return scrapePageApi(config, ctx);
    if (config.eventServiceApi) return scrapeEventServiceApi(config, ctx);

    const events: RawEvent[] = [];
    const seenUrls = new Set<string>();
    const maxItems = config.maxItems ?? 200;

    for (const url of config.urls) {
        ctx.log(`fetching ${url}`);
        const html = await fetchHtml(url, config);
        if (!html) { ctx.log(`  fetch failed`); continue; }

        const $ = cheerio.load(html);
        const timeEls = $('time[datetime]').toArray();
        ctx.log(`  found ${timeEls.length} <time datetime> elements`);

        let cards = 0;
        for (const timeEl of timeEls) {
            if (cards >= maxItems) break;

            const dt = $(timeEl).attr('datetime');
            if (!dt) continue;

            // Hoppa över time-element som är klockslag (HH:MM) — de är inte event-datum
            if (/^\d{1,2}:\d{2}$/.test(dt)) continue;

            const startDate = new Date(dt);
            if (isNaN(startDate.getTime())) continue;

            // Hitta containern: article/li/div med event/item/card-klass
            let container = $(timeEl).closest('article, li').first();
            if (container.length === 0) {
                container = $(timeEl).closest('div[class*="event"], div[class*="item"], div[class*="card"]').first();
            }
            if (container.length === 0) container = $(timeEl).parent().parent();
            // Containern måste rymma en TITEL-länk — annars har vi stannat i en
            // bildwrapper (askersund.se: <time> i .con-event-puff__image-wrapper,
            // rubriken i syster-wrappern). Klättra uppåt tills en länk finns,
            // men aldrig förbi ett element som rymmer fler <time> (= hela listan).
            if (container.find('a[href]').length === 0) {
                let up = container.parent();
                for (let depth = 0; depth < 5 && up.length > 0; depth++, up = up.parent()) {
                    if (up.find('time[datetime]').length > 1) break;
                    if (up.find('a[href]').length > 0) { container = up; break; }
                }
            }

            // Hitta titel-länk: prova båda mönster
            //   1. <a><h3>title</h3></a>   (Malmö-stil)
            //   2. <h3><a>title</a></h3>   (Täby-stil)
            //   3. Första <a> med rimlig text i container (sista utvägen)
            let linkEl = container.find('h1 a, h2 a, h3 a, h4 a').first();
            if (linkEl.length === 0) {
                linkEl = container.find('a').filter((_, a) => $(a).find('h1, h2, h3, h4').length > 0).first();
            }

            let title = '';
            if (linkEl.length > 0) {
                // Text antingen från a:n direkt eller från headline-elementet
                const inner = linkEl.find('h1, h2, h3, h4').first();
                title = (inner.length > 0 ? inner.text() : linkEl.text()).trim();
            }
            // Sista utvägen: bara plocka container's h1-h4
            if (!title) {
                title = container.find('h1, h2, h3, h4').first().text().trim();
                if (title && linkEl.length === 0) linkEl = container.find('a').first();
            }
            // Kort UTAN rubriktagg (jarfalla.se/evenemang: <a href title>Titel</a>
            // + <small><time>): första länken med text, eller dess title-attribut.
            // Lät 121 Järfälla-event och 55 Askersund-event falla bort (2026-08-23).
            if (!title) {
                const textLink = container.find('a[href]').filter((_, a) => {
                    const t = ($(a).text().trim() || $(a).attr('title') || '').trim();
                    return t.length >= 3 && !/^(läs mer|visa|mer info|boka|anmäl)/i.test(t);
                }).first();
                if (textLink.length > 0) {
                    linkEl = textLink;
                    // Länktexten kan rymma datumspans (ydre.se: "26 augusti 2026Lunchwebbinarium")
                    // — ta bort time/datum-barn innan texten läses; title-attributet är renast.
                    const clone = textLink.clone();
                    clone.find('time, [class*="date"], [class*="datum"], [class*="day"], [class*="month"]').remove();
                    title = (textLink.attr('title') || clone.text() || '').replace(/\s+/g, ' ').trim();
                }
            }

            const href = linkEl.attr('href');
            const eventUrl = makeAbsoluteUrl(href, url);

            if (!title || title.length < 2 || !eventUrl) continue;
            if (/^(läs mer|visa alla|visa mer|mer info|boka|anmäl dig|till evenemanget)\.?$/i.test(title)) continue;   // länktext, inte titel
            if (config.pathFilter && !eventUrl.includes(config.pathFilter)) continue;
            if (seenUrls.has(eventUrl)) continue;
            seenUrls.add(eventUrl);

            // Plocka tilläggsdata om finns i kortet
            const imgEl = container.find('img').first();
            let imageUrl = imgEl.attr('src') || imgEl.attr('data-src');
            if (imageUrl && imageUrl.endsWith('.svg')) imageUrl = undefined; // ikoner
            imageUrl = makeAbsoluteUrl(imageUrl, url);

            // Description: sök första <p> eller text-element i kortet
            const descCandidate = container.find('p, .description, [class*="excerpt"], [class*="summary"]').first().text().trim();
            const description = descCandidate.length > 30 ? truncateAtBoundary(descCandidate, DEFAULT_DESCRIPTION_MAX) : undefined;

            // Venue: ofta i en .venue, [class*="location"] eller liknande
            const venueEl = container.find('[class*="location"], [class*="venue"], [class*="place"]').first();
            const venueName = venueEl.text().trim() || undefined;

            if (config.dropMunicipalMeetings && isMunicipalMeeting(title, eventUrl)) continue;

            const cleanTitle = cleanCardTitle(title, venueName, {
                titleStripRe: config.titleStripRe,
                stripVenue: config.stripVenueFromTitle,
            });
            if (cleanTitle.length < 2) continue;

            events.push({
                title: cleanTitle,
                startDate,
                url: eventUrl,
                venueName,
                city: config.defaultCity,
                description,
                imageUrl,
            });
            cards++;
        }

        ctx.log(`  extracted ${cards} events`);

        // Fallback: inga <time datetime>-kort — vissa SiteVision-sajter (museer
        // med "aktiviteter"-struktur, t.ex. textilmuseet.se) länkar i stället
        // eventsidor med datumet i URL-sluggen: /aktiviteter/.../2026-06-05-visning.
        // Datum ur sluggen, titel ur länktexten. Klockslag saknas → runnerns
        // midnatts-heuristik + nattens fix-times hämtar tid från detaljsidan.
        if (cards === 0) {
            let slugCards = 0;
            $('a[href]').each((_, a) => {
                if (slugCards >= maxItems) return;
                const href = $(a).attr('href') ?? '';
                const m = href.match(/\/(20\d{2}-\d{2}-\d{2})[-/][a-z0-9]/i);
                if (!m) return;
                let abs: string;
                try { abs = href.startsWith('http') ? href : new URL(href, url).toString(); } catch { return; }
                if (seenUrls.has(abs)) return;
                let startDate = new Date(m[1]);
                // Sluggens datum är ofta PUBLICERINGSdatum (varberg.se: /2026-04-09-
                // teach-me… visas 30 maj–23 aug). Finns ett svenskt datum i kortets
                // egen text vinner det. Splittade intervall "30 - 23 / maj - augusti"
                // normaliseras till "30 maj - 23 augusti" först.
                const card = $(a).closest('li, article, [class*="item"], [class*="card"]').first();
                if (card.length > 0) {
                    // html→text med mellanslag mellan element: annars klistras
                    // spans ihop ("26 augusti 2026" + "26 augusti 2026" → år 202626).
                    const cardText = (card.html() ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
                        .replace(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)\s*[-–]\s*([a-zåäö]+)/i, '$1 $3 - $2 $4')
                        .trim();
                    const fromText = findFirstDateInText(cardText, new Date());
                    if (fromText) startDate = fromText;
                }
                if (isNaN(startDate.getTime())) return;
                // Länken kan omsluta hela kortet (ydre.se: datumspans + <h2>Titel</h2>):
                // rubrik inne i länken vinner, annars title-attribut, annars text utan datumbarn.
                const innerHeading = $(a).find('h1, h2, h3, h4').first();
                const aClone = $(a).clone();
                aClone.find('time, [class*="date"], [class*="datum"], [class*="day"], [class*="month"], .env-assistive-text, [aria-hidden="true"]').remove();
                const title = (innerHeading.length > 0 ? innerHeading.text() : ($(a).attr('title') || aClone.text())).replace(/\s+/g, ' ').trim();
                if (title.length < 3 || title.length > 150) return;
                if (/^(läs mer|visa alla|visa mer|mer info|boka|anmäl dig|till evenemanget)\.?$/i.test(title)) return;   // länktext, inte titel
                // Samma filter som i huvudloopen — Botkyrkas kalender når hit
                // (inga <time datetime>) och blandar in nämndsammanträden.
                if (config.dropMunicipalMeetings && isMunicipalMeeting(title, abs)) return;
                seenUrls.add(abs);
                events.push({ title, startDate, url: abs, city: config.defaultCity });
                slugCards++;
            });
            if (slugCards > 0) ctx.log(`  datum-slugg-fallback: ${slugCards} events`);
        }
    }

    // Detaljside-fallback för beskrivning: list-korten på vissa kommunsajter
    // (Strömsund 106/111 utan desc, Svenljunga 30/30) är text-tomma medan
    // detaljsidan har meta/og-description. Throttlat via domainLimiter; bara
    // event som SAKNAR desc hämtas → självbegränsande när korten räcker.
    if (config.fetchDetailDesc) {
        let filled = 0;
        for (const ev of events) {
            if (ev.description || !ev.url) continue;
            const html = await fetchHtml(ev.url, config);
            if (!html) continue;
            const m = html.match(/<meta[^>]+(?:property="og:description"|name="description")[^>]+content="([^"]*)"/i)
                || html.match(/<meta[^>]+content="([^"]*)"[^>]+(?:property="og:description"|name="description")/i);
            const desc = m?.[1]
                ? decodeHtmlEntities(m[1]).replace(/\s+/g, ' ').trim()
                : undefined;
            if (desc && desc.length >= 20) { ev.description = truncateAtBoundary(desc, DEFAULT_DESCRIPTION_MAX); filled++; }
        }
        if (filled) ctx.log(`  detalj-desc: ${filled} beskrivningar ur meta-taggar`);
    }

    return events;
};
