#!/usr/bin/env ts-node
/**
 * ENGÅNGS (egress-trappan steg 4, 2026-09-11): sätt lång immutable-cache på
 * alla befintliga bildobjekt i bucketen.
 *
 * Bakgrund: bucketen (scraped-events/) låg på 1–3,7 GB egress/DYGN — omslagen
 * serveras som råa storage.googleapis.com-länkar utanför all CDN, och med
 * gamla `max-age=86400` laddade webbläsarna om samma bilder varje dygn.
 * Objekten är innehållsadresserade (sha1 av käll-URL:en) och byter aldrig
 * innehåll → `public, max-age=31536000, immutable` är säkert.
 * storageHelper sätter numera samma värde på nya uppladdningar.
 *
 * Rapporterar också objekt med content-type text/html — trasiga uppladdningar
 * (en felsida sparad som ".jpg") som renderas som brasig bild på korten.
 *
 * setMetadata = class A-op, ~28k objekt ≈ $0,14. Ingen datanedladdning.
 *
 * Kör:  npx ts-node src/scripts/oneoff-storage-cache-backfill.ts [--apply]
 */

import { bucket } from '../config/firebase';

const APPLY = process.argv.includes('--apply');
const TARGET = 'public, max-age=31536000, immutable';
const CONCURRENCY = 24;

async function main() {
    if (!bucket) { console.error('❌ Storage-bucket ej initialiserad.'); process.exit(1); }
    let updated = 0, already = 0, broken = 0, failed = 0, scanned = 0;
    const brokenSamples: string[] = [];

    const [files] = await bucket.getFiles({ prefix: 'scraped-events/' });
    console.log(`${files.length} objekt under scraped-events/`);

    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (true) {
            const i = next++;
            if (i >= files.length) break;
            const f = files[i];
            scanned++;
            const meta = f.metadata;
            if (String(meta.contentType || '').startsWith('text/html')) {
                broken++;
                if (brokenSamples.length < 10) brokenSamples.push(f.name);
            }
            if (meta.cacheControl === TARGET) { already++; continue; }
            if (!APPLY) { updated++; continue; }
            try {
                await f.setMetadata({ cacheControl: TARGET });
                updated++;
            } catch {
                failed++;
            }
            if (scanned % 2000 === 0) console.log(`  …${scanned}/${files.length}`);
        }
    }));

    console.log(`${APPLY ? 'Uppdaterade' : 'Skulle uppdatera'}: ${updated}, redan rätt: ${already}, fel: ${failed}`);
    console.log(`Trasiga (text/html som bild): ${broken}`);
    for (const s of brokenSamples) console.log('  •', s);
    if (!APPLY) console.log('(dry-run — kör med --apply)');
    process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
