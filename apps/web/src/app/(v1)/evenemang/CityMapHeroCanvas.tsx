'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import {
    THEMEPARK_LAND_COLOR_NEAR,
} from '@/components/v2/v2MapBaseStyles';
import { NO_TIME_PAST_HOUR, sourceGradientCss, BRICKA_DARK_BG } from '@/components/v2/v2MapBricka';
import { PERIODS, periodKeys } from './periods';
import { useDayFilter } from './dayFilter';

// Den RIKTIGA VADKUL-kartan i stads-heron — numera INTERAKTIV (Josef 18/8:
// "kan vi inte bara ha den som den riktiga kartan"). Man kan zooma/panorera,
// dagchipsen uppe till vänster delar filter med daglistan under (dayFilter),
// och klick på en bricka öppnar en popup vars rader scrollar till eventet i
// listan PÅ SAMMA SIDA (requestFocus) — man skickas inte längre iväg till
// stora kartan för att titta på ett event man redan ser framför sig.
//
// Lagren (i hero-containern i CityMapHero):
//   1. Serverrenderade Carto-rasterkakel — reservväg om GL fallerar.
//   2. Landfärgs-plattan täcker kaklen redan i server-HTML:en (inget
//      Voyager-blink) och släpps fram bara om GL inte går att starta.
//   3. Riktiga MapLibre-kartan i "nöjesfälts"-stilen tonas in när den laddat.
//   4. De statiska SSR-brickorna (children) ligger ovanpå tills GL är klar —
//      då tonas de bort och ersätts av levande DOM-markörer som följer kartan.
//
// GESTER: cooperativeGestures — en-finger-drag ska SCROLLA SIDAN, inte kapa
// den till kartpanorering (två fingrar/Ctrl+scroll styr kartan; hjälptexten
// är försvenskad via locale). CSS:en för det (och för markörerna) ligger
// scopat under .city-hero-map i globals.css — maplibre-gl.css importeras
// fortfarande INTE (render-blockerande på en sida som ska vara lätt).
//
// MARKÖRER: alla stadens kommande event (filtrerade på valt dagfilter, med
// kartans delade "har varit"-gräns NO_TIME_PAST_HOUR) grupperade per koordinat
// — samma gruppnyckel-idé som stora kartan. DOM-markörer saknar GL:ens
// kollisionshantering, så en greedy min-avstånds-gallring i SKÄRMPIXLAR vid
// aktuell zoom körs om vid varje zoomend: utzoomad syns de tidigaste eventen
// glest, inzoomad tätnar det. Tidigast-först = prioritetsordningen.

const HOUR_MS = 3_600_000;
/** Min-avstånd i skärm-px mellan markörer + tak på antal (DOM-markörer är
 *  inte gratis — 140 räcker gott i en hero-yta). */
const MIN_DIST_PX = 40;
const MAX_LIVE = 140;

/** Ett event som kartan kan visa levande — byggt på servern i CityMapHero.
 *  `hex` i stället för färdig gradient-CSS: gradienten byggs här (sparar
 *  ~30 kB HTML på stora städer). `day` = 'YYYY-MM-DD' (svensk tid),
 *  `listed` = finns bland daglistans 14 listade dagar (annars länkar popupen
 *  till stora kartan via `href`). */
export type HeroLiveEvent = {
    id: string;
    href: string;
    lat: number;
    lng: number;
    emoji: string;
    hex: string | null;
    title: string;
    place: string;
    clock: string | null;
    t: number;
    hour: number | null;
    day: string;
    listed: boolean;
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

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const popupDayFmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Stockholm', weekday: 'short', day: 'numeric', month: 'numeric',
});

type MapLibreMap = import('maplibre-gl').Map;
type MapLibreMarker = import('maplibre-gl').Marker;

