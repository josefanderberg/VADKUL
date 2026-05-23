import { Page } from 'puppeteer';

/**
 * Applies date filters (Today/Tomorrow) on the Facebook search page.
 */
export async function applyDateFilters(page: Page, filters: string[]) {
    for (const filterName of filters) {
        console.log(`    🖱️ Klickar i filter: "${filterName}"...`);
        await page.evaluate(async (fName) => {
            const findAndClick = (possibleTexts: string[]) => {
                const elements = Array.from(document.querySelectorAll('span, div')).filter(el => {
                    const txt = el.textContent?.trim().toLowerCase() || '';
                    return possibleTexts.some(t => t.toLowerCase() === txt) && el.children.length === 0;
                });
                for (const el of elements) {
                    const clickable = el.closest('div[role="checkbox"], div[role="radio"], div[role="switch"], div[role="button"], label, div[tabindex="0"]');
                    if (clickable) {
                        (clickable as HTMLElement).click();
                        return true;
                    }
                }
                return false;
            };

            const tomorrowNames = ['i morgon', 'imorgon', 'tomorrow'];
            const todayNames = ['idag', 'i dag', 'today'];
            const targetNames = fName.includes('morgon') ? tomorrowNames : todayNames;

            const hasFilter = Array.from(document.querySelectorAll('span, div')).some(el => {
                const txt = el.textContent?.trim().toLowerCase() || '';
                return targetNames.includes(txt) && el.children.length === 0;
            });

            if (!hasFilter) {
                findAndClick(['Datum', 'Date']);
                await new Promise(r => setTimeout(r, 1000));
            }

            const elements = Array.from(document.querySelectorAll('span, div')).filter(el => {
                const txt = el.textContent?.trim().toLowerCase() || '';
                return targetNames.includes(txt) && el.children.length === 0;
            });

            for (const el of elements) {
                const clickable = el.closest('div[role="checkbox"], div[role="radio"], div[role="switch"], div[role="button"], label, div[tabindex="0"]');
                if (clickable) {
                    const isChecked = clickable.getAttribute('aria-checked') === 'true' || clickable.getAttribute('aria-selected') === 'true';
                    if (!isChecked) {
                        (clickable as HTMLElement).click();
                    }
                }
            }
        }, filterName);
        await new Promise(r => setTimeout(r, 1500));
    }
}

export async function discoverEventUrls(page: Page): Promise<{ url: string, day: string }[]> {
    console.log(`    ⬇️ Scrollar ner för att ladda fler event...`);
    let lastHeight = 0;
    for (let i = 0; i < 10; i++) {
        try {
            const currentHeight = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
                for (const btn of buttons) {
                    if (btn.textContent?.match(/Se mer|See More|Visa fler/i) && !btn.textContent?.match(/Tidigare/i)) {
                        (btn as HTMLElement).click();
                    }
                }
                window.scrollTo(0, document.body.scrollHeight);
                return document.body.scrollHeight;
            });

            // Om höjden inte har ändrats på två försök, anta att vi är klara
            if (currentHeight === lastHeight) {
                break;
            }
            lastHeight = currentHeight;
        } catch (e) {
            console.log(`      ⚠️ Scroll-försök ${i + 1} misslyckades (t.ex. pga sidomladdning/detached frame), väntar och försöker igen...`);
            await new Promise(r => setTimeout(r, 2000));
            lastHeight = 0; // Tvinga re-evaluation
        }
        await new Promise(r => setTimeout(r, 1500));
    }

    for (let retry = 0; retry < 3; retry++) {
        try {
            return await page.evaluate(() => {
                const results: { url: string, day: string }[] = [];
                const foundUrls = new Set<string>();
                
                const links = Array.from(document.querySelectorAll('a[href*="/events/"]'));
                
                for (const el of links) {
                    const href = (el as HTMLAnchorElement).href;
                    const match = href.match(/\/events\/(?:[a-zA-Z0-9_-]+\/)*(\d{10,})/);
                    if (match) {
                        const eventUrl = `https://www.facebook.com/events/${match[1]}/`;
                        if (foundUrls.has(eventUrl)) continue;

                        const card = el.closest('div[role="article"]') || el.parentElement?.parentElement?.parentElement;
                        const cardText = card?.textContent?.toLowerCase() || el.textContent?.toLowerCase() || '';
                        
                        let day = 'idag';
                        if (cardText.includes('i morgon') || cardText.includes('imorgon') || cardText.includes('tomorrow')) {
                            day = 'i morgon';
                        } else if (cardText.includes('idag') || cardText.includes('i dag') || cardText.includes('today')) {
                            day = 'idag';
                        }
                        
                        results.push({ url: eventUrl, day });
                        foundUrls.add(eventUrl);
                    }
                }
                return results;
            });
        } catch (e) {
            console.log(`      ⚠️ Länkhämtning misslyckades, försöker igen (${retry + 1}/3)...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return [];
}
