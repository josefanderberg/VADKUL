'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import LinkEventCard from '../ui/LinkEventCard';

if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconUrl: '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl: '/leaflet/marker-shadow.png',
    });
}

function MapClickClose({ onClose }: { onClose: () => void }) {
    useMapEvents({ click: () => onClose() });
    return null;
}

function createIcon(categoryType: string, isSelected: boolean) {
    const category = EVENT_CATEGORIES[categoryType as EventCategoryType] || EVENT_CATEGORIES.other;
    const size = isSelected ? 52 : 40;
    const border = isSelected ? 4 : 3;
    const shadow = isSelected ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
    const markerColor = category.markerColor || 'bg-slate-400';

    return L.divIcon({
        className: '',
        html: `
            <div style="filter: ${shadow}; transform: ${isSelected ? 'translateY(-6px)' : 'none'}; transition: all 0.2s;">
                <div class="flex items-center justify-center ${markerColor} border-white rounded-full rounded-br-none rotate-45"
                    style="width:${size}px; height:${size}px; border-width:${border}px; border-style:solid;">
                    <span style="transform:rotate(-45deg); font-size:${isSelected ? 22 : 18}px;">${category.emoji}</span>
                </div>
            </div>
        `,
        iconSize: [size, size + 12],
        iconAnchor: [size / 2, size + 10],
        popupAnchor: [0, -(size + 10)],
    });
}

interface AdminLinkEventsMapProps {
    linkEvents: LinkEvent[];
    onDeleteEvent?: () => void;
}

export default function AdminLinkEventsMap({ linkEvents, onDeleteEvent }: AdminLinkEventsMapProps) {
    const [selectedEvent, setSelectedEvent] = useState<LinkEvent | null>(null);

    const validEvents = linkEvents.filter(e => e.lat && e.lng && !isNaN(e.lat) && !isNaN(e.lng));

    // Center on Växjö centrum
    const center: [number, number] = [56.8796, 14.8094];

    return (
        <div className="relative h-[500px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapClickClose onClose={() => setSelectedEvent(null)} />
                {validEvents.map((event) => (
                    <Marker
                        key={event.id}
                        position={[event.lat, event.lng]}
                        icon={createIcon(event.category || 'other', selectedEvent?.id === event.id)}
                        eventHandlers={{
                            click: (e) => {
                                e.originalEvent.stopPropagation();
                                setSelectedEvent(prev => prev?.id === event.id ? null : event);
                            }
                        }}
                        zIndexOffset={selectedEvent?.id === event.id ? 1000 : 0}
                    />
                ))}
            </MapContainer>

            {/* Stats overlay */}
            <div className="absolute top-3 left-3 z-[1000] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shadow border border-slate-200 dark:border-slate-600">
                {validEvents.length} event på kartan
                {validEvents.length < linkEvents.length && (
                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                        ({linkEvents.length - validEvents.length} saknar koordinater)
                    </span>
                )}
            </div>

            {/* Selected Event Card */}
            {selectedEvent && (
                <div
                    className="absolute bottom-4 left-4 right-4 z-[1000] max-w-sm mx-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="relative shadow-2xl">
                        <button
                            onClick={() => setSelectedEvent(null)}
                            className="absolute -top-2.5 -right-2.5 z-10 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center text-sm font-bold leading-none hover:bg-red-600 transition"
                        >
                            ×
                        </button>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mb-1 pl-1">
                            📍 {selectedEvent.lat.toFixed(5)}, {selectedEvent.lng.toFixed(5)}
                        </div>
                        <LinkEventCard
                            linkEvent={selectedEvent}
                            isAdmin={true}
                            onDelete={() => {
                                setSelectedEvent(null);
                                if (onDeleteEvent) onDeleteEvent();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
