/**
 * Axiell Arena tenant-discovery: customerId server-injiceras i Liferay-portleten
 * och syns bara i browserns anrop till api.axiell.com/.../customers/<24hex>/search.
 */
const fs = require('fs');
const puppeteer = require('/Users/ai/Repos/VADKUL/node_modules/puppeteer');

async function discover(browser, cand) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  let cid = null;
  page.on('request', (r) => {
    const m = r.url().match(/api\.axiell\.com\/[^\s]*customers\/([0-9a-f]{24})/);
    if (m) cid = m[1];
  });
  try {
    await page.goto(cand.finalUrl || cand.url, { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise(r => setTimeout(r, 4000));
  } catch { }
  await page.close().catch(() => { });
  return cid;
}

(async () => {
  const cands = JSON.parse(fs.readFileSync('lib-candidates.json', 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const out = [];
  for (const c of cands) {
    const cid = c.cid || await discover(browser, c);
    out.push({ ...c, cid });
    console.log((cid || 'ingen').padEnd(26), c.kommun.padEnd(15), (c.finalUrl || c.url).slice(0, 60));
  }
  await browser.close();
  fs.writeFileSync('axiell-tenants.json', JSON.stringify(out, null, 1));
  console.log('\nmed customerId:', out.filter(o => o.cid).length, '/', out.length);
})();
