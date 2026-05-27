import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { addEventToDb, eventExistsInDb, getEventFromDb } from '../../utils/dbHelper';
import { geocodeVenueSweden, cleanVenueName } from '../../utils/venueCoordinates';
import { searchGoogleImage } from '../../utils/imageSearch';
import { applyDateFilters, discoverEventUrls } from './discovery';
import { extractEventDetails } from './extractor';
import { HostInstrument } from './host';
import { LocationInstrument } from './location';
import { FacebookSource } from './types';

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

export async function scrapeFacebookEvents() {
    console.log('🚀 Startar Facebook-skrapan (Refactored)...');
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
        // Svenska städer — så vi får "vad händer i stan"-täckning (110 städer totalt)
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
            'Strängnäs', 'Flen', 'Nora', 'Lindesberg'
        ];

        // Breda sökord – event-typer, aktiviteter, tider (40 sökord totalt)
        const BROAD_KEYWORDS = [
            // Event-typer
            'konsert', 'live', 'klubb', 'fest', 'dj', 'quiz', 'spelning', 'show',
            'standup', 'gig', 'festival', 'marknad', 'loppis', 'pubrunda', 'afterwork',
            'vernissage', 'teater', 'föreställning', 'musikal', 'opera',
            // Aktiviteter
            'musik', 'dans', 'teater', 'comedy', 'sport', 'yoga', 'kurs', 'workshop',
            'föreläsning', 'utställning', 'film', 'bio', 'konst', 'hantverk',
            // Tider / vardagsord
            'kväll', 'helg', 'lördag', 'fredag', 'torsdag', 'söndag'
        ];

        // Datumfilter: idag + denna vecka
        const DATE_FILTERS = ['idag', 'den här veckan'];

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

        console.log(`🔧 Konfiguration: ${SWEDISH_CITIES.length} städer + ${BROAD_KEYWORDS.length} sökord × ${DATE_FILTERS.length} datumfilter = ${SOURCES.length} queries totalt.`);

        const allEventUrls = new Map<string, { expectedDay: string; city?: string }>();

        // Statistik per (keyword, filter)-kombination
        type SourceStat = { keyword: string; filter: string; found: number; unique: number; duplicates: number };
        const sourceStats: SourceStat[] = [];
        // Aggregerad statistik per stoppord
        const perKeywordTotals: { [keyword: string]: { found: number; unique: number; duplicates: number } } = {};
        let totalDuplicateHits = 0;

        for (const source of SOURCES) {
            const keyword = decodeURIComponent(source.url.split('q=')[1] || '');
            const filterLabel = source.filters.join(', ') || '(inget)';
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
        for (const [url, itemData] of allEventUrls.entries()) {
            const { expectedDay, city } = itemData;
            processed++;
            console.log(`\n📊 [${processed}/${totalToProcess}] Behandlar event (sparade hittills: ${scrapedEventsLog.length})`);
            try {
                // Check if already in the database
                const existingEvent = await getEventFromDb(url);
                if (existingEvent) {
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
                    continue;
                }

                // If not in database, scrape detailed page
                console.log(`  📄 Detaljer för: ${url}`);
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
                if (details.title === 'Facebook Event' || details.title.includes('Logga in')) continue;

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

                let finalLat = 0, finalLng = 0;
                let isLocationVerified = false;

                if (extractedAddress) {
                    let geocodeQuery = extractedAddress;
                    // Om stadsnamn inte redan ingår i adressen, lägg till kontext-staden som hittades vid sökningen
                    if (city && !extractedAddress.toLowerCase().includes(city.toLowerCase())) {
                        geocodeQuery = `${extractedAddress}, ${city}`;
                    }
                    const coords = await geocodeVenueSweden(geocodeQuery);
                    if (coords) {
                        finalLat = coords[0];
                        finalLng = coords[1];
                        isLocationVerified = true;
                    }
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

                // Range validation (Today to 7 days ahead)
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
                oneWeekFromNow.setHours(23, 59, 59, 999);

                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                if (eventTime > oneWeekFromNow || eventTime < todayStart) {
                    console.log(`    ⏩ Skippar event (utanför 1-veckas intervall): ${details.title} (${eventTime.toLocaleDateString()})`);
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
                    category: 'other',
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
                    category: 'other',
                    coverImage: finalImage,
                    description: details.description,
                    attendees: details.going,
                    createdAt: new Date(),
                    isLocationVerified,
                    isHostVerified
                });
                saved++;
                console.log(`  ✅ Sparade: ${details.title} (${details.going} deltagare) — totalt sparade nya: ${saved}, totalt i loggen: ${scrapedEventsLog.length}`);
            } catch (e) {
                console.log(`    ❌ Fel vid ${url}`, e);
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
    } catch (err) {
        console.error('❌ Fel i skrapan:', err);
    } finally {
        writeLogFile();
        console.log(`💾 Slutligen sparade ${scrapedEventsLog.length} skrapade objekt till: ${logPath}`);
        await browser.close();
    }
}

// Om filen körs direkt
if (require.main === module) {
    scrapeFacebookEvents().catch(console.error);
}
