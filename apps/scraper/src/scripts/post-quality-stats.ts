/**
 * post-quality-stats.ts
 *
 * Postar ett ANDRA Teams-kort (~1 min efter huvudkortet från run-daily.sh).
 * Innehåller LLM-audit-kvalitet och 7-dagars tillväxttrend:
 *
 *   - Pris-extraktion: hur många av senaste dygnets events fick pris av LLM?
 *   - Kategori-fördelning: hur fördelar sig de nya events över taxonomin?
 *   - AI-verdikt: ok / suspect / junk / inte-auditerade
 *   - 7-dagars tillväxt: hur många events lades till per dag senaste veckan,
 *     med Unicode bar-chart (Teams Adaptive Cards stöder inte riktiga grafer).
 *
 * Posten görs direkt till TEAMS_WEBHOOK_URL — ingen Python-heredoc, ingen
 * shell-parsing. Allt går genom Node + better-sqlite3.
 *
 * Användning:
 *   npm run quality-stats         # postar och avslutar
 *
 * Beroenden:
 *   - TEAMS_WEBHOOK_URL i miljön (sätts av run-daily.sh från ~/.vadkul-secrets/env)
 *   - events.db i scraper-roten (samma som upsertEvent skriver till)
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import 'dotenv/config';

const DB_PATH = path.resolve(__dirname, '../../events.db');
const WEBHOOK = process.env.TEAMS_WEBHOOK_URL;

// ───────────────────────────────────────────────────────────────────────────
//  Queries
// ───────────────────────────────────────────────────────────────────────────

interface DayRow { d: string; n: number }
interface KvRow  { k: string; n: number }

/** Senaste 24h: total + de som har LLM-extraherat pris. */
function priceStats(db: Database.Database): { total: number; withPrice: number } {
    const row = db.prepare<[], { total: number; withPrice: number }>(`
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN price IS NOT NULL AND TRIM(price) NOT IN ('', 'null') THEN 1 ELSE 0 END) AS withPrice
        FROM link_events
        WHERE createdAt >= datetime('now', '-1 day')
          AND hidden = 0
    `).get();
    return { total: row?.total ?? 0, withPrice: row?.withPrice ?? 0 };
}

/** Senaste 24h: hur fördelar sig nya events över kategorier. */
function categoryStats(db: Database.Database): KvRow[] {
    return db.prepare<[], KvRow>(`
        SELECT
            COALESCE(NULLIF(TRIM(category), ''), 'other') AS k,
            COUNT(*) AS n
        FROM link_events
        WHERE createdAt >= datetime('now', '-1 day')
          AND hidden = 0
        GROUP BY k
        ORDER BY n DESC
    `).all();
}

/** Senaste 24h: hur fördelar sig nya events över aiVerdict. */
function verdictStats(db: Database.Database): KvRow[] {
    return db.prepare<[], KvRow>(`
        SELECT
            COALESCE(NULLIF(TRIM(aiVerdict), ''), 'inte-auditerad') AS k,
            COUNT(*) AS n
        FROM link_events
        WHERE createdAt >= datetime('now', '-1 day')
          AND hidden = 0
        GROUP BY k
        ORDER BY
            CASE k WHEN 'ok' THEN 1 WHEN 'suspect' THEN 2 WHEN 'junk' THEN 3 ELSE 4 END
    `).all();
}

/** Senaste 7 dygn: antal nya events per dygn. Fyller i nollor för saknade dagar. */
function trend7d(db: Database.Database): DayRow[] {
    const rows = db.prepare<[], DayRow>(`
        SELECT date(createdAt, 'localtime') AS d, COUNT(*) AS n
        FROM link_events
        WHERE createdAt >= datetime('now', '-7 days')
        GROUP BY d
        ORDER BY d
    `).all();

    // Fyll i tomma dagar så grafen blir lika lång varje dygn
    const byDate = new Map(rows.map(r => [r.d, r.n]));
    const out: DayRow[] = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const d = date.toISOString().slice(0, 10);
        out.push({ d, n: byDate.get(d) ?? 0 });
    }
    return out;
}

// ───────────────────────────────────────────────────────────────────────────
//  Formatering
// ───────────────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
    music: '🎵', stage: '🎭', art: '🎨', sport: '⚽', food: '🍽️',
    market: '🛍️', party: '🎉', social: '🤝', course: '📚',
    family: '👨‍👩‍👧', other: '✨',
};

function pct(part: number, whole: number): string {
    if (whole === 0) return '0%';
    return `${Math.round((part / whole) * 100)}%`;
}

