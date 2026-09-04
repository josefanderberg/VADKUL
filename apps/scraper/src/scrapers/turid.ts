/**
 * turid — Engine för TURID, den regionala turistdatabas som Visit Värmland
 * (och potentiellt fler destinationsbolag) publicerar sitt utbud genom.
 *
 * Upptäckt 2026-08-26 under kommun-svans-svepet: hagfors.se:s kalendersida
 * proxade `/rest-api/visit-varmland/events`, och proxyns svar avslöjade
 * ursprunget — `https://turid.<destination>/api/v8/events`, öppet utan auth.
 *
 * ETT paginerat API täcker HELA länet. Det gör den till kommun-svansens mest
 * skalbara fynd: nio av Värmlands kommuner saknade egen källa (Eda, Filipstad,
 * Grums, Hagfors, Kristinehamn, Munkfors, Storfors, Torsby, Årjäng) och alla
 * bärs av den här enda källan.
 *
 * Fältkvalitet (664 event, mätt 2026-08-26):
 *   - occasions[] med date_start/time_start  100 %  (88 % har riktigt klockslag)
 *   - places[].latitude/longitude            96 %   — EXAKTA koordinater
 *   - places[].address.street_1              91 %
 *   - primary_image                          100 %
 *   - sales_text (beskrivning)               100 %  — `description` är alltid tom
 *   - prices[]                               27 %
 *   - organizers[].city                      79 %   — enda ort-fältet som är ifyllt
 *
 * FÄLLA: `places[].address.city` och `.municipality` är TOMMA på 100 % av
 * posterna trots att fälten finns. Orten måste tas ur organizers[].city.
 *
 * VOLYM: 664 event bär 2569 tillfällen — utställningar och museer ligger som
 * ETT tillfälle per öppetdag (30 st i månaden). Utan serie-dedup skulle en
 * handfull utställningar dränka länet. Vi kör samma mönster som Nortic/PRO:
 * första tillfället i fönstret per (arrangör, titel) vinner → 1058 tillfällen
 * blir 358 event.
 *
 * URL: `https://<sajt>/<full_slug>` 301:ar till den kanoniska destinations-
 * prefixade adressen (/arvika/evenemang/...). Vi lagrar den korta formen —
 * den är stabil, och destinations-prefixet finns inte i API-svaret.
 */

import { Engine, RawEvent } from '../sources/types';
import { isInNordic } from '../utils/venueCoordinates';
import { cleanDescription } from '../utils/text';
import { dedupeSeries } from './pro';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_SIZE = 50;   // API:t klipper allt över 50 tyst
const MAX_PAGES = 40;

export interface TuridConfig {
    /** API-bas utan avslutande slash, t.ex. https://turid.visitvarmland.com */
    apiBase: string;
    /** Publik sajt som slug:arna hör till, t.ex. https://visitvarmland.com */
    siteBase: string;
    /** Ort när arrangören saknar stad */
    defaultCity?: string;
}

interface TuridOccasion {
    date_start?: string;   // "2026-08-26"
    date_end?: string;
    time_start?: string;   // "14:00:00" — "00:00:00" = ingen tid satt
    time_end?: string;
}

interface TuridPlace {
    title?: string;
    latitude?: string;     // sträng, inte number
    longitude?: string;
    address?: { street_1?: string | null; zip_code?: string | null; city?: string | null; municipality?: string | null };
}

interface TuridEvent {
    id?: number;
    title?: string;
    slug?: string;
    sales_text?: string;
    description?: string;
    is_trail?: boolean;
    occasions?: TuridOccasion[];
    places?: TuridPlace[];
    organizers?: { title?: string; city?: string }[];
    prices?: { price?: string; price_type?: string }[];
    primary_image?: { small?: string; medium?: string; large?: string };
    categories?: { title?: string; name?: string }[];
}

/**
 * "2026-08-26" + "14:00:00" → lokal Date. time "00:00:00" (eller saknad) räknas
 * som datum-utan-tid — samma konvention som övriga engines. Exporterad för test.
 */
export function parseTuridOccasion(
    occ: TuridOccasion | undefined,
): { date: Date; hasClock: boolean } | null {
    const d = occ?.date_start?.trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    const t = occ?.time_start?.trim();
    const hasClock = !!t && /^\d{2}:\d{2}(:\d{2})?$/.test(t) && !t.startsWith('00:00');
    const [y, mo, day] = d.split('-').map(Number);
    const [h, mi] = hasClock ? t!.split(':').map(Number) : [0, 0];
    const date = new Date(y, mo - 1, day, h, mi);
    if (isNaN(date.getTime())) return null;
    return { date, hasClock };
}

/** Koordinat ur TURIDs strängfält, validerad mot nordiska bounds. Exporterad för test. */
export function parseTuridCoords(place: TuridPlace | undefined): [number, number] | undefined {
    const lat = Number(place?.latitude);
    const lng = Number(place?.longitude);
    if (!isFinite(lat) || !isFinite(lng) || (lat === 0 && lng === 0)) return undefined;
    if (!isInNordic(lat, lng)) return undefined;
    return [lat, lng];
}

/** Pris som visningssträng: "600 kr" / "Från 150 kr". Exporterad för test. */
export function formatTuridPrice(prices: TuridEvent['prices']): string | undefined {
    const nums = (prices ?? [])
        .map((p) => Number(String(p.price ?? '').replace(/[^\d.]/g, '')))
        .filter((n) => isFinite(n) && n > 0);
    if (!nums.length) return undefined;
    const min = Math.min(...nums);
    return nums.length > 1 && Math.max(...nums) > min ? `Från ${min} kr` : `${min} kr`;
}

/**
 * Ett TURID-event → ETT RawEvent per tillfälle. Tillfällen utanför fönstret
 * filtreras bort av anroparen. Exporterad för test.
 */
export function mapTuridEvent(ev: TuridEvent, cfg: TuridConfig): RawEvent[] {
    const title = ev.title?.trim();
    const slug = ev.slug?.trim();
    if (!title || !slug || !ev.occasions?.length) return [];

    const place = ev.places?.[0];
    const organizer = ev.organizers?.[0];
    const coords = parseTuridCoords(place);
    const city = organizer?.city?.trim() || place?.address?.city?.trim() || cfg.defaultCity;
    const street = place?.address?.street_1?.trim() || undefined;
    const baseUrl = `${cfg.siteBase.replace(/\/$/, '')}/${slug.replace(/^\//, '')}`;

    const out: RawEvent[] = [];
    for (const occ of ev.occasions) {
        const parsed = parseTuridOccasion(occ);
        if (!parsed) continue;
        const end = occ.date_end && occ.date_end !== occ.date_start
            ? parseTuridOccasion({ date_start: occ.date_end, time_start: occ.time_end })
            : null;
        out.push({
            externalId: ev.id != null ? `${ev.id}` : undefined,
            title,
            startDate: parsed.date,
            endDate: end && end.date.getTime() > parsed.date.getTime() ? end.date : undefined,
            // Tillfället i URL:en så serier inte krockar i dedupen före serie-dedupen.
            url: `${baseUrl}#${occ.date_start}`,
            venueName: place?.title?.trim() || undefined,
            address: street,
            city,
            coords,
            description: cleanDescription(ev.sales_text || ev.description || '') || undefined,
            imageUrl: ev.primary_image?.large || ev.primary_image?.medium || undefined,
            organizer: organizer?.title?.trim() || undefined,
            hostName: organizer?.title?.trim() || undefined,
            price: formatTuridPrice(ev.prices),
            hasSpecificTime: parsed.hasClock ? true : undefined,
        });
    }
    return out;
}

export const turidEngine: Engine = async (config: TuridConfig, ctx) => {
    const apiBase = config.apiBase.replace(/\/$/, '');
    const all: RawEvent[] = [];
    let totalPages = 1;
    let fetched = 0;

    for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
        const url = `${apiBase}/api/v8/events?limit=${PAGE_SIZE}&page=${page}`;
        let data: { data?: TuridEvent[]; total_count?: number; total_pages?: number };
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': UA, Accept: 'application/json' },
                signal: ctx.signal ?? AbortSignal.timeout(30_000),
            });
            if (!res.ok) { ctx.log(`TURID HTTP ${res.status} (page=${page})`); break; }
            data = await res.json();
        } catch (err) {
            ctx.log(`TURID-fel page=${page}: ${(err as Error).message}`);
            break;
        }
        const items = data.data ?? [];
        if (typeof data.total_pages === 'number') totalPages = data.total_pages;
        if (!items.length) break;
        fetched += items.length;
        for (const it of items) {
            // Vandringsleder är platser med öppettider, inte daterade event.
            if (it.is_trail) continue;
            all.push(...mapTuridEvent(it, config));
        }
    }

    const inWindow = all.filter((e) => e.startDate >= ctx.windowStart && e.startDate < ctx.windowEnd);
    // Utställningar ligger som ett tillfälle per öppetdag — behåll det första.
    const deduped = dedupeSeries(inWindow.sort((a, b) => a.startDate.getTime() - b.startDate.getTime()));
    ctx.log(`TURID: ${fetched} event → ${all.length} tillfällen → ${inWindow.length} i fönstret → ${deduped.length} efter serie-dedup`);
    return deduped;
};
