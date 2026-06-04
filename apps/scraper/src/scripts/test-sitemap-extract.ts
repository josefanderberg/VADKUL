/**
 * Test-sitemap-extract: testar sitemap-engine mot en URL per probe-träff
 * för att se hur många kandidater som faktiskt ger extraherbar data.
 *
 * Kategoriserar varje träff:
 *   ✅ JSON-LD Event       — sitemap-engine fungerar direkt
 *   🟡 Cheerio fallback    — JSON-LD saknas, men <time datetime> hittas
 *   ❌ Ingen struktur      — behöver kommun-specifik HTML-parser
 *
 * Använder probe-sitemap-resultaten som input (hårdkodade träffar från
 * 2026-06-03-körning).
 *
 * Kör:  npx ts-node src/scripts/test-sitemap-extract.ts
 */

import { extractJsonLdBlocks, collectEvents, jsonLdToRawEvent, DEFAULT_EVENT_TYPES } from '../sources/engines/json-ld';
import { findFirstDateInText } from '../utils/swedishDate';
import * as cheerio from 'cheerio';

interface Candidate {
    kommun: string;
    sampleUrl: string;
}

// Direkt från probe-sitemap 2026-06-03 — en sample-URL per ny kandidat
const CANDIDATES: Candidate[] = [
    { kommun: 'Södertälje',  sampleUrl: 'https://www.sodertalje.se/omsorg-och-socialt-stod/aldreomsorg/aktiviteter-och-service-for-seniorer/motesplatser-for-seniorer/aktiviteter/onskelaten-pa-bergvik-fredag-v29-v3223/' },
    { kommun: 'Nacka',       sampleUrl: 'https://www.nacka.se/valfard-samhallsservice/kulturhuset-alta/evenemang/test/' },
    { kommun: 'Nyköping',    sampleUrl: 'https://www.nykoping.se/arkiv/kalender/2021-06-14_1330_sammantrade_nykoping-oxelosunds-overformyndarnamnds-protokoll/' },
    { kommun: 'Motala',      sampleUrl: 'https://www.motala.se/uppleva-och-gora/kul-i-motala/aktivitet/queerhang-16/' },
    { kommun: 'Linköping',   sampleUrl: 'https://visitlinkoping.se/evenemang/musik/' },
    { kommun: 'Nybro',       sampleUrl: 'https://nybro.se/uppleva-gora/evenemang/smaka-pa-varlden/' },
    { kommun: 'Mörbylånga',  sampleUrl: 'https://www.morbylanga.se/aktiviteter/hang-med-fritidsgardarna-till-kalkbrottet-sommaren-2026/' },
    { kommun: 'Karlskrona',  sampleUrl: 'https://www.visitkarlskrona.se/sv/upplev/varldsarvsstaden-karlskrona' },
    { kommun: 'Mönsterås',   sampleUrl: 'https://www.monsteras.se/event/skidakning-eller-orientering/' },
    { kommun: 'Landskrona',  sampleUrl: 'https://www.landskrona.se/evenemang/lasergame/' },
    { kommun: 'Falkenberg',  sampleUrl: 'https://falkenberg.se/evenemang/sten-stanley-en-kvall-att-minnas/' },
    { kommun: 'Karlsborg',   sampleUrl: 'https://karlsborg.se/kultur--fritid/fritidsgarden-kabyssen/aktiviteter/paintballskolavslutningen/' },
    { kommun: 'Hedemora',    sampleUrl: 'https://hedemora.se/evenemang/earth-hour/' },
    { kommun: 'Dorotea',     sampleUrl: 'https://www.dorotea.se/kalender/motesplatsen/' },
    { kommun: 'Åsele',       sampleUrl: 'https://www.asele.se/evenemang/kommunfullmaktige-250512/' },
    { kommun: 'Arjeplog',    sampleUrl: 'https://arjeplog.se/uppleva-och-gora/evenemang/arjeplogsdagen/' },
    { kommun: 'Jokkmokk',    sampleUrl: 'https://www.jokkmokk.se/evenemangskalender/evenemang/regnbaagsvecka-i-jokkmokks-kommun/' },
    { kommun: 'Piteå',       sampleUrl: 'https://www.pitea.se/Upplev/Evenemang/nyinvigning-christina-kultur/' },
    { kommun: 'Mora/VisitDalarna', sampleUrl: 'https://www.visitdalarna.se/gora/aktiviteter/topptur-till-stadjan-66-km' },
];

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string | null> {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 15000);
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'sv-SE,sv;q=0.9' },
            signal: ac.signal,
            redirect: 'follow',
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

