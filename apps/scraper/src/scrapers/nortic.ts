/**
 * nortic — Engine för biljettplattformen Nortic via deras DOKUMENTERADE öppna API.
 *
 * ETT anrop ger allt: GET https://www.nortic.se/api/json/shows returnerar
 * samtliga aktuella produktioner (~3000) med nästlade föreställningar (~14 000).
 * API:t är publikt och beskrivet på nortic.se/api/events ("kan användas av dig
 * som vill hämta ut föreställningar från systemet").
 *
 * Fältkvalitet (smoke-test 2026-07-02, 5497 shows i 30-dagarsfönstret):
 *   - startDate "YYYY-MM-DD HH:MM" lokal väggtid (processen kör Europe/Stockholm)
 *   - arenaName/arenaCity/arenaAddress + KOORDINATER på 99,9%
 *   - minPrice/maxPrice på 100% — vår i särklass bästa priskälla
 *   - imageUrl (branding.nortic.io), category, organizerName
 *
 * FÄLLA: arenaLongitude/arenaLatitude är FÖRVÄXLADE i API:t (longitude-fältet
 * bär latituden, 57.8 ligger i lat-intervallet). Samma bugg-klass som
 * Friluftsfrämjandets departments-API. Vi swappar ALLTID + validerar mot
 * nordiska bounds — skulle Nortic rätta API:t fångar valideringen det.
 *
 * Volym: en produktion spelas ofta dagligen (sommarteater: 300+ shows/månad).
 * Serie-dedup per (produktion, arena): FÖRSTA föreställningen i fönstret vinner
 * — samma mönster som PRO/Korpen. 5497 shows → ~930 event.
 *
 * URL: show-länken (nortic.se/ticket/show/<id>) är unik per föreställning men
 * vi använder EVENT-länken + #arenaId för dedup-stabilitet över nätter (samma
 * produktion+arena = samma URL även när "första föreställningen" flyttar fram).
 */

import { Engine, RawEvent } from '../sources/types';
import { isInNordic } from '../utils/venueCoordinates';
import { cleanDescription } from '../utils/text';

const API_URL = 'https://www.nortic.se/api/json/shows';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface NorticShow {
    id: number;
    name?: string;
    link?: string;
    startDate?: string;          // "2026-10-10 16:00" lokal väggtid
    arenaId?: number;
    arenaName?: string;
    arenaCity?: string;
    arenaAddress?: string;
    arenaLongitude?: string;     // OBS: bär LATITUDEN (förväxlat i API:t)
    arenaLatitude?: string;      // OBS: bär LONGITUDEN
    minPrice?: number | null;
    maxPrice?: number | null;
    description?: string;
}

interface NorticEvent {
    id: number;
    title?: string;
    link?: string;
    description?: string;
    shortDescription?: string;
    category?: string;
    imageUrl?: string;
    organizerName?: string;
    shows?: NorticShow[];
}

/** Lokal väggtid "2026-10-10 16:00" → Date (processen kör Europe/Stockholm). */
export function parseNorticTime(s: string | undefined): Date | null {
    if (!s) return null;
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
}

/** Koordinater med API:ts lat/lng-förväxling rättad + bounds-validerad. */
export function parseNorticCoords(show: NorticShow): [number, number] | undefined {
    const rawLng = parseFloat(show.arenaLongitude ?? '');
    const rawLat = parseFloat(show.arenaLatitude ?? '');
    if (isNaN(rawLng) || isNaN(rawLat)) return undefined;
    // Förväxlade fält: "longitude" bär latituden. Swappa, och om Nortic någon
    // gång rättar API:t fångar bounds-checken den o-swappade ordningen.
    if (isInNordic(rawLng, rawLat)) return [rawLng, rawLat];
    if (isInNordic(rawLat, rawLng)) return [rawLat, rawLng];
    return undefined;
}

/** "275–375 kr", "275 kr" eller "Gratis". */
export function formatNorticPrice(min: number | null | undefined, max: number | null | undefined): string | undefined {
    if (min === null || min === undefined) return undefined;
    if (min === 0 && (!max || max === 0)) return 'Gratis';
    if (max && max !== min) return `${Math.round(min)}–${Math.round(max)} kr`;
    return `${Math.round(min)} kr`;
}

/**
 * Boknings-TILLÄGG som säljs som "föreställningar" (campingel, extragäster,
 * parkering) — produkter, inte event. Filtreras på titel.
 */
const ADDON_TITLE = /^(lägg till|parkering\b|avbeställningsskydd|p-biljett|garderob\b)/i;

/** Mappa produktion+show → RawEvent. Exporterad för test. */
export function mapNorticShow(e: NorticEvent, s: NorticShow): RawEvent | null {
    const title = (e.title || s.name || '').trim();
    if (!title || !e.id || !s.id) return null;
    if (ADDON_TITLE.test(title)) return null;
    const startDate = parseNorticTime(s.startDate);
    if (!startDate) return null;

    const city = (s.arenaCity || '').trim() || undefined;
    const venue = (s.arenaName || '').trim() || undefined;

    return {
        externalId: `${e.id}:${s.arenaId ?? 0}`,
        title,
        startDate,
        // Event-länk + arena-fragment: stabil över nätter när seriens "första
        // föreställning" rullar framåt (show-id:t byts, produktionen består).
        url: `${e.link || `https://www.nortic.se/ticket/event/${e.id}`}#a${s.arenaId ?? 0}`,
        venueName: venue,
        city,
        address: (s.arenaAddress || '').trim() || undefined,
        coords: parseNorticCoords(s),
        description: cleanDescription(e.description || '') || (e.shortDescription || '').trim() || undefined,
        imageUrl: e.imageUrl || undefined,
        category: e.category || undefined,
        price: formatNorticPrice(s.minPrice, s.maxPrice),
        hostName: (e.organizerName || '').trim() || 'Nortic',
        // "HH:MM" finns alltid; midnatt = okänd tid → runnerns heuristik avgör
    };
}

export const norticEngine: Engine = async (_config, ctx) => {
    const res = await fetch(API_URL, {
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        signal: ctx.signal ?? AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
        ctx.log(`Nortic API HTTP ${res.status}`);
        return [];
    }
    const data: any = await res.json();
    const events: NorticEvent[] = data?.shows || data?.events
        || (Array.isArray(data) ? data : Object.values(data).find(Array.isArray) as NorticEvent[])
        || [];
    ctx.log(`${events.length} produktioner i API-svaret`);

    // En RawEvent per (produktion, arena) — första föreställningen i fönstret.
    const byKey = new Map<string, RawEvent>();
    let shows = 0;
    for (const e of events) {
        for (const s of e.shows || []) {
            shows++;
            const ev = mapNorticShow(e, s);
            if (!ev) continue;
            if (ev.startDate < ctx.windowStart || ev.startDate >= ctx.windowEnd) continue;
            const key = ev.externalId!;
            const prev = byKey.get(key);
            if (!prev || ev.startDate < prev.startDate) byKey.set(key, ev);
        }
    }
    const out = [...byKey.values()];
    ctx.log(`${shows} föreställningar → ${out.length} event efter fönster + serie-dedup`);
    return out;
};
