// src/pages/Home.tsx

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet'; 
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import Layout from '../components/layout/Layout';
import EventCard from '../components/ui/EventCard';
import { eventService } from '../services/eventService';
import type { AppEvent } from '../types';
import { calculateDistance, saveLocationToLocalStorage } from '../utils/mapUtils'; 
import { EVENT_CATEGORIES, CATEGORY_LIST, type EventCategoryType } from '../utils/categories'; 
import { X, Map as MapIcon, List, Filter, Calendar, RefreshCw, ArrowUpDown } from 'lucide-react';

// --- LEAFLET FIX ---
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

function MapReCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Lyssna på klick på kartan
function MapClickListener({ onLocationSet }: { onLocationSet: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onLocationSet(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}


export default function Home() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = useState<[number, number]>([56.8556, 14.8250]);
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);

  // FILTER STATES
  const [filterType, setFilterType] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [filterDistance, setFilterDistance] = useState('1');
  const [filterFree, setFilterFree] = useState(false);
  const [filterToday, setFilterToday] = useState(false);
  const [sortBy, setSortBy] = useState('closest');
  
  // State för att visa de "extra" filtren (Ålder/Avstånd)
  const [showExtraFilters, setShowExtraFilters] = useState(false);

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

  // --- FILTRERING OCH SORTERING ---
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
        const dist = calculateDistance(userLocation[0], userLocation[1], event.lat, event.lng);
        event.location.distance = dist; 

        if (filterType !== 'all' && event.type !== filterType) return false;
        if (filterAge === 'family' && event.minAge >= 12) return false;
        if (filterAge === '18+' && event.minAge < 18) return false;
        if (filterAge === 'seniors' && event.minAge < 65) return false;
        if (filterDistance !== 'all' && dist > parseInt(filterDistance)) return false;
        if (filterFree && event.price > 0) return false;
        if (filterToday) {
            const today = new Date().toDateString();
            if (new Date(event.time).toDateString() !== today) return false;
        }

        return true;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'closest':
                return (a.location.distance || 0) - (b.location.distance || 0);
            case 'soonest':
                return new Date(a.time).getTime() - new Date(b.time).getTime();
            case 'latest':
                return new Date(b.time).getTime() - new Date(a.time).getTime();
            case 'popular':
                return (b.attendees?.length || 0) - (a.attendees?.length || 0);
            default:
                return 0;
        }
    });
  }, [events, userLocation, filterType, filterAge, filterDistance, filterFree, filterToday, sortBy]);


  // --- SKAPA IKONER FÖR KARTAN ---
  const createCustomIcon = (type: string, isSelected: boolean) => {
    const category = EVENT_CATEGORIES[type as EventCategoryType] || EVENT_CATEGORIES.other;
    const emoji = category.emoji;
    const bgClass = category.markerColor;

    const containerClasses = isSelected 
      ? 'scale-125 z-50 drop-shadow-2xl -translate-y-3' 
      : 'hover:scale-110 z-10 hover:z-20 hover:-translate-y-1';

    return L.divIcon({
      className: 'custom-marker-teardrop', 
      html: `
        <div class="relative group transition-all duration-300 ${containerClasses}">
            <div class="w-12 h-12 ${bgClass} border-[3px] border-white shadow-md rounded-full rounded-br-none transform rotate-45 flex items-center justify-center overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>
                <div class="transform -rotate-45 text-2xl filter drop-shadow-sm">
                    ${emoji}
                </div>
            </div>
            <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 blur-[3px] rounded-full transition-all duration-300 group-hover:w-6 group-hover:opacity-50"></div>
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
      setFilterDistance('1');
      setFilterFree(false);
      setFilterToday(false);
      setSortBy('closest');
  };

  const selectedCategory = EVENT_CATEGORIES[filterType as EventCategoryType] || null;
  const categoryColorClass = selectedCategory 
    ? selectedCategory.color 
    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white';


    return (
        <Layout>
          {/* --- TOP STICKY MENU --- */}
          <div className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm transition-all">
            <div className="max-w-6xl mx-auto flex flex-col gap-3">
                
                {/* RAD 1: Kategori + List/Map Toggle */}
                <div className="flex justify-between items-center w-full">
                    {/* KATEGORI SELECT (Full bredd på mobil för tydlighet, eller flex-grow) */}
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)}
                        className={`flex-grow md:flex-grow-0 md:w-64 font-bold rounded-xl text-sm p-3 outline-none cursor-pointer border-2 border-transparent transition-colors mr-3 ${categoryColorClass}`}
                    >
                        <option value="all" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Alla kategorier</option>
                        {CATEGORY_LIST.map(cat => (
                            <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                {cat.label} {cat.emoji}
                            </option>
                        ))}
                    </select>

                    {/* LIST / MAP TOGGLE */}
                    <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex shrink-0">
                        <button onClick={() => setView('list')} className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}>
                            <List size={20} />
                        </button>
                        <button onClick={() => setView('map')} className={`p-2 rounded-md transition-all ${view === 'map' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}>
                            <MapIcon size={20} />
                        </button>
                    </div>
                </div>

                {/* RAD 2: Snabbval + Filterknapp */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        <button 
                            onClick={() => setFilterToday(!filterToday)}
                            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 transition-colors border-2 shrink-0
                                ${filterToday 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-200'
                                }`}
                        >
                            <Calendar size={14} /> Idag
                        </button>

                        <button 
                            onClick={() => setFilterFree(!filterFree)}
                            className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 transition-colors border-2 shrink-0
                                ${filterFree 
                                    ? 'bg-indigo-600 text-white border-indigo-600' 
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-indigo-200'
                                }`}
                        >
                            Gratis
                        </button>

                        {/* Knapp för att visa fler filter (Avstånd, Ålder) */}
                        <button 
                            onClick={() => setShowExtraFilters(!showExtraFilters)}
                            className={`px-3 py-2 rounded-full text-sm font-bold flex items-center gap-1 transition-colors border-2 shrink-0
                                ${showExtraFilters
                                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white border-slate-200'
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-100'
                                }`}
                        >
                            <Filter size={16} /> Fler filter
                        </button>
                    </div>

                    {(filterType !== 'all' || filterFree || filterToday || filterDistance !== '1' || filterAge !== 'all') && (
                        <button onClick={resetFilters} className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 shrink-0 ml-2">
                            <RefreshCw size={12} />
                        </button>
                    )}
                </div>
    
                {/* EXTRA FILTER (Avstånd & Ålder) - Visas bara om man klickar på "Fler filter" */}
                {showExtraFilters && (
                    <div className="flex gap-3 items-center text-sm flex-wrap animate-in fade-in slide-in-from-top-2 pt-1 border-t border-slate-100 dark:border-slate-700 mt-1">
                        
                        {/* AVSTÅND SELECT */}
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-100 dark:border-slate-600">
                            <span className="text-xs font-bold text-slate-400 uppercase px-1">Avstånd</span>
                            <select 
                                value={filterDistance}
                                onChange={(e) => setFilterDistance(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-sm"
                            >
                                <option value="1">1 km</option>
                                <option value="5">5 km</option>
                                <option value="10">10 km</option>
                                <option value="25">25 km</option>
                                <option value="all">Alla</option>
                            </select>
                        </div>
        
                        {/* ÅLDER SELECT */}
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-100 dark:border-slate-600">
                            <span className="text-xs font-bold text-slate-400 uppercase px-1">Ålder</span>
                            <select 
                                value={filterAge}
                                onChange={(e) => setFilterAge(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-sm"
                            >
                                <option value="all">Alla</option>
                                <option value="family">Familj</option>
                                <option value="13+">Ungdomar</option>
                                <option value="18+">Vuxna</option>
                                <option value="seniors">Seniorer</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>
          </div>

          {/* --- SORTERING (Utanför menyn) --- */}
          <div className="max-w-6xl mx-auto px-4 pt-4 flex justify-end">
             <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <ArrowUpDown size={14} />
                <span className="text-xs font-bold uppercase mr-1">Sortera:</span>
                <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent font-bold text-slate-700 dark:text-white outline-none cursor-pointer text-sm hover:text-indigo-600 transition-colors"
                >
                    <option value="closest">Närmast</option>
                    <option value="soonest">Tid kvar</option>
                    <option value="latest">Senast tillagd</option>
                    <option value="popular">Populärast</option>
                </select>
             </div>
          </div>

      {/* --- CONTENT --- */}
      <div className="max-w-6xl mx-auto p-4 h-[calc(100vh-180px)]">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p>Laddar events...</p>
            </div>
        ) : filteredEvents.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-slate-500 font-medium mb-2">Inga events matchar dina filter.</p>
                <button onClick={resetFilters} className="text-indigo-600 font-bold hover:underline">Rensa filter</button>
            </div>
        ) : view === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20 animate-in fade-in duration-500">
                {filteredEvents.map(evt => (
                    <div key={evt.id} className="h-full">
                        <EventCard event={evt} />
                    </div>
                ))}
            </div>
        ) : (
            <div className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-700 shadow-inner">
                <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapReCenter center={userLocation} />
                    
                    {/* --- Klicka för att spara plats --- */}
                    <MapClickListener onLocationSet={(lat, lng) => {
                        setUserLocation([lat, lng]);
                        saveLocationToLocalStorage(lat, lng); 
                    }} />                    
                    
                    {/* Event Markers */}
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

                    {/* ANVÄNDARPOSITION */}
                    <Marker 
                        position={userLocation} 
                        icon={L.divIcon({
                            className: 'user-pos',
                            html: '<div class="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-xl pulse-ring cursor-pointer"></div>' 
                        })} 
                    >
                         <Popup>Din plats (Klicka på kartan för att flytta)</Popup>
                    </Marker>
                </MapContainer>

                {selectedEvent && (
                    <div className="absolute bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-md mx-auto">
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSelectedEvent(null); 
                                }}
                                className="absolute -top-3 -right-3 bg-slate-800 text-white p-1.5 rounded-full shadow-md hover:bg-slate-700 transition-colors z-50"
                            >
                                <X size={16} />
                            </button>
                            <div className="max-h-[300px] overflow-y-auto">
                                <EventCard event={selectedEvent} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </Layout>
  );
}