/**
 * skordefest — Ölands Skördefest (skordefest.nu), öns största evenemang.
 *
 * Vi hämtar sajtens **aktiviteter** (CPT `aktivitet`, ~25 st): dockparaden,
 * konstnatten, fårets dagar, skördefestorienteringen, byarnas egna program.
 * Det är festivalens faktiska programpunkter.
 *
 * MEDVETET BORTVALT: sajten har också ~330 `alla-deltagare`-sidor (varje
 * gårdsbutik, galleri och ateljé som håller öppet). De går att skrapa på exakt
 * samma sätt — POST /wp-admin/admin-ajax.php med action=filter_projects (sida 1)
 * respektive filter_projects_load (sida 2..N), parametrarna MÅSTE heta
 * categories[]/tags[]/days[]/communities[] annars svarar WP 500 — och 322 av
 * dem har exakta koordinater. Vi tar dem INTE: 330 event med samma datum
 * dränker både kartan och det dagliga social-urvalet (digest-daily plockar 10).
 * Josef valde aktiviteterna 2026-08-31. Ändra bara efter nytt ägarbeslut.
 *
 * Datum finns inte per aktivitet — bara festivalens spann, som står på
 * startsidan ("23 -27 september 2026"). Det läses varje körning så källan
 * följer med till nästa år av sig själv; går det inte att läsa returnerar
 * motorn tomt i stället för att gissa. Aktiviteter som har en EGEN dag i
 * titeln ("Konstnatten 25 sept 2026") får den dagen i stället för spannet.
 *
 * Koordinater, i fallande ordning:
 *   1. Aktivitetens egen `var coordinates = [{…}]` (4 av 25) — ligger inuti en
 *      HTML-kommentar men är fullt läsbar.
 *   2. Första länkade deltagarsidans koordinater (15 av 25) — en aktivitet är
 *      ofta en behållare för deltagarkort, och DE har alltid koordinater.
 *   3. Ortnamnet ur "Område: Mellersta Öland, Borgholm" som stad → byns
 *      centroid i stället för öns.
 *
 * Fällor:
 *  - Slug ≠ år. `/aktivitet/ostfestivalen-2024/` heter "Ostfestivalen i
 *    Mörbylånga 2026" — de återanvänder inläggen och byter titel. Filtrera
 *    ALDRIG på slug-året.
 *  - `/aktivitet/` och `/aktivitet/feed/` ligger i sitemapen men är index.
 */

import * as cheerio from 'cheerio';
import { Engine, RawEvent } from '../sources/types';
import { parseSwedishDate, findFirstDateInText } from '../utils/swedishDate';
import { decodeHtmlEntities, cleanDescription } from '../utils/text';
import { domainLimiter } from '../sources/rateLimiter';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface SkordefestConfig {
    /** Default https://skordefest.nu */
    baseUrl?: string;
    /** Fallback-stad när varken koordinater eller område finns. Default 'Öland'. */
    defaultCity?: string;
    /** Max aktiviteter per körning. Default 60 (sajten har ~25). */
    maxActivities?: number;
}

const DEFAULT_BASE = 'https://skordefest.nu';

/** Allt vi får ur en aktivitets detaljsida. Exporterad för test. */
export interface SkordefestActivity {
    title: string;
    description?: string;
    imageUrl?: string;
    coords?: [number, number];
    /** Ortnamnet ur "Område: Mellersta Öland, Borgholm" → "Borgholm". */
    place?: string;
    /** Länkade deltagarsidor — bär koordinater när aktiviteten själv saknar. */
    participantUrls: string[];
}

/**
 * Festivalens datumspann ur startsidans text. Klarar både
 * "23 -27 september 2026" och "30 september - 4 oktober 2026".
 * Exporterad för test.
 */
export function parseFestivalRange(html: string, now = new Date()): { start: Date; end: Date } | null {
    const text = decodeHtmlEntities(
        html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '),
    ).replace(/\s+/g, ' ');
    const MONTH = '(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)';

    // "30 september - 4 oktober 2026" (spann över månadsskifte)
    const twoMonths = text.match(new RegExp(`(\\d{1,2})\\s+(${MONTH})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(\\d{4})`, 'i'));
    if (twoMonths) {
        const start = parseSwedishDate(`${twoMonths[1]} ${twoMonths[2]} ${twoMonths[5]}`, now);
        const end = parseSwedishDate(`${twoMonths[3]} ${twoMonths[4]} ${twoMonths[5]}`, now);
        if (start && end && end >= start) return { start, end };
    }

    // "23 -27 september 2026" (en månad)
    const oneMonth = text.match(new RegExp(`(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})\\s+(${MONTH})\\s+(\\d{4})`, 'i'));
    if (oneMonth) {
        const start = parseSwedishDate(`${oneMonth[1]} ${oneMonth[3]} ${oneMonth[4]}`, now);
        const end = parseSwedishDate(`${oneMonth[2]} ${oneMonth[3]} ${oneMonth[4]}`, now);
        if (start && end && end >= start) return { start, end };
    }
    return null;
}

/** Koordinatraden (`var coordinates = […]`). Öland-sanity så fel-taggade hoppas. */
export function parseCoordinates(html: string): [number, number] | undefined {
    const m = html.match(/var\s+coordinates\s*=\s*\[\s*\{[^}]*"lat"\s*:\s*"?(-?\d+(?:\.\d+)?)"?[^}]*"lng"\s*:\s*"?(-?\d+(?:\.\d+)?)"?/);
    if (!m) return undefined;
    const lat = Number(m[1]), lng = Number(m[2]);
    if (lat >= 56.0 && lat <= 57.6 && lng >= 16.0 && lng <= 17.4) return [lat, lng];
    return undefined;
}

/** Aktivitetens detaljsida → titel/beskrivning/bild/koordinater/område. Exporterad för test. */
export function parseActivityPage(html: string, baseUrl: string): SkordefestActivity | null {
    const $ = cheerio.load(html);
    const title = decodeHtmlEntities($('.single-hero__inner__title').first().text().replace(/\s+/g, ' ').trim());
    if (!title) return null;

    const participantUrls: string[] = [];
    const seen = new Set<string>();
    $('a[href*="/alla-deltagare/"]').each((_i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        try {
            const abs = new URL(href, baseUrl).toString();
            if (!seen.has(abs)) { seen.add(abs); participantUrls.push(abs); }
        } catch { /* trasig href */ }
    });

    // "Område:Mellersta Öland, Borgholm" → "Borgholm". Första segmentet är
    // landsdelen (Norra/Mellersta/Södra Öland) och duger inte som stad.
    let place: string | undefined;
    const areaRaw = $('.swiper-slide__area').first().text().replace(/\s+/g, ' ').replace(/^Område:\s*/i, '').trim();
    if (areaRaw.includes(',')) {
        const tail = areaRaw.split(',').pop()!.trim();
        if (tail && !/öland$/i.test(tail)) place = tail;
    }

    // Ingressen ligger i .single-content__left; är den tom (många aktiviteter
    // har bara bild) tas og:description och sist första deltagarkortets text.
    const candidates = [
        $('.single-content__left').first().text(),
        $('meta[property="og:description"]').attr('content') || '',
        $('.members-card-info__excerpt').first().text(),
    ];
    let description: string | undefined;
    for (const c of candidates) {
        const clean = decodeHtmlEntities(c).replace(/\s+/g, ' ').trim();
        if (clean.length >= 25) { description = cleanDescription(clean); break; }
    }

    let imageUrl = $('img.background__image').first().attr('src') || undefined;
    if (imageUrl) {
        try { imageUrl = new URL(imageUrl, baseUrl).toString(); } catch { imageUrl = undefined; }
    }

    return { title, description, imageUrl, coords: parseCoordinates(html), place, participantUrls };
}

/**
 * "Kallbadhuset 2026" → "Kallbadhuset". Årtalet är hur deltagarna namnger sig,
 * inte del av namnet. Exporterad för test.
 */
export function stripYearSuffix(title: string): string {
    return title.replace(/[\s,–-]*\b(19|20)\d{2}\b\s*$/, '').trim() || title.trim();
}

/**
 * Titel för kartan. Aktiviteterna heter t.ex. "Dockparaden" — utan prefix
 * syns inte att det är Skördefesten. Titlar som redan säger det lämnas i fred
 * ("Skördefest i Färjestadens hamn"). Exporterad för test.
 */
