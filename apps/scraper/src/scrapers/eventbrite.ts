/**
 * Eventbrite scraper — Puppeteer-based (React-rendered cards)
 *
 * Strategi:
 *   1. Ladda listningssida per stad
 *   2. Extrahera `section[class*="discover-vertical-event-card"]` — h2=titel, p[0]=datum, p[1]=lokal
 *   3. Tolka svenska datumsträngar → ISO
 *   4. Geocoda lokal + stad via Nominatim
 *   5. Spara events inom nästa 30 dagar
 */
import puppeteer, { Browser } from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { classifyEvent } from '../utils/classify';

// --- DATE WINDOW ---
const now = new Date();
now.setHours(0, 0, 0, 0);
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const cutoff = new Date(now.getTime() + SEVEN_DAYS_MS);
const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

function isWithinWindow(date: Date): boolean {
    return date >= now && date <= cutoff;
}
function isToday(date: Date): boolean {
    return date >= now && date <= todayEnd;
}

// --- SWEDISH DATE PARSER ---
const MONTH_MAP: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, mars: 2,
    apr: 3, april: 3,
    maj: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    aug: 7, augusti: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
};
// Day-of-week → JS getDay() values
const WEEKDAY_MAP: Record<string, number> = {
    'måndag': 1, 'mån': 1,
    'tisdag': 2, 'tis': 2,
    'onsdag': 3, 'ons': 3,
    'torsdag': 4, 'tors': 4,
    'fredag': 5, 'fre': 5,
    'lördag': 6, 'lör': 6,
    'söndag': 0, 'sön': 0,
};
const MONTH_PATTERN = Object.keys(MONTH_MAP).sort((a, b) => b.length - a.length).join('|');
const WEEKDAY_PATTERN = Object.keys(WEEKDAY_MAP).sort((a, b) => b.length - a.length).join('|');

// Price/badge strings that appear in p[0] instead of a date
const PRICE_BADGE_RE = /^(free|gratis|sales\s+end|going\s+fast|just\s+added|almost\s+full|check\s+ticket|from\s+[\d,.]+|[\d,.]+\s*(kr|€|sek))/i;
// Price patterns that indicate a p is price, not venue
const IS_PRICE_RE = /^(free|gratis|check\s+ticket|from\s+[\d,.]+|[\d,.]+\s*(kr|€|sek))/i;

function parseSwedishDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Strip "+ X more" suffix and timezone labels (CEST, CET)
    const s = dateStr.toLowerCase()
        .replace(/\s*\+\s*\d+\s*more\s*$/i, '')
        .replace(/\s+ces?t\s*$/i, '')
        .trim();

    // "idag kl. HH:MM" or "idag kl.HH:MM"
    if (s.startsWith('idag')) {
        const m = s.match(/(\d{1,2}):(\d{2})/);
        const d = new Date(now);
        if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return d;
    }

    // "imorgon kl. HH:MM"
    if (s.startsWith('imorgon')) {
        const m = s.match(/(\d{1,2}):(\d{2})/);
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return d;
    }

    // "DD (MONTH) YYYY · HH:MM" — try with year first (more specific)
    const reYear = new RegExp(
        `(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})\\s+(?:·\\s*)?(\\d{1,2}):(\\d{2})`,
    );
    const m2 = s.match(reYear);
    if (m2) {
        return new Date(
            parseInt(m2[3], 10),
            MONTH_MAP[m2[2]],
            parseInt(m2[1], 10),
            parseInt(m2[4], 10),
            parseInt(m2[5], 10),
            0, 0,
        );
    }

    // "DD (MONTH) HH:MM" — optional day-abbrev prefix
    // e.g. "tors 25 juni 20:00"  |  "25 juni 20:00"  |  "mån 1 jun · 19:00"
    const re = new RegExp(
        `(?:${WEEKDAY_PATTERN})?\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(?:·\\s*)?(\\d{1,2}):(\\d{2})`,
    );
    const m = s.match(re);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = MONTH_MAP[m[2]];
        const hour = parseInt(m[3], 10);
        const min = parseInt(m[4], 10);
        const year = now.getFullYear();
        const d = new Date(year, month, day, hour, min, 0, 0);
        if (d < new Date(now.getTime() - 24 * 60 * 60 * 1000)) {
            d.setFullYear(year + 1);
        }
        return d;
    }

    // "WEEKDAY kl. HH:MM" — day name only (no date number), e.g. "torsdag kl. 08:30"
    const wdRe = new RegExp(`^(${WEEKDAY_PATTERN})\\s+(?:kl\\.?\\s*)?(\\d{1,2}):(\\d{2})`);
    const wm = s.match(wdRe);
    if (wm) {
        const targetDay = WEEKDAY_MAP[wm[1]];
        const hour = parseInt(wm[2], 10);
        const min = parseInt(wm[3], 10);
        const d = new Date(now);
        d.setHours(hour, min, 0, 0);
        // Advance to next occurrence of targetDay (could be today)
        while (d.getDay() !== targetDay || d < new Date()) {
            d.setDate(d.getDate() + 1);
            d.setHours(hour, min, 0, 0);
        }
        return d;
    }

    return null;
}

