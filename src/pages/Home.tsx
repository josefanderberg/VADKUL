import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import Layout from '../components/layout/Layout';
import EventCard from '../components/ui/EventCard';
import { eventService } from '../services/eventService';
import type { AppEvent } from '../types';
import { calculateDistance, getEventEmoji } from '../utils/mapUtils';
import { X, Map as MapIcon, List, Filter, Calendar, DollarSign, RefreshCw, ArrowUpDown } from 'lucide-react';

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

export default function Home() {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [userLocation, setUserLocation] = useState<[number, number]>([56.8790, 14.8059]); // Växjö
  const [selectedEvent, setSelectedEvent] = useState<AppEvent | null>(null);

  // FILTER STATES
  const [filterType, setFilterType] = useState('all');
  const [filterAge, setFilterAge] = useState('all');
  const [filterDistance, setFilterDistance] = useState('10'); // km
  const [filterFree, setFilterFree] = useState(false);
  const [filterToday, setFilterToday] = useState(false);
  const [sortBy, setSortBy] = useState('closest'); // NYTT: State för sortering
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

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

  // --- FILTRERING OCH SORTERINGSLOGIK ---
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
        // 1. Beräkna avstånd
        const dist = calculateDistance(userLocation[0], userLocation[1], event.lat, event.lng);
        event.location.distance = dist; 

        // 2. Filter-checkar
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
        // NYTT: Sorteringsswitch
        switch (sortBy) {
            case 'closest':
                return (a.location.distance || 0) - (b.location.distance || 0);
            case 'soonest': // Tid kvar (Datum stigande)
                return new Date(a.time).getTime() - new Date(b.time).getTime();
            case 'latest': // Senast (Datum fallande)
                return new Date(b.time).getTime() - new Date(a.time).getTime();
            case 'popular': // Flest anmälda (Högst siffra först)
                // OBS: Antar att 'attendees' är en siffra. Om det är en array, använd .length
                return ((b as any).attendees || 0) - ((a as any).attendees || 0);
            default:
                return 0;
        }
    });
  }, [events, userLocation, filterType, filterAge, filterDistance, filterFree, filterToday, sortBy]);


  const createCustomIcon = (type: string, isSelected: boolean) => {
    const emoji = getEventEmoji(type);
    const borderColor = isSelected ? 'border-indigo-600' : 'border-white';
    const containerClasses = isSelected 
      ? 'animate-bounce scale-110 z-50' 
      : 'hover:scale-105 z-10'; 

    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative flex flex-col items-center ${containerClasses} transition-transform duration-300 filter drop-shadow-md">
            <div class="relative z-20 w-8 h-8 rounded-full bg-white border-2 ${borderColor} flex items-center justify-center text-lg">
                ${emoji}
            </div>
            <div class="w-3 h-3 bg-white border-r-2 border-b-2 ${borderColor} transform rotate-45 -mt-2 z-10"></div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 40],
      popupAnchor: [0, -45]
    });
};

  const resetFilters = () => {
      setFilterType('all');
      setFilterAge('all');
      setFilterDistance('10');
      setFilterFree(false);
      setFilterToday(false);
      setSortBy('closest');
  };

  return (
    <Layout>
      {/* FILTER BAR */}
      <div className="sticky z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
            
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar md:pb-0">
                    
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)}
                        className="bg-slate-100 dark:bg-slate-700 border-transparent rounded-xl text-sm p-2 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="all">Alla kategorier</option>
                        <option value="party">Fest 🍻</option>
                        <option value="social">Socialt ☕</option>
                        <option value="sport">Sport ⚽</option>
                        <option value="game">Spel 🎮</option>
                        <option value="food">Mat 🍕</option>
                        <option value="other">Övrigt ✨</option>
                    </select>

                    <button 
                        onClick={() => setFilterToday(!filterToday)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors border-2 shrink-0
                            ${filterToday 
                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                            }`}
                    >
                        <Calendar size={14} /> Idag
                    </button>

                    <button 
                        onClick={() => setFilterFree(!filterFree)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-1 transition-colors border-2 shrink-0
                            ${filterFree 
                                ? 'bg-indigo-600 text-white border-indigo-600' 
                                : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                            }`}
                    >
                        <DollarSign size={14} /> Gratis
                    </button>

                    <button 
                        onClick={() => setShowFiltersMobile(!showFiltersMobile)}
                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 md:hidden"
                    >
                        <Filter size={20} />
                    </button>
                </div>

                <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex shrink-0 ml-2">
                    <button onClick={() => setView('list')} className={`p-2 rounded-md transition-all ${view === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>
                        <List size={20} />
                    </button>
                    <button onClick={() => setView('map')} className={`p-2 rounded-md transition-all ${view === 'map' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>
                        <MapIcon size={20} />
                    </button>
                </div>
            </div>

            {/* EXPANDED FILTERS & SORT */}
            <div className={`flex flex-wrap gap-3 items-center text-sm ${showFiltersMobile ? 'block' : 'hidden md:flex'}`}>
                
                {/* NYTT: Sorteringsdropdown */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-100 dark:border-slate-600">
                    <span className="text-xs font-bold text-slate-400 uppercase px-2 flex items-center gap-1">
                         <ArrowUpDown size={12} /> Sortera
                    </span>
                    <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-transparent font-bold text-slate-700 dark:text-white outline-none pr-2 cursor-pointer"
                    >
                        <option value="closest">Närmast</option>
                        <option value="soonest">Tid kvar</option>
                        <option value="latest">Senast</option>
                        <option value="popular">Anmälda</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-1 rounded-lg">
                    <span className="text-xs font-bold text-slate-400 uppercase px-2">Avstånd</span>
                    <select 
                        value={filterDistance}
                        onChange={(e) => setFilterDistance(e.target.value)}
                        className="bg-transparent font-bold text-slate-700 dark:text-white outline-none"
                    >
                        <option value="1">1 km</option>
                        <option value="5">5 km</option>
                        <option value="10">10 km</option>
                        <option value="25">25 km</option>
                        <option value="all">Alla</option>
                    </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-1 rounded-lg">
                    <span className="text-xs font-bold text-slate-400 uppercase px-2">Ålder</span>
                    <select 
                        value={filterAge}
                        onChange={(e) => setFilterAge(e.target.value)}
                        className="bg-transparent font-bold text-slate-700 dark:text-white outline-none"
                    >
                        <option value="all">Alla</option>
                        <option value="family">Familj (0-12)</option>
                        <option value="18+">Vuxna (18+)</option>
                        <option value="seniors">Seniorer (65+)</option>
                    </select>
                </div>
                
                {(filterType !== 'all' || filterFree || filterToday || filterDistance !== '10' || sortBy !== 'closest') && (
                    <button onClick={resetFilters} className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 ml-auto">
                        <RefreshCw size={12} /> Rensa
                    </button>
                )}
            </div>

        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 h-[calc(100vh-140px)]">
        {loading ? (
            <div className="text-center py-20 text-slate-500">Laddar events...</div>
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
                    {filteredEvents.map(evt => {
                        const isSelected = selectedEvent?.id === evt.id;
                        return (
                            <Marker 
                                key={evt.id} 
                                position={[evt.lat, evt.lng]}
                                icon={createCustomIcon(evt.type, isSelected)}
                                eventHandlers={{ 
                                    click: () => setSelectedEvent(evt) 
                                }}
                            />
                        );
                    })}
                    <Marker position={userLocation} icon={L.divIcon({
                        className: 'user-pos',
                        html: '<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow pulse-ring"></div>'
                    })} />
                </MapContainer>
                {selectedEvent && (
                    <div className="absolute bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 fade-in duration-300">
                        <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-600 max-w-md mx-auto">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedEvent(null); }}
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