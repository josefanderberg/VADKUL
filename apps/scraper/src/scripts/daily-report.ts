/**
 * daily-report.ts (hette teams-daily-report.ts t.o.m. 2026-09-04)
 *
 * Daglig Telegram-rapport byggd på `scrape_runs`-tabellen (inte logg-grep).
 * Ger en per-scraper-bild av senaste dygnets körningar:
 *
 *   🤖 VADKUL Scraper · 2026-06-11 07:15
 *   ✅ OK · 289 körningar · 47 min
 *   📊 Aktiva 172 / 😴 Inaktiva 3
 *      found 28 541 → saved 1 124 · hidden 0 · fel 0
 *
 *   🏆 Mest produktiva   (top sources efter saved)
 *   ⚠️ Behöver ses över  (hög found men 0 saved)
 *   😴 Inaktiva >24h     (i registry men ej körd senaste dygnet)
 *
 * Definitioner (enligt spec):
 *   - "Aktiv"   = körd senaste 24h med >0 found ELLER >0 saved
 *   - "Inaktiv" = i registry (status ≠ dead, ej disabled) men EJ körd senaste 24h.
 *                 Varje namn taggas med sin updateFrequency så att källor som
 *                 medvetet körs glesare (weekly/every-3d) syns som förväntade.
 *
 * Körning:
 *   npm run daily-report          # postar till Telegram (TG_BOT_TOKEN + TG_CHAT_ID)
 *   npm run daily-report -- --dry # bygger + skriver ut, postar INGET
 *
 * Beroenden:
 *   - TG_BOT_TOKEN + TG_CHAT_ID i miljön (sätts av run-daily.sh från ~/.vadkul-secrets/env)
 *   - events.db i scraper-roten (samma som recordScrapeRun skriver till)
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import 'dotenv/config';
import { SOURCES } from '../sources/registry';
import { sendMessage, isTelegramConfigured } from '../utils/telegram';
import { preBlock, clampTelegram } from '../utils/telegramReport';

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

const WINDOW = "-1 day";   // "senaste 24h"

// ───────────────────────────────────────────────────────────────────────────
//  Datatyper
// ───────────────────────────────────────────────────────────────────────────

interface RunRow {
    source_id: string;
    host_name: string;
    started_at: string;
    duration_ms: number;
    found: number;
    saved: number;
    hidden_count: number;
    error_count: number;
}

interface SourceAgg {
    sourceId: string;
    hostName: string;
    runs: number;
    found: number;
    saved: number;
    hidden: number;
    errors: number;
    lastRun: string;
}

interface Report {
    runs: number;
    spanMs: number;
    found: number;
    saved: number;
    hidden: number;
    errors: number;
    activeCount: number;
    inactiveCount: number;
    topProducers: SourceAgg[];
    needsReview: SourceAgg[];
    inactive: Array<{ id: string; hostName: string; freq: string }>;
}

// ───────────────────────────────────────────────────────────────────────────
//  Aggregering
// ───────────────────────────────────────────────────────────────────────────

/**
 * Wall-clock-tid för huvudsvepet. Ett 24h-fönster fångar både nattens stora
 * batch och timvisa källor utspridda över dygnet, så hela fönstrets spann säger
 * inget. Vi klustrar körningarna (glapp > 30 min bryter ett kluster) och tar
 * spannet för det kluster som har FLEST körningar — dvs det dagliga huvudsvepet.
 * Robust mot enstaka släpande timkörningar i svansen av fönstret.
 */
function mainSweepSpanMs(rows: RunRow[]): number {
    const GAP = 30 * 60 * 1000;
    const items = rows
        .map(r => { const s = Date.parse(r.started_at); return { s, e: s + (r.duration_ms || 0) }; })
        .filter(x => !isNaN(x.s))
        .sort((a, b) => a.s - b.s);
    if (!items.length) return 0;

    let best = { count: 0, span: 0 };
    let clusterStart = items[0].s, clusterEnd = items[0].e, count = 1;
    const flush = () => { if (count > best.count) best = { count, span: clusterEnd - clusterStart }; };

    for (let i = 1; i < items.length; i++) {
        if (items[i].s - clusterEnd <= GAP) {
            clusterEnd = Math.max(clusterEnd, items[i].e);
            count++;
        } else {
            flush();
            clusterStart = items[i].s; clusterEnd = items[i].e; count = 1;
        }
    }
    flush();
    return best.span;
}

