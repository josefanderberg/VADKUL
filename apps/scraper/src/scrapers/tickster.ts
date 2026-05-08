import * as cheerio from 'cheerio';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue } from '../utils/venueCoordinates';

const TICKSTER_URL = 'https://www.tickster.com/se/sv/events/search?q=v%C3%A4xj%C3%B6';

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('orkester') || t.includes('tour')) return 'music';
    if (t.includes('sm i') || t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match') || t.includes('tävling') || t.includes('lakers') || t.includes('hockey')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('boardgame') || t.includes('bingo')) return 'game';
    if (t.includes('teater') || t.includes('musikal') || t.includes('standup') || t.includes('humor') || t.includes('konst') || t.includes('utställning') || t.includes('komedi') || t.includes('magic')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting') || t.includes('provning')) return 'food';
    if (t.includes('marknad') || t.includes('loppis') || t.includes('mässa') || t.includes('megaloppis')) return 'market';
    if (t.includes('utomhus') || t.includes('natur') || t.includes('vandring')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga') || t.includes('junior')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym') || t.includes('fitness')) return 'training';
    if (t.includes('öppet hus') || t.includes('föreläsning') || t.includes('workshop') || t.includes('seminarium') || t.includes('mässa')) return 'study';
    if (t.includes('campus') || t.includes('student') || t.includes('kår')) return 'campus';
    return 'other';
}

export async function scrapeTickster() {
    console.log(`Starting scrape of ${TICKSTER_URL}`);
    try {
        const response = await fetch(TICKSTER_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            }
        });

        if (!response.ok) {
            console.error(`Tickster returned status ${response.status}`);
            return;
        }

        const text = await response.text();
        const $ = cheerio.load(text);

        const eventLinks: { href: string; img: string; dateFromUrl: string }[] = [];
        $('a[href*="/events/"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            // Match pattern like /se/sv/events/z5jlzlgf6yu6xzx/2026-03-21/daniel-kane-impossible-magic
            const urlMatch = href.match(/\/events\/[a-z0-9]+\/(\d{4}-\d{2}-\d{2})\/[a-z0-9-]+$/);
            if (urlMatch) {
                const img = $(el).find('img').attr('src') || '';
                eventLinks.push({
                    href: `https://www.tickster.com${href}`,
                    img,
                    dateFromUrl: urlMatch[1]
                });
            }
        });

        // Deduplicate links
        const uniqueEvents = Array.from(new Map(eventLinks.map(e => [e.href, e])).values());
        console.log(`Found ${uniqueEvents.length} Tickster events to process.`);

        for (const evt of uniqueEvents) {
            try {
                // Check DB first to save network requests
                const exists = await eventExistsInDb(evt.href);
                if (exists) {
                    console.log(`Already exists: ${evt.href}`);
                    continue;
                }

                console.log(`Deep scraping: ${evt.href}`);
                const detailRes = await fetch(evt.href, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                if (!detailRes.ok) continue;

                const detailHtml = await detailRes.text();
                const $detail = cheerio.load(detailHtml);

                const title = $detail('h1').first().text().replace(/\s+/g, ' ').trim();
                if (!title) continue;

                const bodyText = $detail('body').text().replace(/\s+/g, ' ');

                // --- Extract date from URL ---
                const parsedDate = new Date(evt.dateFromUrl + 'T00:00:00');
                let hasSpecificTime = false;

                // --- Try JSON-LD first (some pages may have it) ---
                let jsonLdLat: number | null = null;
                let jsonLdLng: number | null = null;
                let jsonLdPrice: number | string | undefined;
                let jsonLdLocation = '';
                let jsonLdImg = evt.img;

                $detail('script[type="application/ld+json"]').each((_, el) => {
                    try {
                        const data = JSON.parse($detail(el).html() || '');
                        if (data['@type'] === 'Event') {
                            if (data.offers && data.offers.price) {
                                jsonLdPrice = (data.offers.price === 0 || data.offers.price === '0') ? 'Gratis' : parseInt(data.offers.price, 10);
                            }
                            if (data.location && data.location.name) jsonLdLocation = data.location.name;
                            if (data.location && data.location.geo) {
                                jsonLdLat = data.location.geo.latitude;
                                jsonLdLng = data.location.geo.longitude;
                            }
                            if (data.startDate) {
                                const jd = data.startDate;
                                if (jd.includes('T')) {
                                    const timePart = jd.split('T')[1]?.substring(0, 5);
                                    if (timePart && timePart.length >= 5) {
                                        const tp = timePart.split(':');
                                        parsedDate.setHours(parseInt(tp[0], 10), parseInt(tp[1], 10), 0);
                                        hasSpecificTime = true;
                                    }
                                }
                            }
                            if (data.image) {
                                jsonLdImg = typeof data.image === 'string' ? data.image : data.image[0];
                            }
                        }
                    } catch (e) { }
                });

                // --- Fallback: extract time from body text ---
                if (!hasSpecificTime) {
                    const timeMatches = bodyText.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g);
                    if (timeMatches && timeMatches.length > 0) {
                        // Use the first reasonable time (skip very early times like 00:00)
                        for (const tm of timeMatches) {
                            const normalized = tm.replace('.', ':');
                            const parts = normalized.split(':');
                            const h = parseInt(parts[0], 10);
                            const m = parseInt(parts[1], 10);
                            if (h >= 6) { // Skip midnight-ish times
                                parsedDate.setHours(h, m, 0);
                                hasSpecificTime = true;
                                console.log(`  → Found time in text: ${normalized}`);
                                break;
                            }
                        }
                    }
                }

                // --- Fallback: extract location from body text ---
                let finalLocation = jsonLdLocation;
                if (!finalLocation) {
                    const knownVenues = [
                        'Vida Arena', 'Fortnox Arena', 'Växjö Konserthus', 'Konserthuset',
                        'Kulturhuset', 'Tipshallen', 'Arenastaden', 'Stadsparken',
                        'Utvandrarnas hus', 'Smålands Museum', 'Domkyrkan'
                    ];
                    for (const venue of knownVenues) {
                        if (bodyText.toLowerCase().includes(venue.toLowerCase())) {
                            finalLocation = venue;
                            break;
                        }
                    }
                    if (!finalLocation) finalLocation = 'Växjö';
                }
                finalLocation = finalLocation.replace(/\s+/g, ' ').trim();

                // --- Resolve coordinates ---
                let lat: number;
                let lng: number;

                if (jsonLdLat && jsonLdLng) {
                    lat = jsonLdLat;
                    lng = jsonLdLng;
                } else {
                    const coords = await geocodeVenue(finalLocation);
                    lat = coords ? coords[0] : 56.8796;
                    lng = coords ? coords[1] : 14.8094;
                }

                const linkEvent = {
                    title: title,
                    url: evt.href,
                    time: parsedDate,
                    hasSpecificTime,
                    locationName: finalLocation,
                    lat,
                    lng,
                    hostName: 'Tickster',
                    category: guessCategoryFromTitle(title),
                    createdAt: new Date(),
                    coverImage: jsonLdImg || undefined,
                    price: jsonLdPrice !== undefined ? jsonLdPrice : ''
                };

                await addEventToDb(linkEvent);
                console.log(`  ✅ Saved: ${title} @ ${finalLocation} [${lat.toFixed(4)}, ${lng.toFixed(4)}] Tid: ${hasSpecificTime ? parsedDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : 'okänd'}`);

            } catch (err) {
                console.error(`Failed to process Tickster event ${evt.href}:`, err);
            }
        }

        console.log('Tickster scrape complete.');

    } catch (error) {
        console.error('Error during Tickster scrape:', error);
    }
}
