// ── Brick-utseende: färger, emoji och GL-bildbakning för eventmarkörerna ────
// Ren, React-fri modul. Här bor allt som avgör HUR en eventbricka ser ut:
//   • eventEmoji/groupKeyOf — gemensamma uppslag som V2Map använder överallt
//     (samma logik i GL-lagret, DOM-synken och multi-event-listan).
//   • brickaBodyHex/brickaBodyBg — kroppens kategori-/källfärg.
//   • makeBrickaImageData — bakar brickan som ImageData till GL-symbol-lagret.
//
// Tusentals event som DOM-element gör att MapLibre måste skriva om transform på
// varje element varje frame → kartan laggar. Lösning: rendera de VANLIGA eventen
// som ETT GPU symbol-lager. Varje markör är en bild (nål-bricka + emoji) bakad en
// gång per unik emoji. DOM-brickor används bara för de få "speciella" (valt/
// sparat/eget/guld/grupp/inom-timme), som behöver rik interaktion/animation.
//
// Brickan är en enkel nål-droppe: en rundad kvadrat med tre runda hörn + en spets
// (roterad 45° så spetsen pekar rakt nedåt mot koordinaten). Mörk gradient + tunn
// ljus kant, med emojin centrerad i kroppen. Ingen separat nål/streck under —
// spetsen ÄR nålen. icon-anchor:'bottom' sätter spetsen ~pad ovanför nederkanten,
// dvs. i praktiken på koordinaten.

import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import { sourceColor } from '../../utils/sources';

export const ONE_HOUR_MS = 60 * 60 * 1000;

// En grupp "börjar inom 1 timme" om något event startar i framtiden men inom en
// timme. Samma villkor ger DOM-brickan dess orange ram och GL-pricken sin orange
// fyllning — dela helpern så de aldrig glider isär.
export function groupStartsWithinHour(group: LinkEvent[], nowMs: number): boolean {
    return group.some(e => e.time && e.time.getTime() > nowMs && e.time.getTime() - nowMs <= ONE_HOUR_MS);
}

// Grupp-nyckel: event på (nästan) samma koordinat delar markör. 4 decimaler ≈ 11 m.
export function groupKeyOf(lat: number, lng: number): string {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

// Eventets visnings-emoji: egen vald emoji i första hand, annars kategorins
// standard-emoji (okänd kategori → 'other'), sist generisk biljett.
export function eventEmoji(ev: LinkEvent): string {
    const catKey = ev.category && EVENT_CATEGORIES[ev.category] ? ev.category : 'other';
    return ev.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');
}

// Hex → [r,g,b]. Stödjer både #rgb och #rrggbb.
function parseHex(h: string): [number, number, number] {
    const s = h.replace('#', '');
    const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
// Blanda två hex-färger (t = 0 → a, t = 1 → b) och returnera en rgb()-sträng.
function mixHex(a: string, b: string, t: number): string {
    const pa = parseHex(a), pb = parseHex(b);
    const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
    return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}
// En källfärgs brick-gradient (ljus → bas → mörk) som CSS-sträng för DOM-brickan.
export function sourceGradientCss(color: string): string {
    return `linear-gradient(145deg, ${mixHex(color, '#ffffff', 0.22)} 0%, ${color} 55%, ${mixHex(color, '#000000', 0.32)} 100%)`;
}

// Standardbrickans mörka gradient (händelser utan kategorifärg / stora källor).
export const BRICKA_DARK_BG = 'linear-gradient(145deg, #344256 0%, #1e293b 55%, #16202e 100%)';

// Brick-kroppens kategori-/källfärg för ETT event i normaltillstånd. Stor källa
// (PRO/Korpen/Svenska kyrkan) → mörk standardbricka (null); övriga → sin
// kategoris markerHex. Delas av GL-lagret, DOM-synken, slideshow-cyclern och
// vald-grupp-bläddringen så bakgrunden ALLTID matchar det event som faktiskt
// visas i en multi-event-bricka (förr frös färgen på gruppens FÖRSTA event).
export function brickaBodyHex(ev: LinkEvent): string | null {
    if (sourceColor(ev.url || ev.id) !== null) return null; // stor källa → mörk
    const catKey = ev.category && EVENT_CATEGORIES[ev.category] ? ev.category : 'other';
    return (EVENT_CATEGORIES[catKey as EventCategoryType] as { markerHex?: string }).markerHex ?? null;
}
export function brickaBodyBg(ev: LinkEvent): string {
    const hex = brickaBodyHex(ev);
    return hex ? sourceGradientCss(hex) : BRICKA_DARK_BG;
}

// Baka en bricka som ImageData för GL-symbol-lagret. bodyColor = kategori-/käll-
// färg (utelämnad → mörk standard); selected → tydlig vit ram; saved → vit kropp
// + ljusblå ram (matchar DOM-markörens sparad-look). Alla brickor bakas med SAMMA
// mått (S/pad/DPR) — det är kravet för map.updateImage i emoji-cykelpumpen.
export function makeBrickaImageData(emoji: string, bodyColor?: string, selected = false, saved = false): { data: ImageData; pixelRatio: number } | null {
    if (typeof document === 'undefined') return null;
    const DPR = 2.5;
    const S = 40;          // brickans kropp (logiska px), nära DOM:ens 44
    const pad = 7;         // luft för kant + skugga
    const diag = S * Math.SQRT2;
    const W = Math.round(diag + pad * 2);
    const H = Math.round(diag + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(DPR, DPR);
    const cx = W / 2;
    const cy = H - pad - diag / 2; // kroppens mitt; spetsen hamnar ~pad ovanför nederkant

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4); // 45° medurs → det spetsiga hörnet (br) pekar nedåt
    const r = S / 2;
    const anyCtx = ctx as CanvasRenderingContext2D & {
        roundRect?: (x: number, y: number, w: number, h: number, radii: number[]) => void;
    };
    ctx.beginPath();
    if (typeof anyCtx.roundRect === 'function') {
        anyCtx.roundRect(-S / 2, -S / 2, S, S, [r, r, 0, r]); // tl, tr, br(=spets), bl
    } else {
        ctx.rect(-S / 2, -S / 2, S, S);
    }
    const grad = ctx.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2);
    // Sparad (gillad) bricka = ljus/vit kropp (matchar DOM-markörens vita bakgrund);
    // annars källans/kategorins färg eller mörk standard.
    const stops = saved
        ? ['#ffffff', '#f3f6fa', '#e3e9f1']
        : bodyColor
        ? [mixHex(bodyColor, '#ffffff', 0.22), bodyColor, mixHex(bodyColor, '#000000', 0.32)]
        : ['#344256', '#1e293b', '#16202e'];
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.55, stops[1]);
    grad.addColorStop(1, stops[2]);
    ctx.fillStyle = grad;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Ram: vald = tydlig opak vit (markeringen man är "på"); sparad = ljusblå
    // (#5BA3CC, samma som DOM); annars svag vit kant för djup.
    ctx.lineWidth = selected ? 3.5 : saved ? 2.5 : 2;
    ctx.strokeStyle = selected ? '#ffffff' : saved ? '#5BA3CC' : 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.restore();

    // Emoji centrerad i kroppen (oroterad).
    ctx.font = `${Math.round(S * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);

    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: DPR };
}
