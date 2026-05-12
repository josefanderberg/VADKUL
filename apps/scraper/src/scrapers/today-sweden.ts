/**
 * Scraper: Idag – hela Sverige
 * Hämtar events som händer IDAG från nationella källor.
 * Använder bara fetch + cheerio (ingen webbläsare).
 */

import * as cheerio from 'cheerio';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenue } from '../utils/venueCoordinates';

// Hjälpfunktion för att få dagens datumsträng lokalt (YYYY-MM-DD)
function getTodayStr(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
}

function getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function isToday(date: Date): boolean {
    const { start, end } = getTodayRange();
    return date >= start && date <= end;
}

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('tour')) return 'music';
    if (t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match') || t.includes('tävling')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('bingo')) return 'game';
    if (t.includes('teater') || t.includes('standup') || t.includes('konst') || t.includes('utställning')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting')) return 'food';
    if (t.includes('marknad') || t.includes('loppis') || t.includes('mässa')) return 'market';
    if (t.includes('vandring') || t.includes('utomhus') || t.includes('natur')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym')) return 'training';
    if (t.includes('föreläsning') || t.includes('workshop') || t.includes('seminarium')) return 'study';
    return 'other';
}

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

// ─── 1. TICKSTER – Nationellt, dagens datum ───────────────────────────────────
async function scrapeTicksterToday(todayStr: string): Promise<number> {
    const url = `https://www.tickster.com/se/sv/events/search?q=&date_from=${todayStr}&date_to=${todayStr}`;
    console.log(`  [Tickster] Hämtar: ${url}`);
    let saved = 0;

    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) { console.log(`  [Tickster] Status: ${res.status}`); return 0; }

        const $ = cheerio.load(await res.text());
        const links: { href: string; img: string }[] = [];

        $('a[href*="/events/"]').each((_, el) => {
            const href = $(el).attr('href') || '';
            // Matchar /events/id/datum/namn
            const match = href.match(/\/events\/[a-z0-9]+\/(\d{4}-\d{2}-\d{2})\/[a-z0-9-]+$/);
            if (match && match[1] === todayStr) {
                const fullHref = href.startsWith('http') ? href : `https://www.tickster.com${href}`;
                if (!links.find(l => l.href === fullHref)) {
                    links.push({ href: fullHref, img: $(el).find('img').attr('src') || '' });
                }
            }
        });

        console.log(`  [Tickster] Hittade ${links.length} event i listan.`);

        for (const evt of links) {
            if (await eventExistsInDb(evt.href)) continue;

            try {
                const detailRes = await fetch(evt.href, { headers: HEADERS });
                if (!detailRes.ok) continue;
                const $d = cheerio.load(await detailRes.text());

                const title = $d('h1').first().text().trim();
                if (!title) continue;

                let date = new Date(todayStr + 'T19:00:00');
                let hasTime = false;
                let location = 'Sverige';
                let lat = 59.3293, lng = 18.0686;
                let price: number | string = '';
                let img = evt.img;

                $d('script[type="application/ld+json"]').each((_, el) => {
                    try {
                        const data = JSON.parse($d(el).html() || '');
                        const eventData = Array.isArray(data) ? data.find(i => i['@type'] === 'Event') : (data['@type'] === 'Event' ? data : null);
                        
                        if (eventData) {
                            if (eventData.startDate?.includes('T')) {
                                const t = eventData.startDate.split('T')[1]?.substring(0, 5);
                                if (t) { const [h, m] = t.split(':'); date.setHours(+h, +m); hasTime = true; }
                            }
                            if (eventData.location?.name) location = eventData.location.name;
                            if (eventData.location?.geo) { 
                                lat = parseFloat(eventData.location.geo.latitude); 
                                lng = parseFloat(eventData.location.geo.longitude); 
                            }
                            if (eventData.offers?.price !== undefined) price = eventData.offers.price === 0 ? 'Gratis' : eventData.offers.price;
                            if (eventData.image) img = typeof eventData.image === 'string' ? eventData.image : eventData.image[0];
                        }
                    } catch {}
                });

                if (!isToday(date)) continue;

                if (lat === 59.3293 && location !== 'Sverige') {
                    const coords = await geocodeVenue(location);
                    if (coords) { lat = coords[0]; lng = coords[1]; }
                }

                await addEventToDb({
                    title, url: evt.href, time: date, hasSpecificTime: hasTime,
                    locationName: location, lat, lng,
                    hostName: 'Tickster', category: guessCategoryFromTitle(title),
                    createdAt: new Date(), coverImage: img || undefined, price,
                });
                saved++;
                console.log(`  ✅ [Tickster] ${title} @ ${location}`);
            } catch {}
        }
    } catch (err) {
        console.error(`  [Tickster] Fel:`, err);
    }

    return saved;
}

