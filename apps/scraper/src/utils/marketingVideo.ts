/**
 * marketingVideo.ts — lägg en marknadsföringsvideo i Firebase Storage så
 * Meta kan hämta den.
 *
 * Både Facebooks /videos (`file_url`) och Instagrams reels (`video_url`)
 * hämtar filen serverside från en publik https-URL. Vår Storage-bucket är
 * den väg som bevisligen fungerar för bilder (igImage.ts) — samma väg här.
 * Nyckeln får tidsstämpel (videoStorageKey) så en omkörning aldrig får
 * CDN-cachat gammalt innehåll.
 *
 * Tunt I/O-lager med flit; nyckel- och MIME-logiken är ren och testad i
 * videoPost.test.ts.
 */

import fs from 'fs';
import path from 'path';
import { bucket, STORAGE_BUCKET } from '../config/firebase';
import { videoStorageKey, videoContentType } from './videoPost';

/**
 * Ladda upp en lokal videofil. Returnerar den publika URL:en, eller null om
 * något föll (anroparen avbryter — utan video finns inget att posta).
 */
export async function uploadMarketingVideo(localPath: string): Promise<string | null> {
    if (!bucket) {
        console.error('[Video] Ingen Storage-bucket (service-account.json saknas?)');
        return null;
    }
    if (!fs.existsSync(localPath)) {
        console.error(`[Video] Filen finns inte: ${localPath}`);
        return null;
    }
    const fileName = path.basename(localPath);
    const key = videoStorageKey(fileName, Date.now());
    const contentType = videoContentType(fileName);
    try {
        const file = bucket.file(key);
        await file.save(fs.readFileSync(localPath), {
            contentType,
            metadata: {
                metadata: { sourceFile: fileName, uploadedAt: new Date().toISOString() },
                cacheControl: 'public, max-age=300',
            },
            resumable: false,
        });
        await file.makePublic();
        return `https://storage.googleapis.com/${STORAGE_BUCKET}/${key}`;
    } catch (e) {
        console.error(`[Video] Upload föll: ${(e as Error).message}`);
        return null;
    }
}
