/**
 * Sync-storage-urls: sweep:ar events vars coverImage INTE är en storage-URL
 * och kollar om Storage redan har bilden under sha1(eventUrl).<ext>.
 * Uppdaterar i så fall coverImage till storage-URL — utan att försöka
 * fetcha någon expirerad remote-bild.
 *
 * Snabbt: bara Storage.exists()-anrop, ingen fetch. Idempotent.
 *
 * Användning:
 *   npx ts-node src/scripts/sync-storage-urls.ts                    # dry-run
 *   npx ts-node src/scripts/sync-storage-urls.ts --apply
 *   npx ts-node src/scripts/sync-storage-urls.ts --apply --limit=100
 *   npx ts-node src/scripts/sync-storage-urls.ts --apply --fb-only
 */

import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { bucket, STORAGE_BUCKET } from '../config/firebase';
import { isOurStorageUrl } from '../utils/storageHelper';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) { out[m[1]] = m[2]; continue; }
        if (a.startsWith('--')) out[a.slice(2)] = true;
    }
    return out;
})();

const STORAGE_FOLDER = 'scraped-events';
const EXTS = ['jpg', 'png', 'webp', 'gif', 'avif'];

function hashUrl(url: string): string {
    return crypto.createHash('sha1').update(url).digest('hex');
}

function publicUrlFor(p: string): string {
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${p}`;
}

async function findExistingStorageUrl(eventUrl: string): Promise<string | null> {
    if (!bucket) return null;
    const hash = hashUrl(eventUrl);
    for (const ext of EXTS) {
        const p = `${STORAGE_FOLDER}/${hash}.${ext}`;
        try {
            const [exists] = await bucket.file(p).exists();
            if (exists) return publicUrlFor(p);
        } catch { /* ignore */ }
    }
    return null;
}

async function main() {
    if (!db) throw new Error('Firebase ej init');
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });

    console.log(args.apply ? '🔧 APPLY' : '🔍 DRY-RUN');

    const limit = args.limit ? parseInt(args.limit, 10) : 999999;
    const fbOnly = !!args['fb-only'];
    const params: any[] = [];
    let where = `hidden = 0 AND firestoreId IS NOT NULL
                 AND (coverImage IS NULL OR coverImage = ''
                      OR coverImage NOT LIKE 'https://storage.googleapis.com/${STORAGE_BUCKET}%')`;
    if (fbOnly) {
        where += " AND (url LIKE '%facebook.com%' OR coverImage LIKE '%fbcdn%' OR coverImage LIKE '%fbsbx%')";
        console.log('🎯 FB-only filter aktivt');
    }
    const rows = sqliteDb.prepare(`
        SELECT url, title, firestoreId, coverImage, hostName FROM link_events
        WHERE ${where}
        ORDER BY createdAt DESC
        LIMIT ?
    `).all(...params, limit) as any[];

    console.log(`\nKandidater att kolla mot Storage: ${rows.length}\n`);

    let found = 0;
    let synced = 0;
    let notInStorage = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const storageUrl = await findExistingStorageUrl(r.url);
        if (!storageUrl) {
            notInStorage++;
            continue;
        }
        found++;
        if (!args.apply) {
            if (found <= 10) {
                console.log(`  [${i + 1}/${rows.length}] (dry) ${r.title.slice(0, 50)} → finns i Storage`);
            }
            continue;
        }
        try {
            await db.collection('linkEvents').doc(r.firestoreId).update({ coverImage: storageUrl });
            synced++;
            if (synced <= 20 || synced % 50 === 0) {
                console.log(`  [${i + 1}/${rows.length}] ✅ Synced: ${r.title.slice(0, 50)}`);
            }
        } catch (e) {
            failed++;
            console.error(`  [${i + 1}/${rows.length}] ❌ DB write fail: ${(e as Error).message}`);
        }
    }

    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    console.log(`  Kollade:           ${rows.length}`);
    console.log(`  Fanns i Storage:   ${found}  (${((found/rows.length)*100).toFixed(1)}%)`);
    console.log(`  Inte i Storage:    ${notInStorage}`);
    if (args.apply) {
        console.log(`  Synkade Firestore: ${synced}`);
        console.log(`  Failed:            ${failed}`);
    } else {
        console.log(`\nKör med --apply för att uppdatera Firestore.`);
    }
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
