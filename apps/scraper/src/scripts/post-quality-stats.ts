/**
 * post-quality-stats.ts
 *
 * Postar ett ANDRA Telegram-meddelande (strax efter huvudrapporten från run-daily.sh).
 * Innehåller LLM-audit-kvalitet och 7-dagars tillväxttrend:
 *
 *   - Pris-extraktion: hur många av senaste dygnets events fick pris av LLM?
 *   - Kategori-fördelning: hur fördelar sig de nya events över taxonomin?
 *   - AI-verdikt: ok / suspect / junk / inte-auditerade
 *   - 7-dagars tillväxt: hur många events lades till per dag senaste veckan,
 *     med Unicode bar-chart i <pre>.
 *
 * Posten görs via utils/telegram — ingen Python-heredoc, ingen shell-parsing.
 * Allt går genom Node + better-sqlite3.
 *
 * Användning:
 *   npm run quality-stats         # postar och avslutar
 *
 * Beroenden:
 *   - TG_BOT_TOKEN + TG_CHAT_ID i miljön (sätts av run-daily.sh från ~/.vadkul-secrets/env)
 *   - events.db i scraper-roten (samma som upsertEvent skriver till)
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import 'dotenv/config';
import { sendMessage, isTelegramConfigured } from '../utils/telegram';
import { factLines, section, preBlock, clampTelegram, escapeHtml } from '../utils/telegramReport';

const DB_PATH = path.resolve(__dirname, '../../events.db');

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

/** Senaste 24h: top emoji + unika emoji-count (LLM:n får hitta egen per event). */
function emojiStats(db: Database.Database): { unique: number; withEmoji: number; top: KvRow[] } {
    const top = db.prepare<[], KvRow>(`
        SELECT TRIM(emoji) AS k, COUNT(*) AS n
        FROM link_events
        WHERE createdAt >= datetime('now', '-1 day')
          AND hidden = 0
          AND emoji IS NOT NULL AND TRIM(emoji) NOT IN ('', 'null')
        GROUP BY k
        ORDER BY n DESC
        LIMIT 12
    `).all();
    const agg = db.prepare<[], { uniq: number; withEmoji: number }>(`
        SELECT
            COUNT(DISTINCT TRIM(emoji)) AS uniq,
            COUNT(*)                    AS withEmoji
        FROM link_events
        WHERE createdAt >= datetime('now', '-1 day')
          AND hidden = 0
          AND emoji IS NOT NULL AND TRIM(emoji) NOT IN ('', 'null')
    `).get();
    return { unique: agg?.uniq ?? 0, withEmoji: agg?.withEmoji ?? 0, top };
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
//  Telegram-text (HTML)
// ───────────────────────────────────────────────────────────────────────────

export function buildText(
    price:    { total: number; withPrice: number },
    cats:     KvRow[],
    verdicts: KvRow[],
    emojis:   { unique: number; withEmoji: number; top: KvRow[] },
    trend:    DayRow[],
): string {
    const totalLast24h = price.total;
    const trendTotal = trend.reduce((s, r) => s + r.n, 0);
    const trendAvg   = Math.round(trendTotal / 7);
    const trendToday = trend.length ? trend[trend.length - 1].n : 0;
    const trendDelta = trendToday - trendAvg;
    const arrow      = trendDelta > 0 ? '📈' : trendDelta < 0 ? '📉' : '➡️';

    const verdictMap = new Map(verdicts.map(v => [v.k, v.n]));
    const ok       = verdictMap.get('ok') ?? 0;
    const suspect  = verdictMap.get('suspect') ?? 0;
    const junk     = verdictMap.get('junk') ?? 0;
    const noAudit  = verdictMap.get('inte-auditerad') ?? 0;

    return [
        '📊 <b>VADKUL kvalitet — senaste dygnet</b>',
        section('💰 Pris-extraktion', factLines([
            { title: '🆕 Nya events (24h)', value: String(totalLast24h) },
            { title: '💰 Med LLM-pris',     value: `${price.withPrice} (${pct(price.withPrice, totalLast24h)})` },
        ])),
        section('🏷️ Kategori-fördelning (nya events)', cats.length === 0
            ? '<i>Inga nya events sista dygnet</i>'
            : factLines(cats.map(c => ({ title: `${CATEGORY_EMOJI[c.k] ?? '•'} ${c.k}`, value: `${c.n} (${pct(c.n, totalLast24h)})` })))),
        section('🤖 AI-audit verdikt', factLines([
            { title: '✅ ok',              value: `${ok} (${pct(ok, totalLast24h)})` },
            { title: '❓ suspect',         value: `${suspect} (${pct(suspect, totalLast24h)})` },
            { title: '🗑️ junk',           value: `${junk} (${pct(junk, totalLast24h)})` },
            { title: '⏳ inte-auditerade', value: `${noAudit} (${pct(noAudit, totalLast24h)})` },
        ])),
        section(`🎨 Emoji — ${emojis.unique} unika på ${emojis.withEmoji} events (${pct(emojis.withEmoji, totalLast24h)})`,
            emojis.top.length === 0
                ? '<i>Ingen LLM-emoji satt i nya events än</i>'
                : factLines(emojis.top.map(e => ({ title: e.k, value: `${e.n} (${pct(e.n, emojis.withEmoji)})` })))),
        section(`${arrow} 7-dagars tillväxt — totalt ${trendTotal}, snitt ${trendAvg}/dygn`,
            trend.length ? preBlock(asciiBars(trend)) : escapeHtml('(ingen data)')),
    ].join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
    const db = new Database(DB_PATH, { readonly: true });
    let text: string;
    try {
        text = buildText(priceStats(db), categoryStats(db), verdictStats(db), emojiStats(db), trend7d(db));
    } finally {
        db.close();
    }
    if (process.argv.includes('--dry')) { console.log(text); return; }
    if (!isTelegramConfigured()) {
        console.error('⚠️ TG_BOT_TOKEN/TG_CHAT_ID inte satta — skippar quality-stats-postningen.');
        process.exit(0);
    }
    const id = await sendMessage(clampTelegram(text));
    if (!id) {
        console.error('❌ Telegram: sendMessage misslyckades.');
        process.exit(1);
    }
    console.log(`✅ Quality-stats postat till Telegram (msg ${id})`);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
