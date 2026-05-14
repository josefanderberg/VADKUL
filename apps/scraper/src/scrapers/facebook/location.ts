import { Page } from 'puppeteer';

/**
 * Logic for extracting and verifying Location information.
 */
export const LocationInstrument = {
    /**
     * Extracts the location name and map URL from the event page.
     */
    extractInfo: async (page: Page, eventTitle: string) => {
        return await page.evaluate((title) => {
            const main = document.querySelector('div[role="main"], #mount_0_0_') || document.body;
            
            // Strategi 1: Google/Bing Maps länkar
            const mapLink = Array.from(main.querySelectorAll('a')).find(a => 
                a.href.includes('google.com/maps') || a.href.includes('maps.google') || a.href.includes('dir')
            );
            
            // Strategi 2: Facebook Places/Locations länkar
            const placeLink = Array.from(main.querySelectorAll('a')).find(a => 
                a.href.includes('/places/') || a.href.includes('/locations/')
            );

            let name = 'Växjö';
            let url: string | null = (placeLink?.href || mapLink?.href) || null;

            // Hitta namnet - Prioritera "Platsens namn" framför "Fullständig adress"
            const allSpans = Array.from(main.querySelectorAll('span[dir="auto"], div[dir="auto"], span, div'));
            
            // Vi letar efter den första raden som ser ut som en plats, men som INTE är en lång adress-sträng
            for (const el of allSpans) {
                if (el.children.length > 0) continue;
                const txt = el.textContent?.trim() || '';
                if (txt.length < 3 || txt === title || txt.includes('Logga in')) continue;

                const hasZip = txt.match(/(?:SE-)?\d{3}\s?\d{2}/);
                const isVeryLongAddress = txt.split(',').length > 2 || txt.length > 40;
                const isTriggerWord = txt.match(/ska gå|intresserade|svarade|se mer|fler event|sök|evenemang av|träffa värden/i);
                
                if (!isTriggerWord) {
                    // Om det är en länk till en plats, ta det namnet direkt (ofta "Arabyvalen")
                    const isPlaceLinkText = placeLink && placeLink.textContent?.includes(txt);
                    
                    if (isPlaceLinkText) {
                        name = txt;
                        break;
                    }

                    // Annars, ta den första korta beskrivande texten som inte är en postadress
                    if (!hasZip && !isVeryLongAddress && txt.length > 2) {
                        name = txt;
                        // Vi fortsätter inte break här direkt, vi ser om det finns en ännu bättre länk-text
                    }
                }
            }

            // Om vi hittade en adress men den är för lång, och vi har en länk-text, ta länk-texten istället
            if (placeLink && placeLink.textContent && (name.length > 30 || name === 'Växjö')) {
                name = placeLink.textContent.trim();
            }

            return { name, url };
        }, eventTitle);
    },

    /**
     * Navigates to a Facebook Place page to extract exact coordinates.
     */
    verifyCoordinates: async (page: Page, locationUrl: string): Promise<{ lat: number, lng: number } | null> => {
        if (!locationUrl.includes('/places/') && !locationUrl.includes('/locations/')) return null;
        
        console.log(`    🔍 LocationInstrument: Besöker platssida: ${locationUrl}`);
        try {
            await page.goto(locationUrl, { waitUntil: 'networkidle2' });
            return await page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script'));
                for (const s of scripts) {
                    const match = s.textContent?.match(/"latitude":([-.\d]+),"longitude":([-.\d]+)/);
                    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
                }
                return null;
            });
        } catch (e) {
            console.error(`    ⚠️ LocationInstrument: Kunde inte hämta koordinater från ${locationUrl}`, e);
            return null;
        }
    }
};
