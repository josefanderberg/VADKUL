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

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SiteVisionConfig {
    urls: string[];
    defaultCity?: string;
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

async function fetchHtml(url: string, cfg: SiteVisionConfig): Promise<string | null> {
    await domainLimiter.wait(url);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), cfg.timeoutMs ?? 20000);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': cfg.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
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

function makeAbsoluteUrl(url: string | undefined, base: string): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    try { return new URL(url, base).toString(); } catch { return url; }
}

export const sitevisionEngine = async (
    config: SiteVisionConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    if (config.itemsApi) return scrapeSoleilItemsApi(config, ctx);

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

            const href = linkEl.attr('href');
            const eventUrl = makeAbsoluteUrl(href, url);

            if (!title || title.length < 2 || !eventUrl) continue;
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
            const description = descCandidate.length > 30 ? descCandidate.slice(0, 600) : undefined;

            // Venue: ofta i en .venue, [class*="location"] eller liknande
            const venueEl = container.find('[class*="location"], [class*="venue"], [class*="place"]').first();
            const venueName = venueEl.text().trim() || undefined;

            events.push({
                title,
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
                ?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
                .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
            if (desc && desc.length >= 20) { ev.description = desc.slice(0, 600); filled++; }
        }
        if (filled) ctx.log(`  detalj-desc: ${filled} beskrivningar ur meta-taggar`);
    }

    return events;
};
