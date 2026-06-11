import puppeteer from 'puppeteer';

async function checkEventDate() {
    const url = 'https://www.facebook.com/events/1264635285191764/';
    console.log(`Checking date meta tags on: ${url}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 4000));

        // Accept cookies
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
            for (const btn of buttons) {
                const txt = btn.textContent?.trim().toLowerCase() || '';
                if (txt.includes('tillåt') || txt.includes('allow') || txt.includes('neka') || txt.includes('decline')) {
                    (btn as HTMLElement).click();
                }
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        const metaTags = await page.evaluate(() => {
            const metas = Array.from(document.querySelectorAll('meta'));
            return metas.map(m => {
                return {
                    property: m.getAttribute('property') || m.getAttribute('name') || '',
                    content: m.getAttribute('content') || ''
                };
            }).filter(m => m.property.includes('time') || m.property.includes('date') || m.property.includes('og:'));
        });

        const scriptDates = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            return scripts.map(s => s.textContent);
        });

        const textContent = await page.evaluate(() => {
            return document.body.innerText.slice(0, 1000);
        });

        console.log('Meta Tags found:', JSON.stringify(metaTags, null, 2));
        console.log('JSON-LD scripts found:', JSON.stringify(scriptDates, null, 2));
        console.log('Text content start:\n', textContent);

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

checkEventDate();
