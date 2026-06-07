'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { LinkEvent } from '../../types';
import LinkEventCard from '../ui/LinkEventCard';
import { ArrowRight, ArrowLeft, Calendar, ChevronRight, ChevronDown, RotateCcw, MapPin, Sun, LocateFixed, Clock, Ticket, Users } from 'lucide-react';

// Default event-längd när vi inte har en explicit sluttid — används för Pågår/Har varit.
const DEFAULT_EVENT_MS = 60 * 60 * 1000;
// Hur långt fram i tiden "Snart" gäller.
const SOON_WINDOW_MS = 60 * 60 * 1000;
const NEARBY_PAGE_SIZE = 20;
// Börjar eventet inom 1 timme (Pågår/Snart) hinner man inte längre än så här —
// då döljer vi event som ligger längre bort (7 mil = 70 km).
const MAX_IMMINENT_DISTANCE_KM = 70;

type EventStatus = 'past' | 'ongoing' | 'soon' | 'within3' | 'within5' | 'later';

const getEventStatus = (time: Date, now: number): EventStatus => {
    const start = time.getTime();
    const end = start + DEFAULT_EVENT_MS;
    if (now >= end) return 'past';
    if (now >= start) return 'ongoing';
    const untilStart = start - now;
    if (untilStart <= SOON_WINDOW_MS) return 'soon';        // < 1h
    if (untilStart <= 3 * SOON_WINDOW_MS) return 'within3'; // 1–3h
    if (untilStart <= 5 * SOON_WINDOW_MS) return 'within5'; // 3–5h
    return 'later';                                         // > 5h
};

const formatDistanceKm = (km: number): string => {
    if (km < 1) {
        const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
        return `${m} m`;
    }
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
};

// "Inom 3h" / "Inom 5h" om eventet ligger nära i tid — annars klocktid eller
// veckodag+tid om det är en annan dag. Returnerar tom sträng för Pågår/Snart;
// då säger statusbadgen redan vad som behöver sägas.
const formatTimeHint = (time: Date, now: number): string => {
    // Visa ALLTID klockslaget — även för "Snart"/pågående event. Tidigare gav
    // <1h en tom sträng, så just de eventen saknade tid (det användaren såg).
    const sameDay = new Date(time).toDateString() === new Date(now).toDateString();
    const hhmm = time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `kl ${hhmm}`;
    const weekday = time.toLocaleDateString('sv-SE', { weekday: 'short' });
    return `${weekday} ${hhmm}`;
};

// Samma logik som i LinkEventCard: ren siffra → "X kr", "0"/"gratis" → "Gratis",
// allt annat visas som det är. null = inget pris angivet.
const formatPriceLabel = (p: number | string | undefined): string | null => {
    if (p === undefined || p === null || p === '') return null;
    const s = String(p).trim();
    if (!s) return null;
    if (s === '0' || /^gratis$/i.test(s)) return 'Gratis';
    if (/^\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?$/.test(s)) return `${s} kr`;
    return s;
};

// Haversine-avstånd i km mellan två punkter
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

const hasValidCoords = (evt: LinkEvent) =>
    typeof evt.lat === 'number' && typeof evt.lng === 'number' &&
    !(evt.lat === 0 && evt.lng === 0);

/**
 * Hittar närmaste event utifrån "fromEvent" som inte är bortkastat,
 * sig självt, eller redan besökt.
 * Returnerar null om inga giltiga kandidater finns.
 * Fallar tillbaka till nästa i array-ordningen om fromEvent saknar koordinater.
 */
