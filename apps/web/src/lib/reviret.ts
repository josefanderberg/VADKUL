/**
 * reviret.ts — deterministisk geografisk hex-grid för Reviret (territorie-läget).
 *
 * Reviret ligger ovanpå pinball-läget: när kulan rullar målar den de hex-rutor
 * den passerar i spelarens färg, och de event som ligger i målade rutor blir
 * "ditt revir". För att samma ruta ska få samma id på ALLA klienter (en
 * förutsättning för det asynkrona multiplayer-steget) beräknas cell-id:t rent
 * geografiskt — ingen referenspunkt, ingen klient-lokal state.
 *
 * Metod: projicera lng/lat → Web-Mercator-meter, lägg ett pointy-top hex-rutnät
 * i meter-rummet och runda till närmaste cell (cube-rounding). Mercator-skalan
 * växer med latituden (~1.8–2.0 i svenska breddgrader), så en cell är något
 * mindre på marken längst i norr än i söder — irrelevant för ett spelrutnät där
 * det enda som räknas är att alla klienter är överens om samma celler.
 */

const R = 6378137;                  // WGS84-radie (Web Mercator)
const D2R = Math.PI / 180;
const RAD3 = Math.sqrt(3);

/** Hexens cirkumradie (centrum→hörn) i Web-Mercator-meter. ~300 merc-m ger
 *  marknära zoner ~200–300 m breda i svenska latituder. Justerbar. */
export const HEX_SIZE_MERC = 300;

/** Reviret-färg (svensk blå). Steg 1 har bara "blöt" (obesökt) färg — befästning
 *  via incheckning på riktiga event kommer i ett senare steg. */
export const REVIRET_WET_FILL = 'rgba(0, 106, 167, 0.30)';
export const REVIRET_WET_EDGE = 'rgba(0, 106, 167, 0.85)';

function lngLatToMerc(lng: number, lat: number): { x: number; y: number } {
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    return {
        x: R * lng * D2R,
        y: R * Math.log(Math.tan(Math.PI / 4 + (clampedLat * D2R) / 2)),
    };
}

function mercToLngLat(x: number, y: number): { lng: number; lat: number } {
    return {
        lng: (x / R) / D2R,
        lat: (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / D2R,
    };
}

// Pointy-top axial round via cube-rounding → stabil pixel→hex utan glapp/dubbletter.
function hexRound(qf: number, rf: number): { q: number; r: number } {
    let x = qf;
    let z = rf;
    let y = -x - z;
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);
    const dx = Math.abs(rx - x);
    const dy = Math.abs(ry - y);
    const dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    return { q: rx, r: rz };
}

/** Geografisk punkt → stabilt cell-id "q,r" (samma på alla klienter). */
export function lngLatToCell(lng: number, lat: number): string {
    const { x, y } = lngLatToMerc(lng, lat);
    const qf = (RAD3 / 3 * x - 1 / 3 * y) / HEX_SIZE_MERC;
    const rf = (2 / 3 * y) / HEX_SIZE_MERC;
    const { q, r } = hexRound(qf, rf);
    return `${q},${r}`;
}

function cellToMercCenter(cell: string): { x: number; y: number } {
    const comma = cell.indexOf(',');
    const q = Number(cell.slice(0, comma));
    const r = Number(cell.slice(comma + 1));
    return {
        x: HEX_SIZE_MERC * (RAD3 * q + RAD3 / 2 * r),
        y: HEX_SIZE_MERC * (3 / 2 * r),
    };
}

/** Cellens 6 hörn som [lng, lat]-par (pointy-top) — för rendering på kartan. */
export function cellCornersLngLat(cell: string): [number, number][] {
    const c = cellToMercCenter(cell);
    const out: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
        const ang = D2R * (60 * i - 30);
        const ll = mercToLngLat(c.x + HEX_SIZE_MERC * Math.cos(ang), c.y + HEX_SIZE_MERC * Math.sin(ang));
        out.push([ll.lng, ll.lat]);
    }
    return out;
}

/** Cellens centrum som [lng, lat] — för senare etiketter/aggregat. */
export function cellCenterLngLat(cell: string): [number, number] {
    const c = cellToMercCenter(cell);
    const ll = mercToLngLat(c.x, c.y);
    return [ll.lng, ll.lat];
}
