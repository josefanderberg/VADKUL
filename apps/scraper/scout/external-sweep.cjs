/**
 * Fjärde passet: skörda EXTERNA domäner som kommunsajterna själva länkar till
 * (turistbolag, kulturhus, teatrar, bibliotek, arenor) + testa den regionala
 * TURID-plattformen. Fingeravtryck per domän.
 */
const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(url, timeout = 15000) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
    return { ok: r.ok, status: r.status, body: r.ok ? await r.text() : '', url: r.url };
  } catch (e) { return { ok: false, status: 0, body: '', err: String(e.message || e).slice(0, 40) }; }
}
const SIG = 'num=200&query=&count=0&page=1&type=event&timestamp=0&filters=%7B%22type%22%3A%22event%22%7D';
const pickArray = j => Array.isArray(j) ? j : (['hits', 'data', 'items', 'events', 'results'].map(k => j?.[k]).find(Array.isArray) || null);

const GOOD = /visit|destination|upplev|turism|turist|kultur|teater|folketshus|folkets-hus|bio(?:graf)?|museum|museet|konsthall|arena|scen|bibliotek|konsert|festival|park/i;
const BAD = /facebook|instagram|youtube|twitter|linkedin|google|apple|microsoft|1177|krisinformation|regeringen|skatteverket|polisen|scb\.se|sverigesradio|svt\.se|wikipedia|kartor|cookie|acrobat|adobe|w3\.org|schema\.org|gov|europa\.eu|\.pdf|riksdagen|arbetsformedlingen|forsakringskassan|msb\.se|boverket|naturvardsverket|skolverket|socialstyrelsen|trafikverket|vaccin/i;

