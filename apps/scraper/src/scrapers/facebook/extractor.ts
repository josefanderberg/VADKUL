import { Page } from 'puppeteer';
import { IFacebookEventScrapeResult } from './types';

/**
 * Extracts detailed information from a single Facebook event page.
 */
export async function extractEventDetails(page: Page): Promise<IFacebookEventScrapeResult> {
    return await page.evaluate(() => {
        const main = document.querySelector('div[role="main"], #mount_0_0_') || document.body;
        
        // 1. Title
        const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
        const titleEl = main.querySelector('h1, [data-testid="event-title"]');
        const title = ogTitle || titleEl?.textContent?.trim() || 'Facebook Event';

        // 2. Image
        const coverPhotoEl = document.querySelector('img[data-imgperflogname="profileCoverPhoto"]') as HTMLImageElement;
        const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const allImages = Array.from(main.querySelectorAll('img'))
            .filter(img => !img.src.includes('emoji') && img.width > 300 && !img.src.includes('p160x160') && !img.src.includes('p200x200'));
        const largestImg = allImages.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
        
        let image = coverPhotoEl?.src || ogImage || largestImg?.src || '';
        if (image.startsWith('data:image')) image = ogImage || '';

        // 3. Location
        const LocationExtractorService = {
            extract: (root: Element, eventTitle: string): string => {
                const mapLink = Array.from(root.querySelectorAll('a')).find(a => 
                    a.href.includes('google.com/maps') || a.href.includes('maps.google') || a.href.includes('dir')
                );
                if (mapLink) {
                    try {
                        const url = new URL(mapLink.href);
                        const dest = url.searchParams.get('destination') || url.searchParams.get('q');
                        if (dest) return decodeURIComponent(dest).replace(/\+/g, ' ');
                    } catch(e) {}
                    const txt = mapLink.textContent?.trim();
                    if (txt && txt.length > 3) return txt;
                }

                const placeLinks = Array.from(root.querySelectorAll('a[href*="/places/"], a[href*="/locations/"]'));
                for (const a of placeLinks) {
                    const txt = a.textContent?.trim();
                    if (txt && txt.length > 2 && txt !== eventTitle) return txt;
                }

                const allSpans = Array.from(root.querySelectorAll('span[dir="auto"], div[dir="auto"], span, div'));
                for (const el of allSpans) {
                    if (el.children.length > 0) continue;
                    const txt = el.textContent?.trim() || '';
                    const hasZip = txt.match(/(?:SE-)?\d{3}\s?\d{2}/);
                    const isAddress = txt.match(/\w+(gatan|vägen|torget|plan|parken|platsen|backen|allén|torpet|vallen)\s+\d*/i);
                    const isVaxjo = txt.toLowerCase().includes('växjö') || txt.toLowerCase().includes('vaxjo');
                    
                    if ((isAddress || hasZip || isVaxjo) && txt.length > 5 && txt.length < 100 && txt !== eventTitle) {
                        if (!txt.match(/ska gå|intresserade|svarade|se mer|Logga in|fler event|sök|evenemang av|träffa värden/i)) {
                            return txt;
                        }
                    }
                }
                return 'Växjö';
            }
        };

        let locationName = LocationExtractorService.extract(main, title);

        // 4. Attendees
        const textContent = (main as any).innerText || '';
        let going = 0;
        // Förbättrad regex för att fånga både "ska gå", "intresserade" och "personer svarade"
        const goingMatch = textContent.match(/([\d\s\.,kK]+)\s*(?:ska gå|going|deltagare|gäster|svarade|intresserade|personer|interested)/i);
        if (goingMatch) {
            let numStr = goingMatch[1].toLowerCase().replace(/\s/g, '').replace(',', '.');
            if (numStr.includes('k')) going = parseFloat(numStr) * 1000;
            else going = parseInt(numStr);
            if (isNaN(going)) going = 0;
        }

        // 5. Time
        let exactTime: string | null = null;
        let isoDate = document.querySelector('meta[property="event:start_time"]')?.getAttribute('content') || null;
        const timeMatch = textContent.match(/(\d{1,2}[:.]\d{2})/);
        if (timeMatch) exactTime = timeMatch[1].replace('.', ':');

        // 6. Description — innerText, INTE textContent: Facebook renderar
        // beskrivningen som flera block-divar och textContent klistrar ihop
        // styckena utan separator ("…klubb.Tävlingsområde…"). innerText
        // bevarar de renderade radbrytningarna som \n.
        let description = '';
        // Nya layouten (2026): beskrivningen under rubriken "Vad du kan förvänta
        // dig"/"What to expect" — ta rubrikens närmaste block med rejäl text.
        const headingEl = Array.from(main.querySelectorAll('span, div, h2, h3')).find(el =>
            el.children.length === 0 && /^(?:vad du kan förvänta dig|what to expect|detaljer|details)$/i.test(el.textContent?.trim() || ''));
        if (headingEl) {
            const headingTxt = headingEl.textContent?.trim() || '';
            let box: HTMLElement | null = headingEl.parentElement;
            for (let depth = 0; depth < 5 && box; depth++) {
                const txt = ((box as any).innerText || box.textContent || '').trim();
                if (txt.length > headingTxt.length + 40 && !txt.includes('Logga in')) {
                    description = txt.replace(/^(?:vad du kan förvänta dig|what to expect|detaljer|details)\s*/i, '').trim();
                    break;
                }
                box = box.parentElement;
            }
        }
        const descEl = main.querySelector('div[data-ad-preview="message"], div[style*="white-space: pre-wrap"]');
        if (description.length >= 20) {
            // rubrik-blocket ovan räcker
        } else if (descEl && descEl.textContent) {
            description = ((descEl as any).innerText || descEl.textContent).trim();
        } else {
            const allDivs = Array.from(main.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
            let longestText = '';
            for (const div of allDivs) {
                const txt = ((div as any).innerText || div.textContent || '').trim();
                if (txt.length > longestText.length && txt.length > 50) {
                    if (!txt.includes('Logga in') && !txt.includes('Tidigare evenemang') && !txt.match(/ska gå|intresserade/i)) {
                        longestText = txt;
                    }
                }
            }
            description = longestText;
        }

        // Clean up common Facebook UI artifacts from the description
        // FB-sidfoten som "längsta text" (Integritet · Användarvillkor …) = ingen beskrivning.
        if (/^\s*Integritet\s*[·•]?\s*(?:\n\s*)?·?\s*Användarvillkor/i.test(description) || /Användarvillkor[\s\S]{0,80}Cookies/i.test(description.slice(0, 200))) description = '';
        description = description
            .replace(/\s*(?:Läs mer|Read more)\s*$/i, '')
            .replace(/Visa f[äa]rre$/i, '')
            .replace(/Visa mindre$/i, '')
            .replace(/See less$/i, '')
            .replace(/Show less$/i, '')
            .trim();
        
        if (!description || description.length < 20) {
            const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
            if (ogDesc && !ogDesc.includes('Facebook')) description = ogDesc;
        }

        // 7. Host & Host Image
        let hostName = 'Facebook';
        let hostImage = '';
        let hostUrl: string | null = null;
        try {
            const allSpans = Array.from(main.querySelectorAll('span, div, a'));
            const hostTriggerEl = allSpans.find(el => {
                const txt = el.textContent?.trim() || '';
                return txt.match(/evenemang av|event by|hosted by|träffa värden|arrangeras av/i) && txt.length < 30;
            });

            if (hostTriggerEl) {
                let container = hostTriggerEl.parentElement;
                let link = container?.querySelector('a');
                if (!link && container?.parentElement) link = container.parentElement.querySelector('a');

                if (link && link.textContent && link.textContent.length > 2 && !['om', 'diskussion', 'fler'].includes(link.textContent.toLowerCase())) {
                    hostName = link.textContent.trim();
                    hostUrl = link.href;
                    const img = link.querySelector('img') || link.parentElement?.querySelector('img');
                    if (img) hostImage = img.src;
                } else {
                    let txt = hostTriggerEl.textContent || '';
                    txt = txt.replace(/evenemang av|event by|hosted by|träffa värden|arrangeras av/i, '').trim();
                    if (txt.length > 2) hostName = txt;
                }
            }

            if (hostName === 'Facebook' || hostName.toLowerCase() === 'om') {
                const potentialLinks = Array.from(main.querySelectorAll('a'))
                    .filter(a => (a.href.includes('/groups/') || a.href.includes('/pages/') || a.href.includes('/user/')) && 
                                 !a.href.includes('/events/') && a.textContent && a.textContent.length > 2 &&
                                 !['om', 'diskussion', 'fler', 'visa alla', 'se mer'].includes(a.textContent.toLowerCase()));
                if (potentialLinks.length > 0) {
                    hostName = potentialLinks[0].textContent?.trim() || 'Facebook';
                    hostUrl = potentialLinks[0].href;
                    const img = potentialLinks[0].parentElement?.querySelector('img') || potentialLinks[0].querySelector('img');
                    if (img) hostImage = img.src;
                }
            }
        } catch(e) {}

        const isGenericImage = image.includes('facebook.com/images/') || image.includes('fbcdn.net/rsrc.php') || !image;
        if (isGenericImage && hostImage) image = hostImage;

        // Extrahera Location URL
        let locationUrl: string | null = null;
        try {
            const mapLink = Array.from(main.querySelectorAll('a')).find(a => 
                a.href.includes('google.com/maps') || a.href.includes('maps.google') || a.href.includes('dir') || a.href.includes('/places/') || a.href.includes('/locations/')
            );
            if (mapLink) locationUrl = mapLink.href;
        } catch(e) {}

        const ogDescription = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
        return { title, image, going, description, locationName, exactTime, isoDate, textContent, hostName, hostUrl, locationUrl, ogDescription };
    });
}
