'use client';

import { useState, useRef, useEffect } from 'react';
import { LinkEvent } from '../../types';
import LinkEventCard from '../ui/LinkEventCard';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface BottomSheetEventProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
}

export default function BottomSheetEvent({ events, selectedEvent, onSelectEvent }: BottomSheetEventProps) {
    const [sheetY, setSheetY] = useState(0); 
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startSheetY = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const SELECTED_HEIGHT = 460; // Base visible height when collapsed (högre för att se hela kortet)
    const MAX_UP = -500; // How far up they can drag

    const [isAnimating, setIsAnimating] = useState(false);

    // Global drag handlers to prevent "losing" the drag when moving fast
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (!isDragging.current) return;
            const deltaY = e.clientY - startY.current;
            let newY = startSheetY.current + deltaY;
            // Strict boundaries
            if (newY < MAX_UP) newY = MAX_UP;
            if (newY > 0) newY = 0;
            setSheetY(newY);
        };

        const handlePointerUp = () => {
            if (!isDragging.current) return;
            isDragging.current = false;
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('pointercancel', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerUp);
        };
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        startY.current = e.clientY;
        startSheetY.current = sheetY;
        setIsAnimating(false);
    };

    useEffect(() => {
        if (selectedEvent) {
            setIsAnimating(true);
            setSheetY(0);
            
            // Scrolla panelen upp till toppen automatiskt
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [selectedEvent]);

    if (!selectedEvent) return null;

    return (
        <div 
            className={`fixed bottom-0 left-0 right-0 z-[1000] flex flex-col bg-transparent ${isAnimating ? 'transition-transform duration-200 ease-out' : ''}`}
            style={{ 
                height: `${SELECTED_HEIGHT + Math.abs(MAX_UP)}px`, 
                transform: `translateY(${Math.abs(MAX_UP) + sheetY}px)`, 
                touchAction: 'none' 
            }}
        >
            {/* Handtag för att indikera att den går att dra i */}
            <div 
                className="w-full flex justify-center items-center h-8 cursor-grab active:cursor-grabbing shrink-0"
                onPointerDown={onPointerDown}
            >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Innehållet - Full bredd, integrerat */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-12 custom-scrollbar">
                
                {/* Valt event överst, full bredd */}
                <div 
                    className="w-full mb-8 cursor-grab active:cursor-grabbing"
                    onPointerDown={onPointerDown}
                >
                    <LinkEventCard linkEvent={selectedEvent} isAdmin={false} isPanelMode={true} />
                </div>

                {/* Listan över andra event */}
                <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Utforska fler event</h2>
                    <div className="flex flex-col gap-4">
                        {events.filter(e => e.id !== selectedEvent.id).map(evt => (
                            <div key={evt.id} onClick={() => {
                                onSelectEvent(evt);
                                setSheetY(0);
                                setIsAnimating(true);
                            }} className="cursor-pointer border-b border-gray-100 pb-4">
                                <LinkEventCard linkEvent={evt} isAdmin={false} />
                            </div>
                        ))}
                        {events.length <= 1 && (
                            <p className="text-gray-500 py-4">Inga fler event i närheten.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
