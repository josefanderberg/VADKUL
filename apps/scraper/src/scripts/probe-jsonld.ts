/**
 * Dev-tool: kolla om en URL har JSON-LD events efter JS-rendering.
 *
 * Användning:
 *   npx ts-node src/scripts/probe-jsonld.ts <url> [url2] [url3]
 */
import puppeteer from 'puppeteer';

async function probe(url: string) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise((r) => setTimeout(r, 2500));
        const stats = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            let events = 0;
            const samples: string[] = [];
            for (const s of scripts) {
                try {
                    const d = JSON.parse(s.textContent || '');
                    const walk = (n: any): void => {
                        if (!n) return;
                        if (Array.isArray(n)) { n.forEach(walk); return; }
                        if (typeof n !== 'object') return;
                        if (Array.isArray(n['@graph'])) walk(n['@graph']);
                        if (Array.isArray(n.itemListElement)) {
                            n.itemListElement.forEach((li: any) => walk(li?.item ?? li));
                        }
                        const t = n['@type'];
                        const types = Array.isArray(t) ? t : [t];
                        if (types.some((x: any) => typeof x === 'string' && /Event/i.test(x))) {
                            events++;
                            if (n.name && samples.length < 3) samples.push(String(n.name));
                        }
                    };
                    walk(d);
                } catch {}
            }
            return { blocks: scripts.length, events, samples };
        });
        console.log(`  ${url}\n    blocks=${stats.blocks}  events=${stats.events}`);
        stats.samples.forEach((s) => console.log(`    → ${s}`));
    } catch (e) {
        console.log(`  ${url}\n    ERROR: ${(e as Error).message}`);
    } finally {
        await page.close();
        await browser.close();
    }
}

(async () => {
    const urls = process.argv.slice(2);
    if (urls.length === 0) {
        console.error('Usage: ts-node probe-jsonld.ts <url> [url2] ...');
        process.exit(1);
    }
    for (const u of urls) await probe(u);
})();
