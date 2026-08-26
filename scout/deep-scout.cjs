/**
 * Djup-scout v2: fler kandidat-URL:er per kommun, längre väntan, klick på
 * kalenderflikar, OCH iframe-trafik. Fångar alla JSON/XML-svar + externa domäner.
 */
const fs = require('fs');
const puppeteer = require('/Users/ai/Repos/VADKUL/node_modules/puppeteer');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const NOISE = /vizzit|readspeaker|cookiebot|cookieinformation|puzzel|rekai|siteimprove|insipio|monsido|usercentrics|onetrust|matomo|hotjar|screen9|google|doubleclick|facebook\.net|recaptcha|translate|consent|newrelic|sentry|bing|clarity/i;
const STATIC = /\.(js|css|png|jpe?g|gif|svg|webp|woff2?|ico|mp4)(\?|$)/i;
const HINT = /startDate|start_date|"events"|"hits"|"items"|"articles"|"results"|evenemang|kalend|occasion|eventDate|"date"|"from"/i;

function score(url, body) {
  let s = 0;
  if (HINT.test(body)) s += 10;
  s += Math.min((body.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || []).length, 60);
  if (/\/api\/|\/rest-api\/|\/wp-json\/|appresource|graphql|route=|\/feed\//i.test(url)) s += 10;
  if (body.length > 3000) s += 5;
  return s;
}

async function scoutPage(browser, url, rootDom) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  const caps = [];
  const onResp = async (res) => {
    try {
      const u = res.url(), ct = res.headers()['content-type'] || '';
      if (NOISE.test(u) || STATIC.test(u)) return;
      if (!/json|xml/i.test(ct)) return;
      let body = ''; try { body = await res.text(); } catch { return; }
      if (body.length < 120) return;
      caps.push({ url: u, len: body.length, score: score(u, body), prefix: body.slice(0, 160).replace(/\s+/g, ' ') });
    } catch { }
  };
  page.on('response', onResp);
  // iframes räknas som samma page i puppeteer:s response-event

  let ext = [], dates = 0, frames = [];
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await new Promise(r => setTimeout(r, 3000));
    // acceptera cookies + öppna kalenderflik + ladda fler
    for (const pass of [/godkänn|acceptera|tillåt alla|jag förstår|ok\b/i, /kalender|evenemang|alla evenemang|visa fler|ladda fler|se alla|kommande/i]) {
      await page.evaluate((src) => {
        const re = new RegExp(src.slice(1, src.lastIndexOf('/')), 'i');
        const els = [...document.querySelectorAll('button, a, [role="tab"], [role="button"], input[type="submit"]')];
        for (const e of els.slice(0, 80)) {
          const t = (e.textContent || e.value || '').trim();
          if (t && t.length < 40 && re.test(t)) { try { e.click(); } catch { } }
        }
      }, pass.toString()).catch(() => { });
      await new Promise(r => setTimeout(r, 2500));
    }
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => { });
    await new Promise(r => setTimeout(r, 4000));

    frames = page.frames().map(f => f.url()).filter(u => u && u !== 'about:blank' && !u.startsWith(url));
    const res = await page.evaluate((rd) => {
      const out = { ext: [], dates: 0 };
      const seen = new Set();
      for (const a of document.querySelectorAll('a[href^="http"]')) {
        let h; try { h = new URL(a.href).hostname.replace(/^www\./, ''); } catch { continue; }
        if (h.endsWith(rd)) continue;
        if (/facebook|instagram|youtube|twitter|x\.com|linkedin|google|1177|krisinformation|regeringen|skatteverket|polisen|riksdagen|arbetsformedlingen|forsakringskassan|msb\.se|adobe|w3\.org|translate/i.test(h)) continue;
        if (seen.has(h)) continue; seen.add(h);
        out.ext.push(h);
      }
      out.dates = ((document.body.innerText || '').match(/\b\d{1,2} (januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/gi) || []).length;
      return out;
    }, rootDom).catch(() => ({ ext: [], dates: 0 }));
    ext = res.ext; dates = res.dates;
  } catch { }
  await page.close().catch(() => { });
  caps.sort((a, b) => b.score - a.score);
  return { top: caps.slice(0, 6), ext, dates, frames: frames.slice(0, 5) };
}

(async () => {
  const kommuner = JSON.parse(fs.readFileSync('remaining.json', 'utf8'));
  const fp = JSON.parse(fs.readFileSync('fingerprint.json', 'utf8'));
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (i < kommuner.length) {
      const k = kommuner[i++];
      const f = fp.find(x => x.name === k.n) || {};
      const origin = (f.finalUrl || 'https://' + k.d).match(/^https?:\/\/[^/]+/)[0];
      const cands = [...new Set([
        ...(f.calendars || []).map(c => c.url).filter(u => /evenemang|kalend|pa-gang/i.test(u)).slice(0, 2),
        origin + '/evenemang', origin + '/kalender', origin + '/evenemangskalender',
      ])].slice(0, 4);
      const rootDom = k.d.replace(/^www\./, '');
      let best = null;
      for (const url of cands) {
        const r = await scoutPage(browser, url, rootDom).catch(() => null);
        if (!r) continue;
        const s = r.top[0]?.score || 0;
        if (!best || s > (best.top[0]?.score || 0)) best = { ...r, url };
        if (s >= 25) break;
      }
      if (!best) { out.push({ name: k.n, region: k.r, domain: k.d, top: [], ext: [] }); continue; }
      out.push({ name: k.n, region: k.r, domain: k.d, ...best });
      const t = best.top[0];
      console.log(`${k.n.padEnd(16)} dat=${String(best.dates).padStart(3)} ${t ? '[' + String(t.score).padStart(3) + '] ' + t.url.slice(0, 92) : '—'}`);
      if (best.frames?.length) console.log('    iframe: ' + best.frames.join(' ').slice(0, 130));
      if (best.ext.length) console.log('    ext: ' + best.ext.slice(0, 7).join(' '));
    }
  }));
  await browser.close();
  fs.writeFileSync('deep-scout.json', JSON.stringify(out, null, 1));
  console.log('\nklart:', out.length);
})();
