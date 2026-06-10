/**
 * Inspect-source — undersökande dry-run av EN källa.
 *
 * Kör källans engine och dumpar RÅA events (titel | datum | url) + en
 * histogram över passerade / i-fönster / framtida. Svarar på "varför sparas
 * 0?": fel mönster (landningssidor), datum i förflutet (utställningar), null-
 * datum (parse-fel), eller bara långt fram (säsong/sommaruppehåll)?
 *
 * Skiljer sig från `smoke` (kanarie-hälsokoll) — det här är felsökning av en
 * specifik underpresterande källa innan vi bestämmer status/mönster.
 *
 * Användning:
 *   npm run inspect -- --id=goteborgsoperan
 *   npm run inspect -- --id=vara-konserthus --limit=40
 */

import { SOURCES } from '../sources/registry';
import { ENGINES } from '../sources';
import { closeSitemapBrowser } from '../sources/engines/sitemap';
import { closeJsonLdBrowser } from '../sources/engines/json-ld';
import { closeXhrDiscoveryBrowser } from '../sources/engines/xhr-discovery';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

const DAY = 24 * 60 * 60 * 1000;

async function main() {
    if (!args.id) { console.error('Ange --id=<source-id>'); process.exit(1); }
    const source = SOURCES.find((s) => s.id === args.id);
    if (!source) { console.error(`Hittar ingen källa: ${args.id}`); process.exit(1); }

    const engine = ENGINES[source.engine];
    if (!engine) { console.error(`Okänd engine: ${source.engine}`); process.exit(1); }

    // Snabb-cap för inspektion: --max begränsar hur många detaljsidor som hämtas.
    const config = args.max ? { ...source.config, maxUrls: parseInt(args.max, 10) } : source.config;

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const realWindowEnd = new Date(now.getTime() + (source.windowDays ?? 30) * DAY);
    // Bredt fönster vid hämtning så inget filtreras bort innan vi sett det.
    const ctx = {
        windowStart: now,
        windowEnd: new Date(now.getTime() + 3650 * DAY),
        log: (m: string) => console.log(`  [${source.id}] ${m}`),
    };

    const limit = parseInt(args.limit || '60', 10);
    console.log(`\n🔬 Inspekterar ${source.id} [${source.engine}] — status=${source.status ?? 'active'}`);
    console.log(`   Fönster för save: ${now.toISOString().slice(0, 10)} → ${realWindowEnd.toISOString().slice(0, 10)} (${source.windowDays ?? 30}d)\n`);

    const events = await engine(config, ctx as any);
    console.log(`\nEngine returnerade ${events.length} events. Visar upp till ${limit}:\n`);

    // Overlap-test: skulle eventet vara i fönstret om vi kollar datum-INTERVALL
    // (startDate ≤ fönstrets slut OCH endDate ≥ fönstrets start) istället för
    // bara startDate? Räddar pågående utställningar.
    const overlaps = (e: any): boolean => {
        if (!e.startDate || isNaN(e.startDate.getTime())) return false;
        const effEnd = e.endDate && !isNaN(e.endDate.getTime()) ? e.endDate : e.startDate;
        return e.startDate < realWindowEnd && effEnd >= now;
    };
    const inWindowNow = (e: any): boolean =>
        e.startDate && !isNaN(e.startDate.getTime()) && e.startDate >= now && e.startDate < realWindowEnd;

    let past = 0, inWindow = 0, future = 0, noDate = 0, withEnd = 0, rescued = 0;
    const sorted = events.slice().sort((a, b) => {
        const ta = a.startDate?.getTime() ?? Infinity;
        const tb = b.startDate?.getTime() ?? Infinity;
        return ta - tb;
    });
    for (const e of sorted.slice(0, limit)) {
        let bucket: string;
        const rescue = !inWindowNow(e) && overlaps(e);
        if (!e.startDate || isNaN(e.startDate.getTime())) bucket = '⬛ inget-datum';
        else if (rescue) bucket = '🟡 overlap   ';  // räddas av overlap-fönstret
        else if (e.startDate < now) bucket = '⬅️  passerat ';
        else if (e.startDate < realWindowEnd) bucket = '✅ i-fönster ';
        else bucket = '➡️  framtid   ';
        const d = e.startDate && !isNaN(e.startDate.getTime()) ? e.startDate.toISOString().slice(0, 10) : '????-??-??';
        const ed = e.endDate && !isNaN(e.endDate.getTime()) ? `→${e.endDate.toISOString().slice(0, 10)}` : '          ';
        console.log(`  ${bucket} ${d}${ed}  ${(e.title || '(ingen titel)').slice(0, 40).padEnd(40)} ${(e.url || '').slice(0, 45)}`);
    }
    // Räkna ALLA (inte bara visade) för histogrammet
    for (const e of events) {
        if (e.endDate && !isNaN(e.endDate.getTime())) withEnd++;
        if (!e.startDate || isNaN(e.startDate.getTime())) { noDate++; continue; }
        if (inWindowNow(e)) inWindow++;
        else if (e.startDate < now) past++;
        else future++;
        if (!inWindowNow(e) && overlaps(e)) rescued++;
    }
    console.log(`\n── Histogram (alla ${events.length}) ──`);
    console.log(`  ⬅️  passerat:    ${past}`);
    console.log(`  ✅ i-fönster:   ${inWindow}   ← sparas idag (startDate-only)`);
    console.log(`  🟡 overlap:    ${rescued}   ← skulle RÄDDAS av overlap-fönstret (pågående nu)`);
    console.log(`  ➡️  framtid:     ${future}   ← glider in senare`);
    console.log(`  ⬛ inget-datum: ${noDate}   ← parse-fel el. landningssidor`);
    console.log(`  (${withEnd}/${events.length} har endDate)`);

    // Diagnos-hint
    console.log('\n── Diagnos ──');
    if (events.length === 0) console.log('  Engine gav 0 events → fel sitemap/mönster, ingen detaljsida matchade.');
    else if (noDate > events.length * 0.5) console.log('  >50% saknar datum → troligen landningssidor el. datum ej i JSON-LD/text. Mönstret behöver skärpas.');
    else if (rescued > 0) console.log(`  ${rescued} events har past-start men framtida endDate → overlap-fönster skulle rädda dem.`);
    else if (inWindow === 0 && future > 0 && past === 0) console.log('  Allt ligger framåt → säsong/sommaruppehåll. Inget fel — glider in via weekly.');
    else if (inWindow === 0 && past > 0 && withEnd === 0) console.log('  Allt passerat, 0 endDate → permanenta/odaterade attraktioner el. arkiv. Overlap hjälper EJ.');
    else if (inWindow === 0 && past > 0) console.log('  Allt passerat (start OCH slut) → genuint tomt nu (off-season/arkiv). Inget att rädda.');
    else console.log(`  ${inWindow} i fönster → källan FUNKAR, borde inte vara 0. Kolla window/dedup.`);

    await closeSitemapBrowser();
    await closeJsonLdBrowser();
    await closeXhrDiscoveryBrowser();
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
