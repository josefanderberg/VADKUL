import { describe, it, expect } from 'vitest';
import {
    brickGradient, iRutan, KARTBILD_BREDD, KARTBILD_HOJD, KATEGORI_HEX, ledigPlats, prickar, prickRadie, prickSvg,
    sverigeProportion, sverigePunkt, tackande, valjBrickor, worldPx,
} from './karta';
import type { DestEvent } from './typer';

const GBG = { lat: 57.71, lng: 11.97 };
const RUTA = { ...GBG, bredd: 1080, hojd: 770, skala: tackande(1080, 770) };

let n = 0;
const ev = (lat: number, lng: number, over: Partial<DestEvent> = {}): DestEvent => ({
    id: `https://x.se/e/${++n}`, title: `Event ${n}`, time: '2026-11-07T18:00:00.000Z', hasSpecificTime: true,
    lat, lng, category: 'music', ...over,
});

describe('projektionen', () => {
    it('worldPx är webbmercator: nollmeridianen och ekvatorn mitt i världen', () => {
        const p = worldPx(0, 0, 0);
        expect(p.x).toBeCloseTo(128);
        expect(p.y).toBeCloseTo(128);
        expect(worldPx(0, 180, 1).x).toBeCloseTo(512);
    });

    it('tackande skalar kartbilden så den täcker ytan', () => {
        const s = tackande(1080, 770);
        expect(KARTBILD_BREDD * s).toBeGreaterThanOrEqual(1080);
        expect(KARTBILD_HOJD * s).toBeCloseTo(770);
    });

    it('stadens mitt hamnar mitt i rutan, öster om mitten hamnar till höger', () => {
        expect(iRutan(GBG, RUTA)).toEqual({ x: 540, y: 385 });
        const ost = iRutan({ lat: GBG.lat, lng: GBG.lng + 0.02 }, RUTA)!;
        expect(ost.x).toBeGreaterThan(540);
        expect(ost.y).toBeCloseTo(385);
        const norr = iRutan({ lat: GBG.lat + 0.01, lng: GBG.lng }, RUTA)!;
        expect(norr.y).toBeLessThan(385);
    });

    it('samma skala som heron: 0,01 grader longitud = 2 bildpx per världspx gånger skalan', () => {
        const a = worldPx(GBG.lat, GBG.lng, 12), b = worldPx(GBG.lat, GBG.lng + 0.01, 12);
        const p = iRutan({ lat: GBG.lat, lng: GBG.lng + 0.01 }, RUTA)!;
        expect(p.x - 540).toBeCloseTo((b.x - a.x) * 2 * RUTA.skala, 5);
    });

    it('event långt bort hamnar utanför (null)', () => {
        expect(iRutan({ lat: 59.33, lng: 18.06 }, RUTA)).toBeNull();
    });
});

describe('valjBrickor', () => {
    const emojiFor = (e: DestEvent): string => e.emoji ?? '🎵';
    const val = { max: 5, minAvstand: 100, marginal: 50, emojiFor };

    it('populärast först, aldrig tätare än minAvstand, aldrig fler än max', () => {
        const events = [
            ev(GBG.lat, GBG.lng, { ps: 10 }),
            ev(GBG.lat, GBG.lng + 0.001, { ps: 90 }),   // nästan samma plats, populärare
            ev(GBG.lat + 0.02, GBG.lng, { ps: 50 }),
            ev(GBG.lat - 0.02, GBG.lng, { ps: 40 }),
            ev(GBG.lat, GBG.lng + 0.05, { ps: 30 }),
            ev(GBG.lat, GBG.lng - 0.05, { ps: 20 }),
            ev(GBG.lat + 0.02, GBG.lng + 0.05, { ps: 5 }),
        ];
        const b = valjBrickor(events, RUTA, val);
        expect(b).toHaveLength(5);
        expect(b[0].id).toBe(events[1].id);
        expect(b.map(x => x.id)).not.toContain(events[0].id);
        for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
            expect(Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y)).toBeGreaterThanOrEqual(100);
        }
    });

    it('sprider kategorierna: högst tre av samma innan andra fått plats', () => {
        const events = [
            ...[0, 1, 2, 3].map(i => ev(GBG.lat, GBG.lng - 0.06 + i * 0.03, { ps: 90 - i, category: 'music' })),
            ev(GBG.lat + 0.02, GBG.lng, { ps: 10, category: 'sport' }),
        ];
        const b = valjBrickor(events, RUTA, { ...val, max: 4 });
        expect(b.filter(x => x.kategori === 'music')).toHaveLength(3);
        expect(b.some(x => x.kategori === 'sport')).toBe(true);
    });

    it('håller sig från kanterna, toppen och botten', () => {
        // y ≈ 108 (i bild men över toppen 150) och y ≈ 675 (i bild men under botten 650).
        const events = [ev(GBG.lat + 0.021, GBG.lng, { ps: 99 }), ev(GBG.lat - 0.022, GBG.lng, { ps: 98 }), ev(GBG.lat, GBG.lng, { ps: 1 })];
        expect(iRutan(events[0], RUTA, 50)!.y).toBeLessThan(150);
        expect(iRutan(events[1], RUTA, 50)!.y).toBeGreaterThan(650);
        const b = valjBrickor(events, RUTA, { ...val, topp: 150, botten: 120 });
        expect(b.map(x => x.id)).toEqual([events[2].id]);
    });
});

