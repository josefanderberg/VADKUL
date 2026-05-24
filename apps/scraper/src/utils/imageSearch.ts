import type { Page } from 'puppeteer';

/**
 * Söker bilden för en given titel på Google Images via puppeteer.
 * Returnerar URL till första rimliga bilden eller null.
 *
 * Notera: Sidan navigerar bort från sin nuvarande URL. Anroparen bör göra
 * Google-sökningen efter att den är klar med all annan extrahering från
 * den ursprungliga sidan.
 */
export async function searchGoogleImage(page: Page, query: string): Promise<string | null> {
    const trimmed = query?.trim();
    if (!trimmed) return null;

    try {
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}&tbm=isch&hl=sv&safe=active`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });

        // Acceptera cookies om dialogen dyker upp
        await page.evaluate(() => {
            const candidates = Array.from(document.querySelectorAll('button, div[role="button"]'));
            for (const btn of candidates) {
                const txt = btn.textContent?.trim().toLowerCase() || '';
                if (
                    txt.includes('godkänn alla') ||
                    txt.includes('accept all') ||
                    txt.includes('jag godkänner') ||
                    txt.includes('i agree') ||
                    txt === 'godkänn'
                ) {
                    (btn as HTMLElement).click();
                    return;
                }
            }
        }).catch(() => {});

        await new Promise(r => setTimeout(r, 1500));

        const imageUrl = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
            for (const img of imgs) {
                const src = img.src || img.getAttribute('data-src') || '';
                if (!src) continue;
                if (src.startsWith('data:')) continue;
                if (src.includes('google.com/images/')) continue;
                if (src.includes('gstatic.com/images')) continue;
                if (src.includes('/branding/')) continue;
                if (img.naturalWidth < 100 || img.naturalHeight < 100) continue;
                return src;
            }
            return null;
        });

        return imageUrl || null;
    } catch (e) {
        console.log(`    ⚠️ Google bildsökning misslyckades för "${trimmed}":`, (e as Error).message);
        return null;
    }
}
