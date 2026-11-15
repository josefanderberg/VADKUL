/**
 * Studieförbundet Vuxenskolan (SV) — kulturarrangemang via listsidans SSR-HTML.
 *
 * Recon 2026-06, omverifierat 2026-07-02: sv.se är Litium-plattform. JSON-API:t
 * (/api/productFilter + header litium-request-context ur sid-HTML:ens
 * window.__litium.requestContext) returnerar BARA facetter — produkterna finns
 * enbart server-renderade. Så vi parsar list-HTML:en direkt:
 *
 *   GET https://www.sv.se/kurser-och-evenemang?g_EventType=culture
 *       &sort_by=startdate&page=N                          (16 kort/sida, ~35 sidor)
 *
 * g_EventType=culture skiljer kulturarrangemang (~560) från kurskatalogen.
 * Kortet (article.event-list__event-item, stabila BEM-klasser) har titel +
 * relativ länk (slug slutar -<id>), Ort, ISO-datum ("tis 2026-08-18"),
 * klockslag ("19:00"), pris ("Kostnadsfri"/"30 SEK") och bild. Ingen
 * gatuadress i listan — ort-nivå-geokodning (godkänd fallback, som ABF).
 * sort_by=startdate stiger → paginering klipps när vi passerat fönstret.
 */

import * as cheerio from 'cheerio';
import { RawEvent, Engine } from '../sources/types';

const SITE = 'https://www.sv.se';
const LIST = `${SITE}/kurser-och-evenemang`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_PAGES = 60;

/**
 * Hela katalogen (utan eventtypfilter) bär föreläsningar och endagskurser som
 * kulturfiltret missar: "AI för föreningsarbete" i Umeå, Uppsala och Vindeln
 * 15/11 2026 fanns bara där (Josef såg dem hos Happymap). Katalogens kort har
 * "N Tillfällen"; ett tillfälle = ett enskilt arrangemang med adress och pris.
 * Studiecirklar med flera träffar hoppas.
 */
const MAX_CATALOG_PAGES = 150;
const CATALOG_PAUSE_MS = 400;

interface SvCard { ev: RawEvent; occasions?: number }

/** Parsa en listsidas HTML → RawEvents. Exporterad för test. */
export function parseSvPage(html: string): RawEvent[] {
    return parseSvCards(html, 'Kulturarrangemang').map((c) => c.ev);
}

/** Katalogsidans kort med exakt ett tillfälle → RawEvents. Exporterad för test. */
export function parseSvCatalogPage(html: string): RawEvent[] {
    return parseSvCards(html, 'Arrangemang').filter((c) => c.occasions === 1).map((c) => c.ev);
}

