/**
 * Skyltbilderna till platsskyltarna (#216, utseendet #225): varje platstyp är
 * ett vägmärke för serviceanläggning - blå platta med vit kantlinje, vitt fält
 * och svart symbol - på en stolpe. Josef 13/11: "designen på skyltarna ska vara
 * exakt som sådan info vägskyltar. samma design." Inga emojier och ingen gul
 * ram (den blågula formen från #216 är ersatt - bygg inte tillbaka den).
 * Ritas på en canvas i webbläsaren första gången kartan ber om bilden
 * ('styleimagemissing'), så de överlever stilbyten och ingen sprite behöver
 * hämtas. Vilka skyltar som finns och var de står bestäms i utils/mapPoiSigns,
 * symbolerna i utils/poiSignPictograms (båda testade).
 */
import type * as maplibregl from 'maplibre-gl';
import { poiSignKeyFromImageId, type PoiSignKey } from '@/utils/mapPoiSigns';
import { PICTOGRAM_BOX, POI_SIGN_PICTOGRAMS } from '@/utils/poiSignPictograms';

const PIXEL_RATIO = 2;
// Mått i CSS-px.
const PLATE = 28;
const EDGE = 1; // vit kantlinje runt plattan
const FIELD_INSET = 4.5; // plattans kant -> vita fältet
const SYMBOL_INSET = 1.5; // luft mellan fältets kant och symbolen
const POLE_H = 9;
const POLE_W = 3;
const PAD = 3; // luft för skuggan
const W = PLATE + PAD * 2;
const H = PLATE + POLE_H + PAD * 2;
// Vägmärkenas blå.
const BLUE = '#005B9F';
const WHITE = '#ffffff';
const BLACK = '#111111';

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
    // Plattan med mjuk skugga: vit kantlinje, blå botten, vitt fält.
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.35)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    ctx.fillStyle = WHITE;
    roundRect(ctx, PAD, PAD, PLATE, PLATE, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = BLUE;
    roundRect(ctx, PAD + EDGE, PAD + EDGE, PLATE - EDGE * 2, PLATE - EDGE * 2, 3);
    ctx.fill();
    const field = PLATE - FIELD_INSET * 2;
    ctx.fillStyle = WHITE;
    roundRect(ctx, PAD + FIELD_INSET, PAD + FIELD_INSET, field, field, 1.5);
    ctx.fill();
    // Symbolen: svart, skalad från sin ruta till fältet.
    const size = field - SYMBOL_INSET * 2;
    ctx.save();
    ctx.translate(PAD + FIELD_INSET + SYMBOL_INSET, PAD + FIELD_INSET + SYMBOL_INSET);
    ctx.scale(size / PICTOGRAM_BOX, size / PICTOGRAM_BOX);
    ctx.fillStyle = BLACK;
    ctx.strokeStyle = BLACK;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const shape of POI_SIGN_PICTOGRAMS[key]) {
        const path = new Path2D(shape.d);
        if (shape.stroke) {
            ctx.lineWidth = shape.stroke;
            ctx.stroke(path);
        } else {
            ctx.fill(path);
        }
    }
    ctx.restore();
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
