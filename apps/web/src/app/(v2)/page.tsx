'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinkEvent } from '@/types';
import { linkEventService } from '@/services/linkEventService';
import FloatingNavbar from '@/components/v2/FloatingNavbar';
import CategoryFilter from '@/components/v2/CategoryFilter';
import AuthModal from '@/components/v2/AuthModal';
import EventCard from '@/components/v2/EventCard';
import SearchResults from '@/components/v2/SearchResults';
import SavedPanel from '@/components/v2/SavedPanel';
import WelcomeOverlay from '@/components/v2/WelcomeOverlay';
import { userService } from '@/services/userService';
import { Target, Trophy, X, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { EVENT_CATEGORIES, EventCategoryType } from '@/utils/categories';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// V2Map är klient-only (maplibre-gl kräver window), därför dynamisk import med ssr:false.
import dynamic from 'next/dynamic';

const V2MapDynamic = dynamic(() => import('@/components/v2/V2Map'), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">Laddar karta...</div>
});

// Haversine-avstånd i km mellan två punkter
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
};

const hasValidCoords = (evt: LinkEvent) =>
    typeof evt.lat === 'number' && typeof evt.lng === 'number' &&
    !(evt.lat === 0 && evt.lng === 0);

// Avstånd för spelets "så nära var du"-feedback: meter under 1 km, annars km.
const formatGuessDistance = (km: number): string => {
    if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
};

/**
 * Vid dagbyte: välj eventet som ligger närmast en geo-PUNKT (kartans mitt — det
 * man tittar på just nu) i stället för det tidigare eventet. Då slipper man flyga
 * iväg till en annan stad bara för att den nya dagen råkar ha sitt närmaste event
 * (relativt det gamla) någon annanstans. Faller tillbaka till första event om
 * punkten saknas eller inget event för dagen har koords.
 */
const pickNearestToPoint = (point: { lat: number; lng: number } | null, dayEvents: LinkEvent[]): LinkEvent | null => {
    if (dayEvents.length === 0) return null;
    if (!point) return dayEvents[0];

    let nearest: LinkEvent | null = null;
    let nearestDist = Infinity;
    for (const evt of dayEvents) {
        if (!hasValidCoords(evt)) continue;
        const d = haversineKm(point.lat, point.lng, evt.lat, evt.lng);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = evt;
        }
    }
    return nearest ?? dayEvents[0];
};

