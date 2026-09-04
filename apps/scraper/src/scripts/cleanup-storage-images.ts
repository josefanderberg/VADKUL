/**
 * Cleanup: radera storage-bilder för events som passerat sitt datum.
 *
 * Strategi:
 *   - Hitta events där `time < now() - GRACE_DAYS` (default 7)
 *   - För varje event: om coverImage pekar på vår Storage, radera filen
 *   - Behåll event-raden i DB (historik / dedup), men nulla coverImage
 *
 * Kör nightly via cron eller manuellt.
 *
 * Med --sweep-orphans görs dessutom ett bucket-svep: alla objekt under
 * scraped-events/ (inkl. shared/) som INGET event i spegeln refererar
 * och som är äldre än GRACE_DAYS raderas. Det är så delade bilder
 * (shared/, hashade på bild-URL, kan ha många ägare) städas — de rörs
 * aldrig av per-event-raderingen ovan.
 *
 * Användning:
 *   npx ts-node src/scripts/cleanup-storage-images.ts                # dry-run
 *   npx ts-node src/scripts/cleanup-storage-images.ts --apply
 *   npx ts-node src/scripts/cleanup-storage-images.ts --apply --days=14
 *   npx ts-node src/scripts/cleanup-storage-images.ts --apply --sweep-orphans
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { deleteEventImage, isOurStorageUrl } from '../utils/storageHelper';
import { stamped } from '../utils/firestoreStamp';

const args = (() => {
    const out: any = { days: 7 };
    for (const a of process.argv.slice(2)) {
        if (a === '--apply') out.apply = true;
        const m = a.match(/^--([^=]+)=(.+)$/);
        if (m) out[m[1]] = m[2];
    }
    return out;
})();

const GRACE_DAYS = parseInt(String(args.days), 10);

async function main() {
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    if (!db) { console.error('Firebase ej init'); process.exit(1); }

    console.log(args.apply ? '🔧 APPLY' : '🔍 DRY-RUN');
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86400000);
    console.log(`Cutoff: events med time < ${cutoff.toISOString().slice(0, 10)} (${GRACE_DAYS} dagar tillbaka)\n`);

    // SQLite-fråga
    const rows = sqliteDb.prepare(`
        SELECT url, title, firestoreId, coverImage, time FROM link_events
        WHERE firestoreId IS NOT NULL
          AND coverImage IS NOT NULL AND coverImage != ''
          AND time < ?
        ORDER BY time DESC
    `).all(cutoff.toISOString()) as any[];

    // Filtrera bara våra storage-URLs
    const ours = rows.filter((r) => isOurStorageUrl(r.coverImage));
    console.log(`Events passerade ${GRACE_DAYS}d: ${rows.length}, varav ${ours.length} har bilder i vår Storage\n`);

    let deleted = 0;
    let dbUpdated = 0;
    let failed = 0;

    for (const r of ours) {
        if (!args.apply) {
            console.log(`  (dry) ${r.time.slice(0, 10)} | ${r.title.slice(0, 60)}`);
            continue;
        }
        try {
            const ok = await deleteEventImage(r.url);
            if (ok) deleted++;
            // Nulla även i DB så vi inte länkar till en raderad URL
            await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ coverImage: '' }));
            dbUpdated++;
            console.log(`  🗑️  ${r.time.slice(0, 10)} | ${r.title.slice(0, 60)}`);
        } catch (e) {
            failed++;
            console.error(`  ❌ ${r.title.slice(0, 50)}: ${(e as Error).message}`);
        }
    }

    let orphansDeleted = 0;
    let orphanBytes = 0;
    if (args['sweep-orphans']) {
        console.log(`\n=== Orphan-svep (objekt utan refererande event, äldre än ${GRACE_DAYS}d) ===`);
        // Alla refererade storage-paths ur spegeln (ALLA rader — även dolda/
        // passerade: så länge raden pekar på bilden är den inte föräldralös).
        const referenced = new Set(
            (sqliteDb.prepare(
                `SELECT coverImage FROM link_events WHERE coverImage LIKE 'https://storage.googleapis.com/%'`,
            ).all() as any[]).map(r =>
                String(r.coverImage).replace(/^https:\/\/storage\.googleapis\.com\/[^/]+\//, '')),
        );
        const { bucket } = await import('../config/firebase');
        if (!bucket) throw new Error('Ingen bucket');
        const ageCutoff = Date.now() - GRACE_DAYS * 86400000;
        let pageToken: string | undefined;
        do {
            const [files, next] = await (bucket as any).getFiles({
                prefix: 'scraped-events/', maxResults: 1000, pageToken, autoPaginate: false,
            });
            for (const f of files) {
                if (referenced.has(f.name)) continue;
                const created = Date.parse(f.metadata?.timeCreated || '') || 0;
                if (created > ageCutoff) continue; // nyuppladdad — kan ha event på väg in
                const size = parseInt(String(f.metadata?.size || '0'), 10);
                if (args.apply) {
                    try { await f.delete(); orphansDeleted++; orphanBytes += size; }
                    catch { failed++; }
                } else {
                    orphansDeleted++; orphanBytes += size;
                }
            }
            pageToken = next?.pageToken;
        } while (pageToken);
        console.log(`  ${args.apply ? 'Raderade' : '(dry) skulle radera'}: ${orphansDeleted} objekt, ${(orphanBytes / 1e6).toFixed(1)} MB`);
    }

    sqliteDb.close();
    console.log(`\n=== Sammanfattning ===`);
    console.log(`  Storage-objekt raderade: ${deleted}`);
    console.log(`  DB-poster uppdaterade:   ${dbUpdated}`);
    console.log(`  Orphans raderade:        ${orphansDeleted}`);
    console.log(`  Misslyckade:             ${failed}`);
    console.log(args.apply ? '' : '\n(dry-run — kör med --apply för att radera)');
    process.exit(0);
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
