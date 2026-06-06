'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import CloudPopup from '../ui/CloudPopup';

interface V2MapProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    savedEventIds?: Set<string>;
    discardedEventIds?: Set<string>;
    cardExpanded?: boolean;
    onCenterChange?: (lat: number, lng: number) => void;
    onMapDrag?: () => void;
}

export default function V2Map({
    events,
    selectedEvent,
    onSelectEvent,
    savedEventIds = new Set(),
    discardedEventIds = new Set(),
    cardExpanded = false,
    onCenterChange,
    onMapDrag
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string }>>(new Map());

    const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);

    // Spara undan callbacks i refs så map-event-handlers inte ständigt behöver bindas om
    const onSelectEventRef = useRef(onSelectEvent);
    onSelectEventRef.current = onSelectEvent;

    const onCenterChangeRef = useRef(onCenterChange);
    onCenterChangeRef.current = onCenterChange;

    const onMapDragRef = useRef(onMapDrag);
    onMapDragRef.current = onMapDrag;

    // Cloud popup geographic map anchor state and projection variables
    // Solves request: anchor cloud to a position on map, move with map
    const [cloudAnchor, setCloudAnchor] = useState<{ lat: number; lng: number }>({ lat: 56.8777, lng: 14.8091 });
    const [cloudAnchorPos, setCloudAnchorPos] = useState<{ x: number; y: number } | null>(null);
    const [showCloud, setShowCloud] = useState(true);

    const cloudAnchorRef = useRef(cloudAnchor);
    cloudAnchorRef.current = cloudAnchor;

    const cloudAnchorPosRef = useRef(cloudAnchorPos);
    cloudAnchorPosRef.current = cloudAnchorPos;

    const baseZoomRef = useRef<number>(8);

    // Ticking counter used to cycle through events at the same coordinate.
    // Increments once per second; markers with count > 1 swap their displayed
    // event (emoji + click target) each tick like a slideshow.
    const [slideshowTick, setSlideshowTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setSlideshowTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

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

    // Filtrera grupper så vi bara renderar markörer som faktiskt är inom skärmen (+ 20% marginal), men visa ALLTID det valda eventet direkt
    const visibleGroups = useMemo(() => {
        if (!mapBounds) return [];

        const lngSpan = mapBounds.getEast() - mapBounds.getWest();
        const latSpan = mapBounds.getNorth() - mapBounds.getSouth();
        const paddedBounds = new maplibregl.LngLatBounds(
            [mapBounds.getWest() - lngSpan * 0.2, mapBounds.getSouth() - latSpan * 0.2],
            [mapBounds.getEast() + lngSpan * 0.2, mapBounds.getNorth() + latSpan * 0.2]
        );

        return Array.from(groups.entries()).filter(([_, group]) => {
            // Visa alltid det valda eventet omedelbart, även om det råkar ligga utanför skärmens gränser just nu
            const containsSelected = group.some(e => e.id === selectedEvent?.id);
            if (containsSelected) return true;

            const rep = group[0];
            if (!rep.lng || !rep.lat) return false;
            return paddedBounds.contains([rep.lng, rep.lat]);
        });
    }, [groups, mapBounds, selectedEvent]);

    // 1. Initiera MapLibre kartan en gång
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: [14.8091, 56.8777], // Lng, Lat (Växjö)
            zoom: 8
        });

        mapRef.current = map;

        // Lägg till zoom/pan klasshantering för att växla mellan brickor och nålar
        const container = mapContainerRef.current;
        const showNeedles = () => {
            container.classList.remove('map-state-full');
            container.classList.add('map-state-needle');
        };
        const showBricks = () => {
            container.classList.remove('map-state-needle');
            container.classList.add('map-state-full');
        };

        map.on('zoomstart', showNeedles);
        map.on('zoomend', showBricks);

        map.on('click', () => {
            onSelectEventRef.current(null);
        });

        map.on('drag', () => {
            if (onMapDragRef.current) {
                onMapDragRef.current();
            }
        });

        // Real-time projection updater for the anchored cloud popup
        const updateCloudPosition = () => {
            const currentAnchor = cloudAnchorRef.current;
            if (currentAnchor) {
                const pos = map.project([currentAnchor.lng, currentAnchor.lat]);
                setCloudAnchorPos({ x: pos.x, y: pos.y });
            }
        };

        map.on('move', updateCloudPosition);
        map.on('zoom', updateCloudPosition);

        // Uppdatera synliga bounds och anropa callback när rörelsen stannat
        const handleMoveEnd = () => {
            setMapBounds(map.getBounds());
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
        };

        map.on('moveend', handleMoveEnd);

        // Rapportera initialt läge
        map.once('load', () => {
            setMapBounds(map.getBounds());
            updateCloudPosition();
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // 2. Hantera kamera-panorering och zoomning vid val av event
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (!selectedEvent || !selectedEvent.lat || !selectedEvent.lng) return;

        const currentZoom = map.getZoom();
        const maxZoom = map.getMaxZoom();

        if (cardExpanded) {
            if (baseZoomRef.current === 8) {
                baseZoomRef.current = currentZoom;
            }
        }
        const targetZoom = cardExpanded
            ? Math.min(baseZoomRef.current + 1, maxZoom)
            : baseZoomRef.current;

        const nextZoom = Math.max(currentZoom, targetZoom);

        if (!cardExpanded) {
            baseZoomRef.current = 8;
        }

        const targetYRatio = cardExpanded ? 0.32 : 0.40;
        // Negative offset relative to center moves it towards the top of the viewport
        const yOffset = map.getContainer().clientHeight * (targetYRatio - 0.5);

        map.easeTo({
            center: [selectedEvent.lng, selectedEvent.lat],
            zoom: nextZoom,
            offset: [0, yOffset],
            duration: 500
        });
    }, [selectedEvent, cardExpanded]);

    // Force recalculate projection whenever the geographic coordinate updates
    useEffect(() => {
        const map = mapRef.current;
        if (map && cloudAnchor) {
            const pos = map.project([cloudAnchor.lng, cloudAnchor.lat]);
            setCloudAnchorPos({ x: pos.x, y: pos.y });
        }
    }, [cloudAnchor]);

    // Update coordinates when dropped
    const handleCloudDragEnd = (ox: number, oy: number) => {
        const map = mapRef.current;
        const currentPos = cloudAnchorPosRef.current;
        if (map && currentPos) {
            const newScreenX = currentPos.x + ox;
            const newScreenY = currentPos.y + oy;
            const lngLat = map.unproject([newScreenX, newScreenY]);
            setCloudAnchorPos({ x: newScreenX, y: newScreenY });
            setCloudAnchor({ lat: lngLat.lat, lng: lngLat.lng });
        }
    };

    // 3. Uppdatera markörer i DOM:en när data eller synliga gränser förändras
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const currentGroupKeys = new Set<string>();

        // Synka nya och befintliga markör-grupper som faktiskt syns på skärmen
        visibleGroups.forEach(([key, group], index) => {
            currentGroupKeys.add(key);

            const count = group.length;
            const inGroupSelected = group.find(e => e.id === selectedEvent?.id);
            const nonDiscarded = group.filter(e => !discardedEventIds.has(e.id));
            // For multi-event groups, cycle the displayed event each tick like
            // a slideshow. Selected event always wins over the cycle.
            const cycleRep = count > 1 && !inGroupSelected && nonDiscarded.length > 0
                ? nonDiscarded[slideshowTick % nonDiscarded.length]
                : null;
            const rep = inGroupSelected || cycleRep || nonDiscarded[0] || group[0];

            const isSelected = !!inGroupSelected;
            const isSaved = group.some(e => savedEventIds.has(e.id));
            const isDiscarded = group.every(e => discardedEventIds.has(e.id));

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // Notera: vi inkluderar INTE cycleRep här eftersom vi annars skulle
            // riva ner och bygga upp brickans HTML varje sekund (vilket re-startar
            // pop-in-animationen). Slideshow-bytet sker istället med en mindre
            // ingripande emoji-uppdatering längre ner.
            const stateKey = `${isSelected}:${isSaved}:${isDiscarded}:${count}:${rep.category ?? 'other'}`;

            let markerData = markersRef.current.get(key);

            if (!markerData) {
                const el = document.createElement('div');
                el.className = 'v2-custom-marker';

                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'bottom'
                })
                .setLngLat([rep.lng!, rep.lat!])
                .addTo(map);

                markerData = { marker, element: el, lastStateKey: '' };
                markersRef.current.set(key, markerData);
            }

            // Uppdatera ENDAST om tillståndet faktiskt har förändrats
            if (markerData.lastStateKey !== stateKey) {
                markerData.lastStateKey = stateKey;

                // Uppdatera z-index på elementet. Multi-event-grupper (count > 1)
                // ligger ovanpå enskilda nålhuvuden så att siffer-badgen aldrig
                // skyms av en tom nål.
                const zIndex = isSelected ? 1000
                    : isSaved ? 500
                    : count > 1 ? 200
                    : isDiscarded ? -100 : 0;
                markerData.element.style.zIndex = String(zIndex);

                // Sätt eventlyssnare på klick
                markerData.element.onclick = (e) => {
                    e.stopPropagation();
                    onSelectEventRef.current(rep);
                };

                // Uppdatera markörens HTML-innehåll direkt i DOM:en
                const needleDotColor = isSelected ? '#006AA7' : isSaved ? '#5BA3CC' : '#1e293b';
                const needleLineColor = isSelected ? '#006AA7' : isSaved ? '#5BA3CC' : '#475569';
                const needleDotSize = isSelected ? 10 : isSaved ? 8 : 7;
                const needleLineH = isSelected ? 28 : 22;

                const pinBg = isSaved ? '#ffffff' : '#1e293b';
                const pinBorder = isSelected
                    ? '3px solid #006AA7'
                    : isSaved
                    ? '2px solid #5BA3CC'
                    : '2px solid rgba(255,255,255,0.25)';

                // Använd högpresterande CSS box-shadow
                const pinShadow = isSelected
                    ? '0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)'
                    : isSaved
                    ? '0 4px 10px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)';

                const scaleStyle = isSelected ? 'scale(1.25) translateY(-10px)' : 'scale(1)';
                const opacityStyle = isDiscarded ? 'opacity: 0.25; filter: grayscale(1);' : '';

                const catKey = rep.category && EVENT_CATEGORIES[rep.category] ? rep.category : 'other';
                const emoji = EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫';

                const countBadge = count > 1
                    ? `<div class="badge-count">${count > 99 ? '99+' : count}</div>`
                    : (isSaved ? '<div class="badge-saved"></div>' : '');

                const needleBadgeHtml = count > 1
                    ? `<div class="badge-needle-count">${count > 99 ? '99+' : count}</div>`
                    : '';

                // Fördela uppdykandet så att alla markörer poppar in under totalt 4 sekunder (4000ms), men visa det valda direkt (0ms delay)
                const N = visibleGroups.length;
                const animDelay = isSelected ? 0 : (N > 1 ? (index / (N - 1)) * 4000 : 0);
                const wrapperStyle = isSelected ? 'opacity: 1 !important;' : '';
                const pinAnimationStyle = isSelected
                    ? 'animation: none !important; opacity: 1 !important; transform: ' + scaleStyle + ' !important;'
                    : `transform: ${scaleStyle}; animation-delay: ${Math.round(animDelay)}ms;`;

                markerData.element.innerHTML = `
                    <div class="custom-marker-wrapper" style="${opacityStyle}; ${wrapperStyle}">
                        <!-- NEEDLE ELEMENT -->
                        <div class="needle-element">
                            <div style="position:relative;">
                                <div class="needle-dot" style="width:${needleDotSize}px;height:${needleDotSize}px;background:${needleDotColor};"></div>
                                ${needleBadgeHtml}
                            </div>
                            <div class="needle-line" style="height:${needleLineH}px;background:${needleLineColor};"></div>
                        </div>

                        <!-- PIN ELEMENT -->
                        <div class="pin-element" style="${pinAnimationStyle}">
                            <div class="pin-bubble" style="background:${pinBg}; border:${pinBorder}; box-shadow: ${pinShadow};">
                                <div class="pin-emoji">${emoji}</div>
                            </div>
                            ${countBadge}
                        </div>
                    </div>
                `;
            }

            // Slideshow-uppdatering för multi-event-grupper: byt enbart emoji +
            // klickmål utan att riva ner brickans DOM (så pop-in inte återstartas).
            if (cycleRep) {
                const cycleCatKey = cycleRep.category && EVENT_CATEGORIES[cycleRep.category]
                    ? cycleRep.category : 'other';
                const cycleEmoji = EVENT_CATEGORIES[cycleCatKey as EventCategoryType]?.emoji ?? '🎫';
                const emojiEl = markerData.element.querySelector('.pin-emoji');
                if (emojiEl && emojiEl.textContent !== cycleEmoji) {
                    emojiEl.textContent = cycleEmoji;
                }
                markerData.element.onclick = (e) => {
                    e.stopPropagation();
                    onSelectEventRef.current(cycleRep);
                };
            }
        });

        // Ta bort gamla markörer som lämnat skärmen
        Array.from(markersRef.current.keys()).forEach(key => {
            if (!currentGroupKeys.has(key)) {
                const markerData = markersRef.current.get(key);
                if (markerData) {
                    markerData.marker.remove();
                    markersRef.current.delete(key);
                }
            }
        });
    }, [visibleGroups, selectedEvent, savedEventIds, discardedEventIds, slideshowTick]);

    return (
        <div className="absolute inset-0 z-0 bg-slate-100" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0 }}>
            {/* CSS och Keyframes för en mjuk, progressiv animation */}
            <style>{`
                .v2-custom-marker {
                    background: none !important;
                    border: none !important;
                    cursor: pointer;
                    width: 44px;
                    height: 60px;
                }
                
                @keyframes marker-pop-in {
                    0% {
                        opacity: 0;
                        transform: scale(0.2) translateY(15px);
                    }
                    40% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .custom-marker-wrapper {
                    position: relative;
                    width: 44px;
                    height: 60px;
                }
                .needle-element, .pin-element {
                    position: absolute;
                    transform-origin: bottom center;
                }
                .needle-element {
                    bottom: 5px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .pin-element {
                    top: 0;
                    left: 0;
                    width: 44px;
                    height: 60px;
                }
                .needle-dot {
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
                .needle-line {
                    width: 2px;
                    border-radius: 1px;
                    opacity: 0.8;
                }
                .pin-bubble {
                    width: 44px;
                    height: 44px;
                    border-radius: 50% 50% 0 50%;
                    transform: rotate(45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    position: relative;
                }
                .pin-emoji {
                    transform: rotate(-45deg);
                    font-size: 22px;
                    line-height: 1;
                    position: relative;
                    z-index: 1;
                }
                .badge-count {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    min-width: 20px;
                    height: 20px;
                    padding: 0 4px;
                    background: #006AA7;
                    color: #fff;
                    font-size: 10px;
                    font-weight: 700;
                    border-radius: 999px;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    z-index: 10;
                }
                .badge-saved {
                    position: absolute;
                    top: -4px;
                    right: -4px;
                    width: 12px;
                    height: 12px;
                    background: #5BA3CC;
                    border-radius: 50%;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    z-index: 10;
                }
                .badge-needle-count {
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    min-width: 14px;
                    height: 14px;
                    padding: 0 2px;
                    background: #006AA7;
                    color: #fff;
                    font-size: 8px;
                    font-weight: 700;
                    border-radius: 999px;
                    border: 1.5px solid #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    box-sizing: border-box;
                }

                /* ──────────────────────────────────────────────────────────
                   TILLSTÅNDS-KLASSER (Styrs av containerklassen)
                ────────────────────────────────────────────────────────── */

                /* 1. Nål-läge (Vid zoom/pan) */
                .map-state-needle .v2-custom-marker .needle-element {
                    display: flex;
                }
                .map-state-needle .v2-custom-marker .pin-element {
                    display: none;
                }

                /* 2. Brick-läge (Standard när kartan är stilla) — nålen visas
                   alltid, brickan poppar upp ovanpå när kartan står still. */
                .map-state-full .v2-custom-marker .needle-element {
                    display: flex;
                }
                .map-state-full .v2-custom-marker .pin-element {
                    display: block;
                    animation: marker-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                }
            `}</style>
            <div ref={mapContainerRef} className="absolute inset-0 map-state-full" style={{ width: '100%', height: '100%' }} />
            {showCloud && cloudAnchorPos && (
                <CloudPopup
                    message={`Det finns ${events.length} unika event idag. Det fylls på med nya hela tiden.`}
                    anchorPos={cloudAnchorPos}
                    onDragEnd={handleCloudDragEnd}
                    onDismiss={() => setShowCloud(false)}
                />
            )}
        </div>
    );
}
