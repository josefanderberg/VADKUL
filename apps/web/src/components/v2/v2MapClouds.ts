/**
 * Molnlagret på kartan (#191): en 2D-canvas mellan GL-kartan och DOM-brickorna
 * som ritar vita moln där eventen finns. Var molnen står och hur de beter sig
 * räknas i utils/eventClouds (testad) - här finns bara ritning och rörelse.
 *
 * Mjukheten kommer av tre saker:
 *  1. Under en kartrörelse ritas molnen i kartans EGEN bildruta ('render'),
 *     så de aldrig släpar efter panoreringen.
 *  2. Ingenting hoppar: knuffen från pekaren och det valda eventet dämpas mot
 *     sitt mål (exponentiell utjämning), och när indelningen byts vid ett
 *     zoomsteg tonar den gamla uppsättningen ut medan den nya tonar in.
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
    cloudLevelFor,
    cloudOpacityForZoom,
    cloudScaleFor,
    pushOffset,
    type Cloud,
    type CloudPoint,
} from '@/utils/eventClouds';

export interface EventClouds {
    /** Eventens platser (dagens/veckans filtrerade urval). */
    setPoints(points: readonly CloudPoint[]): void;
    /** Det valda eventets plats - molnen håller sig undan därifrån. */
    setFocus(point: CloudPoint | null): void;
    destroy(): void;
}

/** Tidskonstant för knuffen: hur sakta molnen glider undan och tillbaka. */
const PUSH_TAU_MS = 420;
/** Hur länge två uppsättningar tonar över i varandra vid ett zoomsteg. */
const SET_FADE_MS = 420;
/** Vilotakten: driften är så långsam att tätare ritning inte syns. */
const IDLE_FRAME_MS = 80;
/** Utanför den här marginalen runt skärmen ritas inga moln. */
const CULL_MARGIN_PX = 220;
const MAX_DPR = 2;

const SPRITE_W = 256;
const SPRITE_H = 168;
/** Molnformerna: överlappande puffar (x, y, r) i spritens koordinater. */
const SPRITE_PUFFS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
    [[70, 100, 46], [118, 78, 58], [170, 94, 50], [206, 112, 34], [40, 116, 30], [126, 114, 48]],
    [[60, 104, 40], [104, 86, 50], [152, 74, 54], [196, 100, 44], [128, 114, 50], [226, 118, 26]],
    [[84, 96, 52], [140, 82, 56], [190, 104, 42], [44, 114, 32], [120, 116, 44], [222, 120, 24]],
];

interface CloudState {
    cloud: Cloud;
    /** Nuvarande knuff i px (dämpas mot målet). */
    ox: number;
    oy: number;
    /** Nuvarande uttunning av knuffen (0-1). */
    fade: number;
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
    const sprites = SPRITE_PUFFS.map(makeSprite);
    const reducedMotion =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let points: readonly CloudPoint[] = [];
    let focus: CloudPoint | null = null;
    let pointer: { x: number; y: number } | null = null;
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

