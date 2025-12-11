// src/pages/Home.tsx


import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import Layout from '../components/layout/Layout';
import EventCard from '../components/ui/EventCard';
import EventFilters from '../components/home/EventFilters';
import WelcomeModal from '../components/ui/WelcomeModal';

import { eventService } from '../services/eventService';
import type { AppEvent } from '../types';
import { calculateDistance, saveLocationToLocalStorage } from '../utils/mapUtils';
import { EVENT_CATEGORIES, type EventCategoryType } from '../utils/categories';
import { ArrowUpDown, ArrowRight } from 'lucide-react';

// Leaflet icon fixar
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

function MapController({ center, onClick }: { center: [number, number], onClick: (lat: number, lng: number) => void }) {
    const map = useMap();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        if (center) {
            if (isFirstLoad.current) {
                map.setView(center, map.getZoom());
                isFirstLoad.current = false;
            } else {
                map.flyTo(center, map.getZoom(), { duration: 1.5 });
            }
        }
    }, [center, map]);

    useMapEvents({
        click: (e) => onClick(e.latlng.lat, e.latlng.lng)
    });
    return null;
}

export default function Home() {
    const [events, setEvents] = useState<AppEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'map'>('list');
    const [userLocation, setUserLocation] = useState<[number, number]>([56.8556, 14.8250]);
    const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);

    // Filter states (Avstånd borttaget)
    const [filterType, setFilterType] = useState('all');
    const [filterAge, setFilterAge] = useState('all');
    const [filterFree, setFilterFree] = useState(false);
    const [filterToday, setFilterToday] = useState(false);
    const [sortBy, setSortBy] = useState('closest'); // Default: närmast
    const [searchQuery, setSearchQuery] = useState(''); // <--- NY: Söksträng




    // --- Hantera scroll på containern för att gömma/visa menyn (REMOVED LOGIC) ---
    // User wants manual control, so we keep this empty or remove if fully unused.
    // Keeping handleContainerScroll as empty to avoid extensive rewrite if container uses it,
    // but better to remove usages.


    useEffect(() => {
        loadData();
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
            });
        }
    }, []);

    async function loadData() {
        setLoading(true);
        const data = await eventService.getAll();
        setEvents(data);
        setLoading(false);
    }

    // --- LOGIK: Filtrera -> Sortera på avstånd -> Ta topp 30 -> Sortera på användarens val ---
    const filteredEvents = useMemo(() => {
        const now = new Date(); // Skapa datumet en gång innan loopen
        const query = searchQuery.toLowerCase().trim();

        // 1. Grundläggande filtrering
        let candidates = events.filter(event => {
            const dist = calculateDistance(userLocation[0], userLocation[1], event.lat, event.lng);
            event.location.distance = dist; // Spara avståndet på objektet

            // Filtrera bort gamla events (starttid har passerat)
            if (new Date(event.time) < now) return false;

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
                if (event.minAge >= 18) return false; // För gamla
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

    const createCustomIcon = (type: string, isSelected: boolean) => {
        const category = EVENT_CATEGORIES[type as EventCategoryType] || EVENT_CATEGORIES.other;
        return L.divIcon({
            className: 'custom-marker-teardrop',
            html: `
        <div class="relative group transition-all duration-300 ${isSelected ? 'scale-125 z-50 drop-shadow-2xl -translate-y-3' : 'hover:scale-110 z-10 hover:z-20 hover:-translate-y-1'}">
            <div class="w-12 h-12 ${category.markerColor} border-[3px] border-white shadow-md rounded-full rounded-br-none transform rotate-45 flex items-center justify-center overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>
                <div class="transform -rotate-45 text-2xl filter drop-shadow-sm">${category.emoji}</div>
            </div>
        </div>
      `,
            iconSize: [48, 65],
            iconAnchor: [24, 58],
            popupAnchor: [0, -50]
        });
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
                className={`h-[calc(100vh-64px)] relative w-full ${view === 'map' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}
            >
                {/* Filters är numera sticky internt, så ingen wrapper behövs */}
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

                {/* Sortering - Också flex-shrink-0 för att inte tryckas ihop */}
                <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 flex justify-end flex-shrink-0 w-full z-10 relative pointer-events-none">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-slate-100 dark:border-slate-700">
                        <ArrowUpDown size={14} />
                        <span className="text-xs font-bold uppercase mr-1">Sortera (topp 30):</span>
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-sm hover:text-indigo-600 transition-colors">
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
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p>Laddar events...</p>
                        </div>
                    ) : filteredEvents.length === 0 && view === 'list' ? (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            <p className="text-slate-500 font-medium mb-2">Inga events hittades.</p>
                            <button onClick={resetFilters} className="text-indigo-600 font-bold hover:underline">Rensa filter</button>
                        </div>
                    ) : view === 'list' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 animate-in fade-in duration-500">
                            {filteredEvents.map(evt => (<div key={evt.id} className="h-full"><EventCard event={evt} /></div>))}
                        </div>
                    ) : (
                        <div className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-inner">


                            <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                <MapController center={userLocation} onClick={handleMapClick} />
                                {filteredEvents.map(evt => {
                                    const isSelected = selectedEvent?.id === evt.id;
                                    return (
                                        <Marker
                                            key={evt.id}
                                            position={[evt.lat, evt.lng]}
                                            icon={createCustomIcon(evt.type, isSelected)}
                                            eventHandlers={{
                                                click: (e) => {
                                                    L.DomEvent.stopPropagation(e as any);
                                                    setSelectedEvent(evt);
                                                }
                                            }}
                                        />
                                    );
                                })}
                                <Marker position={userLocation} icon={L.divIcon({ className: 'user-pos', html: '<div class="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-xl pulse-ring cursor-pointer"></div>' })} >
                                    <Popup>Din sökposition</Popup>
                                </Marker>
                            </MapContainer>

                            {selectedEvent && (
                                <div className="absolute bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 fade-in duration-300">
                                    <div className="relative max-w-sm mx-auto">
                                        <button onClick={cycleNextEvent} className="absolute -top-3 -left-3 bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 active:scale-95 transition-all z-50 flex items-center justify-center">
                                            <ArrowRight size={18} />
                                        </button>
                                        <div className="">
                                            <EventCard event={selectedEvent} compact={true} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}