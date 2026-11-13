/**
 * Molnlagret på kartan (#191, #198, #201): en 2D-canvas mellan GL-kartan och DOM-
 * brickorna som ritar vita moln över det som är GLEST - där eventen finns är
 * det klart väder. Var molnen står och hur de beter sig räknas i
 * utils/eventClouds (testad) - här finns bara ritning och rörelse. Molnen
 * byggs för vyn plus en marginal och byggs om medan kartan flyttas; ett moln
 * som kommer till eller försvinner (ny vy, eventen laddas in) tonar.
 *
 * Mjukheten kommer av tre saker:
 *  1. Under en kartrörelse ritas molnen i kartans EGEN bildruta ('render'),
 *     så de aldrig släpar efter panoreringen.
 *  2. Ingenting hoppar: knuffen från pekaren, trycket och det valda eventet är
 *     en glidning med fart som bromsas in (glideStep, #201) - molnet glider
 *     iväg och stannar där det hamnar tills molnen tonat bort helt eller
 *     nivån byts, då står de på sina platser igen. När indelningen byts vid
 *     ett zoomsteg tonar den gamla uppsättningen ut medan den nya tonar in.
 *     En ZOOMNING eller DRAGNING knuffar aldrig (#210, #217): den avväpnar
 *     pekaren (zoomen även trycket) tills man för pekaren igen eller trycker
 *     på nytt.
 *  3. I vila driver molnen bara några pixlar, och då ritas de glest (~12
 *     bilder/s) så lagret inte kostar batteri. Över CLOUD_GONE_ZOOM står
 *     slingan helt still.
 *
 * Canvasen tar aldrig emot pekaren (pointer-events: none) - kartans gester
 * och brickornas klick går rakt igenom.
 */
import type * as maplibregl from 'maplibre-gl';
import {
    buildClouds,
    type CloudView,
    cloudLevelFor,
    cloudOpacityForZoom,
    cloudScaleFor,
    cloudShadow,
    glideStep,
    pushOffset,
    pushRearmed,
    type Cloud,
    type CloudPoint,
} from '@/utils/eventClouds';

export interface EventClouds {
    /** Eventens platser (dagens/veckans filtrerade urval). */
    setPoints(points: readonly CloudPoint[]): void;
    /** Det valda eventets plats - molnen håller sig undan därifrån. */
    setFocus(point: CloudPoint | null): void;
    /** Där man senast tryckte på en pekskärm (#195) - molnen skingras där
     *  som runt muspekaren på datorn. null = inget tryck. */
    setTouchPoint(point: CloudPoint | null): void;
    destroy(): void;
}

/** Tidskonstant för uttunningen när något står tätt intill ett moln. Själva
 *  knuffen är en glidning med fart (eventClouds.glideStep). */
const PUSH_TAU_MS = 420;
/** Hur länge två uppsättningar tonar över i varandra vid ett zoomsteg. */
const SET_FADE_MS = 420;
/** Vilotakten: driften är så långsam att tätare ritning inte syns. */
const IDLE_FRAME_MS = 80;
/** Utanför den här marginalen runt skärmen ritas inga moln - och molnen
 *  byggs för vyn plus samma marginal, så de finns redan när de panoreras in. */
const CULL_MARGIN_PX = 220;
/** Hur ofta molnen byggs om under en kartrörelse (ms). */
const MOVE_REBUILD_MS = 200;
const MAX_DPR = 2;

const SPRITE_W = 256;
const SPRITE_H = 168;
/** Var i spriten molnet har sin mitt (andel av höjden). */
const SPRITE_ANCHOR_Y = 0.58;
/** Molnformerna: överlappande puffar (x, y, r) i spritens koordinater. Sex
 *  former, och var och en ritas även spegelvänd - 12 varianter, så upprepningen
 *  inte syns när molnen är många (#201, Josef 13/11: "Kanske mer varianter av
 *  moln"). De två smala formerna (långt-flackt och tunt-trasigt) prövades och
 *  togs bort samma dag (Josef: "ta bort de smala molnet") - inga smala former.
 *  STACKMOLN FRÅN SIDAN, som loggan: runda tussar sedda uppifrån prövades i
 *  #218 och backades samma kväll (Josef: "det var bättre med sidomoln"). */
