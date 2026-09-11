#!/usr/bin/env ts-node
/**
 * ENGÅNGS (egress-svepet 11/9): 345 objekt i scraped-events/ är FELSIDOR
 * sparade som bilder — content-type text/html bakom en .jpg-sökväg (källan
 * svarade med en HTML-sida när scrapern hämtade omslaget). De renderas som
 * trasig bild på eventkorten och är ren barlast i bucketen.
 *
 * Gör per objekt: nollar coverImage på alla link_events-rader som pekar på
 * det (SQLite + Firestore via stamped() — kortet visas då utan bild, vilket
 * är bättre än trasig), och raderar objektet.
 *
 * Kör:  npx ts-node src/scripts/oneoff-clear-broken-images.ts [--apply]
 */

import path from 'path';
import Database from 'better-sqlite3';
import { bucket, STORAGE_BUCKET } from '../config/firebase';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';

const APPLY = process.argv.includes('--apply');

async function main() {
    if (!bucket || !db) { console.error('❌ Firebase ej initialiserat.'); process.exit(1); }
    const sqlite = new Database(path.join(__dirname, '..', '..', 'events.db'));

    const [files] = await bucket.getFiles({ prefix: 'scraped-events/' });
    const broken = files.filter((f) => String(f.metadata.contentType || '').startsWith('text/html'));
    console.log(`${broken.length} text/html-objekt av ${files.length}`);

    let clearedRows = 0, deletedObjects = 0;
    for (const f of broken) {
        const url = `https://storage.googleapis.com/${STORAGE_BUCKET}/${f.name}`;
        const rows = sqlite.prepare('SELECT url, firestoreId FROM link_events WHERE coverImage = ?').all(url) as Array<{ url: string; firestoreId: string | null }>;
        for (const r of rows) {
            if (APPLY) {
                sqlite.prepare("UPDATE link_events SET coverImage = '' WHERE url = ?").run(r.url);
                if (r.firestoreId) {
                    try {
                        await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ coverImage: '' }));
                    } catch (err: any) {
                        if (err?.code !== 5) console.error(`  ⚠️ Firestore-fel ${r.firestoreId}:`, err?.message);
                    }
                }
            }
            clearedRows++;
        }
        if (APPLY) { try { await f.delete(); deletedObjects++; } catch { /* redan borta */ } }
    }
    console.log(APPLY
        ? `✅ ${deletedObjects} objekt raderade, coverImage nollad på ${clearedRows} rader.`
        : `(dry-run: skulle radera ${broken.length} objekt och nolla coverImage på ${clearedRows} rader — kör med --apply)`);
    process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
