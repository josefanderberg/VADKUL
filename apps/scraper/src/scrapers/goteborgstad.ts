/**
 * Göteborgs Stads kalendarium (goteborg.se) — kommunens EGEN eventkalender
 * (bibliotek, kulturhus, parker, idrott, sommarlov), skild från goteborg.com
 * (Göteborg & Co) som redan är täckt av andra källor.
 *
 * WebSphere-portalen på goteborg.se är bara ett skal — React-modulen
 * "kalendarium-frontend" pratar med en öppen mikrotjänst (upptäckt 2026-07-23
 * genom att grep:a config_js-bundeln efter serviceUrl; värdet står även i
 * klartext i list-sidans data-settings-attribut):
 *
 *   GET https://microservices.goteborg.se/ua/kalendariet/public/activities/?page=0&size=200
 *   → { content: [...], totalElements, totalPages, last, ... }   (Spring-paginering)
 *
 * Default-listningen är kommande-sorterad från idag (~5500 rader vid upptäckt).
 * fromDate/toDate-params finns men returnerar även långkörare vars spann rör
 * fönstret — vi tar default-listan och låter runnern fönsterklippa.
 *
 * Fallgropar (verifierade):
 *  - En rad = ETT TILLFÄLLE; serier länkas via `parent`-id (veckoåterkommande
 *    bokbussar/boule ger annars 10+ rader) → serie-dedup på parent.
 *  - startTime/endTime är LOKAL ISO utan offset ("2026-07-23T10:30:00");
 *    00:00:00 = heldag → hasSpecificTime=false.
 *  - eventType 'multiple' = långkörare (utställningar) där startTime kan ligga
 *    månader bakåt — behåll om endTime ≥ fönsterstart (overlap-räddning).
 *  - location.name är ofta GATUADRESS ("Dunörtsvägen 3"); unit.name är enheten
 *    ("Bokbussarna", "Stadsbiblioteket") → unit som per-event-värd.
 *  - Koordinater ligger i location.latitude/longitude (92 % täckning) —
 *    bounds-valideras mot Göteborgsområdet innan de används.
 *  - image = { host, path } → konkatenera; template=true = mall, hoppa över.
 *  - Publik detaljsida: goteborg.se/wps/portal/kalendarium/kalendarium-start
 *    ?activityId=<id> (robots.txt vitlistar mönstret uttryckligen).
 */

import { RawEvent, Engine } from '../sources/types';
import { decodeHtmlEntities } from '../utils/categoryNormalize';

import { truncateAtBoundary, DEFAULT_DESCRIPTION_MAX } from '../utils/text';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_API = 'https://microservices.goteborg.se/ua/kalendariet/public/activities/';
const DEFAULT_PAGE = 'https://goteborg.se/wps/portal/kalendarium/kalendarium-start';

// Generöst Göteborgsområde (kommunen + kranskommuner där stadens enheter finns).
const BOUNDS = { latMin: 57.3, latMax: 58.2, lngMin: 11.4, lngMax: 12.6 };

export interface GoteborgStadConfig {
    apiUrl?: string;
    pageUrl?: string;
    defaultCity?: string;
    /** Säkerhetsspärr för pagineringen (à 200 rader). Default 40 (~8000). */
    maxPages?: number;
}

interface KalendarietActivity {
    id?: string;
    title?: string;
    description?: string;          // HTML
    startTime?: string;            // "2026-07-23T10:30:00" (lokal, utan offset)
    endTime?: string;
    eventType?: string;            // 'single' | 'multiple'
    template?: boolean;
    parent?: string;
    priceInformation?: unknown;
    location?: { name?: string; latitude?: number; longitude?: number };
    image?: { host?: string; path?: string };
    unit?: {
        name?: string;
        address?: { street?: string | null; latitude?: number; longitude?: number };
    };
    categories?: Array<{ name?: string } | null> | null;
}

/** Lokal ISO utan offset → Date; 00:00:00 räknas som datum-utan-tid. */
export function parseKalendarietTime(
    raw: string | undefined,
): { date: Date; hasClock: boolean } | null {
    const m = raw?.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const [, y, mo, da, hh, mi] = m;
    const date = new Date(+y, +mo - 1, +da, +hh, +mi);
    if (isNaN(date.getTime())) return null;
    return { date, hasClock: !(hh === '00' && mi === '00') };
}

