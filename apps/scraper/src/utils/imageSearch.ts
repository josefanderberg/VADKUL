import type { Page } from 'puppeteer';

/**
 * Söker bild för en given titel via DuckDuckGo Images.
 * Returnerar URL till första rimliga bilden eller null.
 *
 * Notera: Sidan navigerar bort från sin nuvarande URL. Anroparen bör göra
 * sökningen efter att den är klar med all annan extrahering från ursprungssidan.
 */
export async function searchGoogleImage(page: Page, query: string): Promise<string | null> {
    const trimmed = query?.trim();
    if (!trimmed) return null;

    try {
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(trimmed + ' Sverige')}&ia=images&iax=images`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const imageUrl = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img[src]')) as HTMLImageElement[];
            for (const img of imgs) {
                const src = img.getAttribute('src') || '';
                if (!src) continue;
                // DuckDuckGo proxy images look like: //external-content.duckduckgo.com/iu/?u=...
                // Skip favicon proxy (/ip3/) — only keep image proxy (/iu/)
                if (!src.includes('duckduckgo.com/iu/')) continue;
                // Add https: if protocol-relative
                return src.startsWith('//') ? 'https:' + src : src;
            }
            return null;
        });

        return imageUrl || null;
    } catch (e) {
        console.log(`    ⚠️ Bildsökning misslyckades för "${trimmed}":`, (e as Error).message);
        return null;
    }
}
