import * as cheerio from 'cheerio';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

// --- DATE FILTER ---
const now = new Date();
now.setHours(0, 0, 0, 0);
const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const todayStr = now.toISOString().split('T')[0];
const endStr = oneWeekFromNow.toISOString().split('T')[0];

// Billetto Sverige — idag + kommande vecka
// Idag prioriteras med egna URLs
const BILLETTO_URLS = [
    // Idag (högst prioritet – egna URLs)
    `https://billetto.se/se/events?start_date=${todayStr}&end_date=${todayStr}`,
    // Hela veckan per kategori
    `https://billetto.se/se/events?start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=music&start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=food-and-drink&start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=arts&start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=sport&start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=comedy&start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=family&start_date=${todayStr}&end_date=${endStr}`,
    `https://billetto.se/se/events?category=nightlife&start_date=${todayStr}&end_date=${endStr}`,
];

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
};

function isWithinOneWeek(date: Date): boolean {
    return date >= now && date <= oneWeekFromNow;
}

function isToday(date: Date): boolean {
    return date >= now && date <= todayEnd;
}

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('konsert') || t.includes('musik') || t.includes('live') || t.includes('band') || t.includes('kör')) return 'music';
    if (t.includes('fest') || t.includes('party') || t.includes('klubb') || t.includes('nattklubb') || t.includes('aw')) return 'party';
    if (t.includes('sport') || t.includes('match') || t.includes('cup') || t.includes('löp') || t.includes('tävling')) return 'sport';
    if (t.includes('mat') || t.includes('vin') || t.includes('öl') || t.includes('middag') || t.includes('provning')) return 'food';
    if (t.includes('teater') || t.includes('standup') || t.includes('komedi') || t.includes('konst') || t.includes('utställning')) return 'culture';
    if (t.includes('barn') || t.includes('familj') || t.includes('junior')) return 'play';
    if (t.includes('yoga') || t.includes('träning') || t.includes('fitness')) return 'training';
    if (t.includes('marknad') || t.includes('loppis') || t.includes('mässa')) return 'market';
    if (t.includes('workshop') || t.includes('föreläsning') || t.includes('seminarium')) return 'study';
    return 'other';
}

function extractJsonLdEvents(html: string): any[] {
    const $ = cheerio.load(html);
    const events: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const data = JSON.parse($(el).html() || '');
            if (Array.isArray(data)) {
                events.push(...data.filter((d: any) => d['@type'] === 'Event'));
            } else if (data['@type'] === 'Event') {
                events.push(data);
            } else if (data['@graph']) {
                events.push(...data['@graph'].filter((d: any) => d['@type'] === 'Event'));
            }
        } catch {}
    });
    return events;
}

function extractEventLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links = new Set<string>();
    $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        // Billetto event URLs: /e/{id}-{slug} or /events/{slug}
        if (/\/(e|events)\/[a-z0-9-]+/.test(href)) {
            const full = href.startsWith('http') ? href : `https://billetto.se${href}`;
            links.add(full.split('?')[0]);
        }
    });
    return Array.from(links);
}

