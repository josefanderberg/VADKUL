// ── Pinball / Flipper-läge ──────────────────────────────────────────────────
// Top-down flipperbana ovanpå kartan: varje event blir en rund "studsare"
// (bubbla), närliggande studsare flyter ihop (metaball), och en kula avfyras
// med slangbella. Träffar kulan en studsare öppnas det eventet. Kameran fryses
// medan läget är på, så fysiken kan köras i stabila skärm-pixlar (px/ms) och
// studsarna projiceras EN gång per avfyrning i stället för varje frame.
//
// Ren fysik/geometri utan React — flyttat ut ur V2Map så loop-koden i
// komponenten bara konsumerar build*/step-funktionerna och konstanterna.
import maplibregl from 'maplibre-gl';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import { isValidLatLng } from '../../utils/mapUtils';

export const PIN_GEO_MODE: boolean = true;
// Sveriges ungefärliga bbox (banan visar hela Sverige) + en något större ram
// som begränsar panorering så man inte glider iväg från landet, samt centrum.
export const SWEDEN_BOUNDS: [[number, number], [number, number]] = [[10.0, 55.0], [24.6, 69.2]];
export const SWEDEN_PAN_LIMIT: [[number, number], [number, number]] = [[2.0, 52.0], [33.0, 71.5]];
export const SWEDEN_CENTER: [number, number] = [15.2, 62.4];
// Träffradie i SKÄRM-px (DOM-markörer är px-konstanta över zoom → naturligt
// zoom-oberoende). ~halva brickan (44px) + bollens radie.
export const PIN_HIT_RADIUS_PX = 36;
const PIN_BASE_R = 18;                  // px-radie för en ensam bubbla (fryst zoom)
export const PIN_BUMPER_MAX_R = 46;     // tak så jättegrupper inte täcker halva banan
export const PIN_BALL_R = 12;
export const PIN_WALL = 14;             // banans sido-insteg från container-kanten
export const PIN_TOP_RESERVE = 60;      // håll banan under navbaren/kategorichipsen
export const PIN_BOTTOM_RESERVE = 72;   // håll banan ovanför EventCards verktygs-pill
const PIN_FRICTION = 1.0;               // /s — lägre än molnens 2.2 så kulan rullar längre
const PIN_RESTITUTION = 0.84;           // studs mot väggar + studsare
const PIN_BUMPER_KICK = 0.10;           // extra utåt-knuff (px/ms) vid studsar-träff
export const PIN_DT_FIX = 1000 / 120;   // fast fysik-steg (8.33 ms) → inga tunnlingar
export const PIN_DT_CAP = 50;           // tak på frame-delta in i ackumulatorn (flik-byte)
export const PIN_STOP_V = 0.018;        // px/ms — under detta parkeras kulan
const PIN_HIT_COOLDOWN = 250;           // ms per studsare innan den kan öppna eventet igen
const PIN_MAX_V = 2.6;                  // px/ms avfyrnings-tak
export const PIN_MAX_FLIGHT_MS = 14000; // nödbroms: parkera kulan om den rullat för länge
export const PIN_BODY_COLOR = '#1e293b'; // samma mörka palett som brickorna

// ── 3D-terräng i flipper ─────────────────────────────────────────────────────
// I geo-läget slår vi på DEM-terrängen + lutar kameran så reliefen syns, och
// låter kulan PÅVERKAS av underlaget: varje frame läses höjden runt kulan
// (queryTerrainElevation) → lutningen → en knuff i nedförsbacke. project/unproject
// är terräng-medvetna i maplibre 5, så kulan följer redan terräng-ytan;
// gravitationen får den dessutom att rulla ned i dalar/sänkor.
export const PIN_TERRAIN_PITCH = 52;          // kameralutning (grader) i flipper-läget — visar 3D-reliefen
export const PIN_TERRAIN_MAX_ACCEL = 0.0025;  // px/ms² — tak på terräng-accel så branta stup inte slungar kulan
export const PIN_GEO_MAX_ROLL_MS = 15000;     // nödbroms: parkera kulan om den rullar nedför för länge
// Kör-läge: håll fingret framför bollen → den accelererar dit (gas/styrning).
// Krockar man mot ett event tappar man styrningen tills bollen rullat klart.
export const PIN_DRIVE_ACCEL = 0.0013;        // px/ms² — gaskraft mot fingret
export const PIN_DRIVE_MAX_V = 1.0;           // px/ms — toppfart i kör-läget
// Studs i geo-läget: hög restitution + en utåt-knuff längs normalen så kulan
// ACCELERERAR av en träff (flipper-känsla), kapat till ett globalt fart-tak.
export const PIN_GEO_RESTITUTION = 0.95;      // andel fart tillbaka vid studs (var 0.75)
export const PIN_GEO_BOUNCE_KICK = 0.16;      // px/ms extra utåt-fart per studs
export const PIN_GEO_MAX_V = 2.4;             // px/ms — globalt fart-tak (så studsarna inte skenar)

export interface PinBumper {
    key: string; group: LinkEvent[]; emoji: string;
    lat: number; lng: number;          // geo-koordinater för omprojektion när kameran följer bollen
    cx: number; cy: number; r: number; count: number;
    hitFlash: number; lastHit: number;
}
export interface PinBall {
    x: number; y: number; vx: number; vy: number; r: number;
    alive: boolean; armed: boolean; lastHitKey: string | null;
}
export interface PinBoard { minX: number; minY: number; maxX: number; maxY: number; }
export interface PinGrid { near: (x: number, y: number) => PinBumper[]; }

