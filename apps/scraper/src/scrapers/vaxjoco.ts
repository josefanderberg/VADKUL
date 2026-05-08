import puppeteer from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue } from '../utils/venueCoordinates';

const VAXJOCO_URL = 'https://vaxjoco.se/evenemangssida/kommande-evenemang/';

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('orkester')) return 'music';
    if (t.includes('sm i') || t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match') || t.includes('tävling')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('boardgame') || t.includes('bingo')) return 'game';
    if (t.includes('teater') || t.includes('musikal') || t.includes('standup') || t.includes('humor') || t.includes('konst') || t.includes('utställning')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting') || t.includes('provning')) return 'food';
    if (t.includes('marknad') || t.includes('loppis') || t.includes('mässa')) return 'market';
    if (t.includes('utomhus') || t.includes('natur') || t.includes('vandring')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga') || t.includes('junior')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym') || t.includes('fitness')) return 'training';
    if (t.includes('öppet hus') || t.includes('föreläsning') || t.includes('workshop') || t.includes('seminarium')) return 'study';
    if (t.includes('campus') || t.includes('student') || t.includes('kår')) return 'campus';
    return 'other';
}

function parseSwedishDate(dateStr: string): { date: Date, hasSpecificTime: boolean } {
    const months: Record<string, number> = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6,
        'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11
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
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;

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
}

