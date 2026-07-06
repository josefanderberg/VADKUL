/**
 * fhp — Engine för Folkets Hus och Parker via deras ODOKUMENTERADE theme-ajax.
 *
 * Sajtens 17k occasion-sidor är JS-renderade (dead end för sitemap-motorn),
 * men temats egna endpoint ger allt (knäckt via bundle-dyk i app.min.js,
 * samma metod som Friluftsfrämjandet):
 *
 *   POST /wp-content/themes/fhp/inc/ajax.php
 *     action=get_events&pageNr=N&genre=&city=&search=
 *       → { data: { results: "<article data-id=…>…" } }  (~31 kort/sida, 69 produktioner)
 *     action=get_event_members&eventId=<id>&pageNr=1&city=&view=&datePremiere=
 *       → occasion-HTML: <h3 class=event-member--list-year>2026</h3>
 *         + regionsblock med <a title="STAD, Venue">… <span class=event-date>15/6</span></a>
 *
 * En produktion (turné/utställning) → en RawEvent PER SPELTILLFÄLLE (samma
 * mönster som Riksteatern): STAD (VERSAL → normaliseras), venue, datum d/m
 * + år från närmast föregående års-rubrik. Ingen klockslag i API:t →
 * hasSpecificTime lämnas åt runnerns midnatts-heuristik.
 *
 * URL = arrangörs-länken (?evenemang=<id>) + #d-m-fragment så varje tillfälle
 * blir unikt och stabilt över nätter.
 */

import * as cheerio from 'cheerio';
import { Engine, RawEvent } from '../sources/types';
import { domainLimiter } from '../sources/rateLimiter';

const AJAX_URL = 'https://www.folketshusochparker.se/wp-content/themes/fhp/inc/ajax.php';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_CARD_PAGES = 6;      // 31 kort/sida; 69 produktioner idag — marginal för tillväxt

async function postAjax(body: string, signal?: AbortSignal): Promise<string> {
    await domainLimiter.wait(AJAX_URL);
    const res = await fetch(AJAX_URL, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body,
        signal: signal ?? AbortSignal.timeout(20_000),
    });
    if (!res.ok) return '';
    try {
        const d: any = await res.json();
        const r = d?.data?.results;
        return Array.isArray(r) ? r.join('') : (typeof r === 'string' ? r : '');
    } catch { return ''; }
}

export interface FhpCard {
    id: string;
    title: string;
    url: string;
    imageUrl?: string;
}

/** Parsa event-korten ur get_events-HTML. Exporterad för test. */
export function parseFhpCards(html: string): FhpCard[] {
    const $ = cheerio.load(html);
    const out: FhpCard[] = [];
    $('article[data-id]').each((_i, el) => {
        const id = $(el).attr('data-id') || '';
        const a = $(el).find('a[href]').first();
        const url = a.attr('href') || '';
        const title = (a.attr('title') || $(el).find('h2, h3, .card-title').first().text() || '')
            .replace(/\s+/g, ' ').replace(/&#8211;/g, '–').trim();
        const img = $(el).find('img').first().attr('src') || undefined;
        if (id && url && title) out.push({ id, title, url, imageUrl: img });
    });
    return out;
}

/** Normalisera VERSAL stad → "Grängesberg" (behåll bindestreck/mellanslag). */
export function normalizeCaps(city: string): string {
    return city.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

export interface FhpOccasion {
    city: string;
    venue: string;
    date: Date;
    url: string;
}

/**
 * Parsa speltillfällen ur get_event_members-HTML. År tas från närmast
 * föregående års-rubrik (occasions grupperas per år). Exporterad för test.
 */
export function parseFhpOccasions(html: string): FhpOccasion[] {
    const $ = cheerio.load(html);
    const out: FhpOccasion[] = [];
    let year = new Date().getFullYear();
    // Dokumentordning: års-rubriker och occasion-länkar i den ordning de står
    $('.event-member--list-year, .event-member--list-items a[href]').each((_i, el) => {
        if ($(el).hasClass('event-member--list-year')) {
            const y = parseInt($(el).text().trim(), 10);
            if (y > 2000 && y < 2100) year = y;
            return;
        }
        const title = ($(el).attr('title') || '').trim();   // "GRÄNGESBERG, Gruvcentrum Mojsen"
        const dateText = $(el).find('.event-date').first().text().trim();  // "15/6"
        const href = $(el).attr('href') || '';
        const dm = dateText.match(/^(\d{1,2})\/(\d{1,2})$/);
        if (!title || !dm || !href) return;
        const [rawCity, ...venueParts] = title.split(',');
        const venue = venueParts.join(',').trim() || rawCity.trim();
        const date = new Date(year, parseInt(dm[2], 10) - 1, parseInt(dm[1], 10));
        if (isNaN(date.getTime())) return;
        out.push({
            city: normalizeCaps(rawCity.trim()),
            venue,
            date,
            url: `${href}#${dm[1]}-${dm[2]}`,
        });
    });
    return out;
}

export const fhpEngine: Engine = async (_config, ctx) => {
    // 1. Alla produktions-kort
    const cards: FhpCard[] = [];
    for (let p = 1; p <= MAX_CARD_PAGES; p++) {
        const html = await postAjax(`action=get_events&pageNr=${p}&genre=&city=&search=`, ctx.signal);
        const page = parseFhpCards(html);
        if (page.length === 0) break;
        cards.push(...page);
    }
    ctx.log(`fhp: ${cards.length} produktioner`);

    // 2. Speltillfällen per produktion (throttlas av domainLimiter i postAjax)
    const events: RawEvent[] = [];
    let occasions = 0;
    for (const card of cards) {
        const html = await postAjax(
            `action=get_event_members&eventId=${card.id}&pageNr=1&city=&view=&datePremiere=`,
            ctx.signal,
        );
        for (const o of parseFhpOccasions(html)) {
            occasions++;
            if (o.date < ctx.windowStart || o.date >= ctx.windowEnd) continue;
            events.push({
                externalId: `${card.id}:${o.url}`,
                title: card.title,
                startDate: o.date,
                url: o.url,
                venueName: o.venue,
                city: o.city,
                imageUrl: card.imageUrl,
                hostName: o.venue,
                // datum utan klockslag → runnerns midnatts-heuristik (heldag)
            });
        }
    }
    ctx.log(`fhp: ${occasions} tillfällen totalt → ${events.length} i fönstret`);
    return events;
};
