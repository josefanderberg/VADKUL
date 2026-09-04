/**
 * accentfeed — Engine för Accent APIs eventfeed, en kurerad ström av
 * Facebook-event som vissa kommuner publicerar sin kalender genom.
 *
 * Upptäckt 2026-08-26 på kalix.se: kommunens kalender är en JS-widget mot
 *
 *   GET https://data.accentapi.com/feed/<feedId>.json
 *
 * Öppet, ingen auth, hela feeden i ETT anrop. Innehållet är event som Kalix
 * kommun har handplockat från lokala Facebook-sidor — alltså riktigt lokalt
 * utbud i en kommun där vårt eget FB-flöde inte når.
 *
 * Fältkvalitet (Kalix, 26 poster 2026-08-26):
 *   - event_start_utc / event_end_utc   ISO UTC, 100 %
 *   - event_lati / event_longi          EXAKTA koordinater, 96 %
 *   - event_venue, location_text        venue-namn + adresstext
 *   - image                             100 %
 *   - ticket_price                      när arrangören angett det
 *
 * KRITISK FÄLLA — URL-normalisering. `html_link` är
 * `https://www.facebook.com/events/<id>` UTAN avslutande slash, medan vår
 * facebook-scraper lagrar `.../events/<id>/` MED. `url` är primärnyckel i hela
 * pipelinen, så utan normalisering blir varje post en dubblett av ett event vi
 * kanske redan har. Vi normaliserar alltid till slash-formen.
 * (Vid upptäckt: 0 av 16 fanns redan — feeden når sidor vårt FB-flöde missar.)
 *
 * Feed-id:t är kommunspecifikt och står i widgetens script-tagg på
 * kalendersidan. Det finns ingen katalog över feeds.
 */

import { Engine, RawEvent } from '../sources/types';
import { isInNordic } from '../utils/venueCoordinates';
import { cleanDescription } from '../utils/text';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface AccentFeedConfig {
    /** Feedens numeriska id, ur widgetens script-tagg */
    feedId: string;
    defaultCity?: string;
}

interface AccentEvent {
    event_id?: string;
    name?: string;
    description?: string;
    event_start_utc?: string;
    event_end_utc?: string;
    start_time_display?: string;   // "true" när klockslaget är satt
    html_link?: string;
    image?: string;
    event_venue?: string;
    location_text?: string;
    event_lati?: string;           // sträng
    event_longi?: string;
    ticket_price?: string;
    owner?: string;
    event_status?: string;
}

/**
 * Facebook-URL:er till samma form som facebook-scrapern lagrar
 * (`https://www.facebook.com/events/<id>/`) — annars dubbletter. Exporterad för test.
 */
export function normalizeFacebookUrl(raw: string | undefined): string | null {
    if (!raw) return null;
    const m = raw.match(/facebook\.com\/events\/(\d+)/);
    if (m) return `https://www.facebook.com/events/${m[1]}/`;
    return /^https?:\/\//.test(raw) ? raw : null;
}

/** Mappa en feed-post → RawEvent. Exporterad för test. */
export function mapAccentEvent(
    e: AccentEvent,
    cfg: AccentFeedConfig,
): RawEvent | null {
    const title = e.name?.trim();
    const url = normalizeFacebookUrl(e.html_link);
    if (!title || !url) return null;
    if (e.event_status && /cancel|inställ/i.test(e.event_status)) return null;

    const start = e.event_start_utc ? new Date(e.event_start_utc) : null;
    if (!start || isNaN(start.getTime())) return null;
    const end = e.event_end_utc ? new Date(e.event_end_utc) : null;

    const lat = Number(e.event_lati);
    const lng = Number(e.event_longi);
    const coords: [number, number] | undefined =
        isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0) && isInNordic(lat, lng)
            ? [lat, lng] : undefined;

    const price = e.ticket_price?.trim() || undefined;

    return {
        externalId: e.event_id,
        title,
        startDate: start,
        endDate: end && !isNaN(end.getTime()) && end > start ? end : undefined,
        url,
        venueName: e.event_venue?.trim() || undefined,
        address: e.location_text?.trim() || undefined,
        city: cfg.defaultCity,
        coords,
        description: cleanDescription(e.description || '') || undefined,
        imageUrl: e.image || undefined,
        organizer: e.owner?.trim() || undefined,
        // start_time_display="false" ⇒ arrangören satte inget klockslag.
        hasSpecificTime: e.start_time_display === 'false' ? undefined : true,
    };
}

export const accentFeedEngine: Engine = async (config: AccentFeedConfig, ctx) => {
    const url = `https://data.accentapi.com/feed/${config.feedId}.json`;
    let data: { events?: AccentEvent[] };
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'application/json' },
            signal: ctx.signal ?? AbortSignal.timeout(30_000),
        });
        if (!res.ok) { ctx.log(`Accent-feed HTTP ${res.status}`); return []; }
        data = await res.json();
    } catch (err) {
        ctx.log(`Accent-feed-fel: ${(err as Error).message}`);
        return [];
    }

    const raw = data.events ?? [];
    const events: RawEvent[] = [];
    const seen = new Set<string>();
    for (const e of raw) {
        const ev = mapAccentEvent(e, config);
        if (!ev || seen.has(ev.url)) continue;
        seen.add(ev.url);
        events.push(ev);
    }
    ctx.log(`Accent-feed: ${raw.length} poster → ${events.length} event`);
    return events;
};
