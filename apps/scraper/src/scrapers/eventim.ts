/**
 * Eventim SE scraper — Puppeteer + JSON-LD ItemList
 *
 * Strategi:
 *   1. Ladda kategorisidor (Musik, Humor, Kultur …)
 *   2. Extrahera JSON-LD `itemListElement` — varje item har name, startDate,
 *      location.name, location.address.addressLocality, offers.url
 *   3. Geocoda venue + stad via Nominatim
 *   4. Spara events inom nästa 30 dagar
 *
 * Obs: Individuella event-sidor och artist-sidor blockeras av Akamai WAF.
 *      Kategori-sidorna är fritt tillgängliga och innehåller all nödvändig data.
 */
import puppeteer, { Browser, Page } from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { classifyEvent } from '../utils/classify';
import { searchGoogleImage } from '../utils/imageSearch';
import { extractOffersPrice } from '../utils/jsonLdExtract';

// --- DATE WINDOW: 30 dagar ---
const now = new Date();
now.setHours(0, 0, 0, 0);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const cutoff = new Date(now.getTime() + THIRTY_DAYS_MS);
const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

function isWithinWindow(date: Date): boolean {
    return date >= now && date <= cutoff;
}
function isToday(date: Date): boolean {
    return date >= now && date <= todayEnd;
}

// --- CATEGORY PAGES ---
// Tuple: [url, categoryHint] — categoryHint used as fallback when classifyEvent returns 'other'
const CATEGORY_PAGES: [string, string][] = [
    // Musik
    ['https://www.eventim.se/events/musik-17/konserter-319/', 'music'],
    ['https://www.eventim.se/events/musik-17/rock-341/', 'music'],
    ['https://www.eventim.se/events/musik-17/pop-1864/', 'music'],
    ['https://www.eventim.se/events/musik-17/hip-hop-rap-307/', 'music'],
    ['https://www.eventim.se/events/musik-17/indie-folk-1863/', 'music'],
    // Humor
    ['https://www.eventim.se/events/humor-169/humor-293/', 'comedy'],
    // Musikal och Teater
    ['https://www.eventim.se/events/musikal-och-teater-20/musikaler-329/', 'performing-arts'],
    ['https://www.eventim.se/events/musikal-och-teater-20/klassiskt-315/', 'performing-arts'],
    // Kultur
    ['https://www.eventim.se/events/kultur-168/festivaler-299/', 'music'],
    ['https://www.eventim.se/events/kultur-168/utstallning-325/', 'art'],
    ['https://www.eventim.se/events/kultur-168/foredragkurs-340/', 'education'],
    ['https://www.eventim.se/events/kultur-168/talkshow-1858/', 'education'],
    ['https://www.eventim.se/events/kultur-168/rundvisning-1862/', 'education'],
    // Familj
    ['https://www.eventim.se/events/familj-170/familjbarn-298/', 'family'],
    // Översikter — fångar kategorier vi kanske missat ovan
    ['https://www.eventim.se/events/musik-17/', 'music'],
    ['https://www.eventim.se/events/humor-169/', 'comedy'],
    ['https://www.eventim.se/events/kultur-168/', 'other'],
    ['https://www.eventim.se/events/musikal-och-teater-20/', 'performing-arts'],
    ['https://www.eventim.se/events/familj-170/', 'family'],
];

interface EventimItem {
    name: string;
    startDate: string;
    endDate?: string;
    locationName: string;
    locationCity: string;
    eventUrl: string;
    image?: string;
    description?: string;
    price?: string;
}

