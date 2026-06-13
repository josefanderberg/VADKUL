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

const SEARCH = 'https://www.abf.se/kurs-sok/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_PAGES = 120;

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
    return all;
};