/** Scrape a booking/ticket page for price info */
async function scrapeBookingPage(browser: any, url: string): Promise<{ price?: number | string }> {
    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
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

export async function scrapeVaxjoCo() {
    console.log(`Starting scrape of ${VAXJOCO_URL}`);
    const browser = await puppeteer.launch({ headless: true });

    try {
        const page = await browser.newPage();
        await page.goto(VAXJOCO_URL, { waitUntil: 'networkidle2' });

        const events = await page.evaluate(() => {
            const validLinks = Array.from(document.querySelectorAll('a')).filter(a => a.querySelector('figure.zoom-puff'));

            return validLinks.map(a => {
                const title = a.querySelector('h3')?.textContent?.trim() || '';
                const dateStr = a.querySelector('p.date, p.event-date, [class*="date"]')?.textContent?.trim() || '';
                const link = (a as HTMLAnchorElement).href || '';
                let img = a.querySelector('figure.zoom-puff img')?.getAttribute('src')
                    || a.querySelector('img')?.getAttribute('src') || '';
                const fullText = a.textContent?.toLowerCase() || '';
                let price: number | string = '';
                if (fullText.includes('gratis') || fullText.includes('fri entré')) {
                    price = 'Gratis';
                } else {
                    const m = fullText.match(/(\d+)\s*(kr|sek)/);
                    if (m) price = parseInt(m[1], 10);
                }
                return { title, dateStr, link, img, price };
            });
        });

        console.log(`Found ${events.length} events. Processing...`);

        for (const evt of events) {
            try {
                if (!evt.title || !evt.link) continue;

                const exists = await eventExistsInDb(evt.link);
                if (exists) { console.log(`Already exists: ${evt.title}`); continue; }

                const parsedDateInfo = parseSwedishDate(evt.dateStr);
                let parsedDate = parsedDateInfo.date;
                let hasSpecificTime = parsedDateInfo.hasSpecificTime;

                let finalPrice: number | string | undefined = evt.price !== '' ? evt.price : undefined;
                let finalImg = evt.img;
                let finalLocation = 'Växjö';
                let directLat: number | null = null;
                let directLng: number | null = null;

                // ── Deep scrape event detail page ──────────────────────────────
                console.log(`Deep scraping: ${evt.title} (${evt.link})`);
                const eventPage = await browser.newPage();
                try {
                    await eventPage.goto(evt.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    const deepData = await eventPage.evaluate(() => {
                        // ── 1. JSON-LD structured data ──────────────────────────
                        let jsonLdPrice: number | string | undefined;
                        let jsonLdLocation = '';
                        let jsonLdLat: number | null = null;
                        let jsonLdLng: number | null = null;
                        let jsonLdImg = '';
                        let jsonLdDate = '';
                        let bookingUrl = '';

                        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const script of scripts) {
                            try {
                                let data = JSON.parse(script.textContent || '');
                                if (data['@graph']) data = data['@graph'].find((d: any) => d['@type'] === 'Event') || data;
                                if (data['@type'] === 'Event') {
                                    // Price
                                    if (data.offers) {
                                        const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
                                        if (offer.price !== undefined) {
                                            jsonLdPrice = (offer.price === 0 || offer.price === '0') ? 'Gratis' : offer.price;
                                        }
                                        if (offer.url) bookingUrl = offer.url;
                                    }
                                    // Location
                                    if (data.location) {
                                        const loc = data.location;
                                        if (loc.name) jsonLdLocation = loc.name;
                                        if (loc.address?.streetAddress) jsonLdLocation = jsonLdLocation || loc.address.streetAddress;
                                        if (loc.geo?.latitude) { jsonLdLat = loc.geo.latitude; jsonLdLng = loc.geo.longitude; }
                                    }
                                    // Image
                                    if (data.image) {
                                        const img = Array.isArray(data.image) ? data.image[0] : data.image;
                                        jsonLdImg = typeof img === 'string' ? img : (img?.url || '');
                                    }
                                    // Date
                                    if (data.startDate) jsonLdDate = data.startDate;
                                }
                            } catch { /* ignore */ }
                        }

                        // ── 2. Vaxjoco-specific DOM selectors ──────────────────
                        const contentEl = document.querySelector('.event-content, article, main, .tribe-events-single');
                        const contentText = contentEl?.textContent?.toLowerCase() || '';

                        let cssPrice: number | string = '';
                        if (contentText.includes('gratis') || contentText.includes('fri entré')) {
                            cssPrice = 'Gratis';
                        } else {
                            const m = contentText.match(/(?:pris|entré|biljett|kostnad|inträde)[^0-9]{0,30}(\d+)\s*(?:kr|sek)/i)
                                || contentText.match(/(\d{2,4})\s*(?:kr|sek)/i);
                            if (m) cssPrice = parseInt(m[1], 10);
                        }

                        // Location from known selectors (Tribe Events, WordPress)
                        let cssLocation = '';
                        const venueEls = Array.from(document.querySelectorAll(
                            '.tribe-venue, .tribe-events-venue-details, .venue, .event-location, .event-venue, .address, [itemprop="location"]'
                        ));
                        for (const el of venueEls) {
                            const text = el.textContent?.trim() || '';
                            if (text.length > 2 && text.length < 100) {
                                cssLocation = text.replace(/\s+/g, ' ').trim();
                                break;
                            }
                        }

                        // Fallback: "Plats:" text pattern
                        if (!cssLocation) {
                            const m = contentText.match(/(?:plats|var|lokal|venue|arena):\s*([^\n.]{3,60})(?:\n|$|\.)/i);
                            if (m) cssLocation = m[1].trim();
                        }

                        // Find booking links if not in JSON-LD
                        if (!bookingUrl) {
                            const links = Array.from(document.querySelectorAll('a[href]'));
                            const found = links.find(a => {
                                const href = (a as HTMLAnchorElement).href.toLowerCase();
                                const text = a.textContent?.toLowerCase() || '';
                                return href.includes('boka') || href.includes('biljett') || href.includes('ticket')
                                    || href.includes('eventbrite') || href.includes('ticketmaster') || href.includes('billetto')
                                    || text.includes('boka') || text.includes('köp biljett') || text.includes('anmäl')
                                    || text.includes('biljetter') || text.includes('anmälan');
                            });
                            if (found) bookingUrl = (found as HTMLAnchorElement).href;
                        }

                        // Hero image
                        const heroImg = document.querySelector(
                            '.hero-image img, .event-header img, article img, .tribe-events-event-image img, .wp-post-image'
                        )?.getAttribute('src') || '';

                        let cssTimeMatch = '';
                        if (!jsonLdDate || !jsonLdDate.includes('T')) {
                            const timeMatch = contentText.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
                            if (timeMatch) cssTimeMatch = timeMatch[0].replace('.', ':');

                            if (!cssTimeMatch) {
                                const timeEl = document.querySelector('.tribe-events-schedule, .event-time, .time');
                                if (timeEl) {
                                    const m = !!timeEl.textContent && timeEl.textContent.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
                                    if (m) cssTimeMatch = m[0].replace('.', ':');
                                }
                            }
                        }

                        return { jsonLdPrice, jsonLdLocation, jsonLdLat, jsonLdLng, jsonLdImg, jsonLdDate, cssPrice, cssLocation, bookingUrl, heroImg, cssTimeMatch };
                    });

                    // Apply best available data
                    if (deepData.jsonLdPrice !== undefined) finalPrice = deepData.jsonLdPrice;
                    if (deepData.jsonLdLocation) finalLocation = deepData.jsonLdLocation;
                    if (deepData.jsonLdLat) { directLat = deepData.jsonLdLat; directLng = deepData.jsonLdLng; }
                    if (deepData.jsonLdImg) finalImg = deepData.jsonLdImg;

                    if (finalPrice === undefined && deepData.cssPrice !== '') finalPrice = deepData.cssPrice;
                    if (finalLocation === 'Växjö' && deepData.cssLocation) finalLocation = deepData.cssLocation;
                    if (deepData.heroImg && !finalImg) finalImg = deepData.heroImg;

                    // Follow booking link for price if still missing
                    if ((finalPrice === undefined || finalPrice === '') && deepData.bookingUrl) {
                        console.log(`  → Following booking link: ${deepData.bookingUrl}`);
                        const booking = await scrapeBookingPage(browser, deepData.bookingUrl);
                        if (booking.price !== undefined) finalPrice = booking.price;
                    }

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

                } catch (e) {
                    console.warn(`  Could not deep scrape ${evt.link}: ${e}`);
                } finally {
                    await eventPage.close();
                }

                // Clean location
                finalLocation = finalLocation?.replace(/\s+/g, ' ').trim() || 'Växjö';
                if (!finalLocation || finalLocation.length < 2) finalLocation = 'Växjö';

                // Resolve coordinates
                let lat: number;
                let lng: number;

                if (directLat && directLng) {
                    lat = directLat;
                    lng = directLng;
                    console.log(`  Coords from JSON-LD: [${lat}, ${lng}]`);
                } else {
                    const coords = await geocodeVenue(finalLocation);
                    lat = coords ? coords[0] : 56.8796;
                    lng = coords ? coords[1] : 14.8094;
                }

                const linkEvent = {
                    title: evt.title,
                    url: evt.link,
                    time: parsedDate,
                    hasSpecificTime,
                    locationName: finalLocation,
                    lat,
                    lng,
                    hostName: 'Växjö & Co',
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
        console.log('VäxjöCo scrape complete.');
    }
}