function validCoords(lat?: number, lng?: number): [number, number] | undefined {
    if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
    if (lat < BOUNDS.latMin || lat > BOUNDS.latMax) return undefined;
    if (lng < BOUNDS.lngMin || lng > BOUNDS.lngMax) return undefined;
    return [lat, lng];
}

/** Mappa en kalendariet-rad → RawEvent. Exporterad för test. */
export function mapKalendarietActivity(
    a: KalendarietActivity,
    pageUrl: string,
    defaultCity: string,
): RawEvent | null {
    if (a.template) return null;
    const title = decodeHtmlEntities(String(a.title || '').trim());
    const start = parseKalendarietTime(a.startTime);
    if (!title || !start || !a.id) return null;

    const end = parseKalendarietTime(a.endTime);
    const loc = a.location;
    const description = a.description
        ? truncateAtBoundary(decodeHtmlEntities(a.description.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(), DEFAULT_DESCRIPTION_MAX) || undefined
        : undefined;
    const imageUrl = a.image?.host && a.image?.path
        ? `${a.image.host.replace(/\/$/, '')}/${a.image.path.replace(/^\//, '')}`
        : undefined;
    const category = a.categories?.find((c) => c?.name)?.name?.toLowerCase().trim();

    return {
        externalId: a.id,
        title,
        startDate: start.date,
        endDate: end && end.date.getTime() > start.date.getTime() ? end.date : undefined,
        url: `${pageUrl}?activityId=${a.id}`,
        venueName: loc?.name?.trim() || a.unit?.name?.trim() || undefined,
        city: defaultCity,
        address: a.unit?.address?.street?.trim() || undefined,
        coords: validCoords(loc?.latitude, loc?.longitude)
            ?? validCoords(a.unit?.address?.latitude, a.unit?.address?.longitude),
        description,
        imageUrl,
        category,
        price: typeof a.priceInformation === 'string' ? a.priceInformation.trim() || undefined : undefined,
        hostName: a.unit?.name?.trim() || undefined,
        hasSpecificTime: start.hasClock ? true : undefined,
    };
}

/**
 * Serie-dedup: en rad per serie (parent-id), första tillfället i/efter fönstret
 * vinner. Rader utan parent är fristående och behålls som de är.
 * Exporterad för test.
 */
export function dedupeByParent(
    rows: Array<{ ev: RawEvent; parent?: string }>,
): RawEvent[] {
    const byKey = new Map<string, RawEvent>();
    const out: RawEvent[] = [];
    for (const { ev, parent } of rows) {
        if (!parent) { out.push(ev); continue; }
        const prev = byKey.get(parent);
        if (!prev || ev.startDate < prev.startDate) byKey.set(parent, ev);
    }
    return [...out, ...byKey.values()];
}

export const goteborgStadEngine: Engine = async (config: GoteborgStadConfig, ctx) => {
    const apiUrl = (config.apiUrl || DEFAULT_API).replace(/\/$/, '');
    const pageUrl = config.pageUrl || DEFAULT_PAGE;
    const defaultCity = config.defaultCity || 'Göteborg';
    const maxPages = config.maxPages ?? 40;

    const rows: Array<{ ev: RawEvent; parent?: string }> = [];
    let totalPages = Infinity;
    let fetched = 0;

    for (let page = 0; page < Math.min(totalPages, maxPages); page++) {
        let data: { content?: KalendarietActivity[]; totalPages?: number; last?: boolean };
        try {
            const res = await fetch(`${apiUrl}/?page=${page}&size=200`, {
                headers: { 'User-Agent': UA, 'Accept': 'application/json' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`HTTP ${res.status} på page=${page}`); break; }
            data = await res.json();
        } catch (err) {
            ctx.log(`fetch misslyckades (page=${page}): ${(err as Error).message}`);
            break;
        }

        const content = data.content ?? [];
        if (typeof data.totalPages === 'number') totalPages = data.totalPages;
        fetched += content.length;
        if (content.length === 0) break;

        for (const a of content) {
            const ev = mapKalendarietActivity(a, pageUrl, defaultCity);
            if (!ev) continue;
            // Behåll pågående långkörare (endDate i fönstret) för overlap-logiken.
            const relevant = ev.startDate >= ctx.windowStart
                || (ev.endDate && ev.endDate >= ctx.windowStart);
            if (relevant) rows.push({ ev, parent: a.parent });
        }
        if (data.last) break;
    }

    const events = dedupeByParent(rows);
    ctx.log(`${fetched} rader ur API:t → ${rows.length} relevanta → ${events.length} efter serie-dedup`);
    return events;
};
