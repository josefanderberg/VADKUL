import puppeteer, { Browser, Page } from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';

function getDateRange() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    return { now, end, todayEnd };
}

function isWithinRange(date: Date, now: Date, end: Date): boolean {
    return date >= now && date <= end;
}

function isToday(date: Date, now: Date, todayEnd: Date): boolean {
    return date >= now && date <= todayEnd;
}

function guessCategoryFromTitle(title: string): string {
    const t = title.toLowerCase();
    if (/standup|stand.?up|komedi|humor|comedy/.test(t)) return 'comedy';
    if (/teater|musikal|musical|balett|opera|cirkus|föreställning|kabaret|revy/.test(t)) return 'performing-arts';
    if (/konsert|festival|sinfoni|kör\b|orkester|symfoni|musik(?!al)|\btour\b|\bband\b|gitarr|jazz\b|blues|live\s+music/.test(t)) return 'music';
    if (/\b(sm i|cup|lopp|match|tävling|hockey|fotboll|handboll|basket|tennis|golf|cykel|simning|friidrott|sport)\b/.test(t)) return 'sport';
    if (/quiz|spel(?!a)|boardgame|bingo|escape|game\s+night/.test(t)) return 'game';
    if (/\b(mat|öl|vin|beer|dinner|tasting|provning|middag|måltid|krog|brunch)\b/.test(t)) return 'food-drink';
    if (/marknad|loppis|mässa|expo/.test(t)) return 'market';
    if (/utomhus|natur|vandring|friluft|hike|hiking/.test(t)) return 'outdoor';
    if (/\b(barn|familj|junior)\b|sagotr/.test(t)) return 'family';
    if (/träning|yoga|gym|fitness|breathwork|mindfulness|löpning|running/.test(t)) return 'training';
    if (/networking|meetup|mingle|fika|network/.test(t)) return 'social';
    if (/\b(fest|party|gala|bal|aw)\b|after.?work/.test(t)) return 'social';
    if (/konst|utställning|vernissage|galleri/.test(t)) return 'art';
    if (/workshop|kurs|föreläsning|seminarium|utbildning|study|learning|hack/.test(t)) return 'education';
    return 'other';
}

// Meetup find-URLs for Swedish cities — inPerson events within 7 days
const MEETUP_SEARCH_URLS = [
    'https://www.meetup.com/find/?location=se--Stockholm&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Göteborg&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Malmö&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Uppsala&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Linköping&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Västerås&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Örebro&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Helsingborg&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Jönköping&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Norrköping&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Lund&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Sundsvall&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Umeå&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Karlstad&source=EVENTS&eventType=inPerson',
    'https://www.meetup.com/find/?location=se--Växjö&source=EVENTS&eventType=inPerson',
];

async function discoverMeetupLinks(page: Page, url: string): Promise<string[]> {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('a[href*="/events/"]', { timeout: 10000 }).catch(() => {});

        // Scroll down to trigger lazy loading
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 1500));

        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/events/"]'));
            return anchors
                .map(a => (a as HTMLAnchorElement).href.split('?')[0])
                .filter(href => /meetup\.com\/[^/]+\/events\/\d+/.test(href));
        });

        return [...new Set(links)];
    } catch (err) {
        console.error(`  [Meetup] Kunde inte hämta listsida: ${url}`, err);
        return [];
    }
}

