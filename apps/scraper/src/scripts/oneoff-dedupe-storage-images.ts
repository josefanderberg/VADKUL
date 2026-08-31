/**
 * Oneoff-repair 2026-08-30: dubblettbilder + logga-som-eventbild i Storage.
 *
 * Bakgrund: storageHelper hashade på EVENT-url → varje event fick en egen
 * kopia av sin bild. Södertäljes kommunlogga (sajtvid og:image) låg i 152
 * exemplar och visades som "eventbild" på hela stadssidan. Totalt ~5 GB
 * identiska dubbletter (41 % av bucketen).
 *
 * Tre steg (allt dry-run per default, --apply för att skriva):
 *   1. STRIP  — event vars bildkälla är logga/platshållare (imageFilter)
 *               → coverImage '' i Firestore (stamped) + SQLite.
 *   2. DEDUPE — md5-grupper >1: ett kanoniskt objekt kopieras till
 *               scraped-events/shared/<sha1(sourceUrl)>.<ext> (= exakt den
 *               path nya uploadEventImage använder → framtida scrapes
 *               återanvänder den), alla event pekas om.
 *   3. DEADREF — synliga FRAMTIDA event vars coverImage pekar på objekt
 *               som inte finns → coverImage '' (trasig bild på sajten idag).
 *
 * OBS: skriptet RADERAR INGET — produktionens aggregat pekar på de gamla
 * URL:erna tills nästa data-deploy (08:00). Efter deployen är gamla objekt
 * föräldralösa; radera dem då med:
 *   npx ts-node src/scripts/cleanup-storage-images.ts --apply --sweep-orphans
 *
 * Firestore-skrivningar batchas (400/batch) och stämplas via stamped() så
 * inkrementella synken ser dem. SQLite uppdateras direkt så aggregate kan
 * köras om samma dag.
 *
 *   npx ts-node src/scripts/oneoff-dedupe-storage-images.ts           # dry-run
 *   npx ts-node src/scripts/oneoff-dedupe-storage-images.ts --apply
 */

import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { db, bucket, STORAGE_BUCKET } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { isLikelyLogoOrPlaceholderImage } from '../utils/imageFilter';

const APPLY = process.argv.includes('--apply');
const URL_PREFIX = `https://storage.googleapis.com/${STORAGE_BUCKET}/`;

interface ObjInfo { path: string; size: number; md5: string; sourceUrl: string | null }
interface EventRow { url: string; firestoreId: string | null; coverImage: string; hostName: string; hidden: number; future: number }

function sha1(s: string): string { return crypto.createHash('sha1').update(s).digest('hex'); }

/** Enkel promise-pool. */
async function pooled<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<number> {
    let failed = 0;
    let i = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
            const item = items[i++];
            try { await fn(item); } catch { failed++; }
        }
    });
    await Promise.all(workers);
    return failed;
}

