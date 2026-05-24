'use client';

import { useState, useRef, useEffect } from 'react';
import { LinkEvent } from '../../types';
import LinkEventCard from '../ui/LinkEventCard';
import { ArrowRight } from 'lucide-react';

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

interface V2SwipeableCardProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    onSaveEvent: (eventId: string) => void;
    onDiscardEvent: (eventId: string) => void;
    discardedEventIds: Set<string>;
}

export default function V2SwipeableCard({ events, selectedEvent, onSelectEvent, onSaveEvent, onDiscardEvent, discardedEventIds }: V2SwipeableCardProps) {
    const [dragX, setDragX] = useState(0);
    const [exitX, setExitX] = useState<number | null>(null); // For animation off-screen
    const [anchorId, setAnchorId] = useState<string | null>(null);
    const [visitedEventIds, setVisitedEventIds] = useState<Set<string>>(new Set());
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startDragX = useRef(0);
    // Sätts till id:t vi själva ska byta till så useEffect kan särskilja
    // "användaren klickade på kartan" från "vi tryckte Nästa".
    const expectedNextIdRef = useRef<string | null>(null);

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

    // Global drag handlers to prevent "losing" the drag when moving fast
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!isDragging.current) return;
            const deltaX = e.clientX - startX.current;
            setDragX(startDragX.current + deltaX);
        };

        const handlePointerUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
            
            // Check if passed threshold
            if (dragX > THRESHOLD) {
                // Swiped Right -> Save and Next
                handleSwipeOut('right');
            } else if (dragX < -THRESHOLD) {
                // Swiped Left -> Discard and Next
                handleSwipeOut('left');
            } else {
                // Snap back to center
                setDragX(0);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dragX, selectedEvent, events]);

    const onPointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        startX.current = e.clientX;
        startDragX.current = dragX;
        setExitX(null); // Reset any exit animation
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

        // Wait for animation, then change event
        setTimeout(() => {
            if (events.length === 0) return;

            // Hoppa till det geografiskt närmaste event som inte är bortkastat eller besökt
            const next = pickNext(selectedEvent);
            onSelectEvent(next);

            // Reset position immediately for the new card
            setExitX(null);
            setDragX(0);
        }, 200); // 200ms matches the CSS transition
    };

    const handlePrevious = () => {
        if (!selectedEvent || events.length === 0) return;

        const idx = events.findIndex(evt => evt.id === selectedEvent.id);
        if (idx < 0) return;

        let prevIdx = (idx - 1 + events.length) % events.length;
        let loopCounter = 0;

        while (
            (discardedEventIds.has(events[prevIdx].id) || events[prevIdx].id === selectedEvent.id)
            && loopCounter < events.length
        ) {
            prevIdx = (prevIdx - 1 + events.length) % events.length;
            loopCounter++;
        }

        if (loopCounter < events.length) {
            onSelectEvent(events[prevIdx]);
        }

        setExitX(null);
        setDragX(0);
    };

    const handleNextOnly = () => {
        if (!selectedEvent || events.length === 0) return;

        // Hoppa till det geografiskt närmaste event som inte är bortkastat eller besökt
        const next = pickNext(selectedEvent);
        onSelectEvent(next);

        setExitX(null);
        setDragX(0);
    };

    if (!selectedEvent) return null;

    // Calculate dynamic rotation based on drag
    const rotation = (dragX / window.innerWidth) * 20; // Max 20 degrees rotation

    // Calculate opacity (slightly fades out at edges)
    const opacity = 1 - Math.abs(dragX / window.innerWidth) * 0.5;

    // Position-indikator: vilket event i vyn vi tittar på just nu
    const currentIndex = events.findIndex(evt => evt.id === selectedEvent.id);
    const positionLabel = currentIndex >= 0 ? `${currentIndex + 1}/${events.length}` : '';

    return (
        <div className="fixed bottom-6 left-0 right-0 z-[1000] flex flex-col items-center px-4 pointer-events-none">
            {/* NÄSTA BUTTON (Green) - Above the card, doesn't rotate */}
            <div className="w-full max-w-4xl flex justify-center items-center gap-3 mb-4">
                {positionLabel && (
                    <button
                        type="button"
                        onClick={handlePrevious}
                        aria-label="Föregående event"
                        title="Gå tillbaka ett steg"
                        className="bg-white/90 backdrop-blur-md text-slate-800 font-black text-sm py-2 px-4 rounded-full shadow-xl border border-white/50 pointer-events-auto tabular-nums hover:bg-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    >
                        {positionLabel}
                    </button>
                )}
                <button
                    onClick={handleNextOnly}
                    className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-full shadow-xl hover:bg-green-500 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-green-500/50 pointer-events-auto"
                >
                    Nästa <ArrowRight size={18} />
                </button>
            </div>

            <div 
                className="relative w-full max-w-4xl h-auto pointer-events-auto"
                onPointerDown={onPointerDown}
                style={{
                    transform: `translateX(${exitX !== null ? exitX : dragX}px) rotate(${rotation}deg)`,
                    opacity: exitX !== null ? 0 : opacity,
                    transition: isDragging.current ? 'none' : 'transform 200ms ease-out, opacity 200ms ease-out',
                    touchAction: 'none' // Prevent scrolling
                }}
            >
                {/* Visual feedback overlays during drag */}
                {dragX > 20 && (
                    <div className="absolute top-4 left-4 z-50 bg-green-500 text-white font-bold text-xl px-4 py-1 rounded-md border-2 border-green-600 transform -rotate-12 opacity-80 shadow-lg pointer-events-none">
                        SPARA
                    </div>
                )}
                {dragX < -20 && (
                    <div className="absolute top-4 right-4 z-50 bg-red-500 text-white font-bold text-xl px-4 py-1 rounded-md border-2 border-red-600 transform rotate-12 opacity-80 shadow-lg pointer-events-none">
                        NÄSTA
                    </div>
                )}

                <div className={`w-full h-full shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-lg ${isDragging.current ? 'pointer-events-none' : ''}`}>
                    <LinkEventCard linkEvent={selectedEvent} isAdmin={false} showFullAddress />
                </div>
            </div>
        </div>
    );
}
