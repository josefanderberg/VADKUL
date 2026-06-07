'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinkEvent } from '@/types';
import { linkEventService } from '@/services/linkEventService';
import FloatingNavbar from '@/components/v2/FloatingNavbar';
import EventCard from '@/components/v2/EventCard';
import { Target, Trophy, X, Sparkles } from 'lucide-react';

// We must dynamically import V2Map because leaflet requires window object
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
 * Vid dagbyte: välj eventet som ligger närmast användarens nuvarande position
 * (det tidigare selectedEvent). Faller tillbaka till första event i listan om
 * ankare saknar koords eller om inget event för dagen har koords.
 */
const pickNearestForDay = (anchor: LinkEvent | null, dayEvents: LinkEvent[]): LinkEvent | null => {
    if (dayEvents.length === 0) return null;
    if (!anchor || !hasValidCoords(anchor)) return dayEvents[0];

    let nearest: LinkEvent | null = null;
    let nearestDist = Infinity;
    for (const evt of dayEvents) {
        if (!hasValidCoords(evt)) continue;
        const d = haversineKm(anchor.lat, anchor.lng, evt.lat, evt.lng);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = evt;
        }
    }
    return nearest ?? dayEvents[0];
};

export default function HomePage() {
    const [events, setEvents] = useState<LinkEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<LinkEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<LinkEvent | null>(null);
    const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
    const [discardedEventIds, setDiscardedEventIds] = useState<Set<string>>(new Set());
    const [dayOffset, setDayOffset] = useState(0);
    const [cardExpanded, setCardExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const prevDayOffset = useRef(dayOffset);
    // Create-event-flöde: 'idle' = inget pågår, 'placing' = center-pinne synlig på kartan,
    // 'editing' = modal öppen med formulär. (Drop-animationen körs internt i FloatingNavbar.)
    const [creationMode, setCreationMode] = useState<'idle' | 'placing' | 'editing'>('idle');
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');

    // Sun-button effect: brightness flash on the map, followed by a fresh cloud
    // popping up in the middle of the screen. Each click bumps a key so the
    // flash overlay (and the resulting cloud) remount cleanly.
    const [sunFlashKey, setSunFlashKey] = useState(0);
    const [sunCloudKey, setSunCloudKey] = useState(0);
    // Solknappen vinklar också kameran: första klicket lutar kartan till en
    // sidovy (3D-perspektiv), nästa klick fäller tillbaka den till platt vy.
    const [mapTilted, setMapTilted] = useState(false);
    const handleSunClick = useCallback(() => {
        // Flash and cloud both fire simultaneously — cloud appears at the same
        // instant the screen pops white, then the light fades over the cloud.
        setSunFlashKey(k => k + 1);
        setSunCloudKey(k => k + 1);
        setMapTilted(t => !t);
    }, []);
    // Tryck på sol-molnet → fäll tillbaka kartans lutning till platt vy.
    const handleSunCloudTap = useCallback(() => setMapTilted(false), []);
    // Tilt-knappen (under satellit-knappen) togglar lutningen snabbt.
    const handleToggleTilt = useCallback(() => setMapTilted(t => !t), []);

    // Återkallningssystem för molnen: V2Map rapporterar off-screen, sidan
    // visar en knapp jämte solen som triggar en räknare → V2Map snäpper
    // molnet tillbaka in i bild.
    const [cloudOffScreen, setCloudOffScreen] = useState<{ main: boolean; sun: boolean }>({ main: false, sun: false });
    const [recallMainTrigger, setRecallMainTrigger] = useState(0);
    const [recallSunTrigger, setRecallSunTrigger] = useState(0);
    const handleRecallMain = useCallback(() => setRecallMainTrigger(t => t + 1), []);
    const handleRecallSun = useCallback(() => setRecallSunTrigger(t => t + 1), []);

    // Recenter: kortets recenter-knapp bumpar en räknare → V2Map flyger kameran
    // tillbaka till det valda eventet (vi går dit, eventet teleporteras inte hit).
    const [recenterTrigger, setRecenterTrigger] = useState(0);

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
        });
        return () => unsubscribe();
    }, []);

    // Filtrera events för den specifika dagen
    useEffect(() => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const filtered = events.filter(evt => {
            return evt.time >= startOfDay && evt.time <= endOfDay;
        });

        setFilteredEvents(filtered);
        // När dagen byts: välj eventet som ligger närmast nuvarande position
        // (gör det inte vid varje Firestore-uppdatering — bara när användaren bytt dag)
        if (prevDayOffset.current !== dayOffset) {
            setSelectedEvent(prev => pickNearestForDay(prev, filtered));
            prevDayOffset.current = dayOffset;
        }
    }, [events, dayOffset]);

    // Stäng av scroll på body så kartan tar över helt
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, []);

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

    // Sökfiltrering — appliceras ovanpå dag-filtreringen. Matchar titel, plats,
    // arrangör (hostName) samt eventets URL/källa, så att en sökning på t.ex.
    // "tickster" får fram alla event från den plattformen (domänen ligger i url).
    const searchFilteredEvents = useMemo(() => {
        if (!searchQuery.trim()) return filteredEvents;
        const q = searchQuery.toLowerCase();
        return filteredEvents.filter(evt =>
            evt.title.toLowerCase().includes(q) ||
            (evt.locationName?.toLowerCase().includes(q) ?? false) ||
            (evt.hostName?.toLowerCase().includes(q) ?? false) ||
            (evt.url?.toLowerCase().includes(q) ?? false)
        );
    }, [filteredEvents, searchQuery]);

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
        ? searchFilteredEvents.findIndex(e => e.id === selectedEvent.id)
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
        () => searchFilteredEvents.filter(hasValidCoords),
        [searchFilteredEvents]
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
                onStartCreate={() => setCreationMode('placing')}
                onConfirmPlacement={() => {
                    if (!mapCenter) return;
                    setPickedLocation(mapCenter);
                    setCreationMode('editing');
                }}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
            />

            {/* 2. Fullskärmskarta underst */}
            <V2MapDynamic
                events={searchFilteredEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
                cardExpanded={cardExpanded}
                onCenterChange={handleMapCenterChange}
                sunCloudTrigger={sunCloudKey}
                cloudStats={cloudStats}
                recallMainTrigger={recallMainTrigger}
                recallSunTrigger={recallSunTrigger}
                recenterTrigger={recenterTrigger}
                onCloudVisibilityChange={setCloudOffScreen}
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
            />

            {/* Modal för att skapa event */}
            {creationMode === 'editing' && pickedLocation && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4">
                        <h2 className="text-xl font-bold text-slate-800">Skapa event</h2>
                        <p className="text-xs text-slate-500 tabular-nums">
                            {pickedLocation.lat.toFixed(5)}, {pickedLocation.lng.toFixed(5)}
                        </p>
                        <input
                            type="text"
                            value={newEventTitle}
                            onChange={e => setNewEventTitle(e.target.value)}
                            placeholder="Namn på event"
                            autoFocus
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setCreationMode('idle');
                                    setPickedLocation(null);
                                    setNewEventTitle('');
                                }}
                                className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors font-semibold"
                            >
                                Avbryt
                            </button>
                            <button
                                type="button"
                                disabled={!newEventTitle.trim()}
                                onClick={() => {
                                    // TODO: koppla mot linkEventService.create() när event-schemat är klart
                                    // eslint-disable-next-line no-console
                                    console.log('Skapa event', { title: newEventTitle, ...pickedLocation });
                                    setCreationMode('idle');
                                    setPickedLocation(null);
                                    setNewEventTitle('');
                                }}
                                className="px-5 py-2 rounded-full bg-green-600 text-white font-bold disabled:opacity-40 hover:bg-green-500 transition-colors"
                            >
                                Skapa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Dra-och-släpp (Tinder-style) kort längst ner */}
            <EventCard
                events={searchFilteredEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                onSaveEvent={handleSaveEvent}
                onDiscardEvent={handleDiscardEvent}
                discardedEventIds={discardedEventIds}
                onCardExpandedChange={setCardExpanded}
                dayOffset={dayOffset}
                setDayOffset={setDayOffset}
                onSunClick={handleSunClick}
                mainCloudOffScreen={cloudOffScreen.main}
                sunCloudOffScreen={cloudOffScreen.sun}
                onRecallMainCloud={handleRecallMain}
                onRecallSunCloud={handleRecallSun}
                onRecenter={handleRecenter}
                slingshotReady={slingshotActive}
                slingshotEngaged={slingshotEngaged}
                gameMode={gameActive || gameResult !== null}
            />

            {/* ── "Hitta eventet"-spel: poäng, start-knapp och banners ───────── */}

            {/* Poäng — sitter under sök-knappen (uppe till vänster). Visas alltid. */}
            <div className="fixed top-[70px] left-4 z-[1000] flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-3 h-[34px] rounded-full shadow-lg border border-white/50 pointer-events-none">
                <Trophy size={15} className="text-amber-500 shrink-0" />
                <span className="text-sm font-black tabular-nums text-slate-800">{gameScore}</span>
            </div>

            {/* Start-knapp — visas bara när inget kort visas och ingen runda pågår. */}
            {!selectedEvent && !gameActive && gameResult === null && gamePool.length > 0 && (
                <button
                    type="button"
                    onClick={startRound}
                    className="fixed top-[114px] left-4 z-[1000] flex items-center gap-2 bg-[#006AA7] hover:bg-[#005590] text-white font-bold text-sm px-4 h-[38px] rounded-full shadow-xl border border-white/20 active:scale-95 transition-all"
                >
                    <Target size={16} className="shrink-0" />
                    Hitta event
                </button>
            )}

            {/* Hint-banner under gissningsläget. */}
            {gameActive && selectedEvent && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-white/60 max-w-[92vw] pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300">
                    <Target size={18} className="text-[#006AA7] shrink-0" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-[#006AA7] leading-tight">Hitta på kartan</p>
                        <p className="text-sm font-bold text-slate-800 truncate max-w-[60vw]">{selectedEvent.title}</p>
                    </div>
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
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={startRound}
                            className={`font-bold text-sm px-4 py-1.5 rounded-full transition-colors ${
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
