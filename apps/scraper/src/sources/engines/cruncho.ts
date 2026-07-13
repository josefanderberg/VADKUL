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

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { cleanDescription } from '../../utils/text';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface CrunchoConfig {
    /** Kalendersidan som bär registerInitialState-blobben */
    pageUrl: string;
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

export const crunchoEngine = async (
    config: CrunchoConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
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
