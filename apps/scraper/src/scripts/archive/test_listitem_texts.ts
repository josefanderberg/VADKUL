import puppeteer from 'puppeteer';

async function testListItemTexts() {
    const urls = [
        'https://www.facebook.com/events/1225858889756059/', // Blodomloppet (Linneparken)
        'https://www.facebook.com/events/901130499491142/',  // Skivmässa (IOGT Vattentorget)
        'https://www.facebook.com/events/3247529935457243/', // Sommarturné (Linneparken)
        'https://www.facebook.com/events/1901632180740220/', // Palladium
        'https://www.facebook.com/events/2137893733648914/'  // Linedance (Rådjursvägen 2A)
    ];

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    try {
        for (const url of urls) {
            console.log(`\n==========================================`);
            console.log(`Navigating to: ${url}`);
            await page.goto(url, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 4000));

            // Dismiss cookies
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                for (const btn of buttons) {
                    const txt = btn.textContent?.trim().toLowerCase() || '';
                    if (txt.includes('tillåt') || txt.includes('allow') || txt.includes('neka') || txt.includes('decline')) {
                        (btn as HTMLElement).click();
                    }
                }
            });
            await new Promise(r => setTimeout(r, 1000));

            const texts = await page.evaluate(() => {
                const svgs = Array.from(document.querySelectorAll('svg'));
                const locationSvg = svgs.find(svg => {
                    const paths = Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d') || '');
                    return paths.some(d => 
                        d.startsWith('M10 .5') || 
                        d.startsWith('M10 0') || 
                        d.includes('M10 .5A7.5') || 
                        d.includes('M10 0a7.5')
                    );
                });

                if (!locationSvg) {
                    return { success: false, reason: 'Location pin SVG not found' };
                }

                // Climb to the closest role="listitem"
                // Let's trace parents until we find role="listitem" or go up 15 levels
                let listitem: HTMLElement | null = null;
                let curr: HTMLElement | null = locationSvg as any;
                for (let i = 0; i < 15; i++) {
                    if (curr) {
                        if (curr.getAttribute('role') === 'listitem') {
                            listitem = curr;
                            break;
                        }
                        curr = curr.parentElement;
                    }
                }

                if (!listitem) {
                    return { success: false, reason: 'role="listitem" ancestor not found' };
                }

                // Let's extract all element nodes that contain text within this listitem
                // Sibling 1 is the main clickable button/text container
                // Sibling 2 is the secondary container underneath
                const children = Array.from(listitem.children);
                
                // Let's find all leaf text nodes recursively
                const parts: string[] = [];
                const walk = (el: Element) => {
                    const hasChildElements = el.children.length > 0;
                    const txt = el.textContent?.trim() || '';
                    
                    if (txt.length > 0) {
                        if (!hasChildElements) {
                            parts.push(txt);
                        } else {
                            for (let i = 0; i < el.children.length; i++) {
                                walk(el.children[i]);
                            }
                        }
                    }
                };

                walk(listitem);

                // Let's also find all direct child text groupings or roles inside listitem
                const detailedParts: any[] = [];
                const findTextGroups = (el: Element, depth = 0) => {
                    const text = el.textContent?.trim() || '';
                    if (text.length === 0) return;
                    
                    const role = el.getAttribute('role') || '';
                    const tag = el.tagName.toLowerCase();
                    const hasChild = el.children.length > 0;

                    // If it is a distinct button, link, or text group
                    if (role === 'button' || tag === 'a' || (!hasChild && text.length > 0)) {
                        detailedParts.push({
                            tag,
                            role,
                            text,
                            depth
                        });
                    } else {
                        for (let i = 0; i < el.children.length; i++) {
                            findTextGroups(el.children[i], depth + 1);
                        }
                    }
                };

                findTextGroups(listitem);

                return {
                    success: true,
                    outerHTMLPreview: listitem.outerHTML.slice(0, 500),
                    textContent: listitem.textContent?.trim(),
                    leafParts: parts,
                    detailedParts
                };
            });

            console.log('Listitem texts:', JSON.stringify(texts, null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await browser.close();
    }
}

testListItemTexts();
