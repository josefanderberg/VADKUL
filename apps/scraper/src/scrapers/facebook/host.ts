import { Page } from 'puppeteer';

/**
 * Logic for extracting and verifying Host information.
 */
export const HostInstrument = {
    /**
     * Extracts the host name and URL from the event page.
     */
    extractInfo: async (page: Page) => {
        return await page.evaluate(() => {
            const main = document.querySelector('div[role="main"], #mount_0_0_') || document.body;
            const allSpans = Array.from(main.querySelectorAll('span, div, a'));
            
            // Triggers för värdskap
            const hostTriggerEl = allSpans.find(el => {
                const txt = el.textContent?.trim() || '';
                return txt.match(/evenemang av|event by|hosted by|träffa värden|arrangeras av/i) && txt.length < 30;
            });

            let name = 'Facebook';
            let url: string | null = null;
            let avatar: string | null = null;

            if (hostTriggerEl) {
                let container = hostTriggerEl.parentElement;
                let link = container?.querySelector('a');
                if (!link && container?.parentElement) link = container.parentElement.querySelector('a');

                if (link && link.textContent && link.textContent.length > 2 && !['om', 'diskussion', 'fler'].includes(link.textContent.toLowerCase())) {
                    // 1. Prova att hitta en inre span (ofta där namnet bor rent)
                    const innerSpan = link.querySelector('span');
                    let rawName = innerSpan?.textContent?.trim() || link.childNodes[0]?.textContent?.trim() || link.textContent.trim();
                    
                    // 2. Tvätta bort Facebook-tillägg om de råkade komma med (t.ex. "Namn123 tidigare evenemang")
                    name = rawName.replace(/(\d+)\s+tidigare evenemang.*/i, '')
                                  .replace(/(\d+)tidigare evenemang.*/i, '') // Hantera fall utan mellanslag (Trafikspecialisten3)
                                  .replace(/\s*·\s*Sida.*/i, '')
                                  .replace(/Meddelande$/i, '')
                                  .replace(/WhatsApp$/i, '')
                                  .trim();
                    
                    // 3. Om det fortfarande är för långt (> 40 tecken), försök ta det som står innan första siffran följt av text
                    if (name.length > 40) {
                        const firstDigitMatch = name.match(/^(.*?)(\d+)/);
                        if (firstDigitMatch && firstDigitMatch[1].length > 2) {
                            name = firstDigitMatch[1].trim();
                        }
                    }
                                  
                    url = link.href;
                    const img = link.querySelector('img') || link.parentElement?.querySelector('img');
                    if (img) avatar = img.src;
                }
            }

            // Backup om ingen trigger hittades
            if (name === 'Facebook' || name.toLowerCase() === 'om') {
                const potentialLinks = Array.from(main.querySelectorAll('a'))
                    .filter(a => (a.href.includes('/groups/') || a.href.includes('/pages/') || a.href.includes('/user/')) && 
                                 !a.href.includes('/events/') && a.textContent && a.textContent.length > 2 &&
                                 !['om', 'diskussion', 'fler', 'visa alla', 'se mer'].includes(a.textContent.toLowerCase()));
                if (potentialLinks.length > 0) {
                    const firstLink = potentialLinks[0];
                    const innerSpan = firstLink.querySelector('span');
                    let rawName = innerSpan?.textContent?.trim() || firstLink.childNodes[0]?.textContent?.trim() || firstLink.textContent?.trim() || 'Facebook';
                    
                    name = rawName.replace(/(\d+)\s+tidigare evenemang.*/i, '')
                                  .replace(/(\d+)tidigare evenemang.*/i, '')
                                  .replace(/\s*·\s*Sida.*/i, '')
                                  .replace(/Meddelande$/i, '')
                                  .replace(/WhatsApp$/i, '')
                                  .trim();

                    if (name.length > 40) {
                        const firstDigitMatch = name.match(/^(.*?)(\d+)/);
                        if (firstDigitMatch && firstDigitMatch[1].length > 2) {
                            name = firstDigitMatch[1].trim();
                        }
                    }
                                  
                    url = firstLink.href;
                    const img = firstLink.parentElement?.querySelector('img') || firstLink.querySelector('img');
                    if (img) avatar = img.src;
                }
            }

            return { name, url, avatar };
        });
    },

    /**
     * Navigates to the host's page to get a high-quality profile picture.
     */
    verifyImage: async (page: Page, hostUrl: string): Promise<string | null> => {
        console.log(`    🔍 HostInstrument: Besöker värdens sida: ${hostUrl}`);
        try {
            await page.goto(hostUrl, { waitUntil: 'networkidle2' });
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
            await new Promise(r => setTimeout(r, 2000)); // Vänta på rendering

            const profilePic = await page.evaluate(() => {
                // Selektorer sorterade efter pålitlighet
                const selectors = [
                    'img[aria-label*="Profilbild"]',
                    'img[aria-label*="Profile picture"]',
                    'img[data-testid="profile-pic"]',
                    'a[aria-label*="Profilbild"] img',
                    'a[aria-label*="Profile picture"] img',
                    'img[data-imgperflogname="profileCoverPhoto"]',
                    'img[src*="p160x160"]',
                    'img[src*="p200x200"]'
                ];
                
                for (const sel of selectors) {
                    const img = document.querySelector(sel) as HTMLImageElement;
                    if (img && img.src && !img.src.includes('data:image')) return img.src;
                }

                // Heuristik: Hitta alla bilder som är någorlunda stora och kvadratiska
                const allImgs = Array.from(document.querySelectorAll('img'));
                const candidates = allImgs.filter(img => {
                    const rect = img.getBoundingClientRect();
                    const isSquare = Math.abs(rect.width - rect.height) < 10;
                    const isReasonableSize = rect.width > 120 && rect.width < 600;
                    const hasProfileKeywords = (img.alt + img.ariaLabel).toLowerCase().match(/profilbild|profile|picture|foto/);
                    return (isSquare && isReasonableSize) || (isReasonableSize && hasProfileKeywords);
                });

                // Sortera: prioritera de som faktiskt har "profil" i alt-texten
                candidates.sort((a, b) => {
                    const scoreA = (a.alt + a.ariaLabel).toLowerCase().includes('profil') ? 1 : 0;
                    const scoreB = (b.alt + b.ariaLabel).toLowerCase().includes('profil') ? 1 : 0;
                    return scoreB - scoreA;
                });

                if (candidates.length > 0) return candidates[0].src;

                // Sista utvägen: ta den största bilden i den övre delen av sidan
                const topImgs = allImgs.filter(img => img.getBoundingClientRect().top < 500 && img.width > 100);
                topImgs.sort((a, b) => (b.width * b.height) - (a.width * a.height));
                
                return topImgs[0]?.src || null;
            });
            return profilePic;
        } catch (e) {
            console.error(`    ⚠️ HostInstrument: Kunde inte hämta bild från ${hostUrl}`, e);
            return null;
        }
    }
};
