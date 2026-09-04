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

import { addEventToDb, eventExistsInDb, refreshEventContent } from '../utils/dbHelper';
import { getSqliteEvent } from '../utils/sqliteHelper';
import { classifyEvent } from '../utils/classify';
import { cleanDescription } from '../utils/text';

const API_KEY  = process.env.TICKETMASTER_API_KEY || '';
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

// ── Affiliate-läge ───────────────────────────────────────────────────────────
// Nyckeln byttes 2026-08-23 till vår egen (Impact-publisher 7528311) — API:t
// returnerar nu VÅRA evyy-spårningslänkar (/c/7528311/). Vi sparar ÄNDÅ rena
// kanoniska ticketmaster.se-URL:er: url är primärnyckel + share-slug-bas, och
// programansökan är inte godkänd än. NÄR Impact godkänner: slå på spårningen i
// UTKANTEN (aggregate-events.ts publicUrl) genom att wrappa ticketmaster.se-
// länkar i vår Impact-länk där — aldrig i databasen.
// Historik: 31 maj–28 jul klistrades FRÄMMANDE ?c=8469859&ac=1 (gamla nyckeln
// var registrerad på det kontot); städat 2026-08-23.
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

// ── Date window (90 dagar) ───────────────────────────────────────────────────
// Breddat 30→90 (2026-08-23): TM-arenor och elitmatcher annonseras månader i
// förväg — 30d tappade hösten. Pipelinens källfönster är 180d; 90 håller
// sidantalet nere (~200/sida) med egen nyckel (5000 anrop/dygn).
function getDateWindow(): { start: string; end: string } {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 90);
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

interface TmAttraction {
    name?: string;
    type?: string;
}

export interface TmEvent {
    id:     string;
    name:   string;
    url:    string;
    dates:  { start: { localDate: string; localTime?: string } };
    images?:       TmImage[];
    priceRanges?:  TmPriceRange[];
    classifications?: { segment?: { name: string }; genre?: { name: string } }[];
    /** Arrangörens egen text — finns på ~hälften av SE/DK/NO-eventen. */
    info?:        string;
    pleaseNote?:  string;
    description?: string;
    /** Arrangören (Live Nation Sweden AB, Det Ny Teater, Auditorium AS …). */
    promoter?:  { id?: string; name?: string };
    promoters?: { id?: string; name?: string }[];
    _embedded?: { venues?: TmVenue[]; attractions?: TmAttraction[] };
}

// ── Innehåll: beskrivning + värd ur API-svaret ───────────────────────────────
// Fram till 2026-09-04 sparades TM-event med description = "Music Pop"
// (klassificeringshinten) och hostName = "TicketMaster" — kortet visade bara
// en titel. API:t bär arrangörens text (info/pleaseNote, ~50 %) och promoter
// (~90 %) direkt i listsvaret; priceRanges saknas däremot helt för SE/DK/NO
// (0 av 547 kontrollerade 2026-09-04), så priset går inte att få den här vägen.

const SEGMENT_SV: Record<string, string> = {
    'Music': 'Musik',
    'Arts & Theatre': 'Scen & teater',
    'Sports': 'Sport',
    'Film': 'Film',
    'Miscellaneous': 'Övrigt',
};

/** Klassificeringshint → läsbar svensk reserv-rad ("Musik · Pop"). Exporterad för test. */
export function categoryLine(e: Pick<TmEvent, 'classifications'>): string {
    const segment = e.classifications?.[0]?.segment?.name ?? '';
    const genre   = e.classifications?.[0]?.genre?.name   ?? '';
    const seg = SEGMENT_SV[segment] ?? segment;
    if (!seg && !genre) return '';
    if (genre && genre !== 'Undefined' && genre !== 'Other' && genre !== seg) return seg ? `${seg} · ${genre}` : genre;
    return seg;
}

/**
 * Beskrivning ur API:t: arrangörens text (description/info/pleaseNote,
 * dubbletter bort) → annars medverkande (utan arena/arrangör som TM lägger
 * som "attractions") → annars kategoriraden. Exporterad för test.
 */
export function buildTmDescription(e: TmEvent): string {
    const texts: string[] = [];
    for (const raw of [e.description, e.info, e.pleaseNote]) {
        const t = cleanDescription(raw || '', 1500);
        if (t && !texts.some(x => x === t || x.includes(t))) texts.push(t);
    }
    if (texts.length) return texts.join('\n\n');

    // Medverkande: TM lägger även arenan ("Sentrum Scene"), arrangörens
    // kortnamn ("Auditorium" ⊂ "Auditorium AS (…)") och titeln själv ("HIT MED
    // 80ERNE" ~ "Hit med 80-erne") som attractions — jämför normaliserat och
    // släpp allt som ryms i titel/arena/arrangör.
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9åäöæøéü]+/g, '');
    const containers = [e._embedded?.venues?.[0]?.name, pickTmHost(e)].map(s => norm(s || ''));
    const title = norm(e.name);
    const acts = (e._embedded?.attractions || [])
        .map(a => (a.name || '').trim())
        .filter(n => {
            const k = norm(n);
            // Titeln: bara exakt samma (annars försvinner "Tom McKay" ur
            // "Tom McKay | Comic Con"); arena/arrangör: räcker att namnet ryms.
            return k && k !== title && !containers.some(x => x.includes(k));
        });
    if (acts.length) return `Medverkande: ${acts.join(', ')}`;
    return categoryLine(e);
}

