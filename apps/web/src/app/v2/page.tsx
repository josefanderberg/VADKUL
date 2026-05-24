'use client';

import { useEffect, useRef, useState } from 'react';
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
 * Vid dagbyte: välj eventet som ligger närmast användarens nuvarande position
 * (det tidigare selectedEvent). Faller tillbaka till första event i listan om
 * ankare saknar koords eller om inget event för dagen har koords.
 */
const pickNearestForDay = (anchor: LinkEvent | null, dayEvents: LinkEvent[]): LinkEvent | null => {
    if (dayEvents.length === 0) return null;
    if (!anchor || !hasValidCoords(anchor)) return dayEvents[0];

    let nearest: LinkEvent | null = null;
    let nearestDist = Infinity;
    for (const evt of dayEvents) {
        if (!hasValidCoords(evt)) continue;
        const d = haversineKm(anchor.lat, anchor.lng, evt.lat, evt.lng);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = evt;
        }
    }
    return nearest ?? dayEvents[0];
};

export default function V2Page() {
    const [events, setEvents] = useState<LinkEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<LinkEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<LinkEvent | null>(null);
    const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
    const [discardedEventIds, setDiscardedEventIds] = useState<Set<string>>(new Set());
    const [dayOffset, setDayOffset] = useState(0);
    const [isLive, setIsLive] = useState(false);
    const [newEventCount, setNewEventCount] = useState(0);
    const [prevEventCount, setPrevEventCount] = useState(0);
    const [cardExpanded, setCardExpanded] = useState(false);
    const prevDayOffset = useRef(dayOffset);

    // Real-time Firestore listener — uppdaterar kartan direkt när scraper hittar events
    useEffect(() => {
        const unsubscribe = linkEventService.subscribeToAll(true, (fetched) => {
            const sorted = fetched.sort((a, b) => a.time.getTime() - b.time.getTime());
            setEvents(prev => {
                const diff = sorted.length - prev.length;
                if (diff > 0 && prev.length > 0) {
                    setNewEventCount(diff);
                    // Rensa badge efter 4 sek
                    setTimeout(() => setNewEventCount(0), 4000);
                }
                setPrevEventCount(sorted.length);
                return sorted;
            });
            setIsLive(true);
        });
        return () => unsubscribe();
    }, []);

    // Filtrera events för den specifika dagen
    useEffect(() => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const filtered = events.filter(evt => {
            return evt.time >= startOfDay && evt.time <= endOfDay;
        });

        setFilteredEvents(filtered);
        // När dagen byts: välj eventet som ligger närmast nuvarande position
        // (gör det inte vid varje Firestore-uppdatering — bara när användaren bytt dag)
        if (prevDayOffset.current !== dayOffset) {
            setSelectedEvent(prev => pickNearestForDay(prev, filtered));
            prevDayOffset.current = dayOffset;
        }
    }, [events, dayOffset]);

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
            <FloatingNavbar dayOffset={dayOffset} setDayOffset={setDayOffset} />

            {/* Live-indikator — visas när Firestore-lyssnar är aktiv */}
            {isLive && (
                <div
                    style={{
                        position: 'absolute',
                        top: '32px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '999px',
                        padding: '4px 10px 4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#fff',
                        letterSpacing: '0.05em',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        userSelect: 'none',
                    }}
                >
                    <span style={{
                        width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                        boxShadow: '0 0 0 0 #22c55e88',
                        animation: 'livePulse 1.8s ease-out infinite',
                        display: 'inline-block',
                    }} />
                    LIVE
                    {newEventCount > 0 && (
                        <span style={{
                            background: '#22c55e',
                            color: '#fff',
                            borderRadius: '999px',
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 700,
                            marginLeft: 2,
                            animation: 'fadeInUp 0.3s ease',
                        }}>
                            +{newEventCount}
                        </span>
                    )}
                </div>
            )}

            {/* CSS keyframes för Live-puls och badge */}
            <style>{`
                @keyframes livePulse {
                    0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
                    70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
                    100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* 2. Fullskärmskarta underst */}
            <V2MapDynamic
                events={filteredEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
                cardExpanded={cardExpanded}
            />

            {/* 3. Dra-och-släpp (Tinder-style) kort längst ner */}
            <V2SwipeableCard
                events={filteredEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                onSaveEvent={handleSaveEvent}
                onDiscardEvent={handleDiscardEvent}
                discardedEventIds={discardedEventIds}
                onCardExpandedChange={setCardExpanded}
            />
        </main>
    );
}
