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

    return events;
};
