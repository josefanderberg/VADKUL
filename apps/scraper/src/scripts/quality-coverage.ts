/**
 * quality-coverage.ts
 *
 * Fält-täckning PER SCRAPER. Svarar på frågan "hur presterar varje källa —
 * hur stor andel av dess events har bild, beskrivning, pris, kategori, geo?".
 *
 * Till skillnad från:
 *   - teams-daily-report.ts → volym per scraper (found→saved), ingen fält-kvalitet
 *   - post-quality-stats.ts → fält-kvalitet men GLOBALT (inte per scraper)
 *   - coverage.ts           → geografisk kommun-täckning
 * ...visar det här verktyget kvalitets-PROCENT per källa, så man ser exakt
 * vilka scrapers som tappar vilka fält.
 *
 * Universum (default): kommande + synliga events (hidden = 0, time >= nu) —
 * samma som de andra rapporterna mäter.
 *
 * Användning:
 *   npm run quality-coverage                 # text-tabell (totalt + per scraper)
 *   npm run quality-coverage -- --min=50     # bara källor med >=50 events (default 20)
 *   npm run quality-coverage -- --all        # alla källor, ingen tröskel
 *   npm run quality-coverage -- --worst      # bara källor under kvalitets-baren (åtgärdslista)
 *   npm run quality-coverage -- --since=1d   # bara events skapade senaste dygnet (per-körning-vy)
 *   npm run quality-coverage -- --json       # JSON för dashboards
 *   npm run quality-coverage -- --md         # skriv dated snapshot + uppdatera trend i docs/scrapers/coverage/
 *   npm run quality-coverage -- --teams      # posta Adaptive Card till TEAMS_WEBHOOK_URL
 *
 * Beroenden:
 *   - events.db i scraper-roten (SCRAPER_SQLITE_PATH override stöds)
 *   - SOURCES-registry (för engine-mappning per källa)
 *   - TEAMS_WEBHOOK_URL (bara för --teams)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { SOURCES } from '../sources/registry';

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

// ───────────────────────────────────────────────────────────────────────────
//  Argument
// ───────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const args = {
    min: 20,
    all: argv.includes('--all'),
    worst: argv.includes('--worst'),
    json: argv.includes('--json'),
    md: argv.includes('--md'),
    teams: argv.includes('--teams'),
    sinceDays: 0,
};
for (const a of argv) {
    const m1 = a.match(/^--min=(\d+)$/);
    if (m1) args.min = parseInt(m1[1], 10);
    const m2 = a.match(/^--since=(\d+)d$/);
    if (m2) args.sinceDays = parseInt(m2[1], 10);
}
if (args.all) args.min = 0;

// ───────────────────────────────────────────────────────────────────────────
//  Fält-definitioner — lägg till nya kvalitetsfält här
// ───────────────────────────────────────────────────────────────────────────

export interface FieldDef {
    key: string;          // kolumn-nyckel i resultatet
    label: string;        // rubrik i text/teams
    /** SQL-uttryck som ger 1 när fältet räknas som "ifyllt", annars 0. */
    sql: string;
    /** Kvalitets-bar: källor under detta (%) flaggas av --worst. null = mäts ej för worst. */
    bar: number | null;
}

const TEXT_NOT_EMPTY = (col: string) =>
    `CASE WHEN ${col} IS NOT NULL AND TRIM(${col}) NOT IN ('', 'null') THEN 1 ELSE 0 END`;

export const FIELDS: FieldDef[] = [
    { key: 'img',   label: 'Bild',        sql: TEXT_NOT_EMPTY('coverImage'), bar: 50 },
    { key: 'desc',  label: 'Beskrivning', sql: TEXT_NOT_EMPTY('description'), bar: 60 },
    { key: 'price', label: 'Pris',        sql: TEXT_NOT_EMPTY('price'),       bar: null },
    { key: 'cat',   label: 'Kategori',    sql: `CASE WHEN category IS NOT NULL AND TRIM(category) NOT IN ('', 'null', 'other') THEN 1 ELSE 0 END`, bar: 70 },
    { key: 'geo',   label: 'Geo',         sql: `CASE WHEN lat IS NOT NULL AND lat <> 0 AND lng IS NOT NULL AND lng <> 0 THEN 1 ELSE 0 END`, bar: 70 },
    { key: 'time',  label: 'Tid',         sql: `CASE WHEN hasSpecificTime = 1 THEN 1 ELSE 0 END`, bar: null },
];