/**
 * Among the p-elements of a card, find which one is the date string and
 * which one is the venue. Some cards have a "Sales end soon" / "Going fast"
 * badge in p[0] before the date.
 */
function findDateAndVenue(ps: string[]): { dateStr: string; venueName: string } {
    for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        // Skip badge/price strings
        if (PRICE_BADGE_RE.test(p)) continue;
        // Check if this p looks like a date
        if (/^\d{1,2}:\d{2}$|^idag\b|^imorgon\b/.test(p.toLowerCase()) ||
            new RegExp(`^(${WEEKDAY_PATTERN})`).test(p.toLowerCase()) ||
            new RegExp(`\\d{1,2}\\s+(${MONTH_PATTERN})`).test(p.toLowerCase())) {
            // Found date; next non-price p is the venue
            const venueCandidates = ps.slice(i + 1).filter(v => !IS_PRICE_RE.test(v));
            return { dateStr: p, venueName: venueCandidates[0] || '' };
        }
    }
    // Fallback
    return { dateStr: ps[0] || '', venueName: ps[1] || '' };
}

// --- CITY LIST ---
// Eventbrite uses English (ASCII) city slugs in its URLs
interface CityEntry { name: string; slug: string; }
const EVENTBRITE_CITIES: CityEntry[] = [
    { name: 'Stockholm',   slug: 'stockholm' },
    { name: 'Göteborg',    slug: 'gothenburg' },
    { name: 'Malmö',       slug: 'malmo' },
    { name: 'Uppsala',     slug: 'uppsala' },
    { name: 'Linköping',   slug: 'linkoping' },
    { name: 'Örebro',      slug: 'orebro' },
    { name: 'Helsingborg', slug: 'helsingborg' },
    { name: 'Norrköping',  slug: 'norrkoping' },
    { name: 'Jönköping',   slug: 'jonkoping' },
    { name: 'Umeå',        slug: 'umea' },
    { name: 'Västerås',    slug: 'vasteras' },
    { name: 'Sundsvall',   slug: 'sundsvall' },
    { name: 'Lund',        slug: 'lund' },
    { name: 'Karlstad',    slug: 'karlstad' },
];

interface RawCard {
    url: string;
    title: string;
    ps: string[];  // all p-element texts in order
    coverImage: string; // thumbnail src from card (may be empty)
}

