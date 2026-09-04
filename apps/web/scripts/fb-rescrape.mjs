#!/usr/bin/env node
// Ber Facebooks crawler hämta om delningsbilderna efter deploy.
//
// Facebook cachar og-data (bild, titel) per länk i ~30 dagar, och Messenger
// använder samma cache. Stadssidornas bild bär dagens siffror och veckans
// fem event (ägarens plan 4/9: dela stadslänken i grupper varje dag), så
// den måste hämtas om dagligen. Graph-anropet POST /?id=<url>&scrape=true
// gör precis det Sharing Debuggers "Scrape again" gör.
//
// Körs sist i deploy.yml. Kräver FB_SCRAPE_TOKEN (app-token "APP_ID|APP_SECRET"
// eller en giltig sid-/användartoken); saknas den hoppar skriptet över och
// deployen blir aldrig röd av det. URL:erna tas ur sajtens sitemap: roten,
// /evenemang och stadssidorna. --all tar även kategorisidorna.
//
//   node scripts/fb-rescrape.mjs            # roten + /evenemang + städer
//   node scripts/fb-rescrape.mjs --all      # + kategorisidor
//   node scripts/fb-rescrape.mjs --dry-run  # lista bara URL:erna

const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry-run');
const SITE = (process.env.SITE_URL || 'https://vadkul.se').replace(/\/$/, '');
const GRAPH = 'https://graph.facebook.com/v19.0/';
const token = process.env.FB_SCRAPE_TOKEN || process.env.FB_PAGE_TOKEN || '';

function wanted(url) {
    if (url === SITE || url === `${SITE}/` || url === `${SITE}/evenemang`) return true;
    const m = url.match(new RegExp(`^${SITE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/evenemang/([^/]+)(/([^/]+))?$`));
    if (!m) return false;
    return ALL || !m[2];
}

async function main() {
    if (!token && !DRY) {
        console.log('FB_SCRAPE_TOKEN saknas — hoppar över omhämtningen hos Facebook.');
        return;
    }
    const res = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`sitemap.xml svarade ${res.status}`);
    const xml = await res.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim()).filter(wanted);
    if (urls.length === 0) throw new Error('sitemap.xml gav inga stadslänkar');
    console.log(`${urls.length} länkar att hämta om${ALL ? ' (inkl. kategorisidor)' : ''}`);
    if (DRY) { for (const u of urls) console.log('  ' + u); return; }

    let ok = 0, fail = 0;
    for (const url of urls) {
        try {
            const body = new URLSearchParams({ id: url, scrape: 'true', access_token: token });
            const res = await fetch(GRAPH, { method: 'POST', body, signal: AbortSignal.timeout(30_000) });
            const json = await res.json().catch(() => ({}));
            if (res.ok && !json.error) { ok++; }
            else { fail++; console.log(`  ⚠️ ${url}: ${json.error?.message || res.status}`); }
        } catch (e) {
            fail++; console.log(`  ⚠️ ${url}: ${e?.message || e}`);
        }
        await new Promise(r => setTimeout(r, 250));   // artighet mot Graph-kvoten
    }
    console.log(`Klart: ${ok} omhämtade, ${fail} misslyckade.`);
    if (fail > 0 && ok === 0) console.log('::warning::Facebook-omhämtningen misslyckades för alla länkar — kolla FB_SCRAPE_TOKEN.');
}

main().catch(e => { console.log(`::warning::fb-rescrape: ${e?.message || e}`); });
