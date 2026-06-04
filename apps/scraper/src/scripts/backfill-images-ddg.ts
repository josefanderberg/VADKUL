/**
 * Backfill bilder via DuckDuckGo Images för events utan coverImage.
 *
 * Använder existing `searchGoogleImage` (som faktiskt scrapar DuckDuckGo)
 * från utils/imageSearch.ts.
 *
 * Användning:
 *   npx ts-node src/scripts/backfill-images-ddg.ts            # dry-run
 *   npx ts-node src/scripts/backfill-images-ddg.ts --apply
 *   npx ts-node src/scripts/backfill-images-ddg.ts --host=Norsjö --apply
 */

import path from 'path';
import Database from 'better-sqlite3';
import puppeteer from 'puppeteer';
import { db } from '../config/firebase';
import { SOURCES } from '../sources/registry';
import { searchGoogleImage } from '../utils/imageSearch';

const args = (() => {
    const out: any = {};
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

const HOSTS = SOURCES.map((s) => s.hostName).filter((h) => !args.host || h.toLowerCase().includes(args.host.toLowerCase()));

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(args.apply ? '🔧 APPLY' : '🔍 DRY-RUN');

    const rows = sqliteDb.prepare(`
        SELECT url, title, firestoreId, hostName
        FROM link_events
        WHERE hostName IN (${HOSTS.map(() => '?').join(',')})
          AND firestoreId IS NOT NULL
          AND hidden = 0
          AND (coverImage IS NULL OR coverImage = '')
        ORDER BY hostName
    `).all(...HOSTS) as any[];

    console.log(`Events utan bild: ${rows.length}\n`);
    if (rows.length === 0) { sqliteDb.close(); process.exit(0); }

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    let totalFound = 0;
    const stats: Record<string, { tried: number; found: number }> = {};

    let prevHost = '';
    for (const r of rows) {
        stats[r.hostName] ??= { tried: 0, found: 0 };
        stats[r.hostName].tried++;
        if (prevHost !== r.hostName) { console.log(`\n=== ${r.hostName} ===`); prevHost = r.hostName; }

        const imageUrl = await searchGoogleImage(page, r.title);
        if (imageUrl) {
            stats[r.hostName].found++;
            totalFound++;
            console.log(`  ✅ ${r.title.slice(0, 50)} → ${imageUrl.slice(0, 70)}…`);
            if (args.apply) {
                try { await db.collection('linkEvents').doc(r.firestoreId).update({ coverImage: imageUrl }); }
                catch (e) { console.error(`    ERR: ${(e as Error).message}`); }
            }
        } else {
            console.log(`  ○  ${r.title.slice(0, 50)}`);
        }
    }

    await browser.close();
    sqliteDb.close();
    console.log('\n=== Sammanfattning ===');
    for (const [h, s] of Object.entries(stats)) {
        console.log(`  ${h.padEnd(28)} tried=${String(s.tried).padStart(3)}  found=${String(s.found).padStart(3)}`);
    }
    console.log(`TOTAL: ${totalFound} ${args.apply ? '(applicerade)' : '(dry-run)'}`);
    process.exit(0);
}
main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
