// Genererar watchlist-national.ts från fb-page-probe-national.json.
// Stadshint: vanligaste kända stad i arrangörens event-adresser.
const fs = require('fs');
const SC = require('path').join(__dirname, 'out');
const REPO = require('path').resolve(__dirname, '../../../..');

const probe = JSON.parse(fs.readFileSync(`${SC}/fb-page-probe-national.json`, 'utf8'));

// Städer ur venueCoordinates.ts (inkl. Gotlands-orterna)
const vc = fs.readFileSync(`${REPO}/apps/scraper/src/utils/venueCoordinates.ts`, 'utf8');
const arr = vc.match(/SWEDISH_GEO_CITIES = \[([\s\S]*?)\];/)[1];
const CITIES = [...arr.matchAll(/'([^']+)'/g)].map((m) => m[1]);

// Slugs som redan bevakas (Gotland-listan)
const wl = fs.readFileSync(`${REPO}/apps/scraper/src/scrapers/facebook/watchlist.ts`, 'utf8');
const existing = new Set([...wl.matchAll(/slug: '([^']+)'/g)].map((m) => m[1].toLowerCase()));

// Nordisk DB-koll: en arrangör kvalar bara om minst ett av dess sparade,
// icke-gömda event har koordinater i Norden (rensar utländska rester i DB).
const Database = require(`${REPO}/node_modules/better-sqlite3`);
const db = new Database(`${REPO}/apps/scraper/events.db`, { readonly: true });
const nordicCount = db.prepare(`
    SELECT COUNT(*) c FROM link_events
    WHERE hostName = ? AND (hidden IS NULL OR hidden=0)
      AND lat BETWEEN 54.5 AND 71.5 AND lng BETWEEN 4.5 AND 31.5
`);

// Policyfilter: SvK täcks av svenskakyrkan-källan med hård eventType-taxonomi
// (svk-flood) — släpp inte in församlingssidor bakvägen. Partipolitiska sidor
// utelämnas också (linje med Gotland-kurateringen).
const POLICY_RE = /svenskakyrkan|f[oö]rsamling|domkyrk|pastorat|socialdemokrat|v[aä]nsterpartiet|moderaterna|centerpartiet|kristdemokrat|liberalerna|sverigedemokrat|milj[oö]partiet/i;

const keep = probe
    .filter((r) => !r.unavailable && !r.error && r.nEvents > 0)
    .filter((r) => !existing.has(r.slug.toLowerCase()))
    .filter((r) => !POLICY_RE.test(r.slug) && !POLICY_RE.test(r.host || ''))
    .filter((r) => nordicCount.get(r.host).c > 0);

function cityFor(r) {
    const hay = `${r.addrs || ''} ${r.host || ''}`;
    const counts = {};
    for (const c of CITIES) {
        const m = hay.match(new RegExp(`\\b${c}\\b`, 'gi'));
        if (m) counts[c] = m.length;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : null;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = keep
    .sort((a, b) => b.n - a.n)
    .map((r) => {
        const city = cityFor(r);
        const cityPart = city ? `, city: '${esc(city)}'` : '';
        return `    { slug: '${esc(r.slug)}', name: '${esc(r.host)}'${cityPart} }, // ${r.n} ev i juli, ${r.nEvents} synliga`;
    });

const out = `/**
 * GENERERAD FIL — nationell FB-sidbevakning ur snöbollsrundan 2026-07-27.
 *
 * Pipeline (scratchpad-skript, kör om vid behov):
 *   snowball.cjs        — en eventsida per återkommande arrangör (≥2 event
 *                         senaste månaden i DB) → arrangörens sid-slug
 *   probe-national.cjs  — verifierar att sidan finns och att /events-fliken
 *                         visar eventlänkar utloggat
 *   generate-watchlist.cjs — skriver denna fil
 *
 * Stadshint = vanligaste kända stad i arrangörens historiska event-adresser
 * (utelämnad när ingen känd stad hittades — geokodningen skannar då
 * eventadressen själv). Redigera hellre kurerade poster i watchlist.ts;
 * denna fil skrivs över vid regenerering.
 */

import { FacebookPageWatch } from './watchlist';

export const FACEBOOK_PAGE_WATCHLIST_NATIONAL: FacebookPageWatch[] = [
${lines.join('\n')}
];
`;

fs.writeFileSync(`${REPO}/apps/scraper/src/scrapers/facebook/watchlist-national.ts`, out);
console.log('skrev', keep.length, 'nationella poster;', probe.length - keep.length, 'bortfiltrerade');
console.log('utan stadshint:', keep.filter((r) => !cityFor(r)).length);
