/**
 * backfill-run.ts  — backfill-ORKESTRATOR
 *
 * "Uppdatera scraporna automatiskt", steg 1: läs fält-täckningen (samma motor
 * som quality-coverage), hitta vilka fält som har luckor, och kör rätt
 * BEFINTLIGA backfill-script mot dem. Mäter täckningen före → efter.
 *
 * Den RÖR INTE scraper-koden. Den fyller hål i datan med verktyg som redan finns:
 *
 *   geo   (lat=0)        → backfill-geocode   (Nominatim, --limit budget)
 *   bild  (saknas)       → backfill-images    (Puppeteer)
 *   fb    (geo/kat/pris) → llm-enrich         (Ollama, BARA Facebook-events)
 *
 * Luckor som INTE går att backfilla (kräver scraper-fix = steg 2):
 *   - beskrivning: finns inget verktyg — måste komma från scrapern
 *   - kategori/pris för icke-FB-källor: bara FB täcks av llm-enrich idag
 * ...rapporteras ärligt på slutet så de inte ser ut att vara lösta.
 *
 * Säkerhet: DRY-RUN som standard. Inget skrivs förrän --apply. Varje steg
 * gatas på täckningen (hoppar steg vars fält redan ligger ≥ tröskeln).
 *
 * Användning:
 *   npm run backfill-run -- --plan       # visa BARA planen (gating-beslut), spawnar inget
 *   npm run backfill-run                 # dry-run: visa plan + vad varje steg skulle göra
 *   npm run backfill-run -- --apply      # skarpt: kör backfills och skriv
 *   npm run backfill-run -- --only=geo,img
 *   npm run backfill-run -- --skip=fb
 *   npm run backfill-run -- --apply --limit=300   # Nominatim-budget för geo-steget
 *   npm run backfill-run -- --apply --with-refine # ta även med geo-refine
 *
 * Beroenden: events.db, samt de externa tjänster respektive steg använder
 * (Nominatim/Ollama/Puppeteer). Saknas en tjänst hoppar barn-scriptet själv över.
 */

import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import * as path from 'path';
import 'dotenv/config';
import { buildReport, FIELDS, Row } from './quality-coverage';

const SCRAPER_ROOT = path.resolve(__dirname, '../../');
const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(SCRAPER_ROOT, 'events.db');

// ───────────────────────────────────────────────────────────────────────────
//  Argument
// ───────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const PLAN_ONLY = argv.includes('--plan');
const WITH_REFINE = argv.includes('--with-refine');
const limitArg = argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? limitArg.split('=')[1] : null;
const onlyArg = argv.find(a => a.startsWith('--only='));
const skipArg = argv.find(a => a.startsWith('--skip='));
const ONLY = onlyArg ? onlyArg.split('=')[1].split(',').map(s => s.trim()) : null;
const SKIP = skipArg ? skipArg.split('=')[1].split(',').map(s => s.trim()) : [];

// ───────────────────────────────────────────────────────────────────────────
//  Plan — vilka backfills finns, vad de förbättrar, hur de körs
// ───────────────────────────────────────────────────────────────────────────

interface Step {
    key: string;            // för --only / --skip
    label: string;
    npm: string;            // npm-script-namn i apps/scraper/package.json
    /** Vilket täckningsfält steget rör — för gating + delta-rubrik. */
    field: string;
    /** Kör bara om TOTAL[field] < detta (%). */
    gateBelow: number;
    dryArgs: string[];      // flaggor i dry-läge
    applyArgs: string[];    // flaggor i skarpt läge
    applyOnly?: boolean;    // saknar dry-run → körs bara med --apply
    acceptsLimit?: boolean; // stödjer --limit=N
    external: string;       // vad det belastar
    inDefault: boolean;     // med i standard-planen (annars opt-in)
}

const STEPS: Step[] = [
    {
        key: 'geo', label: 'Geo — geocoda lat=0', npm: 'backfill-geocode', field: 'geo',
        gateBelow: 99, dryArgs: [], applyArgs: ['--apply'], acceptsLimit: true,
        external: 'Nominatim', inDefault: true,
    },
    {
        key: 'img', label: 'Bild — hämta saknade omslag', npm: 'backfill-images', field: 'img',
        gateBelow: 99, dryArgs: ['--dry-run'], applyArgs: [],   // OBS: default-apply, dry kräver flagga
        external: 'Puppeteer', inDefault: true,
    },
    {
        key: 'fb', label: 'FB-enrich — geo/kategori/pris (Facebook)', npm: 'llm-enrich', field: 'geo',
        gateBelow: 99, dryArgs: [], applyArgs: [], applyOnly: true,
        external: 'Ollama', inDefault: true,
    },
    {
        key: 'refine', label: 'Geo-refine — förbättra befintliga koordinater', npm: 'geo-refine', field: 'geo',
        gateBelow: 100, dryArgs: [], applyArgs: ['--apply'], acceptsLimit: true,
        external: 'Nominatim', inDefault: false,   // opt-in via --with-refine
    },
];

// ───────────────────────────────────────────────────────────────────────────
//  Hjälp
// ───────────────────────────────────────────────────────────────────────────

function totals(): Row {
    const db = new Database(DB_PATH, { readonly: true });
    try {
        return buildReport(db, { minEvents: 0, sinceDays: 0 }).total;
    } finally {
        db.close();
    }
}

