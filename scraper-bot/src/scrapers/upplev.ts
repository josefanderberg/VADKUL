import puppeteer from 'puppeteer';
import { db } from '../config/firebase';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue, getVenueCoordinates } from '../utils/venueCoordinates';

const UPPLEV_URL = 'https://upplev.vaxjo.se/evenemang';

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();

    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('sm i') || t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('boardgame') || t.includes('bingo')) return 'game';
    if (t.includes('teater') || t.includes('musikal') || t.includes('konsert') || t.includes('standup') || t.includes('humor') || t.includes('kör') || t.includes('orkester') || t.includes('konst')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting') || t.includes('provning')) return 'food';
    if (t.includes('marknad') || t.includes('loppis')) return 'market';
    if (t.includes('utomhus') || t.includes('natur') || t.includes('vandring') || t.includes('stadsvandring')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym')) return 'training';
    if (t.includes('öppet hus') || t.includes('föreläsning') || t.includes('workshop')) return 'study';

    return 'other';
}

export async function scrapeUpplevVaxjo() {
    console.log(`Starting scrape of ${UPPLEV_URL}`);
    const browser = await puppeteer.launch({ headless: true });

    try {
        const page = await browser.newPage();
        await page.goto(UPPLEV_URL, { waitUntil: 'networkidle2' });

        // Let's click "Visa fler evenemang" a couple of times to get more events if the button exists
        let hasMore = true;
        let clicks = 0;
        console.log("Looking for 'Visa fler' button...");

        while (hasMore && clicks < 4) { // Get ~40-50 events
            const clicked = await page.evaluate(() => {
                // Upplev Vaxjo usually uses a button for pagination
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('fler evenemang'));
                if (btn && (btn as any).offsetHeight > 0) { // Check if visible
                    (btn as HTMLElement).click();
                    return true;
                }
                return false;
            });

            if (clicked) {
                clicks++;
                console.log(`Clicked load more (${clicks}/4). Waiting for events to load...`);
                // Wait a bit for the new events to appear in the DOM
                await new Promise(r => setTimeout(r, 2000));
            } else {
                hasMore = false;
                console.log("No more 'Visa fler' button found or max clicks reached.");
            }
        }

        const events = await page.evaluate(() => {
            const articles = Array.from(document.querySelectorAll('article.uv-page-list-item__wrapper'));

            return articles.map(article => {
                const title = article.querySelector('.uv-page-list-item__title')?.textContent?.trim() || 'Okänd Titel';

                // Get the link (it's often on an a-tag wrapping the article or inside)
                const aTag = article.closest('a') || article.querySelector('a');
                // The URL on Upplev Vaxjo might be relative, so we use href or manually prefix
                let link = aTag?.href || '';
                if (link.startsWith('/')) {
                    link = `https://upplev.vaxjo.se${link}`;
                }

                // Get date from their weird split format
                const descText = article.querySelector('.uv-page-list-item__info-date')?.textContent?.trim() || '';
                const dateNo = article.querySelector('.uv-page-list-item__date-no')?.textContent?.trim() || '';
                const dateText = article.querySelector('.uv-page-list-item__date-text')?.textContent?.trim() || '';
                const dateStr = dateNo && dateText ? `${dateNo} ${dateText}` : descText;

                // Location
                let location = article.querySelector('.uv-page-list-item__info-place-text')?.textContent?.trim() || 'Växjö';
                if (location.toLowerCase().startsWith('plats:')) {
                    location = location.substring(6).trim();
                }

                // Img
                let img = article.querySelector('.uv-page-list-item__image img')?.getAttribute('src') ||
                    article.querySelector('img')?.getAttribute('src') || '';

                // Fix relative image paths
                if (img && img.startsWith('/')) {
                    img = `https://upplev.vaxjo.se${img}`;
                }

                // Price (Hard to find reliably on Upplev without visiting event page, but we check text)
                const fullText = article.textContent?.toLowerCase() || '';
                let price: number | string = 0;

                if (fullText.includes('gratis') || fullText.includes('fri entré') || fullText.includes('fri entre')) {
                    price = 'Gratis';
                } else {
                    // It's rare for Upplev to put price directly on the card, but checking just in case
                    const priceMatch = fullText.match(/(\d+)\s*(kr|sek)/);
                    if (priceMatch) {
                        price = parseInt(priceMatch[1], 10);
                    } else {
                        price = ''; // Unknown unless "Gratis" was found
                    }
                }

                return { title, dateStr, location, link, img, price };
            });
        });

        console.log(`Found ${events.length} potential events. Processing...`);

        // Same simple Swedish date parser as vaxjoco (can be refactored into a utils file later)
        const parseSwedishDate = (dateStr: string): Date => {
            const months: { [key: string]: number } = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'maj': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'okt': 9, 'nov': 10, 'dec': 11,
                'januari': 0, 'februari': 1, 'mars': 2, 'april': 3, 'juni': 5,
                'juli': 6, 'augusti': 7, 'september': 8, 'oktober': 9, 'november': 10, 'december': 11
            };

            const currentYear = new Date().getFullYear();
            let year = currentYear;

            const yearMatch = dateStr.match(/\b(20\d{2})\b/);
            if (yearMatch) {
                year = parseInt(yearMatch[1], 10);
            }

            let monthIndex = new Date().getMonth();
            for (const [monthName, index] of Object.entries(months)) {
                if (dateStr.toLowerCase().includes(monthName)) {
                    monthIndex = index;
                    break;
                }
            }

            const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
            // Default to today if parsing fails completely, but usually works
            const day = dayMatch ? parseInt(dayMatch[1], 10) : new Date().getDate();

            return new Date(year, monthIndex, day, 12, 0, 0);
        };

        for (const evt of events) {
            try {
                // Ignore incomplete events
                if (!evt.title || evt.title === 'Okänd Titel') continue;

                // Skip deep dive if we already have this event saved
                const exists = await eventExistsInDb(evt.link || '');
                if (exists) {
                    console.log(`Event already exists: ${evt.title}`);
                    continue;
                }

                const parsedDate = parseSwedishDate(evt.dateStr);

                let finalPrice: number | string | undefined = evt.price !== '' ? evt.price : undefined;
                let finalLocation = evt.location;

                // DEEP SCRAPING FOR UPPLEV (To find correct prices)
                if (evt.link && evt.link.includes('upplev.vaxjo.se/evenemang')) {
                    console.log(`Deep scraping: ${evt.title} (${evt.link})`);
                    const eventPage = await browser.newPage();
                    try {
                        await eventPage.goto(evt.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                        const deepData = await eventPage.evaluate(() => {
                            let deepPrice: number | string = '';

                            // 1. Check sidebar text explicitly looking for "Pris:" or similar
                            const infoBlocks = Array.from(document.querySelectorAll('.uv-page-blocks .sv-text-portlet-content'))
                                .map(el => el.textContent?.toLowerCase() || '');

                            // Join all blocks
                            const fullContent = infoBlocks.join(' ') + ' ' + (document.querySelector('main')?.textContent?.toLowerCase() || '');

                            if (fullContent.includes('gratis') || fullContent.includes('fri entré') || fullContent.includes('fri entre')) {
                                deepPrice = 'Gratis';
                            } else {
                                // Extract price near "pris", "entré", or just digits + kr
                                const priceMatch = fullContent.match(/(?:pris|entré|biljett)[\s\S]{0,40}?(\d+)\s*(?:kr|sek)/i) ||
                                    fullContent.match(/(\d+)\s*(?:kr|sek)/i);

                                if (priceMatch) {
                                    deepPrice = parseInt(priceMatch[1], 10);
                                }
                            }

                            // Check location in deep scrape if surface location was empty or just "Växjö"
                            let deepLocation = '';
                            const locationMatch = fullContent.match(/(?:plats|var):\s*([a-zA-ZåäöÅÄÖ0-9\s-]+)(?:\n|$)/i);
                            if (locationMatch && locationMatch[1]) {
                                deepLocation = locationMatch[1].trim();
                            }

                            return { deepPrice, deepLocation };
                        });

                        if (deepData.deepPrice !== '') {
                            finalPrice = deepData.deepPrice;
                        }
                        if (deepData.deepLocation && deepData.deepLocation.length > 2) {
                            finalLocation = deepData.deepLocation;
                        }

                    } catch (e) {
                        console.warn(`Could not deep scrape Upplev link ${evt.link}, using surface data.`, e);
                    } finally {
                        await eventPage.close();
                    }
                }

                // Clean up finalLocation
                if (!finalLocation || finalLocation === 'undefined' || finalLocation.trim() === '') {
                    finalLocation = 'Växjö';
                }

                // Try Nominatim API Geocoding, fallback to Vaxjo Centrum if fails
                const coords = await geocodeVenue(finalLocation);
                const lat = coords ? coords[0] : 56.8796;
                const lng = coords ? coords[1] : 14.8094;

                const linkEvent = {
                    title: evt.title,
                    url: evt.link || UPPLEV_URL, // fallback to main page if no specific link
                    time: parsedDate,
                    locationName: finalLocation,
                    lat,
                    lng,
                    hostName: 'Upplev Växjö',
                    category: guessCategoryFromTitle(evt.title),
                    createdAt: new Date(),
                    coverImage: evt.img,
                    price: finalPrice !== undefined ? finalPrice : 0
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
        console.log('Upplev Vaxjo Scrape complete.');
    }
}
