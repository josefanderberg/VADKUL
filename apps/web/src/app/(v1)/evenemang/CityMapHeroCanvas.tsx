'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    THEMEPARK_LAND_COLOR_NEAR,
} from '@/components/v2/v2MapBaseStyles';
import { NO_TIME_PAST_HOUR, sourceGradientCss, BRICKA_DARK_BG } from '@/components/v2/v2MapBricka';
import { PERIODS, periodKeys } from './periods';
import { useDayFilter } from './dayFilter';

// Den RIKTIGA VADKUL-kartan i stads-heron — PASSIV men klickbar (Josef 24/8).
// 18/8-varianten var fullt interaktiv (zoom/panorering, cooperativeGestures),
// men gav två problem: de statiska byggtids-brickorna syntes på gröna plattan
// innan kartan laddat och "stämde inte överens" med de levande markörerna som
// tog över, och panorering i en liten hero-yta tillförde inget. Nu gäller:
// KARTAN FÖRST, EVENTEN SEN — inga brickor förrän GL-kartan är uppe — och
// inga kartgester alls. ALLA klick leder till STORA kartan (Josef 30/8 —
// sidorna ska mata kartan, inte hålla kvar besökaren i en miniatyr):
// kartbotten öppnar den centrerad på staden (bigMapHref) och brick-klick
// öppnar den med eventet uppslaget (?event= via href). Platspopupen som
// tidigare öppnades i heron är BORTTAGEN — lägg inte tillbaka den.
// Dagchipsen delar fortfarande filter med daglistan (dayFilter).
//
// Lagren (i hero-containern i CityMapHero):
//   1. Serverrenderade Carto-rasterkakel — reservväg om GL fallerar.
//   2. Landfärgs-plattan täcker kaklen redan i server-HTML:en (inget
//      Voyager-blink) och släpps fram bara om GL inte går att starta.
//   3. Riktiga MapLibre-kartan i "nöjesfälts"-stilen tonas in när den laddat.
//   4. De statiska SSR-brickorna (children) visas BARA i GL-fallerade
//      reservläget (ovanpå rasterkaklen) — aldrig före den riktiga kartan.
//
// CSS:en för markörerna ligger scopad under .city-hero-map i globals.css —
// maplibre-gl.css importeras fortfarande INTE (render-blockerande på en sida
// som ska vara lätt).
//
// MARKÖRER: alla stadens kommande event (filtrerade på valt dagfilter, med
// kartans delade "har varit"-gräns NO_TIME_PAST_HOUR) grupperade per koordinat
// — samma gruppnyckel-idé som stora kartan. DOM-markörer saknar GL:ens
// kollisionshantering, så en greedy min-avstånds-gallring i SKÄRMPIXLAR görs
// vid den fasta hero-zoomen. Tidigast-först = prioritetsordningen.

const HOUR_MS = 3_600_000;
/** Min-avstånd i skärm-px mellan markörer + tak på antal (DOM-markörer är
 *  inte gratis — 140 räcker gott i en hero-yta). */
const MIN_DIST_PX = 40;
const MAX_LIVE = 140;

/** Ett event som kartan kan visa levande — byggt på servern i CityMapHero.
 *  `hex` i stället för färdig gradient-CSS: gradienten byggs här (sparar
 *  ~30 kB HTML på stora städer). `day` = 'YYYY-MM-DD' (svensk tid). `href`
 *  = stora kartan med eventet uppslaget (?event=) — dit går brick-klicket. */
export type HeroLiveEvent = {
    id: string;
    href: string;
    lat: number;
    lng: number;
    emoji: string;
    hex: string | null;
    t: number;
    hour: number | null;
    day: string;
    /** Kategorinyckeln — heron följer kategorichipsen precis som listan. */
    category: string;
};

/** Samma "har varit"-trappa som daglistan och stora kartan: klockslag = 1 h
 *  efter start; utan klockslag = kl NO_TIME_PAST_HOUR sin dag (lokal klocka,
 *  precis som DayFilteredList.isPast). */
function isPastEv(e: HeroLiveEvent, now: number): boolean {
    if (e.hour !== null) return e.t < now - HOUR_MS;
    return new Date(e.t).setHours(NO_TIME_PAST_HOUR, 0, 0, 0) <= now;
}

