/**
 * svenskakyrkan.ts — Hela Svenska kyrkans kalender via ett enda nationellt API.
 *
 * Till skillnad från Hembygd (per-förening) exponerar Svenska kyrkan EN rikstäckande
 * sök-endpoint på Azure API Management som returnerar event från ALLA församlingar/
 * pastorat i landet. Ingen enhets-enumerering behövs.
 *
 *   POST https://svk-apim-prod.azure-api.net/calendar/v1/event/search/
 *   headers: ocp-apim-subscription-key: <SUB_KEY>, content-type: x-www-form-urlencoded
 *   body:    access=external&expand=place,owner&limit=50&from=<ISO>&to=<ISO>
 *   svar:    { limit, next, continuation, result: [event…], … }
 *
 * Paginering: POSTa samma body + &continuation=<token> tills `continuation` saknas.
 * (next-URL:en går EJ att GET:a — 404. Bara POST med continuation i body fungerar.)
 *
 * Varje event har `start` som ISO med offset → tolkas direkt som korrekt UTC.
 * isFullDayEvent / time "00:00:00" → ingen specifik tid (heldagsmarkering).
 * owner.type === 'Utlandet' = SKUT-församlingar utomlands → hoppas över (Sverige-only).
 * Inga bild-fält i API:t. Koordinat: geocoda place-namn (annars församlingsnamn).
 *
 * URL: www.svenskakyrkan.se/kalender?event=<id> (unik per event, klickbar — SPA:n
 * öppnar eventet via query-paramet). Används som dedup-nyckel.
 *
 * Begränsa vid smoke-test: SVK_MAX_EVENTS=<n>. Fönster: SVK_DAYS=<n> (default 30).
 */

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

const API = 'https://svk-apim-prod.azure-api.net/calendar/v1/event/search/';
const SUB_KEY = process.env.SVK_SUB_KEY || 'f6937363a4d94012a78a32442752cf5c';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DAYS = process.env.SVK_DAYS ? parseInt(process.env.SVK_DAYS, 10) : 30;
const MAX_EVENTS = process.env.SVK_MAX_EVENTS ? parseInt(process.env.SVK_MAX_EVENTS, 10) : Infinity;
const PAGE_DELAY_MS = 300;          // artig paus mellan sidor mot Azure-endpointen
const SAFETY_PAGE_CAP = 400;        // skydd mot oändlig paginering (400×50 = 20 000 event)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Formatera Date som "2026-06-11T00:00:00.000+02:00" (lokal offset spelar mindre roll, API:t tolkar). */
function toApiTime(d: Date): string {
    return d.toISOString().replace('Z', '+00:00');
}

async function searchPage(body: string): Promise<any | null> {
    try {
        const r = await fetch(API, {
            method: 'POST',
            headers: {
                'ocp-apim-subscription-key': SUB_KEY,
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://www.svenskakyrkan.se',
                'referer': 'https://www.svenskakyrkan.se/',
                'user-agent': UA,
            },
            body,
            signal: AbortSignal.timeout(25_000),
        });
        if (!r.ok) {
            console.error(`  [SvenskaKyrkan] HTTP ${r.status} på sök-endpoint`);
            return null;
        }
        return await r.json();
    } catch (err) {
        console.error('  [SvenskaKyrkan] fetch-fel:', (err as Error).message);
        return null;
    }
}

/**
 * Geocoda kyrkoevent. Försök i tur och ordning (med cache per nyckel):
 *   1. place-namnet (t.ex. "Uppsala domkyrka")           — träffar oftast direkt
 *   2. församlingens/pastoratets namn ("Sundbybergs kyrka")
 *   3. ortnamnet, dvs suffixet "pastorat/församling" borttaget ("Örkelljunga")
 */
async function geocodeChurch(
    placeName: string,
    parish: string,
    cache: Map<string, [number, number] | null>,
): Promise<[number, number] | null> {
    const town = parish
        .replace(/\s+(pastorat|församling|distrikt|domkyrkoförsamling|kyrkliga samfällighet)$/i, '')
        .replace(/s$/i, '')   // genitiv: "Himledalens" → "Himledalen"
        .trim();
    const candidates = [placeName, parish, town].filter((c) => c && c.length > 2);
    for (const q of candidates) {
        if (!cache.has(q)) cache.set(q, await geocodeVenueSweden(q));
        const hit = cache.get(q);
        if (hit) return hit;
    }
    return null;
}