function labelOf(fieldKey: string): string {
    return FIELDS.find(f => f.key === fieldKey)?.label ?? fieldKey;
}

function cmdFor(step: Step): string[] {
    const flags = APPLY ? [...step.applyArgs] : [...step.dryArgs];
    if (step.acceptsLimit && LIMIT) flags.push(`--limit=${LIMIT}`);
    return ['run', step.npm, ...(flags.length ? ['--', ...flags] : [])];
}

function runStep(step: Step): { ran: boolean; code: number | null } {
    const cmd = cmdFor(step);
    console.log(`\n▶  ${step.label}`);
    console.log(`   $ npm ${cmd.join(' ')}   (${step.external})`);

    const res = spawnSync('npm', cmd, { cwd: SCRAPER_ROOT, stdio: 'inherit', env: process.env });
    return { ran: true, code: res.status };
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

function selectedSteps(): Step[] {
    let steps = STEPS.filter(s => s.inDefault || (s.key === 'refine' && WITH_REFINE));
    if (ONLY) steps = STEPS.filter(s => ONLY.includes(s.key));   // --only åsidosätter default-urval
    steps = steps.filter(s => !SKIP.includes(s.key));
    return steps;
}

type Decision = 'run' | 'skip-gate' | 'skip-applyonly';

function decide(step: Step, before: Row): Decision {
    if (step.applyOnly && !APPLY) return 'skip-applyonly';
    if (before.pct[step.field] >= step.gateBelow) return 'skip-gate';
    return 'run';
}

async function main() {
    const mode = PLAN_ONLY ? '— PLAN (spawnar inget)' : APPLY ? '— APPLY (skriver)' : '— DRY-RUN (skriver inget)';
    console.log('🔧 Backfill-orkestrator', mode);

    const before = totals();
    console.log(`\nTäckning före (${before.n} kommande synliga events):`);
    for (const f of FIELDS) console.log(`   ${f.label.padEnd(12)} ${String(before.pct[f.key]).padStart(5)}%`);

    const steps = selectedSteps();

    // Plan-läge: visa beslut + exakt kommando per steg, kör inget.
    if (PLAN_ONLY) {
        console.log(`\nPlan (${steps.length} steg i urvalet):`);
        for (const step of steps) {
            const d = decide(step, before);
            const tag = d === 'run' ? '✅ KÖR'
                : d === 'skip-gate' ? `⏭ hoppas (${labelOf(step.field)} ${before.pct[step.field]}% ≥${step.gateBelow})`
                : '⏭ hoppas (apply-only i dry-läge)';
            console.log(`   ${tag.padEnd(40)} ${step.label}`);
            if (d === 'run') console.log(`      $ npm ${cmdFor(step).join(' ')}   (${step.external})`);
        }
        console.log(`\n(plan-läge — inget kördes. Lägg till --apply för skarp körning.)`);
        return;
    }

    const skippedGate: string[] = [];
    const skippedApplyOnly: string[] = [];
    const executed: Step[] = [];

    for (const step of steps) {
        const d = decide(step, before);
        if (d === 'skip-applyonly') {
            skippedApplyOnly.push(step.key);
            console.log(`\n⏭  ${step.label} — apply-only (saknar dry-run), hoppas i dry-läge`);
            continue;
        }
        if (d === 'skip-gate') {
            skippedGate.push(step.key);
            console.log(`\n⏭  ${step.label} — ${labelOf(step.field)} redan ${before.pct[step.field]}% (≥${step.gateBelow}), hoppas`);
            continue;
        }
        const { code } = runStep(step);
        if (code !== 0) console.log(`   ⚠️  ${step.npm} avslutade med kod ${code}`);
        executed.push(step);
    }

    // Delta — bara meningsfullt när vi faktiskt skrev
    if (APPLY && executed.length) {
        const after = totals();
        console.log(`\n📈 Täckning efter:`);
        console.log(`   ${'Fält'.padEnd(12)} ${'före'.padStart(6)} ${'efter'.padStart(7)}  Δ`);
        for (const f of FIELDS) {
            const b = before.pct[f.key], a = after.pct[f.key];
            const d = Math.round((a - b) * 10) / 10;
            const arrow = d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '–';
            console.log(`   ${f.label.padEnd(12)} ${String(b).padStart(5)}% ${String(a).padStart(6)}%  ${arrow}`);
        }
    } else if (!APPLY) {
        console.log(`\n(dry-run — inget skrevs. Kör med --apply för att backfilla på riktigt.)`);
    }

    // Ärlig rapport om vad backfill INTE kan lösa
    console.log(`\n📋 Inte backfill-bart (kräver scraper-fix, steg 2):`);
    console.log(`   • Beskrivning (${before.pct.desc}%) — inget verktyg; måste komma från scrapern.`);
    console.log(`   • Kategori/pris för icke-FB-källor — bara Facebook täcks av llm-enrich idag.`);
    console.log(`   Kör  npm run quality-coverage -- --worst  för att se vilka källor det gäller.`);

    if (skippedGate.length) console.log(`\nHoppade (redan bra): ${skippedGate.join(', ')}`);
    if (skippedApplyOnly.length) console.log(`Hoppade (apply-only i dry-läge): ${skippedApplyOnly.join(', ')}`);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