// πr² = n·π·BASE_R²  ⇒  en sammanslagen grupp av N täcker exakt N ensam-areor
// (area-bevarande): det man ser ihopflutet är precis det kulan kan träffa.
const pinBumperRadius = (n: number) => Math.min(PIN_BUMPER_MAX_R, PIN_BASE_R * Math.sqrt(n));

// Projicerar varje grupp till en studsare. Sparar lat/lng så att screen-pos
// kan beräknas om varje frame när kameran följer bollen.
// OBS: MapLibre v5 returnerar canvas-pixlar (DPR-skalade) från map.project().
// Vi delar med dpr så vi får CSS-pixlar som matchar canvas-koordinaterna.
export function buildPinBumpers(map: maplibregl.Map, groups: Map<string, LinkEvent[]>, board: PinBoard, dpr: number): PinBumper[] {
    const M = 80; // marginal: ta med studsare nära skärmkanten
    const out: PinBumper[] = [];
    for (const [key, group] of groups) {
        const rep = group[0];
        if (!rep || !isValidLatLng(rep.lat, rep.lng)) continue;
        const p = map.project([rep.lng!, rep.lat!]);
        // p är i canvas-pixlar (DPR-skalat) → dela med dpr för CSS-pixlar
        const cx = p.x / dpr, cy = p.y / dpr;
        if (cx < board.minX - M || cx > board.maxX + M || cy < board.minY - M || cy > board.maxY + M) continue;
        const catKey = (rep.category && EVENT_CATEGORIES[rep.category as EventCategoryType]) ? rep.category : 'other';
        const emoji = rep.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎟️');
        out.push({ key, group, emoji, lat: rep.lat!, lng: rep.lng!, cx, cy, r: pinBumperRadius(group.length), count: group.length, hitFlash: 0, lastHit: 0 });
    }
    return out;
}

// Likformigt rutnät för O(1)-kollision: kulan testas bara mot sin egen cell + 8
// grannar, oavsett hur många studsare banan har.
export function buildPinGrid(bumpers: PinBumper[], cell: number): PinGrid {
    const buckets = new Map<string, PinBumper[]>();
    for (const b of bumpers) {
        const k = `${Math.floor(b.cx / cell)},${Math.floor(b.cy / cell)}`;
        const arr = buckets.get(k); if (arr) arr.push(b); else buckets.set(k, [b]);
    }
    return {
        near(x, y) {
            const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
            const out: PinBumper[] = [];
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                const arr = buckets.get(`${gx + dx},${gy + dy}`);
                if (arr) out.push(...arr);
            }
            return out;
        }
    };
}

// Ett fast fysik-steg: friktion → semi-implicit Euler → väggar → studsare.
// onHit anropas (debouncat per studsare) när kulan slår in i en bumper.
export function stepPinball(ball: PinBall, board: PinBoard, grid: PinGrid, dt: number, nowMs: number, onHit: (b: PinBumper) => void) {
    const decay = Math.exp(-PIN_FRICTION * dt / 1000); // frame-rate-oberoende friktion
    ball.vx *= decay; ball.vy *= decay;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;

    // väggar
    if (ball.x - ball.r < board.minX) { ball.x = board.minX + ball.r; ball.vx = Math.abs(ball.vx) * PIN_RESTITUTION; }
    if (ball.x + ball.r > board.maxX) { ball.x = board.maxX - ball.r; ball.vx = -Math.abs(ball.vx) * PIN_RESTITUTION; }
    if (ball.y - ball.r < board.minY) { ball.y = board.minY + ball.r; ball.vy = Math.abs(ball.vy) * PIN_RESTITUTION; }
    if (ball.y + ball.r > board.maxY) { ball.y = board.maxY - ball.r; ball.vy = -Math.abs(ball.vy) * PIN_RESTITUTION; }

    // studsare (broadphase: bara kulans cell + 8 grannar)
    let touching: string | null = null;
    for (const b of grid.near(ball.x, ball.y)) {
        const dx = ball.x - b.cx, dy = ball.y - b.cy;
        const minD = ball.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        const d = Math.max(1e-3, Math.sqrt(d2));
        const nx = dx / d, ny = dy / d;
        const overlap = minD - d;
        ball.x += nx * overlap; ball.y += ny * overlap; // de-överlappa
        const vDotN = ball.vx * nx + ball.vy * ny;
        if (vDotN < 0) { // reflektera bara om kulan närmar sig → ingen dubbelstuds-jitter
            ball.vx = (ball.vx - (1 + PIN_RESTITUTION) * vDotN * nx) + nx * PIN_BUMPER_KICK;
            ball.vy = (ball.vy - (1 + PIN_RESTITUTION) * vDotN * ny) + ny * PIN_BUMPER_KICK;
            b.hitFlash = 1;
            if (b.key !== ball.lastHitKey && nowMs - b.lastHit > PIN_HIT_COOLDOWN) { b.lastHit = nowMs; onHit(b); }
        }
        touching = b.key;
    }
    ball.lastHitKey = touching; // nollas när kulan lämnat alla studsare → kan träffa igen senare

    // hård fartgräns så upprepade kicks inte skenar
    const sp = Math.hypot(ball.vx, ball.vy);
    const cap = PIN_MAX_V * 1.4;
    if (sp > cap) { ball.vx = ball.vx / sp * cap; ball.vy = ball.vy / sp * cap; }
}
