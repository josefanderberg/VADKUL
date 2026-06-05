'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';

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

        map.setView(newCenter, targetZoom, { animate: true, duration: 0.5 } as any);
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
    onCenterChange?: (lat: number, lng: number) => void;
}

// ─── Needle icon (används bara under zoom-övergången) ───────────────────────
const needleCache = new Map<string, L.DivIcon>();

function createNeedleIcon(isSelected: boolean, isSaved: boolean, isDiscarded: boolean, count: number = 1): L.DivIcon {
    const key = `${isSelected}:${isSaved}:${isDiscarded}:${count}`;
    const cached = needleCache.get(key);
    if (cached) return cached;

    const dotColor = isSelected ? '#006AA7' : isSaved ? '#5BA3CC' : '#1e293b';
    const lineColor = isSelected ? '#006AA7' : isSaved ? '#5BA3CC' : '#475569';
    const dotSize = isSelected ? 10 : isSaved ? 8 : 7;
    const lineH = isSelected ? 28 : 22;
    const opacity = isDiscarded ? '0.3' : '1';

    const badgeHtml = count > 1
        ? `<div style="position:absolute;top:-6px;left:50%;transform:translateX(-50%);min-width:14px;height:14px;padding:0 2px;background:#006AA7;color:#fff;font-size:8px;font-weight:700;border-radius:999px;border:1.5px solid #fff;display:flex;align-items:center;justify-content:center;line-height:1;box-sizing:border-box;">${count > 99 ? '99+' : count}</div>`
        : '';

    const icon = L.divIcon({
        className: 'custom-marker-needle',
        html: `
        <div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity};">
            <div style="position:relative;">
                <div style="width:${dotSize}px;height:${dotSize}px;border-radius:50%;background:${dotColor};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>
                ${badgeHtml}
            </div>
            <div style="width:2px;height:${lineH}px;background:${lineColor};border-radius:1px;opacity:0.8;"></div>
        </div>`,
        iconSize: [dotSize, dotSize + lineH],
        iconAnchor: [Math.ceil(dotSize / 2), dotSize + lineH],
    });

    needleCache.set(key, icon);
    return icon;
}

// ─── Full pin-ikon (standard-utseende med emoji) ─────────────────────────────
const pinCache = new Map<string, L.DivIcon>();

function createPinIcon(isSelected: boolean, isSaved: boolean, isDiscarded: boolean, count: number = 1, category?: EventCategoryType): L.DivIcon {
    const cacheKey = `${isSelected}:${isSaved}:${isDiscarded}:${count}:${category ?? 'other'}`;
    const cached = pinCache.get(cacheKey);
    if (cached) return cached;

    const pinBg = isSaved ? '#ffffff' : '#1e293b';
    const pinBorder = isSelected
        ? '3px solid #006AA7'
        : isSaved
        ? '2px solid #5BA3CC'
        : '2px solid rgba(255,255,255,0.25)';

    const shadowFilter = isSelected
        ? 'drop-shadow(0 6px 24px rgba(0,0,0,0.35)) drop-shadow(0 2px 6px rgba(0,0,0,0.2))'
        : isSaved
        ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))'
        : 'drop-shadow(0 4px 12px rgba(0,0,0,0.18)) drop-shadow(0 1px 3px rgba(0,0,0,0.08))';

    const scaleStyle = isSelected ? 'transform: scale(1.25) translateY(-10px);' : '';
    const opacityStyle = isDiscarded ? 'opacity: 0.25; filter: grayscale(1);' : '';

    const catKey = category && EVENT_CATEGORIES[category] ? category : 'other';
    const emoji = EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫';

    const countBadge = count > 1
        ? `<div style="position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 4px;background:#006AA7;color:#fff;font-size:10px;font-weight:700;border-radius:999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;line-height:1;">${count > 99 ? '99+' : count}</div>`
        : (isSaved ? '<div style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#5BA3CC;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.15);"></div>' : '');

    const icon = L.divIcon({
        className: 'custom-marker-pin',
        html: `
        <div style="position:relative;transition:transform 0.2s;${scaleStyle}${opacityStyle}filter:${shadowFilter};">
            <div style="width:44px;height:44px;background:${pinBg};border:${pinBorder};border-radius:50% 50% 0 50%;transform:rotate(45deg);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
                <div style="transform:rotate(-45deg);font-size:22px;line-height:1;position:relative;z-index:1;">${emoji}</div>
            </div>
            ${countBadge}
        </div>`,
        iconSize: [44, 60],
        iconAnchor: [22, 55],
    });

    pinCache.set(cacheKey, icon);
    return icon;
}

