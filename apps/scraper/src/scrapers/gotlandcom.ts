/**
 * Gotland.com — öns officiella besöksnärings-kalender (Gotlands Förenade
 * Besöksnäring). Största enskilda Gotland-källan: hela öns turist- och
 * vardagsutbud (konserter, marknader, guidningar, utställningar) från
 * ~1650 anslutna företag.
 *
 * Öppen WP-export (upptäckt 2026-07-27, ingen auth):
 *
 *   GET https://gotland.com/wp-json/api/v1/export/events
 *   → JSON-array, ~394 event i ETT anrop (269 i 30d-fönstret vid upptäckt).
 *
 * Fältkvalitet: koordinater ~98 %, bild ~99 %, gatuadress+ort+socken,
 * kategori, arrangör (company), priser.
 *
 * Fallgropar (verifierade):
 *  - Exporten saknar permalink. Detalj-URL:er hämtas ur
 *    https://gotland.com/events-sitemap.xml (/events/<slug>/) och matchas via
 *    slugifierat namn; WP suffixar återkommande event med -N (game-of-drones-2)
 *    → suffixmatchning, högsta N vinner. Ingen träff → konstruerad URL
 *    (kan 404:a men är stabil och unik); namnkrock → #<id>-fragment.
 *  - dates[] = [{date:[start,end], time:"fritext"}] — tid är fritext
 *    ("14.00", "14-16", "1400", "kl 11-17", "20,00") → parseGotlandTime.
 *    Serie-event (upp till 29 tillfällen) → första kommande tillfället vinner
 *    (husmönstret från PRO/Nortic). Pågående långkörare (start passerad,
 *    slut i framtiden) ankras på idag — runnern klipper annars på startDate.
 *  - description är HTML med entiteter → cleanDescription (encoding-guarden).
 *  - company.name === "." förekommer (~45 st) = skräp → hostName utelämnas.
 *  - contact.city har case-varians ("VISBY") och skräp (".") → normaliseras,
 *    fallback socken → defaultCity.
 *  - ~31 event är Svenska kyrkans (contact.web/email innehåller
 *    svenskakyrkan) → SKIPPAS: SvK-källan täcker dem redan med sin hårda
 *    eventType-taxonomi (svk-flood-policyn) — släpp inte in dem bakvägen.
 */

import { RawEvent, Engine } from '../sources/types';
import { cleanDescription, decodeHtmlEntities } from '../utils/text';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const DEFAULT_EXPORT = 'https://gotland.com/wp-json/api/v1/export/events';
const DEFAULT_SITEMAP = 'https://gotland.com/events-sitemap.xml';

// Gotland inkl. Fårö och Gotska Sandön.
const BOUNDS = { latMin: 56.8, latMax: 58.5, lngMin: 17.9, lngMax: 19.6 };

export interface GotlandComConfig {
    exportUrl?: string;
    sitemapUrl?: string;
    defaultCity?: string;
}

interface GotlandComEvent {
    id?: number;
    name?: string;
    description?: string;          // HTML
    shortDescription?: string;
    contact?: {
        street?: string; zip?: string; city?: string; socken?: string;
        telephone?: string; email?: string; web?: string;
    };
    coordinates?: { lat?: number; lng?: number };
    images?: string[];
    category?: string;
    childCategory?: string;
    company?: { name?: string; logo?: string };
    priceTitle?: string;
    prices?: Array<{ info?: string; price?: string }>;
    dates?: Array<{ date?: [string, string] | string[]; time?: string }>;
    eventBookingLink?: string;
}

/**
 * Fritext-tid → {h, m}. Hanterar "14.00", "14:00", "14-16", "14.00-16.00",
 * "1400", "kl 11-17", "20,00". Returnerar null för tomt/oparsbart.
 * Exporterad för test.
 */
export function parseGotlandTime(raw: string | undefined): { h: number; m: number } | null {
    let t = (raw || '').trim().toLowerCase().replace(/^kl\.?\s*/, '');
    if (!t) return null;
    let h = -1, m = 0;
    let match = t.match(/^(\d{1,2})[.:,](\d{2})/);
    if (match) {
        h = +match[1]; m = +match[2];
    } else if ((match = t.match(/^(\d{3,4})(?:\s*[-–]|\s|$)/))) {
        const v = match[1];
        h = +v.slice(0, v.length - 2); m = +v.slice(-2);
    } else if ((match = t.match(/^(\d{1,2})(?:\s*[-–]|\s|$)/))) {
        h = +match[1];
    }
    if (h < 0 || h > 23 || m > 59) return null;
    return { h, m };
}

