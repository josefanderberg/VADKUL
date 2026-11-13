/**
 * Molnlagrets rena logik (#191, #198): var molnen står, hur stora och täta de
 * är, hur de tonar ut när man zoomar in och hur de viker undan för pekaren.
 *
 * Molnen är VADKUL:s logga gjord till karta: i utzoomat läge ligger vita moln
 * över det som är GLEST - tomma trakter, hav, grannländer - och där det händer
 * saker är det klart väder (vänt 13/11, Josef: "borde vi kanske ha molnen där
 * det inte är lika många event istället? ... för rökigt/molnigt där man är").
 * Molnen är trasiga och spridda, inte ett täcke, så landet syns emellan.
 * Zoomar man in löses de upp och brickorna tar över. Ritningen bor i
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
    /** Antal event i molnets ruta (glesa rutor kan ha några få). */
    count: number;
    /** Extra puffar runt molnet (0-2) - de tommaste trakterna blir banker. */
    extra: number;
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

/** Rutans sida i px på molnets egen nivå. Högst ett moln per ruta. */
export const CLOUD_CELL_PX = 88;
export const CLOUD_MIN_LEVEL = 4;
export const CLOUD_MAX_LEVEL = 10;
/** Nivån byts först när zoomen gått så här långt från den - annars fladdrar
 *  molnen mellan två indelningar när man står mitt emellan. */
const LEVEL_HYSTERESIS = 0.62;

/** Så många viktade event (rutan + halva grannarna + en fjärdedel av
 *  hörnen) som krävs för helt klart väder. */
export const CLOUD_CLEAR_AT = 3;
/** Andel av de helt tomma rutorna som får ett moln - resten är luckor, så
 *  molnen blir trasiga och spridda och landet syns emellan. Glesa rutor
 *  får färre i proportion till hur glest det är. */
export const CLOUD_PRESENCE = 0.62;
/** Fler rutor än så i vyn = något är fel (ofantlig vy) - bygg inget. */
const MAX_VIEW_CELLS = 4000;
const RADIUS_MIN = 30;
const RADIUS_MAX = 62;
const ALPHA_MIN = 0.3;
const ALPHA_MAX = 0.78;

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

/** Lat ur webbmercatorns y (0 = nord, 1 = syd). */
function latFromMercatorY(y: number): number {
    return ((2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180) / Math.PI;
}

/** Området molnen ska täcka (oftast vyn plus en marginal). */
export interface CloudView {
    west: number;
    south: number;
    east: number;
    north: number;
}

/**
 * Molnen för vyn: rutnätet på molnens nivå läggs över `view`, och varje ruta
 * får ett moln efter hur GLEST det är där. Tätheten är rutans event plus
 * halva grannarnas och en fjärdedel av hörnens, så en stad blir klar även i
 * kanterna. Från CLOUD_CLEAR_AT viktade event är det helt klart; tomma trakter
 * får moln i CLOUD_PRESENCE av rutorna (luckorna gör molnen trasiga). Varje
 * moln har en fast form, storlek och förskjutning per ruta, så samma vy ger
 * samma moln och ett moln behåller sin nyckel när eventlistan fylls på.
 * Oplacerade punkter (0,0 eller ogiltiga) hoppas över.
 */
export function buildClouds(points: readonly CloudPoint[], level: number, view: CloudView): Cloud[] {
    const cellsPerWorld = (512 * Math.pow(2, level)) / CLOUD_CELL_PX;
    const counts = new Map<string, number>();
    for (const p of points) {
        const { lat, lng } = p;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (!lat || !lng || Math.abs(lat) > 85 || Math.abs(lng) > 180) continue;
        const key = `${Math.floor(mercatorX(lng) * cellsPerWorld)}_${Math.floor(mercatorY(lat) * cellsPerWorld)}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (![view.west, view.south, view.east, view.north].every(Number.isFinite)) return [];
    const x0 = Math.floor(mercatorX(clamp(view.west, -180, 180)) * cellsPerWorld);
    const x1 = Math.floor(mercatorX(clamp(view.east, -180, 180)) * cellsPerWorld);
    const y0 = Math.floor(mercatorY(view.north) * cellsPerWorld);
    const y1 = Math.floor(mercatorY(view.south) * cellsPerWorld);
    if (x1 < x0 || y1 < y0) return [];
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_VIEW_CELLS) return [];

    const n = (ix: number, iy: number) => counts.get(`${ix}_${iy}`) ?? 0;
    const clouds: Cloud[] = [];
    for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
            const here = n(ix, iy);
            const density = here
                + 0.5 * (n(ix - 1, iy) + n(ix + 1, iy) + n(ix, iy - 1) + n(ix, iy + 1))
                + 0.25 * (n(ix - 1, iy - 1) + n(ix + 1, iy - 1) + n(ix - 1, iy + 1) + n(ix + 1, iy + 1));
            const coverage = clamp(1 - density / CLOUD_CLEAR_AT, 0, 1);
            if (coverage <= 0.05) continue;
            // Luckorna: en fast andel av rutorna står tomma, fler ju glesare
            // molnen ska vara.
            if (hash01(ix, iy) > CLOUD_PRESENCE * coverage) continue;
            const seed = hash01(ix + 1013, iy - 7307);
            const jx = hash01(iy * 3 + 11, ix * 5 - 17) - 0.5;
            const jy = hash01(ix * 7 - 29, iy * 13 + 5) - 0.5;
            const size = hash01(ix - 401, iy + 2903);
            const lng = ((ix + 0.5 + jx * 0.6) / cellsPerWorld) * 360 - 180;
            const lat = latFromMercatorY((iy + 0.5 + jy * 0.6) / cellsPerWorld);
            clouds.push({
                id: `${level}:${ix}_${iy}`,
                lat,
                lng,
                count: here,
                radius: RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * (0.35 * coverage + 0.65 * size),
                alpha: ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * coverage * (0.55 + 0.45 * seed),
                extra: coverage > 0.85 && size > 0.55 ? (size > 0.85 ? 2 : 1) : 0,
                seed,
            });
        }
    }
    // De tätaste sist = ritas överst.
    clouds.sort((a, b) => a.alpha - b.alpha || (a.id < b.id ? -1 : 1));
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