    /** Bygg (om) den aktiva uppsättningen. Samma nivå = byt på plats och
     *  behåll molnens rörelse; ny nivå = tona över. */
    const rebuild = () => {
        const zoom = map.getZoom();
        const nextLevel = cloudLevelFor(zoom, level ?? undefined);
        const current = activeSet();
        if (current && current.level === nextLevel) {
            const old = new Map(current.states.map(s => [s.cloud.id, s]));
            current.states = buildClouds(points, nextLevel).map(cloud => {
                const prev = old.get(cloud.id);
                return prev ? { ...prev, cloud } : { cloud, ox: 0, oy: 0, fade: 0 };
            });
        } else {
            for (const s of sets) s.leaving = true;
            sets.push({
                level: nextLevel,
                states: buildClouds(points, nextLevel).map(cloud => ({ cloud, ox: 0, oy: 0, fade: 0 })),
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
            // Borta ur bild: nollställ övertoningen så nästa utzoomning börjar rent.
            for (const s of sets) s.alpha = s.leaving ? 0 : 1;
            sets = sets.filter(s => !s.leaving);
            animating = false;
            return;
        }
        cleared = false;
        ctx.clearRect(0, 0, cssW, cssH);

        const focusPx = focus ? map.project([focus.lng, focus.lat]) : null;
        const ease = 1 - Math.exp(-dt / PUSH_TAU_MS);
        const t = reducedMotion ? 0 : now / 1000;

        for (const set of sets) {
            const scale = cloudScaleFor(zoom, set.level);
            for (const st of set.states) {
                const c = st.cloud;
                const p = map.project([c.lng, c.lat]);
                const r = c.radius * scale;
                if (p.x < -CULL_MARGIN_PX - r || p.x > cssW + CULL_MARGIN_PX + r
                    || p.y < -CULL_MARGIN_PX - r || p.y > cssH + CULL_MARGIN_PX + r) {
                    st.ox = 0;
                    st.oy = 0;
                    st.fade = 0;
                    continue;
                }
                // Målet: summan av knuffarna från pekaren och det valda eventet.
                let tx = 0;
                let ty = 0;
                let tf = 0;
                if (pointer) {
                    const o = pushOffset(p.x, p.y, pointer.x, pointer.y, r);
                    tx += o.x;
                    ty += o.y;
                    tf = Math.max(tf, o.fade);
                }
                if (focusPx) {
                    const o = pushOffset(p.x, p.y, focusPx.x, focusPx.y, r);
                    tx += o.x;
                    ty += o.y;
                    tf = Math.max(tf, o.fade);
                }
                st.ox += (tx - st.ox) * ease;
                st.oy += (ty - st.oy) * ease;
                st.fade += (tf - st.fade) * ease;
                if (Math.abs(tx - st.ox) > 0.3 || Math.abs(ty - st.oy) > 0.3 || Math.abs(tf - st.fade) > 0.01) {
                    moving = true;
                }

                const alpha = c.alpha * zoomOpacity * set.alpha * (1 - st.fade);
                if (alpha <= 0.004) continue;

                // Driften: en långsam, egen bana per moln.
                const phase = c.seed * Math.PI * 2;
                const amp = 4 + r * 0.07;
                const dx = Math.sin(t / (17 + c.seed * 14) * Math.PI * 2 + phase) * amp;
                const dy = Math.cos(t / (23 + c.seed * 11) * Math.PI * 2 + phase * 1.7) * amp * 0.45;

                const x = p.x + st.ox + dx;
                const y = p.y + st.oy + dy;
                const sprite = sprites[Math.floor(c.seed * sprites.length) % sprites.length];
                const w = r * 2;
                const h = w * (SPRITE_H / SPRITE_W);
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, x - w / 2, y - h * 0.58, w, h);
                // Täta platser får fler puffar runt sig - molnet blir en bank.
                const extra = Math.min(2, Math.floor(Math.log2(c.count) / 3));
                for (let i = 0; i < extra; i++) {
                    const a = phase + i * 2.4;
                    const ew = w * (0.72 - i * 0.08);
                    const eh = ew * (SPRITE_H / SPRITE_W);
                    const ex = x + Math.cos(a) * r * 0.55 - dx * 0.5;
                    const ey = y + Math.sin(a) * r * 0.3 - dy * 0.5;
                    const other = sprites[(Math.floor(c.seed * sprites.length) + i + 1) % sprites.length];
                    ctx.globalAlpha = alpha * 0.8;
                    ctx.drawImage(other, ex - ew / 2, ey - eh * 0.58, ew, eh);
                }
            }
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
        draw(performance.now());
    };
    const onMoveEnd = () => {
        dirty = true;
        schedule();
    };
    const onResize = () => {
        resize();
        schedule();
    };
    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
        pointer = { x: e.point.x, y: e.point.y };
        if (visible()) {
            dirty = true;
            schedule();
        }
    };
    const onMouseOut = () => {
        pointer = null;
        dirty = true;
        schedule();
    };

    map.on('render', onRender);
    map.on('moveend', onMoveEnd);
    map.on('resize', onResize);
    map.on('mousemove', onMouseMove);
    map.on('mouseout', onMouseOut);
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
            } catch { /* kartan är redan riven */ }
            canvas.remove();
        },
    };
}