async function extractCategoryItems(browser: Browser, catUrl: string): Promise<EventimItem[]> {
    const page = await browser.newPage();
    try {
        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        );
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.goto(catUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const rawItems = await page.evaluate(() => {
            const results: {
                name: string; startDate: string; endDate?: string;
                locationName: string; locationCity: string; eventUrl: string;
                image?: string; description?: string; offers?: any;
            }[] = [];

            document.querySelectorAll('script[type="application/ld+json"]').forEach(scriptEl => {
                let data: any;
                try { data = JSON.parse(scriptEl.textContent || ''); } catch (_) { return; }

                // The ItemList can be the root object or nested
                const lists: any[] = [];
                if (data?.itemListElement) lists.push(data);
                if (Array.isArray(data)) data.forEach((d: any) => { if (d?.itemListElement) lists.push(d); });

                for (const list of lists) {
                    for (const listItem of (list.itemListElement || [])) {
                        const item = listItem.item || listItem;
                        if (!item || !item.name) continue;

                        const eventUrl: string = item.offers?.url || item.url || '';
                        if (!eventUrl.includes('/event/')) continue; // skip artist-only items

                        results.push({
                            name: item.name,
                            image: item.image ? (typeof item.image === 'string' ? item.image : (Array.isArray(item.image) ? item.image[0] : item.image?.url || '')) : '',
                            description: item.description ? String(item.description).trim() : '',
                            startDate: item.startDate || '',
                            endDate: item.endDate || undefined,
                            locationName: item.location?.name || '',
                            locationCity: item.location?.address?.addressLocality || '',
                            eventUrl,
                            offers: item.offers ?? null,
                        });
                    }
                }
            });
            return results;
        });

        // Normalisera pris ur offers i Node (delad helper).
        const items: EventimItem[] = rawItems.map(({ offers, ...rest }) => ({
            ...rest,
            price: extractOffersPrice(offers),
        }));
        return items;
    } finally {
        await page.close();
    }
}

export async function scrapeEventim() {
    console.log('[Eventim] Starting scraper…');
    let totalSaved = 0;
    const seenUrls = new Set<string>(); // cross-category dedup

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const googlePage: Page = await browser.newPage();
    try {
        for (const [catUrl, categoryHint] of CATEGORY_PAGES) {
            console.log(`\n[Eventim] ${catUrl}`);

            let items: EventimItem[] = [];
            try {
                items = await extractCategoryItems(browser, catUrl);
            } catch (err) {
                console.error(`[Eventim] Fel vid laddning av ${catUrl}:`, (err as Error).message);
                continue;
            }

            console.log(`  ${items.length} events i JSON-LD`);

            for (const item of items) {
                try {
                    if (!item.name || item.name.length < 2) continue;
                    if (!item.eventUrl) continue;

                    // Cross-category dedup (before DB check to save roundtrips)
                    if (seenUrls.has(item.eventUrl)) continue;
                    seenUrls.add(item.eventUrl);

                    if (await eventExistsInDb(item.eventUrl)) continue;

                    // Parse date
                    if (!item.startDate) {
                        console.log(`  [skip] Saknar datum: ${item.name}`);
                        continue;
                    }
                    const startDate = new Date(item.startDate);
                    if (isNaN(startDate.getTime())) {
                        console.log(`  [skip] Ogiltigt datum "${item.startDate}": ${item.name}`);
                        continue;
                    }
                    if (!isWithinWindow(startDate)) {
                        console.log(`  [skip] Utanför 30d (${startDate.toLocaleDateString('sv-SE')}): ${item.name}`);
                        continue;
                    }

                    // Geocode: "venueName, City"
                    const geoQuery = [item.locationName, item.locationCity]
                        .filter(Boolean)
                        .join(', ');
                    const coords = geoQuery ? await geocodeVenueSweden(geoQuery) : null;

                    // Display location: prefer venue name, fallback to city
                    const locationName = item.locationName || item.locationCity || 'Sverige';

                    // Use category hint from URL as fallback if classifier returns 'other'
                    const category = classifyEvent(item.name, '') !== 'other'
                        ? classifyEvent(item.name, '')
                        : categoryHint;

                    await addEventToDb({
                        title: item.name,
                        url: item.eventUrl,
                        time: startDate,
                        // Rå JSON-LD-sträng — dbHelper sanerar centralt
                        // (validEventEnd: slut > start, max 30 dygn).
                        endDate: item.endDate,
                        hasSpecificTime: item.startDate.includes('T'),
                        locationName,
                        lat: coords ? coords[0] : 0,
                        lng: coords ? coords[1] : 0,
                        hostName: 'Eventim',
                        category,
                        createdAt: new Date(),
                        coverImage: item.image || await searchGoogleImage(googlePage, item.name) || null,
                        price: item.price || '',
                        description: item.description || '',
                        isLocationVerified: coords !== null,
                    });
                    totalSaved++;
                    console.log(`  ✅${isToday(startDate) ? ' [IDAG]' : ''} ${item.name} @ ${locationName} (${item.locationCity})`);
                } catch (err) {
                    console.error(`  [Eventim] Fel på "${item.name}":`, (err as Error).message);
                }
            }
        }
    } finally {
        await browser.close();
    }

    console.log(`\n[Eventim] Klar — ${totalSaved} nya events sparade.`);
    return totalSaved;
}
