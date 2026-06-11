import puppeteer from 'puppeteer';

async function testLocationListDetail() {
    const url = 'https://www.facebook.com/events/2137893733648914/';
    console.log(`Navigating to: ${url}`);

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

        const tree = await page.evaluate(() => {
            // Find the list element containing location
            const lists = Array.from(document.querySelectorAll('[role="list"]'));
            const locationList = lists.find(list => {
                const text = list.textContent || '';
                return text.includes('Rådjursvägen') || text.includes('Växjö');
            });

            if (!locationList) {
                return { success: false, reason: 'Location list not found' };
            }

            // Let's extract detailed children inside this role="list"
            const elements: any[] = [];
            const walk = (el: Element, depth = 0) => {
                const text = el.textContent?.trim() || '';
                const role = el.getAttribute('role') || '';
                const tag = el.tagName.toLowerCase();
                const ariaLabel = el.getAttribute('aria-label') || '';
                const childrenCount = el.children.length;

                // Let's collect elements that actually contain text
                if (text.length > 0) {
                    elements.push({
                        depth,
                        tag,
                        role,
                        ariaLabel,
                        className: el.getAttribute('class') || '',
                        text: text.slice(0, 100),
                        childrenCount
                    });
                }

                for (let i = 0; i < el.children.length; i++) {
                    walk(el.children[i], depth + 1);
                }
            };

            walk(locationList);

            return {
                success: true,
                listOuterHTML: locationList.outerHTML.slice(0, 800),
                elements
            };
        });

        console.log('Location List Detail:', JSON.stringify(tree, null, 2));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

testLocationListDetail();
