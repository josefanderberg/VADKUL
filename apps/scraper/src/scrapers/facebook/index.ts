import puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import { addEventToDb, eventExistsInDb } from '../../utils/dbHelper';
import { geocodeVenue, cleanVenueName } from '../../utils/venueCoordinates';
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

export async function scrapeFacebookEvents() {
    console.log('🚀 Startar Facebook-skrapan (Refactored)...');
    const scrapedEventsLog: any[] = [];
    
    const browser = await puppeteer.launch({
        headless: true, // Run headless to avoid popping up windows in background execution
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
        console.log('🔐 Navigerar till Facebook...');
        await page.goto('https://www.facebook.com/events/search/?q=V%C3%A4xj%C3%B6', { waitUntil: 'networkidle2' });
        
        console.log('🍪 Hanterar eventuella cookie-val och inloggningsrutor...');
        await handleBannersAndModals(page);
        await new Promise(r => setTimeout(r, 3000));

        const SOURCES: FacebookSource[] = [
            { url: 'https://www.facebook.com/events/search/?q=V%C3%A4xj%C3%B6', filters: [] }
        ];

        const allEventUrls = new Map<string, string>();

        for (const source of SOURCES) {
            console.log(`\n🔍 Letar event på: ${source.url}`);
            if (page.url() !== source.url) {
                await page.goto(source.url, { waitUntil: 'networkidle2' });
                await new Promise(r => setTimeout(r, 3000));
            }

            await applyDateFilters(page, source.filters);
            const discovered = await discoverEventUrls(page);
            
            discovered.forEach(item => {
                if (!allEventUrls.has(item.url)) {
                    allEventUrls.set(item.url, item.day);
                }
            });
            console.log(`    📌 Hittade ${discovered.length} relevanta event-länkar.`);
        }

        console.log(`\n🔎 Går nu igenom ${allEventUrls.size} unika event...`);

        let saved = 0;
        for (const [url, expectedDay] of allEventUrls.entries()) {
            if (await eventExistsInDb(url)) continue;

            try {
                console.log(`  📄 Detaljer för: ${url}`);
                await page.goto(url, { waitUntil: 'networkidle2' });
                await handleBannersAndModals(page);
                await new Promise(r => setTimeout(r, 4000));

                // Expandera beskrivning
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
                    await new Promise(r => setTimeout(r, 1000)); // Låt användaren se att vi är där
                    await page.goto(url, { waitUntil: 'networkidle2' }); // Gå tillbaka till eventet
                }

                // --- INSTRUMENT: PLATS (LOCATION) ---
                const locInfo = await LocationInstrument.extractInfo(page, details.title);
                
                const extractedAddress = locInfo.fullAddress;
                const geocodedQuery = cleanVenueName(extractedAddress);
                
                console.log(`    Extracted Address: "${extractedAddress}"`);
                console.log(`    Geocoded Query: "${geocodedQuery}"`);

                let finalLat = 56.8777, finalLng = 14.8091;
                let isLocationVerified = false;

                if (extractedAddress !== 'Växjö') {
                    const coords = await geocodeVenue(extractedAddress);
                    if (coords) {
                        finalLat = coords[0];
                        finalLng = coords[1];
                        isLocationVerified = true;
                    } else {
                        finalLat += (Math.random() - 0.5) * 0.01;
                        finalLng += (Math.random() - 0.5) * 0.01;
                    }
                } else {
                    finalLat += (Math.random() - 0.5) * 0.005;
                    finalLng += (Math.random() - 0.5) * 0.005;
                }

                // Hantera tid och datum
                let eventTime = new Date();
                if (expectedDay === 'i morgon') eventTime.setDate(eventTime.getDate() + 1);

                if (details.exactTime) {
                    const [hours, minutes] = details.exactTime.split(':').map(Number);
                    eventTime.setHours(hours, minutes, 0, 0);
                } else if (details.isoDate) {
                    const parsedIso = new Date(details.isoDate);
                    if (!isNaN(parsedIso.getTime())) {
                        eventTime.setHours(parsedIso.getHours(), parsedIso.getMinutes(), 0, 0);
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
                    category: 'other',
                    coverImage: finalImage,
                    description: details.description,
                    attendees: details.going,
                    createdAt: new Date().toISOString(),
                    isLocationVerified,
                    isHostVerified
                };
                scrapedEventsLog.push(eventObj);

                await addEventToDb({
                    title: details.title,
                    url: url,
                    time: eventTime,
                    locationName: locInfo.name,
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
                console.log(`  ✅ Sparade: ${details.title} (${details.going} deltagare)`);
            } catch (e) {
                console.log(`    ❌ Fel vid ${url}`);
            }
        }
        console.log(`🎉 Klar! Sparade ${saved} nya.`);
    } catch (err) {
        console.error('❌ Fel i skrapan:', err);
    } finally {
        const logPath = path.resolve(__dirname, '../../../../scraped_events.json');
        try {
            fs.writeFileSync(logPath, JSON.stringify(scrapedEventsLog, null, 2), 'utf-8');
            console.log(`💾 Sparade ${scrapedEventsLog.length} skrapade objekt till: ${logPath}`);
        } catch (writeErr) {
            console.error('⚠️ Kunde inte skriva scraped_events.json:', writeErr);
        }
        await browser.close();
    }
}

// Om filen körs direkt
if (require.main === module) {
    scrapeFacebookEvents().catch(console.error);
}
