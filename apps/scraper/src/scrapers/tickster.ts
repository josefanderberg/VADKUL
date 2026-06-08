import puppeteer, { Browser, Page } from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import { geocodeVenueSweden } from '../utils/venueCoordinates';
import { searchGoogleImage } from '../utils/imageSearch';

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
    // Comedy first (before culture, to avoid standup → culture)
    if (/standup|stand.?up|komedi|humor|comedy/.test(t)) return 'comedy';
    // Performing arts (teater, musikal, balett, opera, cirkus)
    if (/teater|musikal|musical|balett|opera|cirkus|föreställning|kabaret|revy|dansshow|danskonsert/.test(t)) return 'performing-arts';
    // Music (word-boundary safe)
    if (/konsert|festival|sinfoni|kör\b|orkester|symfoni|musik(?!al)|\btour\b|\bband\b|gitarr|jazz\b|blues|tribute/.test(t)) return 'music';
    // Sport (avoid matching 'sport' in 'transport' etc)
    if (/\b(sm i|cup|lopp|match|tävling|hockey|fotboll|handboll|basket|tennis|golf|löp|cykel|simning|friidrott|sport)\b/.test(t)) return 'sport';
    // Game
    if (/quiz|spel(?!a)|boardgame|bingo|escape/.test(t)) return 'game';
    // Food (word boundaries to avoid 'musical' matching 'mat')
    // OBS: \b funkar inte runt å/ä/ö — använder negativa lookarounds istället
    if (/(?<![A-ZÅÄÖa-zåäö])(mat|öl|vin|beer|dinner|tasting|provning|middag|måltid|krog)(?![A-ZÅÄÖa-zåäö])/i.test(t)) return 'food-drink';
    // Market
    if (/marknad|loppis|mässa|expo/.test(t)) return 'market';
    // Outdoor
    if (/utomhus|natur|vandring|friluft/.test(t)) return 'outdoor';
    // Family / kids
    if (/\b(barn|familj|junior)\b|sagotr|saga(?=träff|stund|kväll)|\bsago\b/.test(t)) return 'family';
    // Training / wellness
    if (/träning|yoga|gym|fitness|breathwork|mindfulness/.test(t)) return 'training';
    // Social / party
    if (/\b(fest|aw|party|gala|bal)\b|after.?work/.test(t)) return 'social';
    // Art
    if (/konst|utställning|vernissage|galleri/.test(t)) return 'art';
    // Education
    if (/föreläsning|kurs|workshop|seminarium|utbildning/.test(t)) return 'education';
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

        // Bild — försök i tur och ordning
        const ogImg = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || '';
        // Bredare fallback: ta den första meningsfulla img på sidan (>400px bredd eller känd CDN)
        const firstCdnImg = (document.querySelector('img[src*="cdn"], img[src*="cloudfront"], img[src*="tickster"]') as HTMLImageElement)?.src || '';
        const firstLargeImg = (() => {
            const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
            for (const img of imgs) {
                const src = img.src || img.getAttribute('data-src') || '';
                if (!src || src.startsWith('data:')) continue;
                if (img.naturalWidth >= 400 || img.width >= 400) return src;
                if (src.includes('event') || src.includes('poster') || src.includes('banner')) return src;
            }
            return '';
        })();
        const coverImage = ogImg || firstCdnImg || firstLargeImg || '';

        // JSON-LD
        let jsonTime = '';
        let jsonVenue = '';
        let jsonStreet = '';
        let jsonCity = '';
        let jsonPostal = '';
        let jsonLat: number | null = null;
        let jsonLng: number | null = null;
        let jsonPrice: string | number = '';
        let jsonDescription = '';

        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const s of scripts) {
            try {
                const d = JSON.parse(s.textContent || '');
                const type = d['@type'];
                if (type === 'Event' || (Array.isArray(type) && type.includes('Event'))) {
                    jsonTime = d.startDate || '';
                    if (d.description) jsonDescription = String(d.description);
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

        // Description från sidans body — om JSON-LD saknar den.
        // Tickster renderar beskrivningen som vanliga <p> utan klass vars parent också saknar klass.
        // Datum-stycket (u-font--mono) och footer-adresser (o-grid-parent) filtreras bort.
        if (!jsonDescription) {
            const descParas = Array.from(document.querySelectorAll('p'))
                .filter(p => {
                    if (p.className) return false;                // skip classed paras (date, etc)
                    if (p.parentElement?.className) return false; // skip grid/layout parents
                    const txt = p.textContent?.trim() || '';
                    if (txt.length < 30) return false;
                    // Skip date lines ("Måndag den 1 juni …")
                    if (/^(Måndag|Tisdag|Onsdag|Torsdag|Fredag|Lördag|Söndag)\s+den\s+\d/i.test(txt)) return false;
                    // Skip ticket/door info lines
                    if (/Entrén öppnar|Biljett|köpa biljett|Startar:|Dörröppning|Insläpp:/i.test(txt)) return false;
                    return true;
                })
                .map(p => p.textContent?.trim() || '');
            if (descParas.length > 0) jsonDescription = descParas.join('\n\n');
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
        // Alla större svenska kommuner — inkluderar små städer som Ljungby
        // för att undvika att arrangörens stad blir fallback.
        // Alla större svenska kommuner. OBS: JS `\b` fungerar inte runt å/ä/ö
        // ("Växjö", "Lund" som hela strängar matchar inte med \b). Använder
        // lookbehind/lookahead för icke-bokstavsgränser istället.
        const cityList = 'Stockholm|Göteborg|Malmö|Uppsala|Västerås|Örebro|Linköping|Helsingborg|Jönköping|Norrköping|Lund|Umeå|Gävle|Borås|Eskilstuna|Södertälje|Karlstad|Täby|Sundsvall|Luleå|Östersund|Växjö|Kalmar|Halmstad|Falun|Skellefteå|Kristianstad|Trollhättan|Botkyrka|Solna|Lidingö|Sundbyberg|Sigtuna|Nynäshamn|Värmdö|Nacka|Huddinge|Sollentuna|Mölndal|Kungsbacka|Varberg|Falkenberg|Ängelholm|Trelleborg|Ystad|Landskrona|Hässleholm|Eslöv|Höör|Hörby|Klippan|Båstad|Simrishamn|Sjöbo|Skurup|Staffanstorp|Svalöv|Svedala|Tomelilla|Vellinge|Åstorp|Burlöv|Lomma|Höganäs|Bjuv|Perstorp|Osby|Bromölla|Ljungby|Alvesta|Lessebo|Markaryd|Tingsryd|Uppvidinge|Älmhult|Vetlanda|Värnamo|Nässjö|Tranås|Eksjö|Sävsjö|Vimmerby|Västervik|Nybro|Oskarshamn|Mönsterås|Borgholm|Mörbylånga|Hultsfred|Karlshamn|Karlskrona|Ronneby|Olofström|Sölvesborg|Visby|Mariestad|Skövde|Lidköping|Vänersborg|Uddevalla|Strömstad|Tanum|Munkedal|Lysekil|Sotenäs|Orust|Tjörn|Stenungsund|Kungälv|Öckerö|Ale|Lerum|Härryda|Partille|Alingsås|Vårgårda|Herrljunga|Bollebygd|Mark|Svenljunga|Tranemo|Ulricehamn|Falköping|Tidaholm|Hjo|Tibro|Karlsborg|Töreboda|Götene|Bengtsfors|Dals-Ed|Färgelanda|Mellerud|Åmål|Vara|Grästorp|Essunga|Skara|Gullspång|Hallsberg|Hallstahammar|Heby|Härnösand|Hudiksvall|Sandviken|Söderhamn|Bollnäs|Ljusdal|Mora|Leksand|Rättvik|Orsa|Vansbro|Malung-Sälen|Älvdalen|Borlänge|Ludvika|Smedjebacken|Avesta|Hedemora|Säter|Gagnef|Köping|Arboga|Surahammar|Sala|Kungsör|Norberg|Fagersta|Skinnskatteberg|Karlskoga|Degerfors|Kumla|Askersund|Laxå|Nora|Lindesberg|Hällefors|Ljusnarsberg|Lekeberg|Arvika|Eda|Filipstad|Forshaga|Grums|Hagfors|Hammarö|Kil|Kristinehamn|Munkfors|Storfors|Sunne|Säffle|Torsby|Årjäng|Timrå|Sollefteå|Ånge|Kramfors|Örnsköldsvik|Berg|Bräcke|Härjedalen|Krokom|Ragunda|Strömsund|Åre|Bjurholm|Dorotea|Lycksele|Malå|Nordmaling|Norsjö|Robertsfors|Sorsele|Storuman|Vilhelmina|Vindeln|Vännäs|Åsele|Arjeplog|Arvidsjaur|Boden|Gällivare|Haparanda|Jokkmokk|Kalix|Kiruna|Pajala|Piteå|Älvsbyn|Överkalix|Övertorneå|Upplands Väsby|Upplands-Bro|Vaxholm|Österåker|Vallentuna|Salem|Ekerö|Haninge|Tyresö|Nykvarn|Norrtälje|Knivsta|Tierp|Östhammar|Älvkarleby|Enköping|Håbo|Flen|Gnesta|Katrineholm|Nyköping|Oxelösund|Strängnäs|Trosa|Vingåker|Boxholm|Finspång|Kinda|Mjölby|Motala|Söderköping|Vadstena|Valdemarsvik|Ydre|Åtvidaberg|Ödeshög|Aneby|Gislaved|Gnosjö|Habo|Mullsjö|Vaggeryd|Hylte|Laholm|Gotland|Östra Göinge';
        const cityPattern = new RegExp(`(?<![A-ZÅÄÖa-zåäö-])(${cityList})(?![A-ZÅÄÖa-zåäö-])`, 'i');

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
        let city = jsonCity || microdataCity || textCity || '';
        const postal = jsonPostal || microdataPostal || '';

        // Stad i venue-namnet OVERRIDAR JSON-LD-stad om de skiljer
        // (typ: JSON-LD säger "Växjö" men venue säger "Bio i Ljungby" → Ljungby vinner)
        if (venue) {
            const venueCityMatch = venue.match(cityPattern);
            if (venueCityMatch && venueCityMatch[1].toLowerCase() !== city.toLowerCase()) {
                console.log(`  ℹ️  Venue-stad overridar JSON-LD: "${venueCityMatch[1]}" (var "${city}")`);
                city = venueCityMatch[1];
            }
        }

        // Sök även i body-text efter "Bio i X", "Konsert i X", "i X" där X är kommun
        if (!city || (venue && !venue.match(cityPattern))) {
            for (const t of allText) {
                // OBS: \b funkar inte runt å/ä/ö (Föreställning, samt ord som slutar på å/ä/ö)
                const m = t.match(/(?<![A-ZÅÄÖa-zåäö-])(?:Bio|Konsert|Föreställning|Show|i)\s+i?\s*(?:i\s+)?([A-ZÅÄÖ][a-zåäöA-ZÅÄÖ-]+)(?![A-ZÅÄÖa-zåäö-])/);
                if (m && cityPattern.test(m[1])) {
                    city = m[1];
                    break;
                }
            }
        }

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
            jsonDescription,
        };
    }, dateFromUrl);
}

