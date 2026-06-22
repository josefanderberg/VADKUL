/**
 * pinballVerifyService.ts — läs tillbaka pixlar från flipper-canvasen och
 * verifiera att en viss färg ligger på en viss punkt (t.ex. mitten av skärmen).
 *
 * Poängen: pinball/Reviret ritas på en VANLIG 2D-canvas (inte WebGL-kartan), så
 * `getImageData` kan läsa exakt vad som renderats. Då går det att BEVISA att
 * bollen sitter där den ska och har rätt färg — utan att titta på skärmen.
 * Inställningsverktyget i V2Map ställer ett känt läge (solid boll i mitten i en
 * vald färg); den här servicen samplar mittpixeln och jämför.
 */

export interface PixelSample { r: number; g: number; b: number; a: number; hex: string; }
export interface VerifyResult { match: boolean; actual: string; expected: string; distance: number; }

export function rgbToHex(r: number, g: number, b: number): string {
    const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m) return null;
    return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** Sampla en ENskild device-pixel (dx,dy i canvasens device-pixelrum). */
export function samplePixel(canvas: HTMLCanvasElement, dx: number, dy: number): PixelSample | null {
    try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const x = Math.max(0, Math.min(canvas.width - 1, Math.round(dx)));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.round(dy)));
        const d = ctx.getImageData(x, y, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2], a: d[3], hex: rgbToHex(d[0], d[1], d[2]) };
    } catch {
        return null; // tainted canvas e.d. → krascha aldrig
    }
}

/** Sampla mitten av canvasen (device-pixel = width/2, height/2). */
export function sampleCenter(canvas: HTMLCanvasElement): PixelSample | null {
    return samplePixel(canvas, canvas.width / 2, canvas.height / 2);
}

/** Euklidiskt RGB-avstånd (0 = identisk, 441 = svart↔vit). */
function rgbDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

/** Verifiera att pixeln på (dx,dy) matchar expectedHex inom tolerans. */
export function verifyColorAt(
    canvas: HTMLCanvasElement, expectedHex: string, dx: number, dy: number, tolerance = 24,
): VerifyResult | null {
    const want = hexToRgb(expectedHex);
    const got = samplePixel(canvas, dx, dy);
    if (!want || !got) return null;
    const distance = rgbDistance(want, got);
    return { match: distance <= tolerance, actual: got.hex, expected: rgbToHex(want.r, want.g, want.b), distance: Math.round(distance) };
}

/** Verifiera att MITTEN av canvasen har förväntad färg. */
export function verifyCenter(canvas: HTMLCanvasElement, expectedHex: string, tolerance = 24): VerifyResult | null {
    return verifyColorAt(canvas, expectedHex, canvas.width / 2, canvas.height / 2, tolerance);
}
