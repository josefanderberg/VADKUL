/**
 * GoToHub-engine — Visit Groups destinationsplattform (först ut:
 * visitskelleftea.se, upptäckt 2026-08-20 via deras gotohub.online-widget).
 *
 * Sajterna är Umbraco-frontade och renderar eventlistan client-side via en
 * Alpine-komponent ("listing") som hämtar HTML-FRAGMENT från:
 *
 *   GET <baseUrl>/front/components/List/Search
 *       ?locale=sv-SE&view=ListView&page=N&pageSize=48&types=event&categories=events
 *
 * Svar: HTML med eventkort; pagineringen ligger i SVARSHEADERS
 * (page-total = antal event totalt, page-size, page-index). Filtren
 * serialiseras som `&grupp=nyckel` (types=event), INTE `grupp.nyckel=true`.
 *
 * Korten länkar till detaljsidor (t.ex. /sv/evenemangsarkiv/<slug>/) som bär
 * KOMPLETT JSON-LD Event (name, description, startDate/endDate,
 * location.Place.address) — så detaljparsningen återanvänder json-ld-motorns
 * exporterade helpers rakt av. Kända URL:er hoppas över via ctx.isKnownUrl
 * (kostnadsoptimering — dedup sker ändå i runnern).
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import {
    extractJsonLdBlocks, collectEvents, jsonLdToRawEvent, DEFAULT_EVENT_TYPES,
} from './json-ld';

export interface GotohubConfig {
    /** Sajtens origin, utan avslutande snedstreck: https://visitskelleftea.se */
    baseUrl: string;
    /** default 'sv-SE' */
    locale?: string;
    /** default '/front/components/List/Search' */
    listPath?: string;
    /** Extra query-filter, default 'types=event&categories=events' */
    filters?: string;
    /** Vilka länkar i list-fragmentet som är event-detaljsidor */
    detailPattern?: RegExp;
    defaultCity?: string;
    /** Säkerhetstak för list-sidor (page-total styr annars). Default 30. */
    maxPages?: number;
    /** Max detaljsidor som hämtas per körning. Default 250. */
    maxDetails?: number;
    userAgent?: string;
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_SIZE = 48;

/** Plocka detaljside-URL:er ur ett list-fragment (exporterad för test). */
export function extractDetailUrls(fragment: string, baseUrl: string, pattern: RegExp): string[] {
    const out = new Set<string>();
    for (const m of fragment.matchAll(/href="([^"#?]+)"/gi)) {
        const href = m[1];
        if (!pattern.test(href)) continue;
        try {
            const abs = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
            if (abs.startsWith(baseUrl)) out.add(abs);
        } catch { /* trasig href */ }
    }
    return [...out];
}

/**
 * Koordinater ur detaljsidans kartlänkar: "maps.google.com/maps?q=64.70,21.16"
 * eller inbäddade iframes ("!3d<lat>!2d<lng>"). Exporterad för test.
 * Returordning [lat, lng] — samma som json-ld-motorns pickGeo.
 */
export function extractMapsCoords(html: string): [number, number] | undefined {
    const q = html.match(/maps\.google\.[a-z.]+\/maps\?q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i);
    if (q) return [parseFloat(q[1]), parseFloat(q[2])];
    const iframe = html.match(/!3d(-?\d{1,2}\.\d+).*?!2d(-?\d{1,3}\.\d+)|!2d(-?\d{1,3}\.\d+).*?!3d(-?\d{1,2}\.\d+)/);
    if (iframe) {
        const lat = parseFloat(iframe[1] ?? iframe[4]);
        const lng = parseFloat(iframe[2] ?? iframe[3]);
        if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
    }
    return undefined;
}

async function fetchText(url: string, ua: string): Promise<{ ok: boolean; body: string; headers: Headers }> {
    await domainLimiter.wait(url);
    const res = await fetchWithRetry(url, { headers: { 'User-Agent': ua, 'Accept-Language': 'sv' } });
    return { ok: res.ok, body: res.ok ? await res.text() : '', headers: res.headers };
}

export const gotohubEngine = async (config: GotohubConfig, ctx: EngineContext): Promise<RawEvent[]> => {
    const base = config.baseUrl.replace(/\/$/, '');
    const locale = config.locale ?? 'sv-SE';
    const listPath = config.listPath ?? '/front/components/List/Search';
    const filters = config.filters ?? 'types=event&categories=events';
    const pattern = config.detailPattern ?? /\/evenemangsarkiv\//i;
    const maxPages = config.maxPages ?? 30;
    const maxDetails = config.maxDetails ?? 250;
    const ua = config.userAgent ?? UA;

    // 1. Paginera list-fragmenten och skörda detaljside-URL:er
    const detailUrls = new Set<string>();
    let totalPages = 1;
    for (let page = 1; page <= Math.min(totalPages, maxPages); page++) {
        const url = `${base}${listPath}?locale=${locale}&view=ListView&page=${page}&pageSize=${PAGE_SIZE}&${filters}`;
        const r = await fetchText(url, ua);
        if (!r.ok) { ctx.log(`  list-sida ${page} misslyckades`); break; }
        if (page === 1) {
            const total = parseInt(r.headers.get('page-total') ?? '0', 10);
            const size = parseInt(r.headers.get('page-size') ?? String(PAGE_SIZE), 10) || PAGE_SIZE;
            totalPages = Math.max(1, Math.ceil(total / size));
            ctx.log(`  page-total=${total} → ${totalPages} listsidor`);
        }
        extractDetailUrls(r.body, base, pattern).forEach((u) => detailUrls.add(u));
    }
    ctx.log(`  ${detailUrls.size} unika detaljsidor hittade`);

    // 2. Detaljsidor → JSON-LD Event. Kända URL:er hoppas över (utom refresh).
    const events: RawEvent[] = [];
    let fetched = 0;
    let skippedKnown = 0;
    for (const url of detailUrls) {
        if (fetched >= maxDetails) { ctx.log(`  maxDetails=${maxDetails} nått — resten tas nästa körning`); break; }
        if (!ctx.refreshKnown && ctx.isKnownUrl && await ctx.isKnownUrl(url)) { skippedKnown++; continue; }
        const r = await fetchText(url, ua);
        fetched++;
        if (!r.ok) continue;
        const nodes: any[] = [];
        for (const block of extractJsonLdBlocks(r.body)) collectEvents(block, DEFAULT_EVENT_TYPES, nodes);

        // Sajternas JSON-LD har TOM PostalAddress, men detaljsidan bär en
        // Google Maps-länk med exakta koordinater (?q=<lat>,<lng>) — samma
        // trick som visit.norrkoping-källans kart-iframe. Ingen geokodning
        // behövs när den träffar.
        const coords = extractMapsCoords(r.body);

        for (const node of nodes) {
            const ev = jsonLdToRawEvent(node, url);
            if (!ev) continue;
            if (!ev.city && config.defaultCity) ev.city = config.defaultCity;
            if (!ev.coords && coords) ev.coords = coords;
            events.push(ev);
        }
    }
    ctx.log(`  ${events.length} events ur ${fetched} detaljsidor (${skippedKnown} kända hoppade)`);
    return events;
};