/** Webbmercator i MapLibre-skala (världen är 512·2^zoom px bred). */
function worldPx(lat: number, lng: number, zoom: number) {
    const scale = 512 * 2 ** zoom;
    const x = ((lng + 180) / 360) * scale;
    const s = Math.sin((lat * Math.PI) / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
    return { x, y };
}

/** Markör-DOM: exakt samma nål-droppe som de statiska SSR-brickorna (och
 *  GL-brickorna på stora kartan) — 0×0-rot med droppen transform-ankrad så
 *  spetsen pekar på koordinaten. Grupp med >1 event får en antal-bubbla. */
function buildBrickaEl(e: HeroLiveEvent, count: number, delayMs: number): HTMLDivElement {
    const bg = e.hex ? sourceGradientCss(e.hex) : BRICKA_DARK_BG;
    const root = document.createElement('div');
    root.style.cssText = 'width:0;height:0;cursor:pointer';
    root.innerHTML =
        `<span class="hero-bricka" style="display:block;width:32px;height:32px;border-radius:9999px;border-bottom-right-radius:0;` +
        `border:1.5px solid rgba(255,255,255,.3);box-shadow:0 4px 6px -1px rgb(0 0 0/.15),0 2px 4px -2px rgb(0 0 0/.15);` +
        `background:${bg};transform:translate(-50%,-92%) rotate(45deg);animation-delay:${delayMs}ms">` +
        `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;transform:rotate(-45deg);font-size:19px;line-height:1"></span>` +
        `</span>` +
        (count > 1
            ? `<span style="position:absolute;left:8px;top:-40px;min-width:16px;height:16px;padding:0 4px;border-radius:9999px;` +
              `background:#fff;color:#0f172a;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;` +
              `box-shadow:0 1px 3px rgb(0 0 0/.35)">${count}</span>`
            : '');
    // Emojin sätts som text (inte HTML) — titlarna rör aldrig innerHTML.
    (root.querySelector('.hero-bricka > span') as HTMLElement).textContent = e.emoji || '📍';
    return root;
}

type MapLibreMap = import('maplibre-gl').Map;
type MapLibreMarker = import('maplibre-gl').Marker;

export default function CityMapHeroCanvas({ lat, lng, zoom, markers, bigMapHref, children }: {
    lat: number;
    lng: number;
    /** MapLibre-zoom, INTE kakel-zoom — se HERO_GL_ZOOM i CityMapHero. */
    zoom: number;
    /** Stadens kommande event, tidssorterade (byggda i CityMapHero). */
    markers: HeroLiveEvent[];
    /** Stora kartan centrerad på staden (cityMapHref) — dit går klick på
     *  kartbotten. */
    bigMapHref: string;
    /** De statiska SSR-brickorna — visas bara i GL-fallerade reservläget. */
    children?: ReactNode;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    // GL gick inte att starta (ingen WebGL / stilen onåbar) → släpp fram
    // Voyager-kaklen under. Tills dess täcker landfärgs-plattan dem, så heron
    // ser ut som kartan redan från server-HTML:en.
    const [failed, setFailed] = useState(false);
    const { sel, setSel, hours, category } = useDayFilter();

    const mapRef = useRef<MapLibreMap | null>(null);
    const markerCtorRef = useRef<(new (o: object) => MapLibreMarker) | null>(null);
    const liveMarkersRef = useRef<MapLibreMarker[]>([]);

    /** Riv och bygg om markörerna för aktuellt filter (zoomen är fast —
     *  kartan är passiv). Läser sel/hours/markers ur sin renders closure. */
    const rebuild = () => {
        const map = mapRef.current;
        const Marker = markerCtorRef.current;
        if (!map || !Marker) return;
        for (const m of liveMarkersRef.current) m.remove();
        liveMarkersRef.current = [];

        const now = Date.now();
        const keys = sel.kind === 'period' ? periodKeys(sel.period) : [sel.key];
        const visible = markers.filter(e => {
            if (isPastEv(e, now)) return false;
            if (keys && !keys.includes(e.day)) return false;
            // Kategorichipsen (Josef 2/9): heron och listan är ETT filter.
            if (category !== null && e.category !== category) return false;
            if (hours.length && (e.hour === null || !hours.includes(e.hour))) return false;
            return true;
        });

        // Gruppera per koordinat (markers kommer tidssorterade → gruppens
        // första event är det tidigaste och blir markörens ansikte).
        const byCoord = new Map<string, HeroLiveEvent[]>();
        for (const e of visible) {
            const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
            const g = byCoord.get(k);
            if (g) g.push(e); else byCoord.set(k, [e]);
        }

        // Greedy gallring i skärm-px vid AKTUELL zoom — tidigast-först.
        const z = map.getZoom();
        const placed: { x: number; y: number }[] = [];
        let i = 0;
        for (const group of byCoord.values()) {
            if (liveMarkersRef.current.length >= MAX_LIVE) break;
            const rep = group[0];
            const p = worldPx(rep.lat, rep.lng, z);
            if (placed.some(q => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < MIN_DIST_PX ** 2)) continue;
            placed.push(p);
            const el = buildBrickaEl(rep, group.length, Math.min(i * 45, 500));
            // Rakt till stora kartan med gruppens tidigaste event uppslaget —
            // ligger fler event på koordinaten har stora kartan sin egen
            // "3/7"-pager på kortet.
            el.addEventListener('click', ev => {
                ev.stopPropagation();
                window.location.assign(rep.href);
            });
            const mk = new Marker({ element: el }).setLngLat([rep.lng, rep.lat]).addTo(map);
            liveMarkersRef.current.push(mk);
            i++;
        }
    };
    useEffect(() => {
        const el = holderRef.current;
        if (!el) return;
        let cancelled = false;

        const start = async () => {
            try {
                const [{ Map, Marker }, { fetchAndTransformThemeParkStyle }] = await Promise.all([
                    import('maplibre-gl'),
                    import('@/components/v2/v2MapBaseStyles'),
                ]);
                const style = await fetchAndTransformThemeParkStyle();
                if (cancelled) return;
                const m = new Map({
                    container: el,
                    style,
                    center: [lng, lat],
                    zoom,
                    // Heron har redan sin egen © OpenStreetMap © CARTO-rad.
                    attributionControl: false,
                });
                // PASSIV karta: inga gester alls — en-finger-drag scrollar
                // sidan, scroll zoomar inte. (interactive:false duger inte:
                // då slutar även 'click'-eventen komma.) Handlers stängs av
                // en och en i stället.
                for (const h of [m.dragPan, m.dragRotate, m.scrollZoom, m.doubleClickZoom, m.touchZoomRotate, m.touchPitch, m.keyboard, m.boxZoom]) h.disable();
                mapRef.current = m;
                markerCtorRef.current = Marker as unknown as new (o: object) => MapLibreMarker;
                m.on('load', () => { if (!cancelled) setReady(true); });
                // Klick på kartbotten (inte på en markör) öppnar STORA kartan
                // över staden — "missar man en bricka ska man se eventen på
                // riktiga kartan" (Josef 24/8).
                m.on('click', () => {
                    if (cancelled) return;
                    window.location.assign(bigMapHref);
                });
            } catch {
                // Ingen WebGL eller ingen stil — göm plattan så de statiska
                // kaklen under blir synliga igen.
                if (!cancelled) setFailed(true);
            }
        };

        // Starta först när heron faktiskt syns, och då med en kort fördröjning
        // så hydreringen av eventlistan inte samsas med maplibre-chunken.
        // (requestIdleCallback dög inte: i en dold/bakgrundsflik körs den
        // aldrig, och då stod heron kvar på de grå kaklen.)
        let timer = 0;
        const arm = () => { if (!timer) timer = window.setTimeout(start, 250); };
        const io = typeof IntersectionObserver === 'undefined' ? null
            : new IntersectionObserver(entries => {
                if (entries.some(en => en.isIntersecting)) { io?.disconnect(); arm(); }
            }, { rootMargin: '200px' });
        if (io) io.observe(el); else arm();

        return () => {
            cancelled = true;
            io?.disconnect();
            clearTimeout(timer);
            for (const mk of liveMarkersRef.current) mk.remove();
            liveMarkersRef.current = [];
            mapRef.current?.remove();
            mapRef.current = null;
        };
    }, [lat, lng, zoom, bigMapHref]);

    // Filterbyte (eller GL-klart) → bygg om markörerna. Ren extern synk.
    useEffect(() => {
        if (!ready) return;
        rebuild();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, sel, hours, category, markers]);

    return (
        <>
            {/* Landfärgs-plattan: ligger ÖVER rastret från första server-
                renderade rutan (inget Voyager-blink), och tas bara bort om GL
                fallerar. GL-canvasen tonas in ovanpå. */}
            <div
                aria-hidden
                className={`absolute inset-0 pointer-events-none transition-opacity duration-300 ${
                    failed ? 'opacity-0' : 'opacity-100'
                }`}
                style={{ backgroundColor: THEMEPARK_LAND_COLOR_NEAR }}
            />
            {/* Själva kartan — interaktiv (pointer-events-auto när GL är uppe).
                .city-hero-map scopar maplibre-CSS:en i globals.css. */}
            <div
                ref={holderRef}
                className={`city-hero-map absolute inset-0 overflow-hidden transition-opacity duration-500 [&_canvas]:absolute [&_canvas]:left-0 [&_canvas]:top-0 ${
                    ready ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`}
            />
            {/* Statiska SSR-brickorna: BARA i reservläget (GL fallerade →
                rasterkakel + byggtids-brickor). Annars gäller kartan-först-
                eventen-sen: inga brickor förrän de levande markörerna poppar
                på den riktiga kartan. */}
            <div
                aria-hidden
                className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                    failed ? 'opacity-100' : 'opacity-0'
                }`}
            >
                {children}
            </div>

            {/* Dagchips — SAMMA filter som listan under (dayFilter). Ett
                dagval i listans filterrad speglas alltså här och tvärtom. */}
            {/* z-20: under toppnaven (z-40) — chipsen får inte rita över den
                när heron scrollas upp bakom naven. */}
            <div className="absolute top-2 left-2 z-20 flex gap-1">
                {PERIODS.map(p => {
                    const active = sel.kind === 'period' && sel.period === p.key;
                    return (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => setSel({ kind: 'period', period: p.key })}
                            aria-pressed={active}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black shadow-sm border transition-colors ${
                                active
                                    ? 'bg-[#006AA7] border-[#006AA7] text-white'
                                    : 'bg-white/85 backdrop-blur border-white/60 text-slate-700 hover:bg-white'
                            }`}
                        >
                            {p.label}
                        </button>
                    );
                })}
            </div>
        </>
    );
}
