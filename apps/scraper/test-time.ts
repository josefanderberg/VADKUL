import puppeteer from 'puppeteer';

async function testScrape() {
    const browser = await puppeteer.launch({ headless: true });

    // Test Upplev Växjö
    const page1 = await browser.newPage();
    await page1.goto('https://upplev.vaxjo.se/evenemang', { waitUntil: 'networkidle2' });
    const upplevLink = await page1.evaluate(() => {
        const a = document.querySelector('article.uv-page-list-item__wrapper').closest('a');
        return a ? a.href : null;
    });

    if (upplevLink) {
        console.log('Testing Upplev link:', upplevLink);
        await page1.goto(upplevLink, { waitUntil: 'domcontentloaded' });
        const data = await page1.evaluate(() => {
            let jsonLd = null;
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of scripts) {
                try {
                    const d = JSON.parse(s.textContent);
                    if (d['@type'] === 'Event' || (d['@graph'] && d['@graph'].find(x => x['@type'] === 'Event'))) {
                        jsonLd = d;
                    }
                } catch (e) { }
            }
            const text = document.querySelector('main')?.textContent || '';
            const match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
            return { jsonLd, timeMatch: match ? match[0] : null };
        });
        console.log('Upplev Data:', JSON.stringify(data, null, 2));
    }

    // Test VaxjoCo
    const page2 = await browser.newPage();
    await page2.goto('https://vaxjoco.se/evenemangssida/kommande-evenemang/', { waitUntil: 'networkidle2' });
    const vaxjoLink = await page2.evaluate(() => {
        const a = document.querySelector('a figure.zoom-puff')?.closest('a');
        return a ? a.href : null;
    });

    if (vaxjoLink) {
        console.log('Testing VaxjoCo link:', vaxjoLink);
        await page2.goto(vaxjoLink, { waitUntil: 'domcontentloaded' });
        const data = await page2.evaluate(() => {
            let jsonLd = null;
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of scripts) {
                try {
                    const d = JSON.parse(s.textContent);
                    if (d['@type'] === 'Event' || (d['@graph'] && d['@graph'].find(x => x['@type'] === 'Event'))) {
                        jsonLd = d;
                    }
                } catch (e) { }
            }
            const text = document.querySelector('.event-content, article, main, .tribe-events-single')?.textContent || '';
            const match = text.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
            const timeEl = document.querySelector('.tribe-events-schedule, .event-time, .time');
            return {
                jsonLd,
                timeMatch: match ? match[0] : null,
                timeElText: timeEl ? timeEl.textContent.trim() : null
            };
        });
        console.log('VaxjoCo Data:', JSON.stringify(data, null, 2));
    }

    await browser.close();
}

testScrape().catch(console.error);
