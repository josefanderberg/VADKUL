import puppeteer from 'puppeteer';

async function fetchLakersPuppeteer() {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://www.vaxjolakers.se/spelschema', { waitUntil: 'networkidle2' });

        const events = await page.evaluate(() => {
            const results: any[] = [];
            // VLH scheduler cards are usually in article tags or div with class containing game/match
            const cards = document.querySelectorAll('article, .game, .match, .vlh-match');
            cards.forEach(card => {
                const text = card.textContent?.replace(/\s+/g, ' ').trim() || '';
                // basic heuristic to find team names vs team names
                if (text.includes('-') && (text.includes('Växjö Lakers') || text.includes('VLH'))) {
                    results.push(text.substring(0, 150));
                }
            });
            return results;
        });

        console.log(`Found ${events.length} match elements from DOM:`);
        console.log(events.slice(0, 5));

    } catch (e) {

        console.error(e);
    } finally {
        await browser.close();
    }
}
fetchLakersPuppeteer();
