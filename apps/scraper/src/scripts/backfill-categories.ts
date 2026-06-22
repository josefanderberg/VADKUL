/**
 * Engångs-backfill: normalisera historiska `link_events.category` till de 11
 * kanoniska värdena via normalizeCategory (samma funktion som scrape/audit nu
 * använder). Kör per distinkt icke-kanoniskt värde:
 *     UPDATE link_events SET category = '<canonical>' WHERE category = '<old>'
 *
 * Visar kategorifördelning före/efter. Idempotent — kan köras flera gånger.
 *
 *   npm run backfill-categories            # skarpt
 *   npm run backfill-categories -- --dry   # visa bara vad som skulle ändras
 */
import { sqlite } from '../utils/sqliteHelper';
import { normalizeCategory } from '../utils/categoryNormalize';

const DRY = process.argv.includes('--dry') || process.argv.includes('--dry-run');

function distribution(): Array<{ category: string | null; n: number }> {
    return sqlite
        .prepare('SELECT category, COUNT(*) n FROM link_events GROUP BY category ORDER BY n DESC')
        .all() as Array<{ category: string | null; n: number }>;
}

function printDist(title: string) {
    console.log(`\n${title}`);
    for (const r of distribution()) {
        console.log(`   ${JSON.stringify(r.category)}: ${r.n}`);
    }
}

function main() {
    console.log(`🏷️  Backfill kategori-normalisering${DRY ? ' (DRY RUN)' : ''}`);
    printDist('── Före ──');

    const before = distribution();
    const update = sqlite.prepare(
        'UPDATE link_events SET category = ?, updatedAt = ? WHERE category IS ?',
    );
    const now = new Date().toISOString();

    let changedRows = 0;
    let changedValues = 0;
    const run = sqlite.transaction(() => {
        for (const { category, n } of before) {
            const canonical = normalizeCategory(category);
            if (canonical === category) continue;   // redan kanonisk → hoppa
            changedValues++;
            changedRows += n;
            console.log(`   ${JSON.stringify(category)} (${n}) → "${canonical}"`);
            if (!DRY) update.run(canonical, now, category);
        }
    });
    console.log('\n── Ändringar ──');
    run();

    if (changedValues === 0) {
        console.log('   (inget att göra — alla kategorier redan kanoniska)');
    } else {
        console.log(`\n   ${changedValues} värden, ${changedRows} rader ${DRY ? 'skulle ändras' : 'ändrade'}.`);
    }

    if (!DRY) printDist('── Efter ──');
    console.log('\n✅ Klart.');
}

main();