export interface TicksterOptions {
    /** Bara dagens URLs (date_from=date_to=idag). Default false = idag + veckan.
     *  today-scrapern kör med todayOnly=true för snabb dagsleverans. */
    todayOnly?: boolean;
}

export async function scrapeTickster(opts: TicksterOptions = {}) {
    console.log(`🎟️  Starting Tickster scraper (Puppeteer, Sverige-bred${opts.todayOnly ? ', todayOnly' : ''})...`);

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
        // Förhandsacceptera cookie-väggen så att sidan renderar fullt
        await page.setCookie({
            name: 'CookieConsent',
            value: '{stamp:%27-1%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cver:1}',
            domain: '.tickster.com',
            path: '/',
        });

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

        const urls = opts.todayOnly
            ? SEARCH_URLS.filter(u => u.includes(`date_from=${todayStr}&date_to=${todayStr}`))
            : SEARCH_URLS;
        console.log(`  ${urls.length} URLs att söka igenom.`);

        for (const searchUrl of urls) {
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

                // Hoppa bort generiska placeholder-titlar
                if (details.title === 'Tickster Event' || details.title.toLowerCase() === 'event') {
                    console.log(`     🗑️  Placeholder-titel "${details.title}", hoppar.`);
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

                const extractedAddress = [details.street, details.postal, details.city]
                    .filter(Boolean)
                    .join(', ');

                const linkEvent = {
                    title: details.title,
                    url: evt.href,
                    time: new Date(details.parsedTime),
                    hasSpecificTime: details.hasSpecificTime,
                    locationName,
                    extractedAddress,
                    geocodedQuery: details.geocodeQuery,
                    lat,
                    lng,
                    hostName: 'Tickster',
                    category: guessCategoryFromTitle(details.title),
                    createdAt: new Date(),
                    coverImage: details.coverImage || await searchGoogleImage(page, details.title) || '',
                    description: details.jsonDescription || '',
                    isLocationVerified: !!(details.jsonLat && details.jsonLng),
                    isHostVerified: false,
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
