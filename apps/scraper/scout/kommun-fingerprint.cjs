/**
 * Bred fingeravtrycks-probe över otäckta kommuner.
 * Ren HTTP (node fetch), inga deps. Skriver JSON till scout/fingerprint.json
 */
const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT = 15000;

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'sv-SE,sv;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT) });
    const ct = res.headers.get('content-type') || '';
    let body = '';
    if (res.ok && !/image|font|octet/i.test(ct)) body = await res.text();
    return { ok: res.ok, status: res.status, body, ct, url: res.url };
  } catch (e) { return { ok: false, status: 0, body: '', ct: '', url, err: String(e.message || e).slice(0, 60) }; }
}

const CAL_PATHS = [
  '/evenemang', '/evenemangskalender', '/kalender', '/uppleva-och-gora/evenemang',
  '/uppleva-och-gora/evenemangskalender', '/uppleva-och-gora/kalender',
  '/se-och-gora/evenemang', '/uppleva/evenemang', '/aktuellt/kalender',
  '/evenemangsguiden', '/pa-gang', '/kalendarium', '/uppleva-och-gora/kultur-och-fritid/evenemang',
];

function platform(html, headers) {
  const p = [];
  if (/sitevision|sv-portlet|sv-template|envisionui/i.test(html)) p.push('sitevision');
  if (/wp-content|wp-json|wp-includes/i.test(html)) p.push('wordpress');
  if (/__NEXT_DATA__|\/_next\//.test(html)) p.push('nextjs');
  if (/__NUXT__|\/_nuxt\//.test(html)) p.push('nuxt');
  if (/drupal|sites\/default\/files/i.test(html)) p.push('drupal');
  if (/episerver|optimizely|epi-util/i.test(html)) p.push('episerver');
  if (/sitecore/i.test(html)) p.push('sitecore');
  if (/umbraco/i.test(html)) p.push('umbraco');
  if (/(^|[^a-z])sitefarm|liferay/i.test(html)) p.push('liferay');
  return p;
}

function signals(html) {
  const s = {};
  const restApi = [...html.matchAll(/["']([^"']*\/rest-api\/[^"']*)["']/g)].map(m => m[1]).slice(0, 6);
  if (restApi.length) s.restApi = [...new Set(restApi)];
  if (/registerInitialState/.test(html)) s.registerInitialState = true;
  const svc = [...html.matchAll(/serviceUrl["'&;:=\s]+([^"'&<\s]+)/gi)].map(m => m[1]).slice(0, 4);
  if (svc.length) s.serviceUrl = [...new Set(svc)];
  if (/data-settings=/.test(html)) s.dataSettings = true;
  if (/api\.axiell\.com/.test(html)) s.axiell = true;
  if (/cbis[-_]/i.test(html)) s.cbis = true;
  const ics = [...html.matchAll(/href="([^"]+\.ics[^"]*)"/gi)].map(m => m[1]).slice(0, 3);
  if (ics.length) s.ics = ics;
  if (/"@type"\s*:\s*"?Event/i.test(html)) s.jsonLdEvent = true;
  const times = (html.match(/<time[^>]+datetime=/gi) || []).length;
  if (times) s.timeTags = times;
  const dates = (html.match(/\b\d{1,2} (januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/gi) || []).length;
  if (dates) s.svDates = dates;
  const isoDates = (html.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || []).length;
  if (isoDates) s.isoDates = isoDates;
  // externa kalenderleverantörer
  const vendors = [];
  for (const [re, name] of [
    [/dinstudio|eventbrite|billetto|tickster|nortic|kulturbiljetter|ticketmaster/i, 'ticketing'],
    [/evenemangskalender\.se|kulturkalender|eventyay/i, 'kalendertjanst'],
    [/interbook|actorsmartbook|rbok\.se|bokning/i, 'bokning'],
    [/citybreak|visitgroup|basecamp/i, 'visitgroup'],
  ]) if (re.test(html)) vendors.push(name);
  if (vendors.length) s.vendors = vendors;
  return s;
}

async function probeKommun(k) {
  const base = 'https://' + k.domain;
  const out = { name: k.name, region: k.region, domain: k.domain, calendars: [], platform: [], notes: [] };
  const home = await get(base);
  if (!home.ok) { out.notes.push('home ' + (home.status || home.err)); }
  const html = home.body || '';
  out.platform = platform(html);
  out.finalUrl = home.url;

  // kandidat-kalender-URL:er ur startsidan
  const cands = new Set();
  const origin = (() => { try { return new URL(home.url || base).origin; } catch { return base; } })();
  for (const m of html.matchAll(/href="([^"#?]+)"/gi)) {
    let h = m[1];
    if (!/kalend|evenemang|aktivitet|pa-gang|pagang|whats-on|upplev/i.test(h)) continue;
    if (/\.(pdf|jpg|png|ics)$/i.test(h)) continue;
    if (h.startsWith('//')) h = 'https:' + h;
    else if (h.startsWith('/')) h = origin + h;
    else if (!/^https?:/.test(h)) continue;
    try {
      const u = new URL(h);
      const rootDom = k.domain.split('.').slice(-2).join('.');
      if (!u.hostname.endsWith(rootDom)) continue;
      cands.add(u.origin + u.pathname.replace(/\/$/, ''));
    } catch { }
  }
  for (const p of CAL_PATHS) cands.add(origin + p);
  const list = [...cands].slice(0, 14);

  for (const url of list) {
    const r = await get(url);
    if (!r.ok || r.body.length < 500) continue;
    const sg = signals(r.body);
    const score = (sg.timeTags || 0) + (sg.svDates || 0) + (sg.isoDates || 0) * 0.5 + (sg.jsonLdEvent ? 20 : 0) + (sg.restApi ? 30 : 0) + (sg.axiell ? 30 : 0);
    if (score >= 5) out.calendars.push({ url, score: Math.round(score), sig: sg, platform: platform(r.body) });
  }
  out.calendars.sort((a, b) => b.score - a.score);
  out.calendars = out.calendars.slice(0, 4);

  // WP-REST
  for (const ep of ['/wp-json/tribe/events/v1/events?per_page=5', '/wp-json/wp/v2/event?per_page=5', '/wp-json/wp/v2/evenemang?per_page=5']) {
    const r = await get(origin + ep);
    if (r.ok && /^\s*[\[{]/.test(r.body) && r.body.length > 200) { out.wpRest = { ep, len: r.body.length, prefix: r.body.slice(0, 150).replace(/\s+/g, ' ') }; break; }
  }

  // sitemap
  const rob = await get(origin + '/robots.txt');
  const smUrls = [...(rob.body || '').matchAll(/Sitemap:\s*(\S+)/gi)].map(m => m[1]);
  if (!smUrls.length) smUrls.push(origin + '/sitemap.xml');
  for (const sm of smUrls.slice(0, 3)) {
    const r = await get(sm);
    if (!r.ok) continue;
    const subs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    const evSub = subs.filter(u => /event|evenemang|kalend|arrangemang/i.test(u));
    const evUrls = subs.filter(u => /\/(evenemang|event|kalender|kalendarium|arrangemang)\//i.test(u));
    if (evSub.length || evUrls.length) {
      out.sitemap = { sm, eventSubmaps: evSub.slice(0, 4), eventUrlCount: evUrls.length, sample: evUrls.slice(0, 2) };
      break;
    }
  }
  return out;
}

(async () => {
  const lines = fs.readFileSync(__dirname + '/uncovered.txt', 'utf8').trim().split('\n');
  const kommuner = lines.map(l => { const [name, region, domain] = l.split('|'); return { name, region, domain }; });
  const results = [];
  const CONC = 8;
  let i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < kommuner.length) {
      const k = kommuner[i++];
      const r = await probeKommun(k).catch(e => ({ name: k.name, domain: k.domain, error: String(e.message || e) }));
      results.push(r);
      process.stderr.write(`[${results.length}/${kommuner.length}] ${r.name}\n`);
    }
  }));
  results.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  fs.writeFileSync(__dirname + '/fingerprint.json', JSON.stringify(results, null, 1));
  console.log('klart:', results.length);
})();
