/**
 * igImage.ts — gör en annonsbild publicerbar på Instagram.
 *
 * Två saker skiljer IG från FB och båda fäller annars inlägget:
 *
 *  1. **Format.** Metas Content Publishing API tar JPEG. Våra ad-routes
 *     (`/api/marketing/ad/<slug>`, `/api/marketing/ad-plats`) bygger bilden
 *     med next/og och den svarar PNG — den går rakt in på Facebook men
 *     avvisas av IG. Här konverteras den med `sips` (finns i macOS, jobbet
 *     kör på Mac minin); saknas sips laddas PNG:n upp som den är och IG får
 *     avgöra.
 *  2. **Hämtbar URL.** Meta hämtar bilden serverside vid publicering, så den
 *     måste ligga på en publik, stabil https-URL. En route med query-parametrar
 *     har fällt uppladdningar förr — därför läggs den färdiga JPEG:en i vår
 *     Firebase Storage, som är den väg som bevisligen fungerar (se
 *     socialPublish.ts).
 *
 * Bilden är 1080×1080 (ad-routernas format) = IG:s kvadrat, inget behov av
 * beskärning.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { bucket, STORAGE_BUCKET } from '../config/firebase';

const STORAGE_FOLDER = 'city-posts';
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Storage-nyckel utan icke-ASCII. Kö-id:n bär ortsnamnet ("nyköping-…"), och
 * ett rått ö i objektnamnet ger en URL med rått ö — den hämtade Meta inte:
 * Nyköping 2/9 avvisades med "Only photo or video can be accepted as media
 * type" medan Landskrona och Sundsvall (ren ASCII) gick igenom. Translitterera
 * å/ä/ö och släng resten som inte är [a-z0-9._-].
 */
export function safeStorageKey(key: string): string {
    return key
        .toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/é/g, 'e').replace(/ü/g, 'u')
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        || 'bild';
}

function haveSips(): boolean {
    try {
        execFileSync('/usr/bin/sips', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/** PNG-buffer → JPEG-buffer via sips. Returnerar null om konverteringen föll. */
export function toJpeg(png: Buffer, tmpName: string): Buffer | null {
    if (!haveSips()) {
        console.warn('[IG-bild] sips saknas — laddar upp originalformatet (IG kan avvisa det)');
        return null;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vadkul-ig-'));
    const src = path.join(dir, `${tmpName}.png`);
    const out = path.join(dir, `${tmpName}.jpg`);
    try {
        fs.writeFileSync(src, png);
        execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '85', src, '--out', out], { stdio: 'ignore' });
        return fs.readFileSync(out);
    } catch (e) {
        console.warn(`[IG-bild] sips misslyckades: ${(e as Error).message}`);
        return null;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

/**
 * Hämta bilden på `sourceUrl`, gör den IG-duglig och lägg den i Storage.
 *
 * Returnerar den publika URL:en, eller null om något föll (anroparen får då
 * hoppa över inlägget hellre än att posta utan bild — IG kräver bild).
 */
export async function prepareInstagramImage(sourceUrl: string, key: string): Promise<string | null> {
    if (!bucket) {
        console.error('[IG-bild] Ingen Storage-bucket (service-account.json saknas?)');
        return null;
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
    let raw: Buffer;
    try {
        const res = await fetch(sourceUrl, { signal: ac.signal, redirect: 'follow' });
        if (!res.ok) {
            console.error(`[IG-bild] ${res.status} från ${sourceUrl.slice(0, 80)}`);
            return null;
        }
        raw = Buffer.from(await res.arrayBuffer());
    } catch (e) {
        console.error(`[IG-bild] Hämtning föll: ${(e as Error).message}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
    if (raw.byteLength < 1000) {
        console.error('[IG-bild] Svaret var för litet för att vara en bild');
        return null;
    }

    const jpeg = toJpeg(raw, key);
    const ext = jpeg ? 'jpg' : 'png';
    const body = jpeg ?? raw;
    // Tidsstämpel i filnamnet: Googles CDN serverade en cachad äldre version
    // på samma sökväg i ett dygn efter en omkörning (verifierat 26/8), och
    // Meta hämtar bilden serverside — den skulle få gammalt innehåll. En
    // färsk sökväg per uppladdning kan inte träffa en varm cache.
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-T:]/g, '');
    const filePath = `${STORAGE_FOLDER}/${safeStorageKey(key)}-${stamp}.${ext}`;

    try {
        const file = bucket.file(filePath);
        await file.save(body, {
            contentType: jpeg ? 'image/jpeg' : 'image/png',
            metadata: {
                metadata: { sourceUrl: sourceUrl.slice(0, 500), uploadedAt: new Date().toISOString() },
                cacheControl: 'public, max-age=300',
            },
            resumable: false,
        });
        await file.makePublic();
        return `https://storage.googleapis.com/${STORAGE_BUCKET}/${filePath}`;
    } catch (e) {
        console.error(`[IG-bild] Upload föll: ${(e as Error).message}`);
        return null;
    }
}