const SPRITE_PUFFS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
    // Bulliga stackmoln (de tre första formerna).
    [[70, 100, 46], [118, 78, 58], [170, 94, 50], [206, 112, 34], [40, 116, 30], [126, 114, 48]],
    [[60, 104, 40], [104, 86, 50], [152, 74, 54], [196, 100, 44], [128, 114, 50], [226, 118, 26]],
    [[84, 96, 52], [140, 82, 56], [190, 104, 42], [44, 114, 32], [120, 116, 44], [222, 120, 24]],
    // Liten rund tuss.
    [[106, 102, 34], [144, 94, 40], [176, 108, 28], [86, 116, 24], [128, 118, 34]],
    // Högt tornande.
    [[128, 62, 44], [98, 88, 42], [160, 86, 44], [72, 112, 30], [188, 110, 32], [128, 108, 52]],
    // Två toppar.
    [[58, 106, 32], [92, 94, 38], [128, 110, 26], [164, 92, 40], [202, 104, 34], [108, 120, 24], [184, 120, 24]],
];

interface CloudState {
    cloud: Cloud;
    /** Knuffen: förskjutning i px PÅ MOLNETS NIVÅ (skalas med zoomen) och fart
     *  i skärm-px/s. Ligger kvar tills molnen tonat bort helt eller nivån byts. */
    ox: number;
    oy: number;
    vx: number;
    vy: number;
    /** Nuvarande uttunning av knuffen (0-1). */
    fade: number;
    /** Molnets egen in-/uttoning (0-1). */
    vis: number;
    /** Finns i senaste bygget - annars tonar molnet ut och släpps. */
    present: boolean;
}

interface CloudSet {
    level: number;
    states: CloudState[];
    /** 0-1: uppsättningens egen in-/uttoning. */
    alpha: number;
    /** Tonar ut (ersatt av en ny indelning). */
    leaving: boolean;
}

