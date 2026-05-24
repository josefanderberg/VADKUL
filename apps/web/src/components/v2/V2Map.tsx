'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LinkEvent } from '../../types';

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

function MapController({ selectedEvent, cardExpanded }: { selectedEvent: LinkEvent | null; cardExpanded: boolean }) {
    const map = useMap();
    // Kom ihåg vilken zoom användaren hade INNAN expansionen så vi kan zoom:a tillbaka.
    const baseZoomRef = useRef<number | null>(null);

    useEffect(() => {
        if (!selectedEvent || !selectedEvent.lat || !selectedEvent.lng) return;

        const currentZoom = map.getZoom();
        const maxZoom = map.getMaxZoom();

        // När kortet är expanderat → zooma in 1 steg extra. När det kollapsas → tillbaka till basen.
        if (cardExpanded) {
            if (baseZoomRef.current == null) baseZoomRef.current = currentZoom;
        }
        const targetZoom = cardExpanded
            ? Math.min((baseZoomRef.current ?? currentZoom) + 1, maxZoom)
            : (baseZoomRef.current ?? currentZoom);
        if (!cardExpanded) baseZoomRef.current = null;

        const targetLatLng = L.latLng(selectedEvent.lat, selectedEvent.lng);

        // Önskad Y-position för markören på skärmen.
        //   Expanderat kort: 25% från toppen (markören hög upp så kortet inte täcker).
        //   Kollapsat kort:  45% från toppen (lite över mitten).
        const targetYRatio = cardExpanded ? 0.25 : 0.45;

        // Räkna om till en map-center som placerar markören vid targetYRatio,
        // i den zoom-nivå vi siktar på.
        const mapSize = map.getSize();
        const targetPx = map.project(targetLatLng, targetZoom);
        const newCenterPx = L.point(targetPx.x, targetPx.y + mapSize.y * (0.5 - targetYRatio));
        const newCenter = map.unproject(newCenterPx, targetZoom);

        map.flyTo(newCenter, targetZoom, { duration: 1.5 });
    }, [selectedEvent, cardExpanded, map]);

    return null;
}

interface V2MapProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    savedEventIds?: Set<string>;
    discardedEventIds?: Set<string>;
    cardExpanded?: boolean;
}

export default function V2Map({ events, selectedEvent, onSelectEvent, savedEventIds = new Set(), discardedEventIds = new Set(), cardExpanded = false }: V2MapProps) {

    const createCustomIcon = (isSelected: boolean, isSaved: boolean, isDiscarded: boolean) => {
        
        // Sparat event: Vit bakgrund med en vit prick
        // Vanligt event: Slate-bakgrund med vit ram
        const bgClass = isSaved ? 'bg-white border-white' : 'bg-slate-800 border-white';
        const emoji = '🎟️'; // Använd biljett för båda
        
        // Om markerad som avvisad (swipad vänster), gör den semi-transparent och klickbar men diskret
        const opacityClass = isDiscarded ? 'opacity-30 grayscale' : '';

        return L.divIcon({
            className: 'custom-marker-teardrop',
            html: `
        <div class="relative group transition-all duration-300 ${isSelected ? 'scale-125 z-50 drop-shadow-2xl -translate-y-3' : 'hover:scale-110 z-10 hover:z-20 hover:-translate-y-1'} ${opacityClass}">
            <div class="w-12 h-12 ${bgClass} border-[3px] shadow-md rounded-full rounded-br-none transform rotate-45 flex items-center justify-center overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-black/5 to-transparent"></div>
                <div class="transform -rotate-45 text-2xl filter drop-shadow-sm">${emoji}</div>
            </div>
            ${isSaved ? '<div class="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full border border-slate-200 shadow-md animate-pulse"></div>' : ''}
        </div>
      `,
            iconSize: [48, 65],
            iconAnchor: [24, 58],
        });
    };

    // Default to Växjö
    const initialCenter: [number, number] = [56.8777, 14.8091];

    return (
        <div className="absolute inset-0 z-0 bg-slate-100">
            <MapContainer 
                center={initialCenter} 
                zoom={13} 
                style={{ height: '100vh', width: '100vw' }}
                zoomControl={false}
            >
                <TileLayer 
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                
                <MapController selectedEvent={selectedEvent} cardExpanded={cardExpanded} />
                
                <MapEvents onMapClick={() => onSelectEvent(null)} />

                {events.map(evt => {
                    if (!evt.lat || !evt.lng) return null;
                    
                    const isSelected = selectedEvent?.id === evt.id;
                    const isSaved = savedEventIds.has(evt.id);
                    const isDiscarded = discardedEventIds.has(evt.id);
                    
                    return (
                        <Marker
                            key={evt.id}
                            position={[evt.lat, evt.lng]}
                            icon={createCustomIcon(isSelected, isSaved, isDiscarded)}
                            zIndexOffset={isSelected ? 1000 : (isSaved ? 500 : (isDiscarded ? -100 : 0))}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e as any);
                                    onSelectEvent(evt);
                                }
                            }}
                        />
                    );
                })}
            </MapContainer>
        </div>
    );
}

function MapEvents({ onMapClick }: { onMapClick: () => void }) {
    useMapEvents({
        click: () => onMapClick(),
    });
    return null;
}