// ───────────────────────────────────────────────────────────────────────────
//  Datatyper
// ───────────────────────────────────────────────────────────────────────────

export interface Row { host: string; n: number; pct: Record<string, number> }
export interface Report {
    universe: string;
    generatedAt: string;
    total: Row;          // host = '— TOTALT —'
    sources: Row[];      // per hostName, sorterat på n desc
    hiddenSources: number; // antal källor under --min-tröskeln
}

// ───────────────────────────────────────────────────────────────────────────
//  Aggregering
// ───────────────────────────────────────────────────────────────────────────

export interface BuildOpts {
    /** Källor med färre events än så utelämnas ur `sources` (TOTAL räknas alltid på allt). */
    minEvents: number;
    /** >0 → bara events skapade senaste N dygnen (per-körning-vy). */
    sinceDays: number;
}

function whereClause(sinceDays: number): string {
    const parts = [`hidden = 0`, `datetime(time) >= datetime('now')`];
    if (sinceDays > 0) parts.push(`createdAt >= datetime('now', '-${sinceDays} day')`);
    return parts.join(' AND ');
}

function pctOf(part: number, whole: number): number {
    return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

export function buildReport(db: Database.Database, opts: BuildOpts): Report {
    const where = whereClause(opts.sinceDays);
    const sumCols = FIELDS.map(f => `SUM(${f.sql}) AS ${f.key}`).join(',\n    ');

    // Per scraper
    const perHost = db.prepare(`
        SELECT COALESCE(NULLIF(TRIM(hostName), ''), '(saknas)') AS host,
               COUNT(*) AS n,
               ${sumCols}
        FROM link_events
        WHERE ${where}
        GROUP BY host
        ORDER BY n DESC
    `).all() as any[];

    // Totalt
    const totalRow = db.prepare(`
        SELECT COUNT(*) AS n, ${sumCols}
        FROM link_events
        WHERE ${where}
    `).get() as any;

    const toRow = (r: any, host: string): Row => {
        const pct: Record<string, number> = {};
        for (const f of FIELDS) pct[f.key] = pctOf(r[f.key] ?? 0, r.n);
        return { host, n: r.n, pct };
    };

    const all = perHost.map(r => toRow(r, r.host));
    const kept = all.filter(r => r.n >= opts.minEvents);

    return {
        universe: opts.sinceDays > 0
            ? `skapade senaste ${opts.sinceDays}d, kommande + synliga`
            : 'kommande + synliga (hidden=0, time>=nu)',
        generatedAt: new Date().toISOString(),
        total: toRow(totalRow, '— TOTALT —'),
        sources: kept,
        hiddenSources: all.length - kept.length,
    };
}

// ───────────────────────────────────────────────────────────────────────────
//  Engine-mappning (hostName → engine, best-effort via registry)
// ───────────────────────────────────────────────────────────────────────────

const engineByHost = new Map<string, string>();
for (const s of SOURCES) engineByHost.set(s.hostName, s.engine);
const engineFor = (host: string) => engineByHost.get(host) ?? '';

// ───────────────────────────────────────────────────────────────────────────
//  Rendering — text
// ───────────────────────────────────────────────────────────────────────────

function isWorst(r: Row): boolean {
    return FIELDS.some(f => f.bar !== null && r.pct[f.key] < (f.bar as number));
}

function flagsFor(r: Row): string {
    // Markera fält under sin bar med ↓
    return FIELDS.filter(f => f.bar !== null && r.pct[f.key] < (f.bar as number))
        .map(f => f.label.toLowerCase()).join(',');
}

function pad(s: string | number, w: number, right = false): string {
    const str = String(s);
    return right ? str.padStart(w) : str.padEnd(w);
}

function renderText(rep: Report): string {
    const lines: string[] = [];
    lines.push(`📊 Fält-täckning per scraper — ${rep.universe}`);
    lines.push(`   ${rep.generatedAt.slice(0, 16).replace('T', ' ')} · totalt ${rep.total.n} events`);
    lines.push('');

    // Header
    const HOST_W = 28;
    const header = pad('Scraper', HOST_W) + pad('n', 6, true) + '  '
        + FIELDS.map(f => pad(f.label.slice(0, 5), 6, true)).join('') + '  engine';
    lines.push(header);
    lines.push('─'.repeat(header.length));

    // Totalrad först
    const totalLine = pad(rep.total.host, HOST_W) + pad(rep.total.n, 6, true) + '  '
        + FIELDS.map(f => pad(rep.total.pct[f.key], 6, true)).join('');
    lines.push(totalLine);
    lines.push('');

    const shown = args.worst ? rep.sources.filter(isWorst) : rep.sources;
    for (const r of shown) {
        const line = pad(r.host.slice(0, HOST_W - 1), HOST_W)
            + pad(r.n, 6, true) + '  '
            + FIELDS.map(f => pad(r.pct[f.key], 6, true)).join('')
            + '  ' + engineFor(r.host);
        lines.push(line);
    }

    lines.push('');
    if (args.worst) {
        lines.push(`(${shown.length} källor under kvalitets-baren av ${rep.sources.length} visade)`);
    } else if (rep.hiddenSources > 0) {
        lines.push(`(+${rep.hiddenSources} källor under --min=${args.min}; använd --all för alla)`);
    }
    lines.push('Siffror = % av källans events med fältet ifyllt.');
    return lines.join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
//  Rendering — markdown (dated snapshot + rolling trend)
// ───────────────────────────────────────────────────────────────────────────

function renderMarkdown(rep: Report): string {
    const head = `| Scraper | n | ${FIELDS.map(f => f.label).join(' | ')} | engine |`;
    const sep = `|---|--:|${FIELDS.map(() => '--:').join('|')}|---|`;
    const totalLine = `| **${rep.total.host}** | **${rep.total.n}** | `
        + FIELDS.map(f => `**${rep.total.pct[f.key]}**`).join(' | ') + ' | |';
    const rows = rep.sources.map(r =>
        `| ${r.host} | ${r.n} | ${FIELDS.map(f => r.pct[f.key]).join(' | ')} | ${engineFor(r.host)} |`);

    return [
        `# Fält-täckning per scraper — ${rep.generatedAt.slice(0, 10)}`,
        '',
        `Universum: ${rep.universe}. Totalt ${rep.total.n} events. Källor med ≥${args.min} events.`,
        `Siffror = % av källans events med fältet ifyllt.`,
        '',
        head, sep, totalLine, ...rows,
        '',
    ].join('\n');
}

function writeMarkdown(rep: Report): { snapshot: string; trend: string } {
    const dir = path.resolve(__dirname, '../../../../docs/scrapers/coverage');
    fs.mkdirSync(dir, { recursive: true });

    const date = rep.generatedAt.slice(0, 10);
    const snapshot = path.join(dir, `${date}.md`);
    fs.writeFileSync(snapshot, renderMarkdown(rep), 'utf-8');

    // Rolling trend: en rad per körning med TOTAL-procenten
    const trend = path.join(dir, 'TREND.md');
    const trendHead = `| Datum | n | ${FIELDS.map(f => f.label).join(' | ')} |`;
    const trendSep = `|---|--:|${FIELDS.map(() => '--:').join('|')}|`;
    const trendRow = `| ${date} | ${rep.total.n} | ${FIELDS.map(f => rep.total.pct[f.key]).join(' | ')} |`;

    if (!fs.existsSync(trend)) {
        fs.writeFileSync(trend, [
            '# Fält-täckning — trend (TOTAL per körning)',
            '',
            'En rad per `npm run quality-coverage -- --md`. Senaste överst.',
            '',
            trendHead, trendSep, trendRow, '',
        ].join('\n'), 'utf-8');
    } else {
        const existing = fs.readFileSync(trend, 'utf-8');
        // Sätt in ny rad direkt efter separator-raden (senaste överst), byt ut om samma datum redan finns
        const lines = existing.split('\n');
        const sepIdx = lines.findIndex(l => l.startsWith('|---'));
        if (sepIdx >= 0) {
            const filtered = lines.filter((l, i) => !(i > sepIdx && l.startsWith(`| ${date} |`)));
            const sepIdx2 = filtered.findIndex(l => l.startsWith('|---'));
            filtered.splice(sepIdx2 + 1, 0, trendRow);
            fs.writeFileSync(trend, filtered.join('\n'), 'utf-8');
        }
    }
    return { snapshot, trend };
}

// ───────────────────────────────────────────────────────────────────────────
//  Teams Adaptive Card (TOTAL + topp-svaga källor)
// ───────────────────────────────────────────────────────────────────────────

function buildCard(rep: Report) {
    const totalFacts = FIELDS.map(f => ({
        title: f.label,
        value: `${rep.total.pct[f.key]}%`,
    }));

    const worst = rep.sources.filter(isWorst).slice(0, 8);
    const worstFacts = worst.length
        ? worst.map(r => ({ title: r.host.slice(0, 24), value: `${r.n}st · saknar: ${flagsFor(r)}` }))
        : [{ title: '—', value: 'Inga källor under baren 🎉' }];

    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                msteams: { width: 'Full' },
                body: [
                    { type: 'TextBlock', text: '📊 Fält-täckning per scraper',
                      weight: 'Bolder', size: 'Large', color: 'accent' },
                    { type: 'TextBlock', isSubtle: true, spacing: 'None', wrap: true,
                      text: `${rep.universe} · ${rep.total.n} events` },
                    { type: 'TextBlock', text: 'TOTAL', weight: 'Bolder', spacing: 'Medium' },
                    { type: 'FactSet', facts: totalFacts },
                    { type: 'TextBlock', text: '⚠️ Under kvalitets-baren', weight: 'Bolder',
                      spacing: 'Medium', color: 'warning' },
                    { type: 'FactSet', facts: worstFacts },
                ],
            },
        }],
    };
}