export default function CityMapHeroCanvas({ lat, lng, zoom, markers, children }: {
    lat: number;
    lng: number;
    /** MapLibre-zoom, INTE kakel-zoom — se HERO_GL_ZOOM i CityMapHero. */
    zoom: number;
    /** Stadens kommande event, tidssorterade (byggda i CityMapHero). */
    markers: HeroLiveEvent[];
    /** De statiska SSR-brickorna — tonas bort när de levande tagit över. */
    children?: ReactNode;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    // GL gick inte att starta (ingen WebGL / stilen onåbar) → släpp fram
    // Voyager-kaklen under. Tills dess täcker landfärgs-plattan dem, så heron
    // ser ut som kartan redan från server-HTML:en.
    const [failed, setFailed] = useState(false);
    // Öppen platspopup: eventen på den klickade koordinaten. `key` är
    // filternyckeln popupen öppnades under — byter filtret (chips här eller i
    // listans filterrad) matchar nyckeln inte längre och popupen försvinner i
    // renderingen, utan någon setState-i-effekt.
    const [popup, setPopup] = useState<{ events: HeroLiveEvent[]; key: string } | null>(null);

    const { sel, setSel, hours, requestFocus } = useDayFilter();
    const filterKey = JSON.stringify([sel, hours]);

    const mapRef = useRef<MapLibreMap | null>(null);
    const markerCtorRef = useRef<(new (o: object) => MapLibreMarker) | null>(null);
    const liveMarkersRef = useRef<MapLibreMarker[]>([]);

    /** Riv och bygg om markörerna för aktuellt filter + aktuell zoom.
     *  Läser sel/hours/markers ur SIN renders closure — zoomend-lyssnaren
     *  (utanför React) når alltid färsk version via rebuildRef nedan. */
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
            el.addEventListener('click', ev => {
                ev.stopPropagation();
                setPopup({ events: group, key: filterKey });
            });
            const mk = new Marker({ element: el }).setLngLat([rep.lng, rep.lat]).addTo(map);
            liveMarkersRef.current.push(mk);
            i++;
        }
    };
    // Synkas EFTER varje render (ref-skrivning under render är förbjudet) —
    // zoomend-lyssnaren i init-effekten pekar alltid på färskaste closuren.
    const rebuildRef = useRef<() => void>(() => {});
    useEffect(() => { rebuildRef.current = rebuild; });

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
                    minZoom: zoom - 2,
                    maxZoom: 17,
                    dragRotate: false,
                    pitchWithRotate: false,
                    touchPitch: false,
                    // En-finger-drag ska scrolla SIDAN — kartan styrs med två
                    // fingrar (mobil) resp. Ctrl/⌘+scroll (desktop).
                    cooperativeGestures: true,
                    locale: {
                        'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + scrolla för att zooma kartan',
                        'CooperativeGesturesHandler.MacHelpText': '⌘ + scrolla för att zooma kartan',
                        'CooperativeGesturesHandler.MobileHelpText': 'Dra med två fingrar för att flytta kartan',
                    },
                    // Heron har redan sin egen © OpenStreetMap © CARTO-rad.
                    attributionControl: false,
                });
                m.touchZoomRotate.disableRotation();
                mapRef.current = m;
                markerCtorRef.current = Marker as unknown as new (o: object) => MapLibreMarker;
                m.on('load', () => { if (!cancelled) setReady(true); });
                // Tätheten är zoomberoende — gallra om efter varje zoom.
                m.on('zoomend', () => { if (!cancelled) rebuildRef.current(); });
                // Klick på kartbotten (inte på en markör) stänger popupen.
                m.on('click', () => { if (!cancelled) setPopup(null); });
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
    }, [lat, lng, zoom]);

    // Filterbyte (eller GL-klart) → bygg om markörerna. Ren extern synk —
    // en popup för ett inaktuellt urval döljs av filternyckeln i renderingen.
    useEffect(() => {
        if (!ready) return;
        rebuild();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, sel, hours, markers]);

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
            {/* Statiska SSR-brickorna: syns tills de levande markörerna tagit
                över, sedan tonas de bort. */}
            <div
                aria-hidden
                className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                    ready ? 'opacity-0' : 'opacity-100'
                }`}
            >
                {children}
            </div>

            {/* Dagchips — SAMMA filter som listan under (dayFilter). Ett
                dagval i listans filterrad speglas alltså här och tvärtom. */}
            <div className="absolute top-2 left-2 z-30 flex gap-1">
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

            {/* Platspopup: eventen på den klickade brickans koordinat. Rader
                för listade event scrollar till raden i daglistan (fokus-
                flödet); event bortom listhorisonten öppnar stora kartan. */}
            {popup && popup.key === filterKey && (
                <div className="absolute inset-x-2 bottom-2 z-40 rounded-xl bg-white/95 backdrop-blur shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between gap-2 pl-3 pr-1.5 pt-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                            {popup.events[0].place || `${popup.events.length} event`}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPopup(null)}
                            aria-label="Stäng"
                            className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <ul className="max-h-[170px] sm:max-h-[200px] overflow-y-auto px-1.5 pb-1.5">
                        {popup.events.map(e => {
                            const meta = `${capFirst(popupDayFmt.format(new Date(e.t)))}${e.clock ? ` · kl ${e.clock}` : ''}`;
                            const inner = (
                                <>
                                    <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-base leading-none" aria-hidden>
                                        {e.emoji || '📍'}
                                    </span>
                                    <span className="min-w-0 flex-1 text-left">
                                        <span className="block text-xs font-bold text-slate-900 truncate">{e.title}</span>
                                        <span className="block text-[10px] font-bold text-slate-500 truncate">{meta}</span>
                                    </span>
                                    <span aria-hidden className="shrink-0 text-slate-300 font-black">›</span>
                                </>
                            );
                            const cls = 'w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors';
                            return (
                                <li key={e.id}>
                                    {e.listed ? (
                                        <button
                                            type="button"
                                            className={cls}
                                            onClick={() => { requestFocus(e.id, e.day); setPopup(null); }}
                                        >
                                            {inner}
                                        </button>
                                    ) : (
                                        <a href={e.href} className={cls}>{inner}</a>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </>
    );
}