const findNearestEvent = (
    fromEvent: LinkEvent,
    events: LinkEvent[],
    discardedEventIds: Set<string>,
    visitedEventIds: Set<string>,
): LinkEvent | null => {
    const candidates = events.filter(
        e => e.id !== fromEvent.id
            && !discardedEventIds.has(e.id)
            && !visitedEventIds.has(e.id),
    );
    if (candidates.length === 0) return null;

    if (!hasValidCoords(fromEvent)) {
        // Fallback: nästa giltiga i ursprunglig ordning
        const idx = events.findIndex(e => e.id === fromEvent.id);
        for (let i = 1; i <= events.length; i++) {
            const cand = events[(idx + i) % events.length];
            if (
                cand.id !== fromEvent.id
                && !discardedEventIds.has(cand.id)
                && !visitedEventIds.has(cand.id)
            ) {
                return cand;
            }
        }
        return null;
    }

    let nearest: LinkEvent | null = null;
    let nearestDist = Infinity;
    let nearestNoCoords: LinkEvent | null = null;
    for (const cand of candidates) {
        if (!hasValidCoords(cand)) {
            if (!nearestNoCoords) nearestNoCoords = cand;
            continue;
        }
        const d = haversineKm(fromEvent.lat, fromEvent.lng, cand.lat, cand.lng);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = cand;
        }
    }
    // Föredra event med koordinater. Annars fall tillbaka till första utan koords.
    return nearest ?? nearestNoCoords;
};