export async function scrapeSvenskaKyrkan(): Promise<number> {
    console.log('[SvenskaKyrkan] Hämtar rikstäckande kalender via Azure-API…');

    const now = new Date();
    const to = new Date(now.getTime() + DAYS * 24 * 60 * 60 * 1000);
    const baseBody =
        `access=external&expand=${encodeURIComponent('place,owner')}&limit=50` +
        `&from=${encodeURIComponent(toApiTime(now))}&to=${encodeURIComponent(toApiTime(to))}`;

    const geoCache = new Map<string, [number, number] | null>();
    let saved = 0, scanned = 0, skippedAbroad = 0, pages = 0;
    let continuation: string | null = null;

    while (pages < SAFETY_PAGE_CAP && saved < MAX_EVENTS) {
        const body = continuation ? `${baseBody}&continuation=${encodeURIComponent(continuation)}` : baseBody;
        const data = await searchPage(body);
        if (!data || !Array.isArray(data.result)) break;
        pages++;

        for (const e of data.result) {
            if (saved >= MAX_EVENTS) break;
            scanned++;
            try {
                const owner = e.owner || {};
                if (owner.type === 'Utlandet') { skippedAbroad++; continue; }   // SKUT utomlands

                const title = (e.title || '').toString().trim();
                if (!title || !e.start) continue;

                const when = new Date(e.start);   // ISO med offset → korrekt UTC
                if (isNaN(when.getTime())) continue;
                const localTime = (e.startLocalTime || {}).time || '';
                const hasSpecificTime = !e.isFullDayEvent && localTime !== '00:00:00' && localTime !== '';

                const url = `https://www.svenskakyrkan.se/kalender?event=${e.id}`;
                if (await eventExistsInDb(url)) continue;

                const parish = (owner.name || '').toString().trim();
                const placeName = ((e.place || {}).name || '').toString().trim();
                const venueLabel = placeName || parish || 'Svenska kyrkan';
                const locationName = placeName && parish ? `${placeName}, ${parish}` : venueLabel;

                // Geocoda (Sverige-låst): kyrkonamn fungerar bra; faller tillbaka på
                // ortnamnet om "X pastorat/församling" inte hittas (web-kartan döljer 0,0).
                let lat = 0, lng = 0;
                const c = await geocodeChurch(placeName, parish, geoCache);
                if (c) { lat = c[0]; lng = c[1]; }

                const description = (e.description || '')
                    .toString().replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
                    .replace(/\s+/g, ' ').trim().slice(0, 500);

                await addEventToDb({
                    title,
                    url,
                    time: when,
                    hasSpecificTime,
                    locationName,
                    lat: lat || 0,
                    lng: lng || 0,
                    hostName: parish || 'Svenska kyrkan',
                    category: classifyEvent(title, description),
                    createdAt: new Date(),
                    coverImage: null,
                    price: '',
                    description,
                    isLocationVerified: !!(lat && lng),
                });
                saved++;
            } catch (err) {
                console.error('  [SvenskaKyrkan] event-fel:', (err as Error).message);
            }
        }

        if (pages % 10 === 0) console.log(`[SvenskaKyrkan] …${pages} sidor, ${scanned} skannade, ${saved} sparade`);

        continuation = data.continuation || null;
        if (!continuation) break;
        await sleep(PAGE_DELAY_MS);
    }

    console.log(`[SvenskaKyrkan] Klar — ${saved} nya event (${scanned} skannade, ${skippedAbroad} utlands hoppade, ${pages} sidor).`);
    return saved;
}

// Direktkörning för smoke-test: SVK_MAX_EVENTS=… ts-node src/scrapers/svenskakyrkan.ts
if (require.main === module) {
    scrapeSvenskaKyrkan()
        .then((n) => { console.log(`Totalt sparat: ${n}`); process.exit(0); })
        .catch((e) => { console.error(e); process.exit(1); });
}
