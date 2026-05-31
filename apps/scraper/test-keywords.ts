/**
 * test-keywords.ts
 *
 * Testar en stor lista kandidatsökord mot FB Events search
 * och rapporterar hur många unika event-URLs varje sökord ger.
 *
 * Kör med: ts-node test-keywords.ts
 * Argument: --filter=idag | --filter=veckan (default: veckan)
 *           --scrolls=N  (default: 4, max ~8 för full yield)
 *
 * Resultat sparas i keyword_test_results.json
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { applyDateFilters, discoverEventUrls } from './src/scrapers/facebook/discovery';

// ─── KANDIDATLISTA ────────────────────────────────────────────────────────────

const CANDIDATES: string[] = [
    // --- Befintliga som vi VET fungerar (referenspunkter) ---
    'konsert', 'quiz', 'loppis', 'fest', 'vernissage', 'teater',

    // --- Befintliga som gav 0 (bekräfta att de är döda) ---
    'live', 'gig', 'pubrunda', 'film', 'spelning', 'hantverk',

    // --- Vardagliga svenska ord (användarens idé) ---
    'med',       // "Kväll med X", "Fest med DJ"
    'att',       // stoppsord?
    'och',       // stoppsord?
    'ett',       // stoppsord?
    'den',       // stoppsord?
    'nu',        // "Öppet nu", "Kom nu"
    'på',        // "Konsert på X"
    'till',      // "Välkommen till X"
    'från',      // "Direkt från X"
    'för',       // "Evenemang för alla"
    'om',        // stoppsord?
    'av',        // stoppsord?
    'in',        // "Check in", "Drop in"

    // --- Vanliga eventord (breda) ---
    'gratis',       // gratis-events, bred spridning
    'öppen',        // öppen föreläsning, öppet hus
    'öppet',        // öppet hus
    'välkommen',    // välkommen-events
    'mingel',       // nätverksevent
    'drop-in',      // drop-in events
    'natt',         // nattöppet, nattklubb
    'dag',          // heldagsevents
    'helg',         // helgaktiviteter (befintlig, svag)
    'kväll',        // (befintlig)
    'träff',        // föreningsträffar
    'möte',         // föreningsmöten
    'utomhus',      // utomhusaktiviteter
    'friluftsliv',  // vandring, cykling

    // --- Kultur & underhållning ---
    'allsång',      // MYCKET vanligt i Sverige, alla orter
    'dansband',     // typiskt svensk, glesbygd
    'karaoke',      // pub/bar-events
    'disco',        // danskvällar
    'folkmusik',    // traditionell musik
    'dragspel',     // folkmusik
    'cirkus',       // turnerar över hela landet
    'mässa',        // mässor/expo
    'bakluckeloppis', // specifik loppis-variant
    'antik',        // antikmässa/antikloppis
    'second hand',  // second hand-events

    // --- Säsong (relevant nu = sommar) ---
    'midsommar',    // 20 juni, extremt vanligt
    'sommarkonsert',
    'sommarfest',
    'sommar',       // brett sommarord
    'utomhuskonsert',
    'parkfest',
    'parkконсert',  // typo, skip

    // --- Sport & aktivitet ---
    'löpning',
    'cykling',
    'vandring',
    'simning',
    'fotboll',      // mer specifikt än "sport"
    'hockey',
    'orientering',
    'yoga',         // befintlig, fungerar

    // --- Mat & dryck ---
    'brunch',
    'middag',
    'matkurs',
    'vinprovning',
    'ölprovning',
    'pub',          // pub-evenemang

    // --- Community & föreningsliv ---
    'kyrka',        // kyrkokonserter, gudstjänster
    'gudstjänst',   // händer överallt
    'bön',
    'fika',         // fikaevent
    'föreläsning',  // befintlig, fungerar
    'barnteater',   // barn-events
    'barnaktivitet',
    'barnkonsert',
    'familj',       // familjeaktiviteter

    // --- Engelska (FB-globalt) ---
    'event',
    'open',
    'show',         // befintlig
    'night',
    'party',
    'free',
    'live music',   // flerords-sökning
    'open mic',
];

// Ta bort dubbletter och rensa bort "parkConsert" (typo)
const KEYWORDS = [...new Set(CANDIDATES.filter(k => !k.includes('onsert') || k === 'sommarkonsert' || k === 'konsert' || k === 'utomhuskonsert' || k === 'barnkonsert'))];

// ─── ARGUMENT ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const filterArg = args.find(a => a.startsWith('--filter='))?.split('=')[1] || 'veckan';
const scrollsArg = parseInt(args.find(a => a.startsWith('--scrolls='))?.split('=')[1] || '4');
const DATE_FILTER = filterArg === 'idag' ? 'idag' : 'den här veckan';

// ─── SNABB SCROLL-FUNKTION (färre iterationer än huvud-scrapern) ───────────────
async function fastDiscoverUrls(page: any, maxScrolls: number): Promise<string[]> {
    let lastHeight = 0;
    for (let i = 0; i < maxScrolls; i++) {
        try {
            const h = await page.evaluate(() => {
                document.body.style.setProperty('overflow', 'auto', 'important');
                document.documentElement.style.setProperty('overflow', 'auto', 'important');
                const overlays = Array.from(document.querySelectorAll('div')).filter(el => {
                    const s = window.getComputedStyle(el);
                    return s.position === 'fixed' && parseInt(s.zIndex) > 100;
                });
                for (const o of overlays) {
                    if (o.textContent?.includes('Logga in') || o.textContent?.includes('Se mer av')) o.remove();
                }
                window.scrollTo(0, document.body.scrollHeight);
                return document.body.scrollHeight;
            });
            if (h === lastHeight) break;
            lastHeight = h;
        } catch (_) { break; }
        await new Promise(r => setTimeout(r, 1200));
    }

    try {
        return await page.evaluate(() => {
            const urls = new Set<string>();
            for (const el of Array.from(document.querySelectorAll('a[href*="/events/"]'))) {
                const href = (el as HTMLAnchorElement).href;
                const m = href.match(/\/events\/(?:[a-zA-Z0-9_-]+\/)*(\d{10,})/);
                if (m) urls.add(`https://www.facebook.com/events/${m[1]}/`);
            }
            return Array.from(urls);
        });
    } catch (_) {
        return [];
    }
}

// ─── HUVUD ────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`\n🔬 Keyword-test | filter: "${DATE_FILTER}" | scrolls: ${scrollsArg} | ${KEYWORDS.length} sökord`);
    console.log(`⏱  Estimerad tid: ~${Math.ceil(KEYWORDS.length * 8 / 60)} min\n`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-notifications', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const results: { keyword: string; found: number; urls: string[] }[] = [];
    const allSeen = new Set<string>();

    for (let i = 0; i < KEYWORDS.length; i++) {
        const kw = KEYWORDS[i];
        const url = `https://www.facebook.com/events/search/?q=${encodeURIComponent(kw)}`;
        process.stdout.write(`[${String(i + 1).padStart(3)}/${KEYWORDS.length}] "${kw}" ... `);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            await new Promise(r => setTimeout(r, 1000));
            await applyDateFilters(page, [DATE_FILTER]);
            await new Promise(r => setTimeout(r, 1000));
            const urls = await fastDiscoverUrls(page, scrollsArg);

            const newUrls = urls.filter(u => !allSeen.has(u));
            const total = urls.length;
            newUrls.forEach(u => allSeen.add(u));

            results.push({ keyword: kw, found: total, urls });
            console.log(`${total} träffar (${newUrls.length} nya)`);
        } catch (err: any) {
            console.log(`FEL: ${err.message?.slice(0, 60)}`);
            results.push({ keyword: kw, found: -1, urls: [] });
        }
    }

    await browser.close();

    // ─── RAPPORT ──────────────────────────────────────────────────────────────
    const sorted = [...results].sort((a, b) => b.found - a.found);

    console.log('\n' + '═'.repeat(50));
    console.log(`RESULTAT — filter: "${DATE_FILTER}"`);
    console.log('═'.repeat(50));
    console.log(`${'Sökord'.padEnd(22)} ${'Träffar'.padStart(8)}`);
    console.log('─'.repeat(33));
    for (const r of sorted) {
        const bar = r.found > 0 ? '█'.repeat(r.found) : (r.found === -1 ? 'FEL' : '—');
        console.log(`${r.keyword.padEnd(22)} ${String(r.found).padStart(8)}  ${bar}`);
    }

    // Gruppera: funkar / funkar inte / okänt
    const works = sorted.filter(r => r.found >= 3);
    const weak = sorted.filter(r => r.found > 0 && r.found < 3);
    const dead = sorted.filter(r => r.found === 0);
    const errored = sorted.filter(r => r.found === -1);

    console.log('\n📊 SAMMANFATTNING');
    console.log(`  Funkar bra (≥3):  ${works.length} sökord`);
    console.log(`  Svaga (1-2):      ${weak.length} sökord`);
    console.log(`  Döda (0):         ${dead.length} sökord → ${dead.map(r => r.keyword).join(', ')}`);
    if (errored.length) console.log(`  Fel:              ${errored.length} sökord`);

    // Spara till fil
    const outPath = path.resolve(__dirname, 'keyword_test_results.json');
    fs.writeFileSync(outPath, JSON.stringify({
        testedAt: new Date().toISOString(),
        filter: DATE_FILTER,
        scrollsPerKeyword: scrollsArg,
        totalKeywordsTested: KEYWORDS.length,
        results: sorted.map(({ keyword, found }) => ({ keyword, found })),
    }, null, 2));
    console.log(`\n💾 Sparat till: ${outPath}`);
}

main().catch(console.error);
