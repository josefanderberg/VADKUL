import puppeteer from 'puppeteer';

async function testDeep() {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto('https://vaxjoco.se/evenemangssida/kommande-evenemang/', { waitUntil: 'networkidle2' });

        // get first link
        const firstLink = await page.evaluate(() => {
            return (document.querySelector('.facetwp-template a') as HTMLAnchorElement)?.href;
        });

        if (firstLink) {
            console.log("Navigating to", firstLink);
            await page.goto(firstLink, { waitUntil: 'networkidle2' });

            const data = await page.evaluate(() => {
                const text = document.body.innerText;
                const priceMatch = text.match(/(pris|entré|biljett).*?(\d+.*?(kr|sek)|gratis|fri entré)/i);
                return {
                    textSnippet: text.substring(0, 500),
                    priceInfo: priceMatch ? priceMatch[0] : 'No price found via simple regex',
                    timeInfo: document.querySelector('.time, .date, .event-time')?.textContent
                };
            });
            console.log("Deep Data:", data);
        } else {
            console.log("No link found");
        }

    } finally {
        await browser.close();
    }
}
testDeep();
