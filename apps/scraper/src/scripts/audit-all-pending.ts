/**
 * audit-all-pending.ts — Backfill-audit för alla framtida events.
 *
 * Hämtar events från SQLite där:
 *   - time >= now (inga historiska events)
 *   - hidden = 0
 *   - aiVerdict IS NULL ELLER category saknar emoji (ej klassad i nya taxonomin)
 *
 * Per event: auditEvent() → skriver verdict, confidence, category,
 * category_confidence, emoji, price. Auto-hide om verdict='junk' (high / ej-SE).
 *
 * Körning:
 *   npm run audit-pending
 *   npm run audit-pending -- --limit=100
 *   npm run audit-pending -- --dry-run   (ingen DB-write)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { auditEvent, ollamaIsAvailable } from '../utils/llmAudit';
import { setEventAuditWithCategory, setHidden } from '../utils/sqliteHelper';

const args = (() => {
    const out: Record<string, string | boolean> = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) { out[m[1]] = m[2]; continue; }
        if (a.startsWith('--')) out[a.slice(2)] = true;
    }
    return out;
})();

const LIMIT   = args.limit   ? parseInt(args.limit as string, 10) : 999_999;
const DRY_RUN = !!args['dry-run'];
// --force: re-audita även events som redan har emoji/verdict (för att applicera
//          en uppdaterad prompt på befintlig data).
// --category=sport: begränsa till en specifik kategori (kombinera med --force).
const FORCE    = !!args['force'];
const CATEGORY = typeof args.category === 'string' ? args.category : null;

const DB_PATH = process.env.SCRAPER_SQLITE_PATH
    ? path.resolve(process.env.SCRAPER_SQLITE_PATH)
    : path.resolve(__dirname, '../../events.db');

interface Row {
    url: string;
    title: string;
    locationName: string | null;
    extractedAddress: string | null;
    description: string | null;
    hostName: string | null;
}

async function main() {
    if (!await ollamaIsAvailable()) {
        console.error('❌ Ollama är inte tillgängligt på localhost:11434. Starta med: ollama serve');
        process.exit(1);
    }

    const db = new Database(DB_PATH, { readonly: true });
    // Med --force tar vi events oavsett om de redan auditerats (för ny prompt).
    // Utan --force: bara de som saknar verdict eller emoji (normal backfill).
    const pendingClause = FORCE ? '1=1' : '(aiVerdict IS NULL OR emoji IS NULL)';
    const categoryClause = CATEGORY ? `AND category = '${CATEGORY.replace(/'/g, "''")}'` : '';
    console.log(`Filter: ${FORCE ? 'FORCE (alla)' : 'bara pending'}${CATEGORY ? ` · category=${CATEGORY}` : ''}`);
    const rows = db.prepare<[], Row>(`
        SELECT url, title, locationName, extractedAddress, description, hostName
        FROM link_events
        WHERE time >= datetime('now')
          AND hidden = 0
          AND ${pendingClause}
          ${categoryClause}
        ORDER BY time ASC
        LIMIT ${LIMIT}
    `).all();
    db.close();

    const total = rows.length;
    if (total === 0) {
        console.log('✅ Inga events att processa. Allt är klart.');
        process.exit(0);
    }

    console.log(`\n🔍 ${DRY_RUN ? '[DRY-RUN] ' : ''}Processar ${total} events...\n`);

    const startedAt = Date.now();
    const stats = {
        ok: 0, suspect: 0, junk: 0, hidden: 0, errors: 0, priced: 0,
        categories: {} as Record<string, number>,
    };

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const prefix = `[${String(i + 1).padStart(String(total).length)}/${total}]`;
        try {
            const result = await auditEvent({
                title:            r.title,
                locationName:     r.locationName  ?? undefined,
                extractedAddress: r.extractedAddress ?? undefined,
                description:      r.description   ?? undefined,
                hostName:         r.hostName      ?? undefined,
                url:              r.url,
            });

            const swFlag = result.inSweden ? '' : ' [EJ-SE]';
            const priceTag = result.price ? ` 💰${result.price}` : '';
            console.log(
                `${prefix} ${result.emoji} ${result.verdict}/${result.confidence}${swFlag}` +
                ` ${result.category}${priceTag}` +
                ` | ${(r.title || '').slice(0, 45)} → ${result.reason}`,
            );

            stats[result.verdict]++;
            stats.categories[result.category] = (stats.categories[result.category] ?? 0) + 1;
            if (result.price) stats.priced++;

            if (!DRY_RUN) {
                setEventAuditWithCategory(r.url, {
                    verdict: result.verdict,
                    confidence: result.confidence,
                    category: result.category,
                    categoryConfidence: result.categoryConfidence,
                    emoji: result.emoji,
                    price: result.price,
                });
                if (result.verdict === 'junk' && (result.confidence === 'high' || !result.inSweden)) {
                    setHidden(r.url, true);
                    stats.hidden++;
                    console.log(`         ↳ 🙈 auto-hidden`);
                }
            }
        } catch (err) {
            stats.errors++;
            console.error(`${prefix} ❌ FEL: ${(err as Error).message} | ${(r.title || '').slice(0, 60)}`);
        }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log('\n══════════════════════════════════════════');
    console.log(`  Körtid:          ${elapsed}s  (${(parseFloat(elapsed) / total).toFixed(1)}s/event)`);
    console.log(`  Processerade:    ${total - stats.errors} / ${total}`);
    console.log(`  ✅ ok:           ${stats.ok}`);
    console.log(`  ❓ suspect:      ${stats.suspect}`);
    console.log(`  🗑️  junk:         ${stats.junk}`);
    console.log(`  🙈 auto-hidden:  ${stats.hidden}`);
    console.log(`  💰 med pris:     ${stats.priced}`);
    console.log(`  ❌ errors:       ${stats.errors}`);
    console.log('\n  Kategorifördelning:');
    const sorted = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
        const bar = '█'.repeat(Math.round(count / total * 30));
        console.log(`    ${cat.padEnd(10)} ${String(count).padStart(4)}  ${bar}`);
    }
    console.log('══════════════════════════════════════════\n');
    if (DRY_RUN) console.log('ℹ️  DRY-RUN: inga ändringar skrevs till DB.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