export function buildEventTitle(rawTitle: string): string {
    const name = stripYearSuffix(rawTitle);
    return /skördefest|skördeyra|skordefest/i.test(name) ? name : `Skördefest: ${name}`;
}

async function fetchHtml(url: string, signal?: AbortSignal): Promise<string | null> {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: signal ?? AbortSignal.timeout(20_000) });
        if (!res.ok) return null;
        return await res.text();
    } catch { return null; }
}

/** <loc>-URL:erna ur activity-sitemap.xml, utan index- och feed-sidorna. */
export function parseActivitySitemap(xml: string): string[] {
    const out: string[] = [];
    for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        const url = m[1];
        if (!/\/aktivitet\/[^/]+\/?$/.test(url)) continue;   // /aktivitet/ självt
        if (/\/feed\/?$/.test(url)) continue;
        out.push(url);
    }
    return out;
}

export const skordefestEngine: Engine = async (config, ctx) => {
    const cfg = (config ?? {}) as SkordefestConfig;
    const baseUrl = (cfg.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
    const fallbackCity = cfg.defaultCity ?? 'Öland';
    const maxActivities = cfg.maxActivities ?? 60;

    // 1. Festivalens datum — utan dem har vi inget att datera aktiviteterna med.
    await domainLimiter.wait(baseUrl);
    const frontHtml = await fetchHtml(`${baseUrl}/`, ctx.signal);
    const range = frontHtml ? parseFestivalRange(frontHtml) : null;
    if (!range) {
        ctx.log('skordefest: hittade inget festivaldatum på startsidan — avbryter (gissar hellre inte)');
        return [];
    }
    ctx.log(`skordefest: festivalen ${range.start.toLocaleDateString('sv-SE')} – ${range.end.toLocaleDateString('sv-SE')}`);

    // 2. Aktivitets-URL:erna.
    await domainLimiter.wait(baseUrl);
    const sitemap = await fetchHtml(`${baseUrl}/activity-sitemap.xml`, ctx.signal);
    if (!sitemap) { ctx.log('skordefest: activity-sitemap.xml svarade inte'); return []; }
    const urls = parseActivitySitemap(sitemap).slice(0, maxActivities);
    ctx.log(`skordefest: ${urls.length} aktiviteter i sitemapen`);

    // 3. En detaljsida per aktivitet, plus en deltagarsida när koordinater saknas.
    const events: RawEvent[] = [];
    let ownCoords = 0, viaParticipant = 0, noCoords = 0, skippedKnown = 0;
    for (const url of urls) {
        if (!ctx.refreshKnown && ctx.isKnownUrl && (await ctx.isKnownUrl(url))) { skippedKnown++; continue; }

        await domainLimiter.wait(baseUrl);
        const html = await fetchHtml(url, ctx.signal);
        if (!html) continue;
        const act = parseActivityPage(html, baseUrl);
        if (!act) continue;

        let coords = act.coords;
        if (coords) {
            ownCoords++;
        } else if (act.participantUrls.length > 0) {
            await domainLimiter.wait(baseUrl);
            const pHtml = await fetchHtml(act.participantUrls[0], ctx.signal);
            if (pHtml) coords = parseCoordinates(pHtml);
            if (coords) viaParticipant++; else noCoords++;
        } else {
            noCoords++;
        }

        // Egen dag i titeln ("Konstnatten 25 sept 2026") slår festivalspannet —
        // men bara om den faktiskt ligger inom festivalen.
        const titleDate = findFirstDateInText(act.title);
        const ownDay = titleDate && titleDate >= range.start && titleDate <= range.end ? titleDate : null;

        events.push({
            title: buildEventTitle(act.title),
            startDate: ownDay ?? new Date(range.start),
            endDate: ownDay ? undefined : new Date(range.end),
            url,
            venueName: stripYearSuffix(act.title),
            city: act.place ?? fallbackCity,
            coords,
            description: act.description,
            imageUrl: act.imageUrl,
            // Programpunkter med öppettider, inte klockslag — dagsevent.
            hasSpecificTime: false,
        });
    }
    ctx.log(`skordefest: ${events.length} event (${ownCoords} egna koordinater, ${viaParticipant} via deltagarsida, ${noCoords} utan, ${skippedKnown} kända hoppades över)`);
    return events;
};