function parseSvCards(html: string, kind: string): SvCard[] {
    const $ = cheerio.load(html);
    const out: SvCard[] = [];
    $('article.event-list__event-item').each((_i, el) => {
        const card = $(el);
        const titleEl = card.find('.event-list__title').first();
        let title = titleEl.text().replace(/\s+/g, ' ').trim();
        const href = (titleEl.closest('a').attr('href')
            || card.find('a[itemprop="url"]').first().attr('href') || '').trim();
        if (!title || !href) return;

        // "tis 2026-08-18" → ISO-datumet är det stabila; veckodagen skippas.
        const dateM = card.find('.event-list__date').first().text().match(/(\d{4}-\d{2}-\d{2})/);
        if (!dateM) return;
        const t = card.find('.event-list__time').first().text().match(/(\d{1,2}):(\d{2})/);

        const startDate = new Date(`${dateM[1]}T${t ? `${t[1].padStart(2, '0')}:${t[2]}` : '00:00'}:00`);
        if (isNaN(startDate.getTime())) return;

        const city = card.find('.event-list__location').first().text().replace(/\s+/g, ' ').trim() || undefined;
        // Distans- och webbarrangemang har ingen plats — "Distans" geokodades
        // som en ort och 12 webbinarier hamnade i Göteborg (15/11 2026).
        if (city && /^(?:distans|digital(?:t)?|online|webb(?:inarium)?|zoom|teams)\b/i.test(city)) return;
        // Katalogtitlarna slutar med orten: "Föreläsning - Digital säkerhet
        // och risker med AI, Kalmar", "AI - För föreningsarbete, Umeå (kväll)".
        // Orten står redan på kartan — ", <ort>" bort, en parentes efter står kvar.
        if (city) {
            const esc = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            title = title.replace(new RegExp(`,\\s*${esc}(?=\\s*(?:\\([^)]*\\))?\\s*$)`, 'i'), '').trim();
        }
        const price = card.find('.event-list__price').first().text().replace(/\s+/g, ' ').trim() || undefined;
        const img = card.find('img.event-list__image').first().attr('src') || undefined;
        const idM = href.match(/-(\d+)\/?$/);   // slug slutar "-<id>"
        const occM = card.find('.event-list__occasions').first().text().match(/(\d+)/);

        out.push({ occasions: occM ? Number(occM[1]) : undefined, ev: {
            externalId: idM ? idM[1] : undefined,
            title,
            startDate,
            url: href.startsWith('http') ? href : `${SITE}${href}`,
            city,
            venueName: city,
            imageUrl: img && !img.startsWith('http') ? `${SITE}${img}` : img,
            description: `${kind} med Studieförbundet Vuxenskolan${city ? ` i ${city}` : ''}.`,
            price,
            hostName: 'Studieförbundet Vuxenskolan',
            hasSpecificTime: !!t,
        } });
    });
    return out;
}

export const svVuxenskolanEngine: Engine = async (_config, ctx) => {
    const all: RawEvent[] = [];
    let page = 1;
    let pastWindow = 0;
    while (page <= MAX_PAGES) {
        let html: string | null = null;
        try {
            const res = await fetch(`${LIST}?g_EventType=culture&sort_by=startdate&page=${page}`, {
                headers: { 'User-Agent': UA, 'Accept': 'text/html' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`HTTP ${res.status} på sida ${page}`); break; }
            html = await res.text();
        } catch (err) {
            ctx.log(`sida ${page}: ${(err as Error).message}`);
            break;
        }
        const events = parseSvPage(html);
        if (events.length === 0) break;   // tom sida = förbi sista
        for (const ev of events) {
            all.push(ev);
            // sort_by=startdate är stigande — två hela sidor bortom fönstret → klipp.
            if (ev.startDate > ctx.windowEnd) pastWindow++;
        }
        if (pastWindow > 32) { ctx.log(`klipper paginering på sida ${page} (bortom fönstret)`); break; }
        page++;
    }
    ctx.log(`${all.length} kulturarrangemang över ${page > MAX_PAGES ? MAX_PAGES : page} sidor`);

    // Pass 2: hela katalogen, bara kort med ett tillfälle (föreläsningar, endagskurser).
    const seen = new Set(all.map((e) => e.url));
    let added = 0;
    let past = 0;
    let cpage = 1;
    for (; cpage <= MAX_CATALOG_PAGES; cpage++) {
        if (cpage > 1) await new Promise((r) => setTimeout(r, CATALOG_PAUSE_MS));
        let html: string;
        try {
            const res = await fetch(`${LIST}?sort_by=startdate&page=${cpage}`, {
                headers: { 'User-Agent': UA, 'Accept': 'text/html' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`katalog: HTTP ${res.status} på sida ${cpage}`); break; }
            html = await res.text();
        } catch (err) {
            ctx.log(`katalog sida ${cpage}: ${(err as Error).message}`);
            break;
        }
        const cards = parseSvCards(html, 'Arrangemang');
        if (cards.length === 0) break;
        for (const c of cards) {
            if (c.ev.startDate > ctx.windowEnd) past++;
            if (c.occasions !== 1 || seen.has(c.ev.url)) continue;
            seen.add(c.ev.url);
            all.push(c.ev);
            added++;
        }
        if (past > 32) break;
    }
    ctx.log(`katalogen: ${added} arrangemang med ett tillfälle över ${cpage} sidor`);
    return all;
};
