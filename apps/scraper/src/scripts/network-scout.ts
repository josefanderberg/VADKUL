/**
 * network-scout.ts — DevTools-djupdyk via Puppeteer.
 *
 * Fångar ALLA HTTP-svar (page.on('response')) på angivna sidor, filtrerar bort
 * statiska assets/analytics och behåller json|xml. Rankar fynden på event-hints
 * i body och skriver ut topp-kandidaterna. Dumpar dessutom renderad sidtext-
 * spår (svenskt datum + "kl HH:MM") så man ser om en JS-sida går att skörda via
 * sitemap-enginens useBrowser-läge utan något separat API.
 *
 * Körning:
 *   npm run scout -- https://exempel.se/event/foo/ https://exempel.se/program/
 *   (eller: npx ts-node src/scripts/network-scout.ts <url> [<url> ...])
 *
 * Genererar inga commits/DB-skrivningar — ren rekognosering.
 */

import puppeteer from 'puppeteer';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const STATIC_RE = /javascript|text\/css|image|font|\.woff|\.svg|\.png|\.jpe?g|\.gif|\.webp|manifest|piwik|gtm|googletag|google-analytics|analytics|consent|hotjar|facebook|doubleclick|cookiebot/i;
const HINT_RE = /(startDate|eventDate|"events"|"title"|evenemang|"date"|"items"|"results"|"hits"|"posts"|calendar)/i;

interface Cap { url: string; status: number; len: number; prefix: string; }

async function scout(target: string) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    const caps: Cap[] = [];

    page.on('response', async (res) => {
        try {
            const ct = res.headers()['content-type'] || '';
            const u = res.url();
            if (STATIC_RE.test(ct + ' ' + u)) return;
            if (!/json|xml/i.test(ct)) return;
            let body = '';
            try { body = await res.text(); } catch { /* binary/empty */ }
            caps.push({ url: u, status: res.status(), len: body.length, prefix: body.slice(0, 220).replace(/\s+/g, ' ') });
        } catch { /* ignore */ }
    });

    let dateHints: string[] = [];
    try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await new Promise((r) => setTimeout(r, 7000)); // låt XHR + JS-rendering hinna
        dateHints = await page.evaluate(() => {
            const el = document.querySelector('main, article, .content, .event, .single-event, .program, .evenemang, body');
            const text = ((el as HTMLElement)?.innerText || '').slice(0, 6000);
            const re = /\b\d{1,2} (januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)( \d{4})?|\b\d{4}-\d{2}-\d{2}\b|kl[. ]*\d{1,2}[:.]\d{2}/gi;
            return Array.from(new Set((text.match(re) || []))).slice(0, 8);
        });
    } catch (e) {
        console.log(`  nav-fel: ${(e as Error).message}`);
    }

    caps.sort((a, b) => (HINT_RE.test(b.prefix) ? 1 : 0) - (HINT_RE.test(a.prefix) ? 1 : 0) || b.len - a.len);
    console.log(`\n=== ${target} ===`);
    console.log(`  renderade datum-spår: ${dateHints.length ? dateHints.join(' | ') : '(inga)'}`);
    console.log(`  ${caps.length} json/xml-svar:`);
    caps.slice(0, 8).forEach((c) => console.log(`  [${c.status}] ${String(c.len).padStart(6)}b | ${c.url.slice(0, 90)}\n        ${c.prefix.slice(0, 130)}`));
    await browser.close();
}

(async () => {
    const targets = process.argv.slice(2);
    if (!targets.length) { console.log('Användning: npx ts-node src/scripts/network-scout.ts <url> [<url> ...]'); process.exit(1); }
    for (const t of targets) await scout(t);
})().catch((e) => { console.error('FEL', e); process.exit(1); });
