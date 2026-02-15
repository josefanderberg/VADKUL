'use client';

import { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

import Layout from '../layout/Layout';
import EventCard from '../ui/EventCard';
import EventFilters from './EventFilters';
import WelcomeModal from '../ui/WelcomeModal';

import { eventService } from '../../services/eventService';
import { settingsService } from '../../services/settingsService';
import type { AppEvent } from '../../types';
import { calculateDistance, saveLocationToLocalStorage } from '../../utils/mapUtils';
import { ArrowUpDown, Trophy } from 'lucide-react';

// Dynamic import of the Map component to avoid SSR issues with Leaflet
const HomeMap = dynamic(() => import('./HomeMap'), {
    ssr: false,
    loading: () => (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 bg-muted/50 rounded-2xl border border-border">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p>Laddar karta...</p>
        </div>
    )
});

export default function HomeContent() {
    const router = useRouter();

    // 1. Initialisera userLocation från storage eller default 
    // Vi flyttar upp detta för att kunna använda i queryKey
    const [userLocation, setUserLocation] = useState<[number, number]>(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('vadkul_map_center');
            return saved ? JSON.parse(saved) : [56.8556, 14.8250];
        }
        return [56.8556, 14.8250];
    });

    // 2. State för "Sökfönster" för Query
    const [fetchRadius, setFetchRadius] = useState(50000);
    const [mapState, setMapState] = useState<{ center: [number, number], zoom: number } | null>(null);

    // Initial Geolocation fetch (only on mount if no saved pos)
    useEffect(() => {
        if (!sessionStorage.getItem('vadkul_map_center') && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                setUserLocation(newLoc);
                setMapState({ center: newLoc, zoom: 13 }); // Trigger update
                saveLocationToLocalStorage(pos.coords.latitude, pos.coords.longitude);
            });
        }
    }, []);

    // 3. TanStack Query
    const { data: events = [], isLoading: loading } = useQuery({
        queryKey: ['events', 'geo', mapState ? mapState.center : userLocation, fetchRadius],
        queryFn: async () => {
            // Use mapState center if moved, else initial userLocation
            const center = mapState ? mapState.center : userLocation;
            return eventService.getEventsInBounds(center, fetchRadius);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: (previousData) => previousData, // Keep data while fetching new
    });

    const searchParams = useSearchParams();

    // Initialize view from storage or URL param
    const [view, setView] = useState<'list' | 'map'>(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'map') return 'map';
        if (viewParam === 'list') return 'list';

        return (typeof window !== 'undefined' && sessionStorage.getItem('vadkul_home_view') as 'list' | 'map') || 'list';
    });



    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);

    // Filter states (Avstånd borttaget)
    const [filterType, setFilterType] = useState('all');
    const [filterAge, setFilterAge] = useState('all');
    const [filterFree, setFilterFree] = useState(false);
    const [filterToday, setFilterToday] = useState(false);
    const [sortBy, setSortBy] = useState('closest'); // Default: närmast
    const [searchQuery, setSearchQuery] = useState(''); // <--- NY: Söksträng

    // Settings (Init from cache to avoid flicker)
    const [showHallOfFame, setShowHallOfFame] = useState(() => {
        const cached = settingsService.getCachedSettings();
        return cached ? cached.showHallOfFame : true;
    });

    // --- Persist View State ---
    useEffect(() => {
        sessionStorage.setItem('vadkul_home_view', view);
    }, [view]);

    // --- Fetch Settings ---
    useEffect(() => {
        const unsub = settingsService.subscribe((settings) => {
            setShowHallOfFame(settings.showHallOfFame);
        });
        return () => unsub();
    }, []);

    // --- AGGRESSIVE SCROLL RESTORATION ---
    // 1. Disable browser's auto restoration to avoid conflicts
    useEffect(() => {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        return () => {
            // Reset to auto when leaving Home (optional, but good practice if other pages rely on it)
            // But since we want to control it, maybe keep it manual or let other pages set it.
            // For now, let's leave it manual or reset it.
            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = 'auto';
            }
        }
    }, []);

    // 2. Restore Scroll logic
    useLayoutEffect(() => {
        if (view === 'list' && !loading) {
            const savedScroll = sessionStorage.getItem('vadkul_home_scroll');
            if (savedScroll) {
                const scrollPos = parseInt(savedScroll, 10);
                if (scrollPos > 0) {
                    // Restore immediately
                    window.scrollTo(0, scrollPos);
                }
            }
        }
    }, [view, loading]); // Run whenever view or loading changes

    // --- Save Scroll on Unmount/View Change/Scroll ---
    useEffect(() => {
        // Save scroll position periodically or on leave
        const handleScroll = () => {
            if (view === 'list') {
                sessionStorage.setItem('vadkul_home_scroll', window.scrollY.toString());
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [view]);


    // --- Ladda data baserat på position ---
    // Effect to handle Debounced Map Moves (Update Query Params)
    useEffect(() => {
        if (!mapState) return;

        const timer = setTimeout(() => {
            // Calculate appropriate radius based on zoom
            const r = 40000000 / Math.pow(2, mapState.zoom);
            const newRadius = Math.max(2000, Math.min(r, 500000));
            setFetchRadius(newRadius);
            // Updating mapState (handled by handleMapMove) implicitly updates the Query Key via render
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [mapState]);

    // Define the type for the map move handler parameters locally since we don't import Leaflet types here
    const handleMapMove = (center: any, zoom: number) => {
        setMapState({ center: [center.lat, center.lng], zoom });
    };

    // --- HALL OF FAME LOGIC ---
    const hallOfFameEvent = useMemo(() => {
        if (!events || events.length === 0) return null;

        const now = new Date();
        // Ändrat: Titta bakåt 30 dagar istället för strikt "denna månad"
        // Detta gör att vi alltid har data, även den 1:a i månaden.
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // 1. Filtrera events skapade de senaste 30 dagarna
        const recentEvents = events.filter(e => {
            if (!e.createdAt) return false;
            // Ensure createdAt is a Date object (state initializer handles this but good to be safe)
            const created = new Date(e.createdAt);
            return created >= thirtyDaysAgo;
        });

        if (recentEvents.length === 0) return null;

        // 2. Sortera på antal deltagare (högst först)
        return recentEvents.sort((a, b) => {
            const countA = a.attendees?.length || 0;
            const countB = b.attendees?.length || 0;
            return countB - countA;
        })[0];
    }, [events]);

    // --- LOGIK: Filtrera -> Sortera på avstånd -> Ta topp 30 -> Sortera på användarens val ---
    const filteredEvents = useMemo(() => {
        const now = new Date(); // Skapa datumet en gång innan loopen
        const query = searchQuery.toLowerCase().trim();

        // 1. Grundläggande filtrering
        let candidates = events.filter(event => {
            const dist = calculateDistance(userLocation[0], userLocation[1], event.lat, event.lng);
            event.location.distance = dist; // Spara avståndet på objektet

            // Filtrera bort gamla events (starttid har passerat midnatt igår)
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            if (new Date(event.time) < startOfToday) return false;

            // Filtrera bort gömda events
            if (event.visibility === 'hidden') return false;

            // Sök-filtrering (Titel, Beskrivning eller Plats)
            if (query) {
                const matchTitle = event.title.toLowerCase().includes(query);
                const matchDesc = event.description.toLowerCase().includes(query);
                const matchLoc = event.location.name.toLowerCase().includes(query);
                if (!matchTitle && !matchDesc && !matchLoc) return false;
            }

            if (filterType !== 'all' && event.type !== filterType) return false;

            // Åldersfilter
            if (filterAge === 'family') {
                // Familj: Max 12 år (eller ingen åldersgräns alls)
                if (event.minAge >= 13) return false;
            }
            if (filterAge === '13+') {
                // Ungdom: 13-17 år.
                // Exkludera barn-events (maxAge < 13) och vuxen-events (minAge >= 18)
                if (event.maxAge && event.maxAge < 13) return false; // För unga
            }
            if (filterAge === '18+') {
                // Vuxen: Strikt 18+
                if (event.minAge < 18) return false;
            }
            if (filterAge === 'seniors') {
                if (event.minAge < 65) return false;
            }
            if (filterFree && event.price > 0) return false;
            if (filterToday) {
                const today = new Date().toDateString();
                if (new Date(event.time).toDateString() !== today) return false;
            }
            return true;
        });

        // 2. Sortera ALLA kandidater på avstånd (närmast först)
        candidates.sort((a, b) => (a.location.distance || 0) - (b.location.distance || 0));

        // 3. Ta bara de 30 närmaste
        const top30Closest = candidates.slice(0, 30);

        // 4. Sortera dessa 30 baserat på vad användaren valt i dropdownen
        return top30Closest.sort((a, b) => {
            switch (sortBy) {
                case 'closest': return (a.location.distance || 0) - (b.location.distance || 0);
                case 'soonest': return new Date(a.time).getTime() - new Date(b.time).getTime();
                case 'latest':
                    // Sortera på createdAt om det finns, annars fallback till time (skapad nyligen = oftast långt fram i tiden?)
                    // Nej, fallback bör nog vara 0 eller något.
                    if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    return 0;
                case 'popular': return (b.attendees?.length || 0) - (a.attendees?.length || 0);
                default: return 0;
            }
        });
    }, [events, userLocation, filterType, filterAge, filterFree, filterToday, sortBy, searchQuery]); // <-- Lade till searchQuery

    const handleMapClick = (lat: number, lng: number) => {
        if (selectedEvent) setSelectedEvent(null);
        else {
            setUserLocation([lat, lng]);
            saveLocationToLocalStorage(lat, lng);
        }
    };

    const cycleNextEvent = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!selectedEvent || filteredEvents.length === 0) return;
        const currentIndex = filteredEvents.findIndex(evt => evt.id === selectedEvent.id);
        const nextIndex = (currentIndex + 1) % filteredEvents.length;
        setSelectedEvent(filteredEvents[nextIndex]);
    };

    const cyclePrevEvent = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!selectedEvent || filteredEvents.length === 0) return;
        const currentIndex = filteredEvents.findIndex(evt => evt.id === selectedEvent.id);
        // Lägg till length innan modulo för att hantera negativa tal korrekt
        const prevIndex = (currentIndex - 1 + filteredEvents.length) % filteredEvents.length;
        setSelectedEvent(filteredEvents[prevIndex]);
    };

    const resetFilters = () => {
        setFilterType('all');
        setFilterAge('all');
        setFilterFree(false);
        setFilterToday(false);
        setSortBy('closest');
        setSearchQuery(''); // <-- Nollställ sök

    };

    return (
        <Layout>
            <WelcomeModal />
            {/* SCROLL FIXEN:
          List-vy: Overflow-y-auto på container.
          Map-vy: Flex-box layout som fyller höjden exakt utan scroll.
      */}
            <div
                className={`relative w-full ${view === 'map' ? 'h-[calc(100vh-64px)] flex flex-col overflow-hidden' : 'min-h-[calc(100vh-64px)]'}`}
            >
                {/* Filters är numera fixed (internt), så vi behöver en spacer för att inte dölja innehåll */}
                <EventFilters
                    filterType={filterType}
                    setFilterType={setFilterType}
                    view={view}
                    setView={setView}
                    filterToday={filterToday}
                    setFilterToday={setFilterToday}
                    filterFree={filterFree}
                    setFilterFree={setFilterFree}
                    filterAge={filterAge}
                    setFilterAge={setFilterAge}
                    resetFilters={resetFilters}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                />



                {/* Spacer för att kompensera för fixed filter-bar (ca 70px) */}
                <div className="h-[72px] w-full" />

                {/* HALL OF FAME (Efter spacer, precis över sortering) */}
                {view === 'list' && showHallOfFame && hallOfFameEvent && (
                    <div className="max-w-6xl mx-auto px-4 mt-4 mb-0 relative z-20 pointer-events-auto">
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log("Clicking Hall of Fame:", hallOfFameEvent.host);
                                if (hallOfFameEvent.host?.uid) {
                                    router.push(`/public-profile/${hallOfFameEvent.host.uid}`);
                                }
                            }}
                            className="bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                        >
                            <div className="absolute -right-4 -top-4 text-yellow-500/10"> <Trophy size={120} /> </div>
                            <div className="bg-yellow-400 text-yellow-900 p-3 rounded-full flex-shrink-0 z-10 shadow-md"> <Trophy size={24} fill="currentColor" /> </div>
                            <div className="z-10 flex-1">
                                <p className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-1">
                                    {new Date().toLocaleString('sv-SE', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('sv-SE', { month: 'long' }).slice(1)} Hall of Fame 🏆
                                </p>
                                <h3 className="font-bold text-lg text-yellow-900 leading-tight line-clamp-1">
                                    {hallOfFameEvent.title}
                                </h3>
                                <p className="text-sm text-yellow-800">
                                    Skapat av <span className="font-bold">{hallOfFameEvent.host?.name || 'Okänd'}</span> • <span className="font-bold">{hallOfFameEvent.attendees?.length || 0} deltagare</span>!
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sortering - Också flex-shrink-0 för att inte tryckas ihop */}
                <div className="max-w-6xl mx-auto px-4 pt-2 pb-2 flex justify-end flex-shrink-0 w-full z-10 relative pointer-events-none">
                    <div className="flex items-center gap-1 text-muted-foreground pointer-events-auto bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-border">
                        <ArrowUpDown size={14} />
                        <span className="text-xs font-bold uppercase mr-1">Sortera (topp 30):</span>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-bold text-foreground outline-none cursor-pointer text-sm hover:text-primary transition-colors">
                            <option value="closest">Närmast</option>
                            <option value="soonest">Tid kvar</option>
                            <option value="latest">Senast tillagd</option>
                            <option value="popular">Populärast</option>
                        </select>
                    </div>
                </div>

                {/* 
            Innehållscontainer 
            Map: Flex-1 för att ta RESTEN av höjden (borde bli exakt rätt).
            List: Min-height för scroll.
        */}
                <div className={`max-w-6xl mx-auto px-4 pb-4 w-full ${view === 'map' ? 'flex-1 h-full min-h-0' : 'min-h-[500px]'}`}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 pt-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                            <p>Laddar events...</p>
                        </div>
                    ) : filteredEvents.length === 0 && view === 'list' ? (
                        <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                            <p className="text-slate-500 font-medium mb-2">Inga events hittades.</p>
                            <button onClick={resetFilters} className="text-indigo-600 font-bold hover:underline">Rensa filter</button>
                        </div>
                    ) : view === 'list' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                            {filteredEvents.map(evt => (<div key={evt.id} className="h-full"><EventCard event={evt} /></div>))}
                        </div>
                    ) : (
                        <HomeMap
                            userLocation={userLocation}
                            events={filteredEvents}
                            selectedEvent={selectedEvent}
                            setSelectedEvent={setSelectedEvent}
                            handleMapMove={handleMapMove}
                            handleMapClick={handleMapClick}
                            cycleNextEvent={cycleNextEvent}
                            cyclePrevEvent={cyclePrevEvent}
                        />
                    )}
                </div>
            </div>
        </Layout>
    );
}