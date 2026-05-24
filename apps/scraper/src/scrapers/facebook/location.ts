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
            
            // 1. Find the location container using the standard SVG pin
            const svgs = Array.from(main.querySelectorAll('svg'));
            const locationSvg = svgs.find(svg => {
                const paths = Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d') || '');
                return paths.some(d => 
                    d.startsWith('M10 .5') || 
                    d.startsWith('M10 0') || 
                    d.includes('M10 .5A7.5') || 
                    d.includes('M10 0a7.5')
                );
            });

            let locationRow: Element | null = null;
            if (locationSvg) {
                // Climb up to find the individual row container that contains only this SVG and its texts
                let curr = locationSvg.parentElement;
                while (curr && curr !== document.body) {
                    const role = curr.getAttribute('role');
                    if (role === 'list' || role === 'main') {
                        break;
                    }
                    
                    // If this container has any other SVG icons (excluding the pin itself), it is the parent list.
                    const otherSvgs = Array.from(curr.querySelectorAll('svg')).filter(s => s !== locationSvg && !locationSvg.contains(s));
                    if (otherSvgs.length > 0) {
                        break;
                    }
                    
                    locationRow = curr;
                    curr = curr.parentElement;
                }
            }

            // Fallback: locate by looking for a location link on the page
            if (!locationRow) {
                const locationLink = Array.from(main.querySelectorAll('a')).find(a => 
                    a.href.includes('/places/') || a.href.includes('/locations/') || a.href.includes('google.com/maps')
                );
                if (locationLink) {
                    locationRow = locationLink.closest('[role="listitem"]') || locationLink.parentElement || null;
                }
            }

            // Extract Display Place Name from the isolated pin row
            let displayName = '';
            let pinRowAddress = '';
            let locationUrl: string | null = null;

            if (locationRow) {
                let textContainers = Array.from(locationRow.querySelectorAll('.xu06os2, [class*="xu06os2"]'));
                if (textContainers.length === 0) {
                    textContainers = Array.from(locationRow.querySelectorAll('span, div')).filter(el => {
                        return el.children.length === 0 && el.textContent?.trim();
                    });
                }

                const noiseKeywords = [
                    'visa karta', 'show map', 'vägbeskrivning', 'get directions', 
                    'directions', 'karta', 'map', 'svarat', 'svarade', 'personer', 
                    'went', 'interested', 'intresserad', 'intresserade', 'gick'
                ];

                const pinTexts = Array.from(new Set(textContainers.map(el => el.textContent?.trim() || '').filter(Boolean)))
                    .filter(text => {
                        const lower = text.toLowerCase();
                        return !noiseKeywords.some(keyword => lower.includes(keyword));
                    });

                if (pinTexts.length > 0) {
                    displayName = pinTexts[0];
                    pinRowAddress = pinTexts.length > 1 ? pinTexts[1] : pinTexts[0];
                    const link = locationRow.querySelector('a');
                    locationUrl = link?.href || null;
                }
            }

            // 2. Scan the entire page for a high-precision physical address
            let bestAddressText = '';
            let highestAddressScore = 0;

            const scoreAddress = (text: string) => {
                const lower = text.toLowerCase();
                
                // Exclude very long texts or typical noise
                if (text.length > 100 || text.length < 3) return 0;
                
                const noiseKeywords = [
                    'visa karta', 'show map', 'vägbeskrivning', 'get directions', 
                    'directions', 'karta', 'map', 'svarat', 'svarade', 'personer', 
                    'went', 'interested', 'intresserad', 'intresserade', 'gick',
                    'facebook', 'copyright', 'logga in', 'evenemang av'
                ];
                if (noiseKeywords.some(keyword => lower.includes(keyword))) return 0;
                if (lower === displayName.toLowerCase()) return 0;

                let score = 0;
                
                // Street suffix keywords (Swedish and English)
                const streetKeywords = [
                    'vägen', 'gatan', 'allé', 'plan', 'torg', 'platsen', 
                    'backe', 'gränd', 'väg', 'gat', 'road', 'street', 
                    'avenue', 'storgatan', 'rådjursvägen', 'vattentorget', 
                    'st.', 'rd.', 'ave'
                ];
                if (streetKeywords.some(kw => lower.includes(kw))) {
                    score += 10;
                }

                // Country indicators
                if (lower.includes('sverige') || lower.includes('sweden')) {
                    score += 10;
                }

                // Postal code matching (e.g. 352 45, 35245, SE-35245)
                if (lower.match(/(?:se-)?\d{3}\s?\d{2}/i)) {
                    score += 10;
                }

                // Street number matching (e.g. 2, 2A, 12, 12B)
                if (lower.match(/\b\d+[a-z]?\b/i)) {
                    score += 5;
                }

                // City indicator
                if (lower.includes('växjö') || lower.includes('vaxjo')) {
                    score += 2;
                }

                // Structure tie-breakers
                if (lower.includes(',')) score += 1;
                if (lower.includes('se-')) score += 1;
                
                return score;
            };

            // Query all leaf text nodes across the entire body
            const leafNodes = Array.from(document.body.querySelectorAll('span, div')).filter(el => {
                return el.children.length === 0 && el.textContent?.trim();
            });

            const uniquePageTexts = Array.from(new Set(leafNodes.map(el => el.textContent?.trim() || '').filter(Boolean)));

            for (const text of uniquePageTexts) {
                const score = scoreAddress(text);
                if (score > highestAddressScore) {
                    highestAddressScore = score;
                    bestAddressText = text;
                }
            }

            // Final consolidation
            const name = displayName;
            // Prefer the precise address found on the page if it scores high, fall back to pin row address
            const fullAddress = (highestAddressScore >= 5 && bestAddressText) ? bestAddressText : pinRowAddress;

            return { name, fullAddress, url: locationUrl };
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
            // Dismiss login popups/modals
            await page.evaluate(() => {
                const closeButtons = Array.from(document.querySelectorAll('div[role="button"], button, i'));
                for (const btn of closeButtons) {
                    const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
                    const txt = btn.textContent?.trim().toLowerCase() || '';
                    if (label.includes('stäng') || label.includes('close') || txt === '✕' || txt === 'x') {
                        (btn as HTMLElement).click();
                    }
                }
            }).catch(() => {});
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
