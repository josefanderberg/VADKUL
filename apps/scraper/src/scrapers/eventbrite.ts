/**
 * Eventbrite scraper — JSON-LD ItemList (server-side, ingen Puppeteer).
 *
 * Eventbrite-stadssidor (eventbrite.se/d/sweden--<stad>/events/) bäddar in en
 * JSON-LD `ItemList` med kompletta Event-objekt direkt i HTML:en — namn,
 * ISO-datum, bild, beskrivning, adress OCH geo-koordinater. Vi behöver alltså
 * varken rendera React-kort, parsa svenska datumsträngar, besöka enskilda
 * eventsidor eller geokoda.
 *
 * Historik: tidigare Puppeteer + DOM-kort-version gav 0 events i DB (React-
 * selektorerna bröts — se docs/scrapers/inaktiva.md). Inspektion 2026-06-09
 * visade att stadssidan ger ~40 SE-events med 100% bild/bio/geo/ISO-datum.
 *
 * Filter: behåller bara events där JSON-LD location.address.addressCountry='SE'
 * (Sverige-sökningen returnerar även utländska .com/.ca-events).
 *
 * Användning:
 *   ts-node src/scrapers/eventbrite.ts              # spara
 *   ts-node src/scrapers/eventbrite.ts --dry-run    # smoke/probe: rapportera, spara ej
 */
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { classifyEvent } from '../utils/classify';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { domainLimiter } from '../sources/rateLimiter';
import {
    extractJsonLdBlocks,
    collectEvents,
    jsonLdToRawEvent,
    DEFAULT_EVENT_TYPES,
} from '../sources/engines/json-ld';
import type { RawEvent } from '../sources/types';

const UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Behåller befintligt 7-dagarsfönster (Eventbrite körs dagligen via index.ts).
const WINDOW_DAYS = 7;
const now = new Date();
now.setHours(0, 0, 0, 0);
const cutoff = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);
const isWithinWindow = (d: Date): boolean => d >= now && d <= cutoff;

interface CityEntry { name: string; slug: string; }
// Eventbrite-URL:erna använder engelska slugs men 301-redirectar till svenska
// (gothenburg→göteborg). Node fetch följer redirecten automatiskt.
const EVENTBRITE_CITIES: CityEntry[] = [
    { name: 'Stockholm', slug: 'stockholm' },
    { name: 'Göteborg', slug: 'gothenburg' },
    { name: 'Malmö', slug: 'malmo' },
    { name: 'Uppsala', slug: 'uppsala' },
    { name: 'Linköping', slug: 'linkoping' },
    { name: 'Örebro', slug: 'orebro' },
    { name: 'Helsingborg', slug: 'helsingborg' },
    { name: 'Norrköping', slug: 'norrkoping' },
    { name: 'Jönköping', slug: 'jonkoping' },
    { name: 'Umeå', slug: 'umea' },
    { name: 'Västerås', slug: 'vasteras' },
    { name: 'Sundsvall', slug: 'sundsvall' },
    { name: 'Lund', slug: 'lund' },
    { name: 'Karlstad', slug: 'karlstad' },
];

/** Plockar addressCountry ur en (möjligen array-) location-nod. */
function countryOf(node: any): string | undefined {
    const loc = Array.isArray(node?.location) ? node.location[0] : node?.location;
    return loc?.address?.addressCountry;
}

interface Extracted { raw: RawEvent; hasTime: boolean; }

/** Hämtar en stadssida och returnerar SE-events ur dess JSON-LD ItemList. */
async function fetchCityEvents(slug: string): Promise<Extracted[] | null> {
    const url = `https://www.eventbrite.se/d/sweden--${slug}/events/`;
    await domainLimiter.wait(url);
    let html: string;
    try {
        const res = await fetchWithRetry(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) { console.warn(`  [Eventbrite] ${slug}: HTTP ${res.status}`); return null; }
        html = await res.text();
    } catch (err) {
        console.warn(`  [Eventbrite] ${slug}: fetch-fel ${(err as Error).message}`);
        return null;
    }

    const nodes: any[] = [];
    for (const block of extractJsonLdBlocks(html)) {
        collectEvents(block, DEFAULT_EVENT_TYPES, nodes);
    }

    const out: Extracted[] = [];
    for (const node of nodes) {
        if (countryOf(node) !== 'SE') continue;           // bara svenska events
        const raw = jsonLdToRawEvent(node, 'https://www.eventbrite.se/');
        if (!raw) continue;
        const hasTime = typeof node.startDate === 'string' && node.startDate.includes('T');
        out.push({ raw, hasTime });
    }
    return out;
}

export async function scrapeEventbrite(): Promise<number> {
    const dryRun = process.argv.includes('--dry-run');
    console.log(`[Eventbrite] JSON-LD-scraper (${dryRun ? 'DRY-RUN' : 'spar-läge'}) — ${EVENTBRITE_CITIES.length} städer, ${WINDOW_DAYS}d fönster`);

    let totalSaved = 0;
    const report: Array<Record<string, number | string>> = [];

    for (const { name, slug } of EVENTBRITE_CITIES) {
        const events = await fetchCityEvents(slug);
        if (!events) continue;

        let inWindow = 0, withImg = 0, withDesc = 0, withGeo = 0, saved = 0;
        for (const { raw, hasTime } of events) {
            if (!raw.startDate || isNaN(raw.startDate.getTime())) continue;
            if (!isWithinWindow(raw.startDate)) continue;
            inWindow++;
            if (raw.imageUrl) withImg++;
            if (raw.description) withDesc++;
            if (raw.coords) withGeo++;

            if (dryRun) continue;
            try {
                if (await eventExistsInDb(raw.url)) continue;
                await addEventToDb({
                    title: raw.title,
                    url: raw.url,
                    time: raw.startDate,
                    hasSpecificTime: hasTime,
                    locationName: raw.venueName || name,
                    lat: raw.coords ? raw.coords[0] : 0,
                    lng: raw.coords ? raw.coords[1] : 0,
                    hostName: 'Eventbrite',
                    category: raw.category || classifyEvent(raw.title, raw.description || ''),
                    createdAt: new Date(),
                    coverImage: raw.imageUrl || null,
                    price: raw.price || '',
                    description: raw.description || '',
                    isLocationVerified: !!raw.coords,
                });
                saved++; totalSaved++;
            } catch (err) {
                console.error(`  [Eventbrite] Spar-fel "${raw.title}": ${(err as Error).message}`);
            }
        }
        report.push({ stad: name, SE: events.length, iFönster: inWindow, bild: withImg, bio: withDesc, geo: withGeo, sparade: saved });
        console.log(`  ${name.padEnd(12)} SE=${String(events.length).padStart(3)}  i-fönster=${String(inWindow).padStart(3)}  bild=${withImg} bio=${withDesc} geo=${withGeo}${dryRun ? '' : `  sparade=${saved}`}`);
    }

    // Sammanfattning
    const sum = (k: string) => report.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    console.log(`\n[Eventbrite] ${dryRun ? 'DRY-RUN' : 'Klar'} — ${sum('iFönster')} i fönster (bild ${sum('bild')}, bio ${sum('bio')}, geo ${sum('geo')})${dryRun ? '' : `, ${totalSaved} sparade`}`);
    return totalSaved;
}

// Körbar fristående för smoke/probe: ts-node src/scrapers/eventbrite.ts --dry-run
if (require.main === module) {
    scrapeEventbrite().then(() => process.exit(0)).catch((e) => { console.error('Fatal:', e); process.exit(1); });
}
