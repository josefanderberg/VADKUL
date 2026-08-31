/**
 * Oneoff-analys 2026-08-30: dubblettbilder i Storage (scraped-events/).
 *
 * Bakgrund: Södertälje kommuns event fick alla kommunloggan som og:image,
 * och storageHelper hashar path på EVENT-url → samma bild lagras en gång
 * per event. Detta skript listar bucketen (md5Hash + custom metadata följer
 * med list-anropet — ingen nedladdning) och rapporterar:
 *   - md5-grupper med >1 objekt (identiskt innehåll, flera kopior)
 *   - vilka sourceUrls/hosts som ligger bakom de största grupperna
 *
 * Dumpar rådata som JSON till scratchpad för repair-steget.
 *
 *   npx ts-node src/scripts/oneoff-image-dupe-analysis.ts [--out=/path/dump.json]
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { bucket, STORAGE_BUCKET } from '../config/firebase';

const outPath = (() => {
    const m = process.argv.find(a => a.startsWith('--out='));
    return m ? m.slice('--out='.length) : path.resolve(__dirname, '../../storage-image-dump.json');
})();

interface ObjInfo {
    path: string;
    size: number;
    md5: string;
    sourceUrl: string | null;
    eventUrl: string | null;
}

async function main() {
    if (!bucket) throw new Error('Ingen bucket — kör mot prod (DB_TARGET=1)');

    const objs: ObjInfo[] = [];
    let pageToken: string | undefined;
    let pages = 0;
    do {
        const [files, next] = await (bucket as any).getFiles({
            prefix: 'scraped-events/',
            maxResults: 1000,
            pageToken,
            autoPaginate: false,
        });
        for (const f of files) {
            const md = f.metadata || {};
            objs.push({
                path: f.name,
                size: parseInt(String(md.size || '0'), 10),
                md5: String(md.md5Hash || ''),
                sourceUrl: md.metadata?.sourceUrl || null,
                eventUrl: md.metadata?.eventUrl || null,
            });
        }
        pageToken = next?.pageToken;
        pages++;
        if (pages % 10 === 0) console.log(`  ...${objs.length} objekt listade`);
    } while (pageToken);

    const totalBytes = objs.reduce((s, o) => s + o.size, 0);
    console.log(`\nTotalt: ${objs.length} objekt, ${(totalBytes / 1e9).toFixed(2)} GB i ${STORAGE_BUCKET}/scraped-events/`);

    // md5-grupper
    const byMd5 = new Map<string, ObjInfo[]>();
    for (const o of objs) {
        if (!o.md5) continue;
        const arr = byMd5.get(o.md5) || [];
        arr.push(o);
        byMd5.set(o.md5, arr);
    }
    const dupes = [...byMd5.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length);
    const wastedBytes = dupes.reduce((s, g) => s + g[0].size * (g.length - 1), 0);
    const dupeObjects = dupes.reduce((s, g) => s + g.length - 1, 0);
    console.log(`Dubblettgrupper (samma md5, >1 objekt): ${dupes.length}`);
    console.log(`Överflödiga kopior: ${dupeObjects} objekt, ${(wastedBytes / 1e6).toFixed(1)} MB slösade\n`);

    console.log('Topp 25 dubblettgrupper:');
    for (const g of dupes.slice(0, 25)) {
        const src = g.find(o => o.sourceUrl)?.sourceUrl || '(ingen sourceUrl-metadata)';
        console.log(`  ${String(g.length).padStart(4)} kopior  ${(g[0].size / 1024).toFixed(0).padStart(6)} KB/st  ${src.slice(0, 110)}`);
    }

    // Södertälje-loggan specifikt
    const stLogo = objs.filter(o => /sodertaljelogo/i.test(o.sourceUrl || ''));
    console.log(`\nSödertälje-loggan (sourceUrl ~ sodertaljelogo): ${stLogo.length} objekt`);
    const stMd5 = new Set(stLogo.map(o => o.md5));
    console.log(`  distinkta md5: ${[...stMd5].join(', ')}`);

    // Hur många objekt saknar sourceUrl-metadata?
    const noMeta = objs.filter(o => !o.sourceUrl).length;
    console.log(`\nObjekt utan sourceUrl-metadata: ${noMeta}`);

    // Korsa mot SQLite: hur många objekt refereras inte av något event alls?
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'), { readonly: true });
    const referenced = new Set(
        (sqliteDb.prepare(`SELECT coverImage FROM link_events WHERE coverImage LIKE 'https://storage.googleapis.com/%'`).all() as any[])
            .map(r => String(r.coverImage).replace(`https://storage.googleapis.com/${STORAGE_BUCKET}/`, '')),
    );
    const orphans = objs.filter(o => !referenced.has(o.path));
    const orphanBytes = orphans.reduce((s, o) => s + o.size, 0);
    console.log(`Objekt som inget event (i SQLite-spegeln) pekar på: ${orphans.length} (${(orphanBytes / 1e6).toFixed(1)} MB)`);

    fs.writeFileSync(outPath, JSON.stringify(objs));
    console.log(`\nRådata → ${outPath}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
