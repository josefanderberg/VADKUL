/**
 * CLI: kör en eller flera Sources från registryt.
 *
 * Användning:
 *   npm run sources                       # kör alla
 *   npm run sources -- --id=visit         # kör allt med 'visit' i id
 *   npm run sources -- --region=stockholm # kör allt i Stockholm
 *   npm run sources -- --engine=json-ld   # kör allt som använder json-ld
 *   npm run sources -- --concurrency=2    # begränsa parallellism
 *
 * Env-variabler:
 *   SCRAPE_WINDOW_DAYS=30        — hur många dagar framåt vi hämtar
 *   SCRAPE_DOMAIN_INTERVAL_MS=1500 — minsta avstånd mellan requests mot samma domän
 */

import { runSources, summarize, ENGINES, scheduledForToday, summarizeSchedule } from '../sources';
import { SOURCES, filterSources } from '../sources/registry';
import { closeJsonLdBrowser } from '../sources/engines/json-ld';
import { closeXhrDiscoveryBrowser } from '../sources/engines/xhr-discovery';
import { closeSitemapBrowser } from '../sources/engines/sitemap';

function parseArgs(): { id?: string; region?: string; engine?: string; concurrency?: number; dryRun?: boolean; respectSchedule?: boolean } {
    const out: any = {};
    for (const arg of process.argv.slice(2)) {
        if (arg === '--dry-run' || arg === '--dryrun') { out.dryRun = true; continue; }
        if (arg === '--respect-schedule' || arg === '--schedule') { out.respectSchedule = true; continue; }
        const m = arg.match(/^--([^=]+)=(.+)$/);
        if (!m) continue;
        const [, key, val] = m;
        if (key === 'concurrency') out.concurrency = parseInt(val, 10);
        else if (key === 'dry-run' || key === 'dryrun') out.dryRun = val !== 'false';
        else if (key === 'respect-schedule' || key === 'schedule') out.respectSchedule = val !== 'false';
        else out[key] = val;
    }
    return out;
}

async function main() {
    const args = parseArgs();
    let filtered = (args.id || args.region || args.engine)
        ? filterSources({ id: args.id, region: args.region, engine: args.engine })
        : SOURCES.filter((s) => !s.disabled);

    if (args.respectSchedule) {
        console.log(summarizeSchedule(filtered));
        console.log('');
        filtered = scheduledForToday(filtered);
    }

    if (filtered.length === 0) {
        console.error('No sources matched filter:', args);
        process.exit(1);
    }

    console.log(`Window: ${process.env.SCRAPE_WINDOW_DAYS || 30} days`);
    console.log(`Domain interval: ${process.env.SCRAPE_DOMAIN_INTERVAL_MS || 1500} ms`);
    console.log(`Sources to run (${filtered.length}):`);
    for (const s of filtered) console.log(`  - ${s.id} [${s.engine}]`);

    if (args.dryRun) console.log('🔍 DRY RUN — no DB writes\n');

    const results = await runSources(filtered, ENGINES, {
        concurrency: args.concurrency ?? 4,
        dryRun: args.dryRun,
    });
    summarize(results);

    const totalSaved = results.reduce((acc, r) => acc + r.saved, 0);
    console.log(`Done. Saved ${totalSaved} new events.\n`);
    await closeJsonLdBrowser();
    await closeXhrDiscoveryBrowser();
    await closeSitemapBrowser();
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