/** Beskrivning vi själva härlett (hint, medverkande, kategorirad) — får räknas om. Exporterad för test. */
export function isDerivedDescription(d: string | null | undefined): boolean {
    const t = (d || '').trim();
    if (isThinDescription(t)) return true;
    if (/^Medverkande: /.test(t)) return true;
    return /^(Musik|Scen & teater|Sport|Film|Övrigt)( · [^\n]{1,40})?$/.test(t);
}

/** Värd = promoter (första i promoters som reserv), annars "TicketMaster". Exporterad för test. */
export function pickTmHost(e: Pick<TmEvent, 'promoter' | 'promoters'>): string {
    const name = (e.promoter?.name || e.promoters?.find(p => p?.name)?.name || '').trim();
    return name || 'TicketMaster';
}

/** Kategorihint-beskrivning ("Music Pop") eller tomt = tunt. Exporterad för test. */
export function isThinDescription(d: string | null | undefined): boolean {
    const t = (d || '').trim();
    if (!t) return true;
    // Hinten är "Segment Genre" på engelska, 1–4 ord utan skiljetecken —
    // en riktig mening som råkar börja med "Music" ska inte fällas.
    return /^(Music|Arts & Theatre|Sports|Film|Miscellaneous|Undefined)(\s[A-Za-z&\/-]+){0,3}$/.test(t);
}

/**
 * Vad som ska uppdateras på ett REDAN sparat event: bara tunna fält byts,
 * och bara mot något rikare. Returnerar null när inget behöver röras.
 * Exporterad för test.
 */
export function enrichmentPatch(
    row: { description?: string | null; hostName?: string | null; price?: string | null },
    e: TmEvent,
): { description?: string; hostName?: string; price?: string } | null {
    const patch: { description?: string; hostName?: string; price?: string } = {};
    const desc = buildTmDescription(e);
    // Härledda beskrivningar räknas om när härledningen ger något annat
    // (bättre filter, eller arrangören har lagt till text sedan sist);
    // arrangörens egen text rörs aldrig. Deterministisk → konvergerar.
    const cur = (row.description || '').trim();
    if (desc && !isThinDescription(desc) && isDerivedDescription(cur) && desc !== cur) patch.description = desc;
    const host = pickTmHost(e);
    if ((!row.hostName || row.hostName === 'TicketMaster') && host !== 'TicketMaster') patch.hostName = host;
    const price = formatPrice(e.priceRanges ?? []);
    if (!(row.price || '').trim() && price) patch.price = price;
    return Object.keys(patch).length ? patch : null;
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
    let enrichedCount = 0;

    for (const event of allEvents) {
        try {
            const eventUrl = cleanEventUrl(event.url);

            // Dedup — kolla ren URL, rå URL och den gamla taggade formen.
            // Kända event BERIKAS i stället för att hoppas över: de som sparades
            // före 2026-09-04 har bara "Music Pop" som beskrivning och
            // "TicketMaster" som värd (se enrichmentPatch). Spegeln är källan
            // till raden; saknas den där rör vi inget.
            if (
                await eventExistsInDb(eventUrl) ||
                await eventExistsInDb(event.url) ||
                await eventExistsInDb(legacyAffiliateUrl(event.url))
            ) {
                const row = getSqliteEvent(eventUrl) ?? getSqliteEvent(event.url) ?? getSqliteEvent(legacyAffiliateUrl(event.url));
                const patch = row ? enrichmentPatch(row, event) : null;
                if (row && patch && await refreshEventContent(row.url, patch)) {
                    enrichedCount++;
                    console.log(`  ✏️  ${event.name}: ${Object.keys(patch).join('+')}`);
                }
                continue;
            }

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
            // Beskrivning + värd ur API:t: buildTmDescription/pickTmHost (samma
            // härledning som berikningen av kända event ovan). Revisionen 3/9
            // hängde på genre-hinten sist i texten — classifyEvent får hinten
            // direkt, så den behövs inte i det som visas för användaren.

            await addEventToDb({
                title:             event.name,
                url:               eventUrl,
                time:              eventDate,
                hasSpecificTime:   !!localTime,
                locationName,
                lat:               isNaN(lat) ? 0 : lat,
                lng:               isNaN(lng) ? 0 : lng,
                // TM-API:t levererar arenans egna koordinater — exakta.
                geoPrecision:      (lat && lng && !isNaN(lat)) ? 'kallkoordinat' : null,
                hostName:          pickTmHost(event),
                category,
                createdAt:         new Date(),
                coverImage,
                price,
                description:       buildTmDescription(event),
                isLocationVerified: !!(lat && lng && lat !== 0 && lng !== 0),
            });

            savedCount++;
            console.log(`  ✅ ${event.name} @ ${locationName} (${localDate})`);
        } catch (err) {
            console.error(`  [TM] Fel på "${event.name}":`, (err as Error).message);
        }
    }

    console.log(`\n[TicketMaster] Klar — ${savedCount} nya events sparade, ${enrichedCount} kända berikade.`);
    return savedCount;
}
