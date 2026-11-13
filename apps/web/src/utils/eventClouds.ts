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

/** Vid och under den här zoomen står molnen fullt framme. 6,5 -> 8 13/11
 *  (Josef: "mer inzoomat så lite tjockare moln"). Prövades på 9,5 samma dag
 *  men blev "för synliga" - huvudkurvan ska INTE vara starkare än så här. */
export const CLOUD_FULL_ZOOM = 8;
/** Här har huvudkurvan tonat ut helt. */
export const CLOUD_FADE_ZOOM = 10;
/** Den svaga resten inzoomat: mellan CLOUD_FADE_ZOOM och CLOUD_GONE_ZOOM ligger
 *  molnen kvar med högst den här tätheten (Josef 13/11: "jag menar bara att de
 *  ska synas lite mer när vi är inzoomade mycket. inte mer annars"). */
export const CLOUD_TAIL_OPACITY = 0.2;
/** Vid och över den här zoomen är molnen helt borta. */
export const CLOUD_GONE_ZOOM = 12;
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
 *  hörnen) som krävs för helt klart väder på CLOUD_CLEAR_LEVEL och inåt.
 *  Utåt växer gränsen med rutans storlek, se cloudClearAt. */
export const CLOUD_CLEAR_AT = 3;
export const CLOUD_CLEAR_LEVEL = 8;
/** Hur mycket gränsen växer per nivå utåt (en ruta har 4x ytan per nivå).
 *  3 -> 3,5 13/11 (Josef: "lite mer över sverige när vi är långt utzoomade"). */
const CLEAR_GROWTH_PER_LEVEL = 3.5;
/** Molnen tätnar så här mycket per nivå inåt från CLOUD_THICK_FROM_LEVEL. */
const THICKEN_PER_LEVEL = 0.08;
const CLOUD_THICK_FROM_LEVEL = 6;
const THICKEN_MAX = 1.25;
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
/** Så många event tänds som mest i hålet - de NÄRMASTE pekaren. Var 50 först
 *  samma dag; Josef 13/11: "Det blir kanske för stökigt att 50st händer med
 *  när man hovrar. det rör sig lite för mycket. Kanske bara att 3 event ska
 *  visas där man hovrar istället." */
export const CLOUD_REVEAL_MAX = 3;
/** Hur långt ett moln som mest flyttar sig, som andel av räckvidden. */
const PUSH_STRENGTH = 0.55;
/** Hur mycket ett knuffat moln som mest tunnas ut. */
const PUSH_FADE = 0.4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * Molnens täthet för en zoomnivå: full till CLOUD_FULL_ZOOM, mjukt ner till
 * noll vid CLOUD_FADE_ZOOM (huvudkurvan, oförändrad sedan 13/11 morgon) - och
 * ovanpå den en svag rest (CLOUD_TAIL_OPACITY) som håller molnen synliga en
 * bit in och tonar ut till CLOUD_GONE_ZOOM. Resten tar bara över där
 * huvudkurvan redan är svagare, så utzoomat är molnen exakt som förut.
 */
export function cloudOpacityForZoom(zoom: number): number {
    if (!Number.isFinite(zoom)) return 0;
    const main = CLOUD_MAX_OPACITY * smooth(clamp((CLOUD_FADE_ZOOM - zoom) / (CLOUD_FADE_ZOOM - CLOUD_FULL_ZOOM), 0, 1));
    const tail = CLOUD_TAIL_OPACITY * smooth(clamp((CLOUD_GONE_ZOOM - zoom) / (CLOUD_GONE_ZOOM - CLOUD_FADE_ZOOM), 0, 1));
    return Math.max(main, tail);
}

/** Nivåerna härifrån och inåt börjar ett helt zoomsteg senare, så den grövre
 *  nivån före dem räcker längre in (Josef 13/11: "de molnen som syns i det
 *  andra ifrån de mest inzoomade steget, de ska vxla över till 3 utzoomnings
 *  läget tidigare. så blir det inte så många tydliga vita moln"). Nivå 9 gav
 *  vid zoom 8,5-9,5 ett tätt rutnät av små rutor där nästan varje ruta var
 *  för gles för klart väder - många tydliga vita moln. Nu gäller nivå 8 till
 *  zoom 9,5, där huvudkurvan nästan tonat ut, och nivå 9 och 10 syns bara med
 *  den svaga resten. */
