const puppeteer = require('/Users/ai/Repos/VADKUL/node_modules/puppeteer');
(async () => {
  const targets = process.argv.slice(2);
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  for (const t of targets) {
    const pg = await b.newPage();
    await pg.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    const seen = [];
    pg.on('request', r => {
      const u = r.url();
      if (/cruncho|route=|\/api\/|appresource|graphql|events|evenemang/i.test(u) && !/\.(js|css|png|jpg|svg|webp|woff)/i.test(u))
        seen.push({ m: r.method(), u, body: (r.postData() || '').slice(0, 300) });
    });
    try { await pg.goto(t, { waitUntil: 'networkidle2', timeout: 45000 }); } catch { }
    await new Promise(r => setTimeout(r, 7000));
    console.log('\n=== ' + t);
    const uniq = [...new Map(seen.map(x => [x.m + x.u.split('&fromDate')[0], x])).values()];
    for (const s of uniq.slice(0, 12)) console.log('  ' + s.m + ' ' + s.u.slice(0, 150) + (s.body ? '\n      body: ' + s.body : ''));
    await pg.close();
  }
  await b.close();
})();
