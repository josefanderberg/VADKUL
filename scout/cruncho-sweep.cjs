/** Hitta SiteVision-Cruncho-kalendrar: portletId + /events-rutt. */
const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(u, h = {}, t = 20000) {
  try { const r = await fetch(u, { headers: { 'User-Agent': UA, ...h }, redirect: 'follow', signal: AbortSignal.timeout(t) }); return { ok: r.ok, body: r.ok ? await r.text() : '', url: r.url }; }
  catch { return { ok: false, body: '' }; }
}
(async () => {
  const fp = JSON.parse(fs.readFileSync('fingerprint.json', 'utf8'));
  const pages = [];
  for (const k of fp) {
    const origin = (k.finalUrl || 'https://' + k.domain).match(/^https?:\/\/[^/]+/);
    const seen = new Set();
    for (const u of [...(k.calendars || []).map(c => c.url).filter(u => /evenemang|kalend/i.test(u)).slice(0, 2), origin ? origin[0] + '/evenemang' : null].filter(Boolean))
      if (!seen.has(u)) { seen.add(u); pages.push({ name: k.name, url: u }); }
  }
  const hits = []; let i = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (i < pages.length) {
      const p = pages[i++];
      const r = await get(p.url);
      if (!r.ok) continue;
      if (!/cruncho/i.test(r.body)) continue;
      const pid = (r.body.match(/sv\.(12\.[0-9a-f]+)\.route/) || r.body.match(/registerInitialState\('(12\.[0-9a-f]+)'/) || [])[1];
      if (!pid) { hits.push({ ...p, note: 'cruncho men ingen portletId' }); continue; }
      const api = `${r.url.split('?')[0]}?sv.target=${pid}&sv.${pid}.route=/events&fromDate=${new Date().toISOString().slice(0, 10)}&selectedTags=&page=1&svAjaxReqParam=ajax`;
      const rr = await get(api, { 'X-Requested-With': 'XMLHttpRequest' });
      let n = 0, pagesN = 0;
      try { const j = JSON.parse(rr.body); n = j.noHits ?? (j.events || []).length; pagesN = j.noPages || 0; } catch { }
      hits.push({ ...p, portletId: pid, listUrl: r.url.split('?')[0], noHits: n, noPages: pagesN });
      console.log((n ? 'HIT ' : 'tom ') + p.name.padEnd(16) + String(n).padStart(4) + ' event  ' + pid);
    }
  }));
  fs.writeFileSync('cruncho-hits.json', JSON.stringify(hits, null, 1));
  console.log('\ncruncho-sidor:', hits.length);
})();
