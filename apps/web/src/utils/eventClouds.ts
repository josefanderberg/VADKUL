/**
 * Molnlagrets rena logik (#191): var molnen står, hur stora och täta de är,
 * hur de tonar ut när man zoomar in och hur de viker undan för pekaren.
 *
 * Molnen är VADKUL:s logga gjord till karta: i utzoomat läge ligger vita moln
 * över landet, tätare och större där det finns många event. Zoomar man in
 * löses de upp och brickorna tar över. Ritningen bor i
 * components/v2/v2MapClouds.ts - här finns bara matematiken, så den går att
 * testa utan canvas och karta.
 *
 * Ren modul: inga webbläsar- eller kart-API:er.
 */

export interface CloudPoint {
    lat: number;
    lng: number;
}

export interface Cloud {
    /** Stabil nyckel: nivå + ruta. Samma moln behåller sin nyckel när
     *  eventlistan uppdateras, så rörelsen inte börjar om. */
    id: string;
    lat: number;
    lng: number;
    /** Antal event i molnet. */
    count: number;
    /** Halva bredden i px PÅ MOLNETS NIVÅ (skalas med 2^(zoom - nivå)). */
    radius: number;
    /** Täthet 0-1 före zoomtoningen. */
    alpha: number;
    /** 0-1, deterministisk per ruta: väljer molnform och driftfas. */
    seed: number;
}

/** Vid och under den här zoomen står molnen fullt framme (Sverige-vyn). */
export const CLOUD_FULL_ZOOM = 6.5;
/** Vid och över den här zoomen är molnen helt borta. Stadslandningen ligger
 *  runt 10,5 - där ska kartan se ut precis som utan moln. */
export const CLOUD_GONE_ZOOM = 10;
/** Molnens högsta täthet. Under 1 så kartan anas även genom det tätaste.
 *  Storlek och täthet sänktes 11/11 (Josef: "80% av sverige täckt med moln.
 *  så man ser knappt landet") - molnen ska vara tussar över landet, inte ett täcke. */
export const CLOUD_MAX_OPACITY = 0.8;

/** Rutans sida i px på molnets egen nivå. Ett moln per ruta med event. */
export const CLOUD_CELL_PX = 88;
export const CLOUD_MIN_LEVEL = 4;
export const CLOUD_MAX_LEVEL = 10;
/** Nivån byts först när zoomen gått så här långt från den - annars fladdrar
 *  molnen mellan två indelningar när man står mitt emellan. */
const LEVEL_HYSTERESIS = 0.62;

const RADIUS_BASE = 17;
const RADIUS_PER_DOUBLING = 8;
const RADIUS_MAX = 66;
const ALPHA_BASE = 0.32;
const ALPHA_PER_DOUBLING = 0.07;
const ALPHA_MAX = 0.82;

/** Hur långt utanför molnets kant pekaren börjar knuffa (px). */
export const PUSH_MARGIN_PX = 110;
/** Hålet runt pekaren (eller trycket på mobil) där molnen skingras och
 *  eventen under tänds (px). Samma mått som knuffens räckvidd utanför
 *  molnkanten, så det som tänds är det man ser genom hålet. */
export const CLOUD_REVEAL_RADIUS_PX = PUSH_MARGIN_PX;
/** Så många event tänds som mest i hålet (Josef 13/11: "de 50 event som är över där"). */
export const CLOUD_REVEAL_MAX = 50;
/** Hur långt ett moln som mest flyttar sig, som andel av räckvidden. */
const PUSH_STRENGTH = 0.55;
/** Hur mycket ett knuffat moln som mest tunnas ut. */
const PUSH_FADE = 0.4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Molnens täthet för en zoomnivå: full i Sverige-vyn, mjukt ner till noll. */
export function cloudOpacityForZoom(zoom: number): number {
    if (!Number.isFinite(zoom)) return 0;
    const t = clamp((CLOUD_GONE_ZOOM - zoom) / (CLOUD_GONE_ZOOM - CLOUD_FULL_ZOOM), 0, 1);
    return CLOUD_MAX_OPACITY * t * t * (3 - 2 * t);
}

/**
 * Indelningsnivån för en zoom. Med `current` hålls nivån kvar tills zoomen
 * gått tydligt förbi halvvägs till nästa (hysteres).
 */
export function cloudLevelFor(zoom: number, current?: number): number {
    const target = clamp(Math.round(zoom), CLOUD_MIN_LEVEL, CLOUD_MAX_LEVEL);
    if (current == null || !Number.isFinite(current)) return target;
    if (Math.abs(zoom - current) <= LEVEL_HYSTERESIS) return clamp(current, CLOUD_MIN_LEVEL, CLOUD_MAX_LEVEL);
    return target;
}

/** Skalan mellan molnets nivå och den zoom som visas just nu. */
export function cloudScaleFor(zoom: number, level: number): number {
    return Math.pow(2, zoom - level);
}