async function fingerprint(host) {
  const home = await get('https://' + host);
  if (!home.ok || home.body.length < 500) return null;
  const html = home.body;
  let origin; try { origin = new URL(home.url).origin; } catch { return null; }
  const sig = [];

  // TURID
  for (const t of [origin + '/api/v8/events?limit=1', 'https://turid.' + host.replace(/^www\./, '') + '/api/v8/events?limit=1']) {
    const r = await get(t);
    if (r.ok && /"total_count"/.test(r.body)) { try { sig.push({ kind: 'TURID', url: t, total: JSON.parse(r.body).total_count }); } catch { } break; }
  }
  // SiteVision RESTApp
  const routes = new Set();
  for (const m of html.matchAll(/"api"\s*:\s*"(https?:\/\/[^"]+|\/[^"]+)"/g)) { const v = m[1]; if (!/svg-sources/.test(v)) routes.add(v.startsWith('http') ? v : origin + v); }
  for (const m of html.matchAll(/["'(]((?:https?:\/\/[^"'\s]+)?\/rest-api\/[A-Za-z0-9_-]+)(?=["'/?])/g)) { const v = m[1]; if (!/svg-sources|mobile-menu|menu-service|MobileMenu|MegaMenu/i.test(v)) routes.add(v.startsWith('http') ? v : origin + v); }
  for (const route of [...routes].slice(0, 3)) {
    for (const t of [`${route}/events?${SIG}`, `${route}?${SIG}`, `${route}/events?num=200`]) {
      const r = await get(t, 20000);
      if (!r.ok || r.body.length < 100) continue;
      let j; try { j = JSON.parse(r.body); } catch { continue; }
      if (j?.success === false || j?.message) continue;
      const arr = pickArray(j);
      if (arr?.length) { sig.push({ kind: 'RESTAPP', url: t, n: arr.length }); break; }
    }
  }
  if (/api\.axiell\.com/.test(html)) sig.push({ kind: 'AXIELL' });
  // WP
  for (const ep of ['/wp-json/tribe/events/v1/events?per_page=5', '/wp-json/wp/v2/event?per_page=5', '/wp-json/wp/v2/evenemang?per_page=5', '/wp-json/wp/v2/arrangemang?per_page=5', '/wp-json/wp/v2/forestallning?per_page=5']) {
    const r = await get(origin + ep);
    if (r.ok && /^\s*\[\s*\{/.test(r.body) && r.body.length > 400) { sig.push({ kind: 'WP', url: origin + ep, len: r.body.length }); break; }
  }
  // event-sitemap
  const rob = await get(origin + '/robots.txt');
  const sms = [...(rob.body || '').matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1]);
  if (!sms.length) sms.push(origin + '/sitemap.xml');
  for (const sm of sms.slice(0, 2)) {
    const r = await get(sm, 20000);
    if (!r.ok) continue;
    const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const ev = locs.filter(u => /\/(evenemang|event|kalender|kalendarium|arrangemang|forestallning|shows?)\//i.test(u));
    const sub = locs.filter(u => /(event|evenemang|kalend|arrangemang)[^/]*\.xml/i.test(u));
    if (ev.length >= 5 || sub.length) { sig.push({ kind: 'SITEMAP', url: sm, events: ev.length, subs: sub.slice(0, 3) }); break; }
  }
  if (/"@type"\s*:\s*"?Event/i.test(html)) sig.push({ kind: 'JSONLD' });
  return sig.length ? { host, finalUrl: home.url, sig } : null;
}

(async () => {
  const fp = JSON.parse(fs.readFileSync(__dirname + '/fingerprint.json', 'utf8'));
  // 1. skörda externa domäner
  const byHost = new Map();
  let i = 0; const CONC = 10;
  const pages = [];
  for (const k of fp) {
    if (k.finalUrl) pages.push({ k, url: k.finalUrl });
    for (const c of (k.calendars || []).slice(0, 2)) pages.push({ k, url: c.url });
  }
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < pages.length) {
      const { k, url } = pages[i++];
      const r = await get(url);
      if (!r.ok) continue;
      const root = k.domain.replace(/^www\./, '').split('.').slice(-2).join('.');
      for (const m of r.body.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
        let h; try { h = new URL(m[1]).hostname.replace(/^www\./, ''); } catch { continue; }
        if (h.endsWith(root) && !/^visit|^destination|^upplev/.test(h)) continue;
        if (!h.endsWith('.se') && !h.endsWith('.com') && !h.endsWith('.nu')) continue;
        if (BAD.test(h)) continue;
        if (!GOOD.test(h)) continue;
        if (!byHost.has(h)) byHost.set(h, new Set());
        byHost.get(h).add(k.name);
      }
    }
  }));
  console.log('externa kandidat-domäner:', byHost.size);

  // 2. + regionala TURID/destinationsplattformar
  const REGIONAL = ['visitvarmland.com', 'visitdalarna.se', 'vastsverige.com', 'visitostergotland.se', 'visitblekinge.se',
    'swedishlapland.com', 'visitsodermanland.se', 'visitskane.com', 'visitsmaland.se', 'visitvarmland.se',
    'visitostersund.se', 'visithalland.com', 'visitsodrasmaland.se', 'visitvasternorrland.se', 'visitjamtland.se',
    'visitroslagen.se', 'destinationvastervik.se', 'visitgotland.se', 'visitnorrbotten.se', 'visitvasterbotten.se',
    'upplevvarmland.se', 'visitvarmlandsberg.se', 'visitvarmland.nu', 'visitmalardalen.se', 'visitorebro.se'];
  for (const h of REGIONAL) if (!byHost.has(h)) byHost.set(h, new Set(['(regional)']));

  const hosts = [...byHost.keys()];
  const res = []; let j = 0;
  await Promise.all(Array.from({ length: 10 }, async () => {
    while (j < hosts.length) {
      const h = hosts[j++];
      const f = await fingerprint(h).catch(() => null);
      if (f) {
        f.kommuner = [...byHost.get(h)];
        res.push(f);
        console.log('HIT', h.padEnd(34), f.sig.map(s => s.kind + (s.total ? ':' + s.total : s.n ? ':' + s.n : s.events ? ':' + s.events : '')).join(' '), '←', f.kommuner.slice(0, 4).join(','));
      }
    }
  }));
  fs.writeFileSync(__dirname + '/externals.json', JSON.stringify(res, null, 1));
  console.log('\ndomäner testade:', hosts.length, '— träffar:', res.length);
})();
