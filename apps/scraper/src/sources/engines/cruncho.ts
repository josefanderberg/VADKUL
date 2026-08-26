/**
 * Cruncho-engine — event-aggregatorplattformen bakom flera destinationssajters
 * kalendrar (först ut: visitlund.se). SiteVision-webappen (t.ex.
 * 'lnd-cruncho-events') bäddar in HELA eventlistan som JSON i sidans HTML:
 *
 *   AppRegistry.registerInitialState('<portletId>',
 *       { size, totalEvents, events: [...] })
 *
 * Fallgropar (verifierade mot visitlund.se 2026-07-09):
 *  - ?offset=N är KUMULATIV (samma mönster som Studiefrämjandets kurssok):
 *    offset=1000 ger ALLA event i ETT svar — ingen sid-loop behövs.
 *  - dates[] är förekomstserien (ISO UTC). Heldag kodas som 22:00:00Z
 *    (= midnatt lokal sommartid) → lämna hasSpecificTime åt runnerns
 *    midnatts-heuristik.
 *  - description är originalspråket (svenska); engelskan ligger i
 *    translations.languages[] — rör den inte.
 *  - mapCoordinates = {lat, lng}, exakta (100 % täckning i Lund).
 *  - e.city är stadsdel+stad ("Centrala staden, Lund") → defaultCity vinner.
 */

import { RawEvent, EngineContext, Engine } from '../types';
import { dedupeSeries } from '../../scrapers/pro';
import { domainLimiter } from '../rateLimiter';
import { cleanDescription } from '../../utils/text';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface CrunchoConfig {
    /** Kalendersidan som bär registerInitialState-blobben */
    pageUrl: string;
    /**
     * Nyare Cruncho-webapp (ange.se 2026-08-26): listan ligger INTE i sidans
     * initialState utan bakom portletens egen route:
     *   GET <pageUrl>?sv.target=<portletId>&sv.<portletId>.route=/events
     *       &fromDate=YYYY-MM-DD&selectedTags=&page=N&svAjaxReqParam=ajax
     *   Header: X-Requested-With: XMLHttpRequest
     *   → { noHits, noPages, events: [{ name, from, to, uri, venue, address,
     *                                   organizer, imageUrl, description, tags }] }
     * 12/sida, INTE kumulativ. En rad per TILLFÄLLE (samma event återkommer
     * med olika uri per dag) → serie-dedup på (arrangör, titel).
     */
    eventsRoute?: { portletId: string };
    /**
     * Cruncho som HOSTAD widget (burlovlommastaffanstorp.cruncho.co,
     * vellinge.cruncho.co — upptäckt 2026-08-26). Kommunsajten bäddar in en
     * iframe; datan kommer från Crunchos eget API:
     *   POST https://api-ts.cruncho.co/landing-page/recommendations
     *        ?destination=<slug>&size=200&offset=0&sponsored=false
     *   body: { pageContext:{destinationSlug,l1:"events",…}, startDate, endDate,
     *           l2:[…], l3:[…], timezone, handpicked:false, bookable:false, free:false }
     *
     * FÄLLA: med TOMMA l2/l3 svarar API:t `[]` — inte ett fel, bara noll träffar.
     * Kategorilistorna måste hämtas först från
     *   GET /categories/with-events/<slug>?destination=<slug>&l1=events
     * GET på recommendations 404:ar; det MÅSTE vara POST.
     *
     * En destination kan spänna flera kommuner (lomma = Burlöv + Lomma +
     * Staffanstorp) — orten står per event i `city`.
     */
    hostedApi?: { destination: string; siteBase: string };
    /** Detaljsidans mall — '{id}' ersätts med eventets id. Default: <pageUrl>/evenemang?id={id} */
    eventUrlTemplate?: string;
    defaultCity?: string;
    /** Kumulativ offset som tvingar fram hela listan (default 1000) */
    offset?: number;
    userAgent?: string;
    timeoutMs?: number;
}

interface CrunchoOccurrence { startDate?: string; endDate?: string }
export interface CrunchoEvent {
    id?: string;
    name?: string;
    startDate?: string;
    endDate?: string;
    dates?: CrunchoOccurrence[];
    venue?: string;
    address?: string;
    city?: string;
    mapCoordinates?: { lat?: number; lng?: number };
    description?: string;
    photos?: { url?: string }[];
    organizer?: string | { name?: string };
    isFree?: boolean;
    price?: number | string;
    status?: string;
    hide?: boolean;
    categories?: string[];
    website?: string;
}

interface CrunchoState { totalEvents?: number; events?: CrunchoEvent[] }

