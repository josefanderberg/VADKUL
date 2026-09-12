#!/usr/bin/env ts-node
/**
 * ENGÅNGS (egress-trappan, bildspåret 12/9): omkomprimera de STORA
 * bildobjekten i bucketen in-place.
 *
 * Läget före: 36 087 objekt, 14,55 GB — varav 19 233 objekt >150 kB bär 92 %
 * av alla bytes. Uppladdningen sparade originalbytes (i snitt ~400 kB;
 * 2560 px-original förekommer) och varje visning är full Storage-egress
 * (1–3,7 GB/dygn, ingen CDN). Stickprov 15 bilder: −42 % med receptet i
 * utils/imageOptimize (900 px + jpeg q75 + foto-png → jpeg), som nya
 * uppladdningar numera går genom.
 *
 * Per objekt >tröskeln: ladda ner → optimizeImageBuffer → skriv tillbaka på
 * SAMMA sökväg (URL:erna i eventdatan förblir giltiga; contentType följer
 * bytes — webbläsare går på content-type, inte filändelsen) med immutable-
 * cache. Vinstvakten i optimeraren (≥15 % mindre + avkodbart) gör att
 * tveksamma objekt lämnas orörda. sourceUrl-metadatan bevaras.
 *
 * Kör:  npx ts-node src/scripts/oneoff-recompress-storage-images.ts [--apply] [--limit=N] [--min-bytes=150000] [--concurrency=N]
 */

import { bucket } from '../config/firebase';
import { optimizeImageBuffer } from '../utils/imageOptimize';

const APPLY = process.argv.includes('--apply');
const arg = (n: string, d: number) => {
    const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
    return hit ? parseInt(hit.split('=')[1], 10) : d;
};
const LIMIT = arg('limit', Infinity);
const MIN_BYTES = arg('min-bytes', 150_000);
const CONCURRENCY = arg('concurrency', 6);
const CACHE = 'public, max-age=31536000, immutable';

async function main() {
    if (!bucket) { console.error('❌ Storage ej initialiserad.'); process.exit(1); }
    const [all] = await bucket.getFiles({ prefix: 'scraped-events/' });
    const targets = all
        .filter((f) => Number(f.metadata.size) > MIN_BYTES && /\.(jpe?g|png)$/i.test(f.name))
        .sort((a, b) => Number(b.metadata.size) - Number(a.metadata.size))
        .slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);

    const beforeTotal = targets.reduce((s, f) => s + Number(f.metadata.size), 0);
    console.log(`${targets.length} objekt > ${MIN_BYTES / 1000} kB (${(beforeTotal / 1e9).toFixed(2)} GB)${APPLY ? '' : ' — DRY-RUN (räknar bara på de 40 största)'}`);

    let done = 0, replaced = 0, kept = 0, failed = 0, savedBytes = 0;
    let next = 0;
    const work = APPLY ? targets : targets.slice(0, 40);
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
        while (true) {
            const i = next++;
            if (i >= work.length) break;
            const f = work[i];
            try {
                const [buf] = await f.download();
                const ct = String(f.metadata.contentType || (f.name.endsWith('.png') ? 'image/png' : 'image/jpeg'));
                const opt = optimizeImageBuffer(buf, ct);
                if (!opt.optimized) { kept++; }
                else {
                    savedBytes += buf.length - opt.buf.length;
                    if (APPLY) {
                        await f.save(opt.buf, {
                            contentType: opt.contentType,
                            metadata: {
                                metadata: { ...(f.metadata.metadata as object ?? {}), recompressedAt: new Date().toISOString() },
                                cacheControl: CACHE,
                            },
                            resumable: false,
                        });
                        await f.makePublic();
                    }
                    replaced++;
                }
            } catch (e) {
                failed++;
                console.error(`  ⚠️ ${f.name}: ${(e as Error).message?.slice(0, 80)}`);
            }
            done++;
            if (done % 500 === 0) console.log(`  …${done}/${work.length} — ${(savedBytes / 1e9).toFixed(2)} GB sparat hittills`);
        }
    }));

    console.log(`${APPLY ? '✅' : '(dry-run)'} ${replaced} omskrivna, ${kept} behållna (för liten vinst), ${failed} fel — ${(savedBytes / 1e9).toFixed(2)} GB ${APPLY ? 'sparat' : 'skulle sparas på urvalet'}`);
    process.exit(failed > work.length / 10 ? 1 : 0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