export default function V2Map({ events, selectedEvent, onSelectEvent, savedEventIds = new Set(), discardedEventIds = new Set(), cardExpanded = false, onCenterChange }: V2MapProps) {

    // isZooming byts under zoom-övergången → nål-ikoner används istället för de tunga pin-ikonerna.
    const [isZooming, setIsZooming] = useState(false);

    // Gruppera events som ligger på (nästan) samma koord. ~11m precision (4 decimaler).
    const groups = useMemo(() => {
        const map = new Map<string, LinkEvent[]>();
        for (const evt of events) {
            if (!evt.lat || !evt.lng) continue;
            const key = `${evt.lat.toFixed(4)},${evt.lng.toFixed(4)}`;
            const bucket = map.get(key);
            if (bucket) bucket.push(evt); else map.set(key, [evt]);
        }
        return map;
    }, [events]);

    const onZoomStart = useCallback(() => setIsZooming(true), []);
    const onZoomEnd = useCallback(() => setIsZooming(false), []);

    // Default to Växjö
    const initialCenter: [number, number] = [56.8777, 14.8091];

    return (
        <div className="absolute inset-0 z-0 bg-slate-100">
            <MapContainer
                center={initialCenter}
                zoom={8}
                style={{ height: '100vh', width: '100vw' }}
                zoomControl={false}
            >
                <TileLayer 
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                
                <MapController selectedEvent={selectedEvent} cardExpanded={cardExpanded} />

                <MapEvents
                    onMapClick={() => onSelectEvent(null)}
                    onCenterChange={onCenterChange}
                    onZoomStart={onZoomStart}
                    onZoomEnd={onZoomEnd}
                />

                {Array.from(groups.values()).map(group => {
                    const count = group.length;
                    // Välj ett representativt event för markörens läge/klick:
                    // 1) det valda (om i gruppen), annars
                    // 2) första icke-discardade, annars
                    // 3) första.
                    const inGroupSelected = group.find(e => e.id === selectedEvent?.id);
                    const firstNonDiscarded = group.find(e => !discardedEventIds.has(e.id));
                    const rep = inGroupSelected || firstNonDiscarded || group[0];

                    const isSelected = !!inGroupSelected;
                    const isSaved = group.some(e => savedEventIds.has(e.id));
                    const isDiscarded = group.every(e => discardedEventIds.has(e.id));

                    const icon = isZooming
                        ? createNeedleIcon(isSelected, isSaved, isDiscarded, count)
                        : createPinIcon(isSelected, isSaved, isDiscarded, count, rep.category);

                    return (
                        <Marker
                            key={rep.id}
                            position={[rep.lat!, rep.lng!]}
                            icon={icon}
                            zIndexOffset={isSelected ? 1000 : (isSaved ? 500 : (isDiscarded ? -100 : 0))}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e as any);
                                    onSelectEvent(rep);
                                }
                            }}
                        />
                    );
                })}
            </MapContainer>
        </div>
    );
}

function MapEvents({
    onMapClick,
    onCenterChange,
    onZoomStart,
    onZoomEnd,
}: {
    onMapClick: () => void;
    onCenterChange?: (lat: number, lng: number) => void;
    onZoomStart: () => void;
    onZoomEnd: () => void;
}) {
    const map = useMapEvents({
        click: () => onMapClick(),
        // moveend fires once when panning stops — not 60×/sec like 'move'.
        // mapCenter is only needed for event placement (creationMode), so this is fine.
        moveend: () => {
            if (!onCenterChange) return;
            const c = map.getCenter();
            onCenterChange(c.lat, c.lng);
        },
        zoomstart: () => onZoomStart(),
        zoomend: () => onZoomEnd(),
    });
    // Rapportera initialt center direkt så parent har en lat/lng även innan första rörelsen.
    useEffect(() => {
        if (!onCenterChange) return;
        const c = map.getCenter();
        onCenterChange(c.lat, c.lng);
    }, [map, onCenterChange]);
    return null;
}