async function main() {
    if (!db || !bucket) throw new Error('Firebase/bucket ej init (kör DB_TARGET=1)');
    const sqliteDb = new Database(path.resolve(__dirname, '../../events.db'));
    console.log(APPLY ? '🔧 APPLY' : '🔍 DRY-RUN');

    // ── Lista bucketen (md5 + metadata följer med list-anropet) ──
    const objs: ObjInfo[] = [];
    let pageToken: string | undefined;
    do {
        const [files, next] = await (bucket as any).getFiles({
            prefix: 'scraped-events/', maxResults: 1000, pageToken, autoPaginate: false,
        });
        for (const f of files) {
            objs.push({
                path: f.name,
                size: parseInt(String(f.metadata?.size || '0'), 10),
                md5: String(f.metadata?.md5Hash || ''),
                sourceUrl: f.metadata?.metadata?.sourceUrl || null,
            });
        }
        pageToken = next?.pageToken;
    } while (pageToken);
    const objByPath = new Map(objs.map(o => [o.path, o]));
    console.log(`Bucket: ${objs.length} objekt`);

    // ── Eventrader som har någon bild ──
    const rows = sqliteDb.prepare(`
        SELECT url, firestoreId, coverImage, hostName, hidden,
               (time >= datetime('now')) AS future
        FROM link_events
        WHERE coverImage IS NOT NULL AND coverImage != ''
    `).all() as EventRow[];
    const rowsByObjPath = new Map<string, EventRow[]>();
    for (const r of rows) {
        if (!r.coverImage.startsWith(URL_PREFIX)) continue;
        const p = r.coverImage.slice(URL_PREFIX.length);
        const arr = rowsByObjPath.get(p) || [];
        arr.push(r);
        rowsByObjPath.set(p, arr);
    }

    // Samlade skrivningar: firestoreId → nytt coverImage-värde ('' = strippad)
    const fsUpdates = new Map<string, string>();
    const sqlUpdates: Array<{ url: string; cover: string }> = [];
    const toDelete: string[] = [];       // blir föräldralösa — räknas bara, raderas av sweep-orphans
    const toCopy: Array<{ src: string; dest: string }> = [];
    let noFirestoreId = 0;

    const queueUpdate = (r: EventRow, cover: string) => {
        sqlUpdates.push({ url: r.url, cover });
        if (r.firestoreId) fsUpdates.set(r.firestoreId, cover);
        else noFirestoreId++;
    };

    // ── 1. STRIP: logga/platshållare ──
    const junkObjs = objs.filter(o => o.sourceUrl && isLikelyLogoOrPlaceholderImage(o.sourceUrl));
    const junkPaths = new Set(junkObjs.map(o => o.path));
    const stripByHost = new Map<string, number>();
    for (const o of junkObjs) {
        for (const r of rowsByObjPath.get(o.path) || []) {
            queueUpdate(r, '');
            stripByHost.set(r.hostName, (stripByHost.get(r.hostName) || 0) + 1);
        }
        toDelete.push(o.path);
    }
    // Även rader vars coverImage är en RÅ remote-URL som matchar filtret
    // (uppladdningen misslyckades — t.ex. example.com/logotype.png)
    let strippedRemote = 0;
    for (const r of rows) {
        if (r.coverImage.startsWith(URL_PREFIX)) continue;
        if (isLikelyLogoOrPlaceholderImage(r.coverImage)) {
            queueUpdate(r, '');
            strippedRemote++;
            stripByHost.set(r.hostName, (stripByHost.get(r.hostName) || 0) + 1);
        }
    }
    console.log(`\n── STRIP: ${junkObjs.length} logg-/platshållarobjekt, ${sqlUpdates.length} eventrader (varav ${strippedRemote} råa remote-URLs)`);
    for (const [h, c] of [...stripByHost.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
        console.log(`     ${String(c).padStart(4)}  ${h}`);
    }

    // ── 2. DEDUPE: md5-grupper >1 (exkl. junk som redan raderas) ──
    const byMd5 = new Map<string, ObjInfo[]>();
    for (const o of objs) {
        if (!o.md5 || junkPaths.has(o.path) || o.path.startsWith('scraped-events/shared/')) continue;
        const arr = byMd5.get(o.md5) || [];
        arr.push(o);
        byMd5.set(o.md5, arr);
    }
    let dedupeGroups = 0, dedupeRepointed = 0, dedupeDeleted = 0, dedupeBytes = 0, skippedNoSource = 0;
    for (const group of byMd5.values()) {
        if (group.length < 2) continue;
        const withSource = group.find(o => o.sourceUrl);
        if (!withSource) { skippedNoSource++; continue; }
        dedupeGroups++;
        const ext = (withSource.path.match(/\.(\w+)$/) || [, 'jpg'])[1];
        const dest = `scraped-events/shared/${sha1(withSource.sourceUrl!)}.${ext}`;
        toCopy.push({ src: withSource.path, dest });
        const destUrl = URL_PREFIX + dest;
        for (const o of group) {
            for (const r of rowsByObjPath.get(o.path) || []) {
                queueUpdate(r, destUrl);
                dedupeRepointed++;
            }
            toDelete.push(o.path);
            dedupeDeleted++;
            dedupeBytes += o.size;
        }
    }
    console.log(`\n── DEDUPE: ${dedupeGroups} grupper → ${toCopy.length} kanoniska kopior, ${dedupeRepointed} event ompekade, ${dedupeDeleted} objekt raderas (${(dedupeBytes / 1e6).toFixed(0)} MB)${skippedNoSource ? `, ${skippedNoSource} grupper utan sourceUrl skippade` : ''}`);

    // ── 3. DEADREF: synliga framtida event → objekt som inte finns ──
    let deadRefs = 0;
    for (const [p, refs] of rowsByObjPath.entries()) {
        if (objByPath.has(p)) continue;
        for (const r of refs) {
            if (r.hidden === 0 && r.future === 1) { queueUpdate(r, ''); deadRefs++; }
        }
    }
    console.log(`── DEADREF: ${deadRefs} synliga framtida event med död bildreferens → nullas`);
    if (noFirestoreId) console.log(`   (${noFirestoreId} rader utan firestoreId — bara SQLite uppdateras)`);

    if (!APPLY) {
        console.log(`\nSummering (dry): ${fsUpdates.size} Firestore-docs, ${sqlUpdates.length} SQLite-rader, ${toCopy.length} kopior; ${toDelete.length} objekt blir föräldralösa (raderas senare av sweep-orphans).`);
        console.log('Kör med --apply för att genomföra.');
        process.exit(0);
    }

    // ── APPLY: kopiera kanoniska först (innan något raderas!) ──
    console.log('\nKopierar kanoniska objekt...');
    const copyFailed = await pooled(toCopy, 12, async ({ src, dest }) => {
        const destFile = bucket!.file(dest);
        const [exists] = await destFile.exists();
        if (!exists) {
            await bucket!.file(src).copy(destFile);
            await destFile.makePublic();
        }
    });
    console.log(`  klart (${copyFailed} fel)`);
    if (copyFailed > 0) throw new Error('Kopieringsfel — avbryter före ompekning/radering');

    // ── Firestore batchade updates ──
    console.log('Uppdaterar Firestore...');
    const entries = [...fsUpdates.entries()];
    let fsGone = 0;
    for (let i = 0; i < entries.length; i += 400) {
        const chunk = entries.slice(i, i + 400);
        const batch = db.batch();
        for (const [id, cover] of chunk) {
            batch.update(db.collection('linkEvents').doc(id), stamped({ coverImage: cover }));
        }
        try {
            await batch.commit();
        } catch {
            // NOT_FOUND på ETT doc fäller hela batchen (spegeln kan ha rader
            // vars Firestore-doc raderats) → ta chunken individuellt.
            for (const [id, cover] of chunk) {
                try {
                    await db.collection('linkEvents').doc(id).update(stamped({ coverImage: cover }));
                } catch { fsGone++; }
            }
        }
        if ((i / 400) % 10 === 0) console.log(`  ...${Math.min(i + 400, entries.length)}/${entries.length}`);
    }
    if (fsGone) console.log(`  (${fsGone} docs fanns inte längre i Firestore — skippade)`);

    // ── SQLite ──
    console.log('Uppdaterar SQLite-spegeln...');
    const stmt = sqliteDb.prepare(`UPDATE link_events SET coverImage = ?, updatedAt = ? WHERE url = ?`);
    const now = new Date().toISOString();
    const tx = sqliteDb.transaction((ups: typeof sqlUpdates) => {
        for (const u of ups) stmt.run(u.cover, now, u.url);
    });
    tx(sqlUpdates);

    console.log(`\n✅ KLART: ${entries.length} Firestore-docs, ${sqlUpdates.length} SQLite-rader, ${toCopy.length} kanoniska kopior.`);
    console.log(`${toDelete.length} gamla objekt är nu (eller blir efter synk) föräldralösa —`);
    console.log('radera dem EFTER nästa data-deploy (08:00) med:');
    console.log('  npx ts-node src/scripts/cleanup-storage-images.ts --apply --sweep-orphans');
    sqliteDb.close();
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
