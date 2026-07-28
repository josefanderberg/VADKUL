/**
 * Engångs-backfill (körs på MAC MINI — maskinen där audit-daemonen bor):
 * trycker upp lokala SQLite-audit-kolumner (emoji, category, price, aiVerdict)
 * till Firestore linkEvents för alla FRAMTIDA event.
 *
 * Bakgrund 2026-07-28: audit-daemonen skrev bara till lokal SQLite → Firestore
 * saknade emoji/förfinade kategorier → en aggregate från en annan maskin
 * publicerade lager utan dem (✨-incidenten). Daemonen speglar numera till
 * Firestore löpande; detta skript tar ikapp historiken.
 *
 *   npx ts-node src/scripts/push-audit-to-firestore.ts            # dry-run
 *   npx ts-node src/scripts/push-audit-to-firestore.ts --apply
 */

import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';

const APPLY = process.argv.includes('--apply');

async function main() {
    if (!db) throw new Error('Firestore ej initialiserat');

    const rows = sqlite.prepare(`
        SELECT firestoreId, url, category, emoji, price, aiVerdict
        FROM link_events
        WHERE time >= datetime('now')
          AND firestoreId IS NOT NULL
          AND emoji IS NOT NULL AND emoji != ''
    `).all() as any[];

    console.log(`Rader med lokal audit att spegla: ${rows.length}`);
    if (!APPLY) { console.log('Dry-run — kör med --apply för att skriva.'); return; }

    let written = 0;
    for (let i = 0; i < rows.length; i += 450) {
        const batch = db.batch();
        for (const r of rows.slice(i, i + 450)) {
            batch.update(db.collection('linkEvents').doc(r.firestoreId), {
                category: r.category,
                emoji: r.emoji,
                ...(r.price ? { price: r.price } : {}),
            });
        }
        try {
            await batch.commit();
            written += Math.min(450, rows.length - i);
            console.log(`  ${written}/${rows.length}`);
        } catch (err) {
            // NOT_FOUND för enstaka rensade doc:ar fäller hela batchen — kör
            // då om den batchen dokument för dokument.
            console.warn(`  batch ${i} föll (${(err as Error).message.slice(0, 80)}) — kör per-dokument`);
            for (const r of rows.slice(i, i + 450)) {
                try {
                    await db.collection('linkEvents').doc(r.firestoreId).update({
                        category: r.category,
                        emoji: r.emoji,
                        ...(r.price ? { price: r.price } : {}),
                    });
                    written++;
                } catch { /* rensat dokument — hoppa */ }
            }
            console.log(`  ${written}/${rows.length} (efter per-dokument-läge)`);
        }
    }
    console.log('✅ Klart. Kör därefter: npm run aggregate (på Mac mini).');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
