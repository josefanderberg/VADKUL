/**
 * lager.ts - I/O mot Firebase för dagsinlägget: bilder och videor upp till
 * Storage (Meta hämtar media serverside från en publik URL), och de tre
 * eventStats-dokument spelet behöver (en läsning per kandidat, aldrig en
 * hel kollektion).
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { bucket, db, STORAGE_BUCKET } from '../../config/firebase';
import { uploadMarketingVideo } from '../marketingVideo';
import { poang, type Matvarde } from './urval';

const STORAGE_FOLDER = 'dagsinlagg';

/** PNG -> JPEG med sips (Instagram tar bara JPEG). null om sips saknas. */
export function tillJpeg(png: string, ut: string): string | null {
    try {
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', png, '--out', ut], { stdio: 'ignore' });
        return fs.existsSync(ut) ? ut : null;
    } catch {
        return null;
    }
}

/** Ladda upp en lokal bild (PNG) som JPEG till Storage. Publik URL. */
export async function laddaUppBild(lokalPng: string, nyckel: string): Promise<string> {
    if (!bucket) throw new Error('Ingen Storage-bucket (service-account.json saknas?)');
    const jpeg = tillJpeg(lokalPng, lokalPng.replace(/\.png$/i, '.jpg'));
    const fil = jpeg ?? lokalPng;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const key = `${STORAGE_FOLDER}/${nyckel.replace(/[^a-z0-9-]+/gi, '-')}-${stamp}${jpeg ? '.jpg' : '.png'}`;
    const f = bucket.file(key);
    await f.save(fs.readFileSync(fil), {
        contentType: jpeg ? 'image/jpeg' : 'image/png',
        metadata: { metadata: { kalla: path.basename(lokalPng) }, cacheControl: 'public, max-age=300' },
        resumable: false,
    });
    await f.makePublic();
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${key}`;
}

export async function laddaUppVideo(lokalMp4: string): Promise<string> {
    const url = await uploadMarketingVideo(lokalMp4);
    if (!url) throw new Error('videouppladdningen misslyckades');
    return url;
}

/** Spelets mätvärden: eventStats/{slug} för varje kandidat -> id: poäng. */
export async function lasMatvarden(kandidater: { id: string; slug: string }[]): Promise<Record<string, number>> {
    const ut: Record<string, number> = {};
    if (!db) throw new Error('Ingen Firestore (service-account.json saknas?)');
    for (const k of kandidater) {
        try {
            const snap = await db.collection('eventStats').doc(k.slug).get();
            const d = (snap.exists ? snap.data() : {}) as Matvarde;
            ut[k.id] = poang(d ?? {});
        } catch (e) {
            console.warn(`[spelet] kunde inte läsa eventStats/${k.slug}: ${(e as Error).message}`);
            ut[k.id] = 0;
        }
    }
    return ut;
}

export function harStorage(): boolean {
    return !!bucket;
}
