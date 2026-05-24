'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { AppEvent, LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import EventCard from '../ui/EventCard';
import LinkEventCard from '../ui/LinkEventCard';

// Leaflet icon fixar
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon.src,
    iconRetinaUrl: markerIcon2x.src,
    shadowUrl: markerShadow.src,
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

// Helper to track map state and trigger fetch
function MapStateTracker({ onMoveEnd }: { onMoveEnd: (center: L.LatLng, zoom: number) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const center = map.getCenter();
            onMoveEnd(center, map.getZoom());
            sessionStorage.setItem('vadkul_map_center', JSON.stringify([center.lat, center.lng]));
            sessionStorage.setItem('vadkul_map_zoom', map.getZoom().toString());
        },
        zoomend: () => {
            // zoomend also triggers moveend usually, but good to be safe if Logic changes
            // onMoveEnd handled by moveend
        }
    });
    return null;
}

interface HomeMapProps {
    userLocation: [number, number];
    events: AppEvent[];
    selectedEvent: AppEvent | null;
    setSelectedEvent: (event: AppEvent | null) => void;
    handleMapMove: (center: L.LatLng, zoom: number) => void;
    handleMapClick: (lat: number, lng: number) => void;
    cycleNextEvent: (e?: React.MouseEvent) => void;
    cyclePrevEvent: (e?: React.MouseEvent) => void;
    isAdmin?: boolean;
}

export default function HomeMap({
    userLocation,
    events,
    selectedEvent,
    setSelectedEvent,
    handleMapMove,
    handleMapClick,
    cycleNextEvent,
    cyclePrevEvent,
    isAdmin = false
}: HomeMapProps) {

    const createCustomIcon = (type: string, isSelected: boolean, isExternal?: boolean) => {
        const category = EVENT_CATEGORIES[type as EventCategoryType] || EVENT_CATEGORIES.other;
        const markerBgColor = isExternal ? 'bg-slate-400 dark:bg-slate-500' : category.markerColor;

        return L.divIcon({
            className: 'custom-marker-teardrop',
            html: `
        <div class="relative group transition-all duration-300 ${isSelected ? 'scale-125 z-50 drop-shadow-2xl -translate-y-3' : 'hover:scale-110 z-10 hover:z-20 hover:-translate-y-1'}">
            <div class="w-12 h-12 ${markerBgColor} border-[3px] border-white shadow-md rounded-full rounded-br-none transform rotate-45 flex items-center justify-center overflow-hidden">
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

    return (
        <div className="relative h-full w-full rounded-2xl overflow-hidden border border-border shadow-inner">
            <MapContainer center={userLocation} zoom={(() => {
                // Initialize zoom from storage (inline since we only need it once)
                const z = sessionStorage.getItem('vadkul_map_zoom');
                return z ? parseInt(z, 10) : 13;
            })()} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapStateTracker onMoveEnd={handleMapMove} />
                <MapController center={userLocation} onClick={handleMapClick} />
                {events.map(evt => {
                    const isSelected = selectedEvent?.id === evt.id;
                    return (
                        <Marker
                            key={evt.id}
                            position={[evt.lat, evt.lng]}
                            icon={createCustomIcon(evt.type, isSelected, (evt as any)._isExternal)}
                            zIndexOffset={isSelected ? 1000 : 0}
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
                <div className="absolute bottom-4 left-4 right-4 z-[1000] animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
                    <div className="relative max-w-sm mx-auto pointer-events-auto">

                        {/* NÄSTA BUTTON (Green) - Above the card */}
                        <div className="flex justify-between items-center w-full mb-3">
                            <button
                                onClick={cyclePrevEvent}
                                className="bg-white/90 backdrop-blur text-slate-700 border border-slate-200 p-2.5 rounded-full shadow-md hover:bg-white hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                                aria-label="Föregående"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <button
                                onClick={cycleNextEvent}
                                className="bg-green-600 text-white font-bold py-2.5 px-6 rounded-full shadow-xl hover:bg-green-500 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-green-500/50"
                            >
                                Nästa <ArrowRight size={18} />
                            </button>
                        </div>

                        <div className="">
                            {(selectedEvent as any)?._isExternal && (selectedEvent as any)?._rawLinkEvent ? (
                                <LinkEventCard
                                    linkEvent={(selectedEvent as any)._rawLinkEvent}
                                    isAdmin={isAdmin}
                                    distance={selectedEvent.location?.distance}
                                />
                            ) : (
                                <EventCard event={selectedEvent} compact={true} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