export const CLOUD_LATE_FROM_LEVEL = 9;
const CLOUD_LATE_STEPS = 1;

/** Zoomen där nivån börjar gälla - under den gäller nivån utanför. */
export function cloudLevelStartZoom(level: number): number {
    return level - 0.5 + (level >= CLOUD_LATE_FROM_LEVEL ? CLOUD_LATE_STEPS : 0);
}

/**
 * Indelningsnivån för en zoom. Med `current` hålls nivån kvar tills zoomen
 * gått tydligt förbi gränsen till nästa (hysteres, LEVEL_HYSTERESIS - 0,5
 * zoomsteg på var sida om gränsen).
 */
export function cloudLevelFor(zoom: number, current?: number): number {
    let target = CLOUD_MIN_LEVEL;
    for (let l = CLOUD_MIN_LEVEL + 1; l <= CLOUD_MAX_LEVEL; l++) {
        if (zoom >= cloudLevelStartZoom(l)) target = l;
    }
    if (current == null || !Number.isFinite(current)) return target;
    const cur = clamp(Math.round(current), CLOUD_MIN_LEVEL, CLOUD_MAX_LEVEL);
    const margin = LEVEL_HYSTERESIS - 0.5;
    const lo = cur > CLOUD_MIN_LEVEL ? cloudLevelStartZoom(cur) - margin : -Infinity;
    const hi = cur < CLOUD_MAX_LEVEL ? cloudLevelStartZoom(cur + 1) + margin : Infinity;
    return zoom >= lo && zoom < hi ? cur : target;
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
 * Hur många viktade event en ruta behöver för helt klart väder på nivån.
 * Utzoomat är rutorna stora (~10 mil i Sverige-vyn) och nästan varje ruta i
 * södra Sverige har några event - med en fast gräns blev hela landet klart och
 * molnen låg bara runt Sverige (Josef 13/11: "kanske att de kan vara över
 * event där de är mindre tätt i utzoomat läge"). Gränsen växer därför med
 * rutans storlek: CLOUD_CLEAR_AT på CLOUD_CLEAR_LEVEL och inåt.
 */
export function cloudClearAt(level: number): number {
    const steps = Math.max(0, CLOUD_CLEAR_LEVEL - level);
    return CLOUD_CLEAR_AT * Math.pow(CLEAR_GROWTH_PER_LEVEL, steps);
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
 * kanterna. Från cloudClearAt(nivå) viktade event är det helt klart; tomma trakter
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
    const clearAt = cloudClearAt(level);
    // Inzoomat lite tjockare moln (Josef 13/11).
    const thicken = clamp(1 + THICKEN_PER_LEVEL * (level - CLOUD_THICK_FROM_LEVEL), 1, THICKEN_MAX);
    const clouds: Cloud[] = [];
    for (let iy = y0; iy <= y1; iy++) {
        for (let ix = x0; ix <= x1; ix++) {
            const here = n(ix, iy);
            const density = here
                + 0.5 * (n(ix - 1, iy) + n(ix + 1, iy) + n(ix, iy - 1) + n(ix, iy + 1))
                + 0.25 * (n(ix - 1, iy - 1) + n(ix + 1, iy - 1) + n(ix - 1, iy + 1) + n(ix + 1, iy + 1));
            const coverage = clamp(1 - density / clearAt, 0, 1);
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
                alpha: Math.min(1, thicken * (ALPHA_MIN + (ALPHA_MAX - ALPHA_MIN) * coverage * (0.55 + 0.45 * seed))),
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
    /** Populär (🔥) eller guld. Påverkar INTE hålets urval - det går bara på
     *  avstånd, så det som tänds ligger där pekaren är (Josef 13/11: hovrar man
     *  över Frölunda ska det inte tändas populära i centrala Göteborg). */
    pop: boolean;
}

/**
 * De event som tänds i hålet runt pekaren: de `max` NÄRMASTE inom `radiusPx`
 * från `center` vid den här zoomen. Ligger hålet i havet blir listan tom - de
 * närmaste långt bort tänds aldrig. Returen är sorterad på avstånd.
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
    const inside: { key: string; d2: number }[] = [];
    for (const p of points) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        const dx = mercatorX(p.lng) * world - cx;
        const dy = mercatorY(p.lat) * world - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) inside.push({ key: p.key, d2 });
    }
    inside.sort((a, b) => a.d2 - b.d2 || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return inside.slice(0, max).map(p => p.key);
}

/** Knuffens acceleration rakt på pekaren (px/s²) - avtar mot räckviddens kant. */
export const GLIDE_PUSH_ACCEL = 2600;
/** Hur fort glidningen bromsas in (tidskonstant, ms). */
export const GLIDE_TAU_MS = 650;
/** Högsta fart ett knuffat moln får (px/s). */
export const GLIDE_MAX_SPEED = 900;
/** Under den här farten (px/s) står molnet still. */
const GLIDE_STOP_SPEED = 4;

/** Ett molns knuff: förskjutningen i px PÅ MOLNETS NIVÅ (så den följer med
 *  när kartan zoomas) och farten i skärm-px per sekund. */
export interface CloudGlide {
    ox: number;
    oy: number;
    vx: number;
    vy: number;
}

/**
 * Ett tidssteg av knuffen (#201, Josef 13/11: "så att de knuffas bort helt
 * alltså glider iväg. men zoomar man in och sen ut så återställs deras
 * defaultplatser"). Varje knuffare (pekaren, trycket, det valda eventet) inom
 * räckhåll accelererar molnet rakt bort från sig, farten bromsas in mjukt och
 * molnet STANNAR där det hamnar - ingen fjäder tillbaka. Återställningen sker
 * i ritlagret (zoomar man in tills molnen är borta, eller byter nivå).
 * `cloudX`/`cloudY` är molnets nuvarande skärmposition (med förskjutningen),
 * `scale` = cloudScaleFor(zoom, nivå).
 */
export function glideStep(
    g: CloudGlide,
    cloudX: number,
    cloudY: number,
    pushers: readonly { x: number; y: number }[],
    radius: number,
    scale: number,
    dtMs: number,
): CloudGlide {
    if (!(dtMs > 0) || !(scale > 0)) return g;
    const dt = dtMs / 1000;
    const reach = radius + PUSH_MARGIN_PX;
    let ax = 0;
    let ay = 0;
    for (const p of pushers) {
        let dx = cloudX - p.x;
        let dy = cloudY - p.y;
        const d = Math.hypot(dx, dy);
        if (d >= reach) continue;
        if (d < 0.5) {
            dx = 0;
            dy = -1;
        } else {
            dx /= d;
            dy /= d;
        }
        const t = 1 - d / reach;
        const eased = t * t * (3 - 2 * t);
        ax += dx * GLIDE_PUSH_ACCEL * eased;
        ay += dy * GLIDE_PUSH_ACCEL * eased;
    }
    let vx = g.vx + ax * dt;
    let vy = g.vy + ay * dt;
    const speed = Math.hypot(vx, vy);
    if (speed > GLIDE_MAX_SPEED) {
        vx *= GLIDE_MAX_SPEED / speed;
        vy *= GLIDE_MAX_SPEED / speed;
    }
    const brake = Math.exp(-dtMs / GLIDE_TAU_MS);
    vx *= brake;
    vy *= brake;
    // Under GLIDE_STOP_SPEED återstår bara ett par pixlar av glidningen -
    // stanna, så ritlagret kan gå tillbaka till vilotakten.
    if (Math.hypot(vx, vy) < GLIDE_STOP_SPEED) {
        vx = 0;
        vy = 0;
    }
    return { ox: g.ox + (vx * dt) / scale, oy: g.oy + (vy * dt) / scale, vx, vy };
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