function buildReport(db: Database.Database): Report {
    const rows = db.prepare<[string], RunRow>(`
        SELECT source_id, host_name, started_at, duration_ms,
               found, saved, hidden_count, error_count
        FROM scrape_runs
        WHERE started_at >= datetime('now', ?)
    `).all(WINDOW);

    // Per-source aggregering
    const bySource = new Map<string, SourceAgg>();
    let found = 0, saved = 0, hidden = 0, errors = 0;

    for (const r of rows) {
        found  += r.found || 0;
        saved  += r.saved || 0;
        hidden += r.hidden_count || 0;
        errors += r.error_count || 0;

        let agg = bySource.get(r.source_id);
        if (!agg) {
            agg = { sourceId: r.source_id, hostName: r.host_name, runs: 0,
                    found: 0, saved: 0, hidden: 0, errors: 0, lastRun: r.started_at };
            bySource.set(r.source_id, agg);
        }
        agg.runs++;
        agg.found  += r.found || 0;
        agg.saved  += r.saved || 0;
        agg.hidden += r.hidden_count || 0;
        agg.errors += r.error_count || 0;
        if (r.started_at > agg.lastRun) agg.lastRun = r.started_at;
        if (r.host_name) agg.hostName = r.host_name;
    }

    const sources = [...bySource.values()];

    // Aktiv = körd 24h med >0 found ELLER >0 saved
    const activeIds = new Set(sources.filter(s => s.found > 0 || s.saved > 0).map(s => s.sourceId));
    const ranIds    = new Set(sources.map(s => s.sourceId));

    // Inaktiv = i registry (ej dead/disabled) men ej körd senaste 24h
    const eligible = SOURCES.filter(s => s.status !== 'dead' && !s.disabled);
    const inactive = eligible
        .filter(s => !ranIds.has(s.id))
        .map(s => ({ id: s.id, hostName: s.hostName, freq: s.updateFrequency ?? 'daily' }))
        .sort((a, b) => a.hostName.localeCompare(b.hostName, 'sv'));

    // Top-producenter (efter saved, kräver >0 saved)
    const topProducers = sources
        .filter(s => s.saved > 0)
        .sort((a, b) => b.saved - a.saved)
        .slice(0, 5);

    // Behöver ses över: hög found men inget (eller nästan inget) sparat
    const needsReview = sources
        .filter(s => s.found >= 20 && s.saved === 0)
        .sort((a, b) => b.found - a.found)
        .slice(0, 6);

    return {
        runs: rows.length,
        spanMs: mainSweepSpanMs(rows),
        found, saved, hidden, errors,
        activeCount: activeIds.size,
        inactiveCount: inactive.length,
        topProducers,
        needsReview,
        inactive,
    };
}

// ───────────────────────────────────────────────────────────────────────────
//  Formatering
// ───────────────────────────────────────────────────────────────────────────

/** Tusentalsavgränsare med blanksteg (sv-SE): 28541 → "28 541". */
function n(v: number): string {
    return v.toLocaleString('sv-SE');
}

/** ms → "47 min" / "1h 12m" / "38 s". */
function fmtSpan(ms: number): string {
    if (ms <= 0) return '0 s';
    const totalMin = Math.round(ms / 60_000);
    if (totalMin < 1) return `${Math.round(ms / 1000)} s`;
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtNow(): string {
    const d = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Korta ned ett värdnamn så FactSet-titlarna inte blir orimligt breda. */
function shortName(name: string, max = 22): string {
    return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

// ───────────────────────────────────────────────────────────────────────────
//  Plain-text rendering (Telegram <pre>, --dry och loggar)
// ───────────────────────────────────────────────────────────────────────────

function renderText(rep: Report): string {
    const status = rep.errors === 0 ? '✅ OK' : `⚠️ ${rep.errors} fel`;
    const lines: string[] = [];
    lines.push(`🤖 VADKUL Scraper · ${fmtNow()}`);
    lines.push(`${status} · ${n(rep.runs)} körningar · ${fmtSpan(rep.spanMs)}`);
    lines.push(`📊 Aktiva ${n(rep.activeCount)} / 😴 Inaktiva ${n(rep.inactiveCount)}`);
    lines.push(`   found ${n(rep.found)} → saved ${n(rep.saved)} · hidden ${n(rep.hidden)} · fel ${n(rep.errors)}`);
    lines.push('');
    lines.push('🏆 Mest produktiva');
    if (rep.topProducers.length) {
        for (const s of rep.topProducers) lines.push(`   ${shortName(s.hostName).padEnd(24)} ${n(s.saved)} nya`);
    } else {
        lines.push('   (inga events sparade senaste dygnet)');
    }
    if (rep.needsReview.length) {
        lines.push('');
        lines.push('⚠️ Behöver ses över (hög found, 0 saved)');
        for (const s of rep.needsReview) {
            lines.push(`   ${shortName(s.hostName).padEnd(24)} ${n(s.found)} found · ${n(s.saved)} saved`);
        }
    }
    if (rep.inactive.length) {
        const CAP = 15;
        const shown = rep.inactive.slice(0, CAP)
            .map(s => `${s.hostName}${s.freq !== 'daily' ? ` (${s.freq})` : ''}`).join(', ');
        const extra = rep.inactive.length > CAP ? ` …+${rep.inactive.length - CAP} till` : '';
        lines.push('');
        lines.push(`😴 Inaktiva >24h (${n(rep.inactive.length)}): ${shown}${extra}`);
    }
    return lines.join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
    const dry = process.argv.includes('--dry');

    const db = new Database(DB_PATH, { readonly: true });
    let rep: Report;
    try {
        rep = buildReport(db);
    } finally {
        db.close();
    }

    const text = renderText(rep);
    console.log(text);
    if (dry) return;

    if (!isTelegramConfigured()) {
        console.error('⚠️ TG_BOT_TOKEN/TG_CHAT_ID inte satta — skippar Telegram-postningen.');
        process.exit(0);
    }
    const id = await sendMessage(clampTelegram(preBlock(text)));
    if (!id) {
        console.error('❌ Telegram: sendMessage misslyckades.');
        process.exit(1);
    }
    console.log(`✅ Daglig scraper-rapport postad till Telegram (msg ${id})`);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