async function postTeams(rep: Report): Promise<void> {
    const webhook = process.env.TEAMS_WEBHOOK_URL;
    if (!webhook) {
        console.error('⚠️ TEAMS_WEBHOOK_URL inte satt — skippar Teams-postningen.');
        return;
    }
    const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCard(rep)),
    });
    if (res.status !== 200 && res.status !== 202) {
        const txt = await res.text().catch(() => '');
        console.error(`❌ Teams POST → HTTP ${res.status}: ${txt.slice(0, 300)}`);
        process.exit(1);
    }
    console.log(`✅ Fält-täckning postad till Teams (HTTP ${res.status})`);
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
    const db = new Database(DB_PATH, { readonly: true });
    let rep: Report;
    try {
        rep = buildReport(db, { minEvents: args.min, sinceDays: args.sinceDays });
    } finally {
        db.close();
    }

    if (args.json) {
        console.log(JSON.stringify(rep, null, 2));
        return;
    }

    console.log(renderText(rep));

    if (args.md) {
        const { snapshot, trend } = writeMarkdown(rep);
        console.log(`\n📝 Skrev ${path.relative(process.cwd(), snapshot)}`);
        console.log(`📈 Uppdaterade ${path.relative(process.cwd(), trend)}`);
    }

    if (args.teams) await postTeams(rep);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal:', err);
        process.exit(1);
    });
}
