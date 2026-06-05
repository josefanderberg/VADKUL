/**
 * Bulk-migration: ladda ner FB CDN-bilder (innan de expirar) och hosta i Storage.
 *
 * För varje event där coverImage är en FB CDN-URL (eller annan remote URL) som
 * INTE redan är vår egen Storage:
 *   1. Försök ladda ner originalbilden
 *   2. Ladda upp till Firebase Storage
 *   3. Uppdatera Firestore + SQLite med nya permanenta URL
 *
 * Användning:
 *   npx ts-node src/scripts/migrate-images-to-storage.ts                  # dry-run
 *   npx ts-node src/scripts/migrate-images-to-storage.ts --apply
 *   npx ts-node src/scripts/migrate-images-to-storage.ts --apply --host=Facebook
 *   npx ts-node src/scripts/migrate-images-to-storage.ts --apply --limit=100
 *   npx ts-node src/scripts/migrate-images-to-storage.ts --apply --max-age=7
 *
 * --max-age=N filtrerar på createdAt — bara bilder scrapade senaste N dagar.
 * Användbart för att fokusera på fbcdn-URL:er som fortfarande är levande
 * (FB-bilder dör efter ~7d).
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { uploadEventImage, isOurStorageUrl, uploadStats, resetUploadStats } from '../utils/storageHelper';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

interface Row { url: string; title: string; firestoreId: string; coverImage: string; hostName: string }

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(args.apply ? '🔧 APPLY' : '🔍 DRY-RUN');

    const limit = args.limit ? parseInt(args.limit, 10) : 999999;
    const hostFilter = args.host;
    const fbOnly = args['fb-only'] === true || args['fb-only'] === 'true';
    const maxAgeDays = args['max-age'] ? parseInt(args['max-age'], 10) : null;
    const params: any[] = [];
    let where = `hidden = 0 AND coverImage IS NOT NULL AND coverImage != ''
                 AND coverImage NOT LIKE 'https://storage.googleapis.com/vadkul-f2cb2%'
                 AND firestoreId IS NOT NULL`;
    if (hostFilter) { where += ' AND hostName = ?'; params.push(hostFilter); }
    if (fbOnly) {
        // FB-events känns igen på URL eller fbcdn-coverImage. Filter med båda
        // för att fånga alla varianter.
        where += " AND (url LIKE '%facebook.com%' OR coverImage LIKE '%fbcdn%')";
        console.log('🎯 FB-only: filtrerar på facebook.com-URL eller fbcdn-bild');
    }
    if (maxAgeDays !== null) {
        const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000).toISOString();
        where += ' AND createdAt >= ?';
        params.push(cutoff);
        console.log(`📅 Max-age: ${maxAgeDays} dagar (createdAt >= ${cutoff})`);
    }

    const rows: Row[] = sqliteDb.prepare(`
        SELECT url, title, firestoreId, coverImage, hostName FROM link_events
        WHERE ${where}
        ORDER BY createdAt DESC
        LIMIT ?
    `).all(...params, limit) as Row[];

    console.log(`Kandidater: ${rows.length}\n`);
    resetUploadStats();

    const stats: Record<string, { tried: number; ok: number; failed: number }> = {};
    let totalOk = 0, totalFailed = 0;
    let prevHost = '';

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        stats[r.hostName] ??= { tried: 0, ok: 0, failed: 0 };
        stats[r.hostName].tried++;

        if (prevHost !== r.hostName) {
            console.log(`\n=== ${r.hostName} ===`);
            prevHost = r.hostName;
        }

        const progress = `[${i + 1}/${rows.length}]`;

        if (!args.apply) {
            console.log(`  ${progress} (dry) ${r.title.slice(0, 60)}`);
            continue;
        }

        const newUrl = await uploadEventImage(r.coverImage, r.url);
        if (!newUrl) {
            stats[r.hostName].failed++;
            totalFailed++;
            console.log(`  ${progress} ❌ ${r.title.slice(0, 60)}`);
            continue;
        }

        // Uppdatera Firestore — SQLite syncar sen via sync-to-sqlite
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update({ coverImage: newUrl });
            stats[r.hostName].ok++;
            totalOk++;
            console.log(`  ${progress} ✅ ${r.title.slice(0, 60)}`);
        } catch (e) {
            stats[r.hostName].failed++;
            totalFailed++;
            console.error(`  ${progress} ❌ DB write fail: ${(e as Error).message}`);
        }
    }

    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    for (const [h, s] of Object.entries(stats)) {
        console.log(`  ${h.padEnd(28)} tried=${String(s.tried).padStart(4)}  ok=${String(s.ok).padStart(4)}  failed=${s.failed}`);
    }
    console.log(`\nTOTAL: ${totalOk}/${rows.length} migrerade, ${totalFailed} misslyckade  ${args.apply ? '' : '(dry-run)'}`);
    console.log('\n=== Upload-stats (var dog försöken) ===');
    for (const [k, v] of Object.entries(uploadStats)) {
        if (v > 0) console.log(`  ${k.padEnd(20)} ${v}`);
    }
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
