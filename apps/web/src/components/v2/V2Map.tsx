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
    /** Bumps every time the sun button is pressed and the flash ends — V2Map
     *  spawns a new map-anchored cloud at the current view center. */
    sunCloudTrigger?: number;
    /** Räknare som visas i molnet. Skickas in från sidan så molnet ser hela
     *  datasetet, inte bara det dag-/sökfiltrerade. */
    cloudStats?: { today: number; week: number; withinHour: number; withinHours: number };
    /** Räknare som triggar att respektive moln snäpper tillbaka in på skärmen
     *  (används av återkallnings-knapparna jämte solen). Varje ökning = ett anrop. */
    recallMainTrigger?: number;
    recallSunTrigger?: number;
    /** Räknare som triggar att kameran flyger tillbaka TILL det valda eventet
     *  (recenter-knappen på eventkortet — vi går till eventet, eventet flyttas
     *  inte till oss). Varje ökning = ett anrop. */
    recenterTrigger?: number;
    /** Skickar status om huruvida respektive molns ankare ligger utanför skärmen.
     *  Sidan använder det för att visa återkallnings-knappar jämte solen. */
    onCloudVisibilityChange?: (visibility: { main: boolean; sun: boolean }) => void;
}

export default function V2Map({
    events,
    selectedEvent,
    onSelectEvent,
    savedEventIds = new Set(),
    discardedEventIds = new Set(),
    cardExpanded = false,
    onCenterChange,
    onMapDrag,
    sunCloudTrigger = 0,
    cloudStats,
    recallMainTrigger = 0,
    recallSunTrigger = 0,
    recenterTrigger = 0,
    onCloudVisibilityChange
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string }>>(new Map());
    // Grupp-nycklar som någon gång visats som bricka via att vara markerade.
    // En gång avslöjad → brickan visas alltid direkt (ingen staggered kö), så
    // ett event man navigerat förbi inte faller tillbaka till nål.
    const revealedKeysRef = useRef<Set<string>>(new Set());

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

    const showCloudRef = useRef(showCloud);
    showCloudRef.current = showCloud;

    const cloudAnchorRef = useRef(cloudAnchor);
    cloudAnchorRef.current = cloudAnchor;

    const cloudAnchorPosRef = useRef(cloudAnchorPos);
    cloudAnchorPosRef.current = cloudAnchorPos;

    // Sun-cloud state — a second cloud that spawns at the current map center
    // whenever the sun-flash animation finishes. Behaves identically to the
    // main cloud: anchored to geo coordinates, follows map pan/zoom, persists
    // off-screen until the user dismisses it.
    const [sunCloudAnchor, setSunCloudAnchor] = useState<{ lat: number; lng: number } | null>(null);
    const [sunCloudAnchorPos, setSunCloudAnchorPos] = useState<{ x: number; y: number } | null>(null);
    const [sunCloudId, setSunCloudId] = useState(0);
    // Skalan som sun-molnet visas i. Det är förankrat i kartan: när man zoomar
    // in växer det (2x per zoom-nivå), zoomar man ut krymper det — likt ett
    // objekt på kartan. Vid skapande sätts skalan utifrån nuvarande zoom.
    const [sunCloudScale, setSunCloudScale] = useState(1);
    const sunCloudCreationZoomRef = useRef<number>(8);
    const SUN_CLOUD_BASE_SCALE = 0.7; // lite mindre än huvudmolnet vid skapande

    const sunCloudAnchorRef = useRef(sunCloudAnchor);
    sunCloudAnchorRef.current = sunCloudAnchor;
    const sunCloudAnchorPosRef = useRef(sunCloudAnchorPos);
    sunCloudAnchorPosRef.current = sunCloudAnchorPos;

    // Camera-follow: tapping ett moln pinnar det vid en skärmpunkt. Båda molnen
    // kan följas samtidigt — och kartan får dras fritt även medan de följs (panna
    // under molnen). När man kastar ett följt moln glider kameran med, och båda
    // pinnade moln stannar kvar på sina skärmpunkter hela vägen.
    const [mainFollowing, setMainFollowing] = useState(false);
    const [sunFollowing, setSunFollowing] = useState(false);
    const mainFollowingRef = useRef(mainFollowing);
    mainFollowingRef.current = mainFollowing;
    const sunFollowingRef = useRef(sunFollowing);
    sunFollowingRef.current = sunFollowing;
    // Skärmpunkten ett följt moln är fastpinnat vid. Geo-ankaret härleds från
    // den punkten varje frame så molnet stannar vid samma pixel medan kameran rör sig.
    const mainFollowPtRef = useRef<{ x: number; y: number } | null>(null);
    const sunFollowPtRef = useRef<{ x: number; y: number } | null>(null);

    // Off-screen-status för respektive moln. När geo-ankaret hamnar utanför
    // viewporten visar sidan en återkallnings-knapp jämte solen.
    const [mainOffScreen, setMainOffScreen] = useState(false);
    const [sunOffScreen, setSunOffScreen] = useState(false);
    const mainOffScreenRef = useRef(mainOffScreen);
    mainOffScreenRef.current = mainOffScreen;
    const sunOffScreenRef = useRef(sunOffScreen);
    sunOffScreenRef.current = sunOffScreen;

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

        // Real-time projection updater for the anchored cloud popups (main +
        // any sun-clouds that are currently alive).
        const updateCloudPosition = () => {
            // Följt moln: skärmpunkten är konstant. Vi uppdaterar i stället
            // geo-ankaret varje frame så det matchar latlng under den pinnen
            // — molnet vandrar "med" användaren när kartan pannas/zoomas.
            const mainPt = mainFollowPtRef.current;
            if (mainFollowingRef.current && mainPt) {
                const ll = map.unproject([mainPt.x, mainPt.y]);
                const prevAnchor = cloudAnchorRef.current;
                if (!prevAnchor || Math.abs(prevAnchor.lat - ll.lat) > 1e-7 || Math.abs(prevAnchor.lng - ll.lng) > 1e-7) {
                    cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                    setCloudAnchor({ lat: ll.lat, lng: ll.lng });
                }
            } else {
                // Fritt ankare — projicera geo till skärm.
                const currentAnchor = cloudAnchorRef.current;
                if (currentAnchor) {
                    const pos = map.project([currentAnchor.lng, currentAnchor.lat]);
                    const prev = cloudAnchorPosRef.current;
                    if (!prev || Math.round(prev.x) !== Math.round(pos.x) || Math.round(prev.y) !== Math.round(pos.y)) {
                        setCloudAnchorPos({ x: pos.x, y: pos.y });
                    }
                }
            }

            const sunPt = sunFollowPtRef.current;
            if (sunFollowingRef.current && sunPt) {
                const ll = map.unproject([sunPt.x, sunPt.y]);
                const prevAnchor = sunCloudAnchorRef.current;
                if (!prevAnchor || Math.abs(prevAnchor.lat - ll.lat) > 1e-7 || Math.abs(prevAnchor.lng - ll.lng) > 1e-7) {
                    sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                    setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
                }
            } else {
                const currentSunAnchor = sunCloudAnchorRef.current;
                if (currentSunAnchor) {
                    const pos = map.project([currentSunAnchor.lng, currentSunAnchor.lat]);
                    const prev = sunCloudAnchorPosRef.current;
                    if (!prev || Math.round(prev.x) !== Math.round(pos.x) || Math.round(prev.y) !== Math.round(pos.y)) {
                        setSunCloudAnchorPos({ x: pos.x, y: pos.y });
                    }
                }
            }
            // Skala med zoom: 2x per zoom-nivå relativt skapande-zoomen.
            if (sunCloudAnchorRef.current) {
                const zoomDelta = map.getZoom() - sunCloudCreationZoomRef.current;
                const scaled = Math.min(Math.max(SUN_CLOUD_BASE_SCALE * Math.pow(2, zoomDelta), 0.25), 4);
                setSunCloudScale((prevScale) => Math.abs(prevScale - scaled) > 0.001 ? scaled : prevScale);
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

    // Flyg kameran så det valda eventet hamnar i vy (vi går TILL eventet —
    // eventet flyttas aldrig till oss). Återanvänds av både val-effekten nedan
    // och recenter-knappen på eventkortet.
    const recenterOnSelected = () => {
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
    };

    // 2. Hantera kamera-panorering och zoomning vid val av event
    useEffect(() => {
        recenterOnSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded]);

    // Recenter-knappen flyger kameran TILL ett moln (vi går dit — molnet
    // teleporteras inte till oss). Finns båda molnen framme → toggla till det
    // andra för varje klick (minns vilket vi gick till sist). Finns bara ett
    // moln → alltid det. Inget moln → inget händer.
    const lastRecenterRef = useRef<'main' | 'sun'>('sun');
    const recenterOnClouds = () => {
        const map = mapRef.current;
        if (!map) return;

        const hasMain = showCloudRef.current && !!cloudAnchorRef.current;
        const hasSun = !!sunCloudAnchorRef.current;
        if (!hasMain && !hasSun) return;

        // Ett moln som slängts iväg (ligger utanför bild) prioriteras: dit flyttas
        // kameran först. Sen växlar knappen mellan molnens position som vanligt.
        const mainThrown = hasMain && mainOffScreenRef.current;
        const sunThrown = hasSun && sunOffScreenRef.current;

        let go: 'main' | 'sun';
        if (mainThrown || sunThrown) {
            if (mainThrown && sunThrown) go = lastRecenterRef.current === 'main' ? 'sun' : 'main';
            else go = mainThrown ? 'main' : 'sun';
        } else if (hasMain && hasSun) {
            // Växla till det andra molnet jämfört med förra klicket.
            go = lastRecenterRef.current === 'main' ? 'sun' : 'main';
        } else {
            go = hasMain ? 'main' : 'sun';
        }
        lastRecenterRef.current = go;

        // Molnen ska STANNA på sina geo-platser — bara kameran flyttas. Stäng av
        // follow (annars pinnas ett moln vid skärmen och glider in över det andra).
        setMainFollowing(false);
        setSunFollowing(false);

        const target = go === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current;
        if (!target) return;
        map.easeTo({ center: [target.lng, target.lat], duration: 600 });
    };

    useEffect(() => {
        if (recenterTrigger <= 0) return;
        recenterOnClouds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recenterTrigger]);

    // Spawn a new sun-cloud at the current map center whenever the parent
    // bumps sunCloudTrigger (which it does after the white-flash animation
    // completes). Each spawn replaces the previous sun-cloud — keeps it simple
    // while still feeling responsive on rapid clicks.
    useEffect(() => {
        if (sunCloudTrigger <= 0) return;
        const map = mapRef.current;
        if (!map) return;
        const center = map.getCenter();
        setSunCloudAnchor({ lat: center.lat, lng: center.lng });
        const screen = map.project([center.lng, center.lat]);
        setSunCloudAnchorPos({ x: screen.x, y: screen.y });
        // Nollställ skalan till basstorlek vid nuvarande zoom — molnet "anpassar
        // sig efter den zoom det skapas på".
        sunCloudCreationZoomRef.current = map.getZoom();
        setSunCloudScale(SUN_CLOUD_BASE_SCALE);
        setSunCloudId(id => id + 1);
    }, [sunCloudTrigger]);

    // Pinna respektive moln vid sin nuvarande skärmpunkt när follow slås på,
    // och släpp pinnen (uppdatera geo-ankaret från sista skärmpunkt) när den
    // slås av. Kart-panorering är alltid på — molnet sitter kvar på skärmen
    // medan kartan glider under det, geo-ankaret härleds varje frame.
    const prevMainFollowingRef = useRef(false);
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        const prev = prevMainFollowingRef.current;
        prevMainFollowingRef.current = mainFollowing;
        if (mainFollowing && !prev) {
            const pos = cloudAnchorPosRef.current;
            mainFollowPtRef.current = pos ? { x: pos.x, y: pos.y } : null;
        } else if (!mainFollowing && prev) {
            const pt = mainFollowPtRef.current;
            if (pt) {
                const ll = map.unproject([pt.x, pt.y]);
                cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setCloudAnchorPos({ x: pt.x, y: pt.y });
            }
            mainFollowPtRef.current = null;
        }
    }, [mainFollowing]);

    const prevSunFollowingRef = useRef(false);
    useEffect(() => {
        const map = mapRef.current; if (!map) return;
        const prev = prevSunFollowingRef.current;
        prevSunFollowingRef.current = sunFollowing;
        if (sunFollowing && !prev) {
            const pos = sunCloudAnchorPosRef.current;
            sunFollowPtRef.current = pos ? { x: pos.x, y: pos.y } : null;
        } else if (!sunFollowing && prev) {
            const pt = sunFollowPtRef.current;
            if (pt) {
                const ll = map.unproject([pt.x, pt.y]);
                sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setSunCloudAnchorPos({ x: pt.x, y: pt.y });
            }
            sunFollowPtRef.current = null;
        }
    }, [sunFollowing]);

    // Kasta iväg ett moln: pinnen flyttas till släpp-punkten och kameran
    // flyger med matchande momentum/friktion. Eftersom det följs är fastpinnat
    // vid den skärmpunkten hela kameraflugen tracker det kameran utan slutligt
    // hopp. Båda molnen får varsin handler så vi vet vilket som flygs.
    const makeFlingHandler = (kind: 'main' | 'sun') =>
        (vx: number, vy: number, holdX: number, holdY: number) => {
            const map = mapRef.current;
            if (!map) return;

            // Klampa inom skärmen (med marginal) så molnet aldrig blir oåtkomligt.
            const margin = 48;
            holdX = Math.min(Math.max(holdX, margin), window.innerWidth - margin);
            holdY = Math.min(Math.max(holdY, margin), window.innerHeight - margin);
            const ll = map.unproject([holdX, holdY]);
            if (kind === 'sun') {
                sunFollowPtRef.current = { x: holdX, y: holdY };
                sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setSunCloudAnchorPos({ x: holdX, y: holdY });
            } else {
                mainFollowPtRef.current = { x: holdX, y: holdY };
                cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
                setCloudAnchor({ lat: ll.lat, lng: ll.lng });
                setCloudAnchorPos({ x: holdX, y: holdY });
            }

            const k = 2.2 / 1000; // friktion per ms (matchar molnets glide)
            const stopThreshold = 0.04; // px/ms
            const speed = Math.sqrt(vx * vx + vy * vy);
            if (speed < stopThreshold) return; // bara släppt, ingen fling
            const dispX = vx / k;
            const dispY = vy / k;
            const duration = Math.min(Math.max(Math.log(speed / stopThreshold) / k, 300), 2600);
            const cs = map.project(map.getCenter());
            const target = map.unproject([cs.x + dispX, cs.y + dispY]);
            map.easeTo({ center: target, duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
        };
    const handleMainFling = useMemo(() => makeFlingHandler('main'), []);
    const handleSunFling = useMemo(() => makeFlingHandler('sun'), []);

    // Off-screen-detektering. Ett moln räknas som ute ur bild när dess
    // skärmpunkt ligger en bra bit utanför viewporten — då visar sidan en
    // återkallnings-knapp jämte solen.
    useEffect(() => {
        const isOff = (p: { x: number; y: number } | null) => {
            if (!p) return true;
            const w = window.innerWidth, h = window.innerHeight;
            const margin = 60;
            return p.x < -margin || p.x > w + margin || p.y < -margin || p.y > h + margin;
        };
        setMainOffScreen(isOff(cloudAnchorPos));
        setSunOffScreen(sunCloudAnchor !== null && isOff(sunCloudAnchorPos));
    }, [cloudAnchorPos, sunCloudAnchorPos, sunCloudAnchor]);

    const onCloudVisibilityChangeRef = useRef(onCloudVisibilityChange);
    onCloudVisibilityChangeRef.current = onCloudVisibilityChange;
    useEffect(() => {
        onCloudVisibilityChangeRef.current?.({ main: mainOffScreen, sun: sunOffScreen });
    }, [mainOffScreen, sunOffScreen]);

    // Återkalla ett moln till en synlig position. Snäpper både skärm- och
    // geo-ankaret till en punkt i nedre högra kanten (där sol-knappen sitter),
    // så molnet är direkt gripbart.
    const recallCloud = (kind: 'main' | 'sun') => {
        const map = mapRef.current; if (!map) return;
        const w = window.innerWidth, h = window.innerHeight;
        const targetX = w * 0.78;
        const targetY = h * 0.55;
        const ll = map.unproject([targetX, targetY]);
        if (kind === 'main') {
            cloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
            setCloudAnchor({ lat: ll.lat, lng: ll.lng });
            setCloudAnchorPos({ x: targetX, y: targetY });
            setShowCloud(true);
            if (mainFollowingRef.current) mainFollowPtRef.current = { x: targetX, y: targetY };
        } else {
            sunCloudAnchorRef.current = { lat: ll.lat, lng: ll.lng };
            setSunCloudAnchor({ lat: ll.lat, lng: ll.lng });
            setSunCloudAnchorPos({ x: targetX, y: targetY });
            if (sunFollowingRef.current) sunFollowPtRef.current = { x: targetX, y: targetY };
        }
    };
    const prevRecallMainRef = useRef(recallMainTrigger);
    useEffect(() => {
        if (recallMainTrigger > prevRecallMainRef.current) recallCloud('main');
        prevRecallMainRef.current = recallMainTrigger;
    }, [recallMainTrigger]);
    const prevRecallSunRef = useRef(recallSunTrigger);
    useEffect(() => {
        if (recallSunTrigger > prevRecallSunRef.current) recallCloud('sun');
        prevRecallSunRef.current = recallSunTrigger;
    }, [recallSunTrigger]);

    const handleSunCloudDragEnd = (ox: number, oy: number) => {
        const map = mapRef.current;
        const currentPos = sunCloudAnchorPosRef.current;
        if (map && currentPos) {
            const newScreenX = currentPos.x + ox;
            const newScreenY = currentPos.y + oy;
            const lngLat = map.unproject([newScreenX, newScreenY]);
            setSunCloudAnchorPos({ x: newScreenX, y: newScreenY });
            setSunCloudAnchor({ lat: lngLat.lat, lng: lngLat.lng });
        }
    };

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

            // Något event i gruppen börjar inom 1 timme → nålhuvudet + pin-ramen
            // blir orange, så man enkelt ser vilka som är på gång nu.
            // (hasSpecificTime finns inte i webbdatan, så det villkoret nollade
            //  alltid detta — därför borttaget.)
            const nowMs = Date.now();
            const startsWithinHour = group.some(e =>
                e.time
                && e.time.getTime() > nowMs
                && e.time.getTime() - nowMs <= 60 * 60 * 1000
            );

            // Markera gruppen som "avslöjad" så fort den varit vald. Avslöjade
            // grupper visar brickan direkt även när de inte längre är valda.
            if (isSelected) revealedKeysRef.current.add(key);
            const isRevealed = revealedKeysRef.current.has(key);

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // För multi-event-grupper använder vi ett stabilt 'multi'-värde så
            // att stateKey inte ändras varje slideshow-tick (annars rivs brickan
            // ner och byggs upp igen + pop-in-animationen återstartas). Själva
            // emoji-bytet sker kirurgiskt längre ner.
            const stateKeyCategory = count > 1 ? 'multi' : (rep.category ?? 'other');
            const stateKey = `${isSelected}:${isRevealed}:${isSaved}:${isDiscarded}:${count}:${stateKeyCategory}:${startsWithinHour}`;

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

                // Uppdatera markörens HTML-innehåll direkt i DOM:en.
                // Prioritet: vald (blå) > sparad (ljusblå) > börjar inom 1 timme (orange) > standard (svart).
                const needleDotColor = isSelected
                    ? '#006AA7'
                    : isSaved
                    ? '#5BA3CC'
                    : startsWithinHour
                    ? '#f97316'
                    : '#1e293b';
                const needleLineColor = isSelected ? '#006AA7' : isSaved ? '#5BA3CC' : '#475569';
                const needleDotSize = isSelected ? 10 : isSaved ? 8 : 7;
                const needleLineH = isSelected ? 28 : 22;

                const pinBg = isSaved ? '#ffffff' : '#1e293b';
                const pinBorder = isSelected
                    ? '3px solid #006AA7'
                    : isSaved
                    ? '2px solid #5BA3CC'
                    : startsWithinHour
                    ? '2px solid #f97316'
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
                // Valt OCH redan avslöjat event visar brickan direkt utan kö-delay.
                const showImmediately = isSelected || isRevealed;
                const wrapperStyle = showImmediately ? 'opacity: 1 !important;' : '';
                const pinAnimationStyle = showImmediately
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
                    message={cloudStats ? (
                        <>
                            <span className="block">{cloudStats.today} unika event i Sverige idag</span>
                            <span className="block text-sky-500 font-black text-[18px] sm:text-[20px] leading-snug my-1">
                                {cloudStats.withinHour} börjar inom {cloudStats.withinHours} {cloudStats.withinHours === 1 ? 'timme' : 'timmar'}
                            </span>
                            <span className="block text-slate-500 dark:text-slate-600 text-[12px]">
                                {cloudStats.week} i veckan
                            </span>
                        </>
                    ) : `Se alla publika event du kan anmäla dig till idag. Ett nytt kan dyka upp nästa sekund.`}
                    anchorPos={cloudAnchorPos}
                    onDragEnd={handleCloudDragEnd}
                    onDismiss={() => { setShowCloud(false); setMainFollowing(false); }}
                    following={mainFollowing}
                    onToggleFollow={() => setMainFollowing(f => !f)}
                    onFollowFling={handleMainFling}
                />
            )}
            {sunCloudAnchor && sunCloudAnchorPos && (
                <CloudPopup
                    key={sunCloudId}
                    message=""
                    anchorPos={sunCloudAnchorPos}
                    onDragEnd={handleSunCloudDragEnd}
                    onDismiss={() => { setSunCloudAnchor(null); setSunFollowing(false); }}
                    faceScale={0.6}
                    showDelayMs={0}
                    scale={sunCloudScale}
                    following={sunFollowing}
                    onToggleFollow={() => setSunFollowing(f => !f)}
                    onFollowFling={handleSunFling}
                />
            )}
        </div>
    );
}
