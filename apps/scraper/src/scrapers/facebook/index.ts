import puppeteer from 'puppeteer';
import * as path from 'path';
import * as readline from 'readline';
import { addEventToDb, eventExistsInDb } from '../../utils/dbHelper';
import { geocodeVenue } from '../../utils/venueCoordinates';
import { applyDateFilters, discoverEventUrls } from './discovery';
import { extractEventDetails } from './extractor';
import { HostInstrument } from './host';
import { LocationInstrument } from './location';
import { FacebookSource } from './types';

// Funktion för att vänta på att användaren trycker på Enter
function waitForEnter(msg: string) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(msg, ans => { rl.close(); resolve(ans); }));
}

export async function scrapeFacebookEvents() {
    console.log('🚀 Startar Facebook-skrapan (Refactored)...');
    
    const userDataDir = path.resolve(__dirname, '../../../.fb_profile');

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir,
        args: ['--no-sandbox', '--disable-notifications', '--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
        console.log('🔐 Navigerar till Facebook...');
        await page.goto('https://www.facebook.com/events/search/?q=V%C3%A4xj%C3%B6', { waitUntil: 'networkidle2' });
        
        const needsLogin = await page.$('#email, input[name="email"]');
        if (needsLogin) {
            console.log('🔑 Du behöver logga in på Facebook i det öppnade fönstret.');
            await waitForEnter('\n👉 Logga in i webbläsarfönstret och tryck sedan på ENTER här i terminalen när du är klar: ');
        }

        const SOURCES: FacebookSource[] = [
            { url: 'https://www.facebook.com/events/search/?q=Växjö', filters: ['idag' /*, 'i morgon'*/] }
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
                await new Promise(r => setTimeout(r, 2000));

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
                let finalLat = 56.8777, finalLng = 14.8091;
                let isLocationVerified = false;

                if (locInfo.url && locInfo.url.includes('/places/')) {
                    const coords = await LocationInstrument.verifyCoordinates(page, locInfo.url);
                    if (coords) {
                        finalLat = coords.lat;
                        finalLng = coords.lng;
                        isLocationVerified = true;
                    }
                    await new Promise(r => setTimeout(r, 1000)); // Synlighet
                    await page.goto(url, { waitUntil: 'networkidle2' }); // Gå tillbaka
                }

                // Fallback till geokodning om vi inte fick exakta koordinater från FB
                if (!isLocationVerified) {
                    const locationToGeocode = locInfo.name !== 'Växjö' ? locInfo.name : details.locationName;
                    if (locationToGeocode !== 'Växjö') {
                        const coords = await geocodeVenue(locationToGeocode);
                        if (coords) { 
                            finalLat = coords[0]; finalLng = coords[1]; 
                            isLocationVerified = true;
                        } else { 
                            finalLat += (Math.random()-0.5)*0.01; finalLng += (Math.random()-0.5)*0.01; 
                        }
                    } else {
                        finalLat += (Math.random()-0.5)*0.005; finalLng += (Math.random()-0.5)*0.005;
                    }
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
                console.log(`  ✅ Sparade: ${details.title}`);
            } catch (e) {
                console.log(`    ❌ Fel vid ${url}`);
            }
        }
        console.log(`🎉 Klar! Sparade ${saved} nya.`);
    } catch (err) {
        console.error('❌ Fel i skrapan:', err);
    } finally {
        await browser.close();
    }
}

// Om filen körs direkt
if (require.main === module) {
    scrapeFacebookEvents().catch(console.error);
}