async function processJsonLdEvent(evt: any): Promise<boolean> {
    const title = evt.name?.trim();
    if (!title) return false;

    const eventUrl = evt.url || '';
    if (!eventUrl) return false;

    if (await eventExistsInDb(eventUrl)) return false;

    if (!evt.startDate) return false;
    const startDate = new Date(evt.startDate);
    if (!isWithinOneWeek(startDate)) return false;

    const locationName = evt.location?.name || evt.location?.address?.addressLocality || '';
    const address = [
        evt.location?.address?.streetAddress,
        evt.location?.address?.addressLocality,
        evt.location?.address?.postalCode,
    ].filter(Boolean).join(', ');

    let lat: number = evt.location?.geo?.latitude ? parseFloat(evt.location.geo.latitude) : 0;
    let lng: number = evt.location?.geo?.longitude ? parseFloat(evt.location.geo.longitude) : 0;

    if ((!lat || !lng) && (address || locationName)) {
        const coords = await geocodeVenueSweden(address || locationName);
        if (coords) { lat = coords[0]; lng = coords[1]; }
    }

    const coverImage = typeof evt.image === 'string'
        ? evt.image
        : Array.isArray(evt.image) ? evt.image[0] : '';

    const price = evt.offers?.price !== undefined
        ? (evt.offers.price === 0 || evt.offers.price === '0' ? 'Gratis' : String(evt.offers.price))
        : '';

    await addEventToDb({
        title,
        url: eventUrl,
        time: startDate,
        hasSpecificTime: evt.startDate.includes('T'),
        locationName: locationName || address || 'Sverige',
        extractedAddress: address || locationName,
        lat,
        lng,
        hostName: evt.organizer?.name || 'Billetto',
        category: guessCategoryFromTitle(title),
        coverImage,
        price,
        createdAt: new Date(),
        isLocationVerified: lat !== 0,
    });

    console.log(`  ✅ ${isToday(startDate) ? '[IDAG] ' : ''}Saved: ${title} @ ${locationName || 'Sverige'}`);
    return true;
}

export async function scrapeBilletto() {
    console.log('Starting Billetto scraper...');
    let totalSaved = 0;
    const seenUrls = new Set<string>();
    const summary: { url: string; status: number; bytes: number; links: number; jsonLd: number; saved: number }[] = [];

    for (const url of BILLETTO_URLS) {
        console.log(`  Fetching: ${url}`);
        const savedBefore = totalSaved;
        try {
            const res = await fetch(url, { headers: HEADERS });
            if (!res.ok) {
                console.warn(`  Billetto returned ${res.status} for ${url}`);
                summary.push({ url, status: res.status, bytes: 0, links: 0, jsonLd: 0, saved: 0 });
                continue;
            }

            const html = await res.text();
            const jsonEvents = extractJsonLdEvents(html);
            const eventLinks = extractEventLinks(html, url);

            console.log(`  HTTP ${res.status} · ${html.length} bytes · ${eventLinks.length} länkar · ${jsonEvents.length} JSON-LD events`);
            summary.push({ url, status: res.status, bytes: html.length, links: eventLinks.length, jsonLd: jsonEvents.length, saved: 0 });

            // Processa JSON-LD direkt (snabbt, ingen extra request)
            for (const evt of jsonEvents) {
                if (evt.url && seenUrls.has(evt.url)) continue;
                if (evt.url) seenUrls.add(evt.url);
                const saved = await processJsonLdEvent(evt);
                if (saved) totalSaved++;
            }

            // Hämta event-sidor för links som inte hade JSON-LD
            const linksToFetch = eventLinks.filter(l => !seenUrls.has(l));
            for (const link of linksToFetch.slice(0, 50)) { // max 50 per URL för att hålla nere tid
                seenUrls.add(link);
                try {
                    const detailRes = await fetch(link, { headers: HEADERS });
                    if (!detailRes.ok) continue;
                    const detailHtml = await detailRes.text();
                    const detailEvents = extractJsonLdEvents(detailHtml);
                    for (const evt of detailEvents) {
                        const saved = await processJsonLdEvent(evt);
                        if (saved) totalSaved++;
                    }
                    await new Promise(r => setTimeout(r, 300)); // rate limiting
                } catch {}
            }

        } catch (err) {
            console.error(`  Error fetching ${url}:`, err);
        }

        if (summary.length > 0) summary[summary.length - 1].saved = totalSaved - savedBefore;
    }

    console.log(`\n[Billetto] Sammanställning (${summary.length} URLs):`);
    for (const r of summary) {
        console.log(`  ${r.status} · ${r.bytes}B · links=${r.links} json=${r.jsonLd} saved=${r.saved}  ${r.url}`);
    }
    console.log(`Billetto scrape complete. Saved ${totalSaved} new events.`);
}
