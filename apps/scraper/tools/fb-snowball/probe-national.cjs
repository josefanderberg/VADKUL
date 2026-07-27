// Probar snöbollens sid-slugs: finns /events-fliken och syns eventlänkar?
// Input: host-snowball.json → Output: fb-page-probe-national.json
const path = require('path');
const fs = require('fs');
const REPO = require('path').resolve(__dirname, '../../../..');
const puppeteer = require(path.join(REPO, 'node_modules', 'puppeteer'));
const SC = require('path').join(__dirname, 'out');
require('fs').mkdirSync(SC, { recursive: true });

const snow = JSON.parse(fs.readFileSync(`${SC}/host-snowball.json`, 'utf8'));
const seen = new Set();
const cands = [];
for (const r of snow) {
    if (!r.slug || seen.has(r.slug)) continue;
    seen.add(r.slug);
    cands.push({ slug: r.slug, host: r.host, n: r.n, addrs: r.addrs || '' });
}
console.log('kandidat-slugs:', cands.length);

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const results = [];
    const queue = [...cands];

    async function worker() {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        while (queue.length) {
            const c = queue.shift();
            try {
                await page.goto(`https://www.facebook.com/${c.slug}/events`, { waitUntil: 'networkidle2', timeout: 45000 });
                await new Promise((r) => setTimeout(r, 2000));
                const info = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href*="/events/"]'))
                        .map((a) => (a.href.match(/\/events\/(?:[a-zA-Z0-9_-]+\/)*(\d{10,})/) || [])[1])
                        .filter(Boolean);
                    const h1 = document.querySelector('h1');
                    return {
                        nEvents: new Set(links).size,
                        pageName: h1 ? h1.textContent.trim().slice(0, 60) : null,
                        unavailable: /inte tillgängligt just nu|content isn't available/i.test(document.body.innerText),
                    };
                });
                results.push({ ...c, ...info });
                console.log(`${c.slug} → ${info.unavailable ? 'FINNS EJ' : info.nEvents + ' event'} (${c.host})`);
            } catch (e) {
                results.push({ ...c, error: e.message.slice(0, 50) });
            }
            if (results.length % 20 === 0) fs.writeFileSync(`${SC}/fb-page-probe-national.json`, JSON.stringify(results, null, 1));
        }
        await page.close();
    }

    await Promise.all([worker(), worker(), worker()]);
    fs.writeFileSync(`${SC}/fb-page-probe-national.json`, JSON.stringify(results, null, 1));
    console.log('KLART:', results.filter((r) => !r.unavailable && !r.error && r.nEvents > 0).length, 'sidor med event');
    await browser.close();
})();
