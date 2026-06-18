// ── Markör-färger & "bricka"-bild ──────────────────────────────────────────
// Färg-helpers (hex-parsning/blandning) + bakningen av nål-brickans bild som
// GL-symbol. Flyttat ut ur V2Map så färglogiken kan återanvändas (t.ex. av
// kartstilarnas höjdramp) i stället för att ligga inline.
//
// GL-markörer (prestanda): Tusentals event som DOM-element gör att MapLibre
// måste skriva om transform på varje element varje frame → kartan laggar.
// Lösning: rendera de VANLIGA eventen som ETT GPU symbol-lager. Varje markör är
// en bild (nål-bricka + emoji) bakad en gång per unik emoji. DOM-brickor används
// bara för de få "speciella" (valt/sparat/eget/guld/grupp/inom-timme), som
// behöver rik interaktion/animation.
//
// Brickan är en enkel nål-droppe: en rundad kvadrat med tre runda hörn + en spets
// (roterad 45° så spetsen pekar rakt nedåt mot koordinaten). Mörk gradient + tunn
// ljus kant, med emojin centrerad i kroppen. Ingen separat nål/streck under —
// spetsen ÄR nålen. icon-anchor:'bottom' sätter spetsen ~pad ovanför nederkanten,
// dvs. i praktiken på koordinaten.
//
// "Stora" källor (PRO/Korpen/Svenska kyrkan) får en egen brick-färg via bodyColor
// — annars används den mörka standard-gradienten.

// Hex → [r,g,b]. Stödjer både #rgb och #rrggbb.
export function parseHex(h: string): [number, number, number] {
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

export function makeBrickaImageData(emoji: string, bodyColor?: string): { data: ImageData; pixelRatio: number } | null {
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
    const stops = bodyColor
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
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.restore();

    // Emoji centrerad i kroppen (oroterad).
    ctx.font = `${Math.round(S * 0.6)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy);

    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: DPR };
}

// En GL-markör-feature: punkt + vilken bakad bild + grupp-nyckel (för klick).
export type PlainFeature = {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: { icon: string; key: string };
};