/**
 * Plocka ut registerInitialState-JSON:en ur sid-HTML:en. Det kan finnas flera
 * portlets (sök-varianten + list-varianten) — vi tar den första vars state
 * har events[] + totalEvents. Brace-räkning eftersom blobben är megabyte-stor
 * och innehåller godtyckliga strängar.
 */
export function extractCrunchoState(html: string): CrunchoState | null {
    // Portlet-id:n är hex ("12.4a9fdbcc196afbc01b4dc7e") — inte bara siffror.
    const marker = /AppRegistry\.registerInitialState\('[0-9a-f.]+'\s*,/gi;
    let m: RegExpExecArray | null;
    while ((m = marker.exec(html))) {
        const start = html.indexOf('{', m.index + m[0].length - 1);
        if (start === -1) continue;
        let depth = 0;
        let end = -1;
        let inStr = false;
        for (let i = start; i < html.length; i++) {
            const c = html[i];
            if (inStr) {
                if (c === '\\') i++;
                else if (c === '"') inStr = false;
                continue;
            }
            if (c === '"') inStr = true;
            else if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) { end = i + 1; break; }
            }
        }
        if (end === -1) continue;
        try {
            const state = JSON.parse(html.slice(start, end));
            if (Array.isArray(state.events) && typeof state.totalEvents === 'number') {
                return state;
            }
        } catch { /* nästa portlet */ }
    }
    return null;
}

/**
 * Välj förekomst: första i dates[] som startar i/efter fönstret (serie-dedup —
 * ett event per produktion, som PRO/Korpen). Saknas serie → toppnivåns
 * startDate/endDate.
 */
export function pickOccurrence(
    e: CrunchoEvent,
    windowStart: Date,
): { start: Date; end?: Date } | null {
    const parse = (s?: string): Date | null => {
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    };

    const occ = (e.dates ?? [])
        .map((o) => ({ start: parse(o.startDate), end: parse(o.endDate) }))
        .filter((o): o is { start: Date; end: Date | null } => o.start !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    const upcoming = occ.find((o) => o.start >= windowStart);
    if (upcoming) return { start: upcoming.start, end: upcoming.end ?? undefined };

    const start = parse(e.startDate);
    if (!start) return null;
    return { start, end: parse(e.endDate) ?? undefined };
}

/** Mappa ett Cruncho-event → RawEvent. Exporterad för test. */
export function mapCrunchoEvent(
    e: CrunchoEvent,
    cfg: CrunchoConfig,
    windowStart: Date,
): RawEvent | null {
    if (e.hide || (e.status && e.status !== 'posted')) return null;
    const title = (e.name || '').trim();
    if (!title || !e.id) return null;

    const when = pickOccurrence(e, windowStart);
    if (!when) return null;

    const template = cfg.eventUrlTemplate
        ?? `${cfg.pageUrl.replace(/\/$/, '')}/evenemang?id={id}`;
    const url = template.replace('{id}', encodeURIComponent(e.id));

    const lat = e.mapCoordinates?.lat;
    const lng = e.mapCoordinates?.lng;
    const coords: [number, number] | undefined =
        typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng) && lat !== 0
            ? [lat, lng]
            : undefined;

    let price: string | undefined;
    if (e.isFree) price = 'Gratis';
    else if (typeof e.price === 'number' && e.price > 0) price = `${Math.round(e.price)} kr`;

    const organizer = typeof e.organizer === 'string'
        ? e.organizer.trim() || undefined
        : e.organizer?.name?.trim() || undefined;

    return {
        externalId: e.id,
        title,
        startDate: when.start,
        endDate: when.end,
        url,
        venueName: e.venue?.trim() || undefined,
        address: e.address?.trim() || undefined,
        city: cfg.defaultCity,
        coords,
        description: cleanDescription(e.description) || undefined,
        imageUrl: e.photos?.[0]?.url || undefined,
        organizer,
        category: e.categories?.[0],
        price,
    };
}

/** Rå post ur hostade Cruncho-API:t (bara fälten vi läser). */
export interface CrunchoApiEvent {
    id?: string;
    name?: string;
    description?: string;
    eventStart?: string[];        // ISO UTC, en per tillfälle
    eventEnd?: string[];
    hideEventStartTime?: boolean;
    address?: string;
    city?: string;
    eventVenueName?: string;
    organizer?: string;
    isFree?: boolean;
    /** Kronor som TAL (eller null) — inte sträng, till skillnad från gamla motorn. */
    price?: number | string | null;
    hide?: boolean;
    geometry?: { lat?: number; lng?: number };
    photos?: { url?: string }[];
}

/** Mappa en hostad Cruncho-post → ett RawEvent per tillfälle. Exporterad för test. */
export function mapCrunchoApiEvent(
    e: CrunchoApiEvent,
    cfg: CrunchoConfig,
): RawEvent[] {
    if (e.hide) return [];
    const title = (e.name || '').trim();
    const starts = e.eventStart ?? [];
    if (!title || !e.id || !starts.length) return [];

    const siteBase = cfg.hostedApi!.siteBase.replace(/\/$/, '');
    const lat = e.geometry?.lat;
    const lng = e.geometry?.lng;
    const coords: [number, number] | undefined =
        typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng) && lat !== 0
            ? [lat, lng] : undefined;

    // price är ett TAL i det hostade API:t (86/97 null, 11 number) — aldrig sträng.
    const priceNum = typeof e.price === 'number' ? e.price : Number(e.price);
    const price = e.isFree
        ? 'Gratis'
        : (isFinite(priceNum) && priceNum > 0 ? `${Math.round(priceNum)} kr` : undefined);
    const organizer = e.organizer?.trim() || undefined;
    const out: RawEvent[] = [];

    for (let i = 0; i < starts.length; i++) {
        const start = new Date(starts[i]);
        if (isNaN(start.getTime())) continue;
        const rawEnd = e.eventEnd?.[i];
        const end = rawEnd ? new Date(rawEnd) : null;
        out.push({
            externalId: e.id,
            title,
            startDate: start,
            endDate: end && !isNaN(end.getTime()) && end > start ? end : undefined,
            // Publik detaljsida: /sv-SE/place/<id> (inte /recommendation/ — den 404:ar).
            url: `${siteBase}/sv-SE/place/${e.id}#${starts[i].slice(0, 10)}`,
            venueName: e.eventVenueName?.trim() || undefined,
            address: e.address?.trim() || undefined,
            city: e.city?.trim() || cfg.defaultCity,
            coords,
            description: cleanDescription(e.description || '') || undefined,
            imageUrl: e.photos?.[0]?.url || undefined,
            organizer,
            price,
            hasSpecificTime: e.hideEventStartTime ? undefined : true,
        });
    }
    return out;
}

