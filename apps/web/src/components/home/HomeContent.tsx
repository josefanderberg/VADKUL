'use client';

import React, { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

import Layout from '../layout/Layout';
import EventCard from '../ui/EventCard';
import LinkEventCard from '../ui/LinkEventCard';
import EventFilters from './EventFilters';
import WelcomeModal from '../ui/WelcomeModal';

import { eventService } from '../../services/eventService';
import { linkEventService } from '../../services/linkEventService';
import { settingsService } from '../../services/settingsService';
import type { AppEvent, LinkEvent } from '../../types';
import { useAdmin } from '../../context/AdminContext';
import { useAuth } from '../../context/AuthContext';
import { calculateDistance, saveLocationToLocalStorage } from '../../utils/mapUtils';
import { ArrowUpDown, Trophy, Lock } from 'lucide-react';

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
    // 1. Initialisera userLocation från storage eller default 
    // Vi flyttar upp detta för att kunna använda i queryKey
    const [userLocation, setUserLocation] = useState<[number, number]>([56.8556, 14.8250]);

    useEffect(() => {
        const saved = sessionStorage.getItem('vadkul_map_center');
        if (saved) {
            setUserLocation(JSON.parse(saved));
        }
    }, []);

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

    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);

    // Filter states (Avstånd borttaget)
    const [filterType, setFilterType] = useState('all');
    const [filterAge, setFilterAge] = useState('all');
    const [filterFree, setFilterFree] = useState(false);
    const [filterToday, setFilterToday] = useState(false);
    const [sortBy, setSortBy] = useState('soonest'); // Default: närmast
    const [searchQuery, setSearchQuery] = useState(''); // <--- NY: Söksträng
    const [showExternal, setShowExternal] = useState(true); // <--- NY: Visa externa event (default false)

    // 3. TanStack Query
    const { data: events = [], isLoading: loading } = useQuery({
        queryKey: ['events', 'geo', mapState ? mapState.center : userLocation, fetchRadius, searchQuery],
        queryFn: async () => {
            // Om användaren söker (mer än 2 tecken), hämta ALLA events för att tillåta sökning utanför kartan
            if (searchQuery.trim().length > 2) {
                return eventService.getAll();
            }
            // Use mapState center if moved, else initial userLocation
            const center = mapState ? mapState.center : userLocation;
            return eventService.getEventsInBounds(center, fetchRadius);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: (previousData) => previousData, // Keep data while fetching new
    });

    // 4. Fetch Link Events
    const { data: linkEvents = [], isLoading: loadingLinkEvents, refetch: refetchLinkEvents } = useQuery({
        queryKey: ['linkEvents'],
        queryFn: async () => {
            return linkEventService.getAll();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const { isAdmin } = useAdmin();
    const { user } = useAuth();

    const searchParams = useSearchParams();

    // Initialize view from storage or URL param
    const [view, setView] = useState<'list' | 'map'>('list');

    useEffect(() => {
        const viewParam = searchParams.get('view');
        if (viewParam === 'map' || viewParam === 'list') {
            setView(viewParam);
        } else {
            const saved = sessionStorage.getItem('vadkul_home_view') as 'list' | 'map';
            if (saved) setView(saved);
        }
    }, [searchParams]);



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

    // --- LOGIK: Merge events and link events, then filter regular events ---
    const mergedEvents = useMemo(() => {
        // Combine regular events and link events
        // Add a type discriminator to help with rendering
        const regularWithType = events.map(e => ({ ...e, _type: 'regular' as const }));
        const linkWithType = linkEvents.map(e => ({ ...e, _type: 'link' as const }));

        // Merge and sort by time
        const combined = [...regularWithType, ...linkWithType];
        combined.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        return combined;
    }, [events, linkEvents]);

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

        // 2. Mappa och märk vanliga event
        const regularSorted = candidates.map(e => ({ ...e, _isExternal: false as const }));

        // 3. Mappa externa event
        let externalSorted: any[] = [];
        if (showExternal) {
            externalSorted = linkEvents.map(le => {
                const dist = calculateDistance(userLocation[0], userLocation[1], le.lat, le.lng);
                return {
                    id: le.id,
                    title: le.title,
                    description: `Externt event hos ${le.hostName}`,
                    location: { name: le.locationName, distance: dist },
                    lat: le.lat,
                    lng: le.lng,
                    time: le.time,
                    type: le.category || 'other',
                    price: le.price || 0,
                    minParticipants: 0,
                    maxParticipants: 999,
                    minAge: 0,
                    maxAge: 99,
                    ageCategory: 'Alla',
                    host: {
                        uid: '',
                        name: le.hostName,
                        initials: le.hostName.charAt(0).toUpperCase(),
                        verified: false,
                        rating: 5,
                        email: ''
                    },
                    attendees: [],
                    requiresApproval: false,
                    views: 0,
                    _isExternal: true,
                    _rawLinkEvent: le,
                    url: le.url,
                    coverImage: le.coverImage
                } as any;
            }).filter(le => {
                const startOfToday = new Date();
                startOfToday.setHours(0, 0, 0, 0);
                if (new Date(le.time) < startOfToday) return false;
                if (query) {
                    const matchTitle = le.title.toLowerCase().includes(query);
                    const matchLoc = le.location.name.toLowerCase().includes(query);
                    if (!matchTitle && !matchLoc) return false;
                }
                return true;
            });
        }

        // 4. Sorterings-helper
        const sortFn = (a: any, b: any) => {
            switch (sortBy) {
                case 'closest': return (a.location.distance || 0) - (b.location.distance || 0);
                case 'soonest': return new Date(a.time).getTime() - new Date(b.time).getTime();
                case 'latest':
                    if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    return 0;
                case 'popular': return (b.attendees?.length || 0) - (a.attendees?.length || 0);
                default: return 0;
            }
        };

        // Applicera sortering på båda listorna oberoende
        regularSorted.sort(sortFn);
        externalSorted.sort(sortFn);

        // Returnera objekt för att hantera separation.
        return {
            mapCandidates: [...regularSorted, ...externalSorted], // För kartan
            regularEvents: regularSorted,
            externalEvents: externalSorted
        };
    }, [events, linkEvents, userLocation, filterType, filterAge, filterFree, filterToday, sortBy, searchQuery, showExternal, view, user]); // <-- Lade till view och user

    const handleMapClick = (lat: number, lng: number) => {
        if (selectedEvent) setSelectedEvent(null);
        else {
            setUserLocation([lat, lng]);
            saveLocationToLocalStorage(lat, lng);
        }
    };

    const cycleNextEvent = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!selectedEvent || filteredEvents.mapCandidates.length === 0) return;
        const currentIndex = filteredEvents.mapCandidates.findIndex(evt => evt.id === selectedEvent.id);
        const nextIndex = (currentIndex + 1) % filteredEvents.mapCandidates.length;
        setSelectedEvent(filteredEvents.mapCandidates[nextIndex]);
    };

    const cyclePrevEvent = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!selectedEvent || filteredEvents.mapCandidates.length === 0) return;
        const currentIndex = filteredEvents.mapCandidates.findIndex(evt => evt.id === selectedEvent.id);
        // Lägg till length innan modulo för att hantera negativa tal korrekt
        const prevIndex = (currentIndex - 1 + filteredEvents.mapCandidates.length) % filteredEvents.mapCandidates.length;
        setSelectedEvent(filteredEvents.mapCandidates[prevIndex]);
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
            <WelcomeModal onClose={() => setView('map')} />
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
                    availableEvents={events}
                />



                {/* Spacer för att kompensera för fixed filter-bar (ca 70px) */}
                <div className="h-[72px] w-full" />

                {/* HALL OF FAME (Efter spacer, precis över sortering) */}
                {view === 'list' && showHallOfFame && hallOfFameEvent && (
                    <div className="w-full mt-4 mb-0 relative z-20 pointer-events-auto">
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

                {/* Sortering & Toggle Rad */}
                <div className="w-full pt-2 pb-2 z-10 relative">
                    <div className="flex justify-between items-center gap-4">
                        {/* 1. Toggle (Vänster) */}
                        <div className="flex-1">
                            <div
                                id="external-events-toggle"
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-sm rounded-lg shadow-sm border border-border cursor-pointer hover:bg-accent/50 transition-colors pointer-events-auto"
                                onClick={() => {
                                    console.log('TOGGLE: showExternal from', showExternal, 'to', !showExternal);
                                    setShowExternal(!showExternal);
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={showExternal}
                                    onChange={() => { }}
                                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                />
                                <span className="text-xs font-bold text-foreground whitespace-nowrap">Visa externa event</span>
                            </div>
                        </div>

                        {/* 2. Sortering (Höger) */}
                        <div className="flex items-center gap-1 text-muted-foreground bg-background/80 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-border pointer-events-auto">
                            <ArrowUpDown size={14} />
                            <span className="hidden [@media(min-width:450px)]:inline text-xs font-bold uppercase mr-1">Sortera:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-transparent font-bold text-foreground outline-none cursor-pointer text-sm hover:text-primary transition-colors"
                            >
                                <option value="closest">Närmast</option>
                                <option value="soonest">Tid kvar</option>
                                <option value="latest">Senast tillagd</option>
                                <option value="popular">Populärast</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 
            Innehållscontainer 
            Map: Flex-1 för att ta RESTEN av höjden (borde bli exakt rätt).
            List: Min-height för scroll.
        */}
                <div className={`w-full ${view === 'map' ? 'flex-1 h-full min-h-0' : 'min-h-[500px]'}`}>
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 pt-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                            <p>Laddar events...</p>
                        </div>
                    ) : filteredEvents.mapCandidates.length === 0 && view === 'list' ? (
                        <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed border-border">
                            <p className="text-slate-500 font-medium mb-2">Inga events hittades.</p>
                    <button onClick={resetFilters} className="text-indigo-600 font-bold hover:underline">Rensa filter</button>
                        </div>
                    ) : view === 'list' ? (
                        <div className="relative min-h-[500px]">
                            {/* Combined Grid (Regular + External mixed by sorting) */}
                            <div className="grid grid-cols-1 w-full pb-24 relative">
                                {(() => {
                                    const { regularEvents, externalEvents } = filteredEvents;
                                    const totalCount = regularEvents.length + externalEvents.length;
                                    const isLimited = !user && totalCount > 9;

                                    // Limit total items for anonymous users
                                    let regToShow = regularEvents;
                                    let extToShow = externalEvents;
                                    
                                    if (isLimited) {
                                        regToShow = regularEvents.slice(0, 12);
                                        const remainingRoom = Math.max(0, 12 - regToShow.length);
                                        extToShow = externalEvents.slice(0, remainingRoom);
                                    }

                                    return (
                                        <>
                                            {/* Våra egna event */}
                                            {regToShow.map((evt) => (
                                                <div key={evt.id} className="h-full">
                                                    <EventCard event={evt} />
                                                </div>
                                            ))}

                                            {/* Rubrik för externa event */}
                                            {showExternal && extToShow.length > 0 && (
                                                <div className="col-span-full mt-8 mb-4 border-t border-border pt-12">
                                                    <h2 className="text-2xl font-bold text-foreground mb-6 px-2 flex items-center gap-2">
                                                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-600">
                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                                        </svg>
                                                        Externa event
                                                    </h2>
                                                </div>
                                            )}

                                            {/* Externa event */}
                                            {showExternal && extToShow.map((evt) => (
                                                <div key={evt.id} className="h-full">
                                                    <LinkEventCard
                                                        linkEvent={evt._rawLinkEvent}
                                                        distance={evt.location?.distance}
                                                        isAdmin={isAdmin}
                                                        onDelete={() => refetchLinkEvents()}
                                                    />
                                                </div>
                                            ))}

                                            {/* Premium Fade Wall for Anonymous Users */}
                                            {isLimited && (
                                                <div className="absolute inset-x-0 bottom-0 top-[40%] z-[60] flex flex-col items-center justify-end pointer-events-none">
                                                    {/* The Gradient Overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-auto" />
                                                    
                                                    {/* The Login Card */}
                                                    <div className="relative mb-32  w-full max-w-lg pointer-events-auto">
                                                        <div className="bg-background/80 dark:bg-white/5 backdrop-blur-2xl p-10 rounded-[3rem] border border-border dark:border-white/10 shadow-[0_32px_128px_-16px_rgba(0,0,0,0.2)] dark:shadow-[0_32px_128px_-16px_rgba(0,0,0,0.6)] text-center transform transition-all">
                                                            <div className="bg-indigo-600 w-24 h-24 rounded-[2rem] flex items-center justify-center  mb-10 shadow-[0_0_50px_rgba(79,70,229,0.5)]">
                                                                 <Lock className="text-white" size={48} />
                                                            </div>
                                                            <h2 className="text-4xl font-black text-foreground dark:text-white mb-6 tracking-tight">Vad kul! <span className="text-indigo-600 dark:text-indigo-400">Upptäck mer.</span></h2>
                                                            <p className="text-muted-foreground dark:text-gray-200 mb-12 text-xl font-medium leading-relaxed">
                                                                Det här är bara början. Skapa ett gratiskonto för att se alla event och börja hänga!
                                                            </p>
                                                            <button 
                                                                onClick={() => router.push('/login')}
                                                                className="w-full bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-white dark:text-indigo-600 dark:hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] font-black py-6 px-8 rounded-3xl shadow-2xl transition-all text-2xl flex items-center justify-center gap-3"
                                                            >
                                                                Skapa gratiskonto
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : (
                        <HomeMap
                            userLocation={userLocation}
                            events={filteredEvents.mapCandidates}
                            selectedEvent={selectedEvent}
                            setSelectedEvent={setSelectedEvent}
                            handleMapMove={handleMapMove}
                            handleMapClick={handleMapClick}
                            cycleNextEvent={cycleNextEvent}
                            cyclePrevEvent={cyclePrevEvent}
                            isAdmin={isAdmin}
                        />
                    )}
                </div>
            </div>
        </Layout>
    );
}