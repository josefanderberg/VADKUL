// Genererar docs/outreach/arrangorer.md — bocklistan för arrangörs-outreachen —
// ur samma eventdata som sajten (apps/web/public/events-*.json).
//
//   node docs/outreach/generate-arrangorer.mjs        (från repo-roten)
//
// OBS: skriver över arrangorer.md HELT. Kör den bara för att bygga om listan
// från grunden (t.ex. efter färskt data) — dina ibockningar försvinner då.
// Vid omkörning: kopiera först undan "Skickat"-raderna och för över dem.
//
// Urval: kommande event, grupperade på hostName. Biljettplattformar utesluts
// (de är återförsäljare, inte arrangörer). Facebook-arrangörer får mall B
// (kontakt via FB-sidan/Messenger), övriga mall A (mejl via egna sajten).
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const pub = (f) => path.join(ROOT, 'apps', 'web', 'public', f);

// Biljett-/plattformsdomäner = INTE arrangörer → bort ur listan.
const PLATFORM_DOMAINS = /tickster|nortic|billetto|eventbrite|ticketmaster|kulturbiljetter|biljett|tickets\.|showtic|nolltvå|axs\.|dice\.fm/i;

// Samma städer som sajtens stadssidor (namn + koordinat räcker här).
const CITIES = [
    ['Stockholm', 59.33, 18.06], ['Göteborg', 57.71, 11.97], ['Malmö', 55.60, 13.00],
    ['Uppsala', 59.86, 17.64], ['Linköping', 58.41, 15.62], ['Örebro', 59.27, 15.21],
    ['Västerås', 59.61, 16.55], ['Helsingborg', 56.05, 12.69], ['Norrköping', 58.59, 16.19],
    ['Jönköping', 57.78, 14.16], ['Umeå', 63.83, 20.26], ['Lund', 55.70, 13.19],
    ['Borås', 57.72, 12.94], ['Sundsvall', 62.39, 17.31], ['Gävle', 60.67, 17.14],
    ['Eskilstuna', 59.37, 16.51], ['Halmstad', 56.67, 12.86], ['Växjö', 56.88, 14.81],
    ['Karlstad', 59.40, 13.51], ['Södertälje', 59.20, 17.63], ['Kristianstad', 56.03, 14.16],
    ['Luleå', 65.58, 22.15], ['Skellefteå', 64.75, 20.95], ['Kalmar', 56.66, 16.36],
    ['Östersund', 63.18, 14.64], ['Falun', 60.61, 15.63], ['Karlskrona', 56.16, 15.59],
    ['Visby', 57.64, 18.30], ['Trollhättan', 58.28, 12.29], ['Nyköping', 58.75, 17.01],
    ['Skövde', 58.39, 13.85],
];
const distKm = (la1, lo1, la2, lo2) => {
    const r = (d) => (d * Math.PI) / 180;
    const a = Math.sin(r(la2 - la1) / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(r(lo2 - lo1) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
};
const nearestCity = (lat, lng) => {
    let best = null, bestD = 50;
    for (const [name, cla, clo] of CITIES) {
        const d = distKm(lat, lng, cla, clo);
        if (d < bestD) { best = name; bestD = d; }
    }
    return best;
};
const originOf = (id) => { try { return new URL(id).hostname.replace(/^www\./, ''); } catch { return null; } };

const [destRaw, cardRaw] = await Promise.all([
    readFile(pub('events-destinations.json'), 'utf8'),
    readFile(pub('events-cards.json'), 'utf8'),
]);
const dests = JSON.parse(destRaw).events;
const cards = new Map(JSON.parse(cardRaw).events.map((c) => [c.id, c]));

const now = Date.now();
const groups = new Map(); // hostName → { count, domains: Map, cities: Map, examples: [] }
for (const e of dests) {
    if (Date.parse(e.time) < now - 86_400_000) continue; // kommande (idag räknas)
    const card = cards.get(e.id);
    const host = card?.hostName?.trim();
    if (!host || host.length < 3) continue;
    const domain = originOf(e.id);
    if (domain && PLATFORM_DOMAINS.test(domain)) continue;
    let g = groups.get(host);
    if (!g) { g = { count: 0, domains: new Map(), cities: new Map(), examples: [] }; groups.set(host, g); }
    g.count++;
    if (domain) g.domains.set(domain, (g.domains.get(domain) ?? 0) + 1);
    if (e.lat && e.lng) {
        const city = nearestCity(e.lat, e.lng);
        if (city) g.cities.set(city, (g.cities.get(city) ?? 0) + 1);
    }
    if (g.examples.length < 2 && e.title) g.examples.push(e.title.replace(/\s+/g, ' ').trim().slice(0, 60));
}

const top = (m, n = 2) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
const rows = [...groups.entries()]
    .map(([host, g]) => ({
        host, count: g.count,
        domain: top(g.domains, 1)[0] ?? '—',
        cities: top(g.cities, 2).join(', ') || '—',
        examples: g.examples,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 120);

const line = (r) => {
    const isFb = /facebook\.com/.test(r.domain);
    const mall = isFb ? 'B (FB-sidan)' : 'A (mejl)';
    return [
        `- [ ] **${r.host}** — ${r.count} event · ${r.cities} · \`${r.domain}\` · mall ${mall}`,
        `  - t.ex. _${r.examples.join('_ · _')}_ · skickat: ____ · svar: ____ · länk: ____`,
    ].join('\n');
};

const tier = (from, to, title, desc) => {
    const slice = rows.slice(from, to);
    if (!slice.length) return '';
    return `\n## ${title}\n\n_${desc}_\n\n${slice.map(line).join('\n')}\n`;
};

const md = `# Arrangörs-outreach — bocklista

> Genererad ${new Date().toISOString().slice(0, 10)} ur eventdatat (${rows.length} arrangörer med
> kommande event, biljettplattformar borträknade). Bygg om med
> \`node docs/outreach/generate-arrangorer.mjs\` — **men kopiera först undan dina
> ibockningar**, filen skrivs över helt.

**Arbetssätt:** se [README](README.md). Mallar: [mail-mallar.md](mail-mallar.md).
Bocka i rutan när mejlet är SKICKAT och fyll i datumet; "svar"/"länk" fylls i
när de svarat resp. när länken till vadkul.se är uppe.
${tier(0, 20, 'Prio 1 — topp 20 (börja här)', 'Flest kommande event = mest värde av kartan = störst chans till svar och länk.')}${tier(20, 60, 'Prio 2 — nästa våg', 'Ta 5–10 i veckan när Prio 1 är avverkad.')}${tier(60, 120, 'Prio 3 — långsvansen', 'Lägre volym per arrangör — men lokala föreningslänkar väger fint i Googles ögon.')}`;

await writeFile(path.join(ROOT, 'docs', 'outreach', 'arrangorer.md'), md);
console.log(`arrangorer.md: ${rows.length} arrangörer (${groups.size} före topp-120-capen)`);
