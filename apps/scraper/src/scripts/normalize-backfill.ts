/**
 * normalize-backfill.ts — applicera den centrala normaliseringen
 * (utils/normalizeEvent) på redan sparade framtida event. Engångs-
 * reparation efter revisionen 2026-08-20; nya event städas av runnern.
 *
 *   npx ts-node src/scripts/normalize-backfill.ts            # dry
 *   npx ts-node src/scripts/normalize-backfill.ts --apply
 */

import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';
import { stamped } from '../utils/firestoreStamp';
import { normalizeTitle, normalizeDescription, normalizeLocation } from '../utils/normalizeEvent';

const APPLY = process.argv.includes('--apply');

interface Row { url: string; firestoreId: string | null; title: string; description: string | null; locationName: string | null; extractedAddress: string | null; hostName: string | null }

async function main() {
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, description, locationName, extractedAddress, hostName
        FROM link_events WHERE hidden = 0 AND time > datetime('now')
    `).all() as Row[];

    const upd = sqlite.prepare('UPDATE link_events SET title = ?, description = ?, locationName = ?, extractedAddress = ?, updatedAt = ? WHERE url = ?');
    const stats = { title: 0, description: 0, location: 0, address: 0, rows: 0 };
    const samples: string[] = [];

    for (const r of rows) {
        const loc = normalizeLocation(r.locationName ?? undefined, r.extractedAddress || undefined);
        const newLoc = loc.venueName ?? r.locationName ?? '';
        const newAddr = loc.address ?? r.extractedAddress ?? '';
        const newTitle = normalizeTitle(r.title, { venueName: newLoc, hostName: r.hostName ?? undefined });
        const newDesc = normalizeDescription(r.description);

        const patch: Record<string, unknown> = {};
        if (newTitle !== r.title) { patch.title = newTitle; stats.title++; }
        if (newDesc !== (r.description ?? '')) { patch.description = newDesc; stats.description++; }
        if (newLoc !== (r.locationName ?? '')) { patch.locationName = newLoc; stats.location++; }
        if (newAddr !== (r.extractedAddress ?? '')) { patch.extractedAddress = newAddr; stats.address++; }
        if (!Object.keys(patch).length) continue;
        stats.rows++;
        if (samples.length < 12) samples.push(`  ${Object.keys(patch).join('+').padEnd(22)} ${r.title.slice(0, 40).padEnd(40)} → ${String(patch.title ?? patch.locationName ?? patch.description ?? '').slice(0, 50).replace(/\n/g, '⏎')}`);

        if (!APPLY) continue;
        upd.run(newTitle, newDesc, newLoc, newAddr, new Date().toISOString(), r.url);
        if (db && r.firestoreId) {
            try { await db.collection('linkEvents').doc(r.firestoreId).update(stamped(patch)); }
            catch (e: any) { if (e?.code !== 5) console.error(`  ❌ Firestore ${r.url.slice(0, 50)}: ${e?.message}`); }
        }
    }
    console.log(samples.join('\n'));
    console.log(`\nRader att ändra: ${stats.rows} av ${rows.length} — titel ${stats.title}, beskrivning ${stats.description}, plats ${stats.location}, adress ${stats.address}${APPLY ? '' : ' (dry-run)'}`);
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
