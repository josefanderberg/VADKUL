import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { addEventToDb, eventExistsInDb, getEventFromDb } from '../../utils/dbHelper';
import { uploadEventImage, isOurStorageUrl } from '../../utils/storageHelper';
import { geocodeVenueSweden, cleanVenueName, SWEDISH_GEO_CITIES, isForeignAddress, isInNordic } from '../../utils/venueCoordinates';
import { classifyEvent } from '../../utils/classify';
import { searchGoogleImage } from '../../utils/imageSearch';
import { applyDateFilters, discoverEventUrls } from './discovery';
import { extractEventDetails } from './extractor';
import { HostInstrument } from './host';
import { LocationInstrument } from './location';
import { FacebookSource } from './types';
import { FACEBOOK_PAGE_WATCHLIST } from './watchlist';

/**
 * Automatically dismisses cookie banners and overlay login walls if they appear.
 */
async function handleBannersAndModals(page: any) {
    try {
        await page.evaluate(() => {
            // 1. Dismiss cookie banners (clicking Decline Optional or Allow All depending on what is available)
            const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
            for (const btn of buttons) {
                const txt = btn.textContent?.trim().toLowerCase() || '';
                if (txt === 'neka valfria cookies' || txt === 'decline optional cookies' || txt.includes('tillåt') || txt.includes('allow') || txt.includes('neka') || txt.includes('decline')) {
                    (btn as HTMLElement).click();
                    break;
                }
            }

            // 2. Dismiss login popups/modals (by clicking close icons/buttons)
            const closeButtons = Array.from(document.querySelectorAll('div[role="button"], button, i'));
            for (const btn of closeButtons) {
                const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
                const txt = btn.textContent?.trim().toLowerCase() || '';
                if (label.includes('stäng') || label.includes('close') || txt === '✕' || txt === 'x') {
                    (btn as HTMLElement).click();
                }
            }
        });
    } catch (e) {
        // Ignore evaluation errors
    }
}

function parseDateFromText(text: string): Date | null {
    const lower = text.toLowerCase();
    const months = [
        'januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december',
        'january', 'february', 'march', 'may', 'june', 'july', 'august', 'october'
    ];
    
    // Pattern 1: month day year (e.g. december 12 2026)
    const pattern1 = new RegExp(`\\b(${months.join('|')})\\s+(\\d{1,2})\\s+(\\d{4})\\b`, 'i');
    let match = lower.match(pattern1);
    if (match) {
        const monthName = match[1];
        const day = parseInt(match[2]);
        const year = parseInt(match[3]);
        const monthIndex = months.indexOf(monthName) % 12;
        return new Date(year, monthIndex, day);
    }

    // Pattern 2: day month year (e.g. 12 december 2026)
    const pattern2 = new RegExp(`\\b(\\d{1,2})\\s+(${months.join('|')})\\s+(\\d{4})\\b`, 'i');
    match = lower.match(pattern2);
    if (match) {
        const day = parseInt(match[1]);
        const monthName = match[2];
        const year = parseInt(match[3]);
        const monthIndex = months.indexOf(monthName) % 12;
        return new Date(year, monthIndex, day);
    }

    return null;
}

export interface FacebookScraperOptions {
    /** Datumfilter att applicera per sökord/stad. Default: ['idag', 'den här veckan'].
     *  today-scrapern kör med ['idag'] för snabb dagsleverans utan att vänta på
     *  vecko-svepet (halverar antalet queries och ger event till audit långt
     *  innan det stora full-jobbet är klart). */
    filters?: string[];
}

