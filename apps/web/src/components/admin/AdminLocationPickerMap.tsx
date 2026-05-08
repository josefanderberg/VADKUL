'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet icon fixes for Next.js
if (typeof window !== 'undefined') {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconUrl: '/leaflet/marker-icon.png',
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        shadowUrl: '/leaflet/marker-shadow.png',
    });
}

function MapEvents({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
}

interface AdminLocationPickerMapProps {
    initialLat: number;
    initialLng: number;
    onLocationChange: (lat: number, lng: number) => void;
}

export default function AdminLocationPickerMap({ initialLat, initialLng, onLocationChange }: AdminLocationPickerMapProps) {
    return (
        <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-300">
            <MapContainer
                center={[initialLat, initialLng]}
                zoom={14}
                className="h-full w-full"
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapEvents onLocationSelect={onLocationChange} />
                <MapUpdater center={[initialLat, initialLng]} />
                <Marker position={[initialLat, initialLng]}>
                    <Popup>Aktuell vald plats. Klicka någon annanstans på kartan för att flytta!</Popup>
                </Marker>
            </MapContainer>
        </div>
    );
}
