/**
 * Skyltbilderna till platsskyltarna (#216): en liten tecknad vägskylt per
 * platstyp, i samma blågula form som stadsskyltarna (CitySignposts) - blå
 * platta, gul ram, på en stolpe. Ritas på en canvas i webbläsaren första
 * gången kartan ber om bilden ('styleimagemissing'), så de överlever stilbyten
 * och ingen sprite behöver hämtas. Vilka skyltar som finns och var de står
 * bestäms i utils/mapPoiSigns (testad).
 */
import type * as maplibregl from 'maplibre-gl';
import { POI_SIGNS, poiSignKeyFromImageId, type PoiSignKey } from '@/utils/mapPoiSigns';

const PIXEL_RATIO = 2;
// Mått i CSS-px.
const PLATE = 26;
const FRAME = 2.5;
const POLE_H = 9;
const POLE_W = 3;
const PAD = 3; // luft för skuggan
const W = PLATE + PAD * 2;
const H = PLATE + POLE_H + PAD * 2;
const BLUE = '#006AA7';
const YELLOW = '#FECC02';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawSign(key: PoiSignKey): ImageData | null {
    const cv = document.createElement('canvas');
    cv.width = W * PIXEL_RATIO;
    cv.height = H * PIXEL_RATIO;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
    const cx = W / 2;
    // Stolpen: från plattans underkant ner till platsen (bildens nederkant).
    ctx.fillStyle = '#5b6470';
    ctx.fillRect(cx - POLE_W / 2, PAD + PLATE - 1, POLE_W, POLE_H + 1);
    // Plattan med mjuk skugga, gul ram och blå botten.
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.35)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = YELLOW;
    roundRect(ctx, PAD, PAD, PLATE, PLATE, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = BLUE;
    roundRect(ctx, PAD + FRAME, PAD + FRAME, PLATE - FRAME * 2, PLATE - FRAME * 2, 3);
    ctx.fill();
    // Tecknet.
    ctx.font = '14px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(POI_SIGNS[key].emoji, cx, PAD + PLATE / 2 + 1);
    return ctx.getImageData(0, 0, cv.width, cv.height);
}

/** Koppla skyltbilderna till kartan. Returnerar en städfunktion. */
export function attachPoiSignImages(map: maplibregl.Map): () => void {
    const add = (id: string) => {
        const key = poiSignKeyFromImageId(id);
        if (!key || map.hasImage(id)) return;
        const image = drawSign(key);
        if (image) map.addImage(id, image, { pixelRatio: PIXEL_RATIO });
    };
    const onMissing = (e: { id: string }) => add(e.id);
    map.on('styleimagemissing', onMissing);
    return () => {
        try { map.off('styleimagemissing', onMissing); } catch { /* kartan är redan riven */ }
    };
}
