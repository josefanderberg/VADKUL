/**
 * Tredje passet: ANDRA ORGANISATIONER i kommunen som listar event publikt.
 * Kandidater = gissade turist-/biblioteksdomäner + externa länkar från
 * kommunens startsida. Varje kandidat fingeravtryckas för känd API-signatur.
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
const now = Date.now();
const slug = s => s.toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');

function pickArray(j) {
  if (Array.isArray(j)) return j;
  for (const k of ['hits', 'data', 'items', 'events', 'results']) if (Array.isArray(j?.[k])) return j[k];
  return null;
}

async function fingerprint(host) {
  const base = 'https://' + host;
  const home = await get(base);
  if (!home.ok || home.body.length < 400) return null;
  const html = home.body;
  const origin = (() => { try { return new URL(home.url).origin; } catch { return base; } })();
  const f = { host, finalUrl: home.url, sig: [] };

  // TURID (regional turistdatabas)
  for (const t of [origin + '/api/v8/events?limit=1', 'https://turid.' + host.replace(/^www\./, '') + '/api/v8/events?limit=1']) {
    const r = await get(t);
    if (r.ok && /"total_count"/.test(r.body)) {
      const j = JSON.parse(r.body);
      f.sig.push({ kind: 'TURID', url: t, total: j.total_count });
      break;
    }
  }
  // Axiell-markör
  if (/api\.axiell\.com/.test(html)) f.sig.push({ kind: 'AXIELL-inline' });
  // SiteVision RESTApp
  const routes = new Set();
  for (const m of html.matchAll(/"api"\s*:\s*"(https?:\/\/[^"]+|\/[^"]+)"/g)) { const v = m[1]; if (!/svg-sources/.test(v)) routes.add(v.startsWith('http') ? v : origin + v); }
  for (const m of html.matchAll(/["'(]((?:https?:\/\/[^"'\s]+)?\/rest-api\/[A-Za-z0-9_-]+)(?=["'/?])/g)) { const v = m[1]; if (!/svg-sources|mobile-menu|menu-service|MobileMenu|MegaMenu/i.test(v)) routes.add(v.startsWith('http') ? v : origin + v); }
  for (const route of [...routes].slice(0, 4)) {
    for (const t of [`${route}/events?${SIG}`, `${route}?${SIG}`, `${route}/events?num=200`]) {
      const r = await get(t, 20000);
      if (!r.ok || r.body.length < 100) continue;
      let j; try { j = JSON.parse(r.body); } catch { continue; }
      if (j?.success === false || j?.message) continue;
      const arr = pickArray(j);
      if (arr && arr.length) { f.sig.push({ kind: 'RESTAPP', url: t, n: arr.length }); break; }
    }
  }
  // WP tribe / event-CPT
  for (const ep of ['/wp-json/tribe/events/v1/events?per_page=5', '/wp-json/wp/v2/event?per_page=5', '/wp-json/wp/v2/evenemang?per_page=5', '/wp-json/wp/v2/arrangemang?per_page=5']) {
    const r = await get(origin + ep);
    if (r.ok && /^\s*[\[{]/.test(r.body) && r.body.length > 300) { f.sig.push({ kind: 'WP', url: origin + ep, len: r.body.length }); break; }
  }
  // ICS
  const ics = [...html.matchAll(/href="([^"]+\.ics[^"]*)"/gi)].map(m => m[1]).slice(0, 2);
  if (ics.length) f.sig.push({ kind: 'ICS', url: ics[0] });
  // JSON-LD Event + event-sitemap
  if (/"@type"\s*:\s*"?Event/i.test(html)) f.sig.push({ kind: 'JSONLD-home' });
  const rob = await get(origin + '/robots.txt');
  const sms = [...(rob.body || '').matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1]);
  if (!sms.length) sms.push(origin + '/sitemap.xml');
  for (const sm of sms.slice(0, 2)) {
    const r = await get(sm, 20000);
    if (!r.ok) continue;
    const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const ev = locs.filter(u => /\/(evenemang|event|kalender|kalendarium|arrangemang|shows?|program)\//i.test(u));
    const sub = locs.filter(u => /event|evenemang|kalend|arrangemang/i.test(u) && /\.xml/i.test(u));
    if (ev.length >= 5 || sub.length) { f.sig.push({ kind: 'SITEMAP', url: sm, events: ev.length, subs: sub.slice(0, 3) }); break; }
  }
  return f.sig.length ? f : null;
}

(async () => {
  const fp = JSON.parse(fs.readFileSync(__dirname + '/fingerprint.json', 'utf8'));
  const tasks = [];
  const seen = new Set();
  for (const k of fp) {
    const s = slug(k.name);
    const root = k.domain.replace(/^www\./, '');
    const cands = [
      `visit${s}.se`, `visit${s}.com`, `destination${s}.se`, `upplev${s}.se`,
      `${s}turism.se`, `turist${s}.se`, `bibliotek.${root}`, `bibliotek${s}.se`, `${s}bibliotek.se`,
    ];
    for (const c of cands) { if (seen.has(c)) continue; seen.add(c); tasks.push({ kommun: k.name, region: k.region, host: c, why: 'gissad' }); }
    // externa länkar från kommunens startsida
    for (const c of (k.calendars || [])) { /* nothing */ }
  }
  const res = [];
  let i = 0; const CONC = 12;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      const f = await fingerprint(t.host).catch(() => null);
      if (f) { const row = { ...t, ...f }; res.push(row); console.log('HIT', t.kommun.padEnd(15), t.host.padEnd(28), f.sig.map(s => s.kind + (s.total ? ':' + s.total : s.n ? ':' + s.n : s.events ? ':' + s.events : '')).join(' ')); }
    }
  }));
  fs.writeFileSync(__dirname + '/siblings.json', JSON.stringify(res, null, 1));
  console.log('\nkandidater testade:', tasks.length, '— träffar:', res.length);
})();
