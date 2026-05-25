import puppeteer, { Browser, Page } from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

// --- DATE FILTER: Kommande 7 dagar ---
const now = new Date();
now.setHours(0, 0, 0, 0);
const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
const oneWeekFromNow = new Date(now.getTime() + ONE_WEEK);

const todayStr = now.toISOString().split('T')[0];
const endStr = oneWeekFromNow.toISOString().split('T')[0];

// Sverige-bred sökning — idag prioriteras, sedan hela veckan
const SEARCH_URLS = [
    // --- IDAG FÖRST (prioritet) ---
    `https://www.tickster.com/se/sv/events/search?q=&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=konsert&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=musik&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=sport&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=teater&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=standup&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=dans&date_from=${todayStr}&date_to=${todayStr}`,
    `https://www.tickster.com/se/sv/events/search?q=barn&date_from=${todayStr}&date_to=${todayStr}`,
    // --- KOMMANDE VECKA ---
    `https://www.tickster.com/se/sv/events/search?q=&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=konsert&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=musik&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=festival&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=teater&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=sport&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=standup&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=mat&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=krog&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=dans&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=barn&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=marknad&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=konst&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=quiz&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=yoga&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=utomhus&date_from=${todayStr}&date_to=${endStr}`,
    `https://www.tickster.com/se/sv/events/search?q=expo&date_from=${todayStr}&date_to=${endStr}`,
];

function isWithinOneWeek(date: Date): boolean {
    return date >= now && date <= oneWeekFromNow;
}

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (t.includes('fest') || t.includes('aw') || t.includes('klubb') || t.includes('party') || t.includes('krog')) return 'party';
    if (t.includes('musik') || t.includes('konsert') || t.includes('kör') || t.includes('orkester') || t.includes('tour') || t.includes('band')) return 'music';
    if (t.includes('sm i') || t.includes('cup') || t.includes('lopp') || t.includes('sport') || t.includes('match') || t.includes('tävling') || t.includes('hockey') || t.includes('fotboll') || t.includes('handboll')) return 'sport';
    if (t.includes('quiz') || t.includes('spel') || t.includes('boardgame') || t.includes('bingo')) return 'game';
    if (t.includes('teater') || t.includes('musikal') || t.includes('standup') || t.includes('humor') || t.includes('konst') || t.includes('utställning') || t.includes('komedi') || t.includes('magic')) return 'culture';
    if (t.includes('mat') || t.includes('öl') || t.includes('vin') || t.includes('dinner') || t.includes('tasting') || t.includes('provning') || t.includes('middag')) return 'food';
    if (t.includes('marknad') || t.includes('loppis') || t.includes('mässa')) return 'market';
    if (t.includes('utomhus') || t.includes('natur') || t.includes('vandring')) return 'outdoor';
    if (t.includes('barn') || t.includes('familj') || t.includes('saga') || t.includes('junior')) return 'play';
    if (t.includes('träning') || t.includes('yoga') || t.includes('gym') || t.includes('fitness')) return 'training';
    if (t.includes('festival')) return 'music';
    return 'other';
}

/**
 * Extraherar event-links från en renderad Tickster-listsida via Puppeteer.
 */
async function discoverEventLinks(page: Page, url: string): Promise<{ href: string; dateFromUrl: string }[]> {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        // Vänta på event-links
        await page.waitForSelector('a[href*="/events/"]', { timeout: 8000 }).catch(() => {});

        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/events/"]'));
            return anchors
                .map(a => (a as HTMLAnchorElement).href)
                .filter(href => /\/events\/[a-z0-9]+\/\d{4}-\d{2}-\d{2}\//.test(href));
        });

        const result: { href: string; dateFromUrl: string }[] = [];
        for (const href of links) {
            const m = href.match(/\/events\/[a-z0-9]+\/(\d{4}-\d{2}-\d{2})\//);
            if (m) {
                const eventDate = new Date(m[1] + 'T00:00:00');
                if (isWithinOneWeek(eventDate)) {
                    result.push({ href, dateFromUrl: m[1] });
                }
            }
        }
        return result;
    } catch (err) {
        console.error(`  ⚠️ Kunde inte hämta listsida: ${url}`, err);
        return [];
    }
}

/**
 * Extraherar event-detaljer från en renderad Tickster-eventsida.
 * Hämtar: titel, tid, pris, venue-namn, adress (street + city + postalcode), bild.
 */
