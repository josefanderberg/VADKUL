import puppeteer from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue, getVenueCoordinates } from '../utils/venueCoordinates';

const VAXJOCO_URL = 'https://vaxjoco.se/evenemangssida/kommande-evenemang/';

// Hjäpfunktion för att gissa kategori baserat på titel
function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();

    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('sm i') || t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('boardgame')) return 'game';
    if (t.includes('teater') || t.includes('musikal') || t.includes('konsert') || t.includes('standup') || t.includes('humor')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting')) return 'food';
    if (t.includes('marknad') || t.includes('loppis')) return 'market';
    if (t.includes('utomhus') || t.includes('natur') || t.includes('vandring')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym')) return 'training';

    return 'other';
}

// Enkel svensk datum-parser
function parseSwedishDate(dateStr: string): Date {
    // Exempel: "7-8 mars", "11 april 2026", "10 april-17 maj"
    const months: { [key: string]: number } = {
        'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'maj': 4, 'juni': 5,
        'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11
    };

    const currentYear = new Date().getFullYear();
    let year = currentYear;

    // Om strängen innehåller ett årtal fyra siffror
    const yearMatch = dateStr.match(/\b(20\d{2})\b/);
    if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
    }

    // Hitta första förekomsten av en månad
    let monthIndex = new Date().getMonth();
    for (const [monthName, index] of Object.entries(months)) {
        if (dateStr.toLowerCase().includes(monthName)) {
            monthIndex = index;
            break;
        }
    }

    // Hitta första siffran (dagen)
    const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 1;

    return new Date(year, monthIndex, day, 12, 0, 0); // Sätter tiden till 12:00
}

