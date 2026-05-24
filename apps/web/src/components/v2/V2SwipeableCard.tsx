'use client';

import { useState, useRef, useEffect } from 'react';
import { LinkEvent } from '../../types';
import LinkEventCard from '../ui/LinkEventCard';
import { ArrowRight } from 'lucide-react';

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
    const isDragging = useRef(false);
    const startX = useRef(0);
    const startDragX = useRef(0);

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
            
            // Hitta nuvarande index i huvudlistan
            const idx = events.findIndex(evt => evt.id === selectedEvent.id);
            
            // Leta framåt efter nästa event som INTE är bortkastat (och som inte är vi själva)
            let nextIdx = (idx + 1) % events.length;
            let loopCounter = 0;
            
            while (
                (discardedEventIds.has(events[nextIdx].id) || events[nextIdx].id === selectedEvent.id) 
                && loopCounter < events.length
            ) {
                nextIdx = (nextIdx + 1) % events.length;
                loopCounter++;
            }
            
            if (loopCounter < events.length) {
                onSelectEvent(events[nextIdx]);
            } else {
                // Alla är bortkastade!
                onSelectEvent(null);
            }
            
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
        
        const idx = events.findIndex(evt => evt.id === selectedEvent.id);
        let nextIdx = (idx + 1) % events.length;
        let loopCounter = 0;
        
        while (
            (discardedEventIds.has(events[nextIdx].id) || events[nextIdx].id === selectedEvent.id) 
            && loopCounter < events.length
        ) {
            nextIdx = (nextIdx + 1) % events.length;
            loopCounter++;
        }
        
        if (loopCounter < events.length) {
            onSelectEvent(events[nextIdx]);
        } else {
            onSelectEvent(null);
        }
        
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
