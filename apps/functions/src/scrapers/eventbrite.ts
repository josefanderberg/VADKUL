import * as cheerio from 'cheerio';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue } from '../utils/venueCoordinates';

// --- SCRAPE TARGETS ---
// Eventbrite online-search för Växjö och Kronoberg-regionen
const EVENTBRITE_URLS = [
    'https://www.eventbrite.se/d/sweden--v%C3%A4xj%C3%B6/events/',
    'https://www.eventbrite.se/d/sweden--kronoberg/events/',
];

// --- DATE FILTER ---
const now = new Date();
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const oneWeekFromNow = new Date(now.getTime() + ONE_WEEK);

function isWithinOneWeek(date: Date): boolean {
    return date >= now && date <= oneWeekFromNow;
}

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('orkester') || t.includes('tour')) return 'music';
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

export async function scrapeEventbrite() {
    console.log('Starting Eventbrite scraper...');
    let totalSaved = 0;

    for (const url of EVENTBRITE_URLS) {
        console.log(`  Fetching: ${url}`);
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
                }
            });

            if (!res.ok) {
                console.warn(`  Eventbrite returned ${res.status} for ${url}`);
                continue;
            }

            const html = await res.text();
            const $ = cheerio.load(html);

            // Eventbrite event cards
            const eventLinks: string[] = [];
            $('a[href*="/e/"]').each((_, el) => {
                const href = $(el).attr('href') || '';
                if (href.includes('/e/') && href.includes('eventbrite.se')) {
                    const cleanHref = href.split('?')[0]; // strip query params
                    if (!eventLinks.includes(cleanHref)) {
                        eventLinks.push(cleanHref);
                    }
                }
            });

            // Also check JSON-LD for structured event data in the page
            let jsonEvents: any[] = [];
            $('script[type="application/ld+json"]').each((_, el) => {
                try {
                    const data = JSON.parse($(el).html() || '');
                    if (Array.isArray(data)) jsonEvents = jsonEvents.concat(data.filter(d => d['@type'] === 'Event'));
                    else if (data['@type'] === 'Event') jsonEvents.push(data);
                    else if (data['@graph']) jsonEvents = jsonEvents.concat(data['@graph'].filter((d: any) => d['@type'] === 'Event'));
                } catch {}
            });

            console.log(`  Found ${eventLinks.length} event links and ${jsonEvents.length} JSON-LD events on ${url}`);

            // Process JSON-LD events first (most reliable)
            for (const evt of jsonEvents) {
                try {
                    const title = evt.name;
                    if (!title) continue;

                    const eventUrl = evt.url || '';
                    const exists = await eventExistsInDb(eventUrl);
                    if (exists) continue;

                    // Parse date
                    if (!evt.startDate) continue;
                    const startDate = new Date(evt.startDate);
                    if (!isWithinOneWeek(startDate)) {
                        console.log(`  Skipping (outside 1 week): ${title} @ ${startDate.toLocaleDateString('sv-SE')}`);
                        continue;
                    }

                    const locationName = evt.location?.name || evt.location?.address?.streetAddress || 'Växjö';
                    const lat = evt.location?.geo?.latitude || null;
                    const lng = evt.location?.geo?.longitude || null;
                    const price = evt.offers?.price !== undefined
                        ? (evt.offers.price === 0 || evt.offers.price === '0' ? 'Gratis' : evt.offers.price)
                        : '';
                    const coverImage = typeof evt.image === 'string' ? evt.image : evt.image?.[0] || undefined;

                    let resolvedLat = lat;
                    let resolvedLng = lng;
                    if (!lat || !lng) {
                        const coords = await geocodeVenue(locationName);
                        if (!coords) {
                            // Geokodning misslyckades — hoppa över hellre än att stämpla
                            // eventet på Stortorget (falska pins på centrum).
                            console.warn(`  ⏭️ Hoppar över "${title}" — kunde inte geokoda "${locationName}"`);
                            continue;
                        }
                        resolvedLat = coords[0];
                        resolvedLng = coords[1];
                    }

                    await addEventToDb({
                        title,
                        url: eventUrl,
                        time: startDate,
                        hasSpecificTime: evt.startDate.includes('T'),
                        locationName,
                        lat: resolvedLat,
                        lng: resolvedLng,
                        hostName: evt.organizer?.name || 'Eventbrite',
                        category: guessCategoryFromTitle(title),
                        createdAt: new Date(),
                        coverImage,
                        price,
                    });
                    totalSaved++;
                    console.log(`  ✅ Saved (JSON-LD): ${title} @ ${locationName}`);
                } catch (e) {
                    console.error('  Failed to save JSON-LD event:', e);
                }
            }

        } catch (err) {
            console.error(`  Error fetching ${url}:`, err);
        }
    }

    console.log(`Eventbrite scrape complete. Saved ${totalSaved} new events.`);
}