/** Hostad Cruncho-widget: hämta kategorier, POSTa sedan sökningen. */
async function scrapeHostedApi(
    config: CrunchoConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const { destination } = config.hostedApi!;
    const API = 'https://api-ts.cruncho.co';
    const headers = {
        'User-Agent': config.userAgent ?? DEFAULT_UA,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    let cats: { l2?: string[]; l3?: string[] };
    try {
        const r = await fetch(`${API}/categories/with-events/${destination}?destination=${destination}&l1=events`,
            { headers, signal: ctx.signal ?? AbortSignal.timeout(20_000) });
        if (!r.ok) { ctx.log(`kategori-API HTTP ${r.status}`); return []; }
        cats = await r.json();
    } catch (err) { ctx.log(`kategori-API-fel: ${(err as Error).message}`); return []; }

    // Tomma listor ⇒ API:t svarar [] utan att fela. Avbryt hellre än att tro på noll.
    if (!cats.l2?.length && !cats.l3?.length) { ctx.log('inga event-kategorier för destinationen'); return []; }

    const body = JSON.stringify({
        pageContext: { destinationSlug: destination, l1: 'events', previousL1: '', clientTime: '12:00', ip: '', area: '' },
        startDate: ctx.windowStart.toISOString(),
        endDate: ctx.windowEnd.toISOString(),
        l2: cats.l2 ?? [],
        l3: cats.l3 ?? [],
        timezone: 'Europe/Stockholm',
        handpicked: false,
        bookable: false,
        free: false,
    });

    let items: CrunchoApiEvent[];
    try {
        const r = await fetch(`${API}/landing-page/recommendations?destination=${destination}&size=200&offset=0&sponsored=false`,
            { method: 'POST', headers, body, signal: ctx.signal ?? AbortSignal.timeout(30_000) });
        if (!r.ok) { ctx.log(`recommendations HTTP ${r.status}`); return []; }
        items = await r.json();
    } catch (err) { ctx.log(`recommendations-fel: ${(err as Error).message}`); return []; }
    if (!Array.isArray(items)) { ctx.log('recommendations gav icke-lista'); return []; }

    const all: RawEvent[] = [];
    for (const it of items) all.push(...mapCrunchoApiEvent(it, config));
    const inWindow = all.filter((e) => e.startDate >= ctx.windowStart && e.startDate < ctx.windowEnd);
    // Återkommande pass ligger som upp till 65 tillfällen — behåll det första.
    const deduped = dedupeSeries(inWindow.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    ctx.log(`cruncho hostad: ${items.length} poster → ${all.length} tillfällen → ${deduped.length} efter serie-dedup`);
    return deduped;
}

/** Rå post ur /events-routen (bara fälten vi läser). */
export interface CrunchoRouteEvent {
    id?: string;
    name?: string;
    from?: string;           // "2026-08-27T10:00:00.000+02:00"
    to?: string;
    uri?: string;            // relativ sidsökväg
    venue?: string;
    address?: string;
    organizer?: string | null;
    imageUrl?: string;
    description?: string;
}

/** Mappa en /events-post → RawEvent. Exporterad för test. */
export function mapCrunchoRouteEvent(
    e: CrunchoRouteEvent,
    cfg: CrunchoConfig,
): RawEvent | null {
    const title = (e.name || '').trim();
    if (!title || !e.from || !e.uri) return null;
    const start = new Date(e.from);
    if (isNaN(start.getTime())) return null;
    const end = e.to ? new Date(e.to) : null;

    let url: string;
    try { url = new URL(e.uri, cfg.pageUrl).toString(); } catch { return null; }

    const organizer = e.organizer?.trim() || undefined;
    return {
        externalId: e.id,
        title,
        startDate: start,
        endDate: end && !isNaN(end.getTime()) && end > start ? end : undefined,
        url,
        venueName: e.venue?.trim() || undefined,
        address: e.address?.trim() || undefined,
        city: cfg.defaultCity,
        description: cleanDescription(e.description || '') || undefined,
        imageUrl: e.imageUrl || undefined,
        organizer,
        hostName: organizer,
        hasSpecificTime: !/T00:00:00/.test(e.from) ? true : undefined,
    };
}

/** Nyare Cruncho-webapp: paginera igenom portletens /events-route. */
async function scrapeEventsRoute(
    config: CrunchoConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> {
    const { portletId } = config.eventsRoute!;
    const from = ctx.windowStart.toISOString().slice(0, 10);
    const all: RawEvent[] = [];
    let noPages = 1;

    for (let page = 1; page <= Math.min(noPages, 30); page++) {
        const url = `${config.pageUrl}?sv.target=${portletId}`
            + `&sv.${portletId}.route=/events&fromDate=${from}&selectedTags=&page=${page}&svAjaxReqParam=ajax`;
        let data: { noHits?: number; noPages?: number; events?: CrunchoRouteEvent[] };
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': config.userAgent ?? DEFAULT_UA,
                    'Accept': 'application/json',
                    // UTAN denna svarar servern med hela HTML-sidan.
                    'X-Requested-With': 'XMLHttpRequest',
                },
                signal: ctx.signal ?? AbortSignal.timeout(config.timeoutMs ?? 25_000),
            });
            if (!res.ok) { ctx.log(`/events HTTP ${res.status} (page=${page})`); break; }
            data = await res.json();
        } catch (err) {
            ctx.log(`/events-fel page=${page}: ${(err as Error).message}`);
            break;
        }
        if (typeof data.noPages === 'number') noPages = data.noPages;
        const items = data.events ?? [];
        if (!items.length) break;
        for (const it of items) {
            const ev = mapCrunchoRouteEvent(it, config);
            if (ev) all.push(ev);
        }
    }

    // En rad per tillfälle → behåll första tillfället per (arrangör, titel).
    const deduped = dedupeSeries(all.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    ctx.log(`cruncho /events: ${all.length} tillfällen → ${deduped.length} efter serie-dedup`);
    return deduped;
}

export const crunchoEngine = async (
    config: CrunchoConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    if (config.hostedApi) return scrapeHostedApi(config, ctx);
    if (config.eventsRoute) return scrapeEventsRoute(config, ctx);

    const sep = config.pageUrl.includes('?') ? '&' : '?';
    const url = `${config.pageUrl}${sep}offset=${config.offset ?? 1000}`;

    await domainLimiter.wait(url);
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), config.timeoutMs ?? 60000);
    let html: string;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': config.userAgent ?? DEFAULT_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
            },
            redirect: 'follow',
            signal: ctx.signal ?? ac.signal,
        });
        if (!res.ok) { ctx.log(`HTTP ${res.status} från ${url}`); return []; }
        html = await res.text();
    } catch (err) {
        ctx.log(`fetch misslyckades: ${(err as Error).message}`);
        return [];
    } finally {
        clearTimeout(t);
    }

    const state = extractCrunchoState(html);
    if (!state) { ctx.log('ingen registerInitialState med events[] i sidan'); return []; }

    const events: RawEvent[] = [];
    for (const e of state.events ?? []) {
        const ev = mapCrunchoEvent(e, config, ctx.windowStart);
        if (ev) events.push(ev);
    }
    ctx.log(`cruncho: ${state.events?.length ?? 0} i state (totalEvents=${state.totalEvents}) → ${events.length} mappade`);
    return events;
};
