/**
 * Smoke-test — kör en representativ källa per engine i dry-run och larmar
 * om något grundläggande är trasigt.
 *
 * Tanken: ett snabbt ja/nej-svar på "fungerar grunderna än?" innan vi
 * petar på registry, engines eller utökar mängden källor. Körs i dryRun
 * så ingenting skrivs till Firestore/sqlite.
 *
 * Användning:
 *   npm run smoke                  # alla checks
 *   npm run smoke -- --engine=sitemap   # bara en engine
 *   npm run smoke -- --json        # JSON-output (för CI/hooks)
 *
 * Exit-kod 0 om alla checks gick, 1 annars.
 */

import { runSource } from '../sources/runner';
import { ENGINES } from '../sources';
import { SOURCES } from '../sources/registry';
import { closeJsonLdBrowser } from '../sources/engines/json-ld';
import { closeXhrDiscoveryBrowser } from '../sources/engines/xhr-discovery';
import { closeSitemapBrowser } from '../sources/engines/sitemap';

interface SmokeCheck {
    /** Vilken Source.id i registry vi använder som kanariefågel */
    sourceId: string;
    /** Engine-namnet — bara för rapporten */
    engine: string;
    /** Minsta antal events vi förväntar oss att engine returnerar */
    minEvents: number;
    /** Max-tid innan vi sätter en check som timeout (s) */
    timeoutSec: number;
    /**
     * Engine-config-overrides för smoke. Främst för att kapa maxUrls på stora
     * sitemap-källor så testet håller sig under timeoutSec även när per-domän-
     * throttle (1.5s) tvingar fetch-loopen seriellt.
     */
    configOverrides?: Record<string, any>;
    /** Frivillig kommentar */
    note?: string;
}

// En källa per engine — välj de som är pålitliga och små nog att svara snabbt.
const CHECKS: SmokeCheck[] = [
    {
        sourceId: 'bastad',
        engine: 'wp-rest',
        minEvents: 5,
        timeoutSec: 60,
        note: 'Tribe — färska event-datum direkt i API:t',
    },
    {
        // Motala har 131 URLs och tar ~3.5 min med 1.5s/domän-throttle, så
        // för smoke kapar vi till 10 URLs. Räcker för att veta att engine
        // + text-parser fungerar.
        sourceId: 'motala',
        engine: 'sitemap',
        minEvents: 1,
        timeoutSec: 90,
        configOverrides: { maxUrls: 10 },
        note: 'Sitemap med svensk text-parser (cap 10 URLs)',
    },
    {
        sourceId: 'malmo',
        engine: 'sitevision',
        minEvents: 5,
        timeoutSec: 60,
        note: 'Sitevision soleil.eventListingLocal',
    },
    {
        sourceId: 'visit-stockholm',
        engine: 'nextjs-data',
        minEvents: 5,
        timeoutSec: 90,
        note: '__NEXT_DATA__ extraction',
    },
    {
        sourceId: 'goteborg-co',
        engine: 'nuxt-data',
        minEvents: 5,
        timeoutSec: 90,
        note: '__NUXT_DATA__ (devalue)',
    },
];

interface SmokeResult {
    sourceId: string;
    engine: string;
    pass: boolean;
    found: number;
    minEvents: number;
    durationMs: number;
    failures: string[];
}

function parseArgs(): { engine?: string; json?: boolean } {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--json') { out.json = true; continue; }
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
}

async function runWithTimeout<T>(p: Promise<T>, timeoutSec: number, label: string): Promise<T> {
    return await Promise.race([
        p,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`timeout efter ${timeoutSec}s`)), timeoutSec * 1000),
        ),
    ]).catch((e) => {
        throw new Error(`${label}: ${(e as Error).message}`);
    });
}

async function runOne(check: SmokeCheck): Promise<SmokeResult> {
    const source = SOURCES.find(s => s.id === check.sourceId);
    const failures: string[] = [];
    const started = Date.now();

    if (!source) {
        return {
            sourceId: check.sourceId,
            engine: check.engine,
            pass: false,
            found: 0,
            minEvents: check.minEvents,
            durationMs: 0,
            failures: [`source '${check.sourceId}' finns inte i registry`],
        };
    }

    if (source.engine !== check.engine) {
        failures.push(`engine-mismatch: registry säger '${source.engine}', check förväntade '${check.engine}'`);
    }

    const sourceForRun = check.configOverrides
        ? { ...source, config: { ...source.config, ...check.configOverrides } }
        : source;

    try {
        const result = await runWithTimeout(
            runSource(sourceForRun, ENGINES, { dryRun: true }),
            check.timeoutSec,
            check.sourceId,
        );
        if (result.errors.length > 0) {
            failures.push(`engine-fel: ${result.errors[0]}`);
        }
        if (result.found < check.minEvents) {
            failures.push(`för få events: ${result.found} < ${check.minEvents}`);
        }
        return {
            sourceId: check.sourceId,
            engine: check.engine,
            pass: failures.length === 0,
            found: result.found,
            minEvents: check.minEvents,
            durationMs: result.durationMs,
            failures,
        };
    } catch (e) {
        failures.push((e as Error).message);
        return {
            sourceId: check.sourceId,
            engine: check.engine,
            pass: false,
            found: 0,
            minEvents: check.minEvents,
            durationMs: Date.now() - started,
            failures,
        };
    }
}

async function main() {
    const args = parseArgs();
    const checks = args.engine ? CHECKS.filter(c => c.engine === args.engine) : CHECKS;

    if (checks.length === 0) {
        console.error(`Inga checks matchar --engine=${args.engine}`);
        process.exit(1);
    }

    if (!args.json) {
        console.log(`\n🚬 Smoke-test: ${checks.length} källor i dry-run\n`);
    }

    const results: SmokeResult[] = [];
    // Seriellt — varje engine får hela bandbredden, lättare att felsöka logg.
    for (const c of checks) {
        if (!args.json) {
            process.stdout.write(`  ${c.sourceId.padEnd(20)} [${c.engine.padEnd(13)}] ... `);
        }
        const r = await runOne(c);
        results.push(r);
        if (!args.json) {
            const tag = r.pass ? '✅' : '❌';
            console.log(`${tag} found=${r.found} (≥${r.minEvents}) ${r.durationMs}ms`);
            for (const f of r.failures) console.log(`     ↳ ${f}`);
        }
    }

    await closeJsonLdBrowser();
    await closeXhrDiscoveryBrowser();
    await closeSitemapBrowser();

    const passed = results.filter(r => r.pass).length;
    const allPass = passed === results.length;

    if (args.json) {
        console.log(JSON.stringify({ allPass, passed, total: results.length, results }, null, 2));
    } else {
        console.log(`\n${allPass ? '✅' : '❌'} ${passed}/${results.length} passerade\n`);
    }
    process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });
