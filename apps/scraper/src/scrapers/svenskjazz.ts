/**
 * svenskjazz — Engine för Svensk Jazz riksförbunds spelningskalender
 * (svenskjazz.se, WordPress med custom post type `event`).
 *
 * Listan hämtas via wp-json (`/wp/v2/event`, ~239 gig nationellt vid proben
 * 2026-09-04/13) men API:t bär BARA titel + länk — datum, ort, scen och
 * beskrivning ligger enbart i detaljsidans markup:
 *
 *   <div class="sjz_event_post_start_date"> <span>15</span> <span>Dec</span></div>
 *   <span class="sjz_event_post_location">Stockholm, Fasching kl 20:00</span>
 *   <span class="sjz_event_post_organizer"><b>Arrangör:</b> Fasching</span>
 *
 * DATUM SAKNAR ÅR — nästa förekomst antas (kalendern listar bara kommande
 * gig; "15 Dec" i september = i år, "15 Jan" = nästa år). Ingen veckodag
 * finns att validera mot, så inferensen är ren nästa-förekomst.
 *
 * VÄRDEFILTRET: gig vars detaljsida länkar till Nortic HOPPAS ÖVER. Hela
 * Nortic-inventariet ingestas redan via `nortic`-källans öppna API, och
 * Fasching-mätningen 13/9 visade att storklubbsgig redan låg TRIPPELT
 * (nortic.se + tickets.nortic.se + Facebook) — en fjärde URL för samma
 * spelning vore ren dubblettsmuts. Det unika värdet är klubbarna som säljer
 * i dörren eller via annat — ofta i just de tunna städerna.
 */

import { Engine, RawEvent } from '../sources/types';
import { domainLimiter } from '../sources/rateLimiter';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { cleanDescription, decodeHtmlEntities } from '../utils/text';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const API_BASE = 'https://svenskjazz.se/wp-json/wp/v2/event';
const MAX_PAGES = 5; // 5 × 100 — kalendern låg på ~239 vid bygget

export interface SvenskJazzConfig {
    /** Cap på antal detaljsidor per körning (default: obegränsat inom listan). */
    maxDetails?: number;
}

const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, maj: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11,
};

/**
 * "15" + "Dec" → nästa förekomst av det datumet räknat från `now`
 * (dagens datum räknas som kommande — kvällens gig ska med).
 * Exporterad för test.
 */
export function parseSjzDate(day: string, monthAbbr: string, now: Date): Date | null {
    const d = parseInt(day, 10);
    const m = MONTHS[monthAbbr.slice(0, 3).toLowerCase()];
    if (!isFinite(d) || d < 1 || d > 31 || m === undefined) return null;
    const candidate = new Date(now.getFullYear(), m, d);
    // Ogiltig kombination (31 feb rullar över till mars) — lita inte på den.
    if (candidate.getMonth() !== m) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
    if (candidate.getMonth() !== m) return null; // skottdagsrullning efter årsbytet
    return candidate;
}

/**
 * "Stockholm, Fasching kl 20:00" → ort, scen och ev. klockslag.
 * Varianter som förekommer: utan klockslag, utan scen ("Umeå kl 19"),
 * scen med kommatecken i namnet hålls ihop (allt efter FÖRSTA kommat).
 * Exporterad för test.
 */
export function parseSjzLocation(raw: string): { city?: string; venueName?: string; hour?: number; minute?: number } {
    let text = decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim();
    let hour: number | undefined;
    let minute: number | undefined;
    const timeMatch = text.match(/\bkl\.?\s*(\d{1,2})(?:[:.](\d{2}))?/i);
    if (timeMatch) {
        const h = parseInt(timeMatch[1], 10);
        if (h >= 0 && h <= 23) {
            hour = h;
            minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        }
        text = (text.slice(0, timeMatch.index) + text.slice((timeMatch.index ?? 0) + timeMatch[0].length)).trim();
    }
    const commaIdx = text.indexOf(',');
    const city = (commaIdx >= 0 ? text.slice(0, commaIdx) : text).trim() || undefined;
    const venueName = commaIdx >= 0 ? text.slice(commaIdx + 1).trim().replace(/,\s*$/, '') || undefined : undefined;
    return { city, venueName, hour, minute };
}

/** Detaljsidan länkar till Nortic ⇒ giget täcks redan av nortic-källan. */
export function hasNorticLink(html: string): boolean {
    return /href="https?:\/\/(?:www\.|tickets\.)?nortic\.se\//i.test(html);
}

