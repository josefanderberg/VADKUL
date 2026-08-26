/**
 * RESTApp-dig v2 — hittar SiteVision-webappens API-bas ur registerInitialState
 * ("api"-nyckeln) eller /rest-api/<Route> i sid-HTML, och testar de tre kända
 * anropssignaturerna (Eskilstuna-sök, /events, /items?paths=).
 */
const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(url, timeout = 20000) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(timeout) });
    return { ok: r.ok, status: r.status, body: r.ok ? await r.text() : '', url: r.url };
  } catch (e) { return { ok: false, status: 0, body: '', err: String(e.message || e).slice(0, 50) }; }
}
const now = Date.now();
const SIG = 'num=200&query=&count=0&page=1&type=event&timestamp=0&filters=%7B%22type%22%3A%22event%22%7D';

function pickArray(j) {
  if (Array.isArray(j)) return j;
  for (const k of ['hits', 'data', 'items', 'events', 'results']) if (Array.isArray(j?.[k])) return j[k];
  return null;
}
function evDate(it) {
  const cands = [it.startDate, it.start, it.date, it.eventDate, it?.info?.start, it?.info?.startDate, it.startTime];
  for (const c of cands) {
    if (!c) continue;
    const t = Date.parse(String(c).replace(' ', 'T'));
    if (!isNaN(t)) return t;
  }
  if (typeof it.startDateMillis === 'number' && it.startDateMillis > 0) return it.startDateMillis;
  return NaN;
}
function score(j) {
  const arr = pickArray(j);
  if (!arr) return null;
  let fut = 0;
  for (const it of arr) { const t = evDate(it); if (!isNaN(t) && t > now - 864e5) fut++; }
  return { tot: arr.length, fut };
}

async function tryRoute(route, paths) {
  const tries = [
    `${route}/events?${SIG}`,
    `${route}?${SIG}`,
    `${route}/events?num=200`,
    ...[...paths].slice(0, 5).map(p => `${route}/items?start=0&num=200&paths=${p}`),
  ];
  const found = [];
  for (const t of tries) {
    const r = await get(t);
    if (!r.ok || r.body.length < 80) continue;
    let j; try { j = JSON.parse(r.body); } catch { continue; }
    if (j?.success === false || j?.message) continue;
    const s = score(j);
    if (s && s.tot > 0) found.push({ url: t, ...s });
  }
  found.sort((a, b) => b.fut - a.fut || b.tot - a.tot);
  return found[0] || null;
}

async function dig(k) {
  const pages = new Set();
  if (k.finalUrl) pages.add(k.finalUrl);
  for (const c of (k.calendars || [])) pages.add(c.url);
  const routes = new Set(); const paths = new Set();
  for (const p of [...pages].slice(0, 5)) {
    const r = await get(p);
    if (!r.ok) continue;
    const html = r.body; const origin = new URL(r.url).origin;
    for (const m of html.matchAll(/"api"\s*:\s*"(https?:\/\/[^"]+|\/[^"]+)"/g)) {
      const v = m[1]; if (/svg-sources/.test(v)) continue;
      routes.add(v.startsWith('http') ? v : origin + v);
    }
    for (const m of html.matchAll(/["'(]((?:https?:\/\/[^"'\s]+)?\/rest-api\/[A-Za-z0-9_-]+)(?=["'/?])/g)) {
      const v = m[1]; if (/svg-sources|mobile-menu|menu-service|MobileMenu|MegaMenu/i.test(v)) continue;
      routes.add(v.startsWith('http') ? v : origin + v);
    }
    for (const m of html.matchAll(/["\\]*paths["\\]*\s*:\s*\[?\s*["\\]*(3\.[0-9a-f]+)/g)) paths.add(m[1]);
    for (const m of html.matchAll(/paths=(3\.[0-9a-f]+)/g)) paths.add(m[1]);
  }
  if (!routes.size) return null;
  const hits = [];
  for (const r of [...routes].slice(0, 6)) {
    const h = await tryRoute(r, paths);
    if (h) hits.push(h);
  }
  if (!hits.length) return null;
  hits.sort((a, b) => b.fut - a.fut);
  return { name: k.name, domain: k.domain, region: k.region, routes: [...routes], best: hits[0], all: hits };
}

(async () => {
  const fp = JSON.parse(fs.readFileSync(__dirname + '/fingerprint.json', 'utf8'));
  const res = [];
  let i = 0; const CONC = 6;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < fp.length) {
      const k = fp[i++];
      const r = await dig(k).catch(() => null);
      if (r) { res.push(r); console.log('HIT', r.name.padEnd(16), String(r.best.fut).padStart(4) + ' framtida /' + String(r.best.tot).padEnd(4), r.best.url.slice(0, 110)); }
    }
  }));
  res.sort((a, b) => b.best.fut - a.best.fut);
  fs.writeFileSync(__dirname + '/restapp-hits.json', JSON.stringify(res, null, 1));
  console.log('\ntotalt', res.length);
})();
