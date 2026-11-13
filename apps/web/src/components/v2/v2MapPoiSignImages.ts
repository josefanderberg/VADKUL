/**
 * Skyltbilderna till platsskyltarna (#216, utseendet #225): varje platstyp är
 * ett vägmärke för serviceanläggning - blå platta med vit kantlinje, vitt fält
 * och svart motiv - på en stolpe. Josef 13/11: "designen på skyltarna ska vara
 * exakt som sådan info vägskyltar" och sedan "det ska ju vara exakt kopior men
 * lite mer teknade alltså skylten". MOTIVEN är därför vägmärkenas egna
 * (utils/poiSignPictograms), och SKYLTEN är tecknad: mörk kontur, runda hörn,
 * glans på plattan och en liten lutning ("Lekfull som brickorna"). Inga
 * emojier och ingen gul ram (formen från #216 är ersatt - bygg inte tillbaka).
 * Ritas på en canvas i webbläsaren första gången kartan ber om bilden
 * ('styleimagemissing'), så de överlever stilbyten och ingen sprite behöver
 * hämtas. Vilka skyltar som finns och var de står bestäms i utils/mapPoiSigns.
 */
import type * as maplibregl from 'maplibre-gl';
import { poiSignKeyFromImageId, type PoiSignKey } from '@/utils/mapPoiSigns';
import { POI_SIGN_PICTOGRAMS } from '@/utils/poiSignPictograms';

const PIXEL_RATIO = 2;
// Mått i CSS-px.
const PLATE = 30;
const OUTLINE = 1.5; // mörk tecknad kontur
const EDGE = 1.5; // vägmärkets vita kantlinje innanför konturen
// Vita fältet är 62,5 % av plattan, som på vägmärket.
const FIELD = PLATE * 0.625;
const POLE_H = 9;
const POLE_W = 4;
const PAD = 5; // luft för skugga och lutning
const FOOT_PAD = 1; // stolpens fot står nästan i bildens nederkant = på platsen
const W = PLATE + PAD * 2;
const H = PAD + PLATE + POLE_H + FOOT_PAD;
/** Skylten lutar lite, kring stolpens fot (som står kvar på platsen). */
const TILT_RAD = -4 * Math.PI / 180;
// Vägmärkets blå (#0c479d), ljusare upptill för glansen.
const BLUE_TOP = '#2466c4';
const BLUE = '#0c479d';
const INK = '#0b2550';
const WHITE = '#ffffff';
const BLACK = '#000000';

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
    const foot = H - FOOT_PAD;
    // Luta allt kring stolpens fot.
    ctx.translate(cx, foot);
    ctx.rotate(TILT_RAD);
    ctx.translate(-cx, -foot);
    const top = PAD;
    // Stolpen: från plattans underkant ner till platsen, med mörk kontur.
    ctx.fillStyle = INK;
    roundRect(ctx, cx - POLE_W / 2 - 1, top + PLATE - 2, POLE_W + 2, POLE_H + 2, 2);
    ctx.fill();
    ctx.fillStyle = '#9aa4b2';
    roundRect(ctx, cx - POLE_W / 2, top + PLATE - 2, POLE_W, POLE_H + 1, 1.5);
    ctx.fill();
    // Plattan: mörk kontur med mjuk skugga, vit kantlinje, blå botten.
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.4)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = INK;
    roundRect(ctx, PAD, top, PLATE, PLATE, 7);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = WHITE;
    roundRect(ctx, PAD + OUTLINE, top + OUTLINE, PLATE - OUTLINE * 2, PLATE - OUTLINE * 2, 5.5);
    ctx.fill();
    const inset = OUTLINE + EDGE;
    const blue = ctx.createLinearGradient(0, top, 0, top + PLATE);
    blue.addColorStop(0, BLUE_TOP);
    blue.addColorStop(0.6, BLUE);
    ctx.fillStyle = blue;
    roundRect(ctx, PAD + inset, top + inset, PLATE - inset * 2, PLATE - inset * 2, 4);
    ctx.fill();
    // Glansen: en ljus båge över plattans övre del.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, PAD + inset + 1.5, top + inset + 1, PLATE - inset * 2 - 3, 2.5, 1.25);
    ctx.fill();
    // Vita fältet med motivet, skalat från motivets egen ruta.
    const fx = cx - FIELD / 2;
    const fy = top + (PLATE - FIELD) / 2;
    ctx.fillStyle = WHITE;
    roundRect(ctx, fx, fy, FIELD, FIELD, 2);
    ctx.fill();
    const { box, shapes } = POI_SIGN_PICTOGRAMS[key];
    ctx.save();
    roundRect(ctx, fx, fy, FIELD, FIELD, 2);
    ctx.clip();
    ctx.translate(fx, fy);
    ctx.scale(FIELD / box[2], FIELD / box[2]);
    ctx.translate(-box[0], -box[1]);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const shape of shapes) {
        const color = shape.white ? WHITE : BLACK;
        const path = new Path2D(shape.d);
        if (shape.stroke) {
            ctx.strokeStyle = color;
            ctx.lineWidth = shape.stroke;
            ctx.stroke(path);
        } else {
            ctx.fillStyle = color;
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