interface TestResult {
    kommun: string;
    sampleUrl: string;
    httpOk: boolean;
    jsonLdEvent: boolean;
    timeMicrodata: boolean;
    textParser: boolean;
    finalDate?: string;
    h1Text?: string;
    verdict: '✅ JSON-LD' | '🟡 microdata' | '🟢 text-parser' | '⚠️  endast h1' | '❌ inget';
}

async function test(c: Candidate): Promise<TestResult> {
    const html = await fetchHtml(c.sampleUrl);
    if (!html) {
        return { ...c, httpOk: false, jsonLdEvent: false, timeMicrodata: false, textParser: false, verdict: '❌ inget' };
    }

    const blocks = extractJsonLdBlocks(html);
    const nodes: any[] = [];
    for (const b of blocks) collectEvents(b, DEFAULT_EVENT_TYPES, nodes);

    let jsonLdEvent = false;
    let finalDate: string | undefined;
    for (const node of nodes) {
        const ev = jsonLdToRawEvent(node, c.sampleUrl);
        if (ev) {
            jsonLdEvent = true;
            finalDate = ev.startDate.toISOString();
            break;
        }
    }

    const $ = cheerio.load(html);
    const t = $('time[datetime]').first().attr('datetime') ||
              $('[itemprop="startDate"]').attr('content') ||
              $('[itemprop="startDate"]').attr('datetime') || '';
    const h1 = $('h1').first().text().trim();
    const timeMicrodata = !!t && !isNaN(new Date(t).getTime());
    if (!jsonLdEvent && timeMicrodata) finalDate = new Date(t).toISOString();

    // Försök svensk text-parser
    let textParser = false;
    if (!jsonLdEvent && !timeMicrodata) {
        const text = [
            $('.event-info, .event-date, .event-date-time, #event-dates-list, .evenemang-datum, .datum, .date').text(),
            $('main, article, .content').first().text(),
            $('body').text(),
        ].join('\n').slice(0, 5000);
        const parsed = findFirstDateInText(text);
        if (parsed) {
            textParser = true;
            finalDate = parsed.toISOString();
        }
    }

    let verdict: TestResult['verdict'];
    if (jsonLdEvent) verdict = '✅ JSON-LD';
    else if (timeMicrodata) verdict = '🟡 microdata';
    else if (textParser) verdict = '🟢 text-parser';
    else if (h1) verdict = '⚠️  endast h1';
    else verdict = '❌ inget';

    return {
        ...c,
        httpOk: true,
        jsonLdEvent,
        timeMicrodata,
        textParser,
        finalDate,
        h1Text: h1 || undefined,
        verdict,
    };
}

async function main() {
    console.log(`Testar extraktion mot ${CANDIDATES.length} kandidat-URLs…\n`);
    const results: TestResult[] = [];
    for (const c of CANDIDATES) {
        const r = await test(c);
        results.push(r);
        const date = r.finalDate || '—';
        console.log(`${r.verdict.padEnd(22)} ${r.kommun.padEnd(20)} ${date.slice(0, 16).padEnd(18)} ${r.h1Text?.slice(0, 40) || '(ingen h1)'}`);
    }

    console.log('\n=== SAMMANFATTNING ===');
    const groups = results.reduce<Record<string, number>>((acc, r) => {
        acc[r.verdict] = (acc[r.verdict] || 0) + 1;
        return acc;
    }, {});
    for (const [v, n] of Object.entries(groups)) console.log(`  ${v.padEnd(22)} ${n}`);

    const usable = results.filter(r => r.finalDate).map(r => r.kommun);
    if (usable.length > 0) {
        console.log(`\n✅ Användbara med sitemap-engine (${usable.length}): ${usable.join(', ')}`);
    }
    const needsParser = results.filter(r => !r.finalDate).map(r => r.kommun);
    if (needsParser.length > 0) {
        console.log(`\n⚠️  Behöver mer arbete (${needsParser.length}): ${needsParser.join(', ')}`);
    }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