function makeSprite(puffs: ReadonlyArray<readonly [number, number, number]>): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = SPRITE_W;
    cv.height = SPRITE_H;
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;
    // Skuggan först: samma puffar en bit ner, i kartans blågrå. Den sticker
    // fram under molnets nederkant och ger det kropp mot den ljusa kartan.
    for (const [x, y, r] of puffs) {
        const sy = y + r * 0.2;
        const g = ctx.createRadialGradient(x, sy, r * 0.3, x, sy, r);
        g.addColorStop(0, 'rgba(84,110,150,0.24)');
        g.addColorStop(0.7, 'rgba(84,110,150,0.12)');
        g.addColorStop(1, 'rgba(84,110,150,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, sy, r, 0, Math.PI * 2);
        ctx.fill();
    }
    // Det vita: tätt i mitten, mjuk kant. Puffarna lägger sig på varandra och
    // blir en sammanhängande kropp.
    for (const [x, y, r] of puffs) {
        const g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.85, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    return cv;
}

/** Markskuggan (#215): molnets egen form som en mjuk mörk fläck, i kartans
 *  djupa gröna. Ritas förskjuten under molnet (eventClouds.cloudShadow). */
function makeShadowSprite(puffs: ReadonlyArray<readonly [number, number, number]>): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = SPRITE_W;
    cv.height = SPRITE_H;
    const ctx = cv.getContext('2d');
    if (!ctx) return cv;
    for (const [x, y, r] of puffs) {
        const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        g.addColorStop(0, 'rgba(16,38,30,0.7)');
        g.addColorStop(0.6, 'rgba(16,38,30,0.4)');
        g.addColorStop(1, 'rgba(16,38,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    return cv;
}

function mirrorSprite(src: HTMLCanvasElement): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const ctx = cv.getContext('2d');
    if (!ctx) return src;
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return cv;
}

/** Har enheten en riktig muspekare som kan hovra? Pekskärmar svarar nej. */
export function cloudsCanHover(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(hover: none)').matches;
}

export function attachEventClouds(map: maplibregl.Map): EventClouds {
    const glCanvas = map.getCanvas();
    const canvas = document.createElement('canvas');
    canvas.className = 'vadkul-event-clouds';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
    });
    // Direkt efter GL-canvasen: över kartan, under DOM-brickorna (som ligger
    // senare i samma behållare).
    glCanvas.after(canvas);
    const ctx = canvas.getContext('2d');
    const baseSprites = SPRITE_PUFFS.map(makeSprite);
    const sprites = [...baseSprites, ...baseSprites.map(mirrorSprite)];
    // Skuggorna i samma ordning som molnen, så varje moln får sin egen form.
    const baseShadows = SPRITE_PUFFS.map(makeShadowSprite);
    const shadowSprites = [...baseShadows, ...baseShadows.map(mirrorSprite)];
    // Vad som ska ritas i den här bildrutan: skuggorna först, molnen ovanpå,
    // så en skugga aldrig hamnar över ett annat moln.
    type Stamp = { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; a: number };
    const shadowStamps: Stamp[] = [];
    const cloudStamps: Stamp[] = [];
    const reducedMotion =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Pekskärmar saknar hovring. Webbläsaren skickar ändå en låtsad musrörelse
    // vid varje tryck, som skulle lämna ett hål kvar på skärmen när kartan
    // flyttas - där skingras molnen i stället kring trycket (setTouchPoint).
    const canHover = cloudsCanHover();

    let points: readonly CloudPoint[] = [];
    let focus: CloudPoint | null = null;
    let touchPoint: CloudPoint | null = null;
    let pointer: { x: number; y: number } | null = null;
    // En zoomning knuffar inte (#210): när kartan zoomas ut krymper den kring
    // pekaren och drar in molnen under den, fast den står still. Zoomen
    // avväpnar därför pekaren (tills den flyttats en bit från `pointerParked`)
    // och trycket (tills nästa tryck). Det valda eventet knuffar som förut.
    let pointerArmed = true;
    let pointerParked: { x: number; y: number } | null = null;
    let touchArmed = true;
    let sets: CloudSet[] = [];
    let level: number | null = null;
    let destroyed = false;
    let raf = 0;
    let lastFrame = 0;
    let lastDraw = 0;
    let cssW = 0;
    let cssH = 0;
    /** Något rör sig fortfarande (knuff eller övertoning) - rita varje bildruta. */
    let animating = false;
    /** Något har ändrats sedan senaste ritningen. */
    let dirty = true;
    let cleared = false;

    const resize = () => {
        const w = glCanvas.clientWidth;
        const h = glCanvas.clientHeight;
        const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
        cssW = w;
        cssH = h;
        const pw = Math.max(1, Math.round(w * dpr));
        const ph = Math.max(1, Math.round(h * dpr));
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        dirty = true;
    };

    const activeSet = () => sets.find(s => !s.leaving) ?? null;
    let lastBuildAt = 0;

    /** Vyn plus marginalen, i grader. */
    const viewWithMargin = (): CloudView => {
        const nw = map.unproject([-CULL_MARGIN_PX, -CULL_MARGIN_PX]);
        const se = map.unproject([cssW + CULL_MARGIN_PX, cssH + CULL_MARGIN_PX]);
        return { west: nw.lng, north: nw.lat, east: se.lng, south: se.lat };
    };

    /** Bygg (om) den aktiva uppsättningen. Samma nivå = byt på plats, behåll
     *  molnens rörelse och tona de moln som kommer till eller försvinner;
     *  ny nivå = tona över hela uppsättningen. */
    const rebuild = () => {
        lastBuildAt = performance.now();
        const zoom = map.getZoom();
        const nextLevel = cloudLevelFor(zoom, level ?? undefined);
        const current = activeSet();
        const built = buildClouds(points, nextLevel, viewWithMargin());
        if (current && current.level === nextLevel) {
            const old = new Map(current.states.map(s => [s.cloud.id, s]));
            const next: CloudState[] = [];
            for (const cloud of built) {
                const prev = old.get(cloud.id);
                next.push(prev
                    ? { ...prev, cloud, present: true }
                    : { cloud, ox: 0, oy: 0, vx: 0, vy: 0, fade: 0, vis: 0, present: true });
                old.delete(cloud.id);
            }
            for (const st of old.values()) if (st.vis > 0.01) next.push({ ...st, present: false });
            next.sort((a, b) => a.cloud.alpha - b.cloud.alpha);
            current.states = next;
        } else {
            for (const s of sets) s.leaving = true;
            sets.push({
                level: nextLevel,
                // Hela uppsättningen tonar in via set.alpha - molnen själva står fullt.
                states: built.map(cloud => ({ cloud, ox: 0, oy: 0, vx: 0, vy: 0, fade: 0, vis: 1, present: true })),
                // Allra första uppsättningen tonar också in - inget poppar.
                alpha: 0,
                leaving: false,
            });
        }
        level = nextLevel;
        dirty = true;
    };

    const draw = (now: number) => {
        if (!ctx || destroyed) return;
        const dt = lastFrame ? Math.min(100, now - lastFrame) : 16;
        lastFrame = now;
        lastDraw = now;
        dirty = false;

        const zoom = map.getZoom();
        if (level == null || cloudLevelFor(zoom, level) !== level) rebuild();
        const zoomOpacity = cloudOpacityForZoom(zoom);

        // Uppsättningarnas övertoning.
        let moving = false;
        const step = dt / SET_FADE_MS;
        for (const s of sets) {
            const target = s.leaving ? 0 : 1;
            if (s.alpha !== target) {
                s.alpha = s.leaving ? Math.max(0, s.alpha - step) : Math.min(1, s.alpha + step);
                moving = true;
            }
        }
        sets = sets.filter(s => !(s.leaving && s.alpha <= 0));

        if (zoomOpacity <= 0.002) {
            if (!cleared) {
                ctx.clearRect(0, 0, cssW, cssH);
                cleared = true;
            }
            // Borta ur bild: nollställ övertoningen så nästa utzoomning börjar rent,
            // och ställ tillbaka varje knuffat moln på sin plats (Josef 13/11:
            // "zoomar man in och sen ut så återställs deras defaultplatser").
            for (const s of sets) {
                s.alpha = s.leaving ? 0 : 1;
                for (const st of s.states) {
                    st.ox = 0;
                    st.oy = 0;
                    st.vx = 0;
                    st.vy = 0;
                    st.fade = 0;
                }
            }
            sets = sets.filter(s => !s.leaving);
            animating = false;
            return;
        }
        cleared = false;
        ctx.clearRect(0, 0, cssW, cssH);

        const focusPx = focus ? map.project([focus.lng, focus.lat]) : null;
        const touchPx = touchPoint ? map.project([touchPoint.lng, touchPoint.lat]) : null;
        const ease = 1 - Math.exp(-dt / PUSH_TAU_MS);
        const t = reducedMotion ? 0 : now / 1000;
        // SOLEN STÅR MITT I BILDEN (#218): markskuggorna faller utåt från
        // skärmens mitt. Den följde pekaren först, men då ryckte skuggorna när
        // man hovrade över en knapp (Josef 13/11: "solen är i mitten").
        const sunPx = { x: cssW / 2, y: cssH / 2 };
        const pushers: { x: number; y: number }[] = [];
        if (pointer && pointerArmed) pushers.push(pointer);
        if (focusPx) pushers.push(focusPx);
        if (touchPx && touchArmed) pushers.push(touchPx);

        shadowStamps.length = 0;
        cloudStamps.length = 0;
        for (const set of sets) {
            const scale = cloudScaleFor(zoom, set.level);
            // Moln som kommit till eller försvunnit tonar i sin egen takt.
            let gone = false;
            for (const st of set.states) {
                const target = st.present ? 1 : 0;
                if (st.vis !== target) {
                    st.vis = st.present ? Math.min(1, st.vis + step) : Math.max(0, st.vis - step);
                    moving = true;
                    if (!st.present && st.vis <= 0) gone = true;
                }
            }
            if (gone) set.states = set.states.filter(st => st.present || st.vis > 0);
            for (const st of set.states) {
                const c = st.cloud;
                const p = map.project([c.lng, c.lat]);
                const r = c.radius * scale;
                // Knuffen följer molnet: ett undanknuffat moln ligger kvar
                // förskjutet även när det panoreras ut och in i bild.
                const px = p.x + st.ox * scale;
                const py = p.y + st.oy * scale;
                if (px < -CULL_MARGIN_PX - r || px > cssW + CULL_MARGIN_PX + r
                    || py < -CULL_MARGIN_PX - r || py > cssH + CULL_MARGIN_PX + r) {
                    st.vx = 0;
                    st.vy = 0;
                    st.fade = 0;
                    continue;
                }
                // Glidningen: pekaren, trycket och det valda eventet knuffar molnet
                // undan, det bromsar in och STANNAR där det hamnar.
                if (pushers.length > 0 || st.vx !== 0 || st.vy !== 0) {
                    const g = glideStep(st, px, py, pushers, r, scale, dt);
                    st.ox = g.ox;
                    st.oy = g.oy;
                    st.vx = g.vx;
                    st.vy = g.vy;
                    if (g.vx !== 0 || g.vy !== 0) moving = true;
                }
                // Tätt intill en knuffare tunnas molnet ut (tillfälligt).
                let tf = 0;
                for (const q of pushers) tf = Math.max(tf, pushOffset(px, py, q.x, q.y, r).fade);
                st.fade += (tf - st.fade) * ease;
                if (Math.abs(tf - st.fade) > 0.01) moving = true;

                const alpha = c.alpha * zoomOpacity * set.alpha * st.vis * (1 - st.fade);
                if (alpha <= 0.004) continue;

                // Driften: en långsam, egen bana per moln.
                const phase = c.seed * Math.PI * 2;
                const amp = 4 + r * 0.07;
                const dx = Math.sin(t / (17 + c.seed * 14) * Math.PI * 2 + phase) * amp;
                const dy = Math.cos(t / (23 + c.seed * 11) * Math.PI * 2 + phase * 1.7) * amp * 0.45;

                const x = p.x + st.ox * scale + dx;
                const y = p.y + st.oy * scale + dy;
                const spriteIndex = Math.floor(c.seed * sprites.length) % sprites.length;
                const w = r * 2;
                const h = w * (SPRITE_H / SPRITE_W);
                cloudStamps.push({ img: sprites[spriteIndex], x: x - w / 2, y: y - h * SPRITE_ANCHOR_Y, w, h, a: alpha });
                // Markskuggan (#215): följer molnets toning, knuff och drift.
                const shadow = cloudShadow(c.seed, r, { x: x - sunPx.x, y: y - sunPx.y });
                if (shadow) {
                    shadowStamps.push({
                        img: shadowSprites[spriteIndex],
                        x: x - w / 2 + shadow.dx, y: y - h * SPRITE_ANCHOR_Y + shadow.dy, w, h,
                        a: alpha * shadow.opacity,
                    });
                }
                // De tommaste trakterna får fler puffar runt sig - molnet blir en bank.
                const extra = c.extra;
                for (let i = 0; i < extra; i++) {
                    const a = phase + i * 2.4;
                    const ew = w * (0.72 - i * 0.08);
                    const eh = ew * (SPRITE_H / SPRITE_W);
                    const ex = x + Math.cos(a) * r * 0.55 - dx * 0.5;
                    const ey = y + Math.sin(a) * r * 0.3 - dy * 0.5;
                    const other = sprites[(Math.floor(c.seed * sprites.length) + i + 1) % sprites.length];
                    cloudStamps.push({ img: other, x: ex - ew / 2, y: ey - eh * SPRITE_ANCHOR_Y, w: ew, h: eh, a: alpha * 0.8 });
                }
            }
        }
        for (const s of shadowStamps) {
            ctx.globalAlpha = s.a;
            ctx.drawImage(s.img, s.x, s.y, s.w, s.h);
        }
        for (const s of cloudStamps) {
            ctx.globalAlpha = s.a;
            ctx.drawImage(s.img, s.x, s.y, s.w, s.h);
        }
        ctx.globalAlpha = 1;
        animating = moving;
    };

    const visible = () => cloudOpacityForZoom(map.getZoom()) > 0.002;

    const tick = (now: number) => {
        raf = 0;
        if (destroyed) return;
        // Under kartrörelser ritar 'render'-lyssnaren i kartans egen bildruta.
        if (!map.isMoving()) {
            const due = animating || dirty || (!reducedMotion && now - lastDraw >= IDLE_FRAME_MS);
            if (due) draw(now);
        }
        schedule();
    };

    /** Håll slingan igång bara när det finns något att rita. */
    const schedule = () => {
        if (raf || destroyed) return;
        const needsLoop = dirty || animating || (visible() && (!reducedMotion || map.isMoving()));
        if (needsLoop) raf = requestAnimationFrame(tick);
    };

    const onRender = () => {
        if (!map.isMoving()) return;
        if (!visible() && cleared) return;
        const now = performance.now();
        // Nya rutor kommer in i bild när kartan flyttas - bygg om då och då.
        if (now - lastBuildAt >= MOVE_REBUILD_MS) rebuild();
        draw(now);
    };
    const onMoveEnd = () => {
        if (visible()) rebuild();
        dirty = true;
        schedule();
    };
    const onResize = () => {
        resize();
        if (visible()) rebuild();
        schedule();
    };
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
        if (!canHover) return;
        pointer = { x: e.point.x, y: e.point.y };
        if (!pointerArmed) {
            // Medan kartan rör sig (zoom, dragning, efterglid) väcks knuffen aldrig.
            if (map.isMoving() || !pushRearmed(pointerParked, pointer)) return;
            pointerArmed = true;
            pointerParked = null;
        }
        if (visible()) {
            dirty = true;
            schedule();
        }
    };
    const onMouseOut = (e: maplibregl.MapMouseEvent) => {
        // Pekaren gick bara upp på en DOM-bricka i kartan - inte ut ur den.
        const to = (e.originalEvent as MouseEvent | undefined)?.relatedTarget as Node | null | undefined;
        if (to && map.getContainer().contains(to)) return;
        pointer = null;
        // Nästa gång pekaren kommer in över kartan är det en riktig rörelse.
        pointerParked = null;
        dirty = true;
        schedule();
    };
    const onZoomStart = () => {
        pointerArmed = false;
        pointerParked = pointer;
        touchArmed = false;
        dirty = true;
        schedule();
    };
    // En DRAGNING knuffar inte heller (#217, Josef 13/11: "när man drar på
    // kartan så puttar man moln långt framför sig"). Pekaren står då still mot
    // kartan och knuffade oavbrutet molnen omkring sig. Platsen den väcks från
    // sätts när kartan stannat - under dragningen följer pekaren ju med.
    // Trycket på mobil är geo-förankrat och rör sig inte mot molnen.
    const onDragStart = () => {
        pointerArmed = false;
        pointerParked = pointer;
        dirty = true;
        schedule();
    };
    const onDragEnd = () => {
        if (!pointerArmed) pointerParked = pointer;
    };

    map.on('render', onRender);
    map.on('moveend', onMoveEnd);
    map.on('resize', onResize);
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);
    map.on('zoomstart', onZoomStart);
    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);
    resize();
    schedule();

    return {
        setPoints(next) {
            points = next;
            if (level != null) rebuild();
            dirty = true;
            schedule();
        },
        setFocus(next) {
            focus = next;
            dirty = true;
            schedule();
        },
        setTouchPoint(next) {
            touchPoint = next;
            touchArmed = true;
            dirty = true;
            schedule();
        },
        destroy() {
            destroyed = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            try {
                map.off('render', onRender);
                map.off('moveend', onMoveEnd);
                map.off('resize', onResize);
                map.off('mousemove', onMouseMove);
                map.off('mouseout', onMouseOut);
                map.off('zoomstart', onZoomStart);
                map.off('dragstart', onDragStart);
                map.off('dragend', onDragEnd);
            } catch { /* kartan är redan riven */ }
            canvas.remove();
        },
    };
}
