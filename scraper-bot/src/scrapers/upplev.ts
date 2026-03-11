import puppeteer from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue } from '../utils/venueCoordinates';

const UPPLEV_URL = 'https://upplev.vaxjo.se/evenemang';

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('orkester')) return 'music';
    if (t.includes('sm i') || t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match') || t.includes('tävling')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('boardgame') || t.includes('bingo')) return 'game';
    if (t.includes('teater') || t.includes('musikal') || t.includes('standup') || t.includes('humor') || t.includes('konst') || t.includes('utställning')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting') || t.includes('provning')) return 'food';
    if (t.includes('marknad') || t.includes('loppis') || t.includes('mässa')) return 'market';
    if (t.includes('utomhus') || t.includes('natur') || t.includes('vandring') || t.includes('stadsvandring')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga') || t.includes('junior')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym') || t.includes('fitness')) return 'training';
    if (t.includes('öppet hus') || t.includes('föreläsning') || t.includes('workshop') || t.includes('seminarium')) return 'study';
    if (t.includes('campus') || t.includes('student') || t.includes('kår')) return 'campus';
    return 'other';
}

const parseSwedishDate = (dateStr: string): { date: Date, hasSpecificTime: boolean } => {
    const months: Record<string, number> = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11,
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11
    };

    const currentYear = new Date().getFullYear();
    let year = currentYear;
    const yearMatch = dateStr.match(/\b(20\d{2})\b/);
    if (yearMatch) year = parseInt(yearMatch[1], 10);

    let monthIndex = new Date().getMonth();
    for (const [name, idx] of Object.entries(months)) {
        if (dateStr.toLowerCase().includes(name)) { monthIndex = idx; break; }
    }

    const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : new Date().getDate();

    // Extract time (e.g., "19:00" or "19.00")
    // Fallback till slutet av dagen om ingen specifik starttid angavs
    let hour = 23;
    let minute = 59;
    let hasSpecificTime = false;
    const timeMatch = dateStr.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (timeMatch) {
        hour = parseInt(timeMatch[1], 10);
        minute = parseInt(timeMatch[2], 10);
        hasSpecificTime = true;
    }

    return {
        date: new Date(year, monthIndex, day, hour, minute, 0),
        hasSpecificTime
    };
};

