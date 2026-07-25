'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Tags, Globe, Mountain, Plus, Video, Target, Crosshair, Sparkles, Lock, Users, Satellite, Flag, Map as MapIcon, Moon } from 'lucide-react';
import { EventWish, isVadkulHostedEvent, LinkEvent } from '../../types';
import { EVENT_CATEGORIES } from '../../utils/categories';
import { isValidLatLng } from '../../utils/mapUtils';
import { isEventFeatured } from '../../services/linkEventService';
import toast from 'react-hot-toast';
// Baskartstilar (Voyager/satellit/mörk/nöjesfält) + klot/terräng/relief-hjälpare.
import {
    BOOTSTRAP_STYLE, DARK_STYLE_URL, SATELLITE_STYLE, STREETS_STYLE_URL,
    THEMEPARK_LAND_COLOR, fetchAndTransformThemeParkStyle,
    applyHillshade, applyProjection, applyTerrain,
} from './v2MapBaseStyles';
// Brick-utseendet: emoji-/färguppslag + canvas-bakningen av GL-brickbilderna.
import {
    BRICKA_DARK_BG, WISH_DOT_HEX,
    brickaBodyBg, brickaBodyHex, eventEmoji, groupIsPast, groupKeyOf, groupStartsWithinHour, isEventPast,
    makeBrickaImageData, sourceGradientCss,
} from './v2MapBricka';
// Multi-event-listan (panelen som öppnas vid brickor med flera event).
import V2MapGroupList from './V2MapGroupList';

// ════════════════════════════════════════════════════════════════════════════
// V2Map — kartan är appens hjärta. Grov karta över filen:
//
//   1. Modul-konstanter: reveal-tuning + startvy.
//   2. Data-pipeline (memos): events → groups (per koordinat) → visibleGroups
//      (de få "speciella" DOM-brickorna) + plainData (allt annat som ETT
//      GPU-symbol-lager, "plain-events").
//   3. Reveal-systemet: GL-brickorna börjar dolda; vid start tänds de N närmast
//      användarens plats (om känd — annars bara nål-prickarna), sen "resa +
//      insug" (startRevealTravel) till de N närmast tappet.
//   4. Kart-init (effekt, körs en gång): MapLibre-instans, zoom-lägen
//      (brickor ↔ prickar), klick-hantering, bounds-rapportering.
//   5. Stil-/läges-effekter: mapStyle, klot, 3D-terräng, kamera (recenter/zoom).
//   6. DOM-markör-synken: de speciella grupperna som riktiga DOM-element.
//   7. Render: kartcontainer + inline markör-CSS + overlays (multi-event-lista,
//      WebGL-fallback, funktions-väskan).
//
// Rena hjälpare bor i ./v2MapBaseStyles (kartstilar) och ./v2MapBricka
// (markörernas utseende) — den här filen äger allt som rör kart-INSTANSEN.
// ════════════════════════════════════════════════════════════════════════════

// En GL-markör-feature: punkt + vilken bakad bild + grupp-nyckel (för klick).
type PlainFeature = {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    // count = antal event i gruppen (>1 → "+N"-bricka i hörnet); 1 för enskilda.
    // color = kategorifärg (hex) för nål-pricken; mörk standard för stora källor.
    // sortKey = count + stor boost för den VALDA gruppen → den valda brickan
    // ritas ALLTID överst i GL-lagret (gäller både multi-event och enskilda).
    // past = ALLA event i gruppen har redan varit → brickan släcks helt och
    // gruppen visas som sin nål-prick (dämpad till 50 %).
    properties: { icon: string; key: string; count: number; color: string; sortKey: number; past: boolean };
};

// En cyklande multibrickas rotation: den EGNA cykel-bildens id + frames i tur-
// ordning. eventId = eventet bakom framen — klicket ska öppna det som VISAS.
type CycleRotation = {
    icon: string;
    frames: { emoji: string; color?: string; saved?: boolean; eventId: string }[];
};

// Det event vars frame en cyklande multibricka visar JUST NU. frameIdx (pumpens
// skrivcache) är per BILD-id: ett nytt bild-id saknar post → index 0 = frame 0,
// exakt vad den nybakade bilden visar. Delas av GL-klicket och DOM-markör-
// synken så de aldrig pekar ut olika event än det som faktiskt syns.
function shownCycleEvent(rot: CycleRotation | undefined, frameIdx: Map<string, number>, group: LinkEvent[]): LinkEvent | undefined {
    if (!rot || rot.frames.length === 0) return undefined;
    const fr = rot.frames[(frameIdx.get(rot.icon) ?? 0) % rot.frames.length];
    return fr ? group.find(ev => ev.id === fr.eventId) : undefined;
}

// Opacity-faktor för "har varit"-grupper: 0.5 när properties.past är satt,
// annars 1. Används i zoom-lägets prick-uttryck (alla prickar synliga, passerade
// dämpade).
const PAST_DIM_EXPR: maplibregl.ExpressionSpecification =
    ['case', ['boolean', ['get', 'past'], false], 0.5, 1];
// "Har varit"-grupper visas inte längre som (dämpade) brickor — brickan (och
// "+N"-badgen) släcks HELT och gruppen står kvar som sin nål-prick, dämpad till
// 50 %. Uttrycken delas av lager-skapandet (syncPlainLayer) och återställningen
// efter zoom (hideNeedleDotsWhenRendered) så vilo-looken aldrig glider isär.
const IS_PAST_EXPR: maplibregl.ExpressionSpecification =
    ['boolean', ['get', 'past'], false];
const REVEAL_STATE_EXPR: maplibregl.ExpressionSpecification =
    ['coalesce', ['feature-state', 'reveal'], 0];
// Bricka + "+N"-badge: följer reveal-state, men ALDRIG för passerade grupper.
const BRICKA_OPACITY_EXPR: maplibregl.ExpressionSpecification =
    ['case', IS_PAST_EXPR, 0, REVEAL_STATE_EXPR];
// Nål-pricken i vila: passerade grupper ALLTID prick (50 %), övriga bara när
// brickan är släckt (1 − reveal).
const DOT_REST_OPACITY_EXPR: maplibregl.ExpressionSpecification =
    ['case', IS_PAST_EXPR, 0.5, ['-', 1, REVEAL_STATE_EXPR]];
const DOT_REST_STROKE_OPACITY_EXPR: maplibregl.ExpressionSpecification =
    ['case', IS_PAST_EXPR, 0.45, ['*', 0.9, ['-', 1, REVEAL_STATE_EXPR]]];

// Är två feature-listor IDENTISKA till innehållet? plainData byggs om vid varje
// events-uppdatering (nya arrayer), men cards-/descriptions-mergarna och pollen
// ändrar inget som GL-lagret ritar (position/emoji/färg/count kommer allihop
// från destinations-fälten) → deras pushar är rena no-ops till innehållet.
// Utan denna koll dödade de den pågående våg-streamen och tvingade fram en
// monolitisk full setData — DET var väntan under "Ritar ut eventen…" innan
// första pricken syntes. Billig: ~längd × 7 jämförelser.
function samePlainFeatures(a: PlainFeature[], b: PlainFeature[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        const pa = a[i].properties, pb = b[i].properties;
        if (pa.key !== pb.key || pa.icon !== pb.icon || pa.count !== pb.count ||
            pa.color !== pb.color || pa.sortKey !== pb.sortKey || pa.past !== pb.past) return false;
        const ca = a[i].geometry.coordinates, cb = b[i].geometry.coordinates;
        if (ca[0] !== cb[0] || ca[1] !== cb[1]) return false;
    }
    return true;
}

// ── "Skrapa fram"-markörer: tunbara konstanter ────────────────────────────────
// Vid laddning tänds SEEDET DIREKT: de REVEAL_SEED_COUNT brickorna närmast
// ANVÄNDARENS PLATS — men bara om platsen faktiskt är känd (GPS eller tap).
// Vet vi inte var besökaren är tänds INGA brickor vid start: kartan visar bara
// nål-prickarna (kartmitten säger inget om var besökaren står). Ingen hover —
// man TRYCKER: de REVEAL_NEAREST_COUNT närmaste brickorna kring trycket
// avslöjas och ligger KVAR (panorering byter inte urvalet) tills man trycker
// på nytt. Vid ett nytt tryck BYTS urvalet ut med en kugghjuls-effekt (se
// nedan). Ingen queryRenderedFeatures (den var det tunga som laggade): vi
// räknar avståndet själva (O(antal), kvadrerat + cos-lat-skalad longitud) och
// sätter feature-state direkt via nyckeln (promoteId 'key'). Aldrig fler än
// ~N synliga samtidigt = ingen lagg.
const REVEAL_NEAREST_COUNT = 50;      // antal markörer kring ett tap (de N närmaste)
const REVEAL_SEED_COUNT = 50;         // antal tända vid start kring användarens plats (utan tap)
// Övergång mellan två klickpunkter = en PARALLELL MIGRATION: de N brickorna "flyttar"
// sig mot klicket var och en i sin egen takt (olika hastigheter). Några skjuter fram
// och syns vid destinationen nästan direkt, andra släpar — jämn spridning längs vägen,
// alla landar till slut på de N närmast klicket. (Tidigare modeller: rigid marsch /
// bro som tänjdes ut + kollapsade — bägge kändes som "grova hopp"/"två varv".)
// RESA + INSUG: vid ett klick åker FÖRST en enda bricka mot punkten (RESA), sedan dras
// destinationens event in mot punkten en-och-en (INSUG). RESANS tid skalar LINJÄRT med
// hur långt man klickar på skärmen — kort hopp tar den MINDRE av de två tiderna, hopp
// över hela skärmen den STÖRRE (ordningen spelar ingen roll, koden tar min/max).
// OBS: vid 50/50 är resan nästan momentan — höj värdena för att se brickan "åka".
const REVEAL_STREAM_MS = 50;        // restid (ms) för KORT hopp (samma trakt) — lägre = snabbare
const REVEAL_STREAM_MS_MAX = 50;    // restid (ms) för LÅNGT hopp (hela skärmen) — högre = långsammare
// Antal samtidigt TÄNDA reveal-markörer ska normalt ligga ≤ seed (50) / ≤ N-kring-tap
// (50). Fler än så = något läcker (strandade brickor o.dyl.) → console.warn så man
// ser direkt att det behöver korrigeras. (Logg + ev. varning via reportRevealCount.)
const REVEAL_VISIBLE_WARN = 80;

// ── Streamad utritning av eventmarkörerna ────────────────────────────────────
// Den INITIALA påfyllnaden (källan tom → tusentals features) portioneras i
// VÅGOR så prickarna dyker upp pö om pö direkt när datan landat, i stället för
// i en enda smäll flera sekunder senare (ikonbakning + tiling + symbollayout
// för allt på en gång). Ingen extra nätverkstrafik — datan är redan hämtad;
// bara UTRITNINGEN portioneras. Två saker gör vågorna FAKTISKT synliga (första
// försöket — fast timer + full setData per steg — var det inte: workern hann
// inte tila varje generation på steg-tiden, MapLibre slog ihop köade setData
// och mellanstegen renderades aldrig → fortfarande "allt på en gång"):
//   1. Event-driven takt: nästa våg skickas först när källan BEKRÄFTAT att
//      förra vågen är inne (sourcedata/isSourceLoaded) + en kort paus.
//   2. updateData({add})-diffar: bara de NYA featurena överförs per våg — inte
//      hela den ackumulerade mängden igen som setData gör.
// Första vågen är liten (något ska synas DIREKT — få ikoner att baka, lite att
// tila); sedan dubblas vågstorleken upp till taket så helheten ändå går snabbt.
// Små ändringar (dagbyte, cards-merge, poll) pushas som en enda setData som förr.
const STREAM_MIN_GROWTH = 300;      // färre NYA features än så → ingen stream, en setData
const STREAM_PREV_MAX = 25;         // fler än så i källan redan → ingen stream (bara initialen)
const STREAM_CHUNK_START = 50;      // första vågen (liten → första prickarna syns direkt)
const STREAM_CHUNK_MAX = 400;       // vågtak (dubblas dit: 50, 100, 200, 400, 400…)
const STREAM_STEP_MS = 80;          // paus efter att förra vågen bekräftats inne
const STREAM_WAVE_TIMEOUT_MS = 800; // säkerhetsnät: skicka nästa våg ändå om signalen uteblir

// ── WebGL-livräddare ──────────────────────────────────────────────────────────
// Efter en WebGL-kontextförlust (eller mitt i teardown) är map.style borta och
// BÅDE getLayer() och isStyleLoaded() KASTAR — rAF-loopar och effekter som
// pollar kartan ska då svara "inte redo", inte krascha React-trädet (sågs live:
// "Cannot read properties of null (reading 'getLayer')" efter 5h öppen flik).
const styleReady = (map: maplibregl.Map): boolean => {
    try { return !!map.isStyleLoaded(); } catch { return false; }
};
const layerExists = (map: maplibregl.Map, id: string): boolean => {
    try { return !!map.getLayer(id); } catch { return false; }
};

// Startvy: centrerad kring Mälardalen/södra Dalarna, mer inzoomad än hela
// landet — nedflyttad en grad (60.5→59.5) så man ser längre NER i Sverige
// direkt. (GPS flyger sedan dit man faktiskt står när den hunnit fram.)
// Tunbart: sänk lat = mer söderut, höj lat = längre upp, höj lng = åt
// höger/öster, höj zoom = mer inzoomat.
const START_CENTER: [number, number] = [15.8, 61.0]; // [lng, lat] — sänk lat = söderut
const START_ZOOM = 4.9; // utzoomad från 5.2 — kartans minZoom är 4, gå inte under det

