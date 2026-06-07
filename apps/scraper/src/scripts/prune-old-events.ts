#!/usr/bin/env ts-node
/**
 * Rensar gamla, passerade events ur den lokala SQLite-spegeln (events.db).
 *
 * Webben visar aldrig passerade events (aggregate-events.ts filtrerar
 * `time >= today` och HomeContent.tsx filtrerar även klientside), så rader
 * vars starttid ligger långt bak är död vikt. Detta skript tar bort rader
 * vars `time` är äldre än N dagar (default 30).
 *
 * OBS: rör BARA SQLite. Firestore-rensningen sköts av cleanup-old-events.ts.
 *
 * Användning:
 *   npm run prune-old                 # raderar time < now - 30d
 *   npm run prune-old -- --days=60    # annan tröskel
 *   npm run prune-old -- --dry-run    # visa antal, radera inget
 *
 * Skriver en JSON-rad till stdout (`{"deleted": N}`) i samma stil som
 * cleanup-old så en wrapper kan plocka upp siffran.
 */

import { sqlite, getSqlitePath } from '../utils/sqliteHelper';

function parseDays(argv: string[], fallback: number): number {
    const arg = argv.find(a => a.startsWith('--days='));
    if (!arg) return fallback;
    const n = parseInt(arg.split('=')[1], 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function main() {
    const argv = process.argv.slice(2);
    const dryRun = argv.includes('--dry-run');
    const daysBack = parseDays(argv, 30);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffIso = cutoff.toISOString();

    console.log(`🗑️  Prune (SQLite: ${getSqlitePath()})`);
    console.log(`   Tröskel: time < ${cutoffIso} (${daysBack} dagar bak)`);

    const { n: toDelete } = sqlite
        .prepare('SELECT COUNT(*) AS n FROM link_events WHERE time < ?')
        .get(cutoffIso) as { n: number };

    if (dryRun) {
        console.log(`   [dry-run] Skulle radera ${toDelete} event. Inget ändrat.`);
        console.log(JSON.stringify({ deleted: 0, wouldDelete: toDelete, dryRun: true }));
        return;
    }

    if (toDelete === 0) {
        console.log('✅ Inget att rensa.');
        console.log(JSON.stringify({ deleted: 0 }));
        return;
    }

    const info = sqlite
        .prepare('DELETE FROM link_events WHERE time < ?')
        .run(cutoffIso);

    console.log(`✅ Klar. Raderade ${info.changes} event.`);
    console.log(JSON.stringify({ deleted: info.changes }));
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('❌ Prune kraschade:', err);
        process.exitCode = 1;
    }
}
