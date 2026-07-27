// Snöboll: en eventsida per återkommande FB-arrangör (≥2 event sedan 1 juli)
// → arrangörens sid-slug + relaterade event-länkar. Output: host-snowball.json
const path = require('path');
const fs = require('fs');
const REPO = require('path').resolve(__dirname, '../../../..');
const puppeteer = require(path.join(REPO, 'node_modules', 'puppeteer'));
const Database = require(path.join(REPO, 'node_modules', 'better-sqlite3'));

const SC = require('path').join(__dirname, 'out');
require('fs').mkdirSync(SC, { recursive: true });

const db = new Database(path.join(REPO, 'apps/scraper/events.db'), { readonly: true });
const hosts = db.prepare(`
    SELECT hostName, COUNT(*) c, MAX(url) sampleUrl,
           GROUP_CONCAT(COALESCE(extractedAddress, locationName), ' | ') addrs
    FROM link_events
    WHERE url LIKE '%facebook.com%' AND createdAt >= datetime('now','-30 day')
      AND hostName != '' AND hostName != 'Facebook'
    GROUP BY hostName HAVING c >= 2
    ORDER BY c DESC
`).all();
console.log('arrangörer att besöka:', hosts.length);

const norm = (s) => (s || '').toLowerCase().replace(/[^a-zåäö0-9]/g, '');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const results = [];
    const queue = [...hosts];

    async function worker() {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        while (queue.length) {
            const h = queue.shift();
            try {
                await page.goto(h.sampleUrl, { waitUntil: 'networkidle2', timeout: 45000 });
                await new Promise((r) => setTimeout(r, 2000));
                const info = await page.evaluate(() => {
                    const pageLinks = [];
                    for (const a of document.querySelectorAll('a[href*="facebook.com/"]')) {
                        const m = a.href.match(/facebook\.com\/([A-Za-z0-9.%-]+)\/?(?:\?|$)/);
                        if (!m) continue;
                        const slug = m[1];
                        if (/^(events|help|login|policies|privacy|watch|groups|reel|share|sharer|people|profile\.php|photo|pages|hashtag|stories|business|legal|marketplace|gaming|about)$/i.test(slug)) continue;
                        pageLinks.push({ slug, text: (a.textContent || '').trim().slice(0, 80) });
                    }
                    const related = [...new Set(
                        Array.from(document.querySelectorAll('a[href*="/events/"]'))
                            .map((a) => (a.href.match(/\/events\/(?:[a-zA-Z0-9_-]+\/)*(\d{10,})/) || [])[1])
                            .filter(Boolean),
                    )];
                    return { pageLinks, related };
                });
                // Välj sidlänk vars länktext liknar hostName; annars vanligaste slug
                const nh = (h.hostName || '').toLowerCase().replace(/[^a-zåäö0-9]/g, '');
                let slug = null;
                for (const pl of info.pageLinks) {
                    const nt = (pl.text || '').toLowerCase().replace(/[^a-zåäö0-9]/g, '');
                    if (nt && nh && (nt.includes(nh) || nh.includes(nt)) && nt.length >= 3) { slug = pl.slug; break; }
                }
                if (!slug) {
                    const freq = {};
                    info.pageLinks.forEach((p) => { freq[p.slug] = (freq[p.slug] || 0) + 1; });
                    slug = (Object.entries(freq).sort((a, b) => b[1] - a[1])[0] || [])[0] || null;
                }
                results.push({ host: h.hostName, n: h.c, slug, related: info.related, addrs: (h.addrs || '').slice(0, 300) });
                console.log(`${h.hostName} (${h.c} ev) → ${slug || 'INGEN SLUG'} | +${info.related.length} relaterade`);
            } catch (e) {
                results.push({ host: h.hostName, n: h.c, error: e.message.slice(0, 50) });
                console.log(h.hostName, '→ FEL', e.message.slice(0, 50));
            }
            if (results.length % 20 === 0) fs.writeFileSync(`${SC}/host-snowball.json`, JSON.stringify(results, null, 1));
        }
        await page.close();
    }

    await Promise.all([worker(), worker(), worker()]);
    fs.writeFileSync(`${SC}/host-snowball.json`, JSON.stringify(results, null, 1));
    const withSlug = results.filter((r) => r.slug);
    const allRelated = new Set(results.flatMap((r) => r.related || []));
    console.log(`KLART: ${withSlug.length}/${results.length} med slug, ${allRelated.size} unika relaterade event`);
    await browser.close();
})();
