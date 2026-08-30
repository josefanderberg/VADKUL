/**
 * Storage-helper: ladda ner remote bilder och spara i Firebase Storage.
 *
 * Tanken: scrapad bild från t.ex. fbcdn.net har 7-dagars expiry. Genom att
 * ladda ner och hosta den hos oss får vi en permanent URL som inte expirar
 * och som inte är CORS-blockerad.
 *
 * Path-konvention: `scraped-events/shared/<sha1-of-remoteImageUrl>.<ext>`
 *   - hashen tas på BILDENS URL, inte eventets: event som delar bild
 *     (turnédatum, serieevent) delar då ett enda storage-objekt.
 *     Före 2026-08-30 hashades på eventUrl — det gav en kopia per event
 *     (Södertälje-loggan låg i 152 exemplar, ~5 GB dubbletter totalt).
 *   - SHA-1 ger 40 hex-tecken (stabilt + URL-safe)
 *   - Legacy-objekt `scraped-events/<sha1-of-eventUrl>.<ext>` finns kvar
 *     och städas av cleanup-storage-images; deleteEventImage träffar bara dem.
 *
 * Public URL: `https://storage.googleapis.com/<bucket>/<path>`
 */

import crypto from 'crypto';
import { bucket, STORAGE_BUCKET } from '../config/firebase';

const STORAGE_FOLDER = 'scraped-events';
const SHARED_FOLDER = 'scraped-events/shared';
const FETCH_TIMEOUT_MS = 20000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB tak per bild

/** SHA-1 av en URL → storage-path-segment */
function hashUrl(url: string): string {
    return crypto.createHash('sha1').update(url).digest('hex');
}

/** Delad storage-path (utan ext) för en remote bild-URL. */
export function sharedPathBase(remoteUrl: string): string {
    return `${SHARED_FOLDER}/${hashUrl(remoteUrl)}`;
}

/** Avgör filändelse från content-type eller URL */
function detectExt(contentType: string | undefined, sourceUrl: string): string {
    const ct = (contentType || '').toLowerCase();
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
    if (ct.includes('png')) return 'png';
    if (ct.includes('webp')) return 'webp';
    if (ct.includes('gif')) return 'gif';
    if (ct.includes('avif')) return 'avif';
    // Fallback: kolla URL-extension
    const m = sourceUrl.match(/\.(jpg|jpeg|png|webp|gif|avif)(?:[?#]|$)/i);
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg');
    return 'jpg';
}

function publicUrlFor(path: string): string {
    return `https://storage.googleapis.com/${STORAGE_BUCKET}/${path}`;
}

/**
 * Returnerar URL till bilden i vår storage. Om den redan finns används den.
 * Om upload misslyckas: returnerar null så caller kan falla tillbaka på remote-URL.
 */
/** Global stat-räknare för debugging. Resetas mellan körningar via resetUploadStats(). */
export const uploadStats = {
    noBucket: 0,
    badUrl: 0,
    alreadyExists: 0,
    fetchFailed: 0,        // status !ok
    fetchAborted: 0,       // timeout/abort
    fetchError: 0,         // andra exceptions
    tooLarge: 0,           // >MAX_BYTES
    tooSmall: 0,           // <1KB
    storageError: 0,
    ok: 0,
};
export function resetUploadStats() {
    Object.keys(uploadStats).forEach(k => { (uploadStats as any)[k] = 0; });
}

export async function uploadEventImage(
    remoteUrl: string,
    eventUrl: string,
): Promise<string | null> {
    if (!bucket) { uploadStats.noBucket++; return null; }
    if (!remoteUrl || !remoteUrl.startsWith('http')) { uploadStats.badUrl++; return null; }

    const base = sharedPathBase(remoteUrl);

    // 1. Kolla om vi redan har bilden i någon av de vanliga formaten
    for (const ext of ['jpg', 'png', 'webp', 'gif', 'avif']) {
        const path = `${base}.${ext}`;
        try {
            const [exists] = await bucket.file(path).exists();
            if (exists) { uploadStats.alreadyExists++; return publicUrlFor(path); }
        } catch { /* ignore */ }
    }

    // 2. Hämta remote
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let buf: Buffer;
    let contentType: string | undefined;
    try {
        const res = await fetch(remoteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 Chrome/124', Accept: 'image/*' },
            redirect: 'follow',
            signal: ac.signal,
        });
        if (!res.ok) { uploadStats.fetchFailed++; return null; }
        contentType = res.headers.get('content-type') ?? undefined;
        const ab = await res.arrayBuffer();
        if (ab.byteLength > MAX_BYTES) { uploadStats.tooLarge++; return null; }
        if (ab.byteLength < 1000) { uploadStats.tooSmall++; return null; }
        buf = Buffer.from(ab);
    } catch (e) {
        if ((e as Error).name === 'AbortError') uploadStats.fetchAborted++;
        else uploadStats.fetchError++;
        return null;
    } finally {
        clearTimeout(t);
    }

    // 3. Upload till Storage + gör public
    const ext = detectExt(contentType, remoteUrl);
    const path = `${base}.${ext}`;
    try {
        const file = bucket.file(path);
        await file.save(buf, {
            contentType: contentType || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
            metadata: {
                metadata: {
                    sourceUrl: remoteUrl.slice(0, 500),
                    eventUrl: eventUrl.slice(0, 500),
                    uploadedAt: new Date().toISOString(),
                },
                cacheControl: 'public, max-age=86400',
            },
            resumable: false,
        });
        await file.makePublic();
        uploadStats.ok++;
        return publicUrlFor(path);
    } catch (e) {
        uploadStats.storageError++;
        console.error(`[Storage] upload failed for ${eventUrl.slice(0, 60)}: ${(e as Error).message}`);
        return null;
    }
}

/**
 * Radera ett events LEGACY-bild från storage (alla format-varianter).
 * Träffar bara gamla per-event-objekt (`scraped-events/<sha1(eventUrl)>`)
 * — delade objekt under shared/ rörs aldrig här, de kan ha fler ägare
 * och städas i stället av orphan-svepet i cleanup-storage-images.
 * Idempotent — fel ignoreras om filen inte finns.
 */
export async function deleteEventImage(eventUrl: string): Promise<boolean> {
    if (!bucket) return false;
    const hash = hashUrl(eventUrl);
    let any = false;
    for (const ext of ['jpg', 'png', 'webp', 'gif', 'avif']) {
        try {
            const [exists] = await bucket.file(`${STORAGE_FOLDER}/${hash}.${ext}`).exists();
            if (exists) {
                await bucket.file(`${STORAGE_FOLDER}/${hash}.${ext}`).delete();
                any = true;
            }
        } catch { /* ignore */ }
    }
    return any;
}

/** Kolla om en URL är vår egen storage. */
export function isOurStorageUrl(url: string | undefined | null): boolean {
    if (!url) return false;
    return url.includes(`storage.googleapis.com/${STORAGE_BUCKET}`)
        || url.includes(`${STORAGE_BUCKET}.googleapis.com`);
}