// ─── 2. EVENTBRITE – Sverige idag ────────────────────────────────────────────
async function scrapeEventbriteToday(): Promise<number> {
    const url = `https://www.eventbrite.se/d/sweden/events--today/`;
    console.log(`  [Eventbrite] Hämtar: ${url}`);
    let saved = 0;

    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) { console.log(`  [Eventbrite] Status: ${res.status}`); return 0; }

        const $ = cheerio.load(await res.text());
        const jsonBlocks: string[] = [];
        $('script[type="application/ld+json"]').each((_, el) => {
            jsonBlocks.push($(el).html() || '');
        });

        for (const block of jsonBlocks) {
            try {
                const data = JSON.parse(block);
                const events = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);
                for (const evt of events) {
                    if (evt['@type'] !== 'Event') continue;
                    if (!evt.startDate) continue;
                    const date = new Date(evt.startDate);
                    if (!isToday(date)) continue;
                    if (await eventExistsInDb(evt.url || '')) continue;

                    const location = evt.location?.name || evt.location?.address?.addressLocality || 'Sverige';
                    let lat = 59.3293, lng = 18.0686;
                    if (evt.location?.geo) { lat = parseFloat(evt.location.geo.latitude); lng = parseFloat(evt.location.geo.longitude); }

                    await addEventToDb({
                        title: evt.name,
                        url: evt.url || '',
                        time: date,
                        hasSpecificTime: evt.startDate.includes('T'),
                        locationName: location, lat, lng,
                        hostName: 'Eventbrite',
                        category: guessCategoryFromTitle(evt.name || ''),
                        createdAt: new Date(),
                        coverImage: typeof evt.image === 'string' ? evt.image : evt.image?.[0],
                        price: evt.offers?.price !== undefined ? (evt.offers.price === 0 ? 'Gratis' : evt.offers.price) : '',
                    });
                    saved++;
                    console.log(`  ✅ [Eventbrite] ${evt.name}`);
                }
            } catch {}
        }
    } catch (err) {
        console.error(`  [Eventbrite] Fel:`, err);
    }

    return saved;
}

// ─── 3. BILLETTO – Sverige idag ───────────────────────────────────────────────
async function scrapeBillettoToday(): Promise<number> {
    // Uppdaterad URL för Billetto Sverige
    const url = `https://billetto.se/l/idag-events`; 
    console.log(`  [Billetto] Hämtar: ${url}`);
    let saved = 0;

    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) { console.log(`  [Billetto] Status: ${res.status}`); return 0; }

        const $ = cheerio.load(await res.text());
        
        // Billetto använder ofta data-attributes eller JSON-LD
        const scripts = $('script[type="application/ld+json"]');
        for (let i = 0; i < scripts.length; i++) {
            try {
                const data = JSON.parse($(scripts[i]).html() || '');
                const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);
                
                for (const item of items) {
                    if (item['@type'] === 'Event') {
                        const date = new Date(item.startDate);
                        if (!isToday(date)) continue;
                        if (await eventExistsInDb(item.url)) continue;

                        await addEventToDb({
                            title: item.name, url: item.url,
                            time: date, hasSpecificTime: item.startDate.includes('T'),
                            locationName: item.location?.name || 'Sverige', lat: 59.3293, lng: 18.0686,
                            hostName: 'Billetto', category: guessCategoryFromTitle(item.name),
                            createdAt: new Date(),
                        });
                        saved++;
                        console.log(`  ✅ [Billetto] ${item.name}`);
                    }
                }
            } catch {}
        }
    } catch (err) {
        console.error(`  [Billetto] Fel:`, err);
    }

    return saved;
}

// ─── HUVUD-EXPORT ─────────────────────────────────────────────────────────────
export async function scrapeTodaySweden(): Promise<void> {
    const todayStr = getTodayStr();
    console.log(`\n📅 Scraping events för idag (${todayStr}) – hela Sverige\n`);

    const t1 = await scrapeTicksterToday(todayStr);
    const t2 = await scrapeEventbriteToday();
    const t3 = await scrapeBillettoToday();

    const total = t1 + t2 + t3;
    console.log(`\n✅ Klar! Sparade ${total} nya event för idag.`);
    console.log(`   Tickster: ${t1}  |  Eventbrite: ${t2}  |  Billetto: ${t3}`);
}