async function extractMeetupEvent(page: Page, url: string) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {});

        return await page.evaluate(() => {
            // Try JSON-LD first
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of scripts) {
                try {
                    const d = JSON.parse(s.textContent || '');
                    if (d['@type'] === 'Event') {
                        return {
                            title: (d.name || '').trim(),
                            startDate: d.startDate || '',
                            description: d.description ? String(d.description).trim() : '',
                            locationName: d.location?.name || '',
                            address: [
                                d.location?.address?.streetAddress,
                                d.location?.address?.addressLocality,
                                d.location?.address?.postalCode,
                            ].filter(Boolean).join(', '),
                            city: d.location?.address?.addressLocality || '',
                            lat: d.location?.geo?.latitude ? parseFloat(d.location.geo.latitude) : null,
                            lng: d.location?.geo?.longitude ? parseFloat(d.location.geo.longitude) : null,
                            image: typeof d.image === 'string' ? d.image : (Array.isArray(d.image) ? d.image[0] : ''),
                            organizer: d.organizer?.name || 'Meetup',
                        };
                    }
                } catch (_) {}
            }

            // Fallback: grab title + og:image at minimum
            const title = (document.querySelector('h1')?.textContent || '').trim();
            const image = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || '';
            return { title, startDate: '', description: '', locationName: '', address: '', city: '', lat: null, lng: null, image, organizer: 'Meetup' };
        });
    } catch {
        return null;
    }
}

export async function scrapeMeetup() {
    console.log('Starting Meetup scraper (Puppeteer, Sverige-bred)...');

    const { now, end, todayEnd } = getDateRange();
    let browser: Browser | null = null;
    let totalSaved = 0;

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

        // Block images/fonts for speed (keep CSS for rendering)
        await page.setRequestInterception(true);
        page.on('request', req => {
            if (['image', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Phase 1: Discover all event links
        const seenUrls = new Set<string>();
        const allLinks: string[] = [];

        for (const searchUrl of MEETUP_SEARCH_URLS) {
            console.log(`  Soker: ${searchUrl}`);
            const links = await discoverMeetupLinks(page, searchUrl);
            let newCount = 0;
            for (const link of links) {
                if (!seenUrls.has(link)) {
                    seenUrls.add(link);
                    allLinks.push(link);
                    newCount++;
                }
            }
            console.log(`     -> ${newCount} nya event-URLs (totalt: ${allLinks.length})`);
        }

        console.log(`\nTotalt ${allLinks.length} Meetup-events att processa.`);

        // Phase 2: Scrape each event page
        for (const url of allLinks) {
            try {
                if (await eventExistsInDb(url)) continue;

                console.log(`  Scraping: ${url}`);
                const details = await extractMeetupEvent(page, url);

                if (!details || !details.title) {
                    console.log(`     Ingen titel, hoppar.`);
                    continue;
                }

                if (!details.startDate) {
                    console.log(`     Inget datum, hoppar: ${details.title}`);
                    continue;
                }

                const startDate = new Date(details.startDate);
                if (!isWithinRange(startDate, now, end)) {
                    console.log(`     Utanfor veckan: ${details.title} @ ${startDate.toLocaleDateString('sv-SE')}`);
                    continue;
                }

                let lat = details.lat || 0;
                let lng = details.lng || 0;

                if (!lat || !lng) {
                    const query = details.address || details.city || details.locationName;
                    if (query) {
                        const coords = await geocodeVenueSweden(query);
                        if (coords) { lat = coords[0]; lng = coords[1]; }
                    }
                }

                await addEventToDb({
                    title: details.title,
                    url,
                    time: startDate,
                    hasSpecificTime: details.startDate.includes('T'),
                    locationName: details.locationName || details.city || 'Sverige',
                    lat,
                    lng,
                    hostName: details.organizer || 'Meetup',
                    category: guessCategoryFromTitle(details.title),
                    description: details.description || '',
                    coverImage: details.image || '',
                    createdAt: new Date(),
                    isLocationVerified: lat !== 0,
                });

                totalSaved++;
                console.log(`  ${isToday(startDate, now, todayEnd) ? '[IDAG] ' : ''}Sparat: ${details.title} @ ${details.city || details.locationName}`);

                await new Promise(r => setTimeout(r, 400));

            } catch (err) {
                console.error(`  Fel for ${url}:`, err);
            }
        }

        console.log(`\nMeetup klart! Sparade ${totalSaved} nya event.`);

    } finally {
        if (browser) await browser.close();
    }
}