/** WP-lik slugifiering av eventnamn (för matchning mot events-sitemapen). */
export function slugifyName(name: string): string {
    return name
        .toLowerCase()
        .replace(/å|ä/g, 'a').replace(/ö/g, 'o')
        .replace(/é|è|ê/g, 'e').replace(/ü/g, 'u')
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Välj första relevanta tillfället: första dates-post vars slutdatum inte
 * passerats. Startdatum i det förflutna (pågående långkörare) ankras på `from`.
 * Exporterad för test.
 */
export function pickOccurrence(
    dates: GotlandComEvent['dates'],
    from: Date,
): { start: Date; end?: Date; time?: string } | null {
    let best: { start: Date; end?: Date; time?: string } | null = null;
    for (const d of dates || []) {
        const rawStart = d.date?.[0];
        const rawEnd = d.date?.[1] || rawStart;
        if (!rawStart || !/^\d{4}-\d{2}-\d{2}$/.test(rawStart)) continue;
        const start = new Date(`${rawStart}T00:00:00`);
        const end = new Date(`${rawEnd}T23:59:59`);
        if (isNaN(start.getTime()) || end < from) continue;
        const effStart = start < from
            ? new Date(from.getFullYear(), from.getMonth(), from.getDate())
            : start;
        if (!best || effStart < best.start) {
            best = {
                start: effStart,
                end: end > effStart ? end : undefined,
                time: d.time,
            };
        }
    }
    return best;
}

function isSvenskaKyrkan(ev: GotlandComEvent): boolean {
    const probe = [ev.contact?.web, ev.contact?.email, ev.eventBookingLink]
        .join(' ').toLowerCase();
    return probe.includes('svenskakyrkan');
}

function normalizeCity(ev: GotlandComEvent, defaultCity: string): string {
    const raw = (ev.contact?.city || '').trim();
    if (/^[a-zåäö]/i.test(raw)) {
        return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }
    const socken = (ev.contact?.socken || '').trim();
    if (/^[a-zåäö]/i.test(socken)) {
        return socken.charAt(0).toUpperCase() + socken.slice(1).toLowerCase();
    }
    return defaultCity;
}

/** Mappa export-rad → RawEvent. Exporterad för test. */
export function mapGotlandComEvent(
    ev: GotlandComEvent,
    urlFor: (ev: GotlandComEvent) => string,
    from: Date,
    defaultCity: string,
): RawEvent | null {
    const title = decodeHtmlEntities(String(ev.name || '').trim()).replace(/\s+/g, ' ');
    if (!title || !ev.id) return null;
    if (isSvenskaKyrkan(ev)) return null;

    const occ = pickOccurrence(ev.dates, from);
    if (!occ) return null;

    const time = parseGotlandTime(occ.time);
    const startDate = new Date(occ.start);
    if (time) startDate.setHours(time.h, time.m, 0, 0);

    const lat = ev.coordinates?.lat, lng = ev.coordinates?.lng;
    const coords: [number, number] | undefined =
        typeof lat === 'number' && typeof lng === 'number'
            && lat >= BOUNDS.latMin && lat <= BOUNDS.latMax
            && lng >= BOUNDS.lngMin && lng <= BOUNDS.lngMax
            ? [lat, lng] : undefined;

    const companyName = (ev.company?.name || '').trim();
    const host = companyName && companyName !== '.' ? companyName : undefined;
    const street = (ev.contact?.street || '').trim();
    const price = (ev.prices || [])
        .map((p) => [p.info, p.price].filter(Boolean).join(' '))
        .filter(Boolean).join(', ')
        .trim() || undefined;

    return {
        externalId: String(ev.id),
        title,
        startDate,
        endDate: occ.end,
        url: urlFor(ev),
        venueName: street || host || undefined,
        city: normalizeCity(ev, defaultCity),
        address: street || undefined,
        coords,
        description: cleanDescription(ev.description || ev.shortDescription, 800) || undefined,
        imageUrl: ev.images?.[0] || undefined,
        category: (ev.category || '').toLowerCase().trim() || undefined,
        price,
        hostName: host,
        hasSpecificTime: time ? true : undefined,
    };
}

export const gotlandComEngine: Engine = async (config: GotlandComConfig, ctx) => {
    const exportUrl = config.exportUrl || DEFAULT_EXPORT;
    const sitemapUrl = config.sitemapUrl || DEFAULT_SITEMAP;
    const defaultCity = config.defaultCity || 'Gotland';

    const res = await fetch(exportUrl, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        signal: ctx.signal ?? AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`export-API HTTP ${res.status}`);
    const data: GotlandComEvent[] = await res.json();
    if (!Array.isArray(data)) throw new Error('export-API: oväntat format (ej array)');

    // Slug → URL ur events-sitemapen; sitemap-miss är inte fatalt.
    const slugToUrl = new Map<string, string>();
    try {
        const smRes = await fetch(sitemapUrl, {
            headers: { 'User-Agent': UA },
            signal: ctx.signal ?? AbortSignal.timeout(30_000),
        });
        if (smRes.ok) {
            const xml = await smRes.text();
            for (const m of xml.matchAll(/<loc>(https:\/\/gotland\.com\/events\/([^<\/]+))\/?<\/loc>/g)) {
                slugToUrl.set(m[2].replace(/\/$/, ''), m[1].endsWith('/') ? m[1] : `${m[1]}/`);
            }
        } else {
            ctx.log(`events-sitemap HTTP ${smRes.status} — konstruerar URL:er`);
        }
    } catch (err) {
        ctx.log(`events-sitemap fetch-fel (${(err as Error).message}) — konstruerar URL:er`);
    }

    const usedUrls = new Set<string>();
    const urlFor = (ev: GotlandComEvent): string => {
        const slug = slugifyName(String(ev.name || ''));
        // Exakt träff, annars WP:s -N-suffix (högsta N = nyaste posten).
        let url = slugToUrl.get(slug);
        if (!url) {
            let bestN = -1;
            for (const [s, u] of slugToUrl) {
                const m = s.startsWith(slug) ? s.slice(slug.length).match(/^-(\d+)$/) : null;
                if (m && +m[1] > bestN) { bestN = +m[1]; url = u; }
            }
        }
        if (!url) url = `https://gotland.com/events/${slug}/`;
        if (usedUrls.has(url)) url = `${url}#${ev.id}`;
        usedUrls.add(url);
        return url;
    };

    let svk = 0;
    const events: RawEvent[] = [];
    for (const ev of data) {
        if (isSvenskaKyrkan(ev)) { svk++; continue; }
        const mapped = mapGotlandComEvent(ev, urlFor, ctx.windowStart, defaultCity);
        if (mapped) events.push(mapped);
    }
    ctx.log(
        `${data.length} rader i exporten → ${events.length} mappade ` +
        `(${svk} SvK-skippade, sitemap-slugs: ${slugToUrl.size})`,
    );
    return events;
};
