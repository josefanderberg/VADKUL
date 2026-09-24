/**
 * fb-kommentarer.ts — hämta kommentarerna på Vad kuls inlägg i Facebookgrupper till en CSV.
 *
 * Grupper har inget API längre (Meta stängde Groups API 2024, även för sidor), så skriptet
 * styr en vanlig Chrome där DU loggar in. Inloggningen sparas i ~/.vadkul-fb-kommentarer
 * (utanför repot) så att du bara behöver logga in första gången. Kör på MacBooken, inte
 * på minin: det kräver att någon sitter vid skärmen.
 *
 *   npm run fb-kommentarer -w vadkul-scraper
 *   npm run fb-kommentarer -w vadkul-scraper -- --lankar min-lista.txt   (en länk per rad)
 *   npm run fb-kommentarer -w vadkul-scraper -- --ut ~/Desktop/kommentarer.csv --max 20
 *   npm run fb-kommentarer -w vadkul-scraper -- --fran 88      (fortsätt en avbruten körning)
 *
 * Så går det till:
 *   1. Chrome öppnas. Logga in och byt till Vad kul-profilen (som när du postar).
 *   2. Öppna aktivitetsloggen och välj gruppinläggen (eller öppna inläggen ett och ett).
 *      Skriptet samlar länkarna till gruppinläggen som syns där - scrolla så långt bak du vill.
 *      Länkar samlas bara från aktivitetsloggen och från inlägg du själv öppnar, inte från
 *      gruppflöden, så andras inlägg kommer inte med.
 *   3. Tryck Enter i terminalen. Skriptet går igenom inläggen i lugn takt, fäller ut alla
 *      kommentarer och svar och skriver CSV:n (fb-kommentarer.csv här i mappen).
 *
 * CSV:n importeras på sidan Omdömen i Vad kul-studion. Kolumnen positiv är en grov
 * gissning (ja/kanske/nej) och bara ja importeras - öppna filen och ändra "kanske" till "ja"
 * för de du vill ha med. Namnen står med för din skull men importeras inte.
 *
 * Facebooks sidkod ändras ofta. Blir det 0 kommentarer på inlägg som har kommentarer är
 * det selektorerna i LAS_KOMMENTARER nedan som behöver ses över.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import puppeteer, { Browser, Page } from 'puppeteer';
import { byggRader, FbKommentar, KommentarRad, normaliseraInlaggsUrl, tillCsv } from '../utils/fbKommentarer';

function arg(namn: string): string | undefined {
    const i = process.argv.indexOf(`--${namn}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

const PROFIL = path.join(os.homedir(), '.vadkul-fb-kommentarer');
// --fran 88 fortsätter en avbruten körning från inlägg 88 och skriver då till en egen fil,
// så att den förra CSV:n finns kvar (studions import hoppar över dubbletter).
const FRAN = Math.max(1, Number(arg('fran') || 1));
const UT = path.resolve(arg('ut') || (FRAN > 1 ? `fb-kommentarer-fran-${FRAN}.csv` : 'fb-kommentarer.csv'));
const LANKFIL = path.resolve(arg('lankar') || 'fb-kommentarer-lankar.txt');
const MAX = Number(arg('max') || 0);
const EGEN_SIDA = arg('sida') || 'Vadkul';

const vanta = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lugnt = () => vanta(3000 + Math.random() * 4000);   // snällt mot Facebook

// --- steg 1: samla länkar ---------------------------------------------------------

// Körs i sidan: alla länkar på sidan plus sidans egen adress.
const LAS_LANKAR = `(() => [location.href, ...[...document.querySelectorAll('a[href]')].map((a) => a.href)])()`;

// Bara aktivitetsloggen och enskilda inlägg räknas, inte gruppflöden med andras inlägg.
const samlarFran = (url: string) =>
    /allactivity|activity_log|\/activity\b/.test(url) || normaliseraInlaggsUrl(url) !== null;

function lasLankfil(): string[] {
    if (!fs.existsSync(LANKFIL)) return [];
    return fs.readFileSync(LANKFIL, 'utf-8').split(/\r?\n/)
        .map((r) => normaliseraInlaggsUrl(r.trim()))
        .filter((u): u is string => !!u);
}

async function samlaLankar(browser: Browser): Promise<string[]> {
    const lankar = new Set(lasLankfil());
    if (lankar.size) console.log(`📄 ${lankar.size} länkar från ${path.basename(LANKFIL)}`);
    console.log(`
👉 Logga in i Chrome-fönstret och byt till Vad kul-profilen om det behövs.
   Öppna sedan aktivitetsloggen (profilbilden → Inställningar → Aktivitetslogg)
   och välj gruppinläggen, eller öppna inläggen ett och ett. Scrolla så långt bak du vill.
   Tryck Enter här när du är klar (länkarna från förra gången finns redan med).
   Klicka inte i fönstret när hämtningen har börjat.
`);
    let klar = false;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.once('line', () => { klar = true; });
    let senast = -1;
    while (!klar) {
        for (const p of await browser.pages()) {
            try {
                if (!samlarFran(p.url())) continue;
                const hrefs = (await p.evaluate(LAS_LANKAR)) as string[];
                for (const h of hrefs) {
                    const u = normaliseraInlaggsUrl(h);
                    if (u) lankar.add(u);
                }
            } catch { /* sidan laddas om just nu */ }
        }
        if (lankar.size !== senast) {
            senast = lankar.size;
            fs.writeFileSync(LANKFIL, [...lankar].join('\n') + '\n');
            process.stdout.write(`\r🔗 ${lankar.size} gruppinlägg hittade (Enter när du är klar) `);
        }
        await vanta(1500);
    }
    rl.close();
    console.log(`\n💾 Länkarna sparade i ${LANKFIL}`);
    return [...lankar];
}