async function extractCards(browser: Browser, cityUrl: string): Promise<RawCard[]> {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        );
        // Block images / fonts to speed up
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.goto(cityUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2500));

        const cards: RawCard[] = await page.evaluate(() => {
            const sections = Array.from(
                document.querySelectorAll('section[class*="discover-vertical-event-card"]'),
            );
            const seen = new Set<string>();
            const results: { url: string; title: string; ps: string[] }[] = [];

            for (const sec of sections) {
                const link = sec.querySelector('a.event-card-link') as HTMLAnchorElement | null;
                const url = link?.href?.split('?')[0] || '';
                if (!url || seen.has(url)) continue;
                seen.add(url);

                // Eventbrite uses h3 for event card titles (not h2)
                const title = (sec.querySelector('h3') || sec.querySelector('h2'))?.textContent?.trim() || '';
                // Collect all p texts — some cards have a badge (e.g. "Sales end soon") before the date
                const ps = Array.from(sec.querySelectorAll('p')).map(p => p.textContent?.trim() || '').filter(Boolean);
                // Extract thumbnail — images are blocked from loading but src attribute is still in the DOM
                const imgEl = sec.querySelector('img') as HTMLImageElement | null;
                const coverImage = imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '';

                if (title) results.push({ url, title, ps, coverImage });
            }
            return results;
        });

        return cards;
    } finally {
        await page.close();
    }
}

export async function scrapeEventbrite() {
    console.log('[Eventbrite] Starting Puppeteer scraper…');
    let totalSaved = 0;

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        for (const { name: cityName, slug } of EVENTBRITE_CITIES) {
            const cityUrl = `https://www.eventbrite.se/d/sweden--${slug}/events/`;
            console.log(`\n[Eventbrite] ${cityName} — ${cityUrl}`);

            let cards: RawCard[] = [];
            try {
                cards = await extractCards(browser, cityUrl);
            } catch (err) {
                console.error(`[Eventbrite] Error loading ${cityUrl}:`, (err as Error).message);
                continue;
            }

            console.log(`  ${cards.length} unika cards`);

            for (const card of cards) {
                try {
                    // Skip placeholders / zero-length titles
                    if (!card.title || card.title.length < 3) continue;

                    // Skip non-Swedish Eventbrite events (.com, .ca, .fr etc.)
                    try {
                        const hostname = new URL(card.url).hostname;
                        if (!hostname.endsWith('eventbrite.se')) {
                            console.log(`  [skip] Utländskt event (${hostname}): ${card.title}`);
                            continue;
                        }
                    } catch { continue; }

                    // Dedup
                    if (await eventExistsInDb(card.url)) continue;

                    // Extract date and venue from the ps array
                    const { dateStr, venueName } = findDateAndVenue(card.ps);

                    // Parse date
                    const startDate = parseSwedishDate(dateStr);
                    if (!startDate) {
                        console.log(`  [skip] Kunde inte tolka datum "${dateStr}" — ${card.title}`);
                        continue;
                    }
                    if (!isWithinWindow(startDate)) {
                        console.log(`  [skip] Utanför 7 dagar (${startDate.toLocaleDateString('sv-SE')}): ${card.title}`);
                        continue;
                    }

                    // Geocode: "venueName, CityName"
                    const geoQuery = venueName ? `${venueName}, ${cityName}` : cityName;
                    const coords = await geocodeVenueSweden(geoQuery);

                    await addEventToDb({
                        title: card.title,
                        url: card.url,
                        time: startDate,
                        hasSpecificTime: true,
                        locationName: venueName || cityName,
                        lat: coords ? coords[0] : 0,
                        lng: coords ? coords[1] : 0,
                        hostName: 'Eventbrite',
                        category: classifyEvent(card.title, ''),
                        createdAt: new Date(),
                        coverImage: card.coverImage || null,
                        price: '',
                        description: '',
                        isLocationVerified: coords !== null,
                    });
                    totalSaved++;
                    console.log(`  ✅${isToday(startDate) ? ' [IDAG]' : ''} ${card.title} @ ${venueName}`);
                } catch (err) {
                    console.error(`  [Eventbrite] Fel på "${card.title}":`, (err as Error).message);
                }
            }
        }
    } finally {
        await browser.close();
    }

    console.log(`\n[Eventbrite] Klar — ${totalSaved} nya events sparade.`);
    return totalSaved;
}
