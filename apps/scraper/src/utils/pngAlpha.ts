/**
 * Används en PNG:s alfakanal på riktigt?
 *
 * Bakgrund (stickprov 5/10, 119 omslag i bucketen): PNG-bilderna är 13 % av
 * omslagen men 47 % av bytena — snitt 563 kB, flera på 1–2 MB. Optimeraren
 * (utils/imageOptimize) gör foto-PNG:er till jpeg, men bara när `sips`
 * rapporterar `hasAlpha: no`. Väldigt många PNG:er bär en alfakanal där
 * VARJE pixel ändå är helt ogenomskinlig (export-default i bildprogram) —
 * de kan bli jpeg utan synlig skillnad. Den här modulen läser pixeldatan och
 * svarar på just det, utan beroenden (sharp är spärrat i workspacet, se
 * CLAUDE.md): PNG = zlib-komprimerade, filtrerade scanlines, och Node har
 * zlib inbyggt.
 *
 * Svar: true = ingen pixel är genomskinlig (alfa ≥ OPAQUE_MIN överallt) →
 * säkert att plana ut till jpeg. false = genomskinlighet används. null = vet
 * inte (interlacad, trasig, för stor, okänt format) → behandla som "används"
 * (behåll PNG:en). Hellre en stor bild än en logga på svart bakgrund.
 */
import zlib from 'zlib';

/** Alfa från och med det här räknas som ogenomskinligt (osynlig skillnad). */
export const OPAQUE_MIN = 250;
/** Större än så här avkodas inte (minnet) — svaret blir null. */
export const MAX_PIXELS = 25_000_000;

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
}

export function pngAlphaIsOpaque(buf: Buffer): boolean | null {
    try {
        if (buf.length < 33 || !buf.subarray(0, 8).equals(SIGNATURE)) return null;
        let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
        let trns: Buffer | null = null;
        const idat: Buffer[] = [];
        let pos = 8;
        while (pos + 8 <= buf.length) {
            const len = buf.readUInt32BE(pos);
            const type = buf.toString('latin1', pos + 4, pos + 8);
            const data = buf.subarray(pos + 8, pos + 8 + len);
            if (data.length !== len) return null;
            if (type === 'IHDR') {
                width = data.readUInt32BE(0);
                height = data.readUInt32BE(4);
                bitDepth = data[8];
                colorType = data[9];
                interlace = data[12];
            } else if (type === 'tRNS') {
                trns = Buffer.from(data);
            } else if (type === 'IDAT') {
                idat.push(data);
            } else if (type === 'IEND') {
                break;
            }
            pos += 12 + len;   // längd + typ + data + crc
        }
        if (!width || !height || colorType < 0) return null;

        // Paletter och färg/gråskala utan alfakanal: genomskinlighet finns
        // bara via tRNS. Palett: ogenomskinlig om varje tRNS-post är det
        // (oanvända poster kan inte avgöras utan pixeldata — försiktigt).
        // Färg/gråskala med tRNS = en "genomskinlig färg" → räkna som använd.
        if (colorType === 3) return !trns || trns.every((a) => a >= OPAQUE_MIN);
        if (colorType === 0 || colorType === 2) return trns ? false : true;
        if (colorType !== 4 && colorType !== 6) return null;
        if (bitDepth !== 8 && bitDepth !== 16) return null;
        if (interlace !== 0) return null;   // Adam7 — ovanligt, inte värt koden
        if (width * height > MAX_PIXELS) return null;

        const channels = colorType === 6 ? 4 : 2;
        const bpp = channels * (bitDepth / 8);          // byte per pixel
        const stride = width * bpp;
        const raw = zlib.inflateSync(Buffer.concat(idat));
        if (raw.length < height * (stride + 1)) return null;

        let prev = Buffer.alloc(stride);
        let cur = Buffer.alloc(stride);
        // Alfabytet (det mest signifikanta vid 16 bitar) sist i varje pixel.
        const alphaOffset = bpp - (bitDepth / 8);
        for (let y = 0; y < height; y++) {
            const rowStart = y * (stride + 1);
            const filter = raw[rowStart];
            for (let x = 0; x < stride; x++) {
                const v = raw[rowStart + 1 + x];
                const a = x >= bpp ? cur[x - bpp] : 0;
                const b = prev[x];
                const c = x >= bpp ? prev[x - bpp] : 0;
                let out: number;
                switch (filter) {
                    case 0: out = v; break;
                    case 1: out = v + a; break;
                    case 2: out = v + b; break;
                    case 3: out = v + ((a + b) >> 1); break;
                    case 4: out = v + paeth(a, b, c); break;
                    default: return null;
                }
                cur[x] = out & 0xff;
            }
            for (let x = alphaOffset; x < stride; x += bpp) {
                if (cur[x] < OPAQUE_MIN) return false;
            }
            const t = prev; prev = cur; cur = t;
        }
        return true;
    } catch {
        return null;
    }
}
