/**
 * ABF (studieförbund) — evenemang via sök-sidans server-renderade HTML.
 *
 * Recon 2026-06-12 (verifierat): abf.se är WordPress + HTMX — söksidan ÄR
 * API:et, svaret är komplett HTML med stabila BEM-klasser:
 *
 *   GET https://www.abf.se/kurs-sok/?type=event&page=N      (9 kort/sida)
 *
 * type=event skiljer "Evenemang (736)" från "Kurser (1639)" — inbyggd
 * separation. Kortet har Plats (ort), titel + absolut länk, <time datetime=
 * "YYYY-MM-DD"> och <time datetime="HH.MM">. Ingen gatuadress i listan
 * (detaljsidan har, men 736 detaljfetchar sparas tills behov finns —
 * ort-nivå-geokodning är godkänd fallback).
 *
 * OBS: /wp-json/abf/v1/search är nonce-401 — gå via söket. Yoast-sitemapen
 * innehåller INTE kurser/event.
 */

import * as cheerio from 'cheerio';
import { RawEvent, Engine } from '../sources/types';
import { cleanDescription } from '../utils/text';
import { mapPool } from '../utils/mapPool';

const SEARCH = 'https://www.abf.se/kurs-sok/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_PAGES = 120;
/** Detaljsidor hämtas BARA för nya event, och högst så här många per körning. */
const MAX_DETAIL_FETCH = 80;
const DETAIL_CONCURRENCY = 4;

/**
 * Beskrivning ur detaljsidans og:description / meta description (WordPress/
 * Yoast). Alla 355 ABF-event hade bara platshållaren "ABF-evenemang i X."
 * (revisionen 2026-09-03). Exporterad för test.
 */
export function parseAbfDescription(html: string): string | undefined {
    const m = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,})["']/i)
        || html.match(/<meta[^>]+content=["']([^"']{20,})["'][^>]+property=["']og:description["']/i)
        || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,})["']/i);
    if (!m) return undefined;
    const d = cleanDescription(m[1]);
    return d.length >= 20 ? d : undefined;
}

async function fetchAbfDescription(url: string, signal?: AbortSignal): Promise<string | undefined> {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'text/html' },
            signal: signal ?? AbortSignal.timeout(20_000),
        });
        if (!res.ok) return undefined;
        return parseAbfDescription(await res.text());
    } catch {
        return undefined;
    }
}

/** Parsa ett sök-sidans HTML → RawEvents. Exporterad för test. */
export function parseAbfPage(html: string): RawEvent[] {
    const $ = cheerio.load(html);
    const out: RawEvent[] = [];
    $('article.EventCard').each((_i, el) => {
        const card = $(el);
        const a = card.find('.EventCard-title a').first();
        const title = a.text().replace(/\s+/g, ' ').trim();
        const url = (a.attr('href') || '').trim();
        if (!title || !url) return;

        const dateStr = card.find('.EventCard-date time').first().attr('datetime') || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
        const timeStr = card.find('.EventCard-time time').first().attr('datetime') || '';
        const t = timeStr.match(/^(\d{1,2})[.:](\d{2})$/);

        const startDate = new Date(`${dateStr}T${t ? `${t[1].padStart(2, '0')}:${t[2]}` : '00:00'}:00`);
        if (isNaN(startDate.getTime())) return;

        const city = card.find('.EventCard-location strong').first().text().trim() || undefined;
        const img = card.find('.EventCard-image img').first().attr('src') || undefined;

        out.push({
            title,
            startDate,
            url: url.startsWith('http') ? url : `https://www.abf.se${url}`,
            city,
            venueName: city,
            imageUrl: img,
            description: `ABF-evenemang${city ? ` i ${city}` : ''}.`,
            hostName: 'ABF',
            hasSpecificTime: !!t,
        });
    });
    return out;
}

export const abfEngine: Engine = async (_config, ctx) => {
    const all: RawEvent[] = [];
    let page = 1;
    while (page <= MAX_PAGES) {
        let html: string | null = null;
        try {
            const res = await fetch(`${SEARCH}?type=event&page=${page}`, {
                headers: { 'User-Agent': UA, 'Accept': 'text/html' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`HTTP ${res.status} på sida ${page}`); break; }
            html = await res.text();
        } catch (err) {
            ctx.log(`sida ${page}: ${(err as Error).message}`);
            break;
        }
        const events = parseAbfPage(html);
        if (events.length === 0) break;   // slut på kort = sista sidan passerad
        all.push(...events);
        page++;
    }
    ctx.log(`${all.length} evenemang över ${page - 1} sidor`);

    // Riktig beskrivning för NYA event (kända hoppas — deras text refreshas
    // av runnern vid full-refresh). Tak per körning så en tom DB inte ger
    // 700 detaljhämtningar på en natt.
    const nya: RawEvent[] = [];
    for (const e of all) {
        if (nya.length >= MAX_DETAIL_FETCH) break;
        if (ctx.refreshKnown || !ctx.isKnownUrl || !(await ctx.isKnownUrl(e.url))) nya.push(e);
    }
    if (nya.length) {
        let enriched = 0;
        await mapPool(nya, DETAIL_CONCURRENCY, async (e) => {
            const desc = await fetchAbfDescription(e.url, ctx.signal);
            if (desc) { e.description = desc; enriched++; }
        });
        ctx.log(`${enriched}/${nya.length} nya event fick beskrivning från detaljsidan`);
    }
    return all;
};