interface V2MapProps {
    events: LinkEvent[];
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    savedEventIds?: Set<string>;
    discardedEventIds?: Set<string>;
    cardExpanded?: boolean;
    onCenterChange?: (lat: number, lng: number) => void;
    onMapDrag?: () => void;
    /** True så fort första event-svaret från databasen kommit. Default true
     *  (bakåtkompat). */
    eventsLoaded?: boolean;
    /** True först när ALLA aggregat-lager (destinations+cards+descriptions)
     *  landat. Mellan eventsLoaded och eventsSettled visar kartan en diskret
     *  "Laddar fler event…"-pill; därefter ligger pillen kvar ("Ritar ut
     *  eventen…") tills GL-symbolerna faktiskt målats på kartan. Default true
     *  (bakåtkompat). */
    eventsSettled?: boolean;
    /** Bumpas av zoom-knappen i Nästa-pillen → zooma IN på det valda eventet
     *  (vanliga val står still/zoomar inte; detta är den explicita inzoomningen). */
    zoomToEventTrigger?: number;
    /** Bumpas av zooma-ut-knappen i Nästa-pillen → zooma UT (samma center). */
    zoomOutTrigger?: number;
    /** Bumpas vid dagbyte. Då väljer sidan eventet närmast kartans mitt OCH vi
     *  låter bli att flytta kameran till det — vyn ska stå still vid dagbyte. */
    daySwitchNonce?: number;
    /** Bumpas vid intern kort-navigering (Nästa/Föregående/svep). Då står kameran
     *  kvar — vi panorerar/flyger INTE till eventet man bläddrar fram till. */
    navSelectNonce?: number;
    /** Skickar shop-flaggor uppåt så page.tsx kan gömma/visa knappar som inte
     *  bor i V2Map (t.ex. sol-knappen + fokus-knappen i EventCard, eller
     *  +-knappen i navbaren för att skapa event). Fyrar varje gång användaren
     *  togglar något relevant i shoppen. */
    onFeatureFlagsChange?: (flags: { createEvent: boolean; multiplayer: boolean }) => void;
    /** Triggas när användaren klickar på Multiplayer-badgen i shoppen och inte är
     *  inloggad — föräldern hanterar då navigation till /login så användaren kan
     *  registrera sig / skapa konto. */
    onActivateMultiplayer?: () => void;
    /** Fyrar när funktions-"väskan" (uppe till vänster) öppnas/stängs. Sidan
     *  använder det för att tillfälligt gömma poäng-brickan som annars ligger i
     *  samma vänsterkolumn och skulle krocka med utfällningen. */
    onFuncBagOpenChange?: (open: boolean) => void;
    /** Fyrar när användarens GPS-position blir känd/uppdateras (samma position
     *  som den blå plats-pricken — hämtas tyst vid start + "Min plats"-knappen).
     *  Sidan skickar den vidare till EventCard som visar avstånd till valt event. */
    onUserPosChange?: (pos: { lat: number; lng: number } | null) => void;
    /** Aktiva event-ÖNSKNINGAR (eventWishes) — renderas som egna drömska,
     *  ALLTID synliga brickor (sticky force-reveal, samma mönster som
     *  userCreated-event). Blandas ALDRIG in i events/"Nästa"-poolen. */
    wishes?: EventWish[];
    /** Klick på en önske-bricka → önskan; klick på tom karta → null (stäng
     *  önske-kortet). Sidan renderar det lilla önske-kortet. */
    onSelectWish?: (wish: EventWish | null) => void;
    /** Stjärn-gåvan ⭐: eventId:n som fått en stjärna (läses live ur eventStars).
     *  Stjärnmärkta event får guld-bricka, force-reveal (alltid tända, som
     *  userCreated) och blir representant i sin multi-event-grupp — tills
     *  eventet passerat (då gäller vanliga past-släckningen). */
    starredEventIds?: Set<string>;
    /** Fyrar EN gång när första prick-rundan är färdigmålad (symbolsPainted-
     *  latchen). Sidan släpper då linkEventService.releaseHeavyLayers() så
     *  cards/descriptions börjar hämtas — de ska inte konkurrera med tiles +
     *  prickar om bandbredden på smala nät. */
    onFirstPaint?: () => void;
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
    eventsLoaded = true,
    eventsSettled = true,
    zoomToEventTrigger = 0,
    zoomOutTrigger = 0,
    daySwitchNonce = 0,
    navSelectNonce = 0,
    onFeatureFlagsChange,
    onActivateMultiplayer,
    onFuncBagOpenChange,
    onUserPosChange,
    wishes = [],
    onSelectWish,
    starredEventIds = new Set(),
    onFirstPaint,
}: V2MapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<Map<string, { marker: maplibregl.Marker; element: HTMLElement; lastStateKey: string }>>(new Map());
    // Grupp-nycklar som någon gång visats som bricka via att vara markerade.
    // En gång avslöjad → brickan visas alltid direkt (ingen staggered kö), så
    // ett event man navigerat förbi inte faller tillbaka till nål.
    const revealedKeysRef = useRef<Set<string>>(new Set());
    // Nyckel → tidpunkt då markörens pop-in är klar. Panorerar man bort och
    // tillbaka ska brickor som redan ploppat visas DIREKT — inte ställa sig i
    // den utspridda pop-in-kön igen. (Markör-DOM:en rivs när den lämnar bild,
    // så minnet måste bo här och inte i markerData.)
    const poppedKeysRef = useRef<Map<string, number>>(new Map());
    // Minut-tick: "börjar inom 1 timme"-statusen (orange) räknas från Date.now()
    // i markör-synken — utan tick uppdateras den bara när man råkar flytta
    // kartan. Ticken låter statusen följa klockan.
    const [minuteTick, setMinuteTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setMinuteTick(t => t + 1), 60_000);
        return () => clearInterval(id);
    }, []);

    const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);
    // Klick på en MULTI-event-markör (grupp med >1 event) öppnar en lista (emoji +
    // titel + tid) så man kan välja vilket event i högen man vill öppna. null = ingen.
    // (Man kan ALTERNATIVT bläddra via pagern "3/7" på kortets platsrad.)
    const [groupList, setGroupList] = useState<LinkEvent[] | null>(null);
    // Geo-ankaret (lng/lat) för den klickade multi-event-brickan + dess projicerade
    // skärmposition. Listan placeras i brickans ÖVRE HÖGRA hörn och följer punkten
    // när kartan pannas/zoomas (uppdateras i updateCloudPosition på move/zoom).
    const [groupListAnchor, setGroupListAnchor] = useState<{ lng: number; lat: number } | null>(null);
    const groupListAnchorRef = useRef<{ lng: number; lat: number } | null>(null);
    groupListAnchorRef.current = groupListAnchor;
    const [groupListPos, setGroupListPos] = useState<{ x: number; y: number } | null>(null);
    // True medan användaren aktivt zoomar (zoomstart→zoomend). Under gesten ritas
    // multi-event-grupper som lätta GL-prickar; i vila som fulla DOM-brickor. De två
    // är ÖMSESIDIGT UTESLUTANDE — aldrig bägge synliga. Ref:en speglar staten så att
    // syncPlainLayer kan sätta rätt initial-synlighet på prick-lagren om stilen
    // laddas om mitt under en zoom.
    const [isZooming, setIsZooming] = useState<boolean>(false);
    const isZoomingRef = useRef<boolean>(false);
    // Default = 'themepark' ("Nöjesfält"-kartan). Satellit m.fl. går fortfarande att
    // välja i Funktioner-väskan, men nöjesfält är förvald vid varje sidladdning.
    const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'themepark' | 'dark' | 'orientering'>('themepark');
    const mapStyleRef = useRef(mapStyle);
    mapStyleRef.current = mapStyle;
    // Cache för den hämtade + mildrade nöjesfälts-stilen (Voyager-transform).
    const themeParkStyleRef = useRef<maplibregl.StyleSpecification | null>(null);
    // True om WebGL inte gick att initiera (t.ex. blockerad efter en tidigare
    // kontextförlust). Då visar vi en fallback-ruta i stället för att krascha.
    const [mapError, setMapError] = useState(false);

    // Två oberoende 3D-lägen — deklarerade tidigt så shop-flaggornas
    // isFeatureActive() kan läsa dem under render (annars TDZ-error). Mer
    // detaljer om hur de samverkar finns i kommentaren längre ned där
    // applyProjection/applyTerrain används.
    const [isGlobe, setIsGlobe] = useState(false);
    const [is3DTerrain, setIs3DTerrain] = useState(false);
    const isGlobeRef = useRef(isGlobe);
    isGlobeRef.current = isGlobe;
    const is3DTerrainRef = useRef(is3DTerrain);
    is3DTerrainRef.current = is3DTerrain;

    // Funktions-"väskan" uppe till vänster: fäller ut en inline-lista med
    // kart-funktioner (kartstilar, skapa event m.m.). OBS: knappen som öppnar
    // den är just nu bortkopplad i renderingen (layout-test, se "HIDDEN per
    // Josef"-blocken längst ner) — logiken behålls tills testet är avgjort.
    const [funcBagOpen, setFuncBagOpen] = useState(false);

    // "Min plats": geolocation-knapp under lutnings-knappen. Position visas som
    // en pulserande blå punkt (egen maplibre-markör — överlever stilbyten).
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
    // Live-ref så reveal-seedet (callback med deps []) kan utgå från ANVÄNDARENS plats
    // i stället för kartmitten (annars hamnar default-eventen mitt i Sverige/Östersund).
    const userPosRef = useRef(userPos);
    userPosRef.current = userPos;
    // Rapportera positionen uppåt (ref så effekten inte behöver callbacken som dep).
    const onUserPosChangeRef = useRef(onUserPosChange);
    onUserPosChangeRef.current = onUserPosChange;
    useEffect(() => { onUserPosChangeRef.current?.(userPos); }, [userPos]);
    const [locating, setLocating] = useState(false);
    const userPosMarkerRef = useRef<maplibregl.Marker | null>(null);
    const handleLocateMe = () => {
        if (locating) return;
        if (!('geolocation' in navigator)) {
            toast.error('Din webbläsare saknar platstjänster.');
            return;
        }

        const map = mapRef.current;
        if (!map) return;

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserPos(next);
                setLocating(false);
                map.flyTo({ center: [next.lng, next.lat], zoom: Math.max(map.getZoom(), 12), duration: 1200 });
            },
            (err) => {
                setLocating(false);
                toast.error(err.code === err.PERMISSION_DENIED
                    ? 'Platsåtkomst nekad — tillåt plats i webbläsaren för att hitta dig.'
                    : 'Kunde inte hämta din plats just nu.');
            },
            { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
        );
    };

    // Fokus-knappen (under funktions-knappen): centrera kartan på det valda
    // eventet om något är valt, annars passa in alla dagens event i vyn.
    // I gissningsläge flyger vi INTE till det valda (dolda) mål-eventet — det
    // skulle avslöja svaret — utan passar in alla event.
    const handleFocusClick = () => {
        const map = mapRef.current;
        if (!map) return;
        if (selectedEvent && isValidLatLng(selectedEvent.lat, selectedEvent.lng)) {
            map.flyTo({ center: [selectedEvent.lng!, selectedEvent.lat!], zoom: Math.max(map.getZoom(), 13), duration: 900 });
            return;
        }
        const pts = events.filter(e => isValidLatLng(e.lat, e.lng));
        if (pts.length === 0) return;
        const b = new maplibregl.LngLatBounds([pts[0].lng!, pts[0].lat!], [pts[0].lng!, pts[0].lat!]);
        pts.forEach(e => b.extend([e.lng!, e.lat!]));
        map.fitBounds(b, { padding: 80, maxZoom: 13, duration: 900 });
    };
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !userPos) return;
        if (!userPosMarkerRef.current) {
            const el = document.createElement('div');
            el.className = 'user-pos-dot';
            el.setAttribute('aria-label', 'Din plats');
            userPosMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([userPos.lng, userPos.lat])
                .addTo(map);
        } else {
            userPosMarkerRef.current.setLngLat([userPos.lng, userPos.lat]);
        }
    }, [userPos]);
    // Refs till knappen + den utfällda panelen så ett klick utanför båda
    // stänger väskan (panelen renderas via portal, därav två separata refs).
    const funcBagBtnRef = useRef<HTMLButtonElement>(null);
    const funcBagPanelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!funcBagOpen) return;
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            if (funcBagBtnRef.current?.contains(target)) return;
            if (funcBagPanelRef.current?.contains(target)) return;
            setFuncBagOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [funcBagOpen]);
    // Rapportera öppet/stängt uppåt så sidan kan gömma spel-knapparna (poäng +
    // Hitta event) medan väskan är utfälld — de delar vänsterkolumn.
    const onFuncBagOpenChangeRef = useRef(onFuncBagOpenChange);
    onFuncBagOpenChangeRef.current = onFuncBagOpenChange;
    useEffect(() => {
        onFuncBagOpenChangeRef.current?.(funcBagOpen);
    }, [funcBagOpen]);

    // Shop-flaggor: vilka funktioner som är "påslagna". Funktioner med egen
    // state i V2Map (globe/terräng/kartstil) hanteras separat i setFeatureActive
    // så väskan har en enda gemensam UI-modell; resten (createEvent/multiplayer/
    // record) lever här. createEvent/multiplayer skickas upp till page.tsx som
    // styr knappars synlighet utanför V2Map via onFeatureFlagsChange.
    type ShopFlags = {
        createEvent: boolean;
        multiplayer: boolean;
        record: boolean;
    };
    const [shopFlags, setShopFlags] = useState<ShopFlags>({
        // Nöjesfält (mapStyle='themepark') är förvald kartstil från start — allt
        // annat av. Satellit m.fl. kan väljas i Funktioner-väskan.
        createEvent: true,    // PÅ som default — att skapa event är en kärnfunktion
                              // (onboardingen lovar det). Kan stängas av i väskan.
        multiplayer: false,   // kräver konto-registrering
        record: false         // låst tills "köpt"
    });

    const onFeatureFlagsChangeRef = useRef(onFeatureFlagsChange);
    onFeatureFlagsChangeRef.current = onFeatureFlagsChange;
    useEffect(() => {
        onFeatureFlagsChangeRef.current?.({
            createEvent: shopFlags.createEvent,
            multiplayer: shopFlags.multiplayer
        });
    }, [shopFlags.createEvent, shopFlags.multiplayer]);

    const onActivateMultiplayerRef = useRef(onActivateMultiplayer);
    onActivateMultiplayerRef.current = onActivateMultiplayer;

    // Inkluderar globe/terräng/kartstilarna i samma "is this feature active?"-
    // modell som övriga shop-flaggor, så väskans rader kan hanteras likadant.
    // mapStyle är inte boolean → varje stil mappas via likhet.
    const isFeatureActive = (key: string): boolean => {
        if (key === 'globe') return isGlobe;
        if (key === 'terrain') return is3DTerrain;
        if (key === 'satellite') return mapStyle === 'satellite';
        if (key === 'themepark') return mapStyle === 'themepark';
        if (key === 'dark') return mapStyle === 'dark';
        if (key === 'orientering') return mapStyle === 'orientering';
        return (shopFlags as Record<string, boolean>)[key] ?? false;
    };

    const setFeatureActive = (key: string, value: boolean) => {
        // 'record' är inte längre låst — den togglas som vilken annan flagga (faller
        // igenom till setShopFlags nedan). Multiplayer behåller sin egen logik.
        if (key === 'multiplayer') {
            if (value && !shopFlags.multiplayer) {
                onActivateMultiplayerRef.current?.();
                return;
            }
            setShopFlags(prev => ({ ...prev, multiplayer: value }));
            return;
        }
        if (key === 'globe') { setIsGlobe(value); return; }
        if (key === 'terrain') { setIs3DTerrain(value); return; }
        if (key === 'satellite') { setMapStyle(value ? 'satellite' : 'streets'); return; }
        if (key === 'themepark') { setMapStyle(value ? 'themepark' : 'streets'); return; }
        if (key === 'dark') { setMapStyle(value ? 'dark' : 'streets'); return; }
        if (key === 'orientering') { setMapStyle(value ? 'orientering' : 'streets'); return; }
        setShopFlags(prev => ({ ...prev, [key]: value }));
    };
    const toggleFeature = (key: string) => setFeatureActive(key, !isFeatureActive(key));

    // Två oberoende 3D-lägen som kan skiftas var för sig (och kombineras):
    //   isGlobe      — projicera kartan på ett klot (mercator ↔ globe). ~0 minne.
    //   is3DTerrain  — res upp höjder/berg ur kartan via en DEM-källa. Minnestungt,
    //                  därför läggs DEM-källan till/tas bort dynamiskt (se effekt).
    // Refs så att stil-omladdningen (setStyle nollställer projektion + custom-källor)
    // kan återställa rätt läge utan att bindas om.
    // (state + refs är deklarerade högre upp så shop-flaggorna kan läsa dem.)

    // Spara undan callbacks i refs så map-event-handlers inte ständigt behöver bindas om
    const onSelectEventRef = useRef(onSelectEvent);
    onSelectEventRef.current = onSelectEvent;

    // Önskningar: ref-speglar så klick-handlern (registreras en gång) kan slå
    // upp önskan bakom en wish:-nyckel och rapportera valet uppåt.
    const wishesRef = useRef(wishes);
    wishesRef.current = wishes;
    const onSelectWishRef = useRef(onSelectWish);
    onSelectWishRef.current = onSelectWish;

    const onCenterChangeRef = useRef(onCenterChange);
    onCenterChangeRef.current = onCenterChange;

    const onMapDragRef = useRef(onMapDrag);
    onMapDragRef.current = onMapDrag;

    // (Emoji-/färgväxlingen för grupper med flera event på samma plats sköts av
    //  GL-cykelpumpen längre ner — se effekten efter visibleGroups.)

    // Gruppera events som ligger på (nästan) samma koord. ~11m precision (4 decimaler).
    const groups = useMemo(() => {
        const map = new Map<string, LinkEvent[]>();
        for (const evt of events) {
            if (!evt.lat || !evt.lng) continue;
            const key = groupKeyOf(evt.lat, evt.lng);
            const bucket = map.get(key);
            if (bucket) bucket.push(evt); else map.set(key, [evt]);
        }
        return map;
    }, [events]);

    // Stabil ref till grupperna så GL-lagrets klick-handler (registreras en gång)
    // kan slå upp grupp utifrån feature-nyckeln.
    const groupsRef = useRef(groups);
    groupsRef.current = groups;


    // En grupp är "speciell" om den behöver den rika DOM-brickan (animationer,
    // sifferbricka, vattning, highlight). Övriga renderas billigt i GL-lagret.
    // Samma predikat används både för att VÄLJA DOM-grupper (visibleGroups) och
    // för att UTESLUTA dem ur GL-lagret — så ingen markör dubbelritas.
    const isSpecialGroup = useCallback((group: LinkEvent[], _key: string, nowMs: number): boolean => {
        // Det VALDA (öppnade) eventet är speciellt → DOM-markör med vit ram. Övriga
        // vanliga/multi/imminent/skapade/slängda hanteras via avslöjningen (GL-brickor).
        if (selectedEvent && group.some(e => e.id === selectedEvent.id)) return true;
        // OBS: gillade (sparade) event är INTE special. De ritas som vanliga GL-brickor
        // men med VIT kropp + force-tända (alltid reveal=1 via revealStickyRef) → de
        // förblir synliga vita överallt, oavsett avslöjning/viewport/vad som är valt.
        return false;
    }, [selectedEvent]);

    // DOM-markörer: BARA speciella grupper (få) inom skärmen (+20% marginal).
    // Valt/gissat/guld visas alltid, även utanför skärmen. Resten ritas i GL.
    const visibleGroups = useMemo(() => {
        if (!mapBounds) return [];
        const nowMs = Date.now();

        const lngSpan = mapBounds.getEast() - mapBounds.getWest();
        const latSpan = mapBounds.getNorth() - mapBounds.getSouth();
        const paddedBounds = new maplibregl.LngLatBounds(
            [mapBounds.getWest() - lngSpan * 0.2, mapBounds.getSouth() - latSpan * 0.2],
            [mapBounds.getEast() + lngSpan * 0.2, mapBounds.getNorth() + latSpan * 0.2]
        );
        const mustShow = (group: LinkEvent[]) =>
            !!selectedEvent && group.some(e => e.id === selectedEvent.id);

        const out: [string, LinkEvent[]][] = [];
        for (const entry of groups.entries()) {
            const [key, group] = entry;
            if (!isSpecialGroup(group, key, nowMs)) continue;
            if (mustShow(group)) { out.push(entry); continue; }
            // Multi-event-grupp ELLER "inom 1 timme" (orange) visas som GL-prickar under zoom
            // men vi håller dem kvar i DOM:en (med klassen 'hide-during-zoom') så att de döljs
            // via CSS under zoom i stället för att unmountas och remountas i React (vilket laggar).
            const rep = group[0];
            // Range-validering (inte bara falsy): en projicerad koordinat som
            // lat=6129956 får annars LngLatBounds.contains att kasta och
            // kraschar hela kartan.
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            if (paddedBounds.contains([rep.lng, rep.lat])) out.push(entry);
        }
        return out;
    }, [groups, mapBounds, selectedEvent, isSpecialGroup]);

    // GL-lagret: alla ICKE-speciella grupper (huvuddelen). Byggs som GeoJSON +
    // den uppsättning brick-bilder (emoji × ev. källfärg) som behöver bakas. Hela
    // världen ligger i källan — MapLibre kullar och avkrockar själv på GPU:n
    // (icon-allow-overlap false), så vi behöver ingen egen viewport-gallring här.
    // Event från en "stor" källa (PRO/Korpen/Svenska kyrkan) får standard mörk bricka;
    // alla övriga event färgas efter sin kategori.
    const plainData = useMemo(() => {
        const nowMs = Date.now();
        const features: PlainFeature[] = [];
        const icons = new Map<string, { emoji: string; color?: string; selected?: boolean; saved?: boolean; starred?: boolean; wish?: boolean }>();
        // Rotation för multi-grupper med ≥2 OLIKA emojis: gruppens bricka pekar på
        // en EGEN cykel-bild (`cycle:<gruppnyckel>:<frame-ids>`) vars PIXLAR
        // cykelpumpen byter på plats via map.updateImage — ingen setData, ingen
        // feature-state, bara en liten texturuppdatering per byte. Bild-id:t är
        // unikt PER GRUPP (nyckeln ingår) så pumpen kan växla EN grupp i taget
        // (staggrat) utan att grannar med identisk rotation byter samtidigt.
        // Dedupliceras per emoji — finns flera event med samma emoji deltar bara
        // det första i växlingen. Nyckel = GRUPPNYCKELN; värdet bär cykel-bildens
        // id + frames med eventId (klicket öppnar det event vars frame visas).
        const rotations = new Map<string, CycleRotation>();
        // Det VALDA eventet behålls i GL-lagret (utöver sin DOM-markör) så att brickan
        // man är "på" ALLTID syns. Eftersom det valda ALLTID är "special" ritas just
        // dess GL-bricka med sin riktiga look INBAKAD (vit ram = vald, vit kropp =
        // sparad) — annars täckte den kantlösa standard-GL-brickan DOM-markörens look
        // (anchor-glapp) → "ingen vit ram / ingen vit bakgrund".
        const selId = selectedEvent?.id;
        for (const [key, group] of groups) {
            const isSel = selId != null && group.some(e => e.id === selId);
            const special = isSpecialGroup(group, key, nowMs);
            if (!isSel && special) continue;
            // Stjärn-gåvan ⭐: ett (ännu inte passerat) stjärnmärkt event blir
            // gruppens REPRESENTANT — dess emoji/färg visas på brickan, även i
            // multi-event-grupper. Passerad stjärna = förbrukad → vanlig rep.
            const starredRep = group.find(e => starredEventIds.has(e.id) && !isEventPast(e, nowMs));
            const rep = starredRep ?? group[0];
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            const emoji = eventEmoji(rep);
            // Stor källa (PRO/Korpen/Svenska kyrkan) → ingen färg (mörk standard);
            // övriga → sin kategori-färg. Samma helper som DOM-brickan, så GL- och
            // DOM-färgen aldrig glider isär.
            const color = brickaBodyHex(rep) ?? undefined;
            // Vald bricka (isSel) → vit ram. ALLA gillade (framtida) event → vit kropp,
            // oavsett om de är valda — så de FÖRBLIR vita när man bläddrar vidare. Övriga
            // (reveal-brickorna) = normal look.
            const drawSel = isSel;
            // "Ännu inte passerat" = samma isEventPast som dämpningen (start + 1 h,
            // kl 20 för event utan klockslag) — inte en rå 1 h-cutoff som släppte
            // heldagsevent redan kl 01.
            const drawSav = group.some(e => savedEventIds.has(e.id) && !isEventPast(e, nowMs));
            // Stjärnmärkt (ej passerad) → guld-bricka med ⭐-badge.
            const drawStar = starredRep != null;
            const baseIcon = color ? `bricka:${color}:${emoji}` : `bricka:${emoji}`;
            const iconId = `${baseIcon}${drawSel ? ':sel' : ''}${drawSav ? ':sav' : ''}${drawStar ? ':star' : ''}`;
            if (!icons.has(iconId)) icons.set(iconId, { emoji, color, selected: drawSel, saved: drawSav, starred: drawStar });
            // Bygg gruppens rotation (ej för den valda — den sköts av DOM-synken).
            // Blir den ≥2 frames pekar brickan på gruppens EGEN cykel-bild i
            // stället för rep-ikonen.
            let finalIcon = iconId;
            // Stjärnmärkta grupper cyklar INTE — det stjärnmärkta eventet ÄR
            // det som visas (beslutet för multi-event-brickor), så emoji-
            // växlingen stängs av så länge stjärnan lyser.
            if (group.length > 1 && !drawSel && !drawStar) {
                const seenEmoji = new Set<string>();
                const frames: CycleRotation['frames'] = [];
                const frameIds: string[] = [];
                for (const ev of group) {
                    if (discardedEventIds.has(ev.id)) continue;
                    const em = eventEmoji(ev);
                    if (seenEmoji.has(em)) continue;
                    seenEmoji.add(em);
                    const col = brickaBodyHex(ev) ?? undefined;
                    frames.push({ emoji: em, color: col, saved: drawSav, eventId: ev.id });
                    frameIds.push(`${col ? `bricka:${col}:${em}` : `bricka:${em}`}${drawSav ? ':sav' : ''}`);
                }
                if (frames.length > 1) {
                    // Gruppnyckeln i bild-id:t → aldrig delat mellan grupper.
                    // (Identiska rotationer delade förr EN bild och bytte i
                    // perfekt synk — nu ska EN bricka i taget byta, staggrat.)
                    const cycleId = `cycle:${key}:${frameIds.join('|')}`;
                    // Registrera cykel-bilden med frame 0 som utgångsutseende så
                    // syncPlainLayer bakar + addImage:ar den som alla andra.
                    if (!icons.has(cycleId)) icons.set(cycleId, { emoji: frames[0].emoji, color: frames[0].color, saved: frames[0].saved });
                    rotations.set(key, { icon: cycleId, frames });
                    finalIcon = cycleId;
                }
            }
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rep.lng!, rep.lat!] },
                // Vald grupp → jättestor sortKey så brickan (och dess "+N"-siffra)
                // alltid ritas ÖVERST bland GL-brickorna, oavsett grannars count.
                // Användarskapade event boostas också (under valt) — de är alltid
                // tända (sticky) och ska vinna staplingen mot importerade grannar.
                properties: { icon: finalIcon, key, count: group.length, color: color ?? '#1e293b', sortKey: group.length + (group.some(e => e.userCreated) ? 100_000 : 0) + (drawStar ? 200_000 : 0) + (isSel ? 1_000_000 : 0), past: groupIsPast(group, nowMs) },
            });
        }
        // ÖNSKNINGARNA (eventWishes) — egna features i SAMMA källa, nyckel
        // "wish:<id>" (kolliderar aldrig med groupKeyOf-nycklar). De blir aldrig
        // past (ingen tid), cyklar aldrig och grupperas inte. sortKey 100_000 av
        // TVÅ skäl: (1) de staplas ovanför vanliga event (under stjärna/valt),
        // (2) pushPlainEvents boosted-prefix (>= 100_000) lägger dem i våg 1 —
        // annars blinkade en redan synlig önske-bricka bort när aggregat-
        // streamens setData i våg 1 ersatte önske-pollens tidiga push.
        for (const w of wishes) {
            if (!isValidLatLng(w.lat, w.lng)) continue;
            const emoji = EVENT_CATEGORIES[w.category]?.emoji ?? '🎫';
            const iconId = `wish:${emoji}`;
            if (!icons.has(iconId)) icons.set(iconId, { emoji, wish: true });
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
                properties: { icon: iconId, key: `wish:${w.id}`, count: 1, color: WISH_DOT_HEX, sortKey: 100_000, past: false },
            });
        }
        // Nål-prick-lagret (cirklar) saknar sort-key och ritar i källordning —
        // flytta den valda featuren sist så dess prick också hamnar överst.
        const selIdx = features.findIndex(f => f.properties.sortKey >= 1_000_000);
        if (selIdx >= 0 && selIdx < features.length - 1) features.push(...features.splice(selIdx, 1));
        return { features, icons, rotations };
        // minuteTick håller past-dämpningen (50 %) i takt med klockan — utan den
        // uppdateras "har varit"-statusen bara när datan råkar byggas om. Oförändrade
        // minuter kortsluts av samePlainFeatures-vakten → ingen onödig setData.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, isSpecialGroup, selectedEvent, savedEventIds, discardedEventIds, starredEventIds, wishes, minuteTick]);
    const plainFeaturesRef = useRef<PlainFeature[]>([]);
    const usedIconsRef = useRef<Map<string, { emoji: string; color?: string; selected?: boolean; saved?: boolean; starred?: boolean; wish?: boolean }>>(new Map());
    // "Ritar ut eventen"-fasen: efter att aggregat-datan hämtats dröjer det innan
    // symbolerna faktiskt SYNS (baka ikoner, tila GeoJSON i workern, rendera) —
    // utan spårning släcktes ladda-pillen vid hämtat-klart och kartan såg tom ut.
    // pendingPaintRef = 1 medan en push-runda (enkel setData ELLER hel stream) är
    // på väg mot skärmen; hasPaintedOnceRef = minst en runda har målats klart;
    // symbolsPainted är latchen som (tillsammans med eventsSettled) släcker
    // pillen för gott. Klart-signalen är KÄLLANS egen sourcedata/isSourceLoaded
    // (+ en render-frame) — inte map 'idle', som på kallstart väntar på ALLA
    // baskarte-tiles och därför kunde dröja långt efter att prickarna redan syntes.
    const pendingPaintRef = useRef(0);
    const hasPaintedOnceRef = useRef(false);
    const paintLatchRef = useRef(false);
    const [paintDoneNonce, setPaintDoneNonce] = useState(0);
    const [symbolsPainted, setSymbolsPainted] = useState(false);
    // onFirstPaint via ref (som onMapDragRef) — latch-effekten ska inte få
    // proppen som dep. firstPaintFiredRef = fyra EN gång per sidladdning.
    const onFirstPaintRef = useRef(onFirstPaint);
    onFirstPaintRef.current = onFirstPaint;
    const firstPaintFiredRef = useRef(false);
    // Antal features som FAKTISKT pushats till källan (nollställs när källan
    // återskapas, t.ex. vid stilbyte) — skiljer "initial stor påfyllnad" (streamas
    // pö om pö) från små uppdateringar (en enda setData).
    const pushedCountRef = useRef(0);
    // Senast ACCEPTERADE target (innehållet vi pushar/streamar mot källan just
    // nu). Nästa push med identiskt innehåll hoppas över helt — se
    // samePlainFeatures för varför det är avgörande för den initiala streamen.
    const lastPushedTargetRef = useRef<PlainFeature[]>([]);
    // Städfunktion för pågående våg-stream (lyssnare + timers) — kallas när en
    // ny push tar över eller vid unmount.
    const streamCleanupRef = useRef<(() => void) | null>(null);
    // Aktiv målnings-runda. Bara EN åt gången — en ny push avbryter den gamla
    // (dess klart-signal ska inte längre räknas).
    const paintRoundRef = useRef<{ canceled: boolean; detach?: () => void } | null>(null);
    // Nyckel = hela ikon-id:t (bricka:[färg:]emoji) så färgvarianter cachas separat.
    const bakedIconsRef = useRef<Map<string, { data: ImageData; pixelRatio: number }>>(new Map());
    // Multi-gruppernas frame-rotationer per GRUPPNYCKEL (byggda i plainData).
    const cycleRotationsRef = useRef<Map<string, CycleRotation>>(new Map());
    // Aktuellt frame-index per cykel-BILD-id = vad bilden visar JUST NU (pumpen
    // skriver). Nytt bild-id ⇒ nybakad bild på frame 0 ⇒ saknat index läses som
    // 0. GL-klicket och DOM-synken slår upp här (via shownCycleEvent) för att
    // öppna/visa exakt det event vars frame syns.
    const cycleFrameIndexRef = useRef<Map<string, number>>(new Map());
    // Round-robin-pekare för pumpen: gruppnyckeln som bytte frame förra ticken.
    const cycleLastKeyRef = useRef<string | null>(null);

    // Lätta GL-prickar för multi-event-grupper UNDER zoom-gesten. I vila är listan
    // tom → DOM-brickorna ritar dem i stället (se visibleGroups). Egenskapen `count`
    // = antal event → ritas som GL-siffra ovanpå pricken. Inte viewport-gallrad —
    // billiga cirklar, hela landet ryms på GPU:n. Valt/gissat/guld hålls kvar som
    // DOM (mustShow) så deras rika kort/highlight funkar.
    const multiEventDotData = useMemo(() => {
        if (!isZooming) return [] as GeoJSON.Feature[];
        const nowMs = Date.now();
        const mustShow = (group: LinkEvent[]) =>
            !!selectedEvent && group.some(e => e.id === selectedEvent.id);
        const features: GeoJSON.Feature[] = [];
        for (const [key, group] of groups) {
            // Bara grupper som FAKTISKT är speciella (saved/userCreated/imminent…
            // = de som ritas som DOM-brickor i vila) ersätts av prickar under zoom.
            // Vanliga multi-event-grupper ligger numera i plain-events-lagret (dolda
            // → skrapas fram med penseln, precis som enskilda event) och ska INTE
            // poppa upp under zoom-gesten.
            if (!isSpecialGroup(group, key, nowMs)) continue;
            const imminent = groupStartsWithinHour(group, nowMs);
            // Multi-event-grupper OCH "inom 1 timme"-event (orange) blir prickar.
            if (group.length <= 1 && !imminent) continue;
            if (mustShow(group)) continue;            // valt/gissat/guld → alltid DOM
            const rep = group[0];
            if (!isValidLatLng(rep.lat, rep.lng)) continue;
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [rep.lng!, rep.lat!] },
                // imminent → orange prick; count > 1 → siffra ovanpå.
                properties: { key, count: group.length, imminent },
            });
        }
        return features;
    }, [groups, isZooming, selectedEvent, isSpecialGroup]);
    const multiEventDotFeaturesRef = useRef<GeoJSON.Feature[]>([]);

    // ── "Skrapa fram"-markörer (de N närmaste pekaren) ────────────────────────
    // GL-brickorna börjar dolda (icon-opacity 0 via feature-state 'reveal'). Bara
    // ~REVEAL_SEED_COUNT syns från start (närmast mitten); i övrigt visas de
    // REVEAL_NEAREST_COUNT grupper som är NÄRMAST pekaren och följer hovern. Vi
    // räknar avstånden själva (billigt) och sätter feature-state direkt via nyckeln
    // — ingen queryRenderedFeatures (det var det som laggade).
    const revealSeedRef = useRef<Set<string>>(new Set());                 // vilo-uppsättningen (vid start: ~10 nära mitten; efter tap: N närmast trycket)
    // Tap-utgångspunkt (mobil-vänligt): trycker man på tom karta sätts denna geo-
    // punkt och vilo-uppsättningen blir de N närmaste BRICKORNA kring trycket — de
    // ligger kvar tills man trycker på nytt (panorering flyttar dem INTE). null =
    // inget tap ännu → vilo-uppsättningen följer kartmitten som förr.
    const revealAnchorPtRef = useRef<{ lng: number; lat: number } | null>(null);
    // Brickor man KLICKAT på stannar avslöjade (de "klistras fast") — annars föll en
    // bricka tillbaka till dold GL när man avmarkerade/bläddrade vidare och såg ut att
    // försvinna. Den valda visas som vit-kantad DOM-markör; när den lämnar valt läge
    // håller denna uppsättning kvar den i GL-lagret. GL-motsvarighet till revealedKeysRef.
    const revealStickyRef = useRef<Set<string>>(new Set());
    const revealCoordsRef = useRef<{ key: string; lng: number; lat: number }[]>([]); // platt lista för avståndsberäkning
    const revealWrittenRef = useRef<Map<string, number>>(new Map());      // senast skrivet opacitetsvärde (skippa redundanta skrivningar)
    const revealRafRef = useRef<number | null>(null);
    const revealCleanupRef = useRef<null | (() => void)>(null);
    // Ref-wrappers så funktionerna (definierade nedan) kan kallas från syncPlainLayer
    // / map-load utan att hamna i temporal-dead-zone.
    const ensureRevealPumpRef = useRef<() => void>(() => {});
    const reapplyAllRevealRef = useRef<() => void>(() => {});
    const recomputeRevealSeedRef = useRef<() => void>(() => {});
    // Startar "vandringen": avslöjningen glider event-för-event från förra trycket
    // till den nya platsen (toLng/toLat). Sätts nedan.
    const startRevealTravelRef = useRef<(toLng: number, toLat: number) => void>(() => {});
    const revealTweenRef = useRef<number | null>(null); // rAF-id för marschen
    // Klustrets FAKTISKA position just nu (geo). Uppdateras varje marsch-cykel. Vid
    // ett nytt klick startar marschen härifrån (inte från destinationen) så avbrutna
    // marscher fortsätter smidigt från där brickorna faktiskt står.
    const revealMarchPtRef = useRef<{ lng: number; lat: number } | null>(null);
    // Tidsfönster (performance.now-ms) då auto-recenter av kameran ska hoppas över.
    // Sätts av dagbyte + kort-navigering (Nästa/Föregående/svep) — INTE av kart-
    // klicket (där ska den valda brickan tvärtom få bli synlig via recenter).
    const suppressAutoRecenterUntilRef = useRef(0);

    // Baka (eller återanvänd) brick-bilderna som en uppsättning features faktiskt
    // pekar på (properties.icon). Under den streamade påfyllnaden kallas den per
    // delmängd, så bakningen sprids ut i stället för att blockera huvudtråden i
    // en enda lång svit innan första pricken ens kan synas.
    const bakeIconsFor = useCallback((map: maplibregl.Map, feats: PlainFeature[]) => {
        for (const f of feats) {
            const id = f.properties.icon as string | undefined;
            if (!id || map.hasImage(id)) continue;
            const info = usedIconsRef.current.get(id);
            if (!info) continue;
            let baked = bakedIconsRef.current.get(id);
            if (!baked) {
                const b = makeBrickaImageData(info.emoji, info.color, info.selected, info.saved, info.wish, info.starred);
                if (b) { bakedIconsRef.current.set(id, b); baked = b; }
            }
            if (baked) map.addImage(id, baked.data, { pixelRatio: baked.pixelRatio });
        }
    }, []);

    // Starta en målnings-runda (pillen "Ritar ut eventen…" lever tills den är klar).
    // Returnerar arm(): koppla klart-lyssnarna — direkt för en enkel push, efter
    // SISTA delmängden för en stream (annars avslutar första delmängden rundan).
    // Klar = källans egen isSourceLoaded + en render-frame, med 'idle' som
    // säkerhetsnät om signalen uteblir.
    const beginPaintRound = useCallback((map: maplibregl.Map): (() => void) => {
        const prev = paintRoundRef.current;
        if (prev) { prev.canceled = true; prev.detach?.(); }
        if (paintLatchRef.current) { paintRoundRef.current = null; return () => {}; }
        const round: { canceled: boolean; detach?: () => void } = { canceled: false };
        paintRoundRef.current = round;
        pendingPaintRef.current = 1;
        return () => {
            if (round.canceled) return;
            const finish = () => {
                if (round.canceled) return;
                round.canceled = true;
                round.detach?.();
                pendingPaintRef.current = 0;
                hasPaintedOnceRef.current = true;
                setPaintDoneNonce(n => n + 1);
            };
            const onData = (e: maplibregl.MapSourceDataEvent) => {
                if (e.sourceId === 'plain-events' && e.isSourceLoaded) map.once('render', finish);
            };
            const onIdle = () => finish();
            round.detach = () => { map.off('sourcedata', onData); map.off('idle', onIdle); };
            map.on('sourcedata', onData);
            map.once('idle', onIdle);
        };
    }, []);

    // Pusha plainFeaturesRef till källan. Den INITIALA påfyllnaden (källan tom →
    // tusentals nya) streamas i vågor så prickarna dyker upp pö om pö i stället
    // för i en enda smäll flera sekunder senare — utan extra nätverkshämtningar
    // (datan är redan här; det är bara utritningen som portioneras). Vågorna är
    // event-drivna (nästa skickas när förra bekräftats inne — se STREAM_-
    // kommentaren) och skickas som updateData({add})-diffar. Små ändringar
    // (dagbyte, cards-merge, poll) pushas som förr i en enda setData. instant =
    // hoppa över streamen (stilbyte: användaren har redan sett markörerna —
    // återställ allt direkt).
    const pushPlainEvents = useCallback((map: maplibregl.Map, opts?: { instant?: boolean }) => {
        const src = map.getSource('plain-events') as maplibregl.GeoJSONSource | undefined;
        if (!src) return;
        const target = plainFeaturesRef.current;
        // IDENTISKT innehåll → rör ingenting. Cards-/descriptions-mergarna (och
        // pollen var 30 s) bygger nya arrayer med samma GL-innehåll; utan denna
        // koll avbröt de den initiala våg-streamen (källan hade > STREAM_PREV_MAX
        // → direkt-spåret) och ersatte den med en monolitisk full setData — allt
        // "på en gång" igen, efter lång väntan. Nu fortsätter streamen ostörd
        // (och redan färdigmålad karta slipper meningslösa omtilingar). Kravet
        // på streamActive/full källa gör att en ÅTERSKAPAD källa (stilbyte:
        // pushedCount nollställd) aldrig skippas.
        const streamActive = streamCleanupRef.current != null;
        if (!opts?.instant &&
            samePlainFeatures(target, lastPushedTargetRef.current) &&
            (streamActive || pushedCountRef.current === target.length)) {
            return;
        }
        lastPushedTargetRef.current = target;
        if (streamCleanupRef.current) { streamCleanupRef.current(); streamCleanupRef.current = null; }
        const prevCount = pushedCountRef.current;
        // Latch-återöppning: hang-guarden kan ha satt eventsSettled (och släckt
        // pillen) INNAN någon data ens hunnit fram — landar den första riktiga
        // datamängden efter det ska "Ritar ut eventen…" tillbaka tills den målats.
        if (paintLatchRef.current && !opts?.instant && prevCount === 0 && target.length > 0) {
            paintLatchRef.current = false;
            hasPaintedOnceRef.current = false;
            setSymbolsPainted(false);
        }
        const setData = (feats: PlainFeature[]) => {
            src.setData({ type: 'FeatureCollection', features: feats as unknown as GeoJSON.Feature[] });
            pushedCountRef.current = feats.length;
        };
        if (target.length === 0) {
            // Inget att måla: avbryt ev. runda och knuffa latch-effekten (tom dag
            // släcker pillen via nothingToPaint-villkoret).
            const round = paintRoundRef.current;
            if (round) { round.canceled = true; round.detach?.(); paintRoundRef.current = null; }
            pendingPaintRef.current = 0;
            setData(target);
            setPaintDoneNonce(n => n + 1);
            return;
        }
        const arm = beginPaintRound(map);
        // Streama BARA den initiala påfyllnaden: källan (nästan) tom — högst några
        // användar-event som landade via sin snabbare poll — och en stor mängd nytt.
        // Allt annat — även en avbruten stream som får ny data (cards-merge mitt i,
        // prevCount = det som hunnit skickas) — går som en enda setData: kartan har
        // redan innehåll, tomma-kartan-problemet finns inte.
        if (opts?.instant || prevCount > STREAM_PREV_MAX || target.length - prevCount < STREAM_MIN_GROWTH) {
            if (opts?.instant) {
                // Stilbyte: användaren har redan sett markörerna — återställ direkt.
                bakeIconsFor(map, target);
                setData(target);
                arm();
                return;
            }
            // Dagbyte/poll/merge: brick-bakningen för en hel NY dags ikoner är
            // sidans tyngsta huvudtrådsjobb (sekunder i en enda task = INP >500 ms
            // på mobil — tappen som utlöste dagbytet satt fast bakom den). Baka i
            // tidsbudgeterade bitar med yields emellan och skicka setData:n när
            // allt är klart; redan bakade ikoner (poll/merge) passerar på en runda.
            // Avbryts via streamCleanupRef precis som våg-streamen (ny push/stilbyte).
            const BAKE_BUDGET_MS = 10;
            const BAKE_SLICE = 25;
            let i = 0;
            let canceled = false;
            // Yield via MessageChannel — setTimeout stryps i dolda flikar (≥1 s
            // per hopp) och nästlade timeouts klampas till 4 ms; en message-post
            // gör varken eller, så bakningen blir klar snabbt även i bakgrunden.
            const yieldThen = (fn: () => void) => {
                const ch = new MessageChannel();
                ch.port1.onmessage = () => fn();
                ch.port2.postMessage(null);
            };
            const bakeStep = () => {
                streamCleanupRef.current = null;
                if (canceled || mapRef.current !== map) return;
                const deadline = performance.now() + BAKE_BUDGET_MS;
                while (i < target.length && performance.now() < deadline) {
                    bakeIconsFor(map, target.slice(i, i + BAKE_SLICE));
                    i += BAKE_SLICE;
                }
                if (i < target.length) {
                    streamCleanupRef.current = () => { canceled = true; };
                    yieldThen(bakeStep);
                    return;
                }
                // Källan kan ha återskapats under bakningen (stilbyte avbryter via
                // cleanup, men hängslen ändå) — hämta den levande källan.
                const liveSrc = map.getSource('plain-events') as maplibregl.GeoJSONSource | undefined;
                if (!liveSrc) return;
                liveSrc.setData({ type: 'FeatureCollection', features: target as unknown as GeoJSON.Feature[] });
                pushedCountRef.current = target.length;
                arm();
            };
            bakeStep();
            return;
        }
        // Strömordning: boostade features (användarskapade — alltid tända, sajtens
        // kärna) FÖRST så de hamnar i våg 1 och aldrig blinkar bort när setData:n
        // där ersätter den lilla förra pushen. Resten i target-ordning. Kanoniska
        // ordningen (vald-sist för prick-lagret) återställs vid nästa push med
        // FAKTISKT ändrat innehåll (dagbyte/val) — identiska pushar skippas ju.
        const boosted: PlainFeature[] = [];
        const rest: PlainFeature[] = [];
        for (const f of target) (f.properties.sortKey >= 100_000 ? boosted : rest).push(f);
        const ordered = boosted.length ? [...boosted, ...rest] : target;
        // Våg-streamen. sent = hur många av ordered som skickats; vågorna är
        // PREFIX-diffar (ordered[sent..next]) så källan alltid är ordered[0..sent].
        let sent = 0;
        let waveSize = STREAM_CHUNK_START;
        const sendWave = () => {
            streamCleanupRef.current = null;
            if (mapRef.current !== map) return;
            const liveSrc = map.getSource('plain-events') as maplibregl.GeoJSONSource | undefined;
            if (!liveSrc) return; // stilbyte mitt i — afterLoad gör en instant-push
            const next = Math.min(sent + waveSize, ordered.length);
            const slice = ordered.slice(sent, next);
            bakeIconsFor(map, slice);
            if (sent === 0) {
                // Våg 1 ERSÄTTER (setData) — den lilla förra pushen (user-event)
                // ligger redan först i ordered, så inget synligt försvinner.
                liveSrc.setData({ type: 'FeatureCollection', features: slice as unknown as GeoJSON.Feature[] });
            } else {
                liveSrc.updateData({ add: slice as unknown as GeoJSON.Feature[] });
            }
            pushedCountRef.current = next;
            sent = next;
            waveSize = Math.min(waveSize * 2, STREAM_CHUNK_MAX);
            if (sent >= ordered.length) { arm(); return; }
            // Vänta tills vågen är INNE (källan laddad) + kort paus → nästa våg.
            // Timeout-fallback så en utebliven signal aldrig strandar streamen.
            let fired = false;
            let pauseTimer: ReturnType<typeof setTimeout> | null = null;
            const onData = (e: maplibregl.MapSourceDataEvent) => {
                if (e.sourceId === 'plain-events' && e.isSourceLoaded) proceed();
            };
            const fallbackTimer = setTimeout(() => proceed(), STREAM_WAVE_TIMEOUT_MS);
            const proceed = () => {
                if (fired) return;
                fired = true;
                map.off('sourcedata', onData);
                clearTimeout(fallbackTimer);
                pauseTimer = setTimeout(sendWave, STREAM_STEP_MS);
            };
            streamCleanupRef.current = () => {
                fired = true;
                map.off('sourcedata', onData);
                clearTimeout(fallbackTimer);
                if (pauseTimer) clearTimeout(pauseTimer);
            };
            map.on('sourcedata', onData);
        };
        sendWave();
    }, [bakeIconsFor, beginPaintRound]);

    // Installerar/uppdaterar GL-markörlagret: källa + bakade emoji-bilder + lager,
    // och pushar senaste datan. Idempotent — säker att kalla efter varje stilbyte
    // (setStyle rensar källor/bilder/lager, så de måste återinstalleras).
    // instant skickas vidare till pushen (stilbyte = återställ allt direkt,
    // ingen ny stream).
    const syncPlainLayer = useCallback((opts?: { instant?: boolean }) => {
        const map = mapRef.current;
        if (!map || !styleReady(map)) return;
        try {
            if (!map.getSource('plain-events')) {
                // promoteId: 'key' → feature-state kan adresseras via gruppnyckeln
                // (reveal-systemet sätter icon-opacity per markör).
                map.addSource('plain-events', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'key' });
                // Färsk (tom) källa → nollställ push-räknaren så nästa push vet
                // att den fyller från noll (stilbyte återskapar källan).
                pushedCountRef.current = 0;
            }
            // Ikonbakningen sker i pushPlainEvents (per delmängd under streamen).
            // Brickorna: ALLA event syns på ALLA zoomnivåer (allow-overlap +
            // ignore-placement = ingen avkrockning) så man alltid ser var man kan
            // klicka — även i hela-Sverige-vyn. Det är ett GPU-lager, så även
            // tusentals brickor är billiga att rita.
            if (!layerExists(map, 'plain-events')) {
                map.addLayer({
                    id: 'plain-events',
                    type: 'symbol',
                    source: 'plain-events',
                    layout: {
                        'icon-image': ['get', 'icon'],
                        // Spetsen (nederkanten av bilden) på koordinaten.
                        'icon-anchor': 'bottom',
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                        // Storlek matchad mot DOM-brickorna (~38px kropp) så enskilda
                        // GL-event och fler-event-grupper (DOM) ser lika stora ut.
                        'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.78, 9, 0.9, 13, 0.98],
                        // Fler-event-brickor (count>1) ritas ÖVERST och hamnar först i
                        // queryRenderedFeatures — sort-key = antal event → ju fler, desto
                        // högre upp i staplingen (och lättast att träffa). Den VALDA
                        // gruppens sortKey är count + 1e6 → alltid allra överst.
                        'symbol-sort-key': ['coalesce', ['get', 'sortKey'], ['get', 'count']],
                        'symbol-z-order': 'auto',
                    },
                    paint: {
                        // Dold tills reveal-systemet tonar in den (feature-state 'reveal').
                        // "Har varit"-grupper visar ALDRIG bricka — de står som sin prick.
                        'icon-opacity': BRICKA_OPACITY_EXPR,
                        'icon-opacity-transition': { duration: 0, delay: 0 },
                    },
                });
                // Lagret (om)skapades → feature-state är tomt (setStyle rensar det).
                // Glöm vad som skrivits och skriv om seed + ev. levande penseldrag.
                revealWrittenRef.current.clear();
                // Bilderna nybakas efter stilbytet (frame 0) — nollställ frame-
                // indexen så klick-uppslaget matchar det som faktiskt visas.
                cycleFrameIndexRef.current.clear();
                reapplyAllRevealRef.current();
                ensureRevealPumpRef.current();
            }
            // "+N"-badge för brickor med flera event (count > 1) — siffra uppe till
            // höger på brickan. Följer samma reveal-state som ikonen (men multi-event
            // hålls alltid tända, så badgen syns alltid). Kräver glyfer.
            if (!map.getLayer('plain-events-count')) {
                map.addLayer({
                    id: 'plain-events-count',
                    type: 'symbol',
                    source: 'plain-events',
                    layout: {
                        // Totalt antal event i gruppen (bara för count > 1).
                        'text-field': ['case', ['>', ['get', 'count'], 1], ['to-string', ['get', 'count']], ''],
                        'text-font': ['Open Sans Bold'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 13, 13],
                        'text-anchor': 'bottom',
                        'text-offset': [0.95, -1.5],
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                        // Samma stapling som brickan — fler-event-badgen överst,
                        // och den valda gruppens siffra allra överst (sortKey-boost).
                        'symbol-sort-key': ['coalesce', ['get', 'sortKey'], ['get', 'count']],
                        'symbol-z-order': 'auto',
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#006AA7',
                        'text-halo-width': 2.4,
                        // Badgen följer brickan — släckt för passerade grupper.
                        'text-opacity': BRICKA_OPACITY_EXPR,
                        'text-opacity-transition': { duration: 0, delay: 0 },
                    },
                });
            }
            // Prick-lagret = "nål"-läget UNDER zoom-gesten (visas av showNeedles,
            // göms av showBricks). Vilar dolt — i vila syns brickorna. Cirklar
            // kräver inga glyph-/krock-beräkningar, så zoom-animationen blir billig.
            if (!map.getLayer('plain-events-dots')) {
                map.addLayer({
                    id: 'plain-events-dots',
                    type: 'circle',
                    source: 'plain-events',
                    layout: { 'visibility': 'visible' },
                    paint: {
                        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.5, 10, 3.5, 14, 4.5],
                        // Nål-pricken får eventets KATEGORIFÄRG (mörk standard för stora källor).
                        'circle-color': ['coalesce', ['get', 'color'], '#1e293b'],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.5,
                        // ALLA prickar synliga (oberoende av reveal-state) under zoom,
                        // men i vila (när vi inte zoomar) döljs de som är avslöjade (har
                        // bricka). Passerade grupper är ALLTID prick (dämpad till 50 %).
                        'circle-opacity': isZoomingRef.current ? PAST_DIM_EXPR : DOT_REST_OPACITY_EXPR,
                        'circle-stroke-opacity': isZoomingRef.current ? ['*', 0.9, PAST_DIM_EXPR] : DOT_REST_STROKE_OPACITY_EXPR,
                        'circle-opacity-transition': { duration: 0, delay: 0 },
                        'circle-stroke-opacity-transition': { duration: 0, delay: 0 },
                    },
                });
            }
            if (map.getLayer('plain-events-dots') && map.getLayer('plain-events')) {
                map.moveLayer('plain-events-dots', 'plain-events');
            }
            // Pusha datan — stor initial påfyllnad streamas i delmängder (pö om
            // pö), små ändringar går som en enda setData. Ladda-pillen i JSX:en
            // följer rundan via pendingPaintRef/paintDoneNonce.
            pushPlainEvents(map, opts);

            // Multi-event- & "inom 1 timme"-prickar. Egen lätt cirkel-källa/lager —
            // INGEN clustering. Svart fyllning (orange för "inom 1 timme"), liten
            // radie, vit kant. Siffran ritas av symbol-lagret nedan (egen GL-text).
            if (!map.getSource('multi-event-dots')) {
                map.addSource('multi-event-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            }
            if (!map.getLayer('multi-event-dots')) {
                map.addLayer({
                    id: 'multi-event-dots',
                    type: 'circle',
                    source: 'multi-event-dots',
                    // Synlig BARA under zoom-gesten (i vila ritar DOM-brickorna dem).
                    layout: { 'visibility': isZoomingRef.current ? 'visible' : 'none' },
                    paint: {
                        'circle-radius': 6,
                        // "Inom 1 timme" → orange (matchar DOM-brickans ram), annars svart.
                        'circle-color': ['case', ['get', 'imminent'], '#f97316', '#000000'],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.5,
                    },
                });
            }
            // Siffer-badge uppe till höger om pricken (antal event i gruppen). Kräver
            // glyfer (satellitstilen har fått ett glyf-endpoint). Blockeras fonten
            // visas pricken ändå, bara utan siffra.
            if (!map.getLayer('multi-event-dots-count')) {
                map.addLayer({
                    id: 'multi-event-dots-count',
                    type: 'symbol',
                    source: 'multi-event-dots',
                    layout: {
                        'visibility': isZoomingRef.current ? 'visible' : 'none',
                        // Siffra bara för fler-event-grupper; enstaka "inom 1 timme"
                        // (count = 1) får ingen "1"-text, bara den orange pricken.
                        'text-field': ['case', ['>', ['get', 'count'], 1], ['to-string', ['get', 'count']], ''],
                        'text-font': ['Open Sans Bold'],
                        'text-size': 11,
                        'text-anchor': 'bottom-left',
                        'text-offset': [0.5, -0.5],
                        'text-allow-overlap': true,
                        'text-ignore-placement': true,
                    },
                    paint: {
                        'text-color': '#ffffff',
                        'text-halo-color': '#000000',
                        'text-halo-width': 1.5,
                    },
                });
            }
            const multiSrc = map.getSource('multi-event-dots') as maplibregl.GeoJSONSource | undefined;
            multiSrc?.setData({ type: 'FeatureCollection', features: multiEventDotFeaturesRef.current });
            // Återuppta reveal-loopen så ev. köade/permanenta avslöjningar skrivs.
            ensureRevealPumpRef.current();
        } catch (err) {
            console.warn('Kunde inte synka GL-markörlagret', err);
        }
    }, [pushPlainEvents]);
    const syncPlainLayerRef = useRef(syncPlainLayer);
    syncPlainLayerRef.current = syncPlainLayer;

    // Räkna hur många reveal-markörer som FAKTISKT är tända just nu (write-cachen,
    // op > 0.5) och logga. Fler än REVEAL_VISIBLE_WARN = något läcker (t.ex. strandade
    // brickor) → console.warn så det syns direkt i konsolen. Anropas vid settle-punkter
    // (marsch klar, vilo-reconcile, seed-omräkning).
    const reportRevealCount = useCallback((ctx: string) => {
        let lit = 0;
        revealWrittenRef.current.forEach(op => { if (op > 0.5) lit++; });
        if (lit > REVEAL_VISIBLE_WARN) {
            console.warn(`⚠️ [reveal] ${lit} eventmarkörer synliga (${ctx}) — över ${REVEAL_VISIBLE_WARN}, något behöver korrigeras`);
        } else {
            console.log(`[reveal] ${lit} eventmarkörer synliga (${ctx})`);
        }
    }, []);

    // ── Reveal/pensel-loopen ──────────────────────────────────────────────────
    // Skriv ETT reveal-opacitetsvärde till GL-lagret — men bara när värdet
    // faktiskt ändrats (write-cachen revealWrittenRef skippar redundanta
    // setFeatureState-anrop). Delas av vilo-loopen (pumpReveal) och migrationen
    // (startRevealTravel). OBS: reapplyAllReveal skriver medvetet med en egen,
    // hårdare regel (force-tänd) och ska INTE gå via den här helpern.
    const writeReveal = useCallback((key: string, op: number) => {
        const map = mapRef.current;
        if (!map) return;
        const written = revealWrittenRef.current;
        const prev = written.get(key);
        if (prev === undefined ? op > 0.0001 : Math.abs(op - prev) > 0.004) {
            try { map.setFeatureState({ source: 'plain-events', id: key }, { reveal: op }); } catch { /* källan ej redo */ }
            written.set(key, op);
        }
    }, []);

    // Skriv seed-markörerna (de ~10 alltid synliga) direkt — efter ett stilbyte
    // rensar setStyle feature-state, så de måste sättas på nytt.
    const reapplyAllReveal = useCallback(() => {
        const map = mapRef.current;
        if (!map || !layerExists(map, 'plain-events')) return;
        const light = (key: string) => {
            try { map.setFeatureState({ source: 'plain-events', id: key }, { reveal: 1 }); } catch { /* källan ej redo */ }
            revealWrittenRef.current.set(key, 1);
        };
        revealSeedRef.current.forEach(light);
        revealStickyRef.current.forEach(light); // klickade brickor stannar tända
    }, []);
    reapplyAllRevealRef.current = reapplyAllReveal;

    // Avslöjning sker BARA via vilo-uppsättningen (seed): de REVEAL_SEED_COUNT
    // närmast ANVÄNDARENS PLATS vid start (om känd — annars inget), eller de
    // REVEAL_NEAREST_COUNT närmaste KRING SENASTE TAP. INGEN hover-följning —
    // markörerna tänds bara där man trycker (mobil-vänligt) och ligger kvar.
    // Engångsskrivning per recompute/tap (ingen rAF-loop i vila).
    const pumpReveal = useCallback(() => {
        const map = mapRef.current;
        if (!map || !styleReady(map) || !layerExists(map, 'plain-events')) { revealRafRef.current = null; return; }
        const seed = revealSeedRef.current;
        const sticky = revealStickyRef.current;
        // Tänd vilo-uppsättningen + klickade (sticky) brickor, släck allt annat.
        seed.forEach(k => writeReveal(k, 1));
        sticky.forEach(k => writeReveal(k, 1));
        revealWrittenRef.current.forEach((op, k) => { if (op > 0 && !seed.has(k) && !sticky.has(k)) writeReveal(k, 0); });
        revealRafRef.current = null;
        reportRevealCount('vila');
    }, [reportRevealCount, writeReveal]);
    const ensureRevealPump = useCallback(() => {
        if (revealRafRef.current == null) revealRafRef.current = requestAnimationFrame(pumpReveal);
    }, [pumpReveal]);
    ensureRevealPumpRef.current = ensureRevealPump;

    // De n närmaste brickorna (nycklar) till en geo-punkt. Billigt partiellt urval
    // (kvadrerat avstånd, longitud cos-lat-skalad) — ingen full sortering, ingen
    // queryRenderedFeatures. Används av vandringen nedan.
    const nearestKeysTo = useCallback((lng: number, lat: number, n: number): Set<string> => {
        const coords = revealCoordsRef.current;
        const kx = Math.cos(lat * Math.PI / 180);
        const bestKey: string[] = [];
        const bestD2: number[] = [];
        let worst = -Infinity, worstIdx = -1;
        for (let i = 0; i < coords.length; i++) {
            const c = coords[i];
            const dx = kx * (c.lng - lng), dy = c.lat - lat;
            const d2 = dx * dx + dy * dy;
            if (bestKey.length < n) {
                bestKey.push(c.key); bestD2.push(d2);
                if (d2 > worst) { worst = d2; worstIdx = bestKey.length - 1; }
            } else if (d2 < worst) {
                bestKey[worstIdx] = c.key; bestD2[worstIdx] = d2;
                worst = -Infinity;
                for (let j = 0; j < n; j++) if (bestD2[j] > worst) { worst = bestD2[j]; worstIdx = j; }
            }
        }
        return new Set(bestKey);
    }, []);

    // PARALLELL MIGRATION: vid ett tryck "flyttar" de N brickorna sig mot klickpunkten
    // var och en i SIN EGEN takt (parallella körfält på olika nivåer): några skjuter i
    // väg och dyker upp längst fram nästan direkt, andra kryper — så att de vid varje
    // ögonblick ligger jämnt utspridda längs hela vägen, och ALLA till slut hamnar på
    // destinationen (de N närmast klicket). Illusionen skapas genom att tända event
    // längs en KORRIDOR från→till: varje körfält har en plats-index som glider framåt
    // med olika hastighet, och tänder eventet vid sitt index.
    const startRevealTravel = useCallback((toLng: number, toLat: number) => {
        const map = mapRef.current;
        if (!map || !layerExists(map, 'plain-events')) return;
        // Starta där klustret FAKTISKT står (smidigt vid avbrott), annars förra
        // destinationen / min-position / kartmitt.
        const from = revealMarchPtRef.current ?? revealAnchorPtRef.current ?? userPosRef.current ?? map.getCenter();
        const fromLng = from.lng, fromLat = from.lat;
        // Destinations-ankaret sätts DIREKT (moveend-skydd + recompute-origin).
        revealAnchorPtRef.current = { lng: toLng, lat: toLat };
        // Avbryt ev. pågående migration.
        if (revealTweenRef.current != null) { cancelAnimationFrame(revealTweenRef.current); revealTweenRef.current = null; }
        const written = revealWrittenRef.current;
        const sticky = revealStickyRef.current;
        const writeOp = writeReveal;
        // Skriver fram exakt `keep`-mängden. Strömmen anropar den med `forceAll` varje frame:
        // tänd de N nuvarande positionerna, släck övriga DIREKT. Det blir ändå lugnt eftersom
        // varje bricka antingen står still vid origin, redan landat på destinationen (stannar),
        // eller bara passerar några få kvantiserade mellanstopp. (minLifeMs/litAt är kvar som
        // generell möjlighet men används inte av ström-modellen.)
        const litAt = new Map<string, number>();
        const reconcileLit = (keep: Set<string>, now: number, minLifeMs: number, forceAll = false) => {
            keep.forEach(k => { writeOp(k, 1); litAt.set(k, now); }); // i körfält → håll tänd + fräsch
            written.forEach((op, k) => {
                if (op <= 0.5 || keep.has(k) || sticky.has(k)) return;   // redan släckt / aktiv / valt event
                if (forceAll || now - (litAt.get(k) ?? 0) >= minLifeMs) { writeOp(k, 0); litAt.delete(k); }
            });
        };

        const N = REVEAL_NEAREST_COUNT;
        // Slutläget = de N närmast klicket.
        const destArr = [...nearestKeysTo(toLng, toLat, N)];
        const destSet = new Set(destArr);

        const p0 = map.project([fromLng, fromLat]);
        const p1 = map.project([toLng, toLat]);
        const pxDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);

        const finish = (now: number) => {
            revealTweenRef.current = null;
            reconcileLit(destSet, now, 0, true);   // hård settle: bara destinationen kvar
            revealSeedRef.current = destSet;
            revealMarchPtRef.current = { lng: toLng, lat: toLat };
            reportRevealCount('migration klar');
        };

        // TVÅ FASER, ingen korridor av mellanliggande event:
        //   1) RESA — EN bricka glider från origin mot klicket, accelererande (easeIn, som
        //      ett magnetiskt sug). Bara den brickan är tänd; fältet är annars släckt.
        //   2) INSUG — vid framme dras destinationens event in mot punkten, närmast först,
        //      i en snabb accelererande kaskad (en, sen flera) tills alla N står på plats.
        // Reslängden (TRAVEL_MS) skalar med klick-avståndet på skärmen: kort hopp → den
        // MINDRE tiden, hela skärmen → den STÖRRE (ordningen på konstanterna spelar ingen roll).
        const cv = map.getCanvas();
        const screenPx = Math.hypot(cv.clientWidth, cv.clientHeight) || 1;
        const distFrac = Math.min(1, pxDist / screenPx);   // 0 = samma punkt, 1 = hela skärmen

        // Samma plats / knappt något avstånd → inget att resa, settla destinationen direkt.
        if (pxDist < 40) { finish(performance.now()); return; }

        const lo = Math.min(REVEAL_STREAM_MS, REVEAL_STREAM_MS_MAX);
        const hi = Math.max(REVEAL_STREAM_MS, REVEAL_STREAM_MS_MAX);
        const TRAVEL_MS = lo + (hi - lo) * distFrac;   // restid (kort hopp → lo, långt → hi)
        const SETTLE_MS = 650;                         // magnetisk insugning av destinationen
        const start = performance.now();
        const tick = () => {
            const m = mapRef.current;
            if (!m || !layerExists(m, 'plain-events')) { revealTweenRef.current = null; return; }
            const now = performance.now();
            const elapsed = now - start;
            if (elapsed < TRAVEL_MS) {
                // FAS 1 — en bricka åker mot målet, accelererande (easeIn = magnetiskt sug).
                const p = elapsed / TRAVEL_MS;
                const e2 = p * p;
                const lng = fromLng + (toLng - fromLng) * e2;
                const lat = fromLat + (toLat - fromLat) * e2;
                reconcileLit(new Set(nearestKeysTo(lng, lat, 1)), now, 0, true);
                revealMarchPtRef.current = { lng, lat };
                revealTweenRef.current = requestAnimationFrame(tick);
                return;
            }
            // FAS 2 — destinationen dras in närmast-klicket-först, accelererande (easeOut).
            const sp = Math.min(1, (elapsed - TRAVEL_MS) / SETTLE_MS);
            const eased = 1 - (1 - sp) * (1 - sp);
            const k = Math.max(1, Math.round(N * eased));
            reconcileLit(new Set(destArr.slice(0, k)), now, 0, true);
            revealMarchPtRef.current = { lng: toLng, lat: toLat };
            if (sp >= 1) { finish(now); }
            else { revealTweenRef.current = requestAnimationFrame(tick); }
        };
        revealTweenRef.current = requestAnimationFrame(tick);
    }, [nearestKeysTo, reportRevealCount, writeReveal]);
    startRevealTravelRef.current = startRevealTravel;

    // Välj seed = de REVEAL_SEED_COUNT markörerna närmast ANVÄNDARENS PLATS (tap-
    // ankare eller GPS). Körs vid dataändring, på 'load' och när GPS-positionen
    // dyker upp — så brickorna kring en tänds direkt vid start när platsen är känd.
    // Avståndet skalar longitud med cos(latitud) så det blir rätt på svenska breddgrader.
    const recomputeRevealSeed = useCallback(() => {
        const map = mapRef.current;
        // Utgångspunkt: tap-ankaret om man tryckt på kartan (mobil-vänligt), annars
        // ANVÄNDARENS plats (om GPS/platstjänst hunnit svara). Ett tap visar
        // REVEAL_NEAREST_COUNT brickor och låser dem — panorering reseedar inte
        // (se moveend-handlern). Vet vi INTE var besökaren är (ingen tap, ingen
        // plats) tänds INGA brickor — kartan visar bara nål-prickarna; kartmitten
        // säger inget om var besökaren står och gav bara godtyckliga 50 event.
        const anchor = revealAnchorPtRef.current;
        const count = anchor ? REVEAL_NEAREST_COUNT : REVEAL_SEED_COUNT;
        const origin = anchor ?? userPosRef.current;
        // BARA icke-passerade grupper (revealCoordsRef är förfiltrerad på past) —
        // "har varit"-grupper ritas aldrig som brickor (bara prickar) och får inte
        // äta upp seed-platser: sent på kvällen såg man annars en handfull brickor
        // fast 50 relevanta fanns längre bort. Samma urval som tap-migrationen
        // (nearestKeysTo), så seed-omräkningen efter minut-ticken inte byter
        // uppsättning mot en med osynliga platser.
        const coords = new Map<string, [number, number]>();
        for (const c of revealCoordsRef.current) coords.set(c.key, [c.lng, c.lat]);
        let seedKeys: string[] = [];
        if (origin) {
            const allKeys = [...coords.keys()];
            if (allKeys.length > count) {
                const cl = origin.lng, ca = origin.lat;
                const kx = Math.cos(ca * Math.PI / 180);
                const d2 = (p: [number, number]) => (kx * (p[0] - cl)) ** 2 + (p[1] - ca) ** 2;
                allKeys.sort((a, b) => d2(coords.get(a)!) - d2(coords.get(b)!));
            }
            seedKeys = allKeys.slice(0, count);
        }
        const newSeed = new Set(seedKeys);
        // Göm gamla seed-nycklar som inte längre är seed (men aldrig klickade/sticky).
        if (map && layerExists(map, 'plain-events')) {
            revealSeedRef.current.forEach(k => {
                if (!newSeed.has(k) && !revealStickyRef.current.has(k)) {
                    try { map.setFeatureState({ source: 'plain-events', id: k }, { reveal: 0 }); } catch { /* */ }
                    revealWrittenRef.current.delete(k);
                }
            });
        }
        revealSeedRef.current = newSeed;
        reapplyAllRevealRef.current();
        ensureRevealPumpRef.current();
    }, []);
    recomputeRevealSeedRef.current = recomputeRevealSeed;

    // GPS-platsen kommer asynkront efter laddning. När den dyker upp (och man inte
    // redan tryckt på kartan) → tänd seedet kring användarens plats (innan dess
    // är inget tänt — bara nål-prickarna).
    useEffect(() => {
        if (userPos && !revealAnchorPtRef.current) recomputeRevealSeedRef.current();
    }, [userPos]);

    // Pusha ny GL-data när de icke-speciella grupperna ELLER multi-event-prickarna
    // ändras. Väntar på att stilen är redo (annars finns ingen källa att skriva till).
    useEffect(() => {
        plainFeaturesRef.current = plainData.features;
        usedIconsRef.current = plainData.icons;
        cycleRotationsRef.current = plainData.rotations;
        // cycleFrameIndexRef rensas MEDVETET inte här: en vald grupps rotation
        // försvinner tillfälligt (valda cyklar inte) men GL-bilden ligger kvar i
        // kartan på sin senaste frame — kommer samma bild-id tillbaka vid
        // avmarkering måste indexet ha överlevt, annars öppnar klicket frame 0
        // medan bilden visar frame N. Ett NYTT bild-id (ändrade frames) saknar
        // post → 0 = frame 0, vilket den nybakade bilden också visar. Stilbyte
        // (allt nybakas om på frame 0) nollställer i syncPlainLayer. Posterna
        // är småbytes — samma tillväxt som bakedIconsRef.
        multiEventDotFeaturesRef.current = multiEventDotData;
        // Platt koord-lista för "de N närmaste pekaren" (slipper bygga om varje frame).
        // Passerade grupper hoppas över — deras brickor tänds aldrig (de står som
        // prickar), så de ska inte äta upp reveal-platser kring ett tap/seedet.
        // Önskningarna likaså: de är REDAN alltid tända (sticky) och ska inte
        // äta upp seed-/tap-platser eller dras med i reveal-vandringen.
        revealCoordsRef.current = plainData.features.filter(f => !f.properties.past && !f.properties.key.startsWith('wish:')).map(f => ({
            key: f.properties.key, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
        }));
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) {
            syncPlainLayerRef.current();
        } else {
            const h = () => syncPlainLayerRef.current();
            map.once('style.load', h);
            return () => { map.off('style.load', h); };
        }
    }, [plainData, multiEventDotData]);

    // Släck ladda-pillen för gott (latch) först när ALLT landat OCH kartan
    // faktiskt målat symbolerna: inga omgångar i kön + minst en genomförd
    // målning (eller noll event att måla — t.ex. tom dag). Kravet på en
    // genomförd målning täcker kallstarten där aggregaten landar innan
    // kartstilen ens laddat klart — pending är då 0 utan att något synts.
    // Effekten ligger EFTER data-push-effekten ovan så en settled-batch hinner
    // ställa sig i kön (pendingPaintRef++) innan latch-villkoret prövas.
    useEffect(() => {
        if (symbolsPainted || !eventsSettled) return;
        const nothingToPaint = plainFeaturesRef.current.length === 0;
        if (pendingPaintRef.current === 0 && (hasPaintedOnceRef.current || nothingToPaint)) {
            paintLatchRef.current = true;
            setSymbolsPainted(true);
            // Första FAKTISKA målningen (inte hang-guardens tomma latch — den
            // har 0 features och återöppnas av datan) → släpp de tunga lagren
            // (cards/descriptions) via onFirstPaint. En gång per sidladdning.
            if (hasPaintedOnceRef.current && !firstPaintFiredRef.current) {
                firstPaintFiredRef.current = true;
                onFirstPaintRef.current?.();
            }
        }
        // Annars: målnings-rundans klart-signal (sourcedata/isSourceLoaded + en
        // render-frame, idle som säkerhetsnät) bumpar paintDoneNonce → hit igen.
        // Obs: hang-guarden kan latcha här med 0 features INNAN datan ens kommit —
        // pushPlainEvents ÅTERÖPPNAR då latchen när första riktiga datan landar.
    }, [eventsSettled, paintDoneNonce, symbolsPainted]);

    // Håll reveal-systemet i synk med datan: rensa bort nycklar som inte längre
    // finns (inkl. MapLibres interna feature-state, så en återanvänd nyckel börjar
    // dold) och välj om seed via recomputeRevealSeed.
    useEffect(() => {
        const present = new Set(plainData.features.map(f => f.properties.key));
        const map = mapRef.current;
        const hasLayer = !!(map && layerExists(map, 'plain-events'));
        const drop = (k: string) => { if (hasLayer) { try { map!.removeFeatureState({ source: 'plain-events', id: k }); } catch { /* */ } } };
        for (const k of [...revealSeedRef.current]) if (!present.has(k)) { revealSeedRef.current.delete(k); drop(k); }
        // Sticky-nycklar vars event helt försvunnit ur datan rensas; en VALD bricka
        // saknas tillfälligt i plainData (den är DOM medan den är vald) men finns kvar
        // i groups → behåll den så den tänds igen i GL när den avmarkeras.
        // wish:-nycklar finns aldrig i groups — de städas av sticky-effekten
        // nedan (dep wishes) + present-prunen ovan, inte här.
        for (const k of [...revealStickyRef.current]) if (!k.startsWith('wish:') && !groupsRef.current.has(k)) revealStickyRef.current.delete(k);
        for (const k of [...revealWrittenRef.current.keys()]) if (!present.has(k)) { revealWrittenRef.current.delete(k); drop(k); }
        recomputeRevealSeedRef.current();
    }, [plainData]);

    // Tvinga fram det VALDA eventets GL-bricka oavsett var den ligger (även när
    // den inte är bland de N närmaste senaste tappet, t.ex. efter Nästa till ett
    // event långt bort). revealStickyRef tänds i reapplyAllReveal/pumpReveal och
    // släcks aldrig av seed-omräkningen → brickan man är "på" syns alltid. DOM-
    // markören med vit ram ligger ovanpå; faller den bort syns ändå GL-brickan.
    useEffect(() => {
        const sticky = revealStickyRef.current;
        sticky.clear();
        if (selectedEvent) {
            for (const [key, group] of groupsRef.current) {
                if (group.some(e => e.id === selectedEvent.id)) { sticky.add(key); break; }
            }
        }
        // Gillade (framtida) event hålls ALLTID tända (force-reveal) så deras vita GL-
        // bricka syns överallt — oavsett avslöjning, viewport eller vad som är valt.
        // Samma sak för event SKAPADE PÅ VADKUL (userCreated): sajtens kärna ska
        // aldrig behöva skrapas fram utan syns alltid, för alla besökare.
        {
            // Samma isEventPast-gräns som dämpningen/SavedPanel (start + 1 h,
            // kl 20 för event utan klockslag).
            const stickyNowMs = Date.now();
            for (const [key, group] of groupsRef.current) {
                if (group.some(e =>
                    e.userCreated ||
                    (savedEventIds.has(e.id) && !isEventPast(e, stickyNowMs)) ||
                    // Stjärn-gåvan ⭐: stjärnmärkta event lyser för ALLA —
                    // samma force-reveal som userCreated, tills eventet passerat
                    // (därefter är stjärnan förbrukad och vanliga past-
                    // släckningen gäller, ingen specialbehandling).
                    (starredEventIds.has(e.id) && !isEventPast(e, stickyNowMs))
                )) sticky.add(key);
            }
        }
        // Användarskapade event (sajtens kärna) hålls ALLTID tända — samma force-
        // reveal som gillade event. Så deras (smaragdgröna) bricka syns överallt,
        // oavsett avslöjning/närhet, viewport-panorering, zoomnivå eller kategori-
        // val. De ligger aldrig i opt-in-källorna, så de tre opt-in-kategorierna
        // (Korpen/Svenska kyrkan/PRO) behåller sitt opt-in-beteende oförändrat.
        for (const [key, group] of groupsRef.current) {
            if (group.some(e => e.userCreated)) sticky.add(key);
        }
        // Önskningarna hålls OCKSÅ alltid tända — de ska aldrig behöva skrapas
        // fram (drömska brickor som syns för alla, tills de gått ut/uppfyllts).
        for (const w of wishes) sticky.add(`wish:${w.id}`);
        reapplyAllRevealRef.current();
    }, [selectedEvent, savedEventIds, starredEventIds, groups, wishes]);

    // ── Emoji-/färgväxling för multi-event-BRICKOR (GL) ───────────────────────
    // Multi-grupperna är GL-brickor numera (DOM-markör finns bara för den VALDA
    // gruppen). Grupper med ≥2 OLIKA emojis pekar på sin EGEN cykel-bild
    // (`cycle:<gruppnyckel>:<frames>`, se plainData) och växlingen är ett RAKT
    // byte av den bildens pixlar via map.updateImage — minsta möjliga data: en
    // liten texturuppload per byte, ingen setData/omtiling, ingen fade, ingen
    // feature-state. STAGGRAT: bland de TÄNDA (reveal > 0.5) cyklande brickorna
    // byter EN bricka per tick, i tur och ordning (round-robin) — aldrig två
    // samtidigt. Är ingen tänd står allt still (noll kostnad i vila).
    // Count-badgen är ett eget textlager och ligger stilla under bytet.
    const selectedEventValRef = useRef(selectedEvent);
    selectedEventValRef.current = selectedEvent;
    useEffect(() => {
        const CYCLE_STEP_MS = 1000; // EN bricka byter per sekund
        const interval = setInterval(() => {
            const map = mapRef.current;
            if (!map || !styleReady(map) || !layerExists(map, 'plain-events')) return;
            const rotations = cycleRotationsRef.current;
            if (rotations.size === 0) return;
            const written = revealWrittenRef.current;
            // Tända cyklande brickor just nu, i stabil ordning (feature-ordningen).
            // rot.icon måste matcha featurens icon — annars är rotationen från en
            // nyare databygge än det som ligger i källan (skarven vid en push).
            const visible: { key: string; rot: CycleRotation }[] = [];
            for (const f of plainFeaturesRef.current) {
                const rot = rotations.get(f.properties.key);
                if (!rot || rot.icon !== f.properties.icon) continue;
                if ((written.get(f.properties.key) ?? 0) > 0.5) visible.push({ key: f.properties.key, rot });
            }
            if (visible.length === 0) return;
            // Round-robin: fortsätt EFTER den som bytte förra ticken. Har den
            // släckts/försvunnit ger findIndex −1 → börja om från listans start.
            const lastKey = cycleLastKeyRef.current;
            const pick = visible[(visible.findIndex(v => v.key === lastKey) + 1) % visible.length];
            cycleLastKeyRef.current = pick.key;
            const frames = pick.rot.frames;
            const nextIdx = ((cycleFrameIndexRef.current.get(pick.rot.icon) ?? 0) + 1) % frames.length;
            cycleFrameIndexRef.current.set(pick.rot.icon, nextIdx);
            const fr = frames[nextIdx];
            const frameId = `${fr.color ? `bricka:${fr.color}:${fr.emoji}` : `bricka:${fr.emoji}`}${fr.saved ? ':sav' : ''}`;
            let baked = bakedIconsRef.current.get(frameId);
            if (!baked) {
                const b = makeBrickaImageData(fr.emoji, fr.color, false, fr.saved);
                if (b) { bakedIconsRef.current.set(frameId, b); baked = b; }
            }
            // Alla brickbilder bakas med samma mått (S/DPR-konstanterna i
            // makeBrickaImageData) — kravet för updateImage.
            if (baked && map.hasImage(pick.rot.icon)) {
                try { map.updateImage(pick.rot.icon, baked.data); } catch { /* stilbyte i skarven */ }
            }
        }, CYCLE_STEP_MS);
        return () => clearInterval(interval);
    }, []);

    // Spårar ORDNINGEN man bläddrat genom den valda gruppen, så grupp-markörens
    // siffra speglar din position (Nästa → mindre, Bakåt → större). Nollställs
    // när man byter grupp. (Ett event som man går tillbaka till finns redan i
    // listan → ordningen ändras inte, men index/siffran följer det valda.)
    const visitedOrderRef = useRef<string[]>([]);
    const visitedGroupKeyRef = useRef<string | null>(null);
    useEffect(() => {
        const map = mapRef.current;
        if (!selectedEvent || selectedEvent.lat == null || selectedEvent.lng == null) {
            visitedOrderRef.current = [];
            visitedGroupKeyRef.current = null;
            setGroupList(null);
            setGroupListAnchor(null);
            return;
        }
        const gk = groupKeyOf(selectedEvent.lat, selectedEvent.lng);
        if (gk !== visitedGroupKeyRef.current) {
            visitedGroupKeyRef.current = gk;
            visitedOrderRef.current = [selectedEvent.id];
        } else if (!visitedOrderRef.current.includes(selectedEvent.id)) {
            visitedOrderRef.current.push(selectedEvent.id);
        }

        // Öppna automatiskt multi-event-listan om det valda eventet ingår i en grupp med flera event
        const group = groups.get(gk);
        if (group && group.length > 1) {
            setGroupList(group);
            setGroupListAnchor({ lng: selectedEvent.lng, lat: selectedEvent.lat });
            if (map) {
                setGroupListPos(map.project([selectedEvent.lng, selectedEvent.lat]));
            }
        } else {
            setGroupList(null);
            setGroupListAnchor(null);
        }
    }, [selectedEvent, groups]);

    // 1. Initiera MapLibre kartan en gång
    useEffect(() => {
        if (!mapContainerRef.current) return;

        let map: maplibregl.Map;
        try {
        map = new maplibregl.Map({
            container: mapContainerRef.current,
            // Bootstrap-stil: en synkron enfärgad bakgrund i nöjesfältets land-färg
            // så kartan renderar direkt. mapStyle-effekten byter sedan till förvald
            // 'themepark' (async fetch + transform) efter mount. Bakgrundsfärgen
            // matchar themeparken → bytet syns inte som ett hopp (jfr. tidigare
            // satellit-bootstrap som blixtrade förbi en satellitvy).
            style: BOOTSTRAP_STYLE,
            // Startvy: södra Sverige (Skåne syns), mer inzoomad — se START_CENTER/_ZOOM.
            // Vid start finns ändå inga avslöjade event, så en tightare sydlig vy känns
            // mindre tom och landar nära där de flesta användarna faktiskt är.
            center: START_CENTER,
            zoom: START_ZOOM,
            // Hur långt man får zooma UT. Utan gräns kan man zooma ut till hela
            // världen (zoom 0) vilket kraschar appen — massor av tiles gör att
            // WebGL tappar renderingskontexten. 4 ≈ hela Sverige i bild: gott om
            // kontext men utan den minnestunga kontinent-/världsvyn som dödar GPU:n.
            minZoom: 4,
            // ── Minnestak för tile-cachen ──────────────────────────────────
            // Satellitvyn använder TVÅ raster-källor (bilder + etiketter). Varje
            // 256px-tile blir en GPU-textur (~256 KB). Utan tak växer cachen
            // obegränsat ju mer man pannar/zoomar ("ju mer av kartan man läser
            // in") → minnet drar iväg mot ~600 MB. Vi sätter ett hårt tak per
            // källa och behåller färre zoom-nivåer (default 5) så cachen trimmas
            // löpande i stället för att ackumulera.
            maxTileCacheSize: 80,
            maxTileCacheZoomLevels: 3,
            // Ladda inte om utgångna tiles i bakgrunden — sparar både nät och
            // minne (gamla texturer hålls inte kvar i väntan på refresh).
            refreshExpiredTiles: false,
            // Lägg INTE till default-attributionen automatiskt. På breda skärmar
            // renderas den som en utfälld textrad ("MapLibre | © CARTO …") längst
            // ner — vi vill i stället ha en egen i compact-läge (liten ⓘ-knapp) som
            // läggs till direkt efter init nedan.
            attributionControl: false
        });
        } catch (err) {
            // WebGL kunde inte initieras (ofta "blocked" efter en tidigare
            // kontextförlust). Krascha inte hela appen — visa fallback i stället.
            console.error('Kartan kunde inte initieras (WebGL)', err);
            setMapError(true);
            return;
        }

        mapRef.current = map;

        // Egen attribution: alltid compact (en liten ⓘ-knapp i hörnet i stället för
        // en utfälld textrad). Attributionen MÅSTE finnas kvar — CARTO och
        // OpenStreetMap kräver den juridiskt — men den behöver inte stå utfälld.
        map.addControl(new maplibregl.AttributionControl({ compact: true }));

        // MapLibre's compact-attribution öppnar sig SJÄLV ('maplibregl-compact-show'
        // + <details open>) varje gång compact-läget (åter)etableras under
        // inladdningen — vid första resizen och vid stilbytet bootstrap→themepark. En
        // engångs-collapse vinner därför en kapplöpning ibland och förlorar ibland. Vi
        // håller den hopfälld med en observer tills kartan blivit idle; därefter slutar
        // MapLibre toggla själv och användarens klick på ikonen får expandera den fritt.
        const attribEl = mapContainerRef.current?.querySelector('details.maplibregl-ctrl-attrib');
        let attribObserver: MutationObserver | null = null;
        if (attribEl instanceof HTMLDetailsElement) {
            const collapseAttrib = () => {
                if (attribEl.open || attribEl.classList.contains('maplibregl-compact-show')) {
                    attribEl.open = false;
                    attribEl.classList.remove('maplibregl-compact-show');
                }
            };
            collapseAttrib();
            attribObserver = new MutationObserver(collapseAttrib);
            attribObserver.observe(attribEl, { attributes: true, attributeFilter: ['open', 'class'] });
            map.once('idle', () => { attribObserver?.disconnect(); attribObserver = null; });
        }


        let glCanvas: HTMLCanvasElement | null = null;
        let onCtxLost: ((e: Event) => void) | null = null;
        let onCtxRestored: (() => void) | null = null;
        try {
            glCanvas = map.getCanvas();
            if (!glCanvas) {
                console.error('Kartan kunde inte hämta WebGL-canvas.');
                setMapError(true);
                return;
            }
            onCtxLost = (e: Event) => {
                e.preventDefault();
                console.error('WebGL-kontext förlorad, visar felsida.');
                setMapError(true);
            };
            onCtxRestored = () => { try { map.triggerRepaint(); } catch { /* noop */ } };
            glCanvas.addEventListener('webglcontextlost', onCtxLost as EventListener, false);
            glCanvas.addEventListener('webglcontextrestored', onCtxRestored as EventListener, false);
        } catch (postErr) {
            console.error('Krasch under kartinitiering (WebGL canvas):', postErr);
            setMapError(true);
            return;
        }

        // Zoom-klasshantering: under zoom-gesten fälls allt till nålar/prickar
        // (billigt), i vila visas brickorna. DOM-brickorna växlar via CSS-klassen;
        // GL-lagret växlar mellan symbol-lagret (brickor) och cirkel-lagret
        // (prickar). I vila syns ALLA brickor på alla zoomnivåer.
        const container = mapContainerRef.current;
        const setGlLayer = (id: string, visible: boolean) => {
            if (layerExists(map, id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        };
        const showNeedles = () => {
            container.classList.remove('map-state-full');
            container.classList.add('map-state-needle');
            setGlLayer('plain-events', false);
            // During zoom, show all dots including revealed ones ("har varit" stays at 50%)
            if (layerExists(map, 'plain-events-dots')) {
                map.setPaintProperty('plain-events-dots', 'circle-opacity', PAST_DIM_EXPR);
                map.setPaintProperty('plain-events-dots', 'circle-stroke-opacity', ['*', 0.9, PAST_DIM_EXPR]);
            }
            setGlLayer('plain-events-dots', true);
        };
        const showBricks = () => {
            container.classList.remove('map-state-needle');
            container.classList.add('map-state-full');
            setGlLayer('plain-events', true);
            // Prickarna göms INTE här — då blir det ett tomt glapp medan symbol-lagret
            // (brickorna) placerar sina ikoner. De ligger kvar tills exitZooming, dvs
            // när zoomen tystnat OCH brickorna hunnit ritas. Så syns alltid något.
        };

        map.on('zoomstart', showNeedles);
        map.on('zoomend', showBricks);

        // ── Multi-event: prick UNDER zoom-gesten, DOM-bricka i vila ───────────────
        // VILO-läget är ALLTID DOM (isZooming=false). Vi förlitar oss INTE på att
        // 'zoomend' fyras (den kan missas vid avbrutna animationer → tidigare bugg där
        // brickorna försvann i vila). I stället: varje zoom-aktivitet markerar "zoomar"
        // + (om)startar en kort vilo-timer. När zoomen tystnat 180 ms → tillbaka till
        // DOM. Prick-lagrens synlighet växlas SYNKRONT (instant, ingen worker-runda)
        // så prick och DOM aldrig överlappar. Ren pan (idle-drift) fyrar inga zoom-
        // events → triggar aldrig prickläget.
        let zoomIdleTimer: ReturnType<typeof setTimeout> | null = null;
        // Göm nål-prickarna FÖRST när brickorna FAKTISKT ritats. 'idle' fyras när
        // kartan ritat klart allt som efterfrågats (ikoner bakade + symboler placerade)
        // — så prickarna kan aldrig försvinna INNAN brickorna syns. Fallback-timeout om
        // idle dröjer (långsamma tiles); hoppar om en ny zoom hunnit börja.
        const hideNeedleDotsWhenRendered = () => {
            const m = mapRef.current;
            if (!m) return;
            const finish = () => {
                if (!isZoomingRef.current && layerExists(m, 'plain-events-dots')) {
                    // Restore conditional opacity in rest state: hide dots under the
                    // revealed bricks (passerade grupper förblir prickar på 50 %)
                    m.setPaintProperty('plain-events-dots', 'circle-opacity', DOT_REST_OPACITY_EXPR);
                    m.setPaintProperty('plain-events-dots', 'circle-stroke-opacity', DOT_REST_STROKE_OPACITY_EXPR);
                }
            };
            m.once('idle', finish);
            setTimeout(finish, 1500);
        };
        const exitZooming = () => {
            zoomIdleTimer = null;
            isZoomingRef.current = false;
            setGlLayer('plain-events', true);            // brickorna ska vara tända i vila
            setGlLayer('multi-event-dots', false);
            setGlLayer('multi-event-dots-count', false);
            setIsZooming(false);
            hideNeedleDotsWhenRendered();                // prickarna kvar tills brickorna ritats
        };
        const markZooming = () => {
            if (zoomIdleTimer) { clearTimeout(zoomIdleTimer); zoomIdleTimer = null; }
            if (!isZoomingRef.current) {
                isZoomingRef.current = true;
                setGlLayer('multi-event-dots', true);
                setGlLayer('multi-event-dots-count', true);
                setIsZooming(true);
            }
            // Auto-exit en kort stund efter SISTA zoom-aktiviteten (robust även om
            // 'zoomend' aldrig kommer) → vilo-läget faller alltid tillbaka till DOM.
            zoomIdleTimer = setTimeout(exitZooming, 180);
        };
        map.on('zoomstart', markZooming);
        map.on('zoom', markZooming);
        map.on('zoomend', markZooming);
        // Extra säkerhetsnät: när ALL rörelse (pan/zoom) lagt sig fyras 'moveend' →
        // tvinga tillbaka vilo-läget (DOM-brickor). Garanterar att isZooming aldrig
        // fastnar i true om en zoom-animation byts ut innan 180 ms-timern hann gå.
        // I vila är detta en no-op (redan false), så ingen flimmer/extra omritning.
        map.on('moveend', exitZooming);

        // GL-lager som är klickbara: brickorna (inzoomat) + prickarna (utzoomat) +
        // multi-event-prickarna. Klick på en multi-prick väljer gruppens första event
        // (onGlMarkerClick slår upp gruppen via feature-properties.key).
        const glHitLayers = ['plain-events', 'plain-events-dots', 'multi-event-dots'];
        const glLayersPresent = () => glHitLayers.filter(id => layerExists(map, id));

        map.on('click', (e) => {
            // Klick på en SYNLIG GL-markör hanteras av lager-handlern nedan (väljer
            // eventet) — avmarkera/avslöja då inte. En DOLD bricka (icon-opacity 0)
            // är fortfarande träffbar i queryRenderedFeatures men ska INTE gå att
            // klicka direkt: första trycket på ett gömt område avslöjar bara. Vi
            // räknar därför bara hit på AVSLÖJADE plain-events-brickor som "markör".
            const layers = glLayersPresent();
            if (layers.length) {
                const hits = map.queryRenderedFeatures(e.point, { layers });
                const hitVisibleMarker = hits.some(h => {
                    if (h.layer.id === 'plain-events' || h.layer.id === 'plain-events-dots') {
                        const key = h.properties?.key as string | undefined;
                        // Faktiskt renderat tillstånd (ground truth), inte write-cachen —
                        // annars kunde en SYNLIG bricka råka klassas som dold → klicket
                        // gick till avslöjning/bro i stället för att öppna (brickan "försvann").
                        return !!key && ((map.getFeatureState({ source: 'plain-events', id: key }).reveal as number ?? 0) > 0.5);
                    }
                    return true; // andra lager (t.ex. multi-event-dots) — alltid klickbara
                });
                if (hitVisibleMarker) return;
            }
            // Tom karta-tap (eller bara dolda brickor under fingret) = ny utgångspunkt:
            // bron byter ut den avslöjade uppsättningen mot de N närmast klicket. Klick
            // PÅ tom karta (ej på en markör) STÄNGER också ev. öppet eventkort + listan.
            setGroupList(null);            // stäng ev. öppen multi-event-lista
            setGroupListAnchor(null);
            onSelectEventRef.current(null); // stäng eventkortet (klick utanför markör)
            onSelectWishRef.current?.(null); // stäng ev. öppet önske-kort
            startRevealTravelRef.current(e.lngLat.lng, e.lngLat.lat);
        });

        // GL-markör/prick klickad → välj eventet (eller gissa i spelläget). Handlern
        // registreras en gång; den matchar lagret så fort det (åter)installerats.
        const onGlMarkerClick = (e: maplibregl.MapLayerMouseEvent) => {
            // Plocka rätt bricka bland ALLA träffar under fingret — inte bara
            // features[0] (då snodde en dold/enskild granne klicket: den "döda
            // klick"-buggen). Två regler, i ordning:
            //   1) bara AVSLÖJADE brickor är valbara (dolda ska skrapas fram av det
            //      allmänna klicket, inte öppnas direkt) — multi-event-dots o.d. är
            //      alltid valbara.
            //   2) bland de valbara vinner den med FLEST event (count) — samma
            //      prioritet som z-staplingen, så en fler-event-bricka aldrig
            //      förlorar klicket till en enskild bricka som råkar ligga under.
            const candidates = (e.features ?? []).filter(f => {
                const lid = f.layer?.id;
                if (lid === 'plain-events' || lid === 'plain-events-dots') {
                    const k = f.properties?.key as string | undefined;
                    return !!k && ((map.getFeatureState({ source: 'plain-events', id: k }).reveal as number ?? 0) > 0.5);
                }
                return true;
            });
            // Bara dolda brickor under fingret → låt det allmänna klicket avslöja.
            if (candidates.length === 0) return;
            // Ikonens träffyta (omslutande kvadrat) är STÖRRE än den synliga romb-brickan,
            // så tätt packade brickor får överlappande hit-boxar. Välj den vars MITT
            // ligger närmast där man faktiskt tryckte → varje bricka går att peta på,
            // även i ett kluster. Brickan är botten-ankrad (kroppen sitter en bit OVANFÖR
            // geopunkten), så jämför mot en punkt en bit ned från brick-kroppen.
            const ANCHOR_LIFT_PX = 28;
            const qx = e.point.x, qy = e.point.y + ANCHOR_LIFT_PX;
            const ranked = candidates.map(f => {
                const c = (f.geometry as GeoJSON.Point | undefined)?.coordinates;
                const pp = c ? map.project([c[0], c[1]]) : null;
                const d = pp ? Math.hypot(pp.x - qx, pp.y - qy) : 1e9;
                return { f, d, count: Number(f.properties?.count) || 1 };
            });
            // Närmast vinner; ligger två i princip lika nära (≤3px) avgör flest event.
            ranked.sort((a, b) => (Math.abs(a.d - b.d) > 3 ? a.d - b.d : b.count - a.count));
            const key = ranked[0].f.properties?.key as string | undefined;
            // ÖNSKE-bricka (nyckel "wish:<id>") → öppna det lilla önske-kortet
            // (renderas av sidan) i stället för ett eventkort. Önskningar finns
            // aldrig i groups, så de måste fångas FÖRE grupp-uppslaget.
            if (key?.startsWith('wish:')) {
                const wish = wishesRef.current.find(w => `wish:${w.id}` === key);
                if (wish) {
                    setGroupList(null);
                    setGroupListAnchor(null);
                    onSelectWishRef.current?.(wish);
                }
                return;
            }
            const group = key ? groupsRef.current.get(key) : undefined;
            if (!group || group.length === 0) return;
            // FLERA event på samma plats → öppna en LISTA (emoji + titel + tid) så man
            // kan välja vilket. Ett enda event → öppna direkt.
            if (group.length > 1) {
                // Multibrickan cyklar: öppna det event vars frame VISAS just nu
                // (pumpens frame-index via shownCycleEvent) — inte gruppens
                // första. Saknas rotation (t.ex. alla frames samma emoji) →
                // redan valt event i gruppen, sist group[0].
                const rep = shownCycleEvent(key ? cycleRotationsRef.current.get(key) : undefined, cycleFrameIndexRef.current, group)
                    || group.find(ev => ev.id === selectedEventValRef.current?.id)
                    || group[0];
                // Ankra listan vid brickans geo-punkt (projiceras i updateCloudPosition).
                if (isValidLatLng(rep.lat, rep.lng)) {
                    setGroupListAnchor({ lng: rep.lng!, lat: rep.lat! });
                    setGroupListPos(map.project([rep.lng!, rep.lat!]));
                } else {
                    setGroupListAnchor(null);
                    setGroupListPos(null);
                }
                setGroupList(group);
                onSelectEventRef.current(rep);
                return;
            }
            setGroupList(null);
            setGroupListAnchor(null);
            onSelectEventRef.current(group[0]);
        };
        const setPointer = () => { const c = map.getCanvas(); if (c) c.style.cursor = 'pointer'; };
        const clearPointer = () => { const c = map.getCanvas(); if (c) c.style.cursor = ''; };
        glHitLayers.forEach(id => {
            map.on('click', id, onGlMarkerClick);
            map.on('mouseenter', id, setPointer);
            map.on('mouseleave', id, clearPointer);
        });

        map.on('drag', () => {
            if (onMapDragRef.current) {
                onMapDragRef.current();
            }
        });

        // Real-time projection updater: håller multi-event-listan fastnitad vid
        // sin brickas geo-punkt när kartan pannas/zoomas.
        const updateCloudPosition = () => {
            // Multi-event-listan: håll dess skärmposition fast vid brickans geo-punkt
            // när kartan pannas/zoomas, så den stannar i brickans övre högra hörn.
            const ga = groupListAnchorRef.current;
            if (ga) {
                const pos = map.project([ga.lng, ga.lat]);
                setGroupListPos((prev) =>
                    prev && Math.round(prev.x) === Math.round(pos.x) && Math.round(prev.y) === Math.round(pos.y)
                        ? prev : { x: pos.x, y: pos.y });
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
            // Installera GL-markörlagret + pusha första datan.
            syncPlainLayerRef.current();
            if (onCenterChangeRef.current) {
                const center = map.getCenter();
                onCenterChangeRef.current(center.lat, center.lng);
            }
            // Startvy: hämta användarens plats (platstjänst) men ZOOMA INTE in dit —
            // vi vill se HELA Sverige när sidan öppnas. Vi sätter bara userPos så den
            // blå plats-pricken visar var man är; kameran står kvar på standardvyn
            // (mitt-Sverige, zoom 5). Nekad/timeout → ingen prick, samma vy.
            if (typeof navigator !== 'undefined' && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    () => { /* nekad/timeout → ingen plats-prick, behåll Sverige-vyn */ },
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
                );
            }
            // INGEN reseed på moveend. Avslöjningen drivs BARA av tryck (map 'click' →
            // startRevealTravel) + ett initialt seed nedan. Förut reseedade moveend till
            // "~10 närmast mitten" så fort kartan rörde sig — och moln-driften fyrar
            // moveend hela tiden → de 30 man klickat fram försvann och ersattes av ~10
            // nära mitten/min-position. Borttaget: panorering/drift ändrar inte urvalet.
            // Initialt seed: de N närmast användarens plats om den är känd (tap/GPS)
            // — annars tänds inget (bara nål-prickarna) tills första trycket.
            recomputeRevealSeedRef.current();
        });

        return () => {
            if (attribObserver) attribObserver.disconnect();
            if (moveEndTimer) clearTimeout(moveEndTimer);
            if (zoomIdleTimer) clearTimeout(zoomIdleTimer);
            if (glCanvas && onCtxLost) glCanvas.removeEventListener('webglcontextlost', onCtxLost as EventListener);
            if (glCanvas && onCtxRestored) glCanvas.removeEventListener('webglcontextrestored', onCtxRestored as EventListener);
            // Reveal: lyssnare + rAF (vilo-skrivning + vandring).
            if (revealCleanupRef.current) { revealCleanupRef.current(); revealCleanupRef.current = null; }
            if (revealRafRef.current != null) { cancelAnimationFrame(revealRafRef.current); revealRafRef.current = null; }
            if (revealTweenRef.current != null) { cancelAnimationFrame(revealTweenRef.current); revealTweenRef.current = null; }
            // Pågående marker-stream + målnings-runda (map.remove() tar lyssnarna,
            // timers måste vi städa själva).
            if (streamCleanupRef.current) { streamCleanupRef.current(); streamCleanupRef.current = null; }
            if (paintRoundRef.current) { paintRoundRef.current.canceled = true; paintRoundRef.current = null; }
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Kör fn så snart kartans stil är redo (annars går addSource/setTerrain fel).
    const runWhenStyleReady = (fn: (map: maplibregl.Map) => void) => {
        const map = mapRef.current;
        if (!map) return;
        if (map.isStyleLoaded()) fn(map);
        else map.once('style.load', () => fn(map));
    };

    // Byt baskartan när användaren togglar satellit-knappen. Markörerna ligger som
    // DOM-element i container och påverkas inte av setStyle.
    useEffect(() => {
        // Spegla aktiv kartstil som klass på containern så markör-CSS:en kan
        // anpassa kontrast per stil (se .map-style-dark-reglerna).
        const container = mapContainerRef.current;
        if (container) {
            container.classList.remove('map-style-streets', 'map-style-satellite', 'map-style-themepark', 'map-style-dark', 'map-style-orientering');
            container.classList.add(`map-style-${mapStyle}`);
        }
        const map = mapRef.current;
        if (!map) return;
        // setStyle ersätter HELA stilen → projektionen nollställs och custom-källor
        // (DEM) försvinner. Återställ globe + terräng när nya stilen laddat klart.
        const afterLoad = () => {
            applyProjection(map, isGlobeRef.current);
            applyTerrain(map, is3DTerrainRef.current);
            // Orienterings-reliefen lever bara i den stilen; setStyle har redan
            // rensat ett ev. gammalt lager, så vi behöver bara lägga till det igen.
            applyHillshade(map, mapStyleRef.current === 'orientering');
            // setStyle rensade GL-markörlagret (källa/bilder/lager) — återinstallera.
            // instant: användaren har redan sett markörerna — återställ allt direkt,
            // ingen ny pö-om-pö-stream (och ingen latch-återöppning av ladda-pillen).
            syncPlainLayerRef.current({ instant: true });
        };
        const applyStyle = (style: string | maplibregl.StyleSpecification) => {
            map.setStyle(style);
            map.once('style.load', afterLoad);
        };
        if (mapStyle === 'satellite') {
            applyStyle(SATELLITE_STYLE);
        } else if (mapStyle === 'themepark') {
            // Nöjesfälts-kartan: Voyager i en mildare, naturlig palett. Hämta +
            // transformera en gång, cacha sedan i themeParkStyleRef.
            if (themeParkStyleRef.current) {
                applyStyle(themeParkStyleRef.current);
            } else {
                fetchAndTransformThemeParkStyle()
                    .then(style => {
                        themeParkStyleRef.current = style;
                        // Användaren kan ha hunnit byta stil under hämtningen —
                        // applicera bara om nöjesfält fortfarande är valt.
                        if (mapStyleRef.current === 'themepark') applyStyle(style);
                    })
                    .catch(() => {
                        // Faller tillbaka till vanliga Voyager om hämtningen strular.
                        if (mapStyleRef.current === 'themepark') applyStyle(STREETS_STYLE_URL);
                    });
            }
        } else if (mapStyle === 'dark') {
            applyStyle(DARK_STYLE_URL);
        } else if (mapStyle === 'orientering') {
            // Ljus Voyager-bas + hillshade-relief (läggs på i afterLoad).
            applyStyle(STREETS_STYLE_URL);
        } else {
            applyStyle(STREETS_STYLE_URL);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapStyle]);

    // Globe-läge: skifta projektion mercator ↔ globe. Helt fristående toggle.
    useEffect(() => {
        runWhenStyleReady(map => applyProjection(map, isGlobe));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobe]);

    // 3D-terräng: fristående toggle. Lägger till/tar bort DEM-källan + terräng-mesh.
    useEffect(() => {
        runWhenStyleReady(map => applyTerrain(map, is3DTerrain));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [is3DTerrain]);


    // Vid val av event: stå kvar där användaren är. Klickar man på en markör som
    // redan syns i vyn flyttar vi INTE kameran alls (och zoomar definitivt inte in).
    // Bara om det valda eventet ligger UTANFÖR vyn (t.ex. valt via sök/sparat/delad
    // länk) panorerar vi dit så kortet inte pekar på något man inte ser — och då på
    // SAMMA zoomnivå (vi zoomar aldrig in). Recenter-/Fokus-knappen är separat.
    const recenterOnSelected = () => {
        const map = mapRef.current;
        if (!map) return;
        if (!selectedEvent || !selectedEvent.lat || !selectedEvent.lng) return;

        // Vi vill ALLTID se den valda eventbrickan (så man vet vilket event man är
        // på) — men utan att zooma in. Är brickan redan synlig i den ANVÄNDBARA ytan
        // (ovanför kortet i nederkant, under navbaren upptill) → stå still. Bara om
        // den är dold (bakom kortet eller helt utanför vyn) panorerar vi dit — och då
        // på SAMMA zoomnivå (aldrig inzoomning).
        const cont = map.getContainer();
        const h = cont.clientHeight, w = cont.clientWidth;
        const p = map.project([selectedEvent.lng, selectedEvent.lat]);
        // Hur stor del av nederkanten kortet ungefär täcker (utfällt täcker mer).
        const cardBottom = h * (cardExpanded ? 0.58 : 0.42);
        // Panorera bara UPP när brickan är dold BAKOM kortet (nederkanten) eller helt
        // utanför vyn — INTE nedåt bara för att den är nära toppen. Förut räknades
        // översta 12% som "dold" → en bricka nära navbaren hoppade nedåt vid klick
        // (det användaren märkte). topMargin=0 ⇒ inga down-hopp för synliga brickor.
        const visibleAboveCard =
            p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= (h - cardBottom);
        if (visibleAboveCard) return;

        // Dold → panorera så brickan hamnar i den synliga ytan ovanför kortet
        // (behåll nuvarande zoom, ingen inzoomning).
        const targetYRatio = cardExpanded ? 0.30 : 0.40;
        const yOffset = h * (targetYRatio - 0.5);
        map.easeTo({
            center: [selectedEvent.lng, selectedEvent.lat],
            zoom: map.getZoom(),
            offset: [0, yOffset],
            duration: 500
        });
    };

    // Dagbyte: stå still. När daySwitchNonce bumpas öppnar vi ett kort fönster där
    // val-effekten nedan INTE flyttar kameran (täcker både select-bytet och att
    // kortet öppnas direkt efteråt). Måste deklareras FÖRE val-effekten så den
    // hinner sätta fönstret innan val-effekten körs samma commit. Recenter-KNAPPEN
    // går via recenterOnSelected direkt och påverkas inte. (suppressAutoRecenterUntilRef
    // deklareras längre upp, vid reveal-refsen.)
    const prevDaySwitchNonceRef = useRef(daySwitchNonce);
    useEffect(() => {
        if (daySwitchNonce !== prevDaySwitchNonceRef.current) {
            prevDaySwitchNonceRef.current = daySwitchNonce;
            suppressAutoRecenterUntilRef.current = performance.now() + 1500;
        }
    }, [daySwitchNonce]);

    // Intern kort-navigering (Nästa/Föregående/svep): VISA markören man bläddrar till.
    // Vi undertrycker INTE recenter längre — val-effekten nedan kör recenterOnSelected
    // som panorerar fram det valda eventets bricka SÅ man ser vilket event man är på
    // (utan att zooma; står still om brickan redan syns ovanför kortet). Vi behåller
    // bara ref-spårningen så effekten inte loopar. De avslöjade brickorna ligger KVAR
    // där man klickade — navigering flyttar bara kameran, inte avslöjnings-urvalet.
    const prevNavSelectNonceRef = useRef(navSelectNonce);
    useEffect(() => {
        if (navSelectNonce !== prevNavSelectNonceRef.current) {
            prevNavSelectNonceRef.current = navSelectNonce;
        }
    }, [navSelectNonce]);


    // 2. Hantera kamera-panorering och zoomning vid val av event.
    useEffect(() => {
        // Dagbyte just nu → rör inte kameran (vyn ska stå still).
        if (performance.now() < suppressAutoRecenterUntilRef.current) return;
        recenterOnSelected();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded]);

    // 2a. Håll den valda brickan synlig LÖPANDE — inte bara en gång vid valet.
    //     Panorerar man iväg så brickan hamnar bakom kortet (eller utanför vyn)
    //     dras den fram igen var 5:e sekund. Kollen står still om brickan redan
    //     syns (recenterOnSelected returnerar tidigt) och hoppar över pågående
    //     gest/animation så vi inte rycker kartan ur handen på användaren.
    useEffect(() => {
        if (!selectedEvent) return;
        const t = setInterval(() => {
            if (performance.now() < suppressAutoRecenterUntilRef.current) return;
            const map = mapRef.current;
            if (!map || map.isMoving()) return;
            recenterOnSelected();
        }, 5000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, cardExpanded]);

    // 2b. Zoom-knappen i Nästa-pillen: flyg till det valda eventet och zooma IN
    //     (vanliga val står still — detta är den explicita inzoomningen). Klicket i
    //     kortet byter samtidigt till nästa event, så vi landar inzoomade på det.
    //     Körs bara när triggern bumpas (inte vid varje val). Ligger EFTER val-
    //     effekten så dess flyTo vinner över ev. panorering där.
    const prevZoomToEventRef = useRef(zoomToEventTrigger);
    useEffect(() => {
        if (zoomToEventTrigger === prevZoomToEventRef.current) return;
        prevZoomToEventRef.current = zoomToEventTrigger;
        const map = mapRef.current;
        if (!map) return;
        if (!selectedEvent || !isValidLatLng(selectedEvent.lat, selectedEvent.lng)) return;
        const h = map.getContainer().clientHeight;
        const targetYRatio = cardExpanded ? 0.30 : 0.40;
        const yOffset = h * (targetYRatio - 0.5);
        // Zooma in LITE åt gången (+2 nivåer per klick) i stället för att hoppa
        // hela vägen in — klicka flera gånger för att komma närmare. Klampas vid
        // kartans maxzoom.
        map.flyTo({
            center: [selectedEvent.lng!, selectedEvent.lat!],
            zoom: Math.min(map.getMaxZoom(), map.getZoom() + 2),
            offset: [0, yOffset],
            duration: 600,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomToEventTrigger, selectedEvent, cardExpanded]);

    // 2c. Zooma-ut-knappen i Nästa-pillen: krymp kartvyn kring samma center
    //     (−2 nivåer per klick, klampad vid kartans minzoom). Spegelbild av
    //     inzoomningen ovan men utan att flyga till eventet.
    const prevZoomOutRef = useRef(zoomOutTrigger);
    useEffect(() => {
        if (zoomOutTrigger === prevZoomOutRef.current) return;
        prevZoomOutRef.current = zoomOutTrigger;
        const map = mapRef.current;
        if (!map) return;
        map.easeTo({
            zoom: Math.max(map.getMinZoom(), map.getZoom() - 2),
            duration: 600,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoomOutTrigger]);


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
            // Representant: det valda eventet i första hand. Cyklar gruppen i
            // GL-lagret just nu → spegla frame:n som VISAS (samma shownCycleEvent
            // som GL-klicket) så DOM-brickan aldrig visar ett annat event än
            // bilden gjorde. (OVALDA multi-gruppers växling sker i cykelpumpen;
            // DOM-markören här finns i praktiken bara för valda/speciella.)
            const rep = inGroupSelected
                || (count > 1 ? shownCycleEvent(cycleRotationsRef.current.get(key), cycleFrameIndexRef.current, group) : undefined)
                || nonDiscarded[0]
                || group[0];

            const isSelected = !!inGroupSelected;
            const isSaved = group.some(e => savedEventIds.has(e.id));
            const isDiscarded = group.every(e => discardedEventIds.has(e.id));

            // Något event i gruppen börjar inom 1 timme → pin-ramen blir orange,
            // så man enkelt ser vilka som är på gång nu. Samma helper som GL-
            // prickarna använder, så DOM och GL aldrig bedömer olika.
            const startsWithinHour = groupStartsWithinHour(group, Date.now());

            // Markera gruppen som "avslöjad" så fort den varit vald. Avslöjade
            // grupper visar brickan direkt även när de inte längre är valda.
            // (Guldmarkören + gissnings-brickan avslöjas också direkt — utan kö.)
            if (isSelected) revealedKeysRef.current.add(key);
            const isRevealed = revealedKeysRef.current.has(key);

            // Event VÄRDADE på VADKUL lyfts fram med en egen smaragdgrön
            // bricka (samma gröna som skapa-flödet) — de är sajtens kärna.
            // Tips (användarskapade MED länk) räknas INTE hit: de ska se ut
            // som vanliga länk-event. Gäller bara enskilda markörer; grupper
            // cyklar genom flera event och behåller därför standardutseendet.
            const isUserCreated = count === 1 && isVadkulHostedEvent(rep);

            // Boostat ("featured") event: betald framlyftning. Bara enskilda
            // markörer (grupper cyklar och behåller standardutseende). Featured är
            // alltid också userCreated, så isSpecialGroup fångar redan brickan.
            const isFeatured = count === 1 && isEventFeatured(rep);

            // Skapa en stateKey för att undvika att bygga om DOM i onödan.
            // För multi-event-grupper använder vi ett stabilt 'multi'-värde så
            // att stateKey inte ändras varje slideshow-tick (annars rivs brickan
            // ner och byggs upp igen + pop-in-animationen återstartas). Själva
            // emoji-bytet sker kirurgiskt längre ner.
            const stateKeyCategory = count > 1 ? 'multi' : (rep.category ?? 'other');
            const stateKey = `${isSelected}:${isRevealed}:${isSaved}:${isDiscarded}:${count}:${stateKeyCategory}:${startsWithinHour}:${isUserCreated}:${isFeatured}`;

            let markerData = markersRef.current.get(key);

            if (!markerData) {
                const el = document.createElement('div');
                el.className = 'v2-custom-marker';
                // Tillgänglighet: markören är klickbar → gör den nåbar med
                // tangentbord (Tab + Enter/Mellanslag) och begriplig för
                // skärmläsare. aria-label sätts/uppdateras i stateKey-blocket.
                el.setAttribute('role', 'button');
                el.tabIndex = 0;
                el.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        el.click();
                    }
                });

                // 'bottom'-anchor: nålspetsen pekar på koordinaten.
                const marker = new maplibregl.Marker({
                    element: el,
                    anchor: 'bottom',
                })
                .setLngLat([rep.lng!, rep.lat!])
                .addTo(map);

                markerData = { marker, element: el, lastStateKey: '' };
                markersRef.current.set(key, markerData);
            }

            // Uppdatera ENDAST om tillståndet faktiskt har förändrats
            if (markerData.lastStateKey !== stateKey) {
                markerData.lastStateKey = stateKey;

                const shouldHideDuringZoom = count > 1 || startsWithinHour;
                markerData.element.className = `v2-custom-marker${shouldHideDuringZoom ? ' hide-during-zoom' : ''}`;

                // Uppdatera z-index på elementet. Viktiga tillstånd ligger överst.
                // Multi-event-grupper (count > 1) prioriteras högt (900) så att deras
                // siffer-badge inte hamnar under eller blandas ihop med andra enskilda markörer.
                const zIndex = isSelected ? 1000
                    : count > 1 ? 900
                    : isFeatured ? 800
                    : isSaved ? 500
                    : isUserCreated ? 300
                    : isDiscarded ? -100 : 0;
                markerData.element.style.zIndex = String(zIndex);

                // Skärmläsar-etikett: vad är det här för markör?
                markerData.element.setAttribute('aria-label', count > 1
                    ? `${count} event vid ${rep.locationName || 'samma plats'}`
                    : rep.title);

                // Klick: multi-grupp → öppna listan; annars välj eventet direkt.
                markerData.element.onclick = (e) => {
                    e.stopPropagation();
                    if (count > 1) {
                        const map = mapRef.current;
                        if (map) {
                            if (isValidLatLng(rep.lat, rep.lng)) {
                                setGroupListAnchor({ lng: rep.lng!, lat: rep.lat! });
                                setGroupListPos(map.project([rep.lng!, rep.lat!]));
                            } else {
                                setGroupListAnchor(null);
                                setGroupListPos(null);
                            }
                        }
                        setGroupList(group);
                    }
                    // Ingen sticky (hopade en bricka per klick) — vald visas via DOM-markör.
                    onSelectEventRef.current(rep);
                };

                // "Stor" källa (PRO/Korpen/Svenska kyrkan) exkluderas från
                // kategorifärgningen → standardmörk bricka; övriga får sin kategori-
                // färg. Speciella tillstånd (vald/featured/sparad) går alltid före nedan.
                const catColorHex = brickaBodyHex(rep);

                // Nål-brickans utseende per tillstånd. Mörkgrå standardbricka med
                // mjuk gradient för djup; VADKUL-skapade event får en smaragdgrön
                // bricka (samma gröna som skapa-flödet); guld = rätt svar i spelet.
                // Prioritet: vald (blå) > guld > inom 1 timme (orange) > VADKUL-
                // skapad (grön) > sparad (ljusblå) > kategori-färg > standard (mörk).
                const pinBg = isFeatured
                    ? 'linear-gradient(145deg, #fde68a 0%, #f59e0b 52%, #b45309 100%)'
                    : isUserCreated
                    ? 'linear-gradient(145deg, #34d399 0%, #059669 55%, #047857 100%)'
                    : isSaved
                    ? 'linear-gradient(145deg, #ffffff 0%, #eef2f7 100%)'
                    : catColorHex
                    ? sourceGradientCss(catColorHex)
                    : BRICKA_DARK_BG;
                const pinBorder = isSelected
                    ? '3px solid #ffffff'
                    : isFeatured
                    ? '3px solid #fbbf24'
                    : isSaved
                    ? '2px solid #5BA3CC'
                    : startsWithinHour
                    ? '2px solid #f97316'
                    : isUserCreated
                    ? '2px solid rgba(255,255,255,0.45)'
                    : catColorHex
                    ? '2px solid rgba(255,255,255,0.55)'
                    : '2px solid rgba(255,255,255,0.25)';

                // Högpresterande CSS box-shadow. "Inom 1 timme" får en varm orange
                // gloria och VADKUL-skapade en mjuk grön — båda ska synas på avstånd.
                const pinShadow = isSelected
                    ? '0 6px 20px rgba(0,0,0,0.35), 0 2px 6px rgba(0,0,0,0.2)'
                    : isFeatured
                    ? '0 0 0 4px rgba(245,158,11,0.30), 0 6px 20px rgba(180,83,9,0.50)'
                    : startsWithinHour
                    ? '0 0 0 3px rgba(249,115,22,0.28), 0 6px 18px rgba(249,115,22,0.40)'
                    : isUserCreated
                    ? '0 0 0 3px rgba(16,185,129,0.25), 0 6px 18px rgba(5,150,105,0.45)'
                    : isSaved
                    ? '0 4px 10px rgba(0,0,0,0.2)'
                    : '0 4px 12px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.08)';

                // Vald/guld-bricka växer på plats (transform-origin: bottom center →
                // spetsen stannar på koordinaten, ingen translateY som lyfter av den).
                // Multi-event-brickan krymps till single-event-storlek: DOM-brickans
                // kropp är 44px, GL-single-brickans 40px → 40/44 ≈ 0.91. Enda kvar-
                // varande skillnaden mot en single blir då siffer-badgen.
                // Vald bricka får BARA vit kant (se pinBorder) — den ska INTE bli större
                // eller skifta plats (scale 1.2 gjorde båda). Behåll normal storlek.
                const baseScale = count > 1 ? 0.91 : 1;
                const scaleStyle = `scale(${baseScale})`;
                const opacityStyle = isDiscarded ? 'opacity: 0.25; filter: grayscale(1);' : '';

                const emoji = eventEmoji(rep);

                // Sifferbricka i hörnet för grupper; en liten prick för sparade enskilda.
                const countBadge = count > 1
                    ? `<div class="badge-count">${count > 99 ? '99+' : count}</div>`
                    : (isSaved ? '<div class="badge-saved"></div>' : '');

                // Boostat event: liten stjärn-badge i övre vänstra hörnet (undviker
                // sparad-pricken uppe till höger). Markerar betald framlyftning.
                const boostBadge = isFeatured
                    ? '<div style="position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:linear-gradient(145deg,#fde68a,#f59e0b);box-shadow:0 1px 4px rgba(180,83,9,0.6);display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;z-index:2;">⭐</div>'
                    : '';

                // Fördela uppdykandet så att alla markörer poppar in under totalt 4 sekunder (4000ms), men visa det valda direkt (0ms delay)
                const N = visibleGroups.length;
                const animDelay = isSelected ? 0 : (N > 1 ? (index / (N - 1)) * 4000 : 0);
                // Brickor som redan hunnit poppa (nyckelns pop-tid har passerat)
                // visas direkt när de kommer tillbaka i bild efter panorering —
                // de ställer sig inte i pop-in-kön igen.
                const popAt = poppedKeysRef.current.get(key);
                const alreadyPopped = popAt !== undefined && popAt <= Date.now();
                if (popAt === undefined) {
                    poppedKeysRef.current.set(key, Date.now() + Math.round(animDelay) + 450);
                }
                // Valt OCH redan avslöjat/poppat event visar brickan direkt utan kö-delay.
                const showImmediately = isSelected || isRevealed || alreadyPopped;
                const wrapperStyle = showImmediately ? 'opacity: 1 !important;' : '';
                // --pop-scale styr animationens slutvärde (se @keyframes marker-pop-in)
                // så multi-event-brickan landar på rätt storlek även efter pop-in.
                const pinAnimationStyle = showImmediately
                    ? `--pop-scale: ${baseScale}; animation: none !important; opacity: 1 !important; transform: ${scaleStyle} !important;`
                    : `--pop-scale: ${baseScale}; transform: ${scaleStyle}; animation-delay: ${Math.round(animDelay)}ms;`;

                markerData.element.innerHTML = `
                    <div class="custom-marker-wrapper" style="${opacityStyle}; ${wrapperStyle}">
                        <div class="pin-element" style="${pinAnimationStyle}">
                            <div class="pin-bubble" style="background:${pinBg}; border:${pinBorder}; box-shadow: ${pinShadow};">
                                <div class="pin-emoji">${emoji}</div>
                            </div>
                            ${countBadge}
                            ${boostBadge}
                        </div>
                    </div>
                `;
            }

            // Vald grupp med flera event: byt symbol till det event man tittar på,
            // och räkna ner siffran (kvar att bläddra till) medan man trycker
            // Nästa — kirurgiskt, utan att riva ner symbolen.
            if (inGroupSelected && count > 1) {
                const selEmoji = eventEmoji(inGroupSelected);
                const emojiEl = markerData.element.querySelector('.pin-emoji');
                if (emojiEl && emojiEl.textContent !== selEmoji) emojiEl.textContent = selEmoji;
                // Brickans kropp följer det bläddrade eventet (samma skäl som i
                // cyclern). Fast tillstånd (sparad) äger färgen och rörs ej.
                if (!isSaved) {
                    const bubble = markerData.element.querySelector('.pin-bubble') as HTMLElement | null;
                    if (bubble) bubble.style.background = brickaBodyBg(inGroupSelected);
                }

                // Siffran = count − position i bläddrings-ordningen. Nästa → index
                // ökar → siffran minskar; Bakåt → index minskar → siffran ökar.
                const idx = visitedOrderRef.current.indexOf(inGroupSelected.id);
                const remaining = Math.min(count, Math.max(1, count - (idx >= 0 ? idx : 0)));
                const remStr = remaining > 99 ? '99+' : String(remaining);
                markerData.element.querySelectorAll('.badge-count').forEach((el) => {
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
    // minuteTick håller "börjar inom 1 timme"-orangen i takt med klockan även
    // när kartan står helt stilla (stateKey ser till att DOM bara byggs om när
    // statusen faktiskt ändrats).
    }, [visibleGroups, selectedEvent, savedEventIds, discardedEventIds, minuteTick]);

    // Bakgrunden bakom kartan syns vid snabb panorering (innan tiles laddat)
    // och som "rymd" bakom klotet — matcha aktiv kartstil så det aldrig
    // blixtrar ljusgrått på mörka kartor.
    const containerBg = mapStyle === 'dark' ? '#141414'
        : mapStyle === 'satellite' ? '#10181f'
        : mapStyle === 'themepark' ? THEMEPARK_LAND_COLOR
        : mapStyle === 'orientering' ? '#efe9dc'
        : '#f1f5f9';

    return (
        <div className="absolute inset-0 z-0" style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, background: containerBg }}>
            {/* Multi-event-lista: egen komponent (V2MapGroupList). Ankras vid den
                klickade brickans övre högra hörn; groupListPos projiceras om på
                move/zoom (updateCloudPosition) så den följer kartan. */}
            {groupList && groupList.length > 0 && (
                <V2MapGroupList
                    events={groupList}
                    anchorPos={groupListPos}
                    selectedEvent={selectedEvent}
                    onSelect={onSelectEvent}
                    onClose={() => { setGroupList(null); setGroupListAnchor(null); }}
                />
            )}
            {/* Diskret "laddar fortfarande"-pill i TVÅ faser: (1) aggregat-lagren
                strömmar ännu ("Laddar fler event…"), (2) allt är hämtat men GL-
                symbolerna har inte målats klart än ("Ritar ut eventen…") — utan
                fas 2 släcktes pillen vid hämtat-klart och kartan stod tom tills
                tiling/rendering hunnit ikapp. symbolsPainted är latchen som
                släcker för gott. Under navbar+kategorichips; pointer-events-none
                så den aldrig blockerar kartan. */}
            {eventsLoaded && (!eventsSettled || !symbolsPainted) && (
                <div className="absolute top-[120px] left-1/2 -translate-x-1/2 z-[900] pointer-events-none">
                    <div role="status" className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full shadow-lg border border-white/50 dark:border-slate-700 px-4 py-2 flex items-center gap-2 animate-in fade-in duration-300">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-[#006AA7] border-t-transparent animate-spin shrink-0" aria-hidden />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">{eventsSettled ? 'Ritar ut eventen…' : 'Laddar fler event…'}</p>
                    </div>
                </div>
            )}
            {/* CSS och Keyframes för en mjuk, progressiv animation */}
            <style>{`
                .v2-custom-marker {
                    background: none !important;
                    border: none !important;
                    cursor: pointer;
                    width: 44px;
                    height: 52px;
                }
                /* Tangentbordsfokus ska synas tydligt (markören saknar kant/
                   bakgrund så webbläsarens default-ring försvinner lätt). */
                .v2-custom-marker:focus-visible {
                    outline: 3px solid #006AA7;
                    outline-offset: 2px;
                    border-radius: 10px;
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
                        /* --pop-scale (default 1) sätts per markör så multi-event-
                           brickan kan landa på samma storlek som single-event (annars
                           skulle animationens slutvärde tvinga tillbaka scale(1)). */
                        transform: scale(var(--pop-scale, 1)) translateY(0);
                    }
                }

                .custom-marker-wrapper {
                    position: relative;
                    width: 44px;
                    height: 52px;
                }
                .pin-element {
                    position: absolute;
                    transform-origin: bottom center;
                    top: 0;
                    left: 0;
                    width: 44px;
                    height: 52px;
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
                    transition: transform 0.18s ease, filter 0.18s ease;
                }
                /* Glansig topp-highlight ger brickan en kupad känsla — ligger
                   under emojin (.pin-emoji har z-index 1) och följer bubblans
                   rundning via border-radius: inherit. */
                .pin-bubble::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    background: radial-gradient(circle at 30% 28%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 48%);
                    pointer-events: none;
                }
                .pin-emoji {
                    transform: rotate(-45deg);
                    font-size: 22px;
                    line-height: 1;
                    position: relative;
                    z-index: 1;
                    /* text-shadow i stället för drop-shadow-filter: samma djup men
                       en vanlig paint i stället för ett eget kompositlager per
                       markör — märkbart billigare med hundratals markörer. */
                    text-shadow: 0 1px 1.5px rgba(0,0,0,0.25);
                }
                /* Hover-lyft på enheter med riktig pekare (inte touch, annars
                   fastnar hover-läget efter tryck). Vattnings-pulsen är en
                   animation och vinner över hover-transformen — ingen krock. */
                @media (hover: hover) and (pointer: fine) {
                    .v2-custom-marker:hover .pin-bubble {
                        transform: rotate(45deg) scale(1.07);
                        filter: brightness(1.05);
                    }
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
                    font-variant-numeric: tabular-nums;
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
                /* ── Kontrast per kartstil ──────────────────────────────────
                   Mörka kartan: hårfin ljus gloria + djupare skugga så mörka
                   brickor inte smälter in i den nästan svarta bakgrunden.
                   (Klassen sätts på kartcontainern i mapStyle-effekten.) */
                .map-style-dark .pin-element {
                    filter: drop-shadow(0 0 1.5px rgba(255,255,255,0.45)) drop-shadow(0 5px 12px rgba(0,0,0,0.8));
                }

                /* ──────────────────────────────────────────────────────────
                   TILLSTÅNDS-KLASSER (Styrs av containerklassen)
                ────────────────────────────────────────────────────────── */

                /* 1. Zoom-läge: GL-massan fälls till billiga prickar. DOM-brickorna
                   är få (bara speciella event) och saknar separat nål, så de står
                   kvar som brickor även under zoom — utan att poppa in på nytt. */
                .map-state-needle .v2-custom-marker .pin-element {
                    display: block;
                }
                .map-state-needle .v2-custom-marker.hide-during-zoom {
                    display: none !important;
                }

                /* 2. Brick-läge (kartan står still): brickan poppar in. */
                .map-state-full .v2-custom-marker .pin-element {
                    display: block;
                    animation: marker-pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                }

            `}</style>
            <div ref={mapContainerRef} className="absolute inset-0 map-state-full" style={{ width: '100%', height: '100%' }} />

            {/* Fallback om WebGL inte gick att initiera (t.ex. blockerad efter en
                tidigare kontextförlust) — sidan kraschar inte, man kan ladda om. */}
            {mapError && (
                <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-slate-100 p-6 text-center">
                    <div className="max-w-sm">
                        <p className="text-base font-semibold text-slate-800">Kartan kunde inte laddas</p>
                        <p className="mt-1 text-sm text-slate-600">
                            Webbläsarens grafik (WebGL) är otillgänglig just nu. Ladda om sidan för att försöka igen.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 rounded-full bg-[#006AA7] px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-[#005590] transition-colors"
                        >
                            Ladda om
                        </button>
                    </div>
                </div>
            )}
            {/* Funktions-"väskan" (under profilen, uppe till vänster): lager-ikonen
                fäller NER en bricka (crate) med funktioner man kan testa & köpa —
                som Worms-vapen fast funktioner. Spelet "Hitta event" ligger med här
                (inte i root) så allt är ett "filsystem" för användaren. Brickan
                renderas via portal till <body> så den garanterat ligger ÖVER allt
                annat (V2Map-roten är z-0). */}
            {(() => {
                type CrateItem = { key: string; label: string; desc: string; color: string; icon: React.ReactNode; locked?: boolean };
                const crateItems: CrateItem[] = [
                    // Popup-meny: symbol + namn + kort info. Varje funktion har en egen
                    // passande accent-färg på symbolen; aktiv rad tonas i samma färg.
                    // Upplåst överst: Satellit, Skapa event + kartstilarna Nöjesfält,
                    // Orientering & 3D-terräng. Resten är låsta.
                    { key: 'satellite', label: 'Satellit', desc: 'Byt mellan satellit- och vanlig karta', color: '#0d9488', icon: <Satellite size={20} /> },
                    { key: 'createEvent', label: 'Skapa event', desc: 'Skapa egna event på kartan', color: '#22c55e', icon: <Plus size={20} strokeWidth={2.5} /> },
                    { key: 'themepark', label: 'Nöjesfält', desc: 'Naturfärgad karta — som satellit fast minimalistisk', color: '#db2777', icon: <Sparkles size={20} /> },
                    { key: 'orientering', label: 'Orientering', desc: 'Topografisk karta som visar höjdskillnaderna i terrängen', color: '#a16207', icon: <Mountain size={20} /> },
                    { key: 'terrain', label: '3D-terräng', desc: 'Visa höjder & terräng i 3D', color: '#16a34a', icon: <Mountain size={20} /> },
                    // ── Låsta funktioner ────────────────────────────────────────
                    { key: 'dark', label: 'Mörkt läge', desc: 'Mörk karta — skön i mörker', color: '#475569', icon: <Moon size={20} />, locked: true },
                    { key: 'globe', label: 'Klot', desc: 'Visa kartan som en jordglob', color: '#0891b2', icon: <Globe size={20} />, locked: true },
                    { key: 'countries', label: 'Länder', desc: 'Visa länder på kartan', color: '#0284c7', icon: <MapIcon size={20} />, locked: true },
                    { key: 'golf', label: 'Golf', desc: 'Kommer snart', color: '#65a30d', icon: <Flag size={20} />, locked: true },
                    { key: 'multiplayer', label: 'Multiplayer', desc: 'Spela med andra (kräver konto)', color: '#6366f1', icon: <Users size={20} />, locked: true },
                    { key: 'record', label: 'Spela in', desc: 'Spela in din skärm', color: '#ef4444', icon: <Video size={20} />, locked: true }
                ];
                const isCrateActive = (it: CrateItem) => isFeatureActive(it.key);
                const activeBagCount = crateItems.reduce((n, it) => n + (isCrateActive(it) ? 1 : 0), 0);

                const handleCrate = (it: CrateItem) => toggleFeature(it.key);

                return typeof document === 'undefined' ? null : createPortal(
                    <>
                        {/* Funktions-popup: liten meny-panel under lager-knappen. Varje rad =
                            symbol (i sin egen färg) + namn + kort info. Klick slår på/av;
                            aktiv rad tonas i funktionens färg + "PÅ"-bricka. Scrollbar om lång. */}
                        {funcBagOpen && (
                            <div
                                ref={funcBagPanelRef}
                                onClick={(e) => e.stopPropagation()}
                                className="fixed top-[118px] left-3 z-[1150] w-[270px] max-h-[68vh] overflow-y-auto no-scrollbar rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-white/60 p-1.5 pointer-events-auto animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200"
                            >
                                <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Funktioner
                                </div>
                                {crateItems.map((it) => {
                                    const active = isCrateActive(it);
                                    // Låst funktion (Golf) → går inte att aktivera (visas med hänglås).
                                    const locked = !!it.locked;
                                    const disabled = locked;
                                    return (
                                        <button
                                            key={it.key}
                                            type="button"
                                            onClick={disabled ? undefined : () => handleCrate(it)}
                                            disabled={disabled}
                                            className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-xl text-left transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : active ? '' : 'hover:bg-slate-100 active:bg-slate-200'}`}
                                            style={active ? { background: `${it.color}14` } : undefined}
                                        >
                                            {/* Symbol-bricka — neutral/blek bakgrund, symbolen i sin egen
                                                passande färg. Aktiv: bakgrund + ring i samma färg. */}
                                            <span
                                                className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
                                                style={{
                                                    background: active ? `${it.color}24` : '#f8fafc',
                                                    border: `1px solid ${active ? it.color : '#e2e8f0'}`,
                                                    boxShadow: active ? `0 0 0 3px ${it.color}1f` : 'none',
                                                    color: it.color
                                                }}
                                            >
                                                {it.icon}
                                            </span>
                                            {/* Namn + kort info-text */}
                                            <span className="flex-1 min-w-0">
                                                {/* Grå text = ej öppnad/aktiverad än; svart = aktiverad (upplåst men inte testad).
                                                    Låsta rader behåller mörk text (hela raden tonas via opacity-40). */}
                                                <span className={`block text-sm font-bold leading-tight ${!locked && !active ? 'text-slate-400' : 'text-slate-800'}`}>{it.label}</span>
                                                <span className="block text-[11px] text-slate-500 leading-tight truncate">{it.desc}</span>
                                            </span>
                                            {/* Indikator: LÅST (hänglås) för låsta funktioner,
                                                annars PÅ i funktionens egen färg när aktiv. */}
                                            {locked ? (
                                                <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide bg-slate-200 text-slate-500">
                                                    <Lock size={9} strokeWidth={3} /> LÅST
                                                </span>
                                            ) : active && (
                                                <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide" style={{ background: `${it.color}24`, color: it.color }}>PÅ</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Lager-knappen (Funktioner) — vänsterkolumnen under profilen
                            (top-[72px] left-4). Klick öppnar/stänger funktions-popupen. */}
                        {/* HIDDEN per Josef 2026-06-23 - test layout without these. Functions still wired. */}
                        {false && (
                        <div className="fixed top-[72px] left-4 z-[1151] pointer-events-auto">
                            <button
                                ref={funcBagBtnRef}
                                type="button"
                                onClick={() => setFuncBagOpen(o => !o)}
                                aria-label="Funktioner"
                                title="Funktioner"
                                aria-expanded={funcBagOpen}
                                className={`relative h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors ${
                                    funcBagOpen ? 'bg-[#006AA7] text-white border-white/30' : 'bg-white/90 text-slate-700 border-white/50 hover:bg-white'
                                }`}
                            >
                                <Tags size={20} />
                                {activeBagCount > 0 && !funcBagOpen && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#006AA7] text-white text-[10px] font-black flex items-center justify-center border border-white">
                                        {activeBagCount}
                                    </span>
                                )}
                            </button>
                        </div>
                        )}

                        {/* Fokus — direkt UNDER funktions-knappen (vänsterkolumnen,
                            top-[72px] + 40px + 8px = top-[120px]). Centrerar kartan på
                            det valda eventet, annars passas alla dagens event in i vyn.
                            Göms när väskan är öppen (panelen täcker annars knappen). */}
                        {/* HIDDEN per Josef 2026-06-23 - test layout without these. Functions still wired. */}
                        {false && !funcBagOpen && (
                            <div className="fixed top-[120px] left-4 z-[1151] pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handleFocusClick}
                                    aria-label="Fokus"
                                    title="Centrera kartan"
                                    className="h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors bg-white/90 text-slate-700 border-white/50 hover:bg-white"
                                >
                                    <Target size={20} />
                                </button>
                            </div>
                        )}

                        {/* Min plats — under Fokus i vänsterkolumnen (120 + 40 + 8 = 168).
                            Flyger till användarens position och visar en pulserande blå punkt. */}
                        {/* HIDDEN per Josef 2026-06-23 - test layout without these. Functions still wired. */}
                        {false && !funcBagOpen && (
                            <div className="fixed top-[168px] left-4 z-[1151] pointer-events-auto">
                                <button
                                    type="button"
                                    onClick={handleLocateMe}
                                    aria-label="Min plats"
                                    title="Visa min plats på kartan"
                                    disabled={locating}
                                    className={`h-10 w-10 rounded-full shadow-lg border backdrop-blur-md flex items-center justify-center transition-colors ${
                                        userPos ? 'bg-[#006AA7] text-white border-white/30' : 'bg-white/90 text-slate-700 border-white/50 hover:bg-white'
                                    } ${locating ? 'opacity-60' : ''}`}
                                >
                                    <Crosshair size={20} className={locating ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        )}
                    </>,
                    document.body
                );
            })()}
        </div>
    );
}