// --- steg 2: kommentarerna på ett inlägg ------------------------------------------------

// Körs i sidan: byt "Mest relevanta" till "Alla kommentarer" så att inget döljs.
const OPPNA_SORTERING = `(() => {
  const el = [...document.querySelectorAll('div[role="button"], span[role="button"]')]
    .find((e) => /^(mest relevanta|relevantast|most relevant|nyast|newest)$/i.test(e.innerText.trim()));
  if (el) { el.click(); return true; }
  return false;
})()`;
const VALJ_ALLA = `(() => {
  const el = [...document.querySelectorAll('div[role="menuitem"], div[role="menuitemradio"]')]
    .find((e) => /^(alla kommentarer|all comments)/i.test(e.innerText.trim()));
  if (el) { el.click(); return true; }
  return false;
})()`;

// Körs i sidan: klicka på alla "Visa fler kommentarer" / "Visa 3 svar" som syns. Ger antal klick.
const FALL_UT = `(() => {
  const rx = /^(visa|view|se) (fler|mer|tidigare|alla|more|previous|all|\\d+|1)\\b.*(kommentar|svar|comment|repl)|^\\d+ (svar|replies)$|^(visa|view) (1|\\d+) (svar|reply|replies)$|^(visa|view) (mer|more)$/i;
  let n = 0;
  for (const el of document.querySelectorAll('div[role="button"], span[role="button"]')) {
    const t = el.innerText.trim();
    if (t.length < 60 && rx.test(t)) { el.click(); n++; }
  }
  return n;
})()`;

// Körs i sidan: läs kommentarerna och gruppens namn.
const LAS_KOMMENTARER = `(() => {
  const arts = [...document.querySelectorAll('div[role="article"]')]
    .filter((a) => /^(kommentar|svar|comment|reply) (av|by|från|from) /i.test(a.getAttribute('aria-label') || ''));
  const kommentarer = arts.map((a) => {
    const label = a.getAttribute('aria-label') || '';
    const egen = (el) => el.closest('div[role="article"]') === a;
    const lankar = [...a.querySelectorAll('a[href]')].filter(egen);
    let id = '';
    let relativTid = '';
    for (const l of lankar) {
      try {
        const u = new URL(l.href);
        const cid = u.searchParams.get('reply_comment_id') || u.searchParams.get('comment_id');
        if (cid && !id) { id = cid; relativTid = l.innerText.trim(); }
      } catch (e) {}
    }
    const namnEl = lankar.find((l) => l.innerText.trim() && !/comment_id/.test(l.href));
    const namn = namnEl ? namnEl.innerText.trim() : label.replace(/^\\S+ \\S+ /, '').split(/ för | about | \\d/)[0];
    const delar = [...a.querySelectorAll('div[dir="auto"]')].filter(egen)
      .map((d) => d.innerText.trim()).filter(Boolean);
    const text = [...new Set(delar)].join('\\n');
    return { id, namn, text, svar: /^(svar|reply)/i.test(label), relativTid };
  });
  // Gruppens namn: länken till själva gruppen (/groups/<id>/), inte aviseringar och
  // andra länkar som också pekar in i gruppen ("Oläst: X har kommenterat ditt inlägg i ...").
  const gid = (location.pathname.match(/^\\/groups\\/([^/]+)/) || [])[1] || '';
  const brus = (t) => !t || t.length < 4 || t.length > 120 || /\\n/.test(t)
    || /^(grupper|groups)$/i.test(t) || /^(oläst|unread)|har kommenterat|commented on|nämnde dig|mentioned you/i.test(t);
  const gruppLank = [...document.querySelectorAll('a[href*="/groups/"]')]
    .filter((l) => { try { return new URL(l.href).pathname.replace(/\\/$/, '') === '/groups/' + gid; } catch (e) { return false; } })
    .map((l) => l.innerText.trim()).find((t) => !brus(t));
  const titel = document.title.replace(/^\\(\\d+\\)\\s*/, '').replace(/\\s*\\|\\s*Facebook$/, '');
  const grupp = gruppLank || (brus(titel) ? '' : titel);
  return { kommentarer, grupp };
})()`;

