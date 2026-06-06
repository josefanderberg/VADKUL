'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { LinkEvent } from '../../types';
import LinkEventCard from '../ui/LinkEventCard';
import { ArrowRight, ArrowLeft, Calendar, ChevronRight, RotateCcw, MapPin, Sun } from 'lucide-react';

// Default event-längd när vi inte har en explicit sluttid — används för Pågår/Har varit.
const DEFAULT_EVENT_MS = 60 * 60 * 1000;
// Hur långt fram i tiden "Snart" gäller.
const SOON_WINDOW_MS = 60 * 60 * 1000;
const NEARBY_PAGE_SIZE = 10;

type EventStatus = 'past' | 'ongoing' | 'soon' | 'later';

const getEventStatus = (time: Date, now: number): EventStatus => {
    const start = time.getTime();
    const end = start + DEFAULT_EVENT_MS;
    if (now >= end) return 'past';
    if (now >= start) return 'ongoing';
    if (start - now <= SOON_WINDOW_MS) return 'soon';
    return 'later';
};

const formatDistanceKm = (km: number): string => {
    if (km < 1) {
        const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
        return `${m} m`;
    }
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
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
    items: { evt: LinkEvent; distanceKm: number | null }[];
    totalCount: number;
    now: number;
    onSelect: (evt: LinkEvent) => void;
    onLoadMore: () => void;
}

function StatusBadge({ status }: { status: EventStatus }) {
    if (status === 'later') return null;
    const cfg = {
        ongoing: { label: 'Pågår', cls: 'bg-emerald-500 text-white' },
        soon: { label: 'Snart', cls: 'bg-amber-500 text-white' },
        past: { label: 'Har varit', cls: 'bg-slate-300 text-slate-700' },
    }[status];
    return (
        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

function NearbyEventsList({ items, totalCount, now, onSelect, onLoadMore }: NearbyEventsListProps) {
    return (
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 border-t border-border">
            <div className="px-4 md:px-6 py-3 sticky top-0 bg-slate-50/95 dark:bg-slate-900/80 backdrop-blur-sm border-b border-border z-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Fler event i närheten · {totalCount}
                </span>
            </div>
            <ul className="divide-y divide-border">
                {items.map(({ evt, distanceKm }) => {
                    const status = getEventStatus(evt.time, now);
                    return (
                        <li key={evt.id}>
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
                                </div>
                                <ChevronRight size={16} className="text-slate-400 shrink-0" />
                            </button>
                        </li>
                    );
                })}
            </ul>
            {items.length < totalCount && (
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
}

export default function EventCard({ events, selectedEvent, onSelectEvent, onSaveEvent, onDiscardEvent, discardedEventIds, onCardExpandedChange, dayOffset, setDayOffset, onSunClick }: EventCardProps) {
    const [heightVh, setHeightVh] = useState(35);
    const heightVhRef = useRef(35);
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
    const startHeightVh = useRef(35);
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
            // Det var pickNext som drev fram detta event — anchorId behålls.
            expectedNextIdRef.current = null;
            return;
        }
        // Användaren valde ett nytt event (kartklick / första valet) → ny ankare.
        setAnchorId(selectedEvent.id);
        setVisitedEventIds(new Set());
    }, [selectedEvent]);

    // Reset pagination, height and scroll position when the active event changes.
    useEffect(() => {
        setNearbyVisibleCount(NEARBY_PAGE_SIZE);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        updateHeightVh(35); // Reset to Peek height
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

            // Reset position immediately for the new card
            setExitX(null);
            updateDragX(0);
            updateHeightVh(35); // Reset height to Peek
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
        updateHeightVh(35); // Reset to Peek
    };

    const handleNextOnly = () => {
        if (!selectedEvent || events.length === 0) return;

        // Hoppa till det geografiskt närmaste event som inte är bortkastat eller besökt
        const next = pickNext(selectedEvent);
        if (next) pushHistory(selectedEvent.id);
        onSelectEvent(next);

        setExitX(null);
        updateDragX(0);
        updateHeightVh(35); // Reset to Peek
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
                            items={nearbyEvents.slice(0, nearbyVisibleCount)}
                            totalCount={nearbyEvents.length}
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
