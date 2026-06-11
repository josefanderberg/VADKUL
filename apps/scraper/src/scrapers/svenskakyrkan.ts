/**
 * svenskakyrkan — Engine för hela Svenska kyrkans kalender via ETT nationellt API.
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
 * Inga bild-fält i API:t. Geocoding: kandidat-kedja kyrkonamn → församling → ortnamn
 * (suffixet "pastorat/församling" strippat) — runnern provar i ordning.
 *
 * URL: www.svenskakyrkan.se/kalender?event=<id> (unik per event, klickbar — SPA:n
 * öppnar eventet via query-paramet). Används som dedup-nyckel.
 *
 * Körs via registryt: `npm run sources -- --ids=svenska-kyrkan [--dry-run]`
 */

import { Engine, RawEvent } from '../sources/types';
import { cleanDescription } from '../utils/text';

const API = 'https://svk-apim-prod.azure-api.net/calendar/v1/event/search/';
const SUB_KEY = process.env.SVK_SUB_KEY || 'f6937363a4d94012a78a32442752cf5c';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_DELAY_MS = 300;          // artig paus mellan sidor mot Azure-endpointen
const SAFETY_PAGE_CAP = 400;        // skydd mot oändlig paginering (400×50 = 20 000 event)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Formatera Date som ISO med offset-suffix (API:t tolkar). */
function toApiTime(d: Date): string {
    return d.toISOString().replace('Z', '+00:00');
}

async function searchPage(body: string, log: (msg: string) => void): Promise<any | null> {
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
            log(`HTTP ${r.status} på sök-endpoint`);
            return null;
        }
        return await r.json();
    } catch (err) {
        log(`fetch-fel: ${(err as Error).message}`);
        return null;
    }
}

/**
 * Hårt publikt-event-filter (beslut 2026-06-11 efter floden: API:t ger ~19 700
 * event/30d varav majoriteten gudstjänster och privata ceremonier).
 *
 * eventType-nycklarna är API:ts egen taxonomi:
 *   gudstjanstOchMassa  → BORT (ordinarie gudstjänster; täcker även dop/vigsel/
 *                         konfirmation/begravning — de är gudstjänster i API:t)
 *   stodOchOmsorg       → BORT (sorgegrupper/samtalsstöd — inte event-innehåll)
 *   konstOchKultur, motasOchUmgas, kroppOchSjal, barnverksamhet, dropIn → KVAR
 *
 * Event UTAN eventType (~16 %) bedöms på titeln. Svenska sammansättningar gör
 * \b-matchning träffsäker: fristående "Gudstjänst" fastnar, "Musikgudstjänst" inte.
 */
const DROP_TYPES = ['gudstjanstOchMassa', 'stodOchOmsorg'];
// Tre klasser: ceremoni-prefix (även sammansatta: "Dopgudstjänst"), fristående
// gudstjänstord (sammansättningar som "Musikgudstjänst"/"Julmässa" ÖVERLEVER —
// de är konsert-/marknadsinnehåll), och helgmåls-stammar (alltid junk, även
// sammansatta: "Helgmålsbön", "Helgsmålsringning"). OBS: JS \b är opålitligt
// intill åäö — därför stam-matchning utan \b där sammansättningar ska fångas.
const CEREMONY_TITLE =
    /\b(dop|vigsel|konfirmation|begravning)|\b(gudstjänst|mässa|högmässa|veckomässa|andakt|vesper|bön)\b|helgs?mål/i;
const NOTICE_TITLE = /stängd|stängt|^öppe[tn]\b|öppen klockan|öppet kl|expedition/i;

/** Exporterad för test. true = publikt event vi vill ha på kartan. */
export function isPublicSvkEvent(e: any): boolean {
    const title = (e?.title || '').toString();
    if (NOTICE_TITLE.test(title)) return false;            // öppettider/stängt-notiser

    const mode = e?.attendanceMode || {};
    if (mode.online && !mode.offline) return false;         // digitala event — ingen plats att kartlägga

    const typeKeys = Object.keys(e?.eventType || {});
    if (typeKeys.length > 0) return !typeKeys.some((k) => DROP_TYPES.includes(k));
    return !CEREMONY_TITLE.test(title);                     // typlösa: titel-heuristik
}

/**
 * Mappa ett API-event → RawEvent. null = hoppa över (utlandsförsamling/
 * icke-publikt/ogiltigt). Exporterad för test.
 */
export function mapSvkEvent(e: any): RawEvent | null {
    const owner = e?.owner || {};
    if (owner.type === 'Utlandet') return null;   // SKUT utomlands — Sverige-only
    if (!isPublicSvkEvent(e)) return null;

    const title = (e.title || '').toString().trim();
    if (!title || !e.start || !e.id) return null;   // utan id blir URL:en obrukbar

    const startDate = new Date(e.start);   // ISO med offset → korrekt UTC
    if (isNaN(startDate.getTime())) return null;

    const localTime = (e.startLocalTime || {}).time || '';
    const hasSpecificTime = !e.isFullDayEvent && localTime !== '00:00:00' && localTime !== '';

    const parish = (owner.name || '').toString().trim();
    const placeName = ((e.place || {}).name || '').toString().trim();
    const venueLabel = placeName || parish || 'Svenska kyrkan';
    // Ortnamn: "Örkelljunga pastorat" → "Örkelljunga" (genitiv-s strippas också)
    const town = parish
        .replace(/\s+(pastorat|församling|distrikt|domkyrkoförsamling|kyrkliga samfällighet)$/i, '')
        .replace(/s$/i, '')
        .trim();

    return {
        title,
        url: `https://www.svenskakyrkan.se/kalender?event=${e.id}`,
        startDate,
        hasSpecificTime,
        venueName: placeName && parish ? `${placeName}, ${parish}` : venueLabel,
        geocodeCandidates: [placeName, parish, town].filter((c) => c && c.length > 2),
        hostName: parish || 'Svenska kyrkan',
        description: cleanDescription(e.description),
    };
}

export const svenskaKyrkanEngine: Engine = async (_config, ctx) => {
    const baseBody =
        `access=external&expand=${encodeURIComponent('place,owner')}&limit=50` +
        `&from=${encodeURIComponent(toApiTime(ctx.windowStart))}&to=${encodeURIComponent(toApiTime(ctx.windowEnd))}`;

    const events: RawEvent[] = [];
    let scanned = 0, skipped = 0, pages = 0;
    let continuation: string | null = null;

    while (pages < SAFETY_PAGE_CAP) {
        const body = continuation ? `${baseBody}&continuation=${encodeURIComponent(continuation)}` : baseBody;
        const data = await searchPage(body, ctx.log);
        if (!data || !Array.isArray(data.result)) break;
        pages++;

        for (const e of data.result) {
            scanned++;
            const mapped = mapSvkEvent(e);
            if (mapped) events.push(mapped);
            else skipped++;
        }

        if (pages % 10 === 0) ctx.log(`…${pages} sidor, ${scanned} skannade, ${events.length} kandidater`);

        continuation = data.continuation || null;
        if (!continuation) break;
        await sleep(PAGE_DELAY_MS);
    }

    ctx.log(`${pages} sidor, ${events.length} kandidater (${skipped} utlands/ogiltiga hoppade)`);
    return events;
};
