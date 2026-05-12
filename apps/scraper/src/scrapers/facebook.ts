import puppeteer from 'puppeteer';
import { addEventToDb, eventExistsInDb } from '../utils/dbHelper';
import * as dotenv from 'dotenv';

dotenv.config();

const FB_EMAIL = process.env.FB_EMAIL;
const FB_PASSWORD = process.env.FB_PASSWORD;

/**
 * Facebook Scraper
 * Loggar in och hämtar events från specifika grupper eller sökningar.
 */
export async function scrapeFacebookEvents() {
    if (!FB_EMAIL || !FB_PASSWORD) {
        console.error('❌ Fel: FB_EMAIL eller FB_PASSWORD saknas i .env');
        return;
    }

    console.log('🚀 Startar Facebook-skrapan...');
    
    const browser = await puppeteer.launch({
        headless: false, // Vi kör med synligt fönster så du kan se inloggningen
        args: ['--no-sandbox', '--disable-notifications']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    try {
        // 1. Logga in
        console.log('🔐 Loggar in på Facebook...');
        await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle2' });
        
        // Hantera cookies-popup (mer robust)
        try {
            console.log('🍪 Hanterar cookies...');
            const cookieSelectors = [
                'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
                'button[title="Tillåt alla cookies"]',
                'button[title="Allow all cookies"]',
                'button:contains("Tillåt alla")',
                'button:contains("Allow all")'
            ];
            
            // Vi letar efter knappen i 5 sekunder
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const allowButton = buttons.find(b => 
                    b.innerText.includes('Tillåt alla') || 
                    b.innerText.includes('Allow all') ||
                    b.innerText.includes('Godkänn alla')
                );
                if (allowButton) allowButton.click();
            });
            await new Promise(r => setTimeout(r, 1000)); // Vänta lite efter klick
        } catch (e) {
            console.log('dim', '  (Ingen cookie-ruta hittades eller behövde klickas)');
        }

        await page.waitForSelector('#email');
        await page.type('#email', FB_EMAIL);
        await page.type('#pass', FB_PASSWORD);
        await page.click('#loginbutton');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        console.log('✅ Inloggad!');

        // 2. Gå till Växjö-gruppen för events
        // (Baserat på din öppna flik: https://www.facebook.com/groups/864720594217898/)
        const groupUrl = 'https://www.facebook.com/groups/864720594217898/events';
        console.log(`📂 Går till gruppen: ${groupUrl}`);
        await page.goto(groupUrl, { waitUntil: 'networkidle2' });

        // 3. Skrapa events
        // Facebook laddar in events allt eftersom man scrollar
        await autoScroll(page);

        const events = await page.evaluate(() => {
            const items: any[] = [];
            // Hittar alla event-kort i en grupp
            const cards = document.querySelectorAll('div[role="main"] a[href*="/events/"]');
            
            cards.forEach(card => {
                const titleEl = card.closest('div')?.querySelector('span[style*="-webkit-line-clamp"]');
                const timeEl = card.closest('div')?.querySelector('span[class*="x193iq5w"]'); // Ofta datumet
                
                const href = (card as HTMLAnchorElement).href;
                const eventId = href.split('/events/')[1]?.split('/')[0];

                if (eventId && !items.find(i => i.id === eventId)) {
                    items.push({
                        id: eventId,
                        title: titleEl?.textContent?.trim() || 'Facebook Event',
                        url: `https://www.facebook.com/events/${eventId}/`,
                        timeStr: timeEl?.textContent?.trim() || '',
                    });
                }
            });
            return items;
        });

        console.log(`🔎 Hittade ${events.length} potentiella events i gruppen.`);

        let saved = 0;
        for (const evt of events) {
            if (await eventExistsInDb(evt.url)) continue;

            // Här kan vi gå in på varje event för att hämta mer detaljer (plats, beskrivning)
            // Men för nu sparar vi grundinfon
            await addEventToDb({
                title: evt.title,
                url: evt.url,
                time: new Date(), // Vi behöver bättre datum-parsing här sen
                locationName: 'Växjö (via FB-grupp)',
                lat: 56.8777,
                lng: 14.8091,
                hostName: 'Facebook',
                category: 'other',
                createdAt: new Date(),
            });
            saved++;
            console.log(`✅ Sparade: ${evt.title}`);
        }

        console.log(`🎉 Klar! Sparade ${saved} nya events från Facebook.`);

    } catch (err) {
        console.error('❌ Fel under Facebook-skrapning:', err);
    } finally {
        await browser.close();
    }
}

// Kör skrapan om filen anropas direkt
if (require.main === module) {
    scrapeFacebookEvents().catch(console.error);
}

// Hjälpfunktion för att scrolla ner
async function autoScroll(page: any) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            let distance = 100;
            let timer = setInterval(() => {
                let scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    });
}
