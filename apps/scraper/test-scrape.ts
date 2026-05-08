import puppeteer from 'puppeteer';

async function test() {
    console.log("Starting Puppeteer test to dump HTML snippet...");
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://vaxjoco.se/evenemangssida/kommande-evenemang/', { waitUntil: 'networkidle2' });

        const htmlSnippet = await page.evaluate(() => {
            const figures = document.querySelectorAll('figure.zoom-puff');
            if (figures.length > 0) {
                // Return the parent a tag if exists
                const a = figures[0].closest('a');
                return a ? a.outerHTML : figures[0].outerHTML;
            }
            return "No figure.zoom-puff found";
        });

        console.log("HTML Snippet:\n", htmlSnippet);
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

test();
