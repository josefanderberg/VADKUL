#!/usr/bin/env ts-node
/**
 * ENGÅNGS: ladda upp affischerna Josef lade i repo-roten och sätt coverImage
 * på respektive event.
 *
 * Följer samma konvention som storageHelper: `scraped-events/<sha1>.<ext>`,
 * publik fil, permanent URL. Nyckeln är Firestore-dokumentets id — eventen
 * saknar url (de ligger på live-spåret), så url duger inte som hash-input.
 *
 * The Yankees-bilden är en mobilskärmdump med svarta band över och under
 * affischen plus statusrad och navigeringsknappar. Den beskärs automatiskt
 * till innehållsbandet — bandet DETEKTERAS (rader som varken är nästan svarta
 * eller den ljusgrå navigeringslisten) i stället för att hårdkodas, och
 * gränserna skrivs ut så de går att kontrollera.
 *
 * Kör:
 *   npx ts-node src/scripts/oneoff-hudiksvall-images.ts --dry
 *   npx ts-node src/scripts/oneoff-hudiksvall-images.ts
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { db, bucket, STORAGE_BUCKET } from '../config/firebase';

const DRY = process.argv.includes('--dry');
const ROOT = path.resolve(__dirname, '../../../..');
const STORAGE_FOLDER = 'scraped-events';

interface Job {
    file: string;
    docId: string;
    label: string;
    /** Skärmdump med svarta band → beskär till innehållsbandet först. */
    autoCrop?: boolean;
}

const JOBS: Job[] = [
    { file: '764833004_3661714227313302_1484869049094494040_n.jpg', docId: 'tpSVHgDE9sxbfyjUnAGh', label: 'Sommarkrysset' },
    { file: '764881284_28092660930351116_4166825346577588122_n.jpg', docId: 'sJeQXvoqlxQTdwOFLpbe', label: 'Stintarocken' },
    { file: '765855312_28361838703432431_8642353865792044716_n.jpg', docId: 'zk6NfSgX2VijNXMMCti9', label: 'The Yankees', autoCrop: true },
    { file: '767597688_10168133491894966_2718018777493049454_n.jpg', docId: 'oecOcWEKmLzN49M0LfOx', label: 'Cruising / Hälsingemarknaden' },
    { file: 'grilleftermiddag_185711.webp', docId: 'W5r7UnIuqsqCWXYggYPS', label: 'Grilleftermiddag' },
];

/**
 * Hitta det lodräta band som faktiskt är affisch. Räknar per rad hur ljus och
 * hur färgvarierad den är: svarta band har både låg ljusstyrka och låg
 * variation, navigeringslisten är ljus men nästan helt utan variation. Affisch
 * har alltid variation. Returnerar största sammanhängande bandet.
 */
async function detectContentBand(buf: Buffer): Promise<{ top: number; height: number; full: number }> {
    const img = sharp(buf);
    const meta = await img.metadata();
    const W = meta.width!, H = meta.height!;
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const ch = info.channels;

    const interesting: boolean[] = [];
    for (let y = 0; y < H; y++) {
        let min = 255, max = 0, sum = 0;
        // Sampla var 8:e pixel på raden — fullt tillräckligt och mycket snabbare.
        for (let x = 0; x < W; x += 8) {
            const i = (y * W + x) * ch;
            const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            if (lum < min) min = lum;
            if (lum > max) max = lum;
            sum += lum;
        }
        const mean = sum / Math.ceil(W / 8);
        // Innehåll = tillräcklig kontrast inom raden OCH inte kolsvart.
        interesting.push((max - min) > 30 && mean > 12);
    }

    let best = { start: 0, len: 0 };
    let curStart = -1;
    for (let y = 0; y <= H; y++) {
        if (y < H && interesting[y]) {
            if (curStart < 0) curStart = y;
        } else if (curStart >= 0) {
            const len = y - curStart;
            if (len > best.len) best = { start: curStart, len };
            curStart = -1;
        }
    }
    return { top: best.start, height: best.len, full: H };
}

function publicUrlFor(p: string): string {
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${p}`;
}

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    if (!bucket) { console.error('❌ Storage-bucket saknas.'); process.exit(1); }

    console.log(`\n🖼  Affischer → Storage${DRY ? '  [DRY RUN]' : ''}\n`);

    for (const job of JOBS) {
        const abs = path.join(ROOT, job.file);
        if (!fs.existsSync(abs)) { console.log(`  ⚠️  Filen saknas: ${job.file}`); continue; }

        const snap = await db.collection('linkEvents').doc(job.docId).get();
        if (!snap.exists) { console.log(`  ⚠️  Dokumentet saknas: ${job.label} (${job.docId})`); continue; }

        // Buffer.from-omslaget håller typen enhetlig: sharps toBuffer() ger en
        // NonSharedBuffer medan readFileSync ger Buffer<ArrayBufferLike>.
        let buf: Buffer = Buffer.from(fs.readFileSync(abs));
        let ext = path.extname(job.file).slice(1).toLowerCase().replace('jpeg', 'jpg');

        if (job.autoCrop) {
            const band = await detectContentBand(buf);
            const pct = ((band.height / band.full) * 100).toFixed(0);
            console.log(`     ↳ beskärning: rad ${band.top}–${band.top + band.height} av ${band.full} (${pct} % av höjden)`);
            if (band.height > 100 && band.height < band.full) {
                const width = (await sharp(buf).metadata()).width!;
                buf = Buffer.from(await sharp(buf)
                    .extract({ left: 0, top: band.top, width, height: band.height })
                    .jpeg({ quality: 88 })
                    .toBuffer());
                ext = 'jpg';
            } else {
                console.log('     ↳ hittade inget vettigt band — laddar upp obeskuren');
            }
        }

        const hash = crypto.createHash('sha1').update(job.docId).digest('hex');
        const storagePath = `${STORAGE_FOLDER}/${hash}.${ext}`;
        const url = publicUrlFor(storagePath);

        if (DRY) {
            console.log(`  ▸ ${job.label}  (${(buf.length / 1024).toFixed(0)} KB) → ${storagePath}`);
            continue;
        }

        const file = bucket.file(storagePath);
        await file.save(buf, {
            contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`,
            metadata: {
                metadata: { source: 'affisch från arrangör via FB-tråd', docId: job.docId, uploadedAt: new Date().toISOString() },
                cacheControl: 'public, max-age=86400',
            },
            resumable: false,
        });
        await file.makePublic();
        await db.collection('linkEvents').doc(job.docId).update({ coverImage: url });
        console.log(`  ✅ ${job.label}  (${(buf.length / 1024).toFixed(0)} KB)`);
        console.log(`     ${url}`);
    }

    console.log('');
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