const getDayLabel = (offset: number) => {
    if (offset === 0) return 'Idag';
    if (offset === 1) return 'Imorgon';
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString('sv-SE', { weekday: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
};

interface NearbyEventsListProps {
    /** Kommande (ej passerade) event, redan sliced till synligt antal. */
    upcomingItems: { evt: LinkEvent; distanceKm: number | null }[];
    upcomingTotal: number;
    /** Alla event som redan varit — visas under en hopfällbar flik. */
    pastItems: { evt: LinkEvent; distanceKm: number | null }[];
    now: number;
    onSelect: (evt: LinkEvent) => void;
    onLoadMore: () => void;
}

function StatusBadge({ status }: { status: EventStatus }) {
    if (status === 'later') return null;
    const cfg = {
        ongoing: { label: 'Pågår', cls: 'bg-emerald-500 text-white' },
        soon: { label: 'Snart', cls: 'bg-amber-500 text-white' },
        within3: { label: 'Inom 3h', cls: 'bg-amber-300 text-amber-900' },
        within5: { label: 'Inom 5h', cls: 'bg-sky-300 text-sky-900' },
        past: { label: 'Har varit', cls: 'bg-slate-300 text-slate-700' },
    }[status];
    return (
        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

function NearbyRow({ evt, distanceKm, now, onSelect }: {
    evt: LinkEvent;
    distanceKm: number | null;
    now: number;
    onSelect: (evt: LinkEvent) => void;
}) {
    const status = getEventStatus(evt.time, now);
    const timeHint = formatTimeHint(evt.time, now);
    const priceLabel = formatPriceLabel(evt.price);
    const attendees = evt.attendees ?? 0;
    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(evt)}
                className="w-full text-left px-4 md:px-6 py-3 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-sm text-black dark:text-white truncate">
                            {evt.title}
                        </h4>
                        <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 shrink-0">
                            <MapPin size={11} className="text-primary" />
                            {distanceKm !== null ? formatDistanceKm(distanceKm) : 'Okänt avstånd'}
                        </span>
                        <span className="truncate">{evt.locationName}</span>
                    </div>
                    {(timeHint || priceLabel || attendees > 0) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            {timeHint && (
                                <span className="inline-flex items-center gap-1 shrink-0">
                                    <Clock size={11} className="text-primary" />
                                    {timeHint}
                                </span>
                            )}
                            {priceLabel && (
                                <span className="inline-flex items-center gap-1 shrink-0">
                                    <Ticket size={11} className="text-primary" />
                                    {priceLabel}
                                </span>
                            )}
                            {attendees > 0 && (
                                <span className="inline-flex items-center gap-1 shrink-0">
                                    <Users size={11} className="text-primary" />
                                    {attendees} kommer
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </button>
        </li>
    );
}

function NearbyEventsList({ upcomingItems, upcomingTotal, pastItems, now, onSelect, onLoadMore }: NearbyEventsListProps) {
    const [showPast, setShowPast] = useState(false);
    return (
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 border-t border-border">
            <div className="px-4 md:px-6 py-3 sticky top-0 bg-slate-50/95 dark:bg-slate-900/80 backdrop-blur-sm border-b border-border z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Fler event i närheten · {upcomingTotal}
                </span>
            </div>

            <ul className="divide-y divide-border">
                {upcomingItems.map(({ evt, distanceKm }) => (
                    <NearbyRow key={evt.id} evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} />
                ))}
            </ul>

            {upcomingItems.length < upcomingTotal && (
                <div className="px-4 md:px-6 py-3 flex justify-center border-t border-border">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="text-[11px] font-black uppercase tracking-widest text-[#006AA7] hover:text-[#005590] px-4 py-2"
                    >
                        Visa fler
                    </button>
                </div>
            )}

            {/* Hopfällbar flik — event som redan varit, dolda som standard */}
            {pastItems.length > 0 && (
                <div className="border-t border-border">
                    <button
                        type="button"
                        onClick={() => setShowPast(s => !s)}
                        className="w-full px-4 md:px-6 py-3 flex items-center justify-between text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                        aria-expanded={showPast}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Har varit · {pastItems.length}
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {showPast && (
                        <ul className="divide-y divide-border opacity-70">
                            {pastItems.map(({ evt, distanceKm }) => (
                                <NearbyRow key={evt.id} evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

interface EventCardProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    onSaveEvent: (eventId: string) => void;
    onDiscardEvent: (eventId: string) => void;
    discardedEventIds: Set<string>;
    onCardExpandedChange?: (expanded: boolean) => void;
    dayOffset: number;
    setDayOffset: (offset: number) => void;
    onSunClick?: () => void;
    /** Sant när huvudmolnet/solmolnet ligger utanför skärmen — då visas en
     *  återkallnings-knapp jämte solknappen. */
    mainCloudOffScreen?: boolean;
    sunCloudOffScreen?: boolean;
    onRecallMainCloud?: () => void;
    onRecallSunCloud?: () => void;
    /** Flyg kartan tillbaka till det valda eventet (vi går dit — eventet
     *  teleporteras inte till vyn). Triggas av recenter-knappen på kortet. */
    onRecenter?: () => void;
}

export default function EventCard({ events, selectedEvent, onSelectEvent, onSaveEvent, onDiscardEvent, discardedEventIds, onCardExpandedChange, dayOffset, setDayOffset, onSunClick, mainCloudOffScreen, sunCloudOffScreen, onRecallMainCloud, onRecallSunCloud, onRecenter }: EventCardProps) {
    // Peek-höjd när kortet öppnas från stängt läge eller när användaren väljer
    // ett nytt ankar-event på kartan. Navigering med Nästa/Föregående bevarar
    // den höjd användaren själv dragit till.
    const PEEK_HEIGHT_VH = 28;
    const [heightVh, setHeightVh] = useState(PEEK_HEIGHT_VH);
    const heightVhRef = useRef(PEEK_HEIGHT_VH);
    const updateHeightVh = (vh: number) => {
        heightVhRef.current = vh;
        setHeightVh(vh);
    };

    const [dragX, setDragX] = useState(0);
    const dragXRef = useRef(0);
    const updateDragX = (x: number) => {
        dragXRef.current = x;
        setDragX(x);
    };

    const [exitX, setExitX] = useState<number | null>(null); // For animation off-screen
    const [anchorId, setAnchorId] = useState<string | null>(null);
    const [visitedEventIds, setVisitedEventIds] = useState<Set<string>>(new Set());
    const [nearbyVisibleCount, setNearbyVisibleCount] = useState(NEARBY_PAGE_SIZE);
    const [now, setNow] = useState(() => Date.now());
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    // Browse-historik: event-id:n vi tittade på innan vi gick vidare. Pushas vid Nästa/swipe/sekventiell-knapp.
    const [historyStack, setHistoryStack] = useState<string[]>([]);
    
    const [isAnimating, setIsAnimating] = useState(true);
    const isDragging = useRef(false);
    const dragDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const startX = useRef(0);
    const startY = useRef(0);
    const startHeightVh = useRef(PEEK_HEIGHT_VH);
    const startDragX = useRef(0);
    
    // Sätts till id:t vi själva ska byta till så useEffect kan särskilja
    // "användaren klickade på kartan" från "vi tryckte Nästa".
    const expectedNextIdRef = useRef<string | null>(null);

    // Notify parent about card expansion state for map center offsets
    useEffect(() => {
        onCardExpandedChange?.(heightVh > 50);
    }, [heightVh, onCardExpandedChange]);

    // Detektera om selectedEvent ändrats utifrån (kartklick) → då är det en ny ankare.
    useEffect(() => {
        if (!selectedEvent) return;
        if (expectedNextIdRef.current === selectedEvent.id) {
            // Det var pickNext som drev fram detta event — anchorId behålls
            // OCH höjden bevaras, så användaren får navigera utan att kortet
            // hoppar tillbaka till peek-läget.
            expectedNextIdRef.current = null;
            return;
        }
        // Användaren valde ett nytt event (kartklick / första valet) → ny ankare.
        // Detta är också vägen för "stäng → öppna igen", så här ska höjden
        // återställas till default peek.
        setAnchorId(selectedEvent.id);
        setVisitedEventIds(new Set());
        updateHeightVh(PEEK_HEIGHT_VH);
    }, [selectedEvent]);

    // Reset pagination and scroll position when the active event changes.
    // Höjden hanteras separat i ankar-effekten ovan så Nästa/Föregående bevarar
    // det användaren själv dragit till.
    useEffect(() => {
        setNearbyVisibleCount(NEARBY_PAGE_SIZE);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        updateDragX(0);
        setIsAnimating(true);
    }, [selectedEvent?.id]);

    // Uppdatera "nu" var 30:e sekund så statusbadgar håller sig fräscha.
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    // Sortera övriga event efter avstånd från valt event (närmst först).
    const nearbyEvents = useMemo(() => {
        if (!selectedEvent) return [] as { evt: LinkEvent; distanceKm: number | null }[];
        const anchorHasCoords = hasValidCoords(selectedEvent);
        const list = events
            .filter(e => e.id !== selectedEvent.id && !discardedEventIds.has(e.id))
            .map(evt => {
                const distanceKm = anchorHasCoords && hasValidCoords(evt)
                    ? haversineKm(selectedEvent.lat, selectedEvent.lng, evt.lat, evt.lng)
                    : null;
                return { evt, distanceKm };
            });
        list.sort((a, b) => {
            // Saknar koords → längst bak. Annars stigande avstånd.
            if (a.distanceKm === null && b.distanceKm === null) return 0;
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
        });
        return list;
    }, [events, selectedEvent, discardedEventIds]);

    // Dela upp närliggande event: kommande (ej passerade) visas direkt, medan de
    // som redan varit läggs under en hopfällbar flik. now gör att gränsen flyttar
    // sig i takt med klockan (uppdateras var 30:e sekund).
    const upcomingNearby = useMemo(() => {
        const kept = nearbyEvents.filter(n => {
            const status = getEventStatus(n.evt.time, now);
            if (status === 'past') return false;
            // Imminent (Pågår/Snart, <1h): dölj det man inte hinner till (>7 mil).
            // Okänt avstånd (null) får vara kvar — vi kan inte avgöra.
            if (status === 'ongoing' || status === 'soon') {
                if (n.distanceKm !== null && n.distanceKm > MAX_IMMINENT_DISTANCE_KM) return false;
            }
            return true;
        });
        // Imminenta (Pågår/Snart) först, sedan Senare — vardera närmast först.
        const isImminent = (n: { evt: LinkEvent }) => {
            const s = getEventStatus(n.evt.time, now);
            return s === 'ongoing' || s === 'soon';
        };
        return [...kept].sort((a, b) => {
            const rank = (isImminent(a) ? 0 : 1) - (isImminent(b) ? 0 : 1);
            if (rank !== 0) return rank;
            return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        });
    }, [nearbyEvents, now]);
    const pastNearby = useMemo(
        () => nearbyEvents.filter(n => getEventStatus(n.evt.time, now) === 'past'),
        [nearbyEvents, now]
    );

    // ── Förladda kommande event-bilder ──────────────────────────────────────
    // "Nästa" landar nästan alltid på det geografiskt närmaste icke-besökta
    // eventet. Vi simulerar de kommande hoppen (utan att röra state) och värmer
    // upp deras cover-bilder + favicon i webbläsarens cache redan medan du tittar
    // på nuvarande kort. När du sedan klickar Nästa är bilden redan nedladdad och
    // kortet visas direkt — istället för att hämta bilden on-demand.
    useEffect(() => {
        if (!selectedEvent || typeof window === 'undefined') return;

        const PRELOAD_COUNT = 4;
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        const simVisited = new Set(visitedEventIds);
        let current: LinkEvent = selectedEvent;
        const upcoming: LinkEvent[] = [];

        for (let i = 0; i < PRELOAD_COUNT; i++) {
            simVisited.add(current.id);
            let next = findNearestEvent(anchor, events, discardedEventIds, simVisited);
            if (!next) {
                // Allt besökt — börja om från ankaret (matchar pickNext-logiken).
                simVisited.clear();
                simVisited.add(anchor.id);
                next = findNearestEvent(anchor, events, discardedEventIds, simVisited);
            }
            if (!next || upcoming.some(e => e.id === next!.id)) break;
            upcoming.push(next);
            current = next;
        }

        // Värm också upp de närmaste i listan (för swipe / "nära dig"-klick).
        const candidates = [...upcoming, ...nearbyEvents.slice(0, 3).map(n => n.evt)];

        const seen = new Set<string>();
        for (const evt of candidates) {
            if (seen.has(evt.id)) continue;
            seen.add(evt.id);
            if (evt.coverImage) {
                const img = new window.Image();
                img.src = evt.coverImage;
            }
            try {
                const host = new URL(evt.url).hostname;
                const fav = new window.Image();
                fav.src = `https://icons.duckduckgo.com/ip3/${host}.ico`;
            } catch { /* ogiltig URL — hoppa över favicon */ }
        }
    }, [selectedEvent?.id, anchorId, events, discardedEventIds, visitedEventIds, nearbyEvents]);

    /**
     * Plocka nästa event utifrån ankaret (spiral utåt i avstånd).
     * Lägger nuvarande event i visited och letar närmaste-till-ankaret som inte är besökt.
     * När alla är besökta — nollställ visited och börja om.
     */
    const pickNext = (current: LinkEvent): LinkEvent | null => {
        const anchor = events.find(e => e.id === anchorId) ?? current;

        const newVisited = new Set(visitedEventIds);
        newVisited.add(current.id);

        let next = findNearestEvent(anchor, events, discardedEventIds, newVisited);
        if (!next) {
            // Allt slut — börja om från ankaret, exkludera bara ankaret självt + discarded
            newVisited.clear();
            newVisited.add(anchor.id);
            next = findNearestEvent(anchor, events, discardedEventIds, newVisited);
        }
        setVisitedEventIds(newVisited);
        if (next) expectedNextIdRef.current = next.id;
        return next;
    };

    const THRESHOLD = 100; // Pixels to trigger a swipe action

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;

        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }

        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragDirection.current = 'none';
        startX.current = e.clientX;
        startY.current = e.clientY;
        startHeightVh.current = heightVhRef.current;
        startDragX.current = dragXRef.current;
        setExitX(null); // Reset any exit animation
        setIsAnimating(false);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

        const deltaX = e.clientX - startX.current;
        const deltaY = startY.current - e.clientY; // drag up is positive deltaY

        if (dragDirection.current === 'none') {
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            if (absX > 5 || absY > 5) {
                if (absY > absX) {
                    dragDirection.current = 'vertical';
                } else {
                    dragDirection.current = 'horizontal';
                }
            }
        }

        if (dragDirection.current === 'vertical') {
            const deltaVh = (deltaY / window.innerHeight) * 100;
            const newHeight = Math.max(15, Math.min(95, startHeightVh.current + deltaVh));
            updateHeightVh(newHeight);
        } else if (dragDirection.current === 'horizontal') {
            updateDragX(startDragX.current + deltaX);
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }

        setIsAnimating(true);

        if (dragDirection.current === 'vertical') {
            const currentHeight = heightVhRef.current;

            if (currentHeight < 20) {
                onSelectEvent(null);
            } else {
                // Let the card stay at the exact height the user dragged it to, no snapping
                updateHeightVh(currentHeight);
            }
        } else if (dragDirection.current === 'horizontal') {
            const currentDragX = dragXRef.current;
            if (currentDragX > THRESHOLD) {
                handleSwipeOut('right');
            } else if (currentDragX < -THRESHOLD) {
                handleSwipeOut('left');
            } else {
                updateDragX(0);
            }
        }

        dragDirection.current = 'none';
    };

    const pushHistory = (id: string) => {
        setHistoryStack(prev => [...prev, id]);
    };

    const handleSwipeOut = (direction: 'left' | 'right') => {
        if (!selectedEvent) return;

        // Animate off screen
        setExitX(direction === 'right' ? window.innerWidth : -window.innerWidth);

        // Trigger save or discard state immediately
        if (direction === 'right') {
            onSaveEvent(selectedEvent.id);
        } else {
            onDiscardEvent(selectedEvent.id);
        }

        const previousId = selectedEvent.id;

        // Wait for animation, then change event
        setTimeout(() => {
            if (events.length === 0) return;

            // Hoppa till det geografiskt närmaste event som inte är bortkastat eller besökt
            const next = pickNext(selectedEvent);
            if (next) pushHistory(previousId);
            onSelectEvent(next);

            // Reset position immediately for the new card (height bevaras —
            // det här är en Nästa-navigering, inte en ny ankare).
            setExitX(null);
            updateDragX(0);
        }, 200); // 200ms matches the CSS transition
    };

    // Bakåt-knapp uppe vid LIVE: gå till det event vi tittade på innan vi gick vidare.
    // Detta är browse-historik, INTE föregående i nummerordning.
    const handleHistoryBack = () => {
        if (historyStack.length === 0) return;
        const prevId = historyStack[historyStack.length - 1];
        const prevEvent = events.find(e => e.id === prevId);
        setHistoryStack(prev => prev.slice(0, -1));
        if (prevEvent) onSelectEvent(prevEvent);
        setExitX(null);
        updateDragX(0);
    };

    const handleNextOnly = () => {
        if (!selectedEvent || events.length === 0) return;

        // Hoppa till det geografiskt närmaste event som inte är bortkastat eller besökt
        const next = pickNext(selectedEvent);
        if (next) pushHistory(selectedEvent.id);
        onSelectEvent(next);

        setExitX(null);
        updateDragX(0);
    };

    if (events.length === 0) return null;

    // Calculate dynamic rotation based on drag
    const rotation = (dragX / window.innerWidth) * 20; // Max 20 degrees rotation

    // Calculate opacity (slightly fades out at edges)
    const opacity = 1 - Math.abs(dragX / window.innerWidth) * 0.5;

    return (
        <>
        {/* Nedre rad — ALLTID synlig (dagväljare + antal till vänster, Nästa till höger om kort finns) */}
        <div className="fixed bottom-0 left-0 right-0 z-[1000] flex flex-col items-center px-4 pointer-events-none" style={{ minHeight: '100vh', justifyContent: 'flex-end' }}>
            <div className="w-full max-w-4xl flex justify-between items-center mb-4">

                {/* Vänster: Antal + Idag-knapp (samma höjd, längst till vänster) */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    <span className="bg-white/90 backdrop-blur-md text-slate-800 text-xs font-bold tabular-nums px-3 rounded-full shadow-lg border border-white/50 h-[38px] flex items-center justify-center min-w-[38px] box-border">
                        {events.length}
                    </span>
                    <button
                        onClick={() => setDayOffset((dayOffset + 1) % 7)}
                        className="bg-white/90 backdrop-blur-md px-4 rounded-full shadow-xl border border-white/50 hover:bg-white transition-all font-semibold text-sm tracking-wide flex items-center gap-2 text-slate-700 h-[38px] box-border"
                    >
                        <Calendar size={15} className="text-[#006AA7] shrink-0" />
                        <span>{getDayLabel(dayOffset)}</span>
                        <ChevronRight size={15} className="text-slate-400" />
                    </button>
                    {dayOffset !== 0 && (
                        <button
                            onClick={() => setDayOffset(0)}
                            className="bg-white/90 backdrop-blur-md p-2 rounded-full shadow-xl border border-white/50 hover:bg-white transition-colors h-[38px] w-[38px] flex items-center justify-center box-border"
                            title="Återställ till idag"
                        >
                            <RotateCcw size={15} className="text-slate-700" />
                        </button>
                    )}
                    {onSunClick && (
                        <button
                            onClick={onSunClick}
                            className="bg-white/90 backdrop-blur-md p-2 rounded-full shadow-xl border border-white/50 hover:bg-white transition-colors h-[38px] w-[38px] flex items-center justify-center box-border"
                            title="Lys upp kartan"
                        >
                            <Sun size={16} className="text-amber-500" />
                        </button>
                    )}
                    {onRecenter && (
                        <button
                            type="button"
                            onClick={onRecenter}
                            className="bg-white/90 backdrop-blur-md p-2 rounded-full shadow-xl border border-white/50 hover:bg-white transition-colors h-[38px] w-[38px] flex items-center justify-center box-border"
                            title="Visa molnet på kartan"
                            aria-label="Visa molnet på kartan"
                        >
                            <LocateFixed size={16} className="text-[#006AA7]" />
                        </button>
                    )}
                    {mainCloudOffScreen && onRecallMainCloud && (
                        <button
                            onClick={onRecallMainCloud}
                            className="bg-white/90 backdrop-blur-md p-2 rounded-full shadow-xl border border-white/50 hover:bg-white transition-colors h-[38px] w-[38px] flex items-center justify-center box-border animate-in fade-in zoom-in duration-200"
                            title="Hämta tillbaka molnet"
                            aria-label="Hämta tillbaka molnet"
                        >
                            <svg viewBox="0 0 24 24" width="16" height="16" className="text-sky-500" fill="currentColor">
                                <path d="M19.36 10.04a7 7 0 0 0-13.36 1.4A4.5 4.5 0 0 0 6.5 20h12a4 4 0 0 0 .86-7.96Z" />
                            </svg>
                        </button>
                    )}
                    {/* Sol-molnet har ingen egen recall-knapp — sol-knappen hämtar
                        tillbaka det. Bara EN moln-knapp (för info-molnet). */}
                </div>

                {/* Höger: bakåt + Nästa (samma höjd, längst till höger) */}
                {selectedEvent && (
                    <div className="flex items-center gap-2 pointer-events-auto">
                        {historyStack.length > 0 && (
                            <button
                                type="button"
                                onClick={handleHistoryBack}
                                aria-label="Gå tillbaka till föregående event"
                                title="Gå tillbaka"
                                className="bg-white/90 backdrop-blur-md text-slate-800 p-2 rounded-full shadow-xl border border-white/50 hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer h-[38px] w-[38px] flex items-center justify-center box-border"
                            >
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        <button
                            onClick={handleNextOnly}
                            className="bg-[#006AA7] hover:bg-[#005590] text-white font-bold px-6 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/20 h-[38px] flex items-center justify-center box-border"
                        >
                            Nästa <ArrowRight size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* Draggable bottom sheet card container — visas bara när ett event är valt */}
            {selectedEvent ? (
            <div
                className="relative w-full max-w-4xl pointer-events-auto flex flex-col bg-card rounded-t-[2rem] shadow-[0_-12px_60px_rgba(0,0,0,0.3)] overflow-hidden border border-border/10"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    height: `${heightVh}vh`,
                    transform: `translateX(${exitX !== null ? exitX : dragX}px) rotate(${rotation}deg)`,
                    opacity: exitX !== null ? 0 : opacity,
                    transition: isAnimating ? 'transform 200ms ease-out, opacity 200ms ease-out, height 350ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
                }}
            >
                {/* Thin invisible drag strip — still grabbable, no visual handle */}
                <div
                    className="w-full flex-shrink-0 h-3 cursor-grab active:cursor-grabbing select-none bg-card"
                    style={{ touchAction: 'none' }}
                />

                {/* Absolut drag-indikator. Ligger ovanpå kortet (absolute) så den
                    inte adderar någon höjd/padding. pointer-events-none → drag går
                    rakt igenom till kortet. */}
                <div className="absolute top-1.5 left-0 right-0 z-40 flex items-center justify-center pointer-events-none">
                    <div className="h-1.5 w-10 rounded-full bg-slate-300/90 dark:bg-slate-600/80" />
                </div>

                {/* Visual feedback overlays during drag (Tinder swipe overlays) */}
                {dragX > 20 && (
                    <div className="absolute top-16 left-6 z-50 bg-green-500 text-white font-bold text-lg px-4 py-1.5 rounded-xl border border-green-400/60 transform -rotate-12 shadow-lg pointer-events-none" style={{ opacity: Math.min(0.9, dragX / 120) }}>
                        SPARA
                    </div>
                )}
                {dragX < -20 && (
                    <div className="absolute top-16 right-6 z-50 bg-slate-700 text-white font-bold text-lg px-4 py-1.5 rounded-xl border border-slate-600/60 transform rotate-12 shadow-lg pointer-events-none" style={{ opacity: Math.min(0.9, Math.abs(dragX) / 120) }}>
                        NÄSTA
                    </div>
                )}

                {/* Scrollable content container */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 w-full overflow-y-auto overscroll-contain bg-card custom-scrollbar"
                    style={{
                        touchAction: heightVh < 50 ? 'none' : 'pan-y'
                    }}
                >
                    <LinkEventCard
                        linkEvent={selectedEvent}
                        isAdmin={false}
                        showFullAddress
                        alwaysExpanded
                    />
                    {nearbyEvents.length > 0 && (
                        <NearbyEventsList
                            upcomingItems={upcomingNearby.slice(0, nearbyVisibleCount)}
                            upcomingTotal={upcomingNearby.length}
                            pastItems={pastNearby}
                            now={now}
                            onSelect={evt => onSelectEvent(evt)}
                            onLoadMore={() => setNearbyVisibleCount(c => c + NEARBY_PAGE_SIZE)}
                        />
                    )}
                </div>
            </div>
            ) : (
                /* Håll reglaget på 30% höjd från botten när inget kort visas */
                <div style={{ height: '30vh' }} className="w-full flex-shrink-0" />
            )}
        </div>
        </>
    );
}
