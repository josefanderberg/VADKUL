import puppeteer from 'puppeteer';

async function findMapAddress() {
    const url = 'https://www.facebook.com/events/2137893733648914/';
    console.log(`Searching for map address on: ${url}`);

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

        const matches = await page.evaluate(() => {
            // Find all elements containing "Rådjursvägen" or "352 45"
            const all = Array.from(document.querySelectorAll('*'));
            const matchedElements = all.filter(el => {
                const txt = el.textContent || '';
                return txt.includes('Rådjursvägen 2A') || txt.includes('352 45');
            });

            // Find leaf matching elements (the ones at the bottom of the match chain)
            const leaves = matchedElements.filter(el => {
                return !Array.from(el.children).some(child => matchedElements.includes(child));
            });

            return leaves.map(el => {
                // Get ancestor trace
                const trace: string[] = [];
                let curr: HTMLElement | null = el as HTMLElement;
                for (let i = 0; i < 8 && curr; i++) {
                    trace.push(`${curr.tagName.toLowerCase()}.${curr.className.replace(/\s+/g, '.')}`);
                    curr = curr.parentElement;
                }
                return {
                    tagName: el.tagName,
                    className: el.className,
                    textContent: el.textContent?.trim(),
                    outerHTMLPreview: el.outerHTML.slice(0, 300),
                    trace: trace.reverse()
                };
            });
        });

        console.log('Match Results:', JSON.stringify(matches, null, 2));

    } catch (err) {
        console.error(err);
    } finally {
        await browser.close();
    }
}

findMapAddress();