export async function scrapeFacebookEvents(opts: FacebookScraperOptions = {}) {
    const fbStart = Date.now();
    const DATE_FILTERS_INPUT = opts.filters && opts.filters.length > 0
        ? opts.filters
        : ['idag', 'den här veckan'];
    console.log(`🚀 Startar Facebook-skrapan (Refactored) — filter: [${DATE_FILTERS_INPUT.join(', ')}]`);
    const scrapedEventsLog: any[] = [];
    const logPath = path.resolve(__dirname, '../../../../scraped_events.json');
    const keywordStatsPath = path.resolve(__dirname, '../../../keyword_stats.json');
    const runStartedAt = new Date().toISOString();

    const writeLogFile = () => {
        try {
            fs.writeFileSync(logPath, JSON.stringify(scrapedEventsLog, null, 2), 'utf-8');
        } catch (writeErr) {
            console.error('⚠️ Kunde inte skriva scraped_events.json:', writeErr);
        }
    };

    const writeKeywordStats = (
        sourceStats: { keyword: string; filter: string; found: number; unique: number; duplicates: number }[],
        perKeywordTotals: { [keyword: string]: { found: number; unique: number; duplicates: number } },
        totalUniqueUrls: number,
        totalDuplicateHits: number,
    ) => {
        try {
            // Sortera per stoppord efter "unique" (mest givande sökord överst)
            const rankedKeywords = Object.entries(perKeywordTotals)
                .map(([keyword, totals]) => ({ keyword, ...totals }))
                .sort((a, b) => b.unique - a.unique);

            const payload = {
                runStartedAt,
                lastUpdatedAt: new Date().toISOString(),
                totalUniqueUrls,
                totalDuplicateHits,
                perKeywordTotals: rankedKeywords,
                perQuery: sourceStats,
            };
            fs.writeFileSync(keywordStatsPath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (writeErr) {
            console.error('⚠️ Kunde inte skriva keyword_stats.json:', writeErr);
        }
    };

    const browser = await puppeteer.launch({
        headless: true, // Run headless to avoid popping up windows in background execution
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
        // === SÖKKONFIGURATION ===
        // Svenska städer — täcker 260+ orter för bred lokal spridning
        const SWEDISH_CITIES = [
            // Topp 30 städer
            'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping',
            'Örebro', 'Helsingborg', 'Norrköping', 'Jönköping', 'Umeå',
            'Lund', 'Västerås', 'Sundsvall', 'Karlstad', 'Växjö', 'Gävle',
            'Borås', 'Eskilstuna', 'Halmstad', 'Östersund', 'Kalmar',
            'Trollhättan', 'Luleå', 'Skellefteå', 'Kristianstad', 'Falun',
            'Karlskrona', 'Skövde', 'Motala', 'Nyköping',
            // Nästa våg av städer
            'Örnsköldsvik', 'Varberg', 'Visby', 'Lidköping', 'Alingsås',
            'Borlänge', 'Trelleborg', 'Ystad', 'Västervik', 'Katrineholm',
            'Norrtälje', 'Enköping', 'Hässleholm', 'Piteå', 'Karlskoga',
            'Värnamo', 'Uddevalla', 'Kungsbacka', 'Falkenberg', 'Ängelholm',
            'Landskrona', 'Karlshamn', 'Ronneby', 'Oskarshamn', 'Vetlanda',
            'Nässjö', 'Tranås', 'Ljungby', 'Arvika', 'Kristinehamn',
            // Fler expansiva orter
            'Mariestad', 'Kumla', 'Hallsberg', 'Köping', 'Sala',
            'Fagersta', 'Ludvika', 'Mora', 'Sandviken', 'Bollnäs',
            'Söderhamn', 'Hudiksvall', 'Härnösand', 'Sollefteå', 'Kramfors',
            'Boden', 'Kiruna', 'Gällivare', 'Lycksele', 'Åre',
            // Skåne & Halland orter
            'Eslöv', 'Staffanstorp', 'Kävlinge', 'Vellinge', 'Höganäs',
            'Bromölla', 'Skanör', 'Falsterbo', 'Sjöbo', 'Simrishamn',
            'Laholm', 'Onsala', 'Åsa', 'Båstad',
            // Småland & Blekinge orter
            'Eksjö', 'Vimmerby', 'Hultsfred', 'Nybro', 'Sölvesborg',
            'Olofström', 'Lessebo', 'Alvesta', 'Tingsryd', 'Älmhult',
            // Mellansverige orter
            'Finspång', 'Mjölby', 'Söderköping', 'Åtvidaberg', 'Trosa',
            'Strängnäs', 'Flen', 'Nora', 'Lindesberg',

            // === UTÖKNING: ~150 nya orter för lokal täckning ===

            // Stockholmsregionen (förorter med stor befolkning)
            'Södertälje', 'Nacka', 'Huddinge', 'Järfälla', 'Botkyrka',
            'Haninge', 'Tyresö', 'Täby', 'Solna', 'Sundbyberg',
            'Upplands-Väsby', 'Lidingö', 'Sollentuna', 'Vallentuna',
            'Ekerö', 'Österåker', 'Salem', 'Sigtuna', 'Vaxholm', 'Nynäshamn',
            'Knivsta', 'Håbo', 'Upplands-Bro', 'Nykvarn',

            // Västra Götaland (kompletterande orter)
            'Mölndal', 'Lerum', 'Kungälv', 'Stenungsund', 'Vänersborg',
            'Ulricehamn', 'Falköping', 'Tidaholm', 'Kinna', 'Åmål',
            'Lysekil', 'Kungshamn', 'Munkedal', 'Skara', 'Tibro',
            'Hjo', 'Töreboda', 'Karlsborg', 'Tranemo', 'Bollebygd',
            'Nödinge', 'Herrljunga', 'Svenljunga', 'Vara', 'Grästorp',

            // Skåne (kompletterande orter)
            'Tomelilla', 'Skurup', 'Svedala', 'Höör', 'Hörby',
            'Örkelljunga', 'Osby', 'Perstorp', 'Klippan', 'Bjuv',
            'Burlöv', 'Åstorp',

            // Dalarna
            'Avesta', 'Hedemora', 'Rättvik', 'Leksand', 'Malung',
            'Säter', 'Orsa', 'Smedjebacken', 'Vansbro', 'Älvdalen',

            // Gästrikland & Hälsingland
            'Ockelbo', 'Hofors', 'Ljusdal', 'Ovanåker',

            // Västernorrland tillägg
            'Ånge', 'Timrå',

            // Jämtland tillägg
            'Strömsund', 'Krokom', 'Bräcke',

            // Norrbotten tillägg
            'Haparanda', 'Kalix', 'Arvidsjaur', 'Arjeplog', 'Jokkmokk',
            'Pajala', 'Överkalix', 'Övertorneå',

            // Västerbotten tillägg
            'Vilhelmina', 'Storuman', 'Vindeln', 'Robertsfors', 'Nordmaling',

            // Värmland tillägg
            'Sunne', 'Torsby', 'Säffle', 'Hagfors', 'Filipstad',
            'Hammarö', 'Kil', 'Munkfors',

            // Örebro tillägg
            'Askersund', 'Laxå', 'Degerfors',

            // Halland tillägg
            'Hyltebruk',

            // Småland tillägg
            'Vaggeryd', 'Gislaved', 'Gnosjö', 'Mullsjö', 'Aneby',
            'Markaryd', 'Emmaboda', 'Borgholm', 'Mönsterås', 'Torsås',

            // Östergötland tillägg
            'Vadstena', 'Valdemarsvik', 'Boxholm',

            // Södermanland tillägg
            'Gnesta', 'Oxelösund', 'Vingåker',

            // Uppland tillägg
            'Tierp', 'Rimbo',

            // Västra Götaland (kustorter & inland)
            'Strömstad', 'Tanum', 'Bengtsfors', 'Färgelanda', 'Dals-Ed',
            'Essunga', 'Götene', 'Mellerud',

            // Skåne (kranskommun Malmö)
            'Lomma',

            // Östergötland
            'Kinda', 'Ydre',

            // Västmanland tillägg
            'Norberg', 'Surahammar', 'Arboga',

            // Värmland tillägg
            'Storfors', 'Grums',

            // Jämtland / Västernorrland tillägg
            'Berg', 'Dorotea',

            // Västerbotten tillägg
            'Bjurholm', 'Malå',

            // Norrbotten: ytterligare orter
            'Älvsbyn',

            // Gotland-maxning 2026-07-27: hela ön, inte bara Visby.
            // 'Gotland' fångar öbrett taggade event; orterna fångar landsbygden.
            // OBS: Roma medvetet utelämnad som sökord (FB-brus från Rom/AS Roma) —
            // Romakloster täcker samma geografi.
            'Gotland', 'Hemse', 'Slite', 'Klintehamn', 'Fårösund',
            'Ljugarn', 'Burgsvik', 'Katthammarsvik', 'Lärbro', 'Stånga',
            'Havdhem', 'Tingstäde', 'Romakloster', 'Fårö',
        ];

        // Breda sökord – event-typer, aktiviteter, tider
        // Uppdaterade baserat på keyword-test (2026-05-31): tog bort döda (0 träffar),
        // la till ord med bevisad räckvidd och god geografisk spridning.
        const BROAD_KEYWORDS = [
            // Musik & underhållning
            'konsert', 'klubb', 'fest', 'dj', 'quiz', 'show',
            'standup', 'festival', 'marknad', 'loppis', 'bakluckeloppis', 'afterwork',
            'vernissage', 'teater', 'föreställning', 'musikal', 'opera',
            'allsång', 'karaoke', 'disco', 'cirkus',
            // Sport & friluftsliv
            'musik', 'dans', 'comedy', 'sport', 'yoga', 'kurs', 'workshop',
            'föreläsning', 'utställning', 'bio', 'konst',
            'fotboll', 'hockey', 'orientering', 'vandring',
            // Mat & socialt
            'brunch', 'middag', 'vinprovning', 'mingel',
            // Bred geografisk spridning
            'gudstjänst', 'kyrka', 'gratis', 'midsommar',
            'second hand', 'antik', 'fika', 'träff',
            // Tider / vardagsord
            'kväll', 'helg', 'lördag', 'fredag', 'torsdag', 'söndag'
        ];

        // Datumfilter — tas från opts.filters (default: idag + denna vecka).
        // today-scrapern skickar ['idag'] för att halvera query-volymen.
        const DATE_FILTERS = DATE_FILTERS_INPUT;

        const SOURCES: FacebookSource[] = [];

        // 1. Städer × datumfilter
        for (const city of SWEDISH_CITIES) {
            for (const filter of DATE_FILTERS) {
                SOURCES.push({
                    url: `https://www.facebook.com/events/search/?q=${encodeURIComponent(city)}`,
                    filters: [filter],
                    city: city
                });
            }
        }

        // 2. Breda sökord × datumfilter
        for (const keyword of BROAD_KEYWORDS) {
            for (const filter of DATE_FILTERS) {
                SOURCES.push({
                    url: `https://www.facebook.com/events/search/?q=${encodeURIComponent(keyword)}`,
                    filters: [filter]
                });
            }
        }

        // 3. Sidbevakningar — bevakade sidors /events-flikar (fungerar utloggat
        //    även sedan FB stängde den anonyma eventsöken 2026-07-2x).
        //    Inga datumfilter: fliken listar bara kommande, och sid-event får
        //    sitt datum från detaljsidan (trusted → 30d-horisont nedan).
        for (const pageWatch of FACEBOOK_PAGE_WATCHLIST) {
            SOURCES.push({
                url: `https://www.facebook.com/${pageWatch.slug}/events`,
                filters: [],
                city: pageWatch.city,
                label: `page:${pageWatch.slug}`,
            });
        }

        console.log(`🔧 Konfiguration: ${SWEDISH_CITIES.length} städer + ${BROAD_KEYWORDS.length} sökord × ${DATE_FILTERS.length} datumfilter + ${FACEBOOK_PAGE_WATCHLIST.length} sidbevakningar = ${SOURCES.length} queries totalt.`);

        const allEventUrls = new Map<string, { expectedDay: string; city?: string }>();

        // Statistik per (keyword, filter)-kombination
        type SourceStat = { keyword: string; filter: string; found: number; unique: number; duplicates: number };
        const sourceStats: SourceStat[] = [];
        // Aggregerad statistik per stoppord
        const perKeywordTotals: { [keyword: string]: { found: number; unique: number; duplicates: number } } = {};
        let totalDuplicateHits = 0;

        // Sökvakt (2026-07-27): FB stängde utloggad eventsök 23–26 juli — alla
        // queries ger "Vi hittade inte några resultat". 15 tomma sök-queries i
        // RAD (Stockholm/Göteborg/Malmö ger aldrig legitimt 0) ⇒ söket är
        // nere; hoppa över resterande sök så natten inte bränner timmar på
        // ingenting. Sidbevakningar (page:...) berörs inte av vakten.
        const SEARCH_DEAD_THRESHOLD = 15;
        let consecutiveEmptySearches = 0;
        let searchAbandoned = false;

        for (const source of SOURCES) {
            const keyword = source.label || decodeURIComponent(source.url.split('q=')[1] || '');
            const filterLabel = source.filters.join(', ') || '(inget)';
            const isSearchSource = source.url.includes('/events/search/');

            if (searchAbandoned && isSearchSource) {
                sourceStats.push({ keyword, filter: filterLabel, found: 0, unique: 0, duplicates: 0 });
                if (!perKeywordTotals[keyword]) perKeywordTotals[keyword] = { found: 0, unique: 0, duplicates: 0 };
                continue;
            }
            console.log(`\n🔍 Letar event på: ${source.url} med filter: [${filterLabel}]`);

            try {
                await page.goto(source.url, { waitUntil: 'networkidle2' });
                await handleBannersAndModals(page);
                await new Promise(r => setTimeout(r, 3000));

                await applyDateFilters(page, source.filters);
                const discovered = await discoverEventUrls(page);

                let uniqueThisSource = 0;
                let duplicatesThisSource = 0;
                discovered.forEach(item => {
                    if (!allEventUrls.has(item.url)) {
                        allEventUrls.set(item.url, { expectedDay: item.day, city: source.city });
                        uniqueThisSource++;
                    } else {
                        duplicatesThisSource++;
                        totalDuplicateHits++;
                    }
                });

                sourceStats.push({
                    keyword,
                    filter: filterLabel,
                    found: discovered.length,
                    unique: uniqueThisSource,
                    duplicates: duplicatesThisSource,
                });

                if (!perKeywordTotals[keyword]) {
                    perKeywordTotals[keyword] = { found: 0, unique: 0, duplicates: 0 };
                }
                perKeywordTotals[keyword].found += discovered.length;
                perKeywordTotals[keyword].unique += uniqueThisSource;
                perKeywordTotals[keyword].duplicates += duplicatesThisSource;

                console.log(`    📌 Hittade ${discovered.length} länkar — ${uniqueThisSource} nya, ${duplicatesThisSource} dubbletter.`);

                if (isSearchSource) {
                    consecutiveEmptySearches = discovered.length === 0 ? consecutiveEmptySearches + 1 : 0;
                    if (consecutiveEmptySearches >= SEARCH_DEAD_THRESHOLD && !searchAbandoned) {
                        searchAbandoned = true;
                        console.log(`\n🛑 Sökvakt: ${SEARCH_DEAD_THRESHOLD} tomma sök-queries i rad — FB-söket bedöms nere (login-vägg). Hoppar över resterande sök-källor; sidbevakningar körs som vanligt.`);
                    }
                }
            } catch (e: any) {
                console.log(`    ⚠️ Hoppar över "${keyword}" [${filterLabel}] pga fel: ${e?.message || e}`);
                sourceStats.push({
                    keyword,
                    filter: filterLabel,
                    found: 0,
                    unique: 0,
                    duplicates: 0,
                });
                if (!perKeywordTotals[keyword]) {
                    perKeywordTotals[keyword] = { found: 0, unique: 0, duplicates: 0 };
                }
                // Försök att återställa sidan så nästa query har en fungerande context
                try {
                    await page.goto('about:blank');
                } catch { /* page kan vara helt död, ignorera */ }
            }

            // Spara stoppords-statistik inkrementellt så vi har datan kvar även om körningen avbryts
            writeKeywordStats(sourceStats, perKeywordTotals, allEventUrls.size, totalDuplicateHits);
        }

        // === STATISTIK-SAMMANSTÄLLNING ===
        console.log('\n==========================================');
        console.log('📊 DISCOVERY-STATISTIK PER QUERY:');
        console.log('==========================================');
        sourceStats.forEach(s => {
            console.log(`  "${s.keyword}" [${s.filter}] → ${s.found} hittade, ${s.unique} nya, ${s.duplicates} dubbletter`);
        });

        console.log('\n📊 SUMMA PER STOPPORD:');
        Object.entries(perKeywordTotals).forEach(([keyword, totals]) => {
            console.log(`  "${keyword}" → ${totals.found} hittade, ${totals.unique} nya, ${totals.duplicates} dubbletter`);
        });

        console.log(`\n📊 TOTALT: ${allEventUrls.size} unika event efter dedup, ${totalDuplicateHits} totala dubblett-träffar över alla queries.`);
        console.log('==========================================');

        // --- HARDCODE SECURE EVENTS ---
        try {
            const goldenPath = path.resolve(__dirname, '../../../secure-events/golden_fb_events.json');
            if (fs.existsSync(goldenPath)) {
                const goldenEvents = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
                let injected = 0;
                goldenEvents.forEach((evt: any) => {
                    if (evt.url && !allEventUrls.has(evt.url)) {
                        allEventUrls.set(evt.url, { expectedDay: 'okänd', city: 'Växjö' }); // Default to Växjö for secure events
                        injected++;
                    }
                });
                console.log(`\n🛡️  INJICERADE ${injected} saknade "Secure Events" (av ${goldenEvents.length} totalt) direkt in i skrapkön!`);
            }
        } catch (e) {
            console.error('Kunde inte läsa in golden events:', e);
        }

        const totalToProcess = allEventUrls.size;
        console.log(`\n🔎 Går nu igenom ${totalToProcess} unika event...`);

        let saved = 0;
        let processed = 0;
        // Extraction-fas räknare för slutstatistik
        let extractAlreadyInDb = 0;
        let extractSkippedForeign = 0;
        let extractSkippedDate = 0;
        let extractLoginWall = 0;
        let extractFailed = 0;
        let extractNewlySaved = 0;
        for (const [url, itemData] of allEventUrls.entries()) {
            const { expectedDay, city } = itemData;
            processed++;
            console.log(`\n📊 [${processed}/${totalToProcess}] Behandlar event (sparade hittills: ${scrapedEventsLog.length})`);
            try {
                // Check if already in the database
                const existingEvent = await getEventFromDb(url);
                // FB CDN-URLs har `oe=HHHHHHHH` (hex unix-stamp) som expirar inom ~7 dagar.
                // Om URL:n redan är passerad eller löper ut inom 24h → tvinga re-scrape för
                // att hämta ny bild-URL. Annars renderas eventet med trasig bild i appen.
                const isFbImageExpired = (img: string | undefined): boolean => {
                    if (!img || !img.includes('fbcdn.net')) return false;
                    const m = img.match(/[?&]oe=([0-9a-f]+)/i);
                    if (!m) return false;
                    const exp = parseInt(m[1], 16) * 1000;
                    if (!exp) return false;
                    return exp - Date.now() < 24 * 60 * 60 * 1000; // expirar inom 24h
                };

                if (existingEvent && !isFbImageExpired(existingEvent.coverImage)) {
                    console.log(`  📄 Detaljer för: ${url}`);
                    console.log(`    👉 Redan sparad i databasen: "${existingEvent.title}"`);
                    
                    let eventTime: Date;
                    if (existingEvent.time) {
                        if (existingEvent.time.toDate) {
                            eventTime = existingEvent.time.toDate();
                        } else {
                            eventTime = new Date(existingEvent.time);
                        }
                    } else {
                        eventTime = new Date();
                    }

                    // Check if within upcoming week bounds
                    const oneWeekFromNow = new Date();
                    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
                    oneWeekFromNow.setHours(23, 59, 59, 999);

                    const todayStart = new Date();
                    todayStart.setHours(0, 0, 0, 0);

                    if (eventTime >= todayStart && eventTime <= oneWeekFromNow) {
                        const eventObj = {
                            title: existingEvent.title,
                            url: url,
                            time: eventTime.toISOString(),
                            locationName: existingEvent.locationName || 'Okänd',
                            extractedAddress: existingEvent.extractedAddress || 'Växjö',
                            geocodedQuery: existingEvent.geocodedQuery || 'Växjö',
                            lat: existingEvent.lat || 0,
                            lng: existingEvent.lng || 0,
                            hostName: existingEvent.hostName || 'Facebook',
                            category: existingEvent.category || 'other',
                            coverImage: existingEvent.coverImage || '',
                            description: existingEvent.description || '',
                            attendees: existingEvent.attendees || 0,
                            createdAt: existingEvent.createdAt ? (existingEvent.createdAt.toDate ? existingEvent.createdAt.toDate().toISOString() : new Date(existingEvent.createdAt).toISOString()) : new Date().toISOString(),
                            isLocationVerified: existingEvent.isLocationVerified || false,
                            isHostVerified: existingEvent.isHostVerified || false
                        };
                        scrapedEventsLog.push(eventObj);
                        writeLogFile();
                        console.log(`    💾 Loggade existerande event (${scrapedEventsLog.length} totalt i loggen)`);
                    } else {
                        console.log(`    ⏩ Existerande event skippat (utanför 1-veckas intervall): ${existingEvent.title} (${eventTime.toLocaleDateString()})`);
                    }
                    extractAlreadyInDb++;
                    continue;
                }

                // Antingen ny URL eller existerande med expired FB-bild → scrape detalsidan
                if (existingEvent) {
                    console.log(`  📄 Detaljer för: ${url}`);
                    console.log(`    🔄 Bild expired → tvingar re-scrape för ny URL: "${existingEvent.title}"`);
                }
                await page.goto(url, { waitUntil: 'networkidle2' });
                await handleBannersAndModals(page);
                await new Promise(r => setTimeout(r, 4000));

                // Expand description
                await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                    for (const btn of buttons) {
                        const txt = btn.textContent?.trim().toLowerCase() || '';
                        if (txt === 'visa mer' || txt === 'see more') (btn as HTMLElement).click();
                    }
                });
                await new Promise(r => setTimeout(r, 1000));

                const details = await extractEventDetails(page);
                if (details.title === 'Facebook Event' || details.title.includes('Logga in')) { extractLoginWall++; continue; }

                // --- INSTRUMENT: VÄRD (HOST) ---
                const hostInfo = await HostInstrument.extractInfo(page);
                let finalHostName = hostInfo.name;
                let finalImage = details.image;
                let isHostVerified = false;

                const isGenericImage = finalImage === finalHostName || 
                                     finalImage.includes('facebook.com/images/') || 
                                     finalImage.includes('fbcdn.net/rsrc.php') ||
                                     finalImage.includes('static.xx.fbcdn.net') ||
                                     !finalImage;

                if (hostInfo.url && isGenericImage) {
                    const verifiedPic = await HostInstrument.verifyImage(page, hostInfo.url);
                    if (verifiedPic) {
                        finalImage = verifiedPic;
                        isHostVerified = true;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                    await page.goto(url, { waitUntil: 'networkidle2' });
                }

                // --- INSTRUMENT: PLATS (LOCATION) ---
                const locInfo = await LocationInstrument.extractInfo(page, details.title);
                
                const extractedAddress = locInfo.fullAddress;
                const geocodedQuery = cleanVenueName(extractedAddress);
                
                console.log(`    Extracted Address: "${extractedAddress}"`);
                console.log(`    Geocoded Query: "${geocodedQuery}"`);

                // Hoppa över event med utländsk adress — de är inte relevanta för appen
                if (extractedAddress && isForeignAddress(extractedAddress)) {
                    console.log(`    ⏩ Skippar utländskt event (adress): "${details.title}" (addr: "${extractedAddress}")`);
                    extractSkippedForeign++;
                    continue;
                }

                // Hoppa över event med danska ord i titeln (lørdag/søndag/åbent/onsdag etc.)
                // — adressfältet kan vara tomt medan titeln avslöjar ursprunget
                const DANISH_TITLE_WORDS = /\b(lørdag|søndag|mandag|tirsdag|onsdag|torsdag|fredag|åbent|åbner|lukket|hvad\s+sker)\b/i;
                if (DANISH_TITLE_WORDS.test(details.title)) {
                    console.log(`    ⏩ Skippar danskt event (titel): "${details.title}"`);
                    continue;
                }

                let finalLat = 0, finalLng = 0;
                let isLocationVerified = false;

                if (extractedAddress) {
                    let geocodeQuery = extractedAddress;
                    // Om stadsnamn inte redan ingår i adressen, lägg till kontext-staden från sök-kön
                    if (city && !extractedAddress.toLowerCase().includes(city.toLowerCase())) {
                        geocodeQuery = `${extractedAddress}, ${city}`;
                    }
                    let coords = await geocodeVenueSweden(geocodeQuery);

                    // Retry 1: skanna extractedAddress efter inbäddad stad (t.ex. "Foajén - Örebro Konserthus")
                    if (!coords) {
                        const cityInAddr = SWEDISH_GEO_CITIES.find(c =>
                            new RegExp(`\\b${c}\\b`, 'i').test(extractedAddress)
                        );
                        if (cityInAddr && cityInAddr.toLowerCase() !== (city || '').toLowerCase()) {
                            const retryQ = `${extractedAddress}, ${cityInAddr}`;
                            if (retryQ !== geocodeQuery) {
                                coords = await geocodeVenueSweden(retryQ);
                                if (coords) console.log(`    📍 Geocoding retry (city-scan): "${cityInAddr}" → [${coords[0]}, ${coords[1]}]`);
                            }
                        }
                    }

                    // Retry 2: stad-nivå fallback — ger åtminstone ungefärlig position
                    if (!coords) {
                        const fallbackCity = city
                            || SWEDISH_GEO_CITIES.find(c => new RegExp(`\\b${c}\\b`, 'i').test(extractedAddress));
                        if (fallbackCity) {
                            coords = await geocodeVenueSweden(`${fallbackCity}, Sverige`);
                            if (coords) console.log(`    📍 Geocoding city-fallback: "${fallbackCity}" → [${coords[0]}, ${coords[1]}]`);
                        }
                    }

                    if (coords) {
                        finalLat = coords[0];
                        finalLng = coords[1];
                        isLocationVerified = true;
                    }
                }

                // Sista skyddsnät: om koordinaterna hamnar utanför Norden, hoppa över.
                // Norge och Danmark tillåts — det är Moldavien, Bangladesh, USA osv. vi vill stänga ute.
                if (finalLat !== 0 && finalLng !== 0 && !isInNordic(finalLat, finalLng)) {
                    console.log(`    ⏩ Skippar event utanför Norden (koordinater): "${details.title}" [${finalLat.toFixed(4)}, ${finalLng.toFixed(4)}] (addr: "${extractedAddress}")`);
                    extractSkippedForeign++;
                    continue;
                }

                // Date and Time parsing
                let eventTime = new Date();
                let hasValidDate = false;

                const parsedDate = parseDateFromText(details.ogDescription || details.description);
                if (parsedDate) {
                    eventTime = parsedDate;
                    hasValidDate = true;
                    
                    if (details.exactTime) {
                        const [hours, minutes] = details.exactTime.split(':').map(Number);
                        eventTime.setHours(hours, minutes, 0, 0);
                    }
                }

                if (!hasValidDate && details.isoDate) {
                    const parsedIso = new Date(details.isoDate);
                    if (!isNaN(parsedIso.getTime())) {
                        eventTime = parsedIso;
                        hasValidDate = true;
                    }
                }

                if (!hasValidDate) {
                    if (expectedDay === 'i morgon') eventTime.setDate(eventTime.getDate() + 1);
                    if (details.exactTime) {
                        const [hours, minutes] = details.exactTime.split(':').map(Number);
                        eventTime.setHours(hours, minutes, 0, 0);
                    }
                }

                // Range-validering: betrott datum (parsat från eventsidan) får
                // standard-fönstrets 30 dagar — behövs för sidbevakningar vars
                // event ofta ligger längre fram än sökets vecka. Gissade datum
                // (expectedDay-heuristiken) behåller den snäva 7-dagarsgränsen.
                const horizonDays = hasValidDate ? 30 : 7;
                const horizonEnd = new Date();
                horizonEnd.setDate(horizonEnd.getDate() + horizonDays);
                horizonEnd.setHours(23, 59, 59, 999);

                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                if (eventTime > horizonEnd || eventTime < todayStart) {
                    console.log(`    ⏩ Skippar event (utanför ${horizonDays}-dagars intervall): ${details.title} (${eventTime.toLocaleDateString()})`);
                    extractSkippedDate++;
                    continue;
                }

                // Fallback: om bilden fortfarande saknas/är generisk efter host-verifieringen,
                // sök titeln på Google Images och ta första rimliga träffen.
                const stillNeedsImage = !finalImage ||
                    finalImage.includes('facebook.com/images/') ||
                    finalImage.includes('fbcdn.net/rsrc.php') ||
                    finalImage.includes('static.xx.fbcdn.net');

                if (stillNeedsImage) {
                    console.log(`    🔍 Söker fallback-bild på Google för "${details.title}"...`);
                    const googleImg = await searchGoogleImage(page, details.title);
                    if (googleImg) {
                        finalImage = googleImg;
                        console.log(`    ✅ Hittade Google-fallback-bild.`);
                    } else {
                        console.log(`    ⚠️ Ingen Google-bild hittades.`);
                    }
                    await new Promise(r => setTimeout(r, 1000));
                }

                // Ladda upp bilden till vår Storage så vi får en permanent URL
                // (FB CDN-URLs expirar inom ~7 dagar). Detta är kritiskt — utan det
                // visas alla FB-bilder som trasiga efter en vecka.
                if (finalImage && !isOurStorageUrl(finalImage)) {
                    const hostedUrl = await uploadEventImage(finalImage, url);
                    if (hostedUrl) {
                        console.log(`    📦 Bild uppladdad till Storage`);
                        finalImage = hostedUrl;
                    } else {
                        console.log(`    ⚠️ Storage-upload misslyckades — behåller remote-URL (kommer expira)`);
                    }
                }

                const eventObj = {
                    title: details.title,
                    url: url,
                    time: eventTime.toISOString(),
                    locationName: locInfo.name,
                    extractedAddress: extractedAddress,
                    geocodedQuery: geocodedQuery,
                    lat: finalLat,
                    lng: finalLng,
                    hostName: finalHostName,
                    category: classifyEvent(details.title, details.description),
                    coverImage: finalImage,
                    description: details.description,
                    attendees: details.going,
                    createdAt: new Date().toISOString(),
                    isLocationVerified,
                    isHostVerified
                };
                scrapedEventsLog.push(eventObj);
                writeLogFile();

                await addEventToDb({
                    title: details.title,
                    url: url,
                    time: eventTime,
                    locationName: locInfo.name,
                    extractedAddress,
                    geocodedQuery,
                    lat: finalLat, lng: finalLng,
                    hostName: finalHostName,
                    category: classifyEvent(details.title, details.description),
                    coverImage: finalImage,
                    description: details.description,
                    attendees: details.going,
                    createdAt: new Date(),
                    isLocationVerified,
                    isHostVerified
                });
                saved++;
                extractNewlySaved++;
                console.log(`  ✅ Sparade: ${details.title} (${details.going} deltagare) — totalt sparade nya: ${saved}, totalt i loggen: ${scrapedEventsLog.length}`);
            } catch (e) {
                console.log(`    ❌ Fel vid ${url}`, e);
                extractFailed++;
            }
        }
        console.log(`🎉 Klar! Sparade ${saved} nya.`);

        // Group scraped events by date (formatted as YYYY-MM-DD in local time)
        const dailyBreakdown: { [dateStr: string]: number } = {};
        
        // Initialize all 8 days (today + next 7 days) of the upcoming week to 0
        for (let i = 0; i < 8; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            dailyBreakdown[dateStr] = 0;
        }

        // Count all matching events in our scrapedEventsLog
        scrapedEventsLog.forEach(evt => {
            const evtDate = new Date(evt.time);
            const year = evtDate.getFullYear();
            const month = String(evtDate.getMonth() + 1).padStart(2, '0');
            const day = String(evtDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            if (dateStr in dailyBreakdown) {
                dailyBreakdown[dateStr]++;
            }
        });

        console.log('\n==========================================');
        console.log('📅 SAMMANSTÄLLNING FÖR DEN KOMMANDE VECKAN:');
        console.log('==========================================');
        
        Object.entries(dailyBreakdown).forEach(([dateStr, count]) => {
            const parts = dateStr.split('-');
            const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const swedishDay = dateObj.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
            console.log(`  📅 ${swedishDay.padEnd(25)}: ${count} event`);
        });
        console.log('==========================================\n');

        // ── Skriv slutlig statistik + körningshistorik ───────────────────────
        writeFinalScraperStats({
            runStartedAt,
            sourceStats,
            perKeywordTotals,
            totalUniqueUrls: allEventUrls.size,
            totalDuplicateHits,
            extraction: {
                totalToProcess,
                alreadyInDb:   extractAlreadyInDb,
                newlySaved:    extractNewlySaved,
                skippedForeign: extractSkippedForeign,
                skippedDate:   extractSkippedDate,
                loginWall:     extractLoginWall,
                failed:        extractFailed,
            },
            eventsInLog:     scrapedEventsLog.length,
            keywordStatsPath,
        });

    } catch (err) {
        console.error('❌ Fel i skrapan:', err);
    } finally {
        const fbElapsed = Math.round((Date.now() - fbStart) / 1000);
        const fbMins = Math.floor(fbElapsed / 60);
        const fbSecs = fbElapsed % 60;
        const fbDuration = fbMins > 0 ? `${fbMins} min ${fbSecs} sek` : `${fbSecs} sek`;
        console.log(`⏱️ Facebook-skrapan tog: ${fbDuration}`);
        writeLogFile();
        console.log(`💾 Slutligen sparade ${scrapedEventsLog.length} skrapade objekt till: ${logPath}`);
        await browser.close();
    }
}

// ─── INTERNA HJÄLPFUNKTIONER (utanför scrapeFacebookEvents) ──────────────────

/**
 * Skriver slutlig, komplett statistik för en körning till keyword_stats.json
 * samt lägger till en rad i scraper_run_history.json för trend-analys.
 */
export function writeFinalScraperStats(opts: {
    runStartedAt: string;
    sourceStats: { keyword: string; filter: string; found: number; unique: number; duplicates: number }[];
    perKeywordTotals: { [keyword: string]: { found: number; unique: number; duplicates: number } };
    totalUniqueUrls: number;
    totalDuplicateHits: number;
    extraction: {
        totalToProcess: number;
        alreadyInDb: number;
        newlySaved: number;
        skippedForeign: number;
        skippedDate: number;
        loginWall: number;
        failed: number;
    };
    eventsInLog: number;
    keywordStatsPath: string;
}) {
    const {
        runStartedAt, sourceStats, perKeywordTotals,
        totalUniqueUrls, totalDuplicateHits, extraction,
        eventsInLog, keywordStatsPath,
    } = opts;

    const now = new Date().toISOString();
    const durationMs = new Date(now).getTime() - new Date(runStartedAt).getTime();
    const durationMinutes = Math.round(durationMs / 60000);

    // ── Discovery-fas ────────────────────────────────────────────────────────
    const totalQueries = sourceStats.length;
    const queriesWithHits = sourceStats.filter(s => s.found > 0).length;
    const queriesAtCap    = sourceStats.filter(s => s.found >= 7).length;
    const queriesZero     = sourceStats.filter(s => s.found === 0).length;
    const totalFound      = sourceStats.reduce((acc, s) => acc + s.found, 0);

    // Städer vs sökord (stad = börjar med versal)
    const cityStats    = sourceStats.filter(s => /^[A-ZÅÄÖ]/.test(s.keyword));
    const keywordStats = sourceStats.filter(s => !/^[A-ZÅÄÖ]/.test(s.keyword));
    const citiesSearched   = new Set(cityStats.map(s => s.keyword)).size;
    const citiesWithHits   = new Set(cityStats.filter(s => s.found > 0).map(s => s.keyword)).size;
    const citiesAtCap      = new Set(cityStats.filter(s => s.found >= 7).map(s => s.keyword)).size;
    const keywordsSearched = new Set(keywordStats.map(s => s.keyword)).size;
    const keywordsWithHits = new Set(keywordStats.filter(s => s.found > 0).map(s => s.keyword)).size;

    const hitRatePct  = totalQueries > 0 ? (queriesWithHits / totalQueries * 100) : 0;
    const capRatePct  = totalQueries > 0 ? (queriesAtCap    / totalQueries * 100) : 0;
    const zeroRatePct = totalQueries > 0 ? (queriesZero     / totalQueries * 100) : 0;
    const avgFound    = totalQueries > 0 ? (totalFound / totalQueries) : 0;
    const dedupPct    = totalFound   > 0 ? (totalDuplicateHits / totalFound * 100) : 0;
    const cityCoveragePct = citiesSearched > 0 ? (citiesWithHits / citiesSearched * 100) : 0;

    // ── Extraction-fas ───────────────────────────────────────────────────────
    const { totalToProcess, alreadyInDb, newlySaved, skippedForeign, skippedDate, loginWall, failed } = extraction;
    const newUrls = totalToProcess - alreadyInDb;
    const extractionSuccessPct = newUrls > 0 ? (newlySaved / newUrls * 100) : 100;

    // ── Health score (0–100) ─────────────────────────────────────────────────
    // hitRate 30% + capRate 30% + extractionSuccess 40%
    const healthScore = Math.round(hitRatePct * 0.30 + capRatePct * 0.30 + extractionSuccessPct * 0.40);

    // ── perKeywordTotals (rankad + berikad) ──────────────────────────────────
    const rankedKeywords = Object.entries(perKeywordTotals)
        .map(([keyword, totals]) => {
            const isCity = /^[A-ZÅÄÖ]/.test(keyword);
            const kwQueries = sourceStats.filter(s => s.keyword === keyword);
            const kwHitRate = kwQueries.length > 0
                ? Math.round(kwQueries.filter(s => s.found > 0).length / kwQueries.length * 100)
                : 0;
            return {
                keyword,
                type: isCity ? 'city' : 'keyword',
                found: totals.found,
                unique: totals.unique,
                duplicates: totals.duplicates,
                hitRatePct: kwHitRate,
                atCap: kwQueries.some(s => s.found >= 7),
            };
        })
        .sort((a, b) => b.unique - a.unique);

    // ── Bygg slutpayload ─────────────────────────────────────────────────────
    const payload = {
        runStartedAt,
        lastUpdatedAt: now,
        durationMinutes,

        healthScore,   // 0–100, övergripande körningskvalitet

        discovery: {
            totalQueries,
            totalUrlsFound: totalFound,
            totalUniqueUrls,
            totalDuplicateHits,
            dedupRatePct:      Math.round(dedupPct * 10) / 10,
            hitRatePct:        Math.round(hitRatePct * 10) / 10,
            capRatePct:        Math.round(capRatePct * 10) / 10,
            zeroRatePct:       Math.round(zeroRatePct * 10) / 10,
            avgFoundPerQuery:  Math.round(avgFound * 100) / 100,
            cities: {
                searched:     citiesSearched,
                withHits:     citiesWithHits,
                atCap:        citiesAtCap,
                coveragePct:  Math.round(cityCoveragePct * 10) / 10,
            },
            keywords: {
                searched:     keywordsSearched,
                withHits:     keywordsWithHits,
                deadCount:    keywordsSearched - keywordsWithHits,
            },
        },

        extraction: {
            totalToProcess,
            alreadyInDb,
            newUrls,
            newlySaved,
            skippedForeign,
            skippedDate,
            loginWall,
            failed,
            successRatePct: Math.round(extractionSuccessPct * 10) / 10,
            eventsInLog,
        },

        perKeywordTotals: rankedKeywords,
        perQuery: sourceStats,
    };

    try {
        fs.writeFileSync(keywordStatsPath, JSON.stringify(payload, null, 2), 'utf-8');
        console.log('\n📊 Slutstatistik skriven till keyword_stats.json');
        console.log(`   HealthScore: ${healthScore}/100`);
        console.log(`   Discovery:   ${hitRatePct.toFixed(1)}% hit-rate, ${capRatePct.toFixed(1)}% cap-rate, ${citiesWithHits}/${citiesSearched} städer täckta`);
        console.log(`   Extraction:  ${extractionSuccessPct.toFixed(1)}% success-rate, ${newlySaved} nya sparade`);
    } catch (e) {
        console.error('⚠️ Kunde inte skriva slutstatistik:', e);
    }

    // ── Lägg till i körningshistoriken ───────────────────────────────────────
    const historyPath = path.resolve(path.dirname(keywordStatsPath), 'scraper_run_history.json');
    const historyRow = {
        runDate:          runStartedAt.slice(0, 10),
        runStartedAt,
        durationMinutes,
        healthScore,
        discovery: {
            totalQueries,
            totalUniqueUrls,
            hitRatePct:    Math.round(hitRatePct * 10) / 10,
            capRatePct:    Math.round(capRatePct * 10) / 10,
            zeroRatePct:   Math.round(zeroRatePct * 10) / 10,
            citiesCovPct:  Math.round(cityCoveragePct * 10) / 10,
            citiesWithHits,
            deadKeywords:  keywordsSearched - keywordsWithHits,
        },
        extraction: {
            totalToProcess,
            alreadyInDb,
            newlySaved,
            skippedForeign,
            successRatePct: Math.round(extractionSuccessPct * 10) / 10,
            eventsInLog,
        },
    };

    try {
        let history: typeof historyRow[] = [];
        if (fs.existsSync(historyPath)) {
            history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        }
        history.push(historyRow);
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
        console.log(`📈 Körningshistorik uppdaterad (${history.length} körningar totalt)`);
    } catch (e) {
        console.error('⚠️ Kunde inte skriva körningshistorik:', e);
    }
}

// Om filen körs direkt
if (require.main === module) {
    scrapeFacebookEvents().catch(console.error);
}
