import * as cheerio from 'cheerio';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

// --- SCRAPE TARGETS ---
// Alla större svenska städer
const SWEDISH_CITIES = [
    'stockholm', 'göteborg', 'malmö', 'uppsala', 'linköping',
    'örebro', 'helsingborg', 'norrköping', 'jönköping', 'umeå',
    'lund', 'västerås', 'sundsvall', 'karlstad', 'växjö', 'gävle',
    'borås', 'eskilstuna', 'halmstad', 'östersund', 'kronoberg',
];

const EVENTBRITE_URLS = SWEDISH_CITIES.map(
    city => `https://www.eventbrite.se/d/sweden--${encodeURIComponent(city)}/events/`
);

// --- DATE FILTER ---
const now = new Date();
now.setHours(0, 0, 0, 0);
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const oneWeekFromNow = new Date(now.getTime() + ONE_WEEK);
const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

function isWithinOneWeek(date: Date): boolean {
    return date >= now && date <= oneWeekFromNow;
}

function isToday(date: Date): boolean {
    return date >= now && date <= todayEnd;
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
    const summary: { url: string; status: number; bytes: number; links: number; jsonLd: number; saved: number }[] = [];

    for (const url of EVENTBRITE_URLS) {
        console.log(`  Fetching: ${url}`);
        const savedBefore = totalSaved;
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
                summary.push({ url, status: res.status, bytes: 0, links: 0, jsonLd: 0, saved: 0 });
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

            console.log(`  HTTP ${res.status} · ${html.length} bytes · ${eventLinks.length} länkar · ${jsonEvents.length} JSON-LD events`);
            summary.push({ url, status: res.status, bytes: html.length, links: eventLinks.length, jsonLd: jsonEvents.length, saved: 0 });

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

                    let resolvedLat = lat || 0;
                    let resolvedLng = lng || 0;
                    if (!lat || !lng) {
                        const address = [
                            evt.location?.address?.streetAddress,
                            evt.location?.address?.addressLocality,
                        ].filter(Boolean).join(', ');
                        const coords = await geocodeVenueSweden(address || locationName);
                        if (coords) { resolvedLat = coords[0]; resolvedLng = coords[1]; }
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
                        isLocationVerified: resolvedLat !== 0,
                    });
                    totalSaved++;
                    console.log(`  ✅ ${isToday(startDate) ? '[IDAG] ' : ''}Saved: ${title} @ ${locationName}`);
                } catch (e) {
                    console.error('  Failed to save JSON-LD event:', e);
                }
            }

        } catch (err) {
            console.error(`  Error fetching ${url}:`, err);
        }

        if (summary.length > 0) summary[summary.length - 1].saved = totalSaved - savedBefore;
    }

    console.log(`\n[Eventbrite] Sammanställning (${summary.length} URLs):`);
    for (const r of summary) {
        console.log(`  ${r.status} · ${r.bytes}B · links=${r.links} json=${r.jsonLd} saved=${r.saved}  ${r.url}`);
    }
    console.log(`Eventbrite scrape complete. Saved ${totalSaved} new events.`);
}
