'use client';

import { useEffect, useState } from 'react';
import { LinkEvent } from '../../types';
import { linkEventService } from '../../services/linkEventService';
import FloatingNavbar from '../../components/v2/FloatingNavbar';
import V2SwipeableCard from '../../components/v2/V2SwipeableCard';
// We must dynamically import V2Map because leaflet requires window object
import dynamic from 'next/dynamic';

const V2MapDynamic = dynamic(() => import('../../components/v2/V2Map'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">Laddar karta...</div>
});

export default function V2Page() {
    const [events, setEvents] = useState<LinkEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<LinkEvent | null>(null);
    const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
    const [discardedEventIds, setDiscardedEventIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        async function fetchEvents() {
            // Hämta bara framtida events
            const fetched = await linkEventService.getAll(true);
            
            // Sortera så de närmaste i tid ligger först i listan
            const sorted = fetched.sort((a, b) => a.time.getTime() - b.time.getTime());
            
            setEvents(sorted);
        }
        fetchEvents();
    }, []);

    // Stäng av scroll på body så kartan tar över helt
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    const handleSaveEvent = (eventId: string) => {
        setSavedEventIds(prev => {
            const next = new Set(prev);
            next.add(eventId);
            return next;
        });
        // Remove from discarded if it was there
        setDiscardedEventIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
        });
    };

    const handleDiscardEvent = (eventId: string) => {
        setDiscardedEventIds(prev => {
            const next = new Set(prev);
            next.add(eventId);
            return next;
        });
        // Remove from saved if it was there
        setSavedEventIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
        });
    };

    return (
        <main className="relative w-screen h-screen overflow-hidden bg-slate-100">
            {/* 1. Svävande transparent Navbar överst */}
            <FloatingNavbar />

            {/* 2. Fullskärmskarta underst */}
            <V2MapDynamic 
                events={events} 
                selectedEvent={selectedEvent} 
                onSelectEvent={setSelectedEvent} 
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
            />

            {/* 3. Dra-och-släpp (Tinder-style) kort längst ner */}
            <V2SwipeableCard 
                events={events}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                onSaveEvent={handleSaveEvent}
                onDiscardEvent={handleDiscardEvent}
                discardedEventIds={discardedEventIds}
            />
        </main>
    );
}
