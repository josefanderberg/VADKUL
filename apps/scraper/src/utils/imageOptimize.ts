/**
 * Bildoptimering för omslagsbilder — via macOS inbyggda `sips`.
 *
 * MEDVETET utan sharp: sharp i workspacet är minerad mark
 * (firebase-frameworks-konflikten som fällde deployerna 23–26/8 — se
 * CLAUDE.md). Scrapern kör bara på macOS (MacBooken + Mac minin), där sips
 * alltid finns. På andra plattformar blir optimeringen en no-op.
 *
 * Recept (uppmätt 11/9 på 15 slumpade omslag: 6,1 → 3,5 MB):
 *   - bredd > 900 px → resampla till 900 (korten visas aldrig bredare)
 *   - jpeg → omkoda q75
 *   - png UTAN alfa → konvertera till jpeg q75 (foto-PNG:er är värstingarna,
 *     1,7 MB styck; contentType följer BYTES, sökvägen/ext får ljuga —
 *     webbläsare går på content-type)
 *   - png MED alfa → bara resampling (behåll transparensen)
 *   - resultatet används BARA om det är ≥15 % mindre och avkodbart —
 *     sips FÖRSTORAR gärna redan välpackade småbilder.
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export const MAX_WIDTH = 900;
export const JPEG_QUALITY = 75;
/** Under den här vinsten behåller vi originalet (omkodning ska löna sig). */
export const MIN_SAVING = 0.15;

export interface OptimizeResult {
    buf: Buffer;
    contentType: string;
    /** true när buf är en NY, mindre version (annars originalet orört). */
    optimized: boolean;
}

interface ImageProps { format: string; width: number; hasAlpha: boolean }

function sips(args: string[]): string {
    return execFileSync('/usr/bin/sips', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

function readProps(file: string): ImageProps | null {
    try {
        const out = sips(['-g', 'format', '-g', 'pixelWidth', '-g', 'hasAlpha', file]);
        const format = out.match(/format: (\S+)/)?.[1] ?? '';
        const width = parseInt(out.match(/pixelWidth: (\d+)/)?.[1] ?? '0', 10);
        const hasAlpha = /hasAlpha: yes/.test(out);
        if (!format || !width) return null;
        return { format, width, hasAlpha };
    } catch {
        return null;
    }
}

/**
 * Optimera en bildbuffert. Returnerar ALLTID en användbar buffert —
 * vid varje tveksamhet (fel plattform, okänt format, sips-fel, för liten
 * vinst, oavkodbart resultat) kommer originalet tillbaka orört.
 */
export function optimizeImageBuffer(buf: Buffer, contentType: string): OptimizeResult {
    const orig: OptimizeResult = { buf, contentType, optimized: false };
    if (process.platform !== 'darwin') return orig;
    const ct = (contentType || '').toLowerCase();
    if (!ct.includes('jpeg') && !ct.includes('jpg') && !ct.includes('png')) return orig;

    const tmp = path.join(os.tmpdir(), `vadkul-img-${crypto.randomBytes(6).toString('hex')}`);
    try {
        fs.writeFileSync(tmp, buf);
        const props = readProps(tmp);
        if (!props) return orig;

        const wantJpeg = props.format === 'jpeg' || (props.format === 'png' && !props.hasAlpha);
        const wantResize = props.width > MAX_WIDTH;
        if (!wantResize && !wantJpeg) return orig;               // alfa-png i rätt storlek
        if (!wantResize && props.format === 'jpeg' && buf.length < 60_000) return orig; // liten färdig jpeg — omkodning brukar förstora

        if (wantResize) sips(['--resampleWidth', String(MAX_WIDTH), tmp]);
        if (wantJpeg) sips(['-s', 'format', 'jpeg', '-s', 'formatOptions', String(JPEG_QUALITY), tmp]);

        const out = fs.readFileSync(tmp);
        // Avkodbarhets- och vinstvakt: hellre stort original än trasig/större bild.
        if (out.length < 3_000 || !readProps(tmp)) return orig;
        if (out.length > buf.length * (1 - MIN_SAVING)) return orig;

        return {
            buf: out,
            contentType: wantJpeg ? 'image/jpeg' : contentType,
            optimized: true,
        };
    } catch {
        return orig;
    } finally {
        try { fs.unlinkSync(tmp); } catch { /* borta är borta */ }
    }
}
