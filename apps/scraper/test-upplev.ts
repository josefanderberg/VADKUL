import puppeteer from 'puppeteer';

async function testUpplevVaxjo() {
    console.log("Fetching HTML snippet from upplev.vaxjo.se...");
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://upplev.vaxjo.se/evenemang', { waitUntil: 'networkidle2' });

        const htmlSnippet = await page.evaluate(() => {
            // Find event cards or list items
            const elements = document.querySelectorAll('.event-list-item, .event, .card, article, li.item');
            if (elements.length > 0) {
                return Array.from(elements).slice(0, 2).map(el => el.outerHTML);
            }
            // Fallback
            return document.body.innerHTML.substring(0, 3000);
        });

        console.log("Snippet length:", htmlSnippet.length);
        console.log("Snippet:\n", htmlSnippet[0] ? htmlSnippet[0].substring(0, 1500) : htmlSnippet);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testUpplevVaxjo();
