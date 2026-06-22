/**
 * backfill-emoji.ts — sätt kategori-default-emoji på event som saknar emoji
 * eller läckt en frågetecken-platshållare ("❓").
 *
 * Bakgrund: ~975 event har emoji = NULL och ~230 har "❓" (LLM-auditen tog till
 * frågetecken när den var osäker; sanitizeEmoji släppte igenom det). "❓" syns
 * som kartpinne på publicerade event. Framåt blockeras "❓" i sanitizeEmoji och
 * faller till CATEGORY_EMOJI[category]; här rättas befintliga rader till samma
 * kategori-default.
 *
 * Skriver SQLite + Firestore. Default framtida event (time >= now); --all för
 * hela historiken.
 *
 * Användning:
 *   npx ts-node src/scripts/backfill-emoji.ts            # dry-run, framtida
 *   npx ts-node src/scripts/backfill-emoji.ts --apply
 *   npx ts-node src/scripts/backfill-emoji.ts --apply --all
 */

import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';
import { CATEGORY_EMOJI } from '../utils/llmAudit';

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
/**
 * Synka Firestore linkEvents.emoji från SQLite för hela kategori-default-
 * populationen (framtida, med firestoreId). Idempotent städning efter att en
 * tidigare atomisk batch tappade synkar; SQLite rörs inte.
 */
const RESYNC = process.argv.includes('--resync-firestore');

interface Row {
    url: string;
    firestoreId: string | null;
    category: string | null;
    emoji: string | null;
}

const CATEGORY_DEFAULTS = Object.values(CATEGORY_EMOJI);
const updateStmt = sqlite.prepare('UPDATE link_events SET emoji = ?, updatedAt = ? WHERE url = ?');

async function main() {
    if (RESYNC) return resyncFirestore();
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN', ALL ? '(alla event)' : '(framtida)');

    const timeFilter = ALL ? '' : "AND time >= datetime('now')";
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, category, emoji
        FROM link_events
        WHERE (emoji IS NULL OR emoji = '' OR emoji = '❓' OR emoji = '❔')
        ${timeFilter}
    `).all() as Row[];

    console.log(`${rows.length} event utan giltig emoji.\n`);

    const perCat = new Map<string, number>();
    let updated = 0, fsFail = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
        const cat = r.category || 'other';
        const emoji = CATEGORY_EMOJI[cat] ?? CATEGORY_EMOJI.other;
        perCat.set(cat, (perCat.get(cat) || 0) + 1);
        updated++;

        if (APPLY) {
            updateStmt.run(emoji, now, r.url);
            // Per-doc + tolerant: Firestore-batch är ATOMISK, så EN raderad doc
            // (NOT_FOUND, kod 5) hade fällt hela batchen. SQLite är källan som
            // aggregate-events läser; Firestore-synken är best-effort.
            if (db && r.firestoreId) {
                try {
                    await db.collection('linkEvents').doc(r.firestoreId).update({ emoji });
                } catch (e: any) {
                    if (e?.code !== 5) { fsFail++; console.error(`  ❌ Firestore ${r.url.slice(0, 50)}: ${e?.message}`); }
                }
            }
        }
    }

    console.log('=== Per kategori (default-emoji satt) ===');
    for (const [cat, n] of [...perCat.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${(CATEGORY_EMOJI[cat] ?? '✨')} ${cat.padEnd(10)} ${n}`);
    }

    console.log('\n=== Klart ===');
    console.log(`  🎯 Uppdaterade: ${updated}`);
    if (fsFail) console.log(`  ❌ Firestore-fel: ${fsFail}`);
    if (!APPLY) console.log('\n(dry-run — kör med --apply för att skriva)');
    process.exit(0);
}

/** Best-effort push av SQLite-emoji → Firestore linkEvents (kategori-default-populationen). */
async function resyncFirestore() {
    if (!db) { console.error('Firebase ej initialiserad — inget att synka.'); process.exit(1); }
    const placeholders = CATEGORY_DEFAULTS.map(() => '?').join(',');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, emoji FROM link_events
        WHERE time >= datetime('now') AND firestoreId IS NOT NULL AND firestoreId != ''
          AND emoji IN (${placeholders})
    `).all(...CATEGORY_DEFAULTS) as Array<{ url: string; firestoreId: string; emoji: string }>;

    console.log(`🔁 Synkar ${rows.length} linkEvents.emoji → Firestore (SQLite oförändrad).`);
    let ok = 0, fail = 0;
    for (const r of rows) {
        try { await db.collection('linkEvents').doc(r.firestoreId).update({ emoji: r.emoji }); ok++; }
        catch (e: any) { if (e?.code !== 5) { fail++; if (fail <= 5) console.error(`  ❌ ${r.url.slice(0, 50)}: ${e?.message}`); } }
        if (ok % 500 === 0 && ok) console.log(`  …${ok} synkade`);
    }
    console.log(`\n✅ Synkade ${ok}, hoppade över raderade/fel ${rows.length - ok}${fail ? ` (varav ${fail} riktiga fel)` : ''}.`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