describe('ledigPlats', () => {
    it('platsen längst från alla brickor i ramen', () => {
        const p = ledigPlats([{ x: 100, y: 100 }], { x0: 0, y0: 0, x1: 300, y1: 300 }, 10);
        expect(p).toEqual({ x: 300, y: 300 });
    });

    it('kontrollpunkter (etiketten) räknas också', () => {
        // Etiketten till höger om brickan: en bricka till höger skjuter platsen åt vänster.
        const p = ledigPlats([{ x: 300, y: 150 }], { x0: 0, y0: 150, x1: 300, y1: 150 }, 10, [{ dx: 0, dy: 0 }, { dx: 200, dy: 0 }]);
        expect(p.x).toBe(0);
    });

    it('utan brickor: ramens första punkt', () => {
        expect(ledigPlats([], { x0: 10, y0: 20, x1: 30, y1: 40 })).toEqual({ x: 10, y: 20 });
    });
});

describe('Sverige av prickar', () => {
    const H = 1260;
    const B = Math.round(H / sverigeProportion());

    it('Sverigeramen är drygt dubbelt så hög som bred i mercator', () => {
        expect(sverigeProportion()).toBeGreaterThan(2.1);
        expect(sverigeProportion()).toBeLessThan(2.5);
    });

    it('Malmö nere till vänster, Kiruna uppe till höger, Oslo utanför', () => {
        const malmo = sverigePunkt(55.6, 13.0, B, H)!;
        const kiruna = sverigePunkt(67.86, 20.23, B, H)!;
        expect(malmo.y).toBeGreaterThan(H * 0.9);
        expect(malmo.x).toBeLessThan(B * 0.25);
        expect(kiruna.y).toBeLessThan(H * 0.15);
        expect(kiruna.x).toBeGreaterThan(B * 0.5);
        expect(sverigePunkt(59.91, 10.75, B, H)).toBeNull();
    });

    it('event på samma plats blir en prick med antal; utanför ramen ritas inte', () => {
        const p = prickar([{ lat: 59.33, lng: 18.06 }, { lat: 59.33, lng: 18.06 }, { lat: 57.71, lng: 11.97 }, { lat: 48.85, lng: 2.35 }], B, H);
        expect(p).toHaveLength(2);
        expect(p.find(x => x.n === 2)).toBeDefined();
    });

    it('prickradien växer lugnt och har ett tak', () => {
        expect(prickRadie(1)).toBe(3);
        expect(prickRadie(4)).toBeGreaterThan(prickRadie(1));
        expect(prickRadie(10_000)).toBeCloseTo(4.8);
    });

    it('prickSvg: en sken- och en kärncirkel per prick, gult', () => {
        const svg = prickSvg([{ x: 10, y: 20, n: 1 }, { x: 30, y: 40, n: 3 }], 100, 200);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.match(/<circle/g)).toHaveLength(4);
        expect(svg).toContain('#FDE047');
        expect(svg).toContain('viewBox="0 0 100 200"');
    });
});

describe('brickGradient', () => {
    it('kategorins markerHex i mitten, ljusare och mörkare i ändarna', () => {
        const g = brickGradient('music');
        expect(g).toContain(KATEGORI_HEX.music);
        expect(g.startsWith('linear-gradient(145deg')).toBe(true);
        expect(g.match(/rgb\(/g)).toHaveLength(2);
    });

    it('okänd kategori: kartans mörka standardbricka', () => {
        expect(brickGradient('svenskakyrkan')).toContain('#344256');
    });
});
