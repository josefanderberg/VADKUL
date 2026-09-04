/**
 * Batch-scout: laddar varje kommuns kalendersida i puppeteer, fångar alla
 * JSON/XML-svar och rankar dem på event-innehåll. Skördar samtidigt EXTERNA
 * domäner sidan länkar till (Övertorneå-mönstret: separat eventdomän).
 */
const fs = require('fs');
const puppeteer = require('/Users/ai/Repos/VADKUL/node_modules/puppeteer');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const STATIC = /javascript|text\/css|image\/|font|\.woff|\.svg|\.png|\.jpe?g|\.gif|\.webp|manifest|piwik|gtm|googletag|google-analytics|hotjar|cookiebot|consent|matomo|siteimprove|recaptcha/i;
const HINT = /startDate|start_date|"events"|"hits"|"items"|"results"|evenemang|kalend|occasion|eventDate|"date"/i;
const DATEISH = /\b20\d{2}-\d{2}-\d{2}\b/g;

function scoreBody(url, body) {
  let s = 0;
  if (HINT.test(body)) s += 10;
  const dates = (body.match(DATEISH) || []).length;
  s += Math.min(dates, 60);
  if (/\/api\/|\/rest-api\/|\/wp-json\/|appresource|graphql|search/i.test(url)) s += 8;
  if (body.length > 2000) s += 4;
  return s;
}

async function scout(browser, task) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  const caps = [];
  page.on('response', async (res) => {
    try {
      const ct = res.headers()['content-type'] || '';
      const u = res.url();
      if (STATIC.test(ct + ' ' + u)) return;
      if (!/json|xml/i.test(ct)) return;
      let body = ''; try { body = await res.text(); } catch { return; }
      if (body.length < 150) return;
      caps.push({ url: u, status: res.status(), len: body.length, score: scoreBody(u, body), prefix: body.slice(0, 180).replace(/\s+/g, ' ') });
    } catch { }
  });

  let externals = [], rendered = 0;
  try {
    await page.goto(task.url, { waitUntil: 'networkidle2', timeout: 45000 });
    // trycka på "visa fler"/kalender-flikar som lat-laddar
    await page.evaluate(() => {
      const re = /visa fler|ladda fler|fler evenemang|kalender|evenemang|se alla/i;
      const els = [...document.querySelectorAll('button, a[role="tab"], [class*="tab"], [class*="more"], [class*="load"]')];
      for (const e of els.slice(0, 40)) if (re.test(e.textContent || '')) { try { e.click(); } catch { } }
    }).catch(() => { });
    await new Promise(r => setTimeout(r, 6000));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => { });
    await new Promise(r => setTimeout(r, 3000));

    const res = await page.evaluate((rootDom) => {
      const out = { ext: [], dates: 0 };
      const seen = new Set();
      for (const a of document.querySelectorAll('a[href^="http"]')) {
        let h; try { h = new URL(a.href).hostname.replace(/^www\./, ''); } catch { continue; }
        if (h.endsWith(rootDom)) continue;
        if (/facebook|instagram|youtube|twitter|linkedin|x\.com|google|1177|krisinformation|regeringen|skatteverket|polisen|riksdagen|arbetsformedlingen|forsakringskassan|msb\.se|adobe|w3\.org/i.test(h)) continue;
        const txt = (a.textContent || '').trim().slice(0, 40);
        const key = h;
        if (seen.has(key)) continue; seen.add(key);
        out.ext.push({ host: h, text: txt });
      }
      const t = (document.body.innerText || '');
      out.dates = (t.match(/\b\d{1,2} (januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/gi) || []).length;
      return out;
    }, task.rootDom).catch(() => ({ ext: [], dates: 0 }));
    externals = res.ext; rendered = res.dates;
  } catch (e) { /* tyst */ }
  await page.close().catch(() => { });

  caps.sort((a, b) => b.score - a.score);
  return { ...task, renderedDates: rendered, top: caps.slice(0, 5), externals: externals.slice(0, 25) };
}

(async () => {
  const tasks = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      const r = await scout(browser, t).catch(() => ({ ...t, top: [], externals: [], err: 1 }));
      out.push(r);
      const best = r.top[0];
      console.log(`${r.name.padEnd(16)} dat=${String(r.renderedDates || 0).padStart(3)} ${best ? 'API:' + String(best.score).padStart(3) + ' ' + best.url.slice(0, 78) : '—'}`);
      if (r.externals.length) console.log('    ext: ' + r.externals.map(e => e.host).slice(0, 8).join(' '));
    }
  }));
  await browser.close();
  fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
  console.log('\nklart:', out.length);
})();
