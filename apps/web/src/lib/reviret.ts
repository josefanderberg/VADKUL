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
export const HEX_SIZE_MERC = 800;

/** Neutral "blöt" färg för icke-inloggad lokal målning (ingen ägare att färga). */
export const REVIRET_WET_FILL = 'rgba(0, 106, 167, 0.42)';
export const REVIRET_WET_EDGE = 'rgba(0, 106, 167, 0.85)';

/** Grov ruta (i grader) för bbox-prenumeration: varje territory-doc taggas med
 *  `region` så klienten kan lyssna BARA på de buckets som täcker vyn (Firestore
 *  `in`, max 30) i stället för hela kollektionen. ~0.04° ≈ 4–4,5 km. */
export const REGION_DEG = 0.04;

export function regionForLngLat(lng: number, lat: number): string {
    return `${Math.floor(lat / REGION_DEG)}_${Math.floor(lng / REGION_DEG)}`;
}

/** Region-buckets som överlappar en bbox. HÅRT tak (default 60) med tidig retur:
 *  en utzoomad vy kan annars spänna över miljontals buckets och frysa tråden
 *  innan resultatet hinner kapas. Totalt arbete ≤ `max`. Anroparen varnar +
 *  Firestore `in` tar ändå bara 30, så en kapad lista betyder "zooma in". */
export function regionsForBounds(west: number, south: number, east: number, north: number, max = 60): string[] {
    if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
        return [];
    }
    const out: string[] = [];
    const y0 = Math.floor(south / REGION_DEG), y1 = Math.floor(north / REGION_DEG);
    const x0 = Math.floor(west / REGION_DEG), x1 = Math.floor(east / REGION_DEG);
    for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
            out.push(`${y}_${x}`);
            if (out.length >= max) return out;
        }
    }
    return out;
}

/** Stabil färgton (0–359) per användar-id → varje spelare får sin egen färg. */
export function hueForUid(uid: string): number {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return h % 360;
}

/** Förvalda färgtoner att välja mellan i profilen (jämnt spridda, lätt urskiljbara). */
export const REVIRET_HUE_CHOICES = [0, 24, 45, 90, 140, 168, 190, 210, 255, 285, 320, 345];

/** Den inloggade spelarens VALDA färgton (från profilen). null = använd hueForUid.
 *  Modul-global så de synkrona skriv-tjänsterna (claimCells/saveDailyScore/…) kan
 *  läsa den utan att slå upp profilen varje gång. Sätts av page.tsx vid login/ändring. */
let myCustomHue: number | null = null;
export function setMyCustomHue(hue: number | null): void {
    myCustomHue = (hue == null || !Number.isFinite(hue)) ? null : ((Math.round(hue) % 360) + 360) % 360;
}
export function getMyCustomHue(): number | null { return myCustomHue; }

/** Den inloggade spelarens EFFEKTIVA färgton: vald om satt, annars deterministisk
 *  per uid. Anropas bara för den egna spelaren (skriv-tjänsterna skriver sin egen
 *  data; andra spelares ton läses ur deras sparade docs). */
export function effectiveHue(uid: string): number {
    return myCustomHue ?? hueForUid(uid);
}

/** Fyllnad + kant (canvas) för en given färgton. Lagras som ton-sträng i Firestore. */
export function palette(hue: number): { fill: string; edge: string } {
    return { fill: `hsla(${hue}, 72%, 52%, 0.34)`, edge: `hsla(${hue}, 72%, 46%, 0.92)` };
}

export function lngLatToMerc(lng: number, lat: number): { x: number; y: number } {
    const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
    return {
        x: R * lng * D2R,
        y: R * Math.log(Math.tan(Math.PI / 4 + (clampedLat * D2R) / 2)),
    };
}

export function mercToLngLat(x: number, y: number): { lng: number; lat: number } {
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
