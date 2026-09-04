const puppeteer = require('/Users/ai/Repos/VADKUL/node_modules/puppeteer');
const TARGETS = [
  ['Härryda', 'https://bibliotek.harryda.se/evenemang'],
  ['Högsby', 'https://bibliotek.hogsby.se/evenemang'],
  ['Markaryd', 'https://bibliotek.markaryd.se/evenemang'],
  ['Danderyd', 'https://bibliotek.danderyd.se/evenemang'],
  ['Strängnäs', 'https://bibliotek.strangnas.se/evenemang'],
];
(async () => {
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  for (const [name, url] of TARGETS) {
    const pg = await b.newPage();
    await pg.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    let cid = null, axiellUrls = [];
    pg.on('request', r => {
      const u = r.url();
      if (/api\.axiell\.com/.test(u)) axiellUrls.push(u);
      const m = u.match(/customers\/([0-9a-f]{24})/);
      if (m) cid = m[1];
    });
    try { await pg.goto(url, { waitUntil: 'networkidle2', timeout: 50000 }); } catch { }
    await new Promise(r => setTimeout(r, 5000));
    // klicka bort cookie-rutan och på ev. kalenderflik
    for (const re of [/godkänn|acceptera|tillåt|ok\b|jag förstår/i, /evenemang|kalender|visa|alla/i]) {
      await pg.evaluate((src) => {
        const rx = new RegExp(src.slice(1, src.lastIndexOf('/')), 'i');
        for (const e of [...document.querySelectorAll('button,a,[role="tab"]')].slice(0, 60)) {
          const t = (e.textContent || '').trim();
          if (t && t.length < 40 && rx.test(t)) { try { e.click(); } catch { } }
        }
      }, re.toString()).catch(() => { });
      await new Promise(r => setTimeout(r, 4000));
    }
    await new Promise(r => setTimeout(r, 4000));
    console.log((cid || 'ingen').padEnd(26), name.padEnd(12), 'axiell-anrop:', axiellUrls.length, axiellUrls[0] ? axiellUrls[0].slice(0, 70) : '');
    await pg.close();
  }
  await b.close();
})();