const RE_DATE = /sjz_event_post_start_date">\s*<span>(\d{1,2})<\/span>\s*<span>([A-Za-zÅÄÖåäö]{3,4})<\/span>/;
const RE_LOCATION = /sjz_event_post_location">([^<]+)</;
const RE_ORGANIZER = /sjz_event_post_organizer">(?:<b>[^<]*<\/b>)?\s*([^<]+)</;
const RE_DESCRIPTION = /sjz_event_post_description">([^<]+)</;
const RE_OG_IMAGE = /property="og:image"\s+content="([^"]+)"/;

/**
 * Detaljsidans HTML → RawEvent. null = hoppa (trasigt datum, Nortic-täckt).
 * Exporterad för test.
 */
export function mapSjzDetail(url: string, title: string, html: string, now: Date): RawEvent | null {
    if (hasNorticLink(html)) return null;
    const dateMatch = html.match(RE_DATE);
    if (!dateMatch) return null;
    const startDate = parseSjzDate(dateMatch[1], dateMatch[2], now);
    if (!startDate) return null;

    const locMatch = html.match(RE_LOCATION);
    const loc = locMatch ? parseSjzLocation(locMatch[1]) : {};
    if (loc.hour !== undefined) startDate.setHours(loc.hour, loc.minute ?? 0, 0, 0);

    const orgMatch = html.match(RE_ORGANIZER);
    const descMatch = html.match(RE_DESCRIPTION);
    const imgMatch = html.match(RE_OG_IMAGE);

    return {
        title: decodeHtmlEntities(title).trim(),
        startDate,
        url,
        city: loc.city,
        venueName: loc.venueName,
        organizer: orgMatch ? decodeHtmlEntities(orgMatch[1]).trim() || undefined : undefined,
        description: descMatch ? cleanDescription(decodeHtmlEntities(descMatch[1])) || undefined : undefined,
        imageUrl: imgMatch ? imgMatch[1] : undefined,
        category: 'music',
        classifyHints: 'jazz konsert livemusik',
        hasSpecificTime: loc.hour !== undefined,
    };
}

interface WpEventItem {
    link?: string;
    title?: { rendered?: string };
}

export const svenskJazzEngine: Engine = async (config: SvenskJazzConfig, ctx) => {
    // 1) Lista alla gig via wp-json (bara länk + titel finns där).
    const items: WpEventItem[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        await domainLimiter.wait(API_BASE);
        let batch: WpEventItem[];
        try {
            const res = await fetchWithRetry(`${API_BASE}?per_page=100&page=${page}`, {
                headers: { 'User-Agent': UA, Accept: 'application/json' },
            }, { signal: ctx.signal, timeoutPerAttemptMs: 20_000, label: 'svenskjazz-lista' });
            if (!res.ok) break; // WP svarar 400 på sidan efter sista
            batch = await res.json() as WpEventItem[];
        } catch (err) {
            ctx.log(`svenskjazz: listfel sida ${page}: ${(err as Error).message}`);
            break;
        }
        items.push(...batch);
        if (batch.length < 100) break;
    }
    ctx.log(`svenskjazz: ${items.length} gig i wp-listan`);

    // 2) Detaljsidorna bär datum/ort/scen — hämta och mappa.
    const now = new Date();
    const events: RawEvent[] = [];
    const seen = new Set<string>();
    let norticSkipped = 0;
    let noDate = 0;
    const cap = config.maxDetails ?? Infinity;
    for (const item of items) {
        if (events.length + norticSkipped + noDate >= cap) break;
        const url = item.link;
        const title = item.title?.rendered;
        if (!url || !title || seen.has(url)) continue;
        seen.add(url);
        await domainLimiter.wait(url);
        let html: string;
        try {
            const res = await fetchWithRetry(url, {
                headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.1' },
            }, { signal: ctx.signal, timeoutPerAttemptMs: 20_000, label: 'svenskjazz-detalj' });
            if (!res.ok) continue;
            html = await res.text();
        } catch {
            continue;
        }
        if (hasNorticLink(html)) { norticSkipped++; continue; }
        const ev = mapSjzDetail(url, title, html, now);
        if (!ev) { noDate++; continue; }
        events.push(ev);
    }
    ctx.log(`svenskjazz: ${events.length} event (${norticSkipped} Nortic-täckta skippade, ${noDate} utan tolkbart datum)`);
    return events;
};
