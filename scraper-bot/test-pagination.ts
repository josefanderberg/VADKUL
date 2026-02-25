import puppeteer from 'puppeteer';

async function testPagination() {
    console.log("Checking for 'load more' buttons on Vaxjoco...");
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://vaxjoco.se/evenemangssida/kommande-evenemang/', { waitUntil: 'networkidle2' });

        const loadMoreInfo = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            const loadMoreBtn = buttons.find(b => {
                const text = b.textContent?.toLowerCase() || '';
                return text.includes('ladda') || text.includes('fler') || text.includes('visa mer') || text.includes('load more');
            });

            if (loadMoreBtn) {
                return {
                    found: true,
                    tagName: loadMoreBtn.tagName,
                    className: loadMoreBtn.className,
                    text: loadMoreBtn.textContent?.trim(),
                };
            }
            return { found: false };
        });

        console.log("Load more button info:", loadMoreInfo);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testPagination();