export async function scrapeVaxjoCo() {
    console.log(`Starting scrape of ${VAXJOCO_URL}`);
    const browser = await puppeteer.launch({ headless: true });

    try {
        const page = await browser.newPage();
        await page.goto(VAXJOCO_URL, { waitUntil: 'networkidle2' });

        const events = await page.evaluate(() => {
            const eventCards = Array.from(document.querySelectorAll('a:has(figure.zoom-puff), a > figure.zoom-puff'));

            // Hantera om a-taggen är förälder eller dom är syskon (ibland strular DOM:en beroende på hur HTML är skriven)
            // Vi letar efter a-taggar som direkt eller indirekt wrappar en figure.zoom-puff
            const validLinks = Array.from(document.querySelectorAll('a')).filter(a => a.querySelector('figure.zoom-puff'));

            return validLinks.map(a => {
                const title = a.querySelector('h3')?.textContent?.trim() || 'Okänd Titel';
                const dateStr = a.querySelector('p.date')?.textContent?.trim() || '';
                const link = (a as HTMLAnchorElement).href || '';

                // Get image specifically from the figure inside the a tag
                let img = a.querySelector('figure.zoom-puff img')?.getAttribute('src') || '';

                // Sometimes the img might be elsewhere if DOM changes slightly
                if (!img) {
                    img = a.querySelector('img')?.getAttribute('src') || '';
                }

                // Location handling
                // Example location DOM context in vaxjoco (often missing on surface level, which is why it was set to Växjö)
                let location = 'Växjö';
                const locationNode = a.querySelector('.location, .place, i.fa-map-marker')?.parentElement;
                if (locationNode) {
                    location = locationNode.textContent?.replace('Växjö', '')?.trim() || 'Växjö';
                }

                // Extract text to find price
                const fullText = a.textContent?.toLowerCase() || '';
                let price: number | string = 0;

                if (fullText.includes('gratis') || fullText.includes('fri entré')) {
                    price = 'Gratis';
                } else {
                    const priceMatch = fullText.match(/(\d+)\s*(kr|sek)/);
                    if (priceMatch) {
                        price = parseInt(priceMatch[1], 10);
                    }
                }

                return { title, dateStr, location: 'Växjö', link, img, price };
            });
        });

        console.log(`Found ${events.length} potential events. Processing...`);

        // Deep scrape each new event
        for (const evt of events) {
            try {
                if (!evt.title || evt.title === 'Okänd Titel' || !evt.link) continue;

                // Skip deep dive if we already have this event saved
                const exists = await eventExistsInDb(evt.link);
                if (exists) {
                    console.log(`Event already exists: ${evt.title}`);
                    continue;
                }

                // Default parsed surface date
                const parsedDate = parseSwedishDate(evt.dateStr);

                // Deep dive to event subpage
                console.log(`Deep scraping: ${evt.title} (${evt.link})`);
                const eventPage = await browser.newPage();

                let finalPrice: number | string | undefined = evt.price;
                let finalImg = evt.img;

                try {
                    await eventPage.goto(evt.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    const deepData = await eventPage.evaluate(() => {
                        const contentText = document.querySelector('.event-content, article, main')?.textContent?.toLowerCase() || '';
                        let deepPrice: number | string = '';

                        if (contentText.includes('gratis') || contentText.includes('fri entré') || contentText.includes('fri entre')) {
                            deepPrice = 'Gratis';
                        } else {
                            // Look for digits next to kr/sek near words like "entré" or "pris"
                            const priceMatch = contentText.match(/(?:pris|entré|biljett)[\s\S]{0,30}?(\d+)\s*(?:kr|sek)/i) ||
                                contentText.match(/(\d+)\s*(?:kr|sek)/i);
                            if (priceMatch) {
                                deepPrice = parseInt(priceMatch[1], 10);
                            }
                        }

                        // Preference for explicitly tagged venue blocks on deep page
                        let deepLocation = '';
                        const venueElements = Array.from(document.querySelectorAll('.venue, .event-location, .info-box, .tribe-events-venue-details'));
                        for (const el of venueElements) {
                            const text = el.textContent || '';
                            if (text.toLowerCase().includes('plats:') || text.toLowerCase().includes('var:')) {
                                // Super crude attempt to grab the word after Plats:
                                const match = text.match(/(?:plats|var|lokal):\s*([a-zA-ZåäöÅÄÖ0-9\s-]+)(?:\n|$)/i);
                                if (match && match[1]) {
                                    deepLocation = match[1].trim();
                                    break;
                                }
                            } else {
                                // Sometimes it's just raw text inside .venue
                                if (text.length > 2 && text.length < 50) deepLocation = text.trim();
                            }
                        }

                        // Last resort regex on full text
                        if (!deepLocation) {
                            const locationMatch = contentText.match(/(?:plats|var|lokal):\s*([a-zA-ZåäöÅÄÖ0-9\s-]{3,30})(?:\n|$|\.)/i);
                            if (locationMatch && locationMatch[1]) deepLocation = locationMatch[1].trim();
                        }

                        // Prefer the huge hero image if one exists on the detail page instead of the thumbnail
                        const heroImg = document.querySelector('.hero-image img, .event-header img, article img')?.getAttribute('src');

                        return { deepPrice, heroImg, deepLocation };
                    });

                    if (deepData.deepPrice !== '') finalPrice = deepData.deepPrice;
                    if (deepData.heroImg) finalImg = deepData.heroImg;
                    if (deepData.deepLocation) evt.location = deepData.deepLocation;

                } catch (e) {
                    console.warn(`Could not deep scrape ${evt.link}, using surface data.`, e);
                } finally {
                    await eventPage.close();
                }

                // Try Nominatim API Geocoding, fallback to Vaxjo Centrum if fails
                const coords = await geocodeVenue(evt.location);
                const lat = coords ? coords[0] : 56.8796;
                const lng = coords ? coords[1] : 14.8094;

                const linkEvent = {
                    title: evt.title,
                    url: evt.link,
                    time: parsedDate,
                    locationName: evt.location,
                    lat,
                    lng,
                    hostName: 'Växjö & Co',
                    category: guessCategoryFromTitle(evt.title),
                    createdAt: new Date(),
                    coverImage: finalImg,
                    price: finalPrice
                };

                await addEventToDb(linkEvent);

            } catch (err) {
                console.error(`Failed to process event ${evt.title}:`, err);
            }
        }
    } catch (error) {
        console.error('Error during scrape:', error);
    } finally {
        await browser.close();
        console.log('Scrape complete.');
    }
}
