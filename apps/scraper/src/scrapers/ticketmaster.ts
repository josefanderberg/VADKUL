/**
 * TicketMaster Discovery API scraper
 *
 * Strategi:
 *   1. Hämta events från REST API (countryCode SE+NO+DK, 30 dagar framåt)
 *   2. Paginera tills alla sidor är hämtade (max 10 sidor = 2 000 events)
 *   3. Koordinater hämtas direkt från API-svaret (ingen geocoding behövs)
 *   4. Event-URL sparas REN — ingen affiliate-parameter (se cleanEventUrl)
 *
 * Miljövariabler:
 *   TICKETMASTER_API_KEY  — Consumer Key från developer.ticketmaster.com
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';

const API_KEY  = process.env.TICKETMASTER_API_KEY || '';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

// ── Affiliate-taggning: AVSTÄNGD ─────────────────────────────────────────────
// Tidigare klistrades ?c=8469859&ac=1 på varje TM-URL. Den koden är INTE vår
// (vårt Impact-publisher-konto är 7528311, skapat 2026-07-28 — parametern låg i
// scrapern sedan 31 maj). Att köra främmande affiliate-taggar mot Ticketmaster
// utan godkänt program är precis vad TM/Impact-compliance underkänner, så
// länkarna sparas rena tills programansökan är godkänd. När den går igenom:
// ersätt med den riktiga spårningslänken Impact genererar för programmet —
// inte den här parametern.
function cleanEventUrl(rawUrl: string): string {
    try {
        let u = new URL(rawUrl);
        // API:t levererar ibland hela Impact-REDIRECTEN ("ticketmaster.evyy.net/
        // c/8469859/…?u=<riktig URL>") — API-nyckeln hör till publisher 8469859,
        // inte till oss. Packa upp till destinationen (2026-08-23: 313 event
        // hade sparats med redirect-formen trots "fixen" 28/7 som bara tog ?c=).
        if (/\.(evyy\.net|sjv\.io|pxf\.io|7eer\.net|ojrq\.net)$/i.test(u.hostname)) {
            const inner = u.searchParams.get('u') || u.searchParams.get('url');
            if (inner && /^https?:\/\//.test(inner)) u = new URL(inner);
        }
        ['c', 'ac', 'irclickid', 'irgwc'].forEach((k) => u.searchParams.delete(k));
        if (u.searchParams.get('utm_medium') === 'affiliate') u.searchParams.delete('utm_medium');
        return u.toString().replace(/\?$/, '');
    } catch {
        return rawUrl;
    }
}

// Gamla taggade formen — används BARA för dedup, så att de ~220 event som redan
// ligger i databasen med ?c=8469859 inte återkommer som dubbletter med ren URL.
function legacyAffiliateUrl(rawUrl: string): string {
    try {
        const u = new URL(rawUrl);
        u.searchParams.set('c',  '8469859');
        u.searchParams.set('ac', '1');
        return u.toString();
    } catch {
        const sep = rawUrl.includes('?') ? '&' : '?';
        return `${rawUrl}${sep}c=8469859&ac=1`;
    }
}

// ── Date window (30 dagar) ───────────────────────────────────────────────────
// 30d matchar pipelinens SCRAPE_WINDOW_DAYS. TM-arenor annonseras månader i
// förväg, så 7d tappade ~3/4 av Sverige-utbudet (7d=9 vs 30d=37 events).
function getDateWindow(): { start: string; end: string } {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 59, 999);
    // TM kräver format: "2024-05-31T00:00:00Z"
    const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return { start: fmt(now), end: fmt(end) };
}

// ── Bästa bild (föredrar 16:9, högst upplösning) ────────────────────────────
function getBestImage(images: TmImage[]): string | null {
    if (!images?.length) return null;
    const sorted = images
        .filter(img => !!img.url)
        .sort((a, b) => {
            // Föredra 16_9-ratio
            const aScore = (a.ratio === '16_9' ? 10000 : 0) + (a.width || 0);
            const bScore = (b.ratio === '16_9' ? 10000 : 0) + (b.width || 0);
            return bScore - aScore;
        });
    return sorted[0]?.url ?? null;
}

// ── Prisformatering ──────────────────────────────────────────────────────────
function formatPrice(priceRanges: TmPriceRange[]): string {
    if (!priceRanges?.length) return '';
    const p = priceRanges[0];
    if (p.min === 0) return 'Gratis';
    const cur = p.currency || 'SEK';
    if (p.min && p.max && p.min !== p.max) return `${p.min}–${p.max} ${cur}`;
    if (p.min) return `från ${p.min} ${cur}`;
    return '';
}

// ── Typer ────────────────────────────────────────────────────────────────────
interface TmImage {
    url:    string;
    ratio?: string;
    width?: number;
}

interface TmPriceRange {
    min?:      number;
    max?:      number;
    currency?: string;
}

interface TmVenue {
    name?:     string;
    city?:     { name?: string };
    address?:  { line1?: string };
    location?: { latitude?: string; longitude?: string };
}

interface TmEvent {
    id:     string;
    name:   string;
    url:    string;
    dates:  { start: { localDate: string; localTime?: string } };
    images?:       TmImage[];
    priceRanges?:  TmPriceRange[];
    classifications?: { segment?: { name: string }; genre?: { name: string } }[];
    _embedded?: { venues?: TmVenue[] };
}

interface TmApiResponse {
    _embedded?: { events?: TmEvent[] };
    page?: { totalPages?: number };
}

// ── API-anrop (en sida) ──────────────────────────────────────────────────────
async function fetchPage(
    startDateTime: string,
    endDateTime:   string,
    page:          number,
    countryCode:   string = 'SE',
): Promise<{ events: TmEvent[]; totalPages: number }> {
    const params = new URLSearchParams({
        apikey:        API_KEY,
        countryCode,
        size:          '200',
        page:          String(page),
        startDateTime,
        endDateTime,
        sort:          'date,asc',
    });

    const res = await fetch(`${BASE_URL}?${params}`, {
        signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
        throw new Error(`TM API HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as TmApiResponse;
    return {
        events:     data?._embedded?.events ?? [],
        totalPages: data?.page?.totalPages  ?? 1,
    };
}

// ── Huvud-funktion ───────────────────────────────────────────────────────────
export async function scrapeTicketmaster(): Promise<number> {
    if (!API_KEY) {
        console.warn('[TicketMaster] ⚠️  Ingen API-nyckel — sätt TICKETMASTER_API_KEY i .env');
        return 0;
    }

    console.log('[TicketMaster] Startar REST API-scraper…');
    const { start, end } = getDateWindow();
    console.log(`[TicketMaster] Fönster: ${start} → ${end}`);

    // ── Hämta alla sidor, per land ──────────────────────────────────────────
    // NO/DK tillagda 2026-07-03 ("stora eventsidor för Norge och Danmark"):
    // Discovery-API:t är internationellt och ger stad+koordinater+pris direkt
    // → ingen geokodning/datumparsning behövs. Smoke 7d: SE ~? / NO 42 / DK 99.
    const COUNTRIES = ['SE', 'NO', 'DK'];
    const allEvents: TmEvent[] = [];
    for (const cc of COUNTRIES) {
        try {
            const { events: firstPage, totalPages } = await fetchPage(start, end, 0, cc);
            allEvents.push(...firstPage);
            console.log(`[TicketMaster/${cc}] Sida 1/${totalPages} — ${firstPage.length} events`);

            for (let p = 1; p < Math.min(totalPages, 10); p++) {
                await new Promise(r => setTimeout(r, 300)); // rate-limit-vänlighet
                const { events } = await fetchPage(start, end, p, cc);
                allEvents.push(...events);
                console.log(`[TicketMaster/${cc}] Sida ${p + 1}/${totalPages} — ${events.length} events`);
            }
        } catch (err) {
            // Ett lands fel stoppar inte de andra (SE är viktigast — körs först)
            console.error(`[TicketMaster/${cc}] Fel vid hämtning:`, (err as Error).message);
        }
    }
    if (allEvents.length === 0) return 0;

    console.log(`[TicketMaster] Totalt ${allEvents.length} events hämtade (${COUNTRIES.join('+')})`);

    // ── Spara ─────────────────────────────────────────────────────────────
    let savedCount = 0;

    for (const event of allEvents) {
        try {
            const eventUrl = cleanEventUrl(event.url);

            // Dedup — kolla ren URL, rå URL och den gamla taggade formen
            if (
                await eventExistsInDb(eventUrl) ||
                await eventExistsInDb(event.url) ||
                await eventExistsInDb(legacyAffiliateUrl(event.url))
            ) continue;

            // Datum
            const { localDate, localTime } = event.dates.start;
            const timeStr   = localTime ?? '00:00:00';
            const eventDate = new Date(`${localDate}T${timeStr}`);
            if (isNaN(eventDate.getTime())) {
                console.log(`  [skip] Ogiltigt datum: ${event.name}`);
                continue;
            }

            // Plats
            const venue     = event._embedded?.venues?.[0];
            const venueName = venue?.name ?? '';
            const cityName  = venue?.city?.name ?? '';
            const lat       = parseFloat(venue?.location?.latitude  ?? '0');
            const lng       = parseFloat(venue?.location?.longitude ?? '0');

            // Kategori — bygg hint från TMs egna klassificering
            const segment     = event.classifications?.[0]?.segment?.name ?? '';
            const genre       = event.classifications?.[0]?.genre?.name   ?? '';
            const categoryHint = [segment, genre].filter(Boolean).join(' ');
            const category    = classifyEvent(event.name, categoryHint);

            const locationName = [venueName, cityName].filter(Boolean).join(', ');
            const coverImage   = getBestImage(event.images ?? []);
            const price        = formatPrice(event.priceRanges ?? []);

            await addEventToDb({
                title:             event.name,
                url:               eventUrl,
                time:              eventDate,
                hasSpecificTime:   !!localTime,
                locationName,
                lat:               isNaN(lat) ? 0 : lat,
                lng:               isNaN(lng) ? 0 : lng,
                hostName:          'TicketMaster',
                category,
                createdAt:         new Date(),
                coverImage,
                price,
                description:       categoryHint,
                isLocationVerified: !!(lat && lng && lat !== 0 && lng !== 0),
            });

            savedCount++;
            console.log(`  ✅ ${event.name} @ ${locationName} (${localDate})`);
        } catch (err) {
            console.error(`  [TM] Fel på "${event.name}":`, (err as Error).message);
        }
    }

    console.log(`\n[TicketMaster] Klar — ${savedCount} nya events sparade.`);
    return savedCount;
}