/** Try to extract price/location from a booking/ticket page */
async function scrapeBookingPage(browser: any, bookingUrl: string): Promise<{ price?: number | string }> {
    const page = await browser.newPage();
    try {
        await page.goto(bookingUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const result = await page.evaluate(() => {
            const bodyText = document.body?.textContent?.toLowerCase() || '';
            let price: number | string | undefined;

            if (bodyText.includes('gratis') || bodyText.includes('fri entré')) {
                price = 'Gratis';
            } else {
                const m = bodyText.match(/(?:pris|entré|biljett|ticket|kostnad)[^0-9]{0,30}(\d+)\s*(?:kr|sek)/i)
                    || bodyText.match(/(\d{2,4})\s*(?:kr|sek)/i);
                if (m) price = parseInt(m[1], 10);
            }
            return { price };
        });
        return result;
    } catch { return {}; }
    finally { await page.close(); }
}

export async function scrapeUpplevVaxjo() {
    console.log(`Starting scrape of ${UPPLEV_URL}`);
    const browser = await puppeteer.launch({ headless: true });

    try {
        const events: any[] = [];

        // Loop through up to 5 pages
        for (let pageNum = 1; pageNum <= 5; pageNum++) {
            const pageUrl = pageNum === 1 ? UPPLEV_URL : `${UPPLEV_URL}?page=${pageNum}`;
            console.log(`Scraping page ${pageNum}: ${pageUrl}`);

            const page = await browser.newPage();
            try {
                await page.goto(pageUrl, { waitUntil: 'networkidle2' });

                // Check if page has any event articles, if not we've reached the end
                const hasEvents = await page.evaluate(() => {
                    return document.querySelectorAll('article.uv-page-list-item__wrapper').length > 0;
                });

                if (!hasEvents) {
                    console.log(`No events found on page ${pageNum}. Stopping pagination.`);
                    await page.close();
                    break;
                }

                const pageEvents = await page.evaluate(() => {
                    const articles = Array.from(document.querySelectorAll('article.uv-page-list-item__wrapper'));
                    return articles.map(article => {
                        const title = article.querySelector('.uv-page-list-item__title')?.textContent?.trim() || '';
                        const aTag = article.closest('a') || article.querySelector('a');
                        let link = (aTag as HTMLAnchorElement)?.href || '';
                        if (link.startsWith('/')) link = `https://upplev.vaxjo.se${link}`;

                        const dateNo = article.querySelector('.uv-page-list-item__date-no')?.textContent?.trim() || '';
                        const dateText = article.querySelector('.uv-page-list-item__date-text')?.textContent?.trim() || '';
                        const descText = article.querySelector('.uv-page-list-item__info-date')?.textContent?.trim() || '';
                        const dateStr = dateNo && dateText ? `${dateNo} ${dateText}` : descText;

                        let location = article.querySelector('.uv-page-list-item__info-place-text')?.textContent?.trim() || '';
                        if (location.toLowerCase().startsWith('plats:')) location = location.substring(6).trim();

                        let img = article.querySelector('.uv-page-list-item__image img')?.getAttribute('src')
                            || article.querySelector('img')?.getAttribute('src') || '';
                        if (img.startsWith('/')) img = `https://upplev.vaxjo.se${img}`;

                        const fullText = article.textContent?.toLowerCase() || '';
                        let price: number | string = '';
                        if (fullText.includes('gratis') || fullText.includes('fri entré')) {
                            price = 'Gratis';
                        } else {
                            const m = fullText.match(/(\d+)\s*(kr|sek)/);
                            if (m) price = parseInt(m[1], 10);
                        }

                        return { title, dateStr, location, link, img, price };
                    });
                });

                events.push(...pageEvents);
                console.log(`Found ${pageEvents.length} events on page ${pageNum}.`);

            } catch (err) {
                console.error(`Error scraping page ${pageNum}:`, err);
            } finally {
                await page.close();
            }
        }

        console.log(`Found total ${events.length} events. Processing...`);

        for (const evt of events) {
            try {
                if (!evt.title) continue;
                const exists = await eventExistsInDb(evt.link || '');
                if (exists) { console.log(`Already exists: ${evt.title}`); continue; }

                const parsedDateInfo = parseSwedishDate(evt.dateStr);
                let parsedDate = parsedDateInfo.date;
                let hasSpecificTime = parsedDateInfo.hasSpecificTime;

                let finalPrice: number | string | undefined = evt.price !== '' ? evt.price : undefined;
                let finalLocation = evt.location || 'Växjö';
                let finalImg = evt.img;

                // ── Deep scrape event detail page ──────────────────────────────
                if (evt.link && evt.link.includes('upplev.vaxjo.se')) {
                    console.log(`Deep scraping: ${evt.title}`);
                    const eventPage = await browser.newPage();
                    try {
                        await eventPage.goto(evt.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                        const deepData = await eventPage.evaluate(() => {
                            // ── 1. JSON-LD structured data (most reliable) ──
                            let jsonLdPrice: number | string | undefined;
                            let jsonLdLocation = '';
                            let jsonLdImg = '';
                            let jsonLdDate = '';
                            let bookingUrl = '';

                            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                            for (const script of scripts) {
                                try {
                                    let data = JSON.parse(script.textContent || '');
                                    // Handle @graph arrays
                                    if (data['@graph']) data = data['@graph'].find((d: any) => d['@type'] === 'Event') || data;
                                    if (data['@type'] === 'Event') {
                                        // Price from offers
                                        if (data.offers) {
                                            const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                                            if (offer.price !== undefined && offer.price !== null) {
                                                jsonLdPrice = (offer.price === 0 || offer.price === '0') ? 'Gratis' : offer.price;
                                            }
                                            if (offer.url) bookingUrl = offer.url;
                                        }
                                        // Location (name + street address; we geocode ourselves, ignore geo coords)
                                        if (data.location) {
                                            const loc = data.location;
                                            if (loc.name) jsonLdLocation = loc.name;
                                            if (loc.address?.streetAddress) jsonLdLocation = jsonLdLocation || loc.address.streetAddress;
                                        }
                                        // Image
                                        if (data.image) {
                                            const img = Array.isArray(data.image) ? data.image[0] : data.image;
                                            jsonLdImg = typeof img === 'string' ? img : (img?.url || '');
                                        }
                                        // Date
                                        if (data.startDate) jsonLdDate = data.startDate;
                                    }
                                } catch { /* ignore malformed JSON-LD */ }
                            }

                            // ── 2. Fallback: CSS selectors ──
                            const mainText = document.querySelector('main')?.textContent?.toLowerCase() || '';
                            let cssPrice: number | string = '';
                            let cssLocation = '';

                            if (mainText.includes('gratis') || mainText.includes('fri entré')) {
                                cssPrice = 'Gratis';
                            } else {
                                const m = mainText.match(/(?:pris|entré|biljett|kostnad)[^0-9]{0,40}?(\d+)\s*(?:kr|sek)/i)
                                    || mainText.match(/(\d{2,4})\s*(?:kr|sek)/i);
                                if (m) cssPrice = parseInt(m[1], 10);
                            }

                            // Location from .uv-page-event-info or similar
                            const placeEl = document.querySelector('.uv-page-event-info__address, .uv-page-event-info__venue, [class*="place"], [class*="venue"]');
                            if (placeEl) cssLocation = placeEl.textContent?.trim() || '';

                            // Location from "Plats:" text pattern
                            if (!cssLocation) {
                                const locationMatch = mainText.match(/(?:plats|var|lokal|arena|venue):\s*([a-zA-ZåäöÅÄÖ0-9\s,\-]{3,50})(?:\n|$|\.)/i);
                                if (locationMatch) cssLocation = locationMatch[1].trim();
                            }

                            // ── 3. Find booking/ticket links ──
                            if (!bookingUrl) {
                                const links = Array.from(document.querySelectorAll('a[href]'));
                                const bookingLink = links.find(a => {
                                    const href = (a as HTMLAnchorElement).href.toLowerCase();
                                    const text = a.textContent?.toLowerCase() || '';
                                    return href.includes('boka') || href.includes('biljett') || href.includes('ticket')
                                        || href.includes('eventbrite') || href.includes('ticketmaster') || href.includes('billetto')
                                        || text.includes('boka') || text.includes('köp biljett') || text.includes('anmäl') || text.includes('biljetter');
                                });
                                if (bookingLink) bookingUrl = (bookingLink as HTMLAnchorElement).href;
                            }

                            // Hero image
                            const heroImg = document.querySelector('.hero-image img, .event-header img, article img, .uv-page-event-info__image img')?.getAttribute('src') || '';

                            let cssTimeMatch = '';
                            if (!jsonLdDate || !jsonLdDate.includes('T')) {
                                const timeMatch = mainText.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
                                if (timeMatch) cssTimeMatch = timeMatch[0].replace('.', ':');
                            }

                            return {
                                jsonLdPrice, jsonLdLocation, jsonLdImg, jsonLdDate,
                                cssPrice, cssLocation, bookingUrl, heroImg, cssTimeMatch
                            };
                        });

                        // Apply JSON-LD data (most reliable)
                        if (deepData.jsonLdPrice !== undefined) finalPrice = deepData.jsonLdPrice;
                        if (deepData.jsonLdLocation) finalLocation = deepData.jsonLdLocation;
                        if (deepData.jsonLdImg) finalImg = deepData.jsonLdImg;

                        // Apply CSS fallback if JSON-LD didn't provide it
                        if (finalPrice === undefined && deepData.cssPrice !== '') finalPrice = deepData.cssPrice;
                        if (finalLocation === 'Växjö' || !finalLocation) {
                            if (deepData.cssLocation) finalLocation = deepData.cssLocation;
                        }
                        if (deepData.heroImg && !finalImg) finalImg = deepData.heroImg;

                        // Try to extract specific time
                        if (!hasSpecificTime) {
                            if (deepData.jsonLdDate && deepData.jsonLdDate.includes('T')) {
                                const timePart = deepData.jsonLdDate.split('T')[1]?.substring(0, 5);
                                if (timePart && timePart.length >= 5) {
                                    const timeParts = timePart.split(':');
                                    parsedDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0);
                                    hasSpecificTime = true;
                                    console.log(`  → Found time in JSON-LD: ${timePart}`);
                                }
                            } else if (deepData.cssTimeMatch) {
                                const timeParts = deepData.cssTimeMatch.split(':');
                                parsedDate.setHours(parseInt(timeParts[0], 10), parseInt(timeParts[1], 10), 0);
                                hasSpecificTime = true;
                                console.log(`  → Found time in text: ${deepData.cssTimeMatch}`);
                            }
                        }

                        // Follow booking link for price if still unknown
                        if ((finalPrice === undefined || finalPrice === '') && deepData.bookingUrl) {
                            console.log(`  → Following booking link for price: ${deepData.bookingUrl}`);
                            const bookingData = await scrapeBookingPage(browser, deepData.bookingUrl);
                            if (bookingData.price !== undefined) finalPrice = bookingData.price;
                        }

                    } catch (e) {
                        console.warn(`  Could not deep scrape ${evt.link}: ${e}`);
                    } finally {
                        await eventPage.close();
                    }
                }

                // Clean location
                finalLocation = finalLocation?.trim() || 'Växjö';
                if (!finalLocation || finalLocation.length < 2) finalLocation = 'Växjö';

                // Resolve coordinates – always geocode by venue name for accuracy
                const coords = await geocodeVenue(finalLocation);
                const lat = coords ? coords[0] : 56.8796;
                const lng = coords ? coords[1] : 14.8094;

                const linkEvent = {
                    title: evt.title,
                    url: evt.link || UPPLEV_URL,
                    time: parsedDate,
                    hasSpecificTime,
                    locationName: finalLocation,
                    lat,
                    lng,
                    hostName: 'Upplev Växjö',
                    category: guessCategoryFromTitle(evt.title),
                    createdAt: new Date(),
                    coverImage: finalImg || undefined,
                    price: finalPrice !== undefined ? finalPrice : ''
                };

                await addEventToDb(linkEvent);
                console.log(`  ✅ Saved: ${evt.title} @ ${finalLocation} [${lat.toFixed(4)}, ${lng.toFixed(4)}] Pris: ${finalPrice ?? 'okänt'}`);

            } catch (err) {
                console.error(`Failed to process event "${evt.title}":`, err);
            }
        }
    } catch (error) {
        console.error('Error during scrape:', error);
    } finally {
        await browser.close();
        console.log('Upplev Vaxjo Scrape complete.');
    }
}