async function hamtaInlagg(page: Page, lank: string): Promise<{ grupp: string; rader: KommentarRad[] }> {
    await page.goto(lank, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await vanta(4000);
    try {
        if (await page.evaluate(OPPNA_SORTERING)) {
            await vanta(1200);
            await page.evaluate(VALJ_ALLA);
            await vanta(2500);
        }
    } catch { /* ingen sorteringsknapp: få kommentarer */ }
    for (let varv = 0; varv < 40; varv++) {
        const klick = (await page.evaluate(FALL_UT)) as number;
        if (!klick) break;
        await vanta(1800);
    }
    const res = (await page.evaluate(LAS_KOMMENTARER)) as { kommentarer: FbKommentar[]; grupp: string };
    return { grupp: res.grupp, rader: byggRader(res.kommentarer, res.grupp, lank, EGEN_SIDA) };
}

// Fliken kan försvinna under körningen (stängd, omdirigerad, Facebook byter ut ramen) -
// då blir varje senare inlägg "detached Frame". Öppna en ny flik och försök igen en gång.
const fliken_borta = (e: unknown) =>
    /detached|Target closed|Session closed|has been closed|Execution context was destroyed/i
        .test((e as Error)?.message || '');

// --- huvudflöde ---------------------------------------------------------------------------

async function main() {
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: PROFIL,
        defaultViewport: null,
        args: ['--disable-notifications', '--window-size=1280,1000'],
    });
    try {
        const [forsta] = await browser.pages();
        let page = forsta || await browser.newPage();
        await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });

        let lankar = await samlaLankar(browser);
        if (FRAN > 1) lankar = lankar.slice(FRAN - 1);
        if (MAX > 0) lankar = lankar.slice(0, MAX);
        if (!lankar.length) {
            console.log('Inga gruppinlägg hittade - inget att hämta.');
            return;
        }

        const alla: KommentarRad[] = [];
        for (const [i, lank] of lankar.entries()) {
            const nr = `[${FRAN + i}/${FRAN - 1 + lankar.length}]`;
            try {
                let res;
                try {
                    res = await hamtaInlagg(page, lank);
                } catch (e) {
                    if (!fliken_borta(e)) throw e;
                    page = await browser.newPage();
                    res = await hamtaInlagg(page, lank);
                }
                alla.push(...res.rader);
                const ja = res.rader.filter((r) => r.positiv === 'ja').length;
                console.log(`${nr} ${res.grupp || lank}: ${res.rader.length} kommentarer, ${ja} positiva`);
            } catch (e) {
                console.log(`${nr} ⚠️ ${lank}: ${(e as Error).message}`);
            }
            // Spara efter varje inlägg, så att inget går förlorat om körningen avbryts.
            fs.writeFileSync(UT, tillCsv(alla));
            if (i < lankar.length - 1) await lugnt();
        }

        const antal = (p: string) => alla.filter((r) => r.positiv === p).length;
        console.log(`
✅ ${alla.length} kommentarer från ${lankar.length} inlägg → ${UT}
   ${antal('ja')} positiva, ${antal('kanske')} kanske (titta på dem), ${antal('nej')} övriga.
   Ändra "kanske" till "ja" för de du vill ha med, och importera filen på sidan Omdömen i studion.`);
    } finally {
        await browser.close();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
