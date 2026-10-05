import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import { pngAlphaIsOpaque } from './pngAlpha';

// Minimal PNG-kodare för testerna: IHDR + (tRNS) + IDAT + IEND, valfritt
// filter per rad så att avfiltreringen (Sub/Up/Average/Paeth) prövas.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
}
function paeth(a: number, b: number, c: number) {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
/** rows = råa pixelbytes per rad; filter[y] väljer radens filter. */
function png(opts: { w: number; h: number; colorType: number; bitDepth?: number; rows: number[][]; filters?: number[]; trns?: number[]; interlace?: number }): Buffer {
    const { w, h, colorType, rows } = opts;
    const bitDepth = opts.bitDepth ?? 8;
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType]!;
    const bpp = Math.max(1, channels * (bitDepth / 8));
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = bitDepth; ihdr[9] = colorType; ihdr[12] = opts.interlace ?? 0;
    const lines: number[] = [];
    let prev = new Array(rows[0].length).fill(0);
    rows.forEach((row, y) => {
        const f = opts.filters?.[y] ?? 0;
        lines.push(f);
        row.forEach((v, x) => {
            const a = x >= bpp ? row[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
            const pred = [0, a, b, (a + b) >> 1, paeth(a, b, c)][f];
            lines.push((v - pred) & 0xff);
        });
        prev = row;
    });
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        ...(opts.trns ? [chunk('tRNS', Buffer.from(opts.trns))] : []),
        chunk('IDAT', zlib.deflateSync(Buffer.from(lines))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
const rgba = (w: number, alpha: (x: number, y: number) => number, y: number) =>
    Array.from({ length: w }, (_, x) => [(x * 37 + y * 11) & 0xff, (x * 5) & 0xff, (y * 9) & 0xff, alpha(x, y)]).flat();

describe('pngAlphaIsOpaque', () => {
    it('RGBA där varje pixel är ogenomskinlig → true (kan bli jpeg)', () => {
        const rows = [0, 1, 2, 3, 4].map((y) => rgba(6, () => 255, y));
        expect(pngAlphaIsOpaque(png({ w: 6, h: 5, colorType: 6, rows, filters: [0, 1, 2, 3, 4] }))).toBe(true);
    });

    it('en enda genomskinlig pixel → false (behåll PNG)', () => {
        const rows = [0, 1, 2, 3, 4].map((y) => rgba(6, (x, yy) => (x === 4 && yy === 3 ? 0 : 255), y));
        expect(pngAlphaIsOpaque(png({ w: 6, h: 5, colorType: 6, rows, filters: [4, 3, 2, 1, 0] }))).toBe(false);
    });

    it('nästan ogenomskinligt (≥250) räknas som ogenomskinligt; kantutjämning (<250) gör det inte', () => {
        const near = [0, 1].map((y) => rgba(4, () => 252, y));
        expect(pngAlphaIsOpaque(png({ w: 4, h: 2, colorType: 6, rows: near }))).toBe(true);
        const aa = [0, 1].map((y) => rgba(4, (x) => (x === 0 ? 200 : 255), y));
        expect(pngAlphaIsOpaque(png({ w: 4, h: 2, colorType: 6, rows: aa, filters: [1, 4] }))).toBe(false);
    });

    it('gråskala + alfa (färgtyp 4)', () => {
        const opaque = [[10, 255, 20, 255], [30, 255, 40, 255]];
        expect(pngAlphaIsOpaque(png({ w: 2, h: 2, colorType: 4, rows: opaque, filters: [0, 2] }))).toBe(true);
        const holes = [[10, 255, 20, 0], [30, 255, 40, 255]];
        expect(pngAlphaIsOpaque(png({ w: 2, h: 2, colorType: 4, rows: holes }))).toBe(false);
    });

    it('16 bitar: alfans mest signifikanta byte avgör', () => {
        const row = (a: number) => [0, 1, 0, 2, 0, 3, a, 0];   // R G B A, två byte var
        expect(pngAlphaIsOpaque(png({ w: 1, h: 2, colorType: 6, bitDepth: 16, rows: [row(255), row(255)] }))).toBe(true);
        expect(pngAlphaIsOpaque(png({ w: 1, h: 2, colorType: 6, bitDepth: 16, rows: [row(255), row(10)] }))).toBe(false);
    });

    it('palett: utan tRNS ogenomskinlig, med genomskinlig post inte', () => {
        const rows = [[0, 1], [1, 0]];
        expect(pngAlphaIsOpaque(png({ w: 2, h: 2, colorType: 3, rows }))).toBe(true);
        expect(pngAlphaIsOpaque(png({ w: 2, h: 2, colorType: 3, rows, trns: [255, 0] }))).toBe(false);
    });

    it('RGB utan alfa → true; RGB med tRNS-färg → false', () => {
        const rows = [[1, 2, 3, 4, 5, 6]];
        expect(pngAlphaIsOpaque(png({ w: 2, h: 1, colorType: 2, rows }))).toBe(true);
        expect(pngAlphaIsOpaque(png({ w: 2, h: 1, colorType: 2, rows, trns: [0, 1, 0, 2, 0, 3] }))).toBe(false);
    });

    it('vet inte → null: interlacad, trasig, inte en PNG', () => {
        const rows = [rgba(2, () => 255, 0)];
        expect(pngAlphaIsOpaque(png({ w: 2, h: 1, colorType: 6, rows, interlace: 1 }))).toBeNull();
        const good = png({ w: 2, h: 1, colorType: 6, rows });
        expect(pngAlphaIsOpaque(good.subarray(0, good.length - 20))).toBeNull();
        expect(pngAlphaIsOpaque(Buffer.from('GIF89a hej hej hej hej hej hej hej'))).toBeNull();
    });
});