async function extractEventDetails(page: Page, href: string, dateFromUrl: string) {
    await page.goto(href, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});

    return await page.evaluate((dateStr: string) => {
        // Titel
        const title = (document.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim();
        if (!title) return null;

        // Bild
        const ogImg = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || '';
        const firstImg = (document.querySelector('img[src*="cdn"], img[src*="cloudfront"], img[src*="tickster"]') as HTMLImageElement)?.src || '';
        const coverImage = ogImg || firstImg || '';

        // JSON-LD
        let jsonTime = '';
        let jsonVenue = '';
        let jsonStreet = '';
        let jsonCity = '';
        let jsonPostal = '';
        let jsonLat: number | null = null;
        let jsonLng: number | null = null;
        let jsonPrice: string | number = '';

        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const s of scripts) {
            try {
                const d = JSON.parse(s.textContent || '');
                if (d['@type'] === 'Event') {
                    jsonTime = d.startDate || '';
                    if (d.location) {
                        jsonVenue = d.location.name || '';
                        if (d.location.address) {
                            jsonStreet = d.location.address.streetAddress || '';
                            jsonCity = d.location.address.addressLocality || '';
                            jsonPostal = d.location.address.postalCode || '';
                        }
                        if (d.location.geo) {
                            jsonLat = d.location.geo.latitude ?? null;
                            jsonLng = d.location.geo.longitude ?? null;
                        }
                    }
                    if (d.offers?.price !== undefined) {
                        const p = d.offers.price;
                        jsonPrice = (p === 0 || p === '0') ? 'Gratis' : parseInt(p, 10);
                    }
                }
            } catch (_) {}
        }

        // Microdata — venue address från Schema.org markup (event-specifik, ej Tickster AB)
        // Tickster-sidor har FLERA address-block; vi vill det som hör till eventet, ej footer
        // Strategi: ta det block som är närmast h1 i DOM, dvs det första som inte är i footer
        let microdataStreet = '';
        let microdataCity = '';
        let microdataPostal = '';
        let microdataVenue = '';

        const eventScope = document.querySelector('[itemtype*="Event"]');
        if (eventScope) {
            microdataVenue = (eventScope.querySelector('[itemprop="location"] [itemprop="name"]') as HTMLElement)?.textContent?.trim() || '';
            microdataStreet = (eventScope.querySelector('[itemprop="streetAddress"]') as HTMLElement)?.textContent?.trim() || '';
            microdataCity = (eventScope.querySelector('[itemprop="addressLocality"]') as HTMLElement)?.textContent?.trim() || '';
            microdataPostal = (eventScope.querySelector('[itemprop="postalCode"]') as HTMLElement)?.textContent?.trim() || '';
        }

        // Fallback: sök i sidans synliga text efter adress-mönster (SE-XXX XX STAD eller GATUNAMN N)
        let textStreet = '';
        let textCity = '';

        // Kolla body text för tydliga address-mönster
        const allText = Array.from(document.querySelectorAll('p, span, div, li, address'))
            .map(el => el.textContent?.trim() || '')
            .filter(t => t.length > 3 && t.length < 120);

        const streetPattern = /^[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ]+(gatan|vägen|allén|plan|torg|platsen|gränd|backe|väg|gat)\s+\d+/i;
        const cityPattern = /\b(Stockholm|Göteborg|Malmö|Uppsala|Västerås|Örebro|Linköping|Helsingborg|Jönköping|Norrköping|Lund|Umeå|Gävle|Borås|Eskilstuna|Södertälje|Karlstad|Täby|Sundsvall|Luleå|Östersund|Växjö|Kalmar|Halmstad|Falun|Skellefteå|Kristianstad|Växjö)\b/i;

        for (const t of allText) {
            if (!textStreet && streetPattern.test(t)) textStreet = t;
            if (!textCity) {
                const m = t.match(cityPattern);
                if (m) textCity = m[1];
            }
            if (textStreet && textCity) break;
        }

        // Konsolidera adress
        const venue = jsonVenue || microdataVenue || '';
        const street = jsonStreet || microdataStreet || textStreet || '';
        const city = jsonCity || microdataCity || textCity || '';
        const postal = jsonPostal || microdataPostal || '';

        // Bygg geocodnings-sträng
        const addressParts = [street, postal, city].filter(Boolean);
        const geocodeQuery = addressParts.length > 0
            ? addressParts.join(', ')
            : venue || 'Sverige';

        // Tid
        let parsedTime = dateStr + 'T00:00:00';
        let hasSpecificTime = false;
        if (jsonTime && jsonTime.includes('T')) {
            parsedTime = jsonTime;
            hasSpecificTime = true;
        } else {
            // Sök tid i body text
            const bodyText = document.body.textContent || '';
            const timeMatch = bodyText.match(/\b([01]?\d|2[0-3])[:.:]([0-5]\d)\b/);
            if (timeMatch) {
                const h = parseInt(timeMatch[1], 10);
                const m = parseInt(timeMatch[2], 10);
                if (h >= 6) {
                    parsedTime = dateStr + `T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
                    hasSpecificTime = true;
                }
            }
        }

        return {
            title,
            venue,
            street,
            city,
            postal,
            geocodeQuery,
            parsedTime,
            hasSpecificTime,
            jsonLat,
            jsonLng,
            coverImage,
            jsonPrice,
        };
    }, dateFromUrl);
}

export async function scrapeTickster() {
    console.log('🎟️  Starting Tickster scraper (Puppeteer, Sverige-bred)...');

    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Blockera tung media för snabbare laddning
        await page.setRequestInterception(true);
        page.on('request', req => {
            const type = req.resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // --- Fas 1: Samla alla event-URLs ---
        const seenHrefs = new Set<string>();
        const allLinks: { href: string; dateFromUrl: string }[] = [];

        for (const searchUrl of SEARCH_URLS) {
            console.log(`  🔍 Söker: ${searchUrl}`);
            const links = await discoverEventLinks(page, searchUrl);
            let newCount = 0;
            for (const link of links) {
                if (!seenHrefs.has(link.href)) {
                    seenHrefs.add(link.href);
                    allLinks.push(link);
                    newCount++;
                }
            }
            console.log(`     → ${newCount} nya event-URLs (totalt: ${allLinks.length})`);
        }

        console.log(`\n📋 Totalt ${allLinks.length} unika Tickster-events att processa.`);

        // --- Fas 2: Deep-scrape varje event (i batchar om 10) ---
        let saved = 0;
        let skipped = 0;

        for (const evt of allLinks) {
            try {
                // Kolla DB först
                if (await eventExistsInDb(evt.href)) {
                    skipped++;
                    continue;
                }

                console.log(`  📄 Scraping: ${evt.href}`);
                const details = await extractEventDetails(page, evt.href, evt.dateFromUrl);

                if (!details || !details.title) {
                    console.log(`     ⚠️  Ingen titel, hoppar.`);
                    continue;
                }

                // Sanera bort Tickster AB:s kontoradress (Magasinsgatan 8, 411 18
                // Göteborg ≈ 57.7088, 11.967). Den läcker in på event utan venue
                // via text-fallback eller JSON-LD och ger fel locationName + GPS.
                const isTicksterOfficeStreet = /Magasinsgatan\s*8\b/i.test(details.street || '');
                const isTicksterOfficePostal = /^411\s*1[58]\b/.test((details.postal || '').replace(/\s+/g, ''));
                const cityIsGoteborg = /^\s*g(ö|o)teborg\s*$/i.test(details.city || '');
                if ((isTicksterOfficeStreet || isTicksterOfficePostal) && !cityIsGoteborg) {
                    console.log(`     🧹 Tickster-kontorsadress detekterad (street="${details.street}", postal="${details.postal}", city="${details.city}") — kastar street/postal.`);
                    details.street = '';
                    details.postal = '';
                    const parts = [details.city].filter(Boolean);
                    details.geocodeQuery = parts.length > 0 ? parts.join(', ') : (details.venue || 'Sverige');
                }
                const ticksterLat = 57.7088, ticksterLng = 11.967;
                if (
                    typeof details.jsonLat === 'number' && typeof details.jsonLng === 'number' &&
                    Math.abs(details.jsonLat - ticksterLat) < 0.005 &&
                    Math.abs(details.jsonLng - ticksterLng) < 0.005 &&
                    !cityIsGoteborg
                ) {
                    console.log(`     🧹 Tickster-kontorskoord detekterad (${details.jsonLat}, ${details.jsonLng}) — geokoda istället.`);
                    details.jsonLat = null;
                    details.jsonLng = null;
                }

                // Koordinater
                let lat: number;
                let lng: number;

                if (details.jsonLat && details.jsonLng) {
                    lat = details.jsonLat;
                    lng = details.jsonLng;
                    console.log(`     📍 Koordinater från JSON-LD: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                } else {
                    // Geocoda adressen med Sverige-bred sökning
                    console.log(`     🗺️  Geocodar: "${details.geocodeQuery}"`);
                    const coords = await geocodeVenueSweden(details.geocodeQuery);
                    if (coords) {
                        lat = coords[0];
                        lng = coords[1];
                        console.log(`     📍 Geocodad: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                    } else {
                        // Geocoda bara stad som fallback
                        const cityCoords = details.city ? await geocodeVenueSweden(details.city) : null;
                        lat = cityCoords ? cityCoords[0] : 59.3293; // Stockholm centrum som yttersta fallback
                        lng = cityCoords ? cityCoords[1] : 18.0686;
                        console.log(`     📍 Fallback stad: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`);
                    }
                }

                const locationName = [details.venue, details.street, details.city]
                    .filter(Boolean)
                    .join(', ') || details.city || 'Sverige';

                const linkEvent = {
                    title: details.title,
                    url: evt.href,
                    time: new Date(details.parsedTime),
                    hasSpecificTime: details.hasSpecificTime,
                    locationName,
                    lat,
                    lng,
                    hostName: 'Tickster',
                    category: guessCategoryFromTitle(details.title),
                    createdAt: new Date(),
                    coverImage: details.coverImage || '',
                    price: details.jsonPrice !== undefined && details.jsonPrice !== null ? details.jsonPrice : '',
                };

                await addEventToDb(linkEvent);
                saved++;
                const timeStr = details.hasSpecificTime
                    ? new Date(details.parsedTime).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
                    : 'okänd tid';
                console.log(`  ✅ Sparat: ${details.title} @ ${locationName} [${lat.toFixed(4)}, ${lng.toFixed(4)}] — ${timeStr}`);

            } catch (err) {
                console.error(`  ❌ Fel för ${evt.href}:`, err);
            }
        }

        console.log(`\n🎉 Tickster klart! Sparade ${saved} nya event. (${skipped} redan i DB)`);

    } finally {
        if (browser) await browser.close();
    }
}
