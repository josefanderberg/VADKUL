/**
 * hbgevent — Engine för "Event Manager", Helsingborgs stads öppna eventplattform
 * som ett stort antal skånska kommuner och institutioner publicerar genom.
 *
 * Upptäckt 2026-08-26 under kommun-svans-svepet: astorp.se/evenemang är en
 * JS-kalender vars XHR går till en HELT ANNAN kommuns API.
 *
 *   GET https://api.helsingborg.se/event/json/wp/v2/event/time
 *       ?group-id=<N>&start=YYYY-MM-DD&end=YYYY-MM-DD&per_page=100
 *
 * Öppet, ingen auth. `group-id` väljer avsändare; utan den returneras hela
 * plattformen (135 grupper: kommuner, teatrar, museer, bibliotek, näringslivs-
 * bolag). Gruppregistret ligger på `/event/json/wp/v2/user_groups?per_page=100`.
 *
 * Fältkvalitet (Åstorp, 42 event / 54 tillfällen i 30-dagarsfönstret):
 *   - occasions[].start_date "YYYY-MM-DD HH:MM" lokal väggtid, alltid med tid
 *   - location.latitude/longitude + gatuadress + ort på ~80 %
 *   - featured_media.source_url (bild), content.rendered (HTML-beskrivning)
 *   - event_categories som textnamn
 *
 * FÄLLOR:
 *   - `link`/`event_link` är NULL. Publik URL måste byggas per kommun, och
 *     mönstret skiljer sig åt: Åstorp `/arkiv/evenemang/evenemang.html?id=<id>`,
 *     Skurup `/evenemang/visa-evenemang/<id>`. Gissa inte — läs den renderade
 *     listsidans länkar. Därav `urlTemplate` i configen.
 *   - Tomma grupper svarar HTTP 404 med `{"code":"empty_result"}`, inte [].
 *   - Samma kommun kan ha FLERA grupp-id (Åstorp 549 och 753 ger identiskt
 *     innehåll) — välj ett, annars dubbelhämtar du.
 *   - `occasions[]` är återkommande tillfällen; utan serie-dedup blir en
 *     veckoåterkommande sagostund fyra kort i rad.
 */

import { Engine, RawEvent } from '../sources/types';
import { isInNordic } from '../utils/venueCoordinates';
import { cleanDescription, decodeHtmlEntities } from '../utils/text';
import { dedupeSeries } from './pro';

const API = 'https://api.helsingborg.se/event/json/wp/v2/event/time';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface HbgEventConfig {
    /** Avsändargrupp, ur /event/json/wp/v2/user_groups */
    groupId: number;
    /** Publik eventlänk; `{id}` byts mot event-id. Läs mönstret ur listsidans DOM. */
    urlTemplate: string;
    defaultCity?: string;
}

interface HbgOccasion {
    start_date?: string;     // "2026-08-27 16:30"
    end_date?: string;
    status?: string;         // "scheduled" | "cancelled" | …
}

interface HbgLocation {
    title?: string;
    street_address?: string;
    city?: string;
    latitude?: string;       // sträng
    longitude?: string;
}

interface HbgEvent {
    id?: number;
    title?: { rendered?: string; plain_text?: string };
    content?: { rendered?: string; plain_text?: string };
    occasions?: HbgOccasion[];
    location?: HbgLocation | null;
    organizers?: ({ title?: string } | null)[] | null;
    event_categories?: string[];
    featured_media?: { source_url?: string } | null;
}

/** "YYYY-MM-DD HH:MM" → lokal Date. Exporterad för test. */
export function parseHbgDate(raw: string | undefined): Date | null {
    const m = raw?.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
    return isNaN(d.getTime()) ? null : d;
}

/** Koordinat ur strängfälten, validerad mot nordiska bounds. Exporterad för test. */
export function parseHbgCoords(loc: HbgLocation | null | undefined): [number, number] | undefined {
    const lat = Number(loc?.latitude);
    const lng = Number(loc?.longitude);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return undefined;
    return isInNordic(lat, lng) ? [lat, lng] : undefined;
}

/** Ett event → ett RawEvent per (icke inställt) tillfälle. Exporterad för test. */
export function mapHbgEvent(ev: HbgEvent, cfg: HbgEventConfig): RawEvent[] {
    const title = decodeHtmlEntities(ev.title?.plain_text || ev.title?.rendered || '').trim();
    if (!title || ev.id == null || !ev.occasions?.length) return [];

    const loc = ev.location ?? undefined;
    const url = cfg.urlTemplate.replace('{id}', String(ev.id));
    const organizer = ev.organizers?.find(Boolean)?.title?.trim() || undefined;
    const description = cleanDescription(ev.content?.plain_text || ev.content?.rendered || '') || undefined;

    const out: RawEvent[] = [];
    for (const occ of ev.occasions) {
        if (occ.status && occ.status !== 'scheduled') continue;
        const start = parseHbgDate(occ.start_date);
        if (!start) continue;
        const end = parseHbgDate(occ.end_date);
        out.push({
            externalId: `${ev.id}`,
            title,
            startDate: start,
            endDate: end && end.getTime() > start.getTime() ? end : undefined,
            // Tillfället i fragmentet — publik URL är densamma för hela serien.
            url: `${url}#${occ.start_date!.slice(0, 10)}`,
            venueName: loc?.title?.trim() || undefined,
            address: loc?.street_address?.trim() || undefined,
            city: loc?.city?.trim() || cfg.defaultCity,
            coords: parseHbgCoords(loc),
            description,
            imageUrl: ev.featured_media?.source_url || undefined,
            organizer,
            category: ev.event_categories?.[0],
            hasSpecificTime: true,
        });
    }
    return out;
}

export const hbgEventEngine: Engine = async (config: HbgEventConfig, ctx) => {
    const start = ctx.windowStart.toISOString().slice(0, 10);
    const end = ctx.windowEnd.toISOString().slice(0, 10);
    const url = `${API}?group-id=${config.groupId}&start=${start}&end=${end}&per_page=100`;

    let raw: unknown;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, Accept: 'application/json' },
            signal: ctx.signal ?? AbortSignal.timeout(45_000),
        });
        // Tom grupp svarar 404 med {"code":"empty_result"} — inte ett fel.
        if (res.status === 404) { ctx.log('Event Manager: inga event i fönstret'); return []; }
        if (!res.ok) { ctx.log(`Event Manager HTTP ${res.status}`); return []; }
        raw = await res.json();
    } catch (err) {
        ctx.log(`Event Manager-fel: ${(err as Error).message}`);
        return [];
    }
    if (!Array.isArray(raw)) { ctx.log('Event Manager gav icke-lista'); return []; }

    const all: RawEvent[] = [];
    for (const ev of raw as HbgEvent[]) all.push(...mapHbgEvent(ev, config));

    const inWindow = all.filter((e) => e.startDate >= ctx.windowStart && e.startDate < ctx.windowEnd);
    const deduped = dedupeSeries(inWindow.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    ctx.log(`Event Manager: ${(raw as HbgEvent[]).length} event → ${all.length} tillfällen → ${deduped.length} efter serie-dedup`);
    return deduped;
};
