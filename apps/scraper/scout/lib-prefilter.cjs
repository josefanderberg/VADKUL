const fs = require('fs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
async function get(u, t = 12000) {
  try { const r = await fetch(u, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(t) }); return { ok: r.ok, status: r.status, body: r.ok ? await r.text() : '', url: r.url }; }
  catch (e) { return { ok: false, status: 0, body: '' }; }
}
const slug = s => s.toLowerCase().replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]/g, '');
(async () => {
  const fp = JSON.parse(fs.readFileSync('fingerprint.json', 'utf8'));
  const tasks = [];
  for (const k of fp) {
    const s = slug(k.name), root = k.domain.replace(/^www\./, '');
    for (const u of [
      `https://bibliotek.${root}/evenemang`, `https://bibliotek${s}.se/evenemang`,
      `https://${s}bibliotek.se/evenemang`, `https://biblioteket.${root}/evenemang`,
      `https://${root}/evenemang`, `https://www.${root}/evenemang`,
      `https://bibliotek.${root}/kalender`,
    ]) tasks.push({ kommun: k.name, region: k.region, url: u });
  }
  const hits = []; let i = 0;
  await Promise.all(Array.from({ length: 14 }, async () => {
    while (i < tasks.length) {
      const t = tasks[i++];
      const r = await get(t.url);
      if (!r.ok || r.body.length < 800) continue;
      const arena = /axiell|arena-?portlet|liferay|com_liferay|arena\.webapp|BiblioteksArena/i.test(r.body);
      const cid = (r.body.match(/customers\/([0-9a-f]{24})/) || [])[1];
      if (arena || cid) { hits.push({ ...t, finalUrl: r.url, arena, cid }); console.log((cid ? 'CID ' : 'arena').padEnd(6), t.kommun.padEnd(15), r.url.slice(0, 70), cid || ''); }
    }
  }));
  fs.writeFileSync('lib-candidates.json', JSON.stringify(hits, null, 1));
  console.log('\nkandidater:', hits.length, 'av', tasks.length);
})();