export default function HomePage() {
    const [events, setEvents] = useState<LinkEvent[]>([]);
    // True så fort första Firestore-svaret kommit in. Molnet (som visar
    // "X unika event idag") väntar på detta så det inte hinner poppa fram med 0
    // event innan databasen svarat.
    const [eventsLoaded, setEventsLoaded] = useState(false);
    const [filteredEvents, setFilteredEvents] = useState<LinkEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<LinkEvent | null>(null);
    const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
    const [discardedEventIds, setDiscardedEventIds] = useState<Set<string>>(new Set());
    const [dayOffset, setDayOffset] = useState(0);
    // Antal dagar i det visade intervallet: 1 = en dag (default), 3 = fre–sön osv.
    const [dayRangeDays, setDayRangeDays] = useState(1);
    const [cardExpanded, setCardExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Panel med sparade event (hjärtknappen i navbaren).
    const [savedPanelOpen, setSavedPanelOpen] = useState(false);
    // Kategorifilter (flerval). Tom set = visa alla kategorier.
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    // "offset:days"-nyckel för att skilja dag-/intervallbyten från eventuppdateringar.
    const prevDayKey = useRef(`${dayOffset}:${dayRangeDays}`);
    // Bumpas vid dagbyte → V2Map låter bli att flytta kameran till det nyvalda eventet.
    const [daySwitchNonce, setDaySwitchNonce] = useState(0);
    // Create-event-flöde: 'idle' = inget pågår, 'placing' = center-pinne synlig på kartan,
    // 'editing' = modal öppen med formulär. (Drop-animationen körs internt i FloatingNavbar.)
    const [creationMode, setCreationMode] = useState<'idle' | 'placing' | 'editing'>('idle');
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const mapCenterRef = useRef(mapCenter);
    mapCenterRef.current = mapCenter;
    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('');           // datetime-local-sträng
    const [newEventCategory, setNewEventCategory] = useState<EventCategoryType>('other');
    const [creatingEvent, setCreatingEvent] = useState(false);

    // Inloggning i modal — man lämnar aldrig kartan. reason visas i modalen.
    const { user } = useAuth();
    const [authModal, setAuthModal] = useState<{ open: boolean; reason?: string }>({ open: false });
    const openLogin = useCallback((reason?: string) => setAuthModal({ open: true, reason }), []);

    // Sun-button effect: brightness flash on the map, followed by a fresh cloud
    // popping up in the middle of the screen. Each click bumps a key so the
    // flash overlay (and the resulting cloud) remount cleanly.
    const [sunFlashKey, setSunFlashKey] = useState(0);
    const [sunCloudKey, setSunCloudKey] = useState(0);
    // Solknappen vinklar också kameran till en sidovy (3D-perspektiv). Ett
    // nytt sol-klick lutar ALLTID (behåller lutningen om den redan lutar) —
    // det fäller aldrig tillbaka till platt vy. Avlutning sker via tryck på
    // sol-molnet (handleSunCloudTap) eller tilt-knappen (handleToggleTilt).
    const [mapTilted, setMapTilted] = useState(false);
    // True när funktions-väskan (uppe till vänster i V2Map) är utfälld — då gömmer
    // vi spel-knapparna (poäng + Hitta event) som delar vänsterkolumn.
    const [funcBagOpen, setFuncBagOpen] = useState(false);
    const handleSunClick = useCallback(() => {
        // Flash and cloud both fire simultaneously — cloud appears at the same
        // instant the screen pops white, then the light fades over the cloud.
        setSunFlashKey(k => k + 1);
        setSunCloudKey(k => k + 1);
        // Luta alltid in 3D-vyn — om kameran redan lutar stannar den kvar lutad
        // (inget tillbaka-fällande till platt vy när man skapar ett nytt moln).
        setMapTilted(true);
    }, []);
    // Tryck på sol-molnet → fäll tillbaka kartans lutning till platt vy.
    const handleSunCloudTap = useCallback(() => setMapTilted(false), []);
    // Tilt-knappen (under satellit-knappen) togglar lutningen snabbt.
    const handleToggleTilt = useCallback(() => setMapTilted(t => !t), []);

    // Återkallningssystem för molnen: V2Map rapporterar off-screen, sidan
    // visar en knapp jämte solen som triggar en räknare → V2Map snäpper
    // molnet tillbaka in i bild.
    const [cloudOffScreen, setCloudOffScreen] = useState<{ main: boolean; sun: boolean }>({ main: false, sun: false });
    // True så fort molnet hämtats tillbaka via molnsymbolen minst en gång. Innan
    // dess (efter första stängningen) blinkar molnsymbol-knappen som ett tips.
    const [mainRecalled, setMainRecalled] = useState(false);
    // Onboarding: när true ska Fokus/recenter-knappen på event-kortet blinka (ny funktion).
    const [focusToolBlink, setFocusToolBlink] = useState(false);
    const [recallMainTrigger, setRecallMainTrigger] = useState(0);
    const [recallSunTrigger, setRecallSunTrigger] = useState(0);
    const handleRecallMain = useCallback(() => setRecallMainTrigger(t => t + 1), []);
    const handleRecallSun = useCallback(() => setRecallSunTrigger(t => t + 1), []);

    // Recenter: kortets recenter-knapp bumpar en räknare → V2Map flyger kameran
    // tillbaka till det valda eventet (vi går dit, eventet teleporteras inte hit).
    const [recenterTrigger, setRecenterTrigger] = useState(0);

    // Shop-flaggor från V2Map. När användaren avaktiverar "Sol" eller "Fokus" i
    // funktioner-shoppen försvinner respektive knapp ur EventCard (vi skickar
    // helt enkelt inte ner callbacken — kortet renderar inte knappen utan den).
    // createEvent styr om +-knappen i navbaren renderas; multiplayer används som
    // gate för delade event m.m. (bara visning av status tills vidare).
    const [shopFlags, setShopFlags] = useState<{ sun: boolean; focus: boolean; createEvent: boolean; multiplayer: boolean }>({
        sun: true, focus: true, createEvent: true, multiplayer: false
    });
    const handleFeatureFlagsChange = useCallback((flags: { sun: boolean; focus: boolean; createEvent: boolean; multiplayer: boolean }) => {
        setShopFlags(prev =>
            prev.sun === flags.sun && prev.focus === flags.focus && prev.createEvent === flags.createEvent && prev.multiplayer === flags.multiplayer
                ? prev : flags
        );
    }, []);
    // Multiplayer aktiveras via en kontoregistrering. Tills vidare routar vi
    // bara till inloggnings-sidan — när användaren kommer tillbaka kan de manuellt
    // toggla på multiplayer-badgen i shoppen.
    const router = useRouter();
    const handleActivateMultiplayer = useCallback(() => {
        router.push('/login');
    }, [router]);

    // Slangbella: aktiv när båda molnen ligger på varandra → fokusknappen fylls vit.
    // "Engaged" sätts av fokusklicket när slangbellan är ready: då visas
    // gummibanden alltid och nästa release av ett moln blir en slangbella-snärt.
    // Auto-avarmar när snärten är klar (eller om molnen separeras igen).
    const [slingshotActive, setSlingshotActive] = useState(false);
    const [slingshotEngaged, setSlingshotEngaged] = useState(false);
    const handleRecenter = useCallback(() => {
        if (slingshotEngaged) {
            // Klick medan armad → avbryt utan att avfyra. Avfyrning sker när man
            // släpper ett moln efter att ha dragit isär dem.
            setSlingshotEngaged(false);
        } else if (slingshotActive) {
            // Första klicket när banden är "ready" → arma + visa band.
            setSlingshotEngaged(true);
        } else {
            // Vanligt recenter när slangbellan inte är aktiv.
            setRecenterTrigger(t => t + 1);
        }
    }, [slingshotActive, slingshotEngaged]);
    // Notera: engaged-läget får INTE auto-avarmas när molnen separeras — det är
    // ju själva poängen att dra isär dem under armning. Disarming sker antingen
    // genom klick på den armade knappen, eller automatiskt när V2Map avfyrar.

    // "Hitta eventet"-spelets tillstånd (logiken längre ner — efter
    // searchFilteredEvents). gameActive = runda pågår (gissningsläge).
    const [gameActive, setGameActive] = useState(false);
    const [gameScore, setGameScore] = useState(0);
    const [gameResult, setGameResult] = useState<'correct' | 'wrong' | null>(null);
    const [goldEventId, setGoldEventId] = useState<string | null>(null); // rätt svar (guldmarkör)
    const [gameDistanceKm, setGameDistanceKm] = useState<number | null>(null); // hur långt fel-gissningen låg
    // Streck mellan gissningen och rätt svar. När satt zoomar kartan ut så båda
    // punkterna syns, och V2Map ritar en linje + avståndsetikett mellan dem.
    const [guessLine, setGuessLine] = useState<{ from: { lat: number; lng: number }; to: { lat: number; lng: number }; label: string } | null>(null);
    // Event-id för markören man gissade på — hålls synlig (brickan) efter avslöjet.
    const [guessedEventId, setGuessedEventId] = useState<string | null>(null);

    // Real-time Firestore listener — uppdaterar kartan direkt när scraper hittar events
    useEffect(() => {
        const unsubscribe = linkEventService.subscribeToAll(true, (fetched) => {
            const sorted = fetched.sort((a, b) => a.time.getTime() - b.time.getTime());
            setEvents(sorted);
            setEventsLoaded(true);
        });
        return () => unsubscribe();
    }, []);

    // Filtrera events för vald dag ELLER valt intervall (t.ex. helgen = fre–sön).
    useEffect(() => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setDate(endOfDay.getDate() + (dayRangeDays - 1));
        endOfDay.setHours(23, 59, 59, 999);

        const filtered = events.filter(evt => {
            return evt.time >= startOfDay && evt.time <= endOfDay;
        });

        setFilteredEvents(filtered);
        // När dagen/intervallet byts: välj eventet närmast KARTANS MITT (det man
        // tittar på) och be V2Map att INTE flytta kameran — vi vill stanna kvar i
        // vyn i stället för att flyga iväg till en annan stad. (Bara vid byte,
        // inte vid varje Firestore-uppdatering.)
        const dayKey = `${dayOffset}:${dayRangeDays}`;
        if (prevDayKey.current !== dayKey) {
            setSelectedEvent(pickNearestToPoint(mapCenterRef.current, filtered));
            prevDayKey.current = dayKey;
            setDaySwitchNonce(n => n + 1);
        }
    }, [events, dayOffset, dayRangeDays]);

    // Stäng av scroll på body så kartan tar över helt
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

    // Sparade/avfärdade event överlever omladdning (localStorage).
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('vadkul_saved_events') ?? '[]');
            const discarded = JSON.parse(localStorage.getItem('vadkul_discarded_events') ?? '[]');
            if (Array.isArray(saved) && saved.length) setSavedEventIds(new Set(saved));
            if (Array.isArray(discarded) && discarded.length) setDiscardedEventIds(new Set(discarded));
        } catch { /* korrupt localStorage — börja om tomt */ }
    }, []);
    useEffect(() => {
        localStorage.setItem('vadkul_saved_events', JSON.stringify([...savedEventIds]));
    }, [savedEventIds]);
    useEffect(() => {
        localStorage.setItem('vadkul_discarded_events', JSON.stringify([...discardedEventIds]));
    }, [discardedEventIds]);

    // Inloggad: sparade event synkas till users/{uid} så de följer med mellan
    // enheter. Vid inloggning slås Firestore-listan ihop med den lokala (union)
    // — därefter speglas varje ändring dit, debouncad. Utloggad: bara localStorage.
    const savedSyncReady = useRef(false);
    const savedRef = useRef(savedEventIds);
    savedRef.current = savedEventIds;
    useEffect(() => {
        savedSyncReady.current = false;
        if (!user) return;
        let cancelled = false;
        (async () => {
            const remote = await userService.getSavedEventIds(user.uid);
            if (cancelled) return;
            const merged = new Set([...savedRef.current, ...remote]);
            savedSyncReady.current = true;
            // Alltid nytt Set → skriv-effekten nedan speglar unionen till Firestore.
            setSavedEventIds(merged);
        })();
        return () => { cancelled = true; };
    }, [user]);
    useEffect(() => {
        if (!user || !savedSyncReady.current) return;
        const t = setTimeout(() => {
            userService.setSavedEventIds(user.uid, [...savedEventIds]).catch(err =>
                console.warn('Kunde inte synka sparade event:', err));
        }, 800);
        return () => clearTimeout(t);
    }, [savedEventIds, user]);

    // Skapa event på riktigt: kräver konto, skrivs till Firestore (reglerna
    // begränsar formen) och dyker upp direkt på kartan via optimistisk insättning
    // (pollen plockar sedan upp samma event från Firestore inom 30 s).
    const handleCreateEvent = useCallback(async () => {
        if (!pickedLocation || !newEventTitle.trim() || !newEventTime) return;
        if (!user) { openLogin('Logga in för att skapa event'); return; }
        setCreatingEvent(true);
        try {
            const time = new Date(newEventTime);
            const docId = await linkEventService.createUserEvent({
                title: newEventTitle,
                time,
                lat: pickedLocation.lat,
                lng: pickedLocation.lng,
                category: newEventCategory,
                hostName: user.displayName || user.email || 'VADKUL-användare',
                hostUid: user.uid,
            });
            const created: LinkEvent = {
                id: docId, url: '', title: newEventTitle.trim(), time, createdAt: new Date(),
                locationName: '', lat: pickedLocation.lat, lng: pickedLocation.lng,
                hostName: user.displayName || user.email || 'VADKUL-användare',
                category: newEventCategory, coverImage: '', description: '', attendees: 0,
                isLocationVerified: true,
            } as LinkEvent;
            setEvents(prev => [...prev, created].sort((a, b) => a.time.getTime() - b.time.getTime()));
            setSelectedEvent(created);
            toast.success('Eventet är skapat och syns på kartan! 🎉');
            setCreationMode('idle');
            setPickedLocation(null);
            setNewEventTitle('');
            setNewEventTime('');
            setNewEventCategory('other');
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte skapa eventet. Försök igen.');
        } finally {
            setCreatingEvent(false);
        }
    }, [pickedLocation, newEventTitle, newEventTime, newEventCategory, user, openLogin]);

    const handleSaveEvent = (eventId: string) => {
        setSavedEventIds(prev => {
            const next = new Set(prev);
            next.add(eventId);
            return next;
        });
        // Remove from discarded if it was there
        setDiscardedEventIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
        });
    };

    // Sökfiltrering — söker över ALLA dagar (inte bara den valda): man ska kunna
    // hitta "Håkan Hellström" även om konserten är om tre veckor. Matchar titel,
    // plats, arrangör (hostName) samt eventets URL/källa, så att en sökning på
    // t.ex. "tickster" får fram alla event från den plattformen (domänen ligger
    // i url). Utan sökterm gäller dag-/intervallfiltret som vanligt.
    const searchFilteredEvents = useMemo(() => {
        if (!searchQuery.trim()) return filteredEvents;
        const q = searchQuery.toLowerCase();
        return events.filter(evt =>
            evt.title.toLowerCase().includes(q) ||
            (evt.locationName?.toLowerCase().includes(q) ?? false) ||
            (evt.hostName?.toLowerCase().includes(q) ?? false) ||
            (evt.url?.toLowerCase().includes(q) ?? false)
        );
    }, [events, filteredEvents, searchQuery]);

    // Kategorifiltret appliceras sist i kedjan: dag → sök → kategori.
    const visibleEvents = useMemo(() => {
        if (selectedCategories.size === 0) return searchFilteredEvents;
        return searchFilteredEvents.filter(evt =>
            selectedCategories.has(evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other')
        );
    }, [searchFilteredEvents, selectedCategories]);

    const handleToggleCategory = useCallback((id: string) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);
    const handleClearCategories = useCallback(() => setSelectedCategories(new Set()), []);

    // Byt visad dag/intervall — från dagväljaren eller återställningsknappen.
    const handleDayRangeChange = useCallback((offset: number, days: number) => {
        setDayOffset(offset);
        setDayRangeDays(days);
    }, []);

    // Sök och sparat-panelen delar plats under navbaren — bara en i taget.
    useEffect(() => {
        if (searchQuery.trim()) setSavedPanelOpen(false);
    }, [searchQuery]);
    const handleToggleSaved = useCallback(() => {
        setSavedPanelOpen(o => !o);
        setSearchQuery('');
    }, []);

    // Hoppa till ett specifikt event (från sökträff eller sparat-listan): byt
    // till eventets dag, välj det (kameran flyger dit) och stäng panelen.
    // prevDayKey markeras som hanterad så dagbytes-heuristiken inte byter bort
    // vårt val mot närmaste-event-logiken.
    const jumpToEvent = useCallback((evt: LinkEvent) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const offset = Math.floor((evt.time.getTime() - startOfToday.getTime()) / 86_400_000);
        prevDayKey.current = `${offset}:1`;
        setDayOffset(offset);
        setDayRangeDays(1);
        setSelectedEvent(evt);
        setSearchQuery('');
        setSavedPanelOpen(false);
    }, []);

    // Ta bort från sparade (hjärtat på kortet eller krysset i sparat-listan).
    const handleUnsaveEvent = useCallback((eventId: string) => {
        setSavedEventIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
        });
    }, []);

    // ── Delbara länkar: ?event=<id>&dag=<n>&kategori=<a,b> ──────────────────
    // Läses EN gång när eventlistan först landat; därefter speglas valt event/
    // dag/kategorier till URL:en med replaceState (ingen history-spam, ingen
    // Next-navigation). Att dela länken återskapar exakt vy.
    const urlApplied = useRef(false);
    useEffect(() => {
        if (!eventsLoaded || urlApplied.current) return;
        urlApplied.current = true;

        const params = new URLSearchParams(window.location.search);
        const kategori = params.get('kategori');
        if (kategori) {
            const valid = kategori.split(',').filter(k => k in EVENT_CATEGORIES);
            if (valid.length) setSelectedCategories(new Set(valid));
        }
        const dag = parseInt(params.get('dag') ?? '', 10);
        const dagar = parseInt(params.get('dagar') ?? '', 10);
        const eventId = params.get('event');
        const target = eventId ? events.find(e => e.id === eventId) : undefined;
        if (target) {
            // Härled eventets dag så dagfiltret inte gömmer det — och markera
            // dagbytet som "redan hanterat" så day-switch-effekten inte byter
            // bort vårt deep-linkade val mot närmaste-event-heuristiken.
            const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
            const offset = Math.floor((target.time.getTime() - startOfToday.getTime()) / 86_400_000);
            prevDayKey.current = `${offset}:1`;
            setDayOffset(offset);
            setSelectedEvent(target);
        } else if (!Number.isNaN(dag)) {
            setDayOffset(dag);
            if (!Number.isNaN(dagar) && dagar > 1) setDayRangeDays(Math.min(dagar, 31));
        }
    }, [eventsLoaded, events]);

    useEffect(() => {
        if (!urlApplied.current) return;   // skriv inte förrän ev. inkommande länk applicerats
        const params = new URLSearchParams();
        if (selectedEvent) params.set('event', selectedEvent.id);
        if (dayOffset !== 0) params.set('dag', String(dayOffset));
        if (dayRangeDays > 1) params.set('dagar', String(dayRangeDays));
        if (selectedCategories.size > 0) params.set('kategori', [...selectedCategories].join(','));
        const qs = params.toString();
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }, [selectedEvent, dayOffset, dayRangeDays, selectedCategories]);

    // Statistik som visas i molnet: dagens, veckans, och hur många som börjar
    // inom 1 timme. Räknas alltid från hela event-listan, oberoende av dayOffset
    // och söktermen. nowTick uppdateras varje minut så "börjar inom 1 timme" rör
    // sig i takt med klockan.
    const [nowTick, setNowTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setNowTick(t => t + 1), 60_000);
        return () => clearInterval(id);
    }, []);
    const cloudStats = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
        const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfTomorrow = new Date(endOfToday.getTime() + 24 * 60 * 60 * 1000);
        const endOfWeek = new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000);
        const HOUR = 60 * 60 * 1000;
        let today = 0, week = 0, tomorrow = 0;
        const futureMs: number[] = [];
        for (const evt of events) {
            if (!evt.time) continue;
            const t = evt.time.getTime();
            if (t >= startOfToday.getTime() && t <= endOfToday.getTime()) today++;
            if (t >= startOfTomorrow.getTime() && t <= endOfTomorrow.getTime()) tomorrow++;
            if (t >= startOfToday.getTime() && t < endOfWeek.getTime()) week++;
            if (t > now.getTime()) futureMs.push(t - now.getTime());
        }
        // Adaptivt tidsfönster: börja på 1 timme och vidga (i hela timmar) tills
        // minst 1 event ryms — annars hade det ofta stått "0 börjar inom 1 timme".
        let withinHours = 1;
        let withinHour = futureMs.filter(ms => ms <= HOUR).length;
        if (withinHour === 0 && futureMs.length > 0) {
            const nearestMs = futureMs.reduce((m, v) => Math.min(m, v), Infinity);
            withinHours = Math.max(1, Math.ceil(nearestMs / HOUR));
            const limit = withinHours * HOUR;
            withinHour = futureMs.filter(ms => ms <= limit).length;
        }
        return { today, tomorrow, week, withinHour, withinHours };
    }, [events, nowTick]);

    // Index för valt event i sökresultaten (null = inget valt eller inte i listan)
    const currentEventIndex = selectedEvent
        ? visibleEvents.findIndex(e => e.id === selectedEvent.id)
        : -1;

    // Stabil referens så V2Map:s useEffect inte loopar.
    const handleMapCenterChange = useCallback((lat: number, lng: number) => {
        setMapCenter({ lat, lng });
    }, []);

    const handleDiscardEvent = (eventId: string) => {
        setDiscardedEventIds(prev => {
            const next = new Set(prev);
            next.add(eventId);
            return next;
        });
        // Remove from saved if it was there
        setSavedEventIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
        });
    };

    // ── "Hitta eventet"-spel ────────────────────────────────────────────────
    // Ett slumpat event för dagen visas som kort UTAN att kartan flyttas dit.
    // Spelaren ska hitta och klicka rätt markör på kartan. Rätt → +1 poäng;
    // fel → rätt markör avslöjas i guld och kameran flyger dit.
    // (Definieras här nere så gamePool kan läsa searchFilteredEvents ovan.)
    const gamePool = useMemo(
        () => visibleEvents.filter(hasValidCoords),
        [visibleEvents]
    );

    const startRound = useCallback(() => {
        if (gamePool.length === 0) return;
        const target = gamePool[Math.floor(Math.random() * gamePool.length)];
        setGoldEventId(null);
        setGameResult(null);
        setGameDistanceKm(null);
        setGuessLine(null);
        setGuessedEventId(null);
        setGameActive(true);
        setSelectedEvent(target); // visar mål-kortet; V2Map (gameMode) hindrar recenter/highlight
    }, [gamePool]);

    const handleGuess = useCallback((group: LinkEvent[]) => {
        if (!gameActive || !selectedEvent) return;
        const correct = group.some(e => e.id === selectedEvent.id);
        if (correct) {
            setGameScore(s => s + 1);
            setGameResult('correct');
            setGameDistanceKm(0);
            setGuessLine(null);
            setGuessedEventId(null);
        } else {
            // Hur långt ifrån svarade man? Avstånd mellan gissad markör och målet.
            const guessed = group.find(hasValidCoords) ?? group[0];
            const dist = (hasValidCoords(guessed) && hasValidCoords(selectedEvent))
                ? haversineKm(selectedEvent.lat, selectedEvent.lng, guessed.lat, guessed.lng)
                : null;
            setGameDistanceKm(dist);
            setGameResult('wrong');
            // Streck mellan gissningen och rätt svar; kartan zoomar ut så båda syns.
            setGuessedEventId(guessed.id);
            if (hasValidCoords(guessed) && hasValidCoords(selectedEvent)) {
                setGuessLine({
                    from: { lat: guessed.lat, lng: guessed.lng },
                    to: { lat: selectedEvent.lat, lng: selectedEvent.lng },
                    label: dist !== null ? formatGuessDistance(dist) : ''
                });
            }
        }
        setGoldEventId(selectedEvent.id);
        setGameActive(false);
    }, [gameActive, selectedEvent]);

    const clearGame = useCallback(() => {
        setGameActive(false);
        setGameResult(null);
        setGoldEventId(null);
        setGuessLine(null);
        setGuessedEventId(null);
        setSelectedEvent(null);
    }, []);

    // Stänger spelaren kortet (drar ner det) mitt i en runda/resultat → städa spelet.
    useEffect(() => {
        if (selectedEvent === null && (gameActive || gameResult !== null)) {
            setGameActive(false);
            setGameResult(null);
            setGoldEventId(null);
            setGuessLine(null);
            setGuessedEventId(null);
        }
    }, [selectedEvent, gameActive, gameResult]);

    return (
        <main className="relative w-screen h-screen overflow-hidden bg-slate-100">
            {/* 1. Svävande transparent Navbar överst */}
            <FloatingNavbar
                creationMode={creationMode}
                createEventEnabled={shopFlags.createEvent}
                onStartCreate={() => setCreationMode('placing')}
                onConfirmPlacement={() => {
                    if (!mapCenter) return;
                    setPickedLocation(mapCenter);
                    // Förifyll nästa hela timme idag — lokal tid i datetime-local-format.
                    const t = new Date(); t.setMinutes(0, 0, 0); t.setHours(t.getHours() + 1);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    setNewEventTime(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`);
                    setCreationMode('editing');
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onLoginClick={() => openLogin()}
                savedCount={savedEventIds.size}
                onToggleSaved={handleToggleSaved}
            />

            {/* 1b. Kategorichips under navbaren — filtrerar kartan + kortleken */}
            <CategoryFilter
                events={searchFilteredEvents}
                selected={selectedCategories}
                onToggle={handleToggleCategory}
                onClear={handleClearCategories}
            />

            {/* 1c. Sökträffar (alla dagar) — klick hoppar till eventets dag */}
            <SearchResults
                query={searchQuery}
                results={visibleEvents}
                onPick={jumpToEvent}
            />

            {/* 1d. Sparade event — hjärtknappen i navbaren */}
            <SavedPanel
                open={savedPanelOpen}
                events={events}
                savedEventIds={savedEventIds}
                onPick={jumpToEvent}
                onRemove={handleUnsaveEvent}
                onClose={() => setSavedPanelOpen(false)}
            />

            {/* 2. Fullskärmskarta underst */}
            <V2MapDynamic
                events={visibleEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
                cardExpanded={cardExpanded}
                onCenterChange={handleMapCenterChange}
                sunCloudTrigger={sunCloudKey}
                cloudStats={cloudStats}
                eventsLoaded={eventsLoaded}
                recallMainTrigger={recallMainTrigger}
                recallSunTrigger={recallSunTrigger}
                recenterTrigger={recenterTrigger}
                daySwitchNonce={daySwitchNonce}
                onCloudVisibilityChange={setCloudOffScreen}
                onMainRecalledChange={setMainRecalled}
                onFocusToolHint={setFocusToolBlink}
                onSlingshotChange={setSlingshotActive}
                slingshotEngaged={slingshotEngaged}
                onSlingshotFired={() => setSlingshotEngaged(false)}
                gameMode={gameActive}
                onGuess={handleGuess}
                goldEventId={goldEventId}
                guessedEventId={guessedEventId}
                guessLine={guessLine}
                tilted={mapTilted}
                onSunCloudTap={handleSunCloudTap}
                onToggleTilt={handleToggleTilt}
                onFeatureFlagsChange={handleFeatureFlagsChange}
                onActivateMultiplayer={handleActivateMultiplayer}
                onFuncBagOpenChange={setFuncBagOpen}
                findGameActive={gameActive}
                canStartFindGame={!selectedEvent && !gameActive && gameResult === null && gamePool.length > 0}
                onStartFindGame={startRound}
                onStopFindGame={clearGame}
            />

            {/* Modal för att skapa event — skriver till Firestore (kräver konto). */}
            {creationMode === 'editing' && pickedLocation && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Skapa event</h2>
                        <p className="text-xs text-slate-500 tabular-nums">
                            📍 {pickedLocation.lat.toFixed(5)}, {pickedLocation.lng.toFixed(5)}
                        </p>
                        <input
                            type="text"
                            value={newEventTitle}
                            onChange={e => setNewEventTitle(e.target.value)}
                            placeholder="Namn på event"
                            autoFocus
                            maxLength={120}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                        />
                        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                            När?
                            <input
                                type="datetime-local"
                                value={newEventTime}
                                onChange={e => setNewEventTime(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-normal text-base focus:border-green-500 focus:outline-none"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                            Kategori
                            <select
                                value={newEventCategory}
                                onChange={e => setNewEventCategory(e.target.value as EventCategoryType)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-normal text-base focus:border-green-500 focus:outline-none"
                            >
                                {Object.values(EVENT_CATEGORIES).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</option>
                                ))}
                            </select>
                        </label>
                        {!user && (
                            <p className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                                Du behöver logga in för att skapa eventet — det fixar vi i nästa steg.
                            </p>
                        )}
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setCreationMode('idle');
                                    setPickedLocation(null);
                                    setNewEventTitle('');
                                    setNewEventTime('');
                                }}
                                className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors font-semibold"
                            >
                                Avbryt
                            </button>
                            <button
                                type="button"
                                disabled={!newEventTitle.trim() || !newEventTime || creatingEvent}
                                onClick={handleCreateEvent}
                                className="px-5 py-2 rounded-full bg-green-600 text-white font-bold disabled:opacity-40 hover:bg-green-500 transition-colors"
                            >
                                {creatingEvent ? 'Skapar…' : user ? 'Skapa' : 'Logga in & skapa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inloggning/registrering — utan att lämna kartan */}
            <AuthModal
                open={authModal.open}
                reason={authModal.reason}
                onClose={() => setAuthModal({ open: false })}
            />

            {/* Onboarding vid första besöket — en skärm, sen ut på kartan */}
            <WelcomeOverlay
                onCreateAccount={() => openLogin('Skapa ett gratis konto — spara event och skapa egna')}
            />

            {/* 3. Dra-och-släpp (Tinder-style) kort längst ner */}
            <EventCard
                events={visibleEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                onSaveEvent={handleSaveEvent}
                onDiscardEvent={handleDiscardEvent}
                discardedEventIds={discardedEventIds}
                savedEventIds={savedEventIds}
                onUnsaveEvent={handleUnsaveEvent}
                onCardExpandedChange={setCardExpanded}
                dayOffset={dayOffset}
                dayRangeDays={dayRangeDays}
                onDayRangeChange={handleDayRangeChange}
                onSunClick={shopFlags.sun ? handleSunClick : undefined}
                mainCloudOffScreen={cloudOffScreen.main}
                sunCloudOffScreen={cloudOffScreen.sun}
                recallMainBlink={!mainRecalled}
                onRecallMainCloud={handleRecallMain}
                onRecallSunCloud={handleRecallSun}
                onRecenter={shopFlags.focus ? handleRecenter : undefined}
                recenterBlink={focusToolBlink}
                slingshotReady={slingshotActive}
                slingshotEngaged={slingshotEngaged}
                gameMode={gameActive || gameResult !== null}
                onRequireLogin={() => openLogin('Logga in för att chatta')}
            />

            {/* ── "Hitta eventet"-spel: banners. Poängen visas numera INNE i spelets
                banners (inte som en egen alltid-synlig bricka) — den hör till spelet. */}

            {/* Hint-banner under gissningsläget. */}
            {gameActive && selectedEvent && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-white/60 max-w-[92vw] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
                    <Target size={18} className="text-[#006AA7] shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-[#006AA7] leading-tight">Hitta på kartan</p>
                        <p className="text-sm font-bold text-slate-800 truncate max-w-[60vw]">{selectedEvent.title}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-black tabular-nums">
                        <Trophy size={12} className="shrink-0" /> {gameScore}
                    </span>
                    <button
                        type="button"
                        onClick={clearGame}
                        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1"
                        aria-label="Avbryt"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Resultat-banner efter en gissning. */}
            {gameResult !== null && (
                <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[1100] flex flex-col items-center gap-2 px-5 py-3 rounded-2xl shadow-xl border max-w-[92vw] pointer-events-auto animate-in fade-in zoom-in duration-300 ${
                    gameResult === 'correct'
                        ? 'bg-emerald-500 border-emerald-300 text-white'
                        : 'bg-white/95 backdrop-blur-md border-amber-300 text-slate-800'
                }`}>
                    <div className="flex flex-col items-center gap-0.5">
                        {gameResult === 'correct' ? (
                            <span className="flex items-center gap-2 font-black">
                                <Sparkles size={18} className="shrink-0" />
                                Rätt! +1 poäng
                            </span>
                        ) : (
                            <>
                                <span className="flex items-center gap-2 font-black">
                                    <Target size={18} className="text-amber-500 shrink-0" />
                                    {gameDistanceKm !== null
                                        ? `Fel! Du var ${formatGuessDistance(gameDistanceKm)} ifrån.`
                                        : 'Fel!'}
                                </span>
                                <span className="text-[12px] font-semibold text-slate-500">
                                    Rätt event lyser i guld.
                                </span>
                            </>
                        )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-black tabular-nums ${gameResult === 'correct' ? 'text-white/90' : 'text-amber-700'}`}>
                        <Trophy size={13} className="shrink-0" /> {gameScore} poäng totalt
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={startRound}
                            className={`font-bold text-sm px-4 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                                gameResult === 'correct'
                                    ? 'bg-white text-emerald-600 hover:bg-emerald-50'
                                    : 'bg-[#006AA7] text-white hover:bg-[#005590]'
                            }`}
                        >
                            Spela igen
                        </button>
                        <button
                            type="button"
                            onClick={clearGame}
                            className={`font-bold text-sm px-4 py-1.5 rounded-full transition-colors ${
                                gameResult === 'correct'
                                    ? 'bg-emerald-400/40 text-white hover:bg-emerald-400/60'
                                    : 'text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            Stäng
                        </button>
                    </div>
                </div>
            )}

            {/* Sol-effekt: ljus overlay som fadear in och ut över 3 sekunder.
                När animationen slutar trigger:as ett nytt moln i V2Map som
                ankras till nuvarande kartcenter. */}
            {sunFlashKey > 0 && (
                <div
                    key={sunFlashKey}
                    className="fixed inset-0 pointer-events-none z-[600] sun-flash-overlay"
                />
            )}
        </main>
    );
}