/** Bygger Unicode bar-chart där bredaste värdet får BAR_WIDTH block. */
function asciiBars(rows: DayRow[]): string {
    const BAR_WIDTH = 20;
    const max = Math.max(1, ...rows.map(r => r.n));
    const fmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    return rows.map(r => {
        const blocks = Math.round((r.n / max) * BAR_WIDTH);
        const bar = '█'.repeat(blocks) + '░'.repeat(BAR_WIDTH - blocks);
        const label = fmt.format(new Date(r.d + 'T12:00:00')).padEnd(13);
        const count = String(r.n).padStart(4);
        return `${label} ${count}  ${bar}`;
    }).join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
//  Adaptive Card
// ───────────────────────────────────────────────────────────────────────────

function buildCard(price: { total: number; withPrice: number }, cats: KvRow[], verdicts: KvRow[], trend: DayRow[]) {
    const totalLast24h = price.total;
    const trendTotal = trend.reduce((s, r) => s + r.n, 0);
    const trendAvg   = Math.round(trendTotal / 7);
    const trendToday = trend[trend.length - 1].n;
    const trendDelta = trendToday - trendAvg;
    const arrow      = trendDelta > 0 ? '📈' : trendDelta < 0 ? '📉' : '➡️';

    // Pris-fakta
    const priceFacts = [
        { title: '🆕 Nya events (24h)',   value: String(totalLast24h) },
        { title: '💰 Med LLM-pris',       value: `${price.withPrice} (${pct(price.withPrice, totalLast24h)})` },
    ];

    // Kategori-fakta
    const catFacts = cats.length === 0
        ? [{ title: '—', value: 'Inga nya events sista dygnet' }]
        : cats.map(c => ({
            title: `${CATEGORY_EMOJI[c.k] ?? '•'} ${c.k}`,
            value: `${c.n} (${pct(c.n, totalLast24h)})`,
        }));

    // Verdikt-fakta — alltid visa alla 4 buckets även om noll, så man ser täckningsgrad
    const verdictMap = new Map(verdicts.map(v => [v.k, v.n]));
    const ok       = verdictMap.get('ok') ?? 0;
    const suspect  = verdictMap.get('suspect') ?? 0;
    const junk     = verdictMap.get('junk') ?? 0;
    const noAudit  = verdictMap.get('inte-auditerad') ?? 0;
    const verdictFacts = [
        { title: '✅ ok',              value: `${ok} (${pct(ok, totalLast24h)})` },
        { title: '❓ suspect',         value: `${suspect} (${pct(suspect, totalLast24h)})` },
        { title: '🗑️ junk',           value: `${junk} (${pct(junk, totalLast24h)})` },
        { title: '⏳ inte-auditerade', value: `${noAudit} (${pct(noAudit, totalLast24h)})` },
    ];

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
                    { type: 'TextBlock', text: '📊 VADKUL kvalitet — senaste dygnet',
                      weight: 'Bolder', size: 'Large', color: 'accent' },

                    { type: 'TextBlock', text: '💰 Pris-extraktion',
                      weight: 'Bolder', spacing: 'Medium' },
                    { type: 'FactSet', facts: priceFacts },

                    { type: 'TextBlock', text: '🏷️ Kategori-fördelning (nya events)',
                      weight: 'Bolder', spacing: 'Medium' },
                    { type: 'FactSet', facts: catFacts },

                    { type: 'TextBlock', text: '🤖 AI-audit verdikt',
                      weight: 'Bolder', spacing: 'Medium' },
                    { type: 'FactSet', facts: verdictFacts },

                    { type: 'TextBlock', text: `${arrow} 7-dagars tillväxt — totalt ${trendTotal}, snitt ${trendAvg}/dygn`,
                      weight: 'Bolder', spacing: 'Medium' },
                    { type: 'TextBlock', text: asciiBars(trend),
                      wrap: true, fontType: 'Monospace', size: 'Small' },
                ],
            },
        }],
    };
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
    if (!WEBHOOK) {
        console.error('⚠️ TEAMS_WEBHOOK_URL inte satt — skippar quality-stats-postningen.');
        process.exit(0);
    }

    const db = new Database(DB_PATH, { readonly: true });
    try {
        const card = buildCard(priceStats(db), categoryStats(db), verdictStats(db), trend7d(db));

        const res = await fetch(WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(card),
        });

        if (res.status !== 200 && res.status !== 202) {
            const body = await res.text().catch(() => '');
            console.error(`❌ Teams POST → HTTP ${res.status}: ${body.slice(0, 300)}`);
            process.exit(1);
        }
        console.log(`✅ Quality-stats postat (HTTP ${res.status})`);
    } finally {
        db.close();
    }
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