function mercatorX(lng: number): number {
    return (lng + 180) / 360;
}

function mercatorY(lat: number): number {
    const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}

/** Deterministiskt 0-1 ur två heltal (rutans index). */
function hash01(a: number, b: number): number {
    let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/**
 * Ett moln per ruta som har event, mitt i eventens tyngdpunkt. Fler event =
 * större och tätare moln (logaritmiskt, så Stockholm inte dränker landet).
 * Oplacerade punkter (0,0 eller ogiltiga) hoppas över.
 */
export function buildClouds(points: readonly CloudPoint[], level: number): Cloud[] {
    const cellsPerWorld = (512 * Math.pow(2, level)) / CLOUD_CELL_PX;
    const cells = new Map<string, { ix: number; iy: number; n: number; lat: number; lng: number }>();
    for (const p of points) {
        const { lat, lng } = p;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (!lat || !lng || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
        const ix = Math.floor(mercatorX(lng) * cellsPerWorld);
        const iy = Math.floor(mercatorY(lat) * cellsPerWorld);
        const key = `${ix}_${iy}`;
        const cell = cells.get(key);
        if (cell) {
            cell.n += 1;
            cell.lat += lat;
            cell.lng += lng;
        } else {
            cells.set(key, { ix, iy, n: 1, lat, lng });
        }
    }
    const clouds: Cloud[] = [];
    for (const [key, c] of cells) {
        const doublings = Math.log2(c.n);
        clouds.push({
            id: `${level}:${key}`,
            lat: c.lat / c.n,
            lng: c.lng / c.n,
            count: c.n,
            radius: Math.min(RADIUS_MAX, RADIUS_BASE + RADIUS_PER_DOUBLING * Math.log2(1 + c.n)),
            alpha: Math.min(ALPHA_MAX, ALPHA_BASE + ALPHA_PER_DOUBLING * doublings),
            seed: hash01(c.ix, c.iy),
        });
    }
    // De tätaste sist = ritas överst.
    clouds.sort((a, b) => a.count - b.count || (a.id < b.id ? -1 : 1));
    return clouds;
}

export interface CloudRevealPoint extends CloudPoint {
    key: string;
    /** Populär (🔥) eller guld - går före i urvalet. */
    pop: boolean;
}

/**
 * De event som tänds i ett hål i molnen: alla inom `radiusPx` från `center`
 * vid den här zoomen, populära först och närmast först inom varje skikt, max
 * `max` stycken. Ligger hålet i havet blir listan tom - de närmaste långt
 * bort tänds aldrig. Returen är sorterad på avstånd.
 */
export function pickCloudRevealKeys(
    points: readonly CloudRevealPoint[],
    center: CloudPoint,
    zoom: number,
    radiusPx: number,
    max: number,
): string[] {
    if (!(radiusPx > 0) || !(max > 0) || !Number.isFinite(zoom)) return [];
    const world = 512 * Math.pow(2, zoom);
    const cx = mercatorX(center.lng) * world;
    const cy = mercatorY(center.lat) * world;
    const r2 = radiusPx * radiusPx;
    const inside: { key: string; d2: number; pop: boolean }[] = [];
    for (const p of points) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const dx = mercatorX(p.lng) * world - cx;
        const dy = mercatorY(p.lat) * world - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) inside.push({ key: p.key, d2, pop: p.pop });
    }
    inside.sort((a, b) => (Number(b.pop) - Number(a.pop)) || (a.d2 - b.d2));
    const picked = inside.slice(0, max);
    picked.sort((a, b) => a.d2 - b.d2);
    return picked.map(p => p.key);
}

/**
 * Vart ett moln vill flytta sig när något (pekaren, det valda eventet) står
 * nära: rakt bort från knuffaren, mest precis intill och ingenting vid
 * räckviddens kant. `fade` är hur mycket molnet samtidigt tunnas ut (0-1).
 */
export function pushOffset(
    cloudX: number,
    cloudY: number,
    pusherX: number,
    pusherY: number,
    radius: number,
): { x: number; y: number; fade: number } {
    const reach = radius + PUSH_MARGIN_PX;
    let dx = cloudX - pusherX;
    let dy = cloudY - pusherY;
    const d = Math.hypot(dx, dy);
    if (d >= reach) return { x: 0, y: 0, fade: 0 };
    if (d < 0.5) {
        // Rakt på: ingen riktning att fly i - välj uppåt så molnet inte står kvar.
        dx = 0;
        dy = -1;
    } else {
        dx /= d;
        dy /= d;
    }
    const t = 1 - d / reach;
    const eased = t * t * (3 - 2 * t);
    const dist = reach * PUSH_STRENGTH * eased;
    return { x: dx * dist, y: dy * dist, fade: PUSH_FADE * eased };
}
