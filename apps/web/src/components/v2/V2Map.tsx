'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Box } from 'lucide-react';
import { LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import CloudPopup, { CloudExpression } from '../ui/CloudPopup';

// Två basstilar: standard vektor-karta (Voyager) och en raster-satellitvy
// (ESRI World Imagery). Vi växlar via map.setStyle(); markörer behålls eftersom
// de är DOM-element i container, inte en del av style-spec:en.
const STREETS_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const SATELLITE_STYLE: maplibregl.StyleSpecification = {
    version: 8,
    sources: {
        satellite: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        },
        // Transparent etikett-overlay med ort- och landsnamn ovanpå satellit-bilden,
        // så man fortfarande ser var man är även när basbilden är fotorealistisk.
        labels: {
            type: 'raster',
            tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: 'Labels &copy; Esri'
        }
    },
    layers: [
        { id: 'satellite', type: 'raster', source: 'satellite' },
        { id: 'labels', type: 'raster', source: 'labels' }
    ]
};

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
    cloudStats?: { today: number; tomorrow: number; week: number; withinHour: number; withinHours: number };
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
    /** True när båda molnen ligger på varandra → slangbella tillgänglig.
     *  Sidan fyller fokusknappen vit för att visa att läget är aktivt. */
    onSlingshotChange?: (active: boolean) => void;
    /** True när användaren tryckt på fokusknappen i ready-läge → gummibanden
     *  blir alltid synliga och nästa drag-release av ett moln avfyrar slangbellan
     *  i motsatt riktning mot dragget. */
    slingshotEngaged?: boolean;
    /** Fyrar när snärten avlossats så sidan kan avarma engaged-läget. */
    onSlingshotFired?: () => void;
    /** "Hitta eventet"-spel: när true är kartan i gissningsläge — markörklick blir
     *  en gissning (onGuess) i stället för ett vanligt val, det valda mål-eventet
     *  highlightas INTE (så det inte avslöjas) och kameran flyttas inte dit. */
    gameMode?: boolean;
    /** Anropas vid markörklick i gissningsläge med hela gruppen som klickades.
     *  Sidan avgör om mål-eventet finns i gruppen. */
    onGuess?: (group: LinkEvent[]) => void;
    /** Event-id som ska ritas som en guld-skimrande markör (det rätta svaret när
     *  rundan avslöjats). null = ingen guldmarkör. */
    goldEventId?: string | null;
    /** Event-id för markören man gissade på — hålls synlig (brickan visas direkt)
     *  efter avslöjet så man ser var man klickade. null = ingen. */
    guessedEventId?: string | null;
    /** Streck mellan gissningen (from) och rätt svar (to) som ritas efter en
     *  felgissning. När satt zoomar kartan ut så båda punkterna syns och en
     *  streckad linje + avståndsetikett ritas mellan dem. null = inget streck. */
    guessLine?: { from: { lat: number; lng: number }; to: { lat: number; lng: number }; label: string } | null;
    /** True = luta kameran till en sidovy (3D-perspektiv); false = platt vy.
     *  Togglas av solknappen + tilt-knappen. */
    tilted?: boolean;
    /** Fyrar när man trycker på sol-molnet — sidan fäller tillbaka lutningen. */
    onSunCloudTap?: () => void;
    /** Togglar lutningen via tilt-knappen under satellit-knappen. */
    onToggleTilt?: () => void;
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
    onCloudVisibilityChange,
    onSlingshotChange,
    slingshotEngaged = false,
    onSlingshotFired,
    gameMode = false,
    onGuess,
    goldEventId = null,
    guessedEventId = null,
    guessLine = null,
    tilted = false,
    onSunCloudTap,
    onToggleTilt
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string }>>(new Map());
    // Grupp-nycklar som någon gång visats som bricka via att vara markerade.
    // En gång avslöjad → brickan visas alltid direkt (ingen staggered kö), så
    // ett event man navigerat förbi inte faller tillbaka till nål.
    const revealedKeysRef = useRef<Set<string>>(new Set());

    const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('satellite');

    // Gissnings-streck (spelet): geo-ankaret i en ref + de projicerade skärm-
    // positionerna i state. Skärmpositionerna uppdateras varje kart-frame så
    // strecket sitter fast mellan gissningen och rätt svar medan kartan rör sig.
    const guessLineRef = useRef(guessLine);
    guessLineRef.current = guessLine;
    const [guessLineScreen, setGuessLineScreen] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null);

    // Spara undan callbacks i refs så map-event-handlers inte ständigt behöver bindas om
    const onSelectEventRef = useRef(onSelectEvent);
    onSelectEventRef.current = onSelectEvent;

    const onCenterChangeRef = useRef(onCenterChange);
    onCenterChangeRef.current = onCenterChange;

    const onMapDragRef = useRef(onMapDrag);
    onMapDragRef.current = onMapDrag;

    // Spel-läge + gissnings-callback i refs så markör-klickhanterare kan läsa
    // senaste värdet utan att bindas om.
    const gameModeRef = useRef(gameMode);
    gameModeRef.current = gameMode;
    const onGuessRef = useRef(onGuess);
    onGuessRef.current = onGuess;

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

    // Slangbella: aktiv när båda molnen ligger på (nästan) varandra på skärmen.
    const [slingshotActive, setSlingshotActive] = useState(false);
    const slingshotActiveRef = useRef(slingshotActive);
    slingshotActiveRef.current = slingshotActive;
    // Live drag-offset per moln, så slangbella-gummibanden hänger med molnet
    // när användaren drar i det. Nollställs när dragget släpps.
    const [mainLiveOffset, setMainLiveOffset] = useState({ x: 0, y: 0 });
    const [sunLiveOffset, setSunLiveOffset] = useState({ x: 0, y: 0 });

    // Molnens nuvarande moods (rapporterade av respektive CloudPopup) + en
    // "incoming"-stämpel per moln. När man drar ett moln med en min över det
    // andra molnet får det andra molnet samma min.
    const [mainMood, setMainMood] = useState<CloudExpression | null>(null);
    const [sunMood, setSunMood] = useState<CloudExpression | null>(null);
    const mainMoodRef = useRef(mainMood); mainMoodRef.current = mainMood;
    const sunMoodRef = useRef(sunMood); sunMoodRef.current = sunMood;
    const [mainIncomingMood, setMainIncomingMood] = useState<{ mood: CloudExpression | null; nonce: number }>({ mood: null, nonce: 0 });
    const [sunIncomingMood, setSunIncomingMood] = useState<{ mood: CloudExpression | null; nonce: number }>({ mood: null, nonce: 0 });
    const slingshotEngagedRef = useRef(slingshotEngaged);
    slingshotEngagedRef.current = slingshotEngaged;
    // Snapshot av båda molns skärmpositioner i samma sekund slangbellan armas.
    // Används vid avfyrning för att räkna ut pull-vektorn (current - origin) och
    // avgöra vilket moln som är "projektilen" (det som flyttats längst).
    const engageSnapshotRef = useRef<{ main: { x: number; y: number } | null; sun: { x: number; y: number } | null }>({ main: null, sun: null });
    useEffect(() => {
        if (slingshotEngaged) {
            engageSnapshotRef.current = {
                main: cloudAnchorPosRef.current ? { ...cloudAnchorPosRef.current } : null,
                sun: sunCloudAnchorPosRef.current ? { ...sunCloudAnchorPosRef.current } : null,
            };
        } else {
            engageSnapshotRef.current = { main: null, sun: null };
        }
    }, [slingshotEngaged]);

    const baseZoomRef = useRef<number>(8);

    // Live glide-snapshot från respektive moln. CloudPopup skriver hit varje
    // glid-frame och nollar när molnet stannat. Används av fokus-knappen för
    // att kunna "jaga" ett moln som fortfarande är i rörelse — utan detta
    // läser vi det gamla ankaret (där molnet kastades ifrån) eftersom det inte
    // commitas förrän glidet är slut.
    const mainGlideStateRef = useRef<{ sp: { x: number; y: number }; vx: number; vy: number } | null>(null);
    const sunGlideStateRef = useRef<{ sp: { x: number; y: number }; vx: number; vy: number } | null>(null);

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
            // Visa alltid markören man gissade på (spelet) så brickan syns efter avslöjet.
            if (guessedEventId && group.some(e => e.id === guessedEventId)) return true;

            const rep = group[0];
            if (!rep.lng || !rep.lat) return false;
            return paddedBounds.contains([rep.lng, rep.lat]);
        });
    }, [groups, mapBounds, selectedEvent, guessedEventId]);

    // Spårar ORDNINGEN man bläddrat genom den valda gruppen, så grupp-markörens
    // siffra speglar din position (Nästa → mindre, Bakåt → större). Nollställs
    // när man byter grupp. (Ett event som man går tillbaka till finns redan i
    // listan → ordningen ändras inte, men index/siffran följer det valda.)
    const visitedOrderRef = useRef<string[]>([]);
    const visitedGroupKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!selectedEvent || selectedEvent.lat == null || selectedEvent.lng == null) {
            visitedOrderRef.current = [];
            visitedGroupKeyRef.current = null;
            return;
        }
        const gk = `${selectedEvent.lat.toFixed(4)},${selectedEvent.lng.toFixed(4)}`;
        if (gk !== visitedGroupKeyRef.current) {
            visitedGroupKeyRef.current = gk;
            visitedOrderRef.current = [selectedEvent.id];
        } else if (!visitedOrderRef.current.includes(selectedEvent.id)) {
            visitedOrderRef.current.push(selectedEvent.id);
        }
    }, [selectedEvent]);

    // 1. Initiera MapLibre kartan en gång
    useEffect(() => {
        if (!mapContainerRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainerRef.current,
            // Initial style matchar default-värdet på mapStyle (satellit) så
            // kartan inte måste byta stil direkt efter mount → ingen flicker.
            style: SATELLITE_STYLE,
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
            // I gissningsläge ska ett klick på tom karta inte stänga mål-kortet
            // (det skulle avbryta rundan av misstag).
            if (gameModeRef.current) return;
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

            // Gissnings-streck: projicera geo→skärm varje frame så strecket sitter
            // fast mellan gissningen och rätt svar medan kartan zoomar/pannas.
            const gl = guessLineRef.current;
            if (gl) {
                const pf = map.project([gl.from.lng, gl.from.lat]);
                const pt = map.project([gl.to.lng, gl.to.lat]);
                setGuessLineScreen((prev) => {
                    if (prev
                        && Math.round(prev.from.x) === Math.round(pf.x) && Math.round(prev.from.y) === Math.round(pf.y)
                        && Math.round(prev.to.x) === Math.round(pt.x) && Math.round(prev.to.y) === Math.round(pt.y)) return prev;
                    return { from: { x: pf.x, y: pf.y }, to: { x: pt.x, y: pt.y } };
                });
            }
        };

        map.on('move', updateCloudPosition);
        map.on('zoom', updateCloudPosition);

        // Uppdatera synliga bounds + center-callback. THROTTLAD: idle-driftens
        // panBy fyrar 'moveend' ~60fps och setMapBounds triggar marker-omsync —
        // kör därför som mest ~var 200ms (≈5x/sek) i stället för varje frame.
        let moveEndTimer: ReturnType<typeof setTimeout> | null = null;
        let moveEndLastAt = 0;
        const applyBounds = () => {
            moveEndLastAt = performance.now();
            setMapBounds(map.getBounds());
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
        };
        const handleMoveEnd = () => {
            const since = performance.now() - moveEndLastAt;
            if (since >= 200) {
                if (moveEndTimer) { clearTimeout(moveEndTimer); moveEndTimer = null; }
                applyBounds();
            } else if (!moveEndTimer) {
                moveEndTimer = setTimeout(() => { moveEndTimer = null; applyBounds(); }, 200 - since);
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
            if (moveEndTimer) clearTimeout(moveEndTimer);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Byt baskartan när användaren togglar satellit-knappen. Markörerna ligger som
    // DOM-element i container och påverkas inte av setStyle.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        map.setStyle(mapStyle === 'satellite' ? SATELLITE_STYLE : STREETS_STYLE_URL);
    }, [mapStyle]);

    // Luta kameran när solknappen togglar tilt: pitch 60° = sidovy, 0° = platt.
    // Hoppar över det initiala körningen (då tilt redan matchar kartans 0°).
    const prevTiltedRef = useRef(tilted);
    useEffect(() => {
        if (prevTiltedRef.current === tilted) return;
        prevTiltedRef.current = tilted;
        const map = mapRef.current;
        if (!map) return;
        driftSuppressUntilRef.current = performance.now() + 1400;
        map.easeTo({ pitch: tilted ? 60 : 0, duration: 900 });
    }, [tilted]);

    // Tidsstämpel som idle-driften ska hålla sig pausad till. Sätts av våra egna
    // programmatiska kamera-flytt (easeTo) så driften inte slåss mot centreringen.
    const driftSuppressUntilRef = useRef(0);

    // Mjuk idle-drift: när användaren inte rört kartan på en stund driver vi
    // den långsamt i sinus-bana så bilden lever. Pausas direkt vid interaktion
    // OCH under våra egna kamera-flytt (driftSuppressUntilRef).
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        let raf = 0;
        let interactingUntil = 0;
        // startedAt nollställs ALDRIG efter init — vågens fas är kontinuerlig
        // över pauser så driften aldrig "snäpper" till en ny startposition när
        // den återupptas. Boost-envelopen löper bara på den initiala starten.
        const startedAt = performance.now();
        let last = { x: 0, y: 0 };
        // Tidpunkt då aktuell paus slutade. Används för att fade-ina drift-
        // amplituden över ~1s istället för att klippa in direkt — så man inte
        // ser ett "hack" precis efter att man släppt kartan.
        let resumeAt = startedAt;
        let wasPaused = false;
        const pause = () => { interactingUntil = performance.now() + 2500; };
        map.on('dragstart', pause);
        map.on('drag', pause);        // förläng pausen under HELA draget (annars motas långa drag av driften)
        map.on('zoomstart', pause);
        map.on('rotatestart', pause);
        map.on('pitchstart', pause);
        // Pausa direkt vid beröring (innan dragstart hinner fyras), så driften
        // aldrig slåss med att man börjar dra kartan.
        const canvas = map.getCanvasContainer();
        canvas.addEventListener('pointerdown', pause);
        const tick = (now: number) => {
            const isPaused = now < interactingUntil || now < driftSuppressUntilRef.current || document.hidden;
            if (!isPaused) {
                const t = (now - startedAt) / 1000;
                // Driften = stor dämpad initial puls + liten konstant grunddrift.
                // Bägge termerna använder sin() så de startar och oscillerar runt
                // 0 → ingen kumulativ förskjutning. Pulsen dör ut på ~6s (τ=2.5),
                // så snart är bara den lugna grunddriften kvar.
                const pulse = Math.exp(-t / 2.5);
                // Initial puls — stora svep i tre frekvenser för chaotisk vind.
                const pulseX = (Math.sin(t * 0.85) * 70 + Math.sin(t * 0.42) * 50 + Math.sin(t * 1.30) * 30) * pulse;
                const pulseY = (Math.sin(t * 0.71) * 45 + Math.sin(t * 0.33) * 32 + Math.sin(t * 1.10) * 18) * pulse;
                // Konstant grunddrift — små sinusvågor som lever vidare.
                const baseX = Math.sin(t * 0.18) * 10 + Math.sin(t * 0.07) * 6;
                const baseY = Math.sin(t * 0.13) * 7 + Math.sin(t * 0.05) * 4;
                const targetX = pulseX + baseX;
                const targetY = pulseY + baseY;
                // Första frame efter paus: synka last till vågens nuvarande
                // position så dx=0 → ingen abrupt panBy. Fasen löper vidare
                // under pausen, så vi tar bara vid där vi "skulle ha varit".
                if (wasPaused) {
                    last = { x: targetX, y: targetY };
                    resumeAt = now;
                    wasPaused = false;
                }
                // Fade-in efter återupptagning: 0 → 1 över 1s, ease-out.
                const sinceResume = (now - resumeAt) / 1000;
                const fade = Math.min(1, sinceResume / 1.0);
                const eased = 1 - Math.pow(1 - fade, 3);
                const dx = (targetX - last.x) * eased;
                const dy = (targetY - last.y) * eased;
                if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
                    map.panBy([dx, dy], { duration: 0, animate: false });
                }
                // last följer vågen i fullt belopp så fasen är intakt; bara
                // applicerad delta dämpas under fade-in.
                last = { x: targetX, y: targetY };
            } else {
                wasPaused = true;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(raf);
            map.off('dragstart', pause);
            map.off('drag', pause);
            map.off('zoomstart', pause);
            map.off('rotatestart', pause);
            map.off('pitchstart', pause);
            canvas.removeEventListener('pointerdown', pause);
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

        driftSuppressUntilRef.current = performance.now() + 1500;
        map.easeTo({
            center: [selectedEvent.lng, selectedEvent.lat],
            zoom: nextZoom,
            offset: [0, yOffset],
            duration: 500
        });
    };

    // 2. Hantera kamera-panorering och zoomning vid val av event.
    //    I gissningsläge flyttar vi ALDRIG kameran till det valda eventet — då
    //    skulle spelaren ju få mål-eventets position serverad direkt.
    useEffect(() => {
        if (gameMode) return;
        recenterOnSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded, gameMode]);

    // Recenter-knappen flyger kameran TILL ett moln (vi går dit — molnet
    // teleporteras inte till oss). Finns båda molnen framme → toggla till det
    // andra för varje klick (minns vilket vi gick till sist). Finns bara ett
    // moln → alltid det. Inget moln → inget händer.
    const lastRecenterRef = useRef<'main' | 'sun'>('sun');

    // Jagar ett moln som fortfarande är i luften (mitt i ett glid): räknar ut var
    // det landar utifrån live-hastighet + friktion, flyger kameran dit och slår
    // sedan på POV (follow) så vi följer det medan det glider klart. Avsluta med
    // tryck på molnet igen.
    const latchOntoGlidingCloud = (
        kind: 'main' | 'sun',
        state: { sp: { x: number; y: number }; vx: number; vy: number }
    ) => {
        const map = mapRef.current; if (!map) return;
        setMainFollowing(false);
        setSunFollowing(false);
        lastRecenterRef.current = kind;

        const startFollow = () => {
            if (kind === 'main') { setSunFollowing(false); setMainFollowing(true); }
            else { setMainFollowing(false); setSunFollowing(true); }
        };

        const k = 2.2 / 1000;       // matchar CloudPopups GLIDE_FRICTION
        const stopThreshold = 0.04;
        const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);

        if (speed < stopThreshold) {
            const ll = map.unproject([state.sp.x, state.sp.y]);
            driftSuppressUntilRef.current = performance.now() + 900;
            map.easeTo({ center: [ll.lng, ll.lat], duration: 500 });
            map.once('moveend', startFollow);
            return;
        }

        const landSP = { x: state.sp.x + state.vx / k, y: state.sp.y + state.vy / k };
        const targetLL = map.unproject([landSP.x, landSP.y]);
        const duration = Math.min(Math.max(Math.log(speed / stopThreshold) / k, 300), 2600);
        driftSuppressUntilRef.current = performance.now() + duration + 400;
        map.easeTo({
            center: [targetLL.lng, targetLL.lat],
            duration,
            easing: (t) => 1 - Math.pow(1 - t, 3)
        });
        map.once('moveend', startFollow);
    };

    const recenterOnClouds = () => {
        const map = mapRef.current;
        if (!map) return;

        const hasMain = showCloudRef.current && !!cloudAnchorRef.current;
        const hasSun = !!sunCloudAnchorRef.current;
        if (!hasMain && !hasSun) return;

        // Ett moln mitt i ett kast (glid) har inte commitat sitt nya ankare än —
        // läs live-glidet och JAGA molnet dit det faktiskt är på väg, inte dit det
        // kastades ifrån.
        const mainGlide = hasMain ? mainGlideStateRef.current : null;
        const sunGlide = hasSun ? sunGlideStateRef.current : null;
        if (mainGlide || sunGlide) {
            const g: 'main' | 'sun' = (mainGlide && sunGlide)
                ? (lastRecenterRef.current === 'main' ? 'sun' : 'main')
                : (mainGlide ? 'main' : 'sun');
            latchOntoGlidingCloud(g, (g === 'main' ? mainGlide : sunGlide)!);
            return;
        }

        // Ett iväg-kastat moln (ligger utanför bild) prioriteras.
        const mainThrown = hasMain && mainOffScreenRef.current;
        const sunThrown = hasSun && sunOffScreenRef.current;
        const thrown = mainThrown || sunThrown;

        let go: 'main' | 'sun';
        if (thrown) {
            if (mainThrown && sunThrown) go = lastRecenterRef.current === 'main' ? 'sun' : 'main';
            else go = mainThrown ? 'main' : 'sun';
        } else if (hasMain && hasSun) {
            // Växla till det andra molnet — men om målet redan ligger (nära) mitten
            // skulle det bli en ~1px-flytt. Hoppa då till det andra molnet.
            const cx = map.getContainer().clientWidth / 2;
            const cy = map.getContainer().clientHeight / 2;
            const distFromCenter = (a: { lat: number; lng: number } | null) => {
                if (!a) return -1;
                const p = map.project([a.lng, a.lat]);
                return Math.hypot(p.x - cx, p.y - cy);
            };
            const CENTER_EPS = 60; // px — räknas som "redan centrerat"
            go = lastRecenterRef.current === 'main' ? 'sun' : 'main';
            const other: 'main' | 'sun' = go === 'main' ? 'sun' : 'main';
            const goDist = distFromCenter(go === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current);
            const otherDist = distFromCenter(other === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current);
            if (goDist >= 0 && goDist < CENTER_EPS && otherDist >= CENTER_EPS) go = other;
        } else {
            go = hasMain ? 'main' : 'sun';
        }
        lastRecenterRef.current = go;

        const target = go === 'main' ? cloudAnchorRef.current : sunCloudAnchorRef.current;
        if (!target) return;
        // Pausa idle-driften under flytten (annars motas centreringen bort).
        driftSuppressUntilRef.current = performance.now() + 1600;
        map.easeTo({ center: [target.lng, target.lat], duration: 600 });

        if (thrown) {
            // Kastat moln + fokus: flyg dit OCH aktivera POV (follow) så vi följer
            // det medan det snurrar/glider klart. Avsluta med tryck på molnet igen.
            map.once('moveend', () => {
                if (go === 'main') { setSunFollowing(false); setMainFollowing(true); }
                else { setMainFollowing(false); setSunFollowing(true); }
            });
        } else {
            // Vanlig växling: molnen står still, bara kameran flyttas.
            setMainFollowing(false);
            setSunFollowing(false);
        }
    };

    useEffect(() => {
        if (recenterTrigger <= 0) return;
        recenterOnClouds();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recenterTrigger]);

    // Gissnings-streck: när det sätts (efter en felgissning) zoomar kartan ut/in
    // så BÅDE gissningen och rätt svar syns, och vi projicerar strecket direkt.
    // När det nollställs försvinner strecket.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) { setGuessLineScreen(null); return; }
        if (!guessLine) { setGuessLineScreen(null); return; }

        // Projicera direkt så strecket finns redan första framen.
        const pf = map.project([guessLine.from.lng, guessLine.from.lat]);
        const pt = map.project([guessLine.to.lng, guessLine.to.lat]);
        setGuessLineScreen({ from: { x: pf.x, y: pf.y }, to: { x: pt.x, y: pt.y } });

        // Zooma ut så båda punkterna ryms. Generös padding för banner (topp) och
        // eventkortet (botten) så streck och markörer inte hamnar under dem.
        const bounds = new maplibregl.LngLatBounds(
            [guessLine.from.lng, guessLine.from.lat],
            [guessLine.from.lng, guessLine.from.lat]
        );
        bounds.extend([guessLine.to.lng, guessLine.to.lat]);
        driftSuppressUntilRef.current = performance.now() + 2000;
        map.fitBounds(bounds, {
            padding: {
                top: 150,
                bottom: Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.42),
                left: 90,
                right: 90
            },
            maxZoom: 13,
            duration: 900
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guessLine]);

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
            driftSuppressUntilRef.current = performance.now() + duration + 400;
            map.easeTo({ center: target, duration, easing: (t) => 1 - Math.pow(1 - t, 3) });
        };
    const handleMainFling = useMemo(() => makeFlingHandler('main'), []);
    const handleSunFling = useMemo(() => makeFlingHandler('sun'), []);

    // Slangbella-avfyrning: anropas från drag-release-handlers när användaren
    // släpper ett moln efter att ha dragit det medan slangbellan var armad.
    // Det dragna molnet är projektilen — vi slungar det åt motsatt håll mot
    // dragget (origin → current ger pull-vektor; vi skjuter längs current →
    // origin och vidare ut, som en sten i en riktig slangbella).
    const fireSlingshot = (kind: 'main' | 'sun', curScreenX: number, curScreenY: number) => {
        const map = mapRef.current;
        if (!map) return;
        const snap = engageSnapshotRef.current;
        const origin = kind === 'main' ? snap.main : snap.sun;
        if (!origin) { onSlingshotFired?.(); return; }
        const cur = { x: curScreenX, y: curScreenY };
        const pullDist = Math.hypot(cur.x - origin.x, cur.y - origin.y);
        if (pullDist < 20) { onSlingshotFired?.(); return; } // för kort → avbryt
        // Vektor från current TILL origin = motsatt mot dragget. Snärten flyger
        // genom origin och vidare lika långt eller längre på andra sidan.
        const dx = origin.x - cur.x, dy = origin.y - cur.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len, uy = dy / len;
        const shoot = Math.min(1600, Math.max(600, pullDist * 3));
        const targetX = cur.x + ux * shoot;
        const targetY = cur.y + uy * shoot;
        const fromLL = map.unproject([cur.x, cur.y]);
        const toLL = map.unproject([targetX, targetY]);
        const startTime = performance.now();
        const duration = 900;
        const tick = (now: number) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const lat = fromLL.lat + (toLL.lat - fromLL.lat) * eased;
            const lng = fromLL.lng + (toLL.lng - fromLL.lng) * eased;
            const sp = map.project([lng, lat]);
            if (kind === 'main') {
                cloudAnchorRef.current = { lat, lng };
                setCloudAnchor({ lat, lng });
                setCloudAnchorPos({ x: sp.x, y: sp.y });
            } else {
                sunCloudAnchorRef.current = { lat, lng };
                setSunCloudAnchor({ lat, lng });
                setSunCloudAnchorPos({ x: sp.x, y: sp.y });
            }
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        onSlingshotFired?.();
    };

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

    // Slangbella aktiv när båda molnen är inom räckhåll av varandra (skärmpunkter
    // någorlunda nära). Större yta = man behöver inte träffa molnet exakt med det
    // andra — det räcker att de är i samma område för att fokus-knappen ska kunna
    // armas. Själva gummibanden visas inte här — bara när användaren armat läget.
    useEffect(() => {
        const a = cloudAnchorPos, b = sunCloudAnchorPos;
        const both = showCloud && sunCloudAnchor !== null && !!a && !!b;
        const inRange = both && Math.hypot(a!.x - b!.x, a!.y - b!.y) < 240;
        setSlingshotActive(!!inRange);
    }, [cloudAnchorPos, sunCloudAnchorPos, showCloud, sunCloudAnchor]);

    // Mood-överföring: drar man ett moln med en min OVANPÅ det andra molnet får
    // det andra molnet samma min. Vi använder live-drag-offsetterna för att veta
    // vilket moln som dras och var det är just nu (inkl. pågående drag).
    useEffect(() => {
        const a = cloudAnchorPos, b = sunCloudAnchorPos;
        if (!showCloud || sunCloudAnchor === null || !a || !b) return;
        const aPos = { x: a.x + mainLiveOffset.x, y: a.y + mainLiveOffset.y };
        const bPos = { x: b.x + sunLiveOffset.x, y: b.y + sunLiveOffset.y };
        const overlapping = Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y) < 90;
        if (!overlapping) return;
        const mainDragged = mainLiveOffset.x !== 0 || mainLiveOffset.y !== 0;
        const sunDragged = sunLiveOffset.x !== 0 || sunLiveOffset.y !== 0;
        // Det DRAGNA molnets min stämplas på det andra (om det dragna har en min
        // och de inte redan har samma — annars skulle det stämpla om i all evighet).
        if (mainDragged && mainMoodRef.current != null && sunMoodRef.current !== mainMoodRef.current) {
            setSunIncomingMood(prev => ({ mood: mainMoodRef.current, nonce: prev.nonce + 1 }));
        } else if (sunDragged && sunMoodRef.current != null && mainMoodRef.current !== sunMoodRef.current) {
            setMainIncomingMood(prev => ({ mood: sunMoodRef.current, nonce: prev.nonce + 1 }));
        }
    }, [mainLiveOffset, sunLiveOffset, cloudAnchorPos, sunCloudAnchorPos, sunCloudAnchor, showCloud]);

    const onSlingshotChangeRef = useRef(onSlingshotChange);
    onSlingshotChangeRef.current = onSlingshotChange;
    useEffect(() => {
        onSlingshotChangeRef.current?.(slingshotActive);
    }, [slingshotActive]);

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
            // Slangbella armad → avfyra åt motsatt håll mot dragget.
            if (slingshotEngagedRef.current) {
                fireSlingshot('sun', newScreenX, newScreenY);
            }
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
            // Slangbella armad → avfyra åt motsatt håll mot dragget.
            if (slingshotEngagedRef.current) {
                fireSlingshot('main', newScreenX, newScreenY);
            }
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

            // I gissningsläge highlightas ALDRIG mål-eventet — annars skulle dess
            // markör lysa upp blå och avslöja var spelaren ska klicka.
            const isSelected = !gameMode && !!inGroupSelected;
            const isSaved = group.some(e => savedEventIds.has(e.id));
            const isDiscarded = group.every(e => discardedEventIds.has(e.id));
            // Guld-markör = det rätta svaret som avslöjats. Skimrar och ligger överst.
            const isGold = !!goldEventId && group.some(e => e.id === goldEventId);
            // Markören man gissade på — hålls synlig (brickan visas direkt) efter avslöjet.
            const isGuessed = !!guessedEventId && group.some(e => e.id === guessedEventId);

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
            // (Guldmarkören + gissnings-brickan avslöjas också direkt — utan kö.)
            if (isSelected || isGold || isGuessed) revealedKeysRef.current.add(key);
            const isRevealed = revealedKeysRef.current.has(key);

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // För multi-event-grupper använder vi ett stabilt 'multi'-värde så
            // att stateKey inte ändras varje slideshow-tick (annars rivs brickan
            // ner och byggs upp igen + pop-in-animationen återstartas). Själva
            // emoji-bytet sker kirurgiskt längre ner.
            const stateKeyCategory = count > 1 ? 'multi' : (rep.category ?? 'other');
            const stateKey = `${isSelected}:${isRevealed}:${isSaved}:${isDiscarded}:${count}:${stateKeyCategory}:${startsWithinHour}:${isGold}`;

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
                const zIndex = isGold ? 1500
                    : isSelected ? 1000
                    : isSaved ? 500
                    : count > 1 ? 200
                    : isDiscarded ? -100 : 0;
                markerData.element.style.zIndex = String(zIndex);

                // Sätt eventlyssnare på klick. I gissningsläge är klicket en
                // gissning på hela gruppen i stället för ett vanligt val.
                markerData.element.onclick = (e) => {
                    e.stopPropagation();
                    if (gameModeRef.current) { onGuessRef.current?.(group); return; }
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

                const pinBg = isGold
                    ? 'linear-gradient(135deg, #fff7d6 0%, #fbbf24 45%, #d97706 100%)'
                    : isSaved ? '#ffffff' : '#1e293b';
                const pinBorder = isGold
                    ? '3px solid #fde68a'
                    : isSelected
                    ? '3px solid #006AA7'
                    : isSaved
                    ? '2px solid #5BA3CC'
                    : startsWithinHour
                    ? '2px solid #f97316'
                    : '2px solid rgba(255,255,255,0.25)';

                // Använd högpresterande CSS box-shadow
                const pinShadow = isGold
                    ? '0 0 0 4px rgba(251,191,36,0.35), 0 6px 22px rgba(217,119,6,0.55)'
                    : isSelected
                    ? '0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)'
                    : isSaved
                    ? '0 4px 10px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)';

                const scaleStyle = (isSelected || isGold) ? 'scale(1.25) translateY(-10px)' : 'scale(1)';
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
                            <div class="pin-bubble${isGold ? ' pin-bubble-gold' : ''}" style="background:${pinBg}; border:${pinBorder}; box-shadow: ${pinShadow};">
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
                    if (gameModeRef.current) { onGuessRef.current?.(group); return; }
                    onSelectEventRef.current(cycleRep);
                };
            }

            // Vald grupp med flera event: byt emoji till det event man tittar på,
            // och räkna ner siffran (kvar att bläddra till) medan man trycker
            // Nästa — kirurgiskt, utan att riva ner brickan.
            if (inGroupSelected && count > 1) {
                const selCatKey = inGroupSelected.category && EVENT_CATEGORIES[inGroupSelected.category]
                    ? inGroupSelected.category : 'other';
                const selEmoji = EVENT_CATEGORIES[selCatKey as EventCategoryType]?.emoji ?? '🎫';
                const emojiEl = markerData.element.querySelector('.pin-emoji');
                if (emojiEl && emojiEl.textContent !== selEmoji) emojiEl.textContent = selEmoji;

                // Siffran = count − position i bläddrings-ordningen. Nästa → index
                // ökar → siffran minskar; Bakåt → index minskar → siffran ökar.
                const idx = visitedOrderRef.current.indexOf(inGroupSelected.id);
                const remaining = Math.min(count, Math.max(1, count - (idx >= 0 ? idx : 0)));
                const remStr = remaining > 99 ? '99+' : String(remaining);
                markerData.element.querySelectorAll('.badge-needle-count, .badge-count').forEach((el) => {
                    if (el.textContent !== remStr) el.textContent = remStr;
                });
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
    }, [visibleGroups, selectedEvent, savedEventIds, discardedEventIds, slideshowTick, gameMode, goldEventId, guessedEventId]);

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
                /* Guld-markör: skimrar med en pulserande gloria runt brickan så
                   det rätta svaret syns tydligt även från avstånd. */
                @keyframes gold-marker-shimmer {
                    0%, 100% {
                        box-shadow: 0 0 0 3px rgba(251,191,36,0.30), 0 6px 22px rgba(217,119,6,0.45);
                        filter: brightness(1);
                    }
                    50% {
                        box-shadow: 0 0 0 7px rgba(251,191,36,0.12), 0 8px 28px rgba(217,119,6,0.7);
                        filter: brightness(1.18);
                    }
                }
                .pin-bubble-gold {
                    animation: gold-marker-shimmer 1.4s ease-in-out infinite;
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
            {/* Satellit/karta-toggle: liten knapp på höger sida, under navbaren.
                Växlar mellan vektor-stilen och en raster-satellitvy. */}
            <button
                type="button"
                onClick={() => setMapStyle(s => s === 'satellite' ? 'streets' : 'satellite')}
                aria-label={mapStyle === 'satellite' ? 'Byt till kartvy' : 'Byt till satellitvy'}
                title={mapStyle === 'satellite' ? 'Byt till kartvy' : 'Byt till satellitvy'}
                className={`absolute top-24 right-4 z-[900] h-10 w-10 rounded-full shadow-xl border flex items-center justify-center transition-colors backdrop-blur-md ${
                    mapStyle === 'satellite'
                        ? 'bg-[#006AA7] border-[#006AA7] text-white hover:bg-[#005590]'
                        : 'bg-white/90 border-white/50 text-slate-700 hover:bg-white'
                }`}
            >
                <Layers size={18} />
            </button>
            {/* Tilt-toggle: sitter under satellit-knappen. Växlar snabbt mellan att
                kolla rakt ner på kartan (platt) och med vinkel (3D-sidovy). */}
            <button
                type="button"
                onClick={() => onToggleTilt?.()}
                aria-label={tilted ? 'Platta ut kartan' : 'Luta kartan'}
                title={tilted ? 'Platta ut kartan' : 'Luta kartan'}
                className={`absolute top-[140px] right-4 z-[900] h-10 w-10 rounded-full shadow-xl border flex items-center justify-center transition-colors backdrop-blur-md ${
                    tilted
                        ? 'bg-[#006AA7] border-[#006AA7] text-white hover:bg-[#005590]'
                        : 'bg-white/90 border-white/50 text-slate-700 hover:bg-white'
                }`}
            >
                <Box size={18} />
            </button>
            {/* Slangbella-gummiband: ritas mellan huvudmolnet och solmolnet.
                Använder live drag-offsetterna så banden stretchar med molnet i
                realtid när användaren drar. När slangbellan är "engaged" (armad
                via fokusknappen) syns banden alltid; annars fadar de in när
                molnen är nära varandra. */}
            {showCloud && cloudAnchorPos && sunCloudAnchorPos && slingshotEngaged && (() => {
                const aRaw = { x: cloudAnchorPos.x + mainLiveOffset.x, y: cloudAnchorPos.y + mainLiveOffset.y };
                const bRaw = { x: sunCloudAnchorPos.x + sunLiveOffset.x, y: sunCloudAnchorPos.y + sunLiveOffset.y };
                const distRaw = Math.hypot(aRaw.x - bRaw.x, aRaw.y - bRaw.y);
                // Banden visas BARA när slangbellan är armad — i ready-läget syns
                // ingenting, fokusknappen ändras bara så användaren kan godkänna.
                const opacity = 1;
                // Degenererat fall: när molnen ligger ovanpå varandra (eller mycket
                // nära) finns ingen riktning mellan dem → bandberäkningen kollapsar.
                // Vi tvingar då fram en minsta horisontell separation så banden
                // syns som ett armat "=" runt molnen, redo att dras isär.
                const minDist = 36;
                let a = aRaw, b = bRaw;
                if (distRaw < minDist) {
                    const cx0 = (aRaw.x + bRaw.x) / 2, cy0 = (aRaw.y + bRaw.y) / 2;
                    a = { x: cx0 - minDist / 2, y: cy0 };
                    b = { x: cx0 + minDist / 2, y: cy0 };
                }
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const dx = b.x - a.x, dy = b.y - a.y;
                const len = Math.max(1, Math.hypot(dx, dy));
                const nx = -dy / len, ny = dx / len; // perpendikulär
                const spread = 13; // halva bandbredden i pixlar
                const sag = 18 + dist * 0.08; // hur mycket banden bågnar utåt
                const a1 = { x: a.x + nx * spread, y: a.y + ny * spread };
                const a2 = { x: a.x - nx * spread, y: a.y - ny * spread };
                const b1 = { x: b.x + nx * spread, y: b.y + ny * spread };
                const b2 = { x: b.x - nx * spread, y: b.y - ny * spread };
                const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
                const c1 = { x: cx + nx * (spread + sag), y: cy + ny * (spread + sag) };
                const c2 = { x: cx - nx * (spread + sag), y: cy - ny * (spread + sag) };
                return (
                    <svg
                        className="absolute inset-0 pointer-events-none"
                        style={{ width: '100%', height: '100%', opacity, transition: 'opacity 0.2s ease-out' }}
                    >
                        <path
                            d={`M ${a1.x} ${a1.y} Q ${c1.x} ${c1.y} ${b1.x} ${b1.y}`}
                            stroke="#006AA7" strokeWidth={4} strokeLinecap="round" fill="none"
                            opacity={0.85}
                        />
                        <path
                            d={`M ${a2.x} ${a2.y} Q ${c2.x} ${c2.y} ${b2.x} ${b2.y}`}
                            stroke="#006AA7" strokeWidth={4} strokeLinecap="round" fill="none"
                            opacity={0.85}
                        />
                    </svg>
                );
            })()}
            {/* Gissnings-streck: streckad linje mellan din gissning och rätt svar,
                med avståndet i mitten. Ritas efter en felgissning i spelet. */}
            {guessLineScreen && guessLine && (() => {
                const a = guessLineScreen.from, b = guessLineScreen.to;
                const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
                return (
                    <>
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
                            <line
                                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                stroke="#f59e0b" strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" opacity={0.95}
                            />
                            <circle cx={a.x} cy={a.y} r={7} fill="#475569" stroke="#fff" strokeWidth={2.5} />
                            <circle cx={b.x} cy={b.y} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />
                        </svg>
                        {guessLine.label && (
                            <div
                                className="absolute -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg border border-white/60 pointer-events-none whitespace-nowrap"
                                style={{ left: midX, top: midY }}
                            >
                                {guessLine.label}
                            </div>
                        )}
                    </>
                );
            })()}
            {showCloud && cloudAnchorPos && (
                <CloudPopup
                    message={cloudStats ? (
                        <span className="block font-rounded tracking-tight" style={{ transform: 'translateY(-12px)' }}>
                            <span
                                className="block text-[19px] sm:text-[23px] leading-tight whitespace-nowrap"
                                style={{ color: '#006AA7', fontWeight: 700, letterSpacing: '-0.01em' }}
                            >
                                {cloudStats.today} unika event idag
                            </span>
                            <span
                                className="block text-[15px] sm:text-[17px] leading-snug my-1"
                                style={{ color: '#006AA7', fontWeight: 600 }}
                            >
                                {cloudStats.withinHour} börjar inom {cloudStats.withinHours} {cloudStats.withinHours === 1 ? 'timme' : 'timmar'}.
                            </span>
                            <span
                                className="block text-[13px] sm:text-[14px] leading-snug"
                                style={{ color: '#006AA7', fontWeight: 500 }}
                            >
                                Alla spontana event i Sverige.
                            </span>
                        </span>
                    ) : `Se alla publika event du kan anmäla dig till idag. Ett nytt kan dyka upp nästa sekund.`}
                    anchorPos={cloudAnchorPos}
                    onDragEnd={handleCloudDragEnd}
                    onDismiss={() => { setShowCloud(false); setMainFollowing(false); }}
                    following={mainFollowing}
                    onToggleFollow={() => setMainFollowing(f => !f)}
                    onFollowFling={handleMainFling}
                    glideStateRef={mainGlideStateRef}
                    onLiveOffsetChange={(ox, oy) => setMainLiveOffset({ x: ox, y: oy })}
                    onMoodChange={setMainMood}
                    incomingMood={mainIncomingMood.mood}
                    incomingMoodNonce={mainIncomingMood.nonce}
                    tilted={tilted}
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
                    glideStateRef={sunGlideStateRef}
                    onLiveOffsetChange={(ox, oy) => setSunLiveOffset({ x: ox, y: oy })}
                    onMoodChange={setSunMood}
                    incomingMood={sunIncomingMood.mood}
                    incomingMoodNonce={sunIncomingMood.nonce}
                    onTap={onSunCloudTap}
                    tilted={tilted}
                />
            )}
        </div>
    );
}
