/**
 * Dev-tool: logga ALLA requests/responses från en sida för att förstå hur en SPA är byggd.
 *
 * Användning:
 *   npx ts-node src/scripts/probe-xhr.ts <url>
 */
import puppeteer from 'puppeteer';

async function main() {
    const url = process.argv[2];
    if (!url) { console.error('Usage: probe-xhr.ts <url>'); process.exit(1); }

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/124 Safari/537.36');

    const requests: { url: string; status?: number; ct?: string; size?: number }[] = [];
    page.on('request', (req) => {
        requests.push({ url: req.url() });
    });
    page.on('response', async (resp) => {
        const url = resp.url();
        const ct = resp.headers()['content-type'] || '';
        const found = requests.find((r) => r.url === url && !r.status);
        if (found) {
            found.status = resp.status();
            found.ct = ct;
            try { found.size = (await resp.text()).length; } catch {}
        }
    });

    console.log(`Navigerar: ${url}`);
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (e) {
        console.error('goto failed:', (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Scrolla för lazy load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 2000));

    await browser.close();

    console.log(`\nTotalt ${requests.length} requests:\n`);
    // Sortera efter content-type — JSON högst
    const interesting = requests
        .filter((r) => r.status && r.status < 400)
        .filter((r) => {
            const ct = r.ct || '';
            const path = r.url.split('?')[0];
            // Skippa uppenbart icke-data
            if (ct.startsWith('text/html') && r.status === 200 && r.url === url) return true;
            if (ct.startsWith('image/') || ct.startsWith('font/') || ct.startsWith('video/')) return false;
            if (/\.(png|jpg|jpeg|svg|gif|webp|woff|woff2|css|ico)$/i.test(path)) return false;
            return true;
        });

    for (const r of interesting) {
        const ctShort = (r.ct || '').split(';')[0].padEnd(28);
        console.log(`  ${String(r.status).padStart(3)}  ${ctShort}  ${String(r.size || 0).padStart(7)}b  ${r.url}`);
    }
    console.log(`\nFiltrerade fram ${interesting.length} icke-statiska requests.`);
}

main();
