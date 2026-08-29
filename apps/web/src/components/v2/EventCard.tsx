'use client';

import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { isVadkulHostedEvent, LinkEvent } from '../../types';
import { normalizePriceLabel } from '../../utils/priceLabel';
import { NO_TIME_PAST_HOUR, isEventPast } from './v2MapBricka';
import { type BoostTier } from '../../services/boostService';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import LinkEventCard from '../ui/LinkEventCard';
import EventChatPanel from './EventChatPanel';
import { ArrowRight, ArrowLeft, ChevronRight, ChevronDown, MapPin, Sun, LocateFixed, Clock, Ticket, Users, Image as ImageIcon, ImageOff } from 'lucide-react';

// Default event-längd när vi inte har en explicit sluttid — används för Pågår/Har varit.
const DEFAULT_EVENT_MS = 60 * 60 * 1000;
// Hur långt fram i tiden "Snart" gäller.
const SOON_WINDOW_MS = 60 * 60 * 1000;
const NEARBY_PAGE_SIZE = 20;
// Kommer ihåg om användaren stängt av bilderna i närhetslistan (kompakt läge).
const NEARBY_IMAGES_KEY = 'vadkul_narhetslista_bilder';
// Börjar eventet inom 1 timme (Pågår/Snart) hinner man inte längre än så här —
// då döljer vi event som ligger längre bort (7 mil = 70 km).
const MAX_IMMINENT_DISTANCE_KM = 70;
// "I närheten" har en yttre gräns: event längre bort än så visas inte i listan.
// Fångar också skräp som felgeokodats till fel kontinent (t.ex. Australien) —
// de skulle annars dyka upp med ett vilt missvisande avstånd. 50 mil = 500 km.
const MAX_NEARBY_DISTANCE_KM = 500;

type EventStatus = 'past' | 'ongoing' | 'soon' | 'within3' | 'within5' | 'later' | 'today';

const getEventStatus = (time: Date, now: number, hasSpecificTime = true): EventStatus => {
    // Event utan klockslag (midnatt = bara datum): vi vet inte NÄR på dagen de
    // är — de får den neutrala statusen "Idag" (aldrig "Pågår") och stämplas
    // "Har varit" från kl 20 sin dag (NO_TIME_PAST_HOUR, delas med kartans
    // markör-dämpning).
    if (!hasSpecificTime) {
        const cutoff = new Date(time);
        cutoff.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
        if (now >= cutoff.getTime()) return 'past';
        const sameDay = new Date(time).toDateString() === new Date(now).toDateString();
        return sameDay ? 'today' : 'later';
    }
    const start = time.getTime();
    const end = start + DEFAULT_EVENT_MS;
    if (now >= end) return 'past';
    if (now >= start) return 'ongoing';
    const untilStart = start - now;
    if (untilStart <= SOON_WINDOW_MS) return 'soon';        // < 1h
    if (untilStart <= 3 * SOON_WINDOW_MS) return 'within3'; // 1–3h
    if (untilStart <= 5 * SOON_WINDOW_MS) return 'within5'; // 3–5h
    return 'later';                                         // > 5h
};

const formatDistanceKm = (km: number): string => {
    if (km < 1) {
        const m = Math.max(10, Math.round((km * 1000) / 10) * 10);
        return `${m} m`;
    }
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
};

// "Inom 3h" / "Inom 5h" om eventet ligger nära i tid — annars klocktid eller
// veckodag+tid om det är en annan dag. Returnerar tom sträng för Pågår/Snart;
// då säger statusbadgen redan vad som behöver sägas.
const formatTimeHint = (time: Date, now: number, hasSpecificTime = true): string => {
    // Visa ALLTID klockslaget — även för "Snart"/pågående event. Tidigare gav
    // <1h en tom sträng, så just de eventen saknade tid (det användaren såg).
    // UNDANTAG: event utan riktigt klockslag (midnatt = bara datum från källan)
    // ska inte påstå "kl 00:00" — visa bara dagen. Samma dag FÖRE kl 20 säger
    // statusbadgen redan "Idag" (tom hint = ingen dubblering); efter kl 20
    // säger badgen "Har varit" och då behövs dagen här.
    const sameDay = new Date(time).toDateString() === new Date(now).toDateString();
    if (!hasSpecificTime) {
        if (sameDay) {
            const cutoff = new Date(time);
            cutoff.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
            return now >= cutoff.getTime() ? 'Idag' : '';
        }
        return time.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    const hhmm = time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `kl ${hhmm}`;
    const weekday = time.toLocaleDateString('sv-SE', { weekday: 'short' });
    return `${weekday} ${hhmm}`;
};

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

/**
 * Hittar närmaste event utifrån "fromEvent" som inte är bortkastat,
 * sig självt, eller redan besökt.
 * Returnerar null om inga giltiga kandidater finns.
 * Fallar tillbaka till nästa i array-ordningen om fromEvent saknar koordinater.
 */
const findNearestEvent = (
    fromEvent: LinkEvent,
    events: LinkEvent[],
    discardedEventIds: Set<string>,
    visitedEventIds: Set<string>,
): LinkEvent | null => {
    const candidates = events.filter(
        e => e.id !== fromEvent.id
            && !discardedEventIds.has(e.id)
            && !visitedEventIds.has(e.id),
    );
    if (candidates.length === 0) return null;

    if (!hasValidCoords(fromEvent)) {
        // Fallback: nästa giltiga i ursprunglig ordning
        const idx = events.findIndex(e => e.id === fromEvent.id);
        for (let i = 1; i <= events.length; i++) {
            const cand = events[(idx + i) % events.length];
            if (
                cand.id !== fromEvent.id
                && !discardedEventIds.has(cand.id)
                && !visitedEventIds.has(cand.id)
            ) {
                return cand;
            }
        }
        return null;
    }

    let nearest: LinkEvent | null = null;
    let nearestDist = Infinity;
    let nearestNoCoords: LinkEvent | null = null;
    for (const cand of candidates) {
        if (!hasValidCoords(cand)) {
            if (!nearestNoCoords) nearestNoCoords = cand;
            continue;
        }
        const d = haversineKm(fromEvent.lat, fromEvent.lng, cand.lat, cand.lng);
        if (d < nearestDist) {
            nearestDist = d;
            nearest = cand;
        }
    }
    // Föredra event med koordinater. Annars fall tillbaka till första utan koords.
    return nearest ?? nearestNoCoords;
};

const getDayLabel = (offset: number, days = 1) => {
    const capitalize = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());
    if (days > 1) {
        // Intervall: helgen känns igen på att den slutar på en söndag.
        const start = new Date(); start.setDate(start.getDate() + offset);
        const end = new Date(start); end.setDate(end.getDate() + days - 1);
        if (end.getDay() === 0 && days <= 3) return 'I helgen';
        if (offset === 0 && days === 7) return 'Hela veckan';
        const fmt = (d: Date) => d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '');
        return `${fmt(start)}–${fmt(end)}`;
    }
    if (offset === 0) return 'Idag';
    if (offset === 1) return 'Imorgon';
    if (offset === -1) return 'Igår';
    const date = new Date();
    date.setDate(date.getDate() + offset);
    // Inom en vecka räcker veckodagen — längre bort (eller bakåt) behövs datumet.
    if (offset > 6 || offset < 0) {
        return capitalize(date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', ''));
    }
    return capitalize(date.toLocaleDateString('sv-SE', { weekday: 'long' }));
};

interface NearbyEventsListProps {
    /** Kommande (ej passerade) event, redan sliced till synligt antal. */
    upcomingItems: { evt: LinkEvent; distanceKm: number | null }[];
    upcomingTotal: number;
    /** Alla event som redan varit — visas under en hopfällbar flik. */
    pastItems: { evt: LinkEvent; distanceKm: number | null }[];
    now: number;
    onSelect: (evt: LinkEvent) => void;
    onLoadMore: () => void;
    /** Onboarding-ankare: sätts på raden EFTER det 5:e eventet (eller sista om
     *  färre) — när det syns har användaren scrollat ända ner till listan och
     *  ser minst 5 event, och scroll-coachen kan släckas. */
    coachMarkerRef?: React.Ref<HTMLLIElement>;
    /** Bildflödes-läget — sedan 26/8 (kväll) INFOVYNS lista längst ner, inte
     *  lista-toggelns vy: bilderna tvingas på (kompakt-valet ignoreras,
     *  toggeln göms) och rader vars bild saknas ELLER inte går att ladda
     *  göms helt. Lista-toggeln i headern visar ALLA event. */
    imagesOnly?: boolean;
    /** Bildtoggeln i listhuvudet — state ägs av EventCard (persisteras i
     *  localStorage). Ignoreras i bildflödes-läget (imagesOnly). */
    showImages: boolean;
    onToggleImages: () => void;
}

function StatusBadge({ status }: { status: EventStatus }) {
    if (status === 'later') return null;
    const cfg = {
        ongoing: { label: 'Pågår', cls: 'bg-emerald-500 text-white' },
        // Event utan klockslag: vi vet inte när på dagen — säg bara "Idag".
        today: { label: 'Idag', cls: 'bg-emerald-300 text-emerald-900' },
        soon: { label: 'Snart', cls: 'bg-amber-500 text-white' },
        within3: { label: 'Inom 3h', cls: 'bg-amber-300 text-amber-900' },
        within5: { label: 'Inom 5h', cls: 'bg-sky-300 text-sky-900' },
        past: { label: 'Har varit', cls: 'bg-slate-300 text-slate-700' },
    }[status];
    return (
        <span className={`inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

/** Samma emoji-logik som kartnålarna: AI:ns per-event-emoji, kategori-fallback. */
function eventEmoji(evt: LinkEvent): string {
    const catKey = (evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other') as EventCategoryType;
    return evt.emoji || (EVENT_CATEGORIES[catKey]?.emoji ?? '🎫');
}

/** Omslagsbild i närhetslistan — börjar som tom platshållare och laddar bilden
 *  FÖRST när raden scrollats fram (IntersectionObserver). Kortet öppnar alltså
 *  lika snabbt som utan bilder; bara det man faktiskt tittar på hämtas.
 *  Fast höjd via className så inget hoppar när bilden dyker upp; trasig
 *  bildlänk rapporteras uppåt via onFailed (raden faller då tillbaka till
 *  sin bildlösa layout). */
function LazyRowImage({ src, alt, className, onFailed }: {
    src: string;
    alt: string;
    className?: string;
    onFailed?: () => void;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = holderRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(entries => {
            if (entries.some(e => e.isIntersecting)) {
                setInView(true);
                io.disconnect();
            }
        }, { rootMargin: '150px' });
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={holderRef} className={`overflow-hidden bg-slate-200 dark:bg-slate-800 ${className ?? ''}`}>
            {inView && (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onError={onFailed}
                    className="w-full h-full object-cover animate-in fade-in duration-300"
                />
            )}
        </div>
    );
}

function NearbyRow({ evt, distanceKm, now, onSelect, showImages = true, hideWithoutImage = false }: {
    evt: LinkEvent;
    distanceKm: number | null;
    now: number;
    onSelect: (evt: LinkEvent) => void;
    /** False = användaren har slagit av bilderna i listhuvudet → alla rader
     *  renderas i den kompakta bildlösa layouten. */
    showImages?: boolean;
    /** Bildflödes-läget (listvyn): en rad utan visningsbar bild — saknad
     *  ELLER trasig länk — renderas inte alls i stället för att falla
     *  tillbaka till den bildlösa layouten. */
    hideWithoutImage?: boolean;
}) {
    const status = getEventStatus(evt.time, now, evt.hasSpecificTime !== false);
    const timeHint = formatTimeHint(evt.time, now, evt.hasSpecificTime !== false);
    const priceLabel = normalizePriceLabel(evt.price);
    const attendees = evt.attendees ?? 0;
    // Trasig bildlänk → rendera den kompakta bildlösa raden i stället.
    const [imgFailed, setImgFailed] = useState(false);
    const hasImage = showImages && !!evt.coverImage && !imgFailed;
    if (hideWithoutImage && !hasImage) return null;

    // EN inforad (avstånd, plats, klocka, pris, kommer) — delas av båda
    // layouterna; platsnamnet är det enda som trunkeras när det blir trångt.
    const infoRow = (
        <div className="flex items-center gap-x-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 overflow-hidden">
            <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                <MapPin size={11} className="text-primary" />
                {distanceKm !== null ? formatDistanceKm(distanceKm) : 'Okänt avstånd'}
            </span>
            <span className="truncate min-w-0">{evt.locationName}</span>
            {timeHint && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Clock size={11} className="text-primary" />
                    {timeHint}
                </span>
            )}
            {priceLabel && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Ticket size={11} className="text-primary" />
                    {priceLabel}
                </span>
            )}
            {attendees > 0 && (
                <span className="inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                    <Users size={11} className="text-primary" />
                    {attendees} kommer
                </span>
            )}
        </div>
    );

    // Rad MED bild: bilden kant till kant överst. Titeln ligger OVANPÅ bilden
    // (emojin till vänster på samma rad) och status-badgen i bildens höger-
    // kant — allt på en mörk gradient så texten alltid är läsbar, även på
    // ljusa bilder/platshållaren. Inforaden ligger under bilden.
    if (hasImage) {
        return (
            <li>
                <button
                    type="button"
                    onClick={() => onSelect(evt)}
                    className="w-full text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                >
                    <div className="relative">
                        <LazyRowImage
                            src={evt.coverImage!}
                            alt=""
                            className="h-28"
                            onFailed={() => setImgFailed(true)}
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 px-4 md:px-6 pb-2 pt-8 bg-gradient-to-t from-black/75 via-black/35 to-transparent">
                            <span className="text-lg leading-none shrink-0 drop-shadow" aria-hidden>
                                {eventEmoji(evt)}
                            </span>
                            <h4 className="flex-1 min-w-0 font-black text-sm text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                {evt.title}
                            </h4>
                            {isVadkulHostedEvent(evt) && (
                                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 bg-emerald-500 text-white">
                                    VADKUL
                                </span>
                            )}
                            <StatusBadge status={status} />
                        </div>
                    </div>
                    <div className="px-4 md:px-6 py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">{infoRow}</div>
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    </div>
                </button>
            </li>
        );
    }

    // Rad UTAN bild: kompakt som förut — emoji-bricka till vänster, titel +
    // badges, inforaden under.
    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(evt)}
                className="w-full text-left px-4 md:px-6 py-2.5 flex items-center gap-3 hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
            >
                <span
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none ${
                        isVadkulHostedEvent(evt)
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400/80'
                            : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                    aria-hidden
                >
                    {eventEmoji(evt)}
                </span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="font-black text-sm text-black dark:text-white truncate">
                            {evt.title}
                        </h4>
                        {isVadkulHostedEvent(evt) && (
                            <span className="inline-flex items-center text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 bg-emerald-500 text-white">
                                VADKUL
                            </span>
                        )}
                        <StatusBadge status={status} />
                    </div>
                    {infoRow}
                </div>
                <ChevronRight size={16} className="text-slate-400 shrink-0" />
            </button>
        </li>
    );
}

function NearbyEventsList({ upcomingItems, upcomingTotal, pastItems, now, onSelect, onLoadMore, coachMarkerRef, imagesOnly = false, showImages, onToggleImages }: NearbyEventsListProps) {
    const [showPast, setShowPast] = useState(false);
    // I bildflödes-läget (imagesOnly) ignoreras valet — bilderna är PÅ.
    const effectiveShowImages = imagesOnly || showImages;
    // Ankaret sätts efter det 4:e eventet (0-indexerat: 3) — eller sista raden
    // om listan är kortare — så "ser minst 4"-villkoret blir sant först när man
    // scrollat ända ner hit.
    const markerIdx = Math.min(3, upcomingItems.length - 1);
    return (
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 border-t border-border">
            <div className="px-4 md:px-6 py-3 sticky top-0 bg-slate-50/95 dark:bg-slate-900/80 backdrop-blur-sm border-b border-border z-10 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Fler event i närheten · {upcomingTotal}
                </span>
                {!imagesOnly && (
                    <button
                        type="button"
                        onClick={onToggleImages}
                        aria-pressed={showImages}
                        title={showImages ? 'Dölj bilderna — kompakt lista' : 'Visa bilderna'}
                        className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            showImages
                                ? 'bg-[#006AA7] text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}
                    >
                        {showImages ? <ImageIcon size={12} /> : <ImageOff size={12} />}
                        Bilder
                    </button>
                )}
            </div>

            <ul className="divide-y divide-border">
                {upcomingItems.map(({ evt, distanceKm }, i) => (
                    <Fragment key={evt.id}>
                        <NearbyRow evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} />
                        {i === markerIdx && coachMarkerRef && (
                            <li ref={coachMarkerRef} aria-hidden className="h-px" />
                        )}
                    </Fragment>
                ))}
            </ul>

            {upcomingItems.length < upcomingTotal && (
                <div className="px-4 md:px-6 py-3 flex justify-center border-t border-border">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="text-[11px] font-black uppercase tracking-widest text-[#006AA7] hover:text-[#005590] px-4 py-2"
                    >
                        Visa fler
                    </button>
                </div>
            )}

            {/* Hopfällbar flik — event som redan varit, dolda som standard */}
            {pastItems.length > 0 && (
                <div className="border-t border-border">
                    <button
                        type="button"
                        onClick={() => setShowPast(s => !s)}
                        className="w-full px-4 md:px-6 py-3 flex items-center justify-between text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                        aria-expanded={showPast}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Har varit · {pastItems.length}
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {showPast && (
                        <ul className="divide-y divide-border opacity-70">
                            {pastItems.map(({ evt, distanceKm }) => (
                                <NearbyRow key={evt.id} evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

interface EventCardProps {
    events: LinkEvent[];
    /** Antal event för dagen i dag-väljarens badge — räknas FÖRE källfiltret så
     *  det visar dagens totala antal även när stora källor (PRO/Korpen/Svenska
     *  kyrkan) är dolda. Faller tillbaka till events.length om utelämnat. */
    dayCount?: number;
    /** False tills FÖRSTA event-batchen kommit — döljer "Laddar event…". Släpps
     *  tidigt (så fort nålarna finns på kartan), inte vid det slutliga beskedet. */
    eventsLoaded?: boolean;
    /** False tills det DEFINITIVA "allt hämtat"-beskedet. Först då får "Inga event
     *  den här dagen" visas — annars blinkar den förbi i introt medan event
     *  fortfarande strömmar in (loadern är redan borta då). */
    eventsSettled?: boolean;
    selectedEvent: LinkEvent | null;
    onSelectEvent: (evt: LinkEvent | null) => void;
    onSaveEvent: (eventId: string) => void;
    onDiscardEvent: (eventId: string) => void;
    discardedEventIds: Set<string>;
    /** Sparade event — hjärtat på kortet visar/ändrar status. */
    savedEventIds?: Set<string>;
    /** Användarens GPS-position (kartans blå plats-prick). Känd → kortet visar
     *  avståndet från användaren till det valda eventet. */
    userPos?: { lat: number; lng: number } | null;
    onUnsaveEvent?: (eventId: string) => void;
    onCardExpandedChange?: (expanded: boolean) => void;
    /** Signaleras precis innan en INTERN navigering (Nästa/Föregående/svep) byter
     *  valt event — så kartan kan låta bli att flytta kameran till det event man
     *  kommer till (vi står kvar; kortet bara öppnas). */
    onNavigate?: () => void;
    /** (Avvecklad) Zooma in på valt event. Zoom-knapparna är borttagna ur
     *  Nästa-pillen — propsen behålls så page-anropet inte behöver ändras. */
    onZoomToSelected?: () => void;
    /** (Avvecklad) Zooma ut. Knappen borttagen ur Nästa-pillen. */
    onZoomOut?: () => void;
    /** Flipper-läge: antal träffar i pågående skott — visas som en pill bredvid
     *  Nästa-knappen i den nedre raden (0 = dölj). */
    pinShotHits?: number;
    dayOffset: number;
    /** Antal dagar i det visade intervallet (1 = en dag, 3 = t.ex. fre–sön). */
    dayRangeDays?: number;
    /** Byt visad dag/intervall — från dagväljaren eller återställningsknappen. */
    onDayRangeChange: (offset: number, days: number) => void;
    onSunClick?: () => void;
    /** Sant när huvudmolnet/solmolnet ligger utanför skärmen — då visas en
     *  återkallnings-knapp jämte solknappen. */
    mainCloudOffScreen?: boolean;
    sunCloudOffScreen?: boolean;
    onRecallMainCloud?: () => void;
    onRecallSunCloud?: () => void;
    /** Onboarding: blinka molnsymbol-knappen (en pulsande ring) tills man hämtat
     *  tillbaka molnet första gången — så användaren ser att den går att klicka. */
    recallMainBlink?: boolean;
    /** Flyg kartan tillbaka till det valda eventet (vi går dit — eventet
     *  teleporteras inte till vyn). Triggas av recenter-knappen på kortet. */
    onRecenter?: () => void;
    /** Onboarding: blinka recenter-/Fokus-knappen (ny funktion) tills man klickat. */
    recenterBlink?: boolean;
    /** True när molnen ligger på varandra → slangbella aktiv. Fyller fokusknappen
     *  vit som en mätare. */
    slingshotReady?: boolean;
    /** True när slangbellan är armad (efter första klicket på ready-knappen).
     *  Knappen visas inverterad (solid blå) som signal att nästa klick avfyrar. */
    slingshotEngaged?: boolean;
    /** True under "Hitta eventet"-spelet: kortet visar mål-eventet men navigering
     *  (Nästa/Bakåt) och svep åt sidan stängs av så spelaren inte byter mål. */
    gameMode?: boolean;
    /** Öppna inloggningsmodalen (chatten kräver konto för att skriva). */
    onRequireLogin?: () => void;
    /** Inloggad användares uid — ägaren av ett användarskapat event får ta bort det. */
    currentUserUid?: string;
    onDeleteOwnEvent?: (eventId: string) => void;
    /** Boosta (featura) ett event — startar Stripe Checkout på vald nivå
     *  (nivåerna ägs av BOOST_TIERS; väljs i kortets BoostTierPicker). */
    onBoostOwnEvent?: (eventId: string, tier: BoostTier) => void;
    /** Stjärn-gåvan ⭐: eventId:n som redan fått en stjärna (guld-indikator på
     *  kortet), om användaren har en oanvänd stjärna att sätta, samt placerings-
     *  callbacken (bekräftelsedialogen bor i LinkEventCard). */
    starredEventIds?: Set<string>;
    canPlaceStar?: boolean;
    onPlaceStar?: (eventId: string) => void;
    /** Engångsbegäran (räknare, 0 = ingen): nästa FÄRSKA öppning sker i
     *  HELSKÄRM med hela innehållet uppfällt. Bumpas av djuplänken
     *  (?event= från stadssidorna) — den som klickat sig hit från en
     *  stadssida ska se hela eventet direkt, ovanpå välkomstrutan
     *  (Josef 29/8). Förbrukas per bump; vanliga kartklick påverkas inte. */
    fullOpenNonce?: number;
}

export default function EventCard({ events, dayCount, eventsLoaded = true, eventsSettled = true, selectedEvent, onSelectEvent, onSaveEvent, onDiscardEvent, discardedEventIds, savedEventIds, userPos, onUnsaveEvent, onCardExpandedChange, onNavigate, pinShotHits = 0, dayOffset, dayRangeDays = 1, onDayRangeChange, onSunClick, mainCloudOffScreen, sunCloudOffScreen, onRecallMainCloud, onRecallSunCloud, recallMainBlink, onRecenter, recenterBlink, slingshotReady, slingshotEngaged, gameMode = false, onRequireLogin, currentUserUid, onDeleteOwnEvent, onBoostOwnEvent, starredEventIds, canPlaceStar = false, onPlaceStar, fullOpenNonce = 0 }: EventCardProps) {
    // Peek-höjd när kortet öppnas från stängt läge eller när användaren väljer
    // ett nytt ankar-event på kartan. Navigering med Nästa/Föregående bevarar
    // den höjd användaren själv dragit till.
    const PEEK_HEIGHT_VH = 22;
    // Fallback-höjd för uppmätt "öppna till första beskrivningsraden" (tap) om
    // mätningen saknas.
    const OPEN_HEIGHT_VH = 80;
    // "Peek"-läget längst ner där bara kortets header (titel, tid, plats) syns.
    // Ett nedåt-drag som släpps strax under gränsen snäpper tillbaka hit —
    // men drar man vidare nedåt glider kortet ner och STÄNGS (samma som att
    // klicka utanför det på kartan).
    const COLLAPSED_HEIGHT_VH = 22;
    // Hur långt under peek-gränsen (i vh) man måste släppa för att kortet ska
    // stängas i stället för att snäppa tillbaka till peek.
    const DISMISS_BELOW_VH = 6;
    // Kortets TAK: hur högt det får växa. Hela vägen upp (Josef 26/8 — förut
    // stannade det på 83vh med en kartremsa ovanför, men kortet ska kunna
    // fylla skärmen).
    const MAX_HEIGHT_VH = 100;

    // Reveal-steg från LinkEventCard: 0 = header+remsa, 1 = bild+trunkad, 2 = allt
    const [cardRevealStep, setCardRevealStep] = useState(0);
    // ── Vyskiftet (chatt / lista) ───────────────────────────────────────────
    // Chatten och närhetslistan ligger annars långt ner på kortet och många
    // scrollar aldrig dit. Togglarna på headerns översta rad byter VY: kortets
    // innehåll (bild/beskrivning/knappar) döljs och den valda sektionen visas
    // DIREKT under headern (LinkEventCard renderar bara headern i
    // vyskiftes-läget). Kortet växer samtidigt till full höjd och scrollas
    // till toppen — ett riktigt vyskifte, inte en scroll-genväg.
    const [cardView, setCardView] = useState<'info' | 'chat' | 'nearby'>('info');
    // Bilder AV som default i listan (Josef 26/8) — 'on' i storage slår på dem.
    const [showImages, setShowImages] = useState(false);
    useEffect(() => {
        try {
            if (localStorage.getItem(NEARBY_IMAGES_KEY) === 'on') setShowImages(true);
        } catch { /* privat läge / blockad storage — kör vidare med bilder av */ }
    }, []);
    const toggleImages = () => {
        setShowImages(prev => {
            const next = !prev;
            try {
                localStorage.setItem(NEARBY_IMAGES_KEY, next ? 'on' : 'off');
            } catch { /* ignorera */ }
            return next;
        });
    };
    const [heightVh, setHeightVh] = useState(PEEK_HEIGHT_VH);
    // grip-zonen (h-6 = 24px) ovanför scroll-containern.
    const heightVhRef = useRef(PEEK_HEIGHT_VH);
    const updateHeightVh = (vh: number) => {
        heightVhRef.current = vh;
        setHeightVh(vh);
    };


    const [dragX, setDragX] = useState(0);
    const dragXRef = useRef(0);
    const updateDragX = (x: number) => {
        dragXRef.current = x;
        setDragX(x);
    };

    const [exitX, setExitX] = useState<number | null>(null); // For animation off-screen
    const [anchorId, setAnchorId] = useState<string | null>(null);
    const [visitedEventIds, setVisitedEventIds] = useState<Set<string>>(new Set());
    const [nearbyVisibleCount, setNearbyVisibleCount] = useState(NEARBY_PAGE_SIZE);
    const [now, setNow] = useState(() => Date.now());
    const [scrollNudgeActive, setScrollNudgeActive] = useState(false);
    const scrollNudgeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    // ── Scroll-coach (engångs-onboarding) ──────────────────────────────────────
    // Första gången någonsin man öppnar ett kort guidas man ner till event-listan:
    //   'nudge' → kortet studsar, men BARA tills man scrollat ner första gången
    //             NÅGONSIN (sparas direkt — kortet studsar aldrig igen efter det),
    //   'hint'  → "scrolla ner"-pilen visas på varje kort tills man scrollat ner
    //             och sett ≥4 event i närhetslistan,
    //   'off'   → klart, sparas i localStorage och visas ALDRIG igen.
    const COACH_KEY = 'vadkul_scroll_coach_done';
    const NUDGE_KEY = 'vadkul_scroll_nudge_done';
    const [coachStage, setCoachStage] = useState<'nudge' | 'hint' | 'off'>('off');
    const coachMarkerRef = useRef<HTMLLIElement | null>(null);
    // Läs "redan klar"-flaggorna en gång; är coach-flaggan satt startar coachen
    // aldrig, är nudge-flaggan satt studsar kortet aldrig (pilen kan ändå visas).
    const coachDoneRef = useRef(true);
    const nudgeDoneRef = useRef(true);
    useEffect(() => {
        try {
            coachDoneRef.current = localStorage.getItem(COACH_KEY) === '1';
            nudgeDoneRef.current = localStorage.getItem(NUDGE_KEY) === '1';
        }
        catch { coachDoneRef.current = true; nudgeDoneRef.current = true; } // privat läge → hoppa över coachen
    }, []);
    const finishNudge = () => {
        nudgeDoneRef.current = true;
        try { localStorage.setItem(NUDGE_KEY, '1'); } catch { /* privat läge */ }
    };
    const finishCoach = () => {
        coachDoneRef.current = true;
        finishNudge(); // klar coach ⇒ studsen är också förbrukad
        setCoachStage('off');
        try { localStorage.setItem(COACH_KEY, '1'); } catch { /* privat läge */ }
    };
    // Browse-historik (bakåt-stack): event-id:n vi tittade på innan vi gick vidare.
    const [historyStack, setHistoryStack] = useState<string[]>([]);
    // Framåt-stack: event vi backat ur. Nästa spelar upp dem i samma ordning igen
    // (som webbläsarens framåt-knapp) i stället för att räkna fram ett nytt event.
    const [forwardStack, setForwardStack] = useState<string[]>([]);

    const [isAnimating, setIsAnimating] = useState(true);
    const isDragging = useRef(false);
    const dragDirection = useRef<'none' | 'horizontal' | 'vertical'>('none');
    const startX = useRef(0);
    const startY = useRef(0);
    const startHeightVh = useRef(PEEK_HEIGHT_VH);
    const startDragX = useRef(0);
    
    // Sätts till id:t vi själva ska byta till så useEffect kan särskilja
    // "användaren klickade på kartan" från "vi tryckte Nästa".
    const expectedNextIdRef = useRef<string | null>(null);
    const isFreshOpenRef = useRef(false);
    // Senast förbrukade helskärmsbegäran (fullOpenNonce) — se ankar-effekten.
    const consumedFullOpenNonceRef = useRef(0);

    // Notify parent about card expansion state for map center offsets
    useEffect(() => {
        onCardExpandedChange?.(heightVh > 50);
    }, [heightVh, onCardExpandedChange]);

    // Räkna ut hur högt kortet ska öppnas: precis så att hela bilden + FÖRSTA
    // raden av beskrivningen syns — inte hela vägen ner till "Anmäl dig här".
    // Vi mäter var beskrivnings-stycket börjar (bildens höjd varierar) och lägger
    // på ~1,4 radhöjder. Faller tillbaka till OPEN_HEIGHT_VH om mätning saknas.
    const measureOpenHeight = (): number => {
        const sc = scrollContainerRef.current;
        if (!sc) return OPEN_HEIGHT_VH;
        const desc = sc.querySelector('[data-event-description]') as HTMLElement | null;
        if (!desc) return OPEN_HEIGHT_VH;
        const scRect = sc.getBoundingClientRect();
        const descRect = desc.getBoundingClientRect();
        const lineHeight = parseFloat(getComputedStyle(desc).lineHeight) || 22;
        // Beskrivningens topp relativt scroll-innehållets topp (oberoende av
        // nuvarande korthöjd).
        const descTopWithinContent = (descRect.top - scRect.top) + sc.scrollTop;
        const targetPx = descTopWithinContent + lineHeight * 1.4;
        const vh = (targetPx / window.innerHeight) * 100;
        return Math.max(PEEK_HEIGHT_VH, Math.min(MAX_HEIGHT_VH, Math.round(vh)));
    };

    // Minsta höjd kortet kan dras ner till: precis så att kortets nedre kant
    // hamnar på sträcket (border-linjen) under tid + plats — d.v.s. titel +
    // tid/plats syns, men Värd/Pris-raden är dold under vikningen. Mäter var den
    // linjen ligger (markerad med data-peek-boundary i LinkEventCard) relativt
    // scroll-innehållet + grip-zonen (h-6 = 24px). Faller tillbaka till
    // COLLAPSED_HEIGHT_VH om mätning saknas.
    const measureCollapsedHeight = (): number => {
        const sc = scrollContainerRef.current;
        if (!sc) return COLLAPSED_HEIGHT_VH;
        const line = sc.querySelector('[data-peek-boundary]') as HTMLElement | null;
        if (!line) return COLLAPSED_HEIGHT_VH;
        const scRect = sc.getBoundingClientRect();
        const lineRect = line.getBoundingClientRect();
        // Linjens topp relativt scroll-innehållets topp (oberoende av nuvarande
        // korthöjd/scroll).
        const lineTopWithinContent = (lineRect.top - scRect.top) + sc.scrollTop;
        const targetPx = lineTopWithinContent;
        const vh = (targetPx / window.innerHeight) * 100;
        return Math.max(10, Math.min(PEEK_HEIGHT_VH, Math.round(vh)));
    };

    // Default-höjd när ett kort öppnas: visa HELA headern (titel, tid, plats,
    // värd, pris) + en remsa av bilden — så man direkt ser värden OCH lite av
    // bilden. Mäts mot Värd/Pris-radens botten (data-peek-boundary) + ~60px ner
    // i innehållet (bilden ligger direkt under), eftersom header-höjden varierar.
    const measureDefaultHeight = (): number => {
        const sc = scrollContainerRef.current;
        if (!sc) return OPEN_HEIGHT_VH;
        const peek = sc.querySelector('[data-peek-boundary]') as HTMLElement | null;
        if (!peek) return measureCollapsedHeight();
        const scRect = sc.getBoundingClientRect();
        const peekRect = peek.getBoundingClientRect();
        const targetPx = (peekRect.bottom - scRect.top) + sc.scrollTop + 60;
        const vh = (targetPx / window.innerHeight) * 100;
        return Math.max(PEEK_HEIGHT_VH, Math.min(80, Math.round(vh)));
    };
    // Live-ref så drag-handlern (onPointerMove) alltid läser senaste mätta
    // botten-gränsen utan att bindas om. Default = konstanten tills vi mätt.
    const collapsedVhRef = useRef(COLLAPSED_HEIGHT_VH);
    // Timer för stängningsanimationen (drag-ner-förbi-peek → glid ner → stäng).
    const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); }, []);

    // ── Dra-ner-vid-scroll-toppen ────────────────────────────────────────────
    // Står den inre scrollen på toppen och man drar nedåt ska gesten INTE
    // rubber-banda scrollen (vitt glapp ovanför innehållet) — den ska tas över
    // av kortets vertikala drag så kortet självt följer fingret ner (och kan
    // släppas för att stängas). preventDefault på touchmove hindrar webbläsaren
    // från att ta gesten för scroll; pointermove fortsätter då till kortets
    // drag-handlers. Kräver passive:false → native listeners, inte React-props.
    const hasSelectedEvent = selectedEvent !== null;
    useEffect(() => {
        if (!hasSelectedEvent) return;
        const sc = scrollContainerRef.current;
        if (!sc) return;
        let startedAtTop = false;
        let pulling = false;
        let touchStartY = 0;
        const onTouchStart = (e: TouchEvent) => {
            // Gester som börjar på interaktiva element (chattens input,
            // knappar, länkar) lämnas helt åt webbläsaren.
            const target = e.target as HTMLElement;
            // < 1: scrollTop kan vara bråkdel nära toppen (Firefox/iOS).
            startedAtTop = sc.scrollTop < 1
                && !target.closest('button, a, input, textarea, select');
            touchStartY = e.touches[0].clientY;
            pulling = false;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!startedAtTop) return;
            const dy = e.touches[0].clientY - touchStartY;
            if (!pulling) {
                if (dy > 4 && sc.scrollTop < 1) pulling = true;        // neddrag vid toppen → ta över
                else if (dy < -4) { startedAtTop = false; return; }    // uppdrag → vanlig innehållsscroll
            }
            if (pulling && e.cancelable) e.preventDefault();
        };
        sc.addEventListener('touchstart', onTouchStart, { passive: true });
        sc.addEventListener('touchmove', onTouchMove, { passive: false });
        return () => {
            sc.removeEventListener('touchstart', onTouchStart);
            sc.removeEventListener('touchmove', onTouchMove);
        };
    }, [hasSelectedEvent]);

    // ── Mus-/styrplatte-hjul: scrolla för att VÄXA hela behållaren ───────────
    // Förut kunde man bara DRA kortet med handtaget för att förstora det — ett
    // hjul-/tvåfingerscroll gjorde inget (touch-action gäller bara touch, inte
    // hjul). Nu växer hjulet kortet mot helskärm FÖRST; när det fyllt skärmen
    // scrollar den nedre delen av innehållet normalt. Scrollar man tillbaka vid
    // innehållstoppen krymper hela kortet igen (ner mot peek, ej stäng).
    // Native-lyssnare (passive:false) krävs för preventDefault.
    useEffect(() => {
        if (!hasSelectedEvent) return;
        const sc = scrollContainerRef.current;
        if (!sc) return;
        const onWheel = (e: WheelEvent) => {
            const h = heightVhRef.current;
            // deltaMode: 0 = px, 1 = rader (Firefox med mus), 2 = sidor.
            const px = e.deltaMode === 1 ? e.deltaY * 16
                : e.deltaMode === 2 ? e.deltaY * window.innerHeight
                : e.deltaY;
            const deltaVh = (px / window.innerHeight) * 100;
            // Scrolla "in i" kortet (fingrar upp / hjul ner) innan helskärm → väx det.
            if (deltaVh > 0 && h < MAX_HEIGHT_VH) {
                e.preventDefault();
                setIsAnimating(false);
                updateHeightVh(Math.min(MAX_HEIGHT_VH, h + deltaVh));
                return;
            }
            // Scrolla tillbaka vid innehållets topp → krymp kortet (ner mot peek).
            // < 1 (inte <= 0): Firefox rapporterar BRÅKDELS-scrollTop (0.5 osv)
            // nära toppen — med <= 0 fastnade hjulet i en död zon där varken
            // innehållet eller kortet rörde sig.
            if (deltaVh < 0 && sc.scrollTop < 1 && h > collapsedVhRef.current) {
                e.preventDefault();
                setIsAnimating(false);
                updateHeightVh(Math.max(collapsedVhRef.current, h + deltaVh));
                return;
            }
            // annars: helskärm + innehållet scrollar → låt hjulet scrolla normalt.
        };
        sc.addEventListener('wheel', onWheel, { passive: false });
        return () => sc.removeEventListener('wheel', onWheel);
    }, [hasSelectedEvent]);

    // Föregående valda event-id, så vi kan skilja "öppna från stängt" (null → X)
    // från "byta event medan kortet är öppet" (X → Y). Höjden ska bara nollställas
    // till default vid en ny öppning, inte vid byte.
    const prevSelectedIdRef = useRef<string | null>(null);

    // När ankaret sattes (kart-klicket). Nästa-poolens ankar-klassning (past
    // eller ej) görs mot DEN tidpunkten, så regeln inte flippar mitt i en
    // Nästa-kedja när klockan passerar ankarets egen "har varit"-gräns.
    const anchorSetAtRef = useRef(Date.now());

    // Detektera om selectedEvent ändrats utifrån (kartklick) → då är det en ny ankare.
    useEffect(() => {
        const prevId = prevSelectedIdRef.current;
        prevSelectedIdRef.current = selectedEvent?.id ?? null;
        if (!selectedEvent) return;

        // Avbryt en pågående drag-ner-stängning om ett nytt event väljs innan
        // den hunnit slutföras — annars nollar timern det nya valet.
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
        }

        const isPickNext = expectedNextIdRef.current === selectedEvent.id;
        if (isPickNext) {
            // Intern navigering (Nästa/Bakåt) drev fram detta event — behåll
            // ankare, besökt-set OCH bakåt/framåt-stackarna.
            expectedNextIdRef.current = null;
        } else {
            // Användaren valde ett nytt event (kartkick / första valet) → ny
            // ankare och en helt ny browsing-gren: nollställ besökt + historik.
            setAnchorId(selectedEvent.id);
            anchorSetAtRef.current = Date.now();
            setVisitedEventIds(new Set());
            setHistoryStack([]);
            setForwardStack([]);
        }

        setIsAnimating(true);
        setCardRevealStep(0); // Återställ till komprimerat läge vid nytt event
        // Default-höjd när kortet öppnas från stängt läge: mäts färskt så
        // bildremsan syns (men inte hela bilden). Byter man event medan kortet
        // redan är öppet behålls höjden (inget hopp).
        // Ett kort som var på väg ner i en stängning (höjd under peek-gränsen)
        // räknas också som ny öppning — annars öppnas det nya eventet osynligt.
        const freshOpen = prevId === null || heightVhRef.current < collapsedVhRef.current;
        isFreshOpenRef.current = freshOpen;
        // Helskärmsbegäran (djuplänken från stadssidorna): förbrukas här, en
        // gång per bump — efterföljande kartklick öppnar som vanligt. En
        // djuplänk är explicit navigering, så den vinner även om ett kort
        // redan råkade vara öppet (då är freshOpen false).
        const wantsFullOpen = fullOpenNonce > consumedFullOpenNonceRef.current;
        if (wantsFullOpen) consumedFullOpenNonceRef.current = fullOpenNonce;
        const raf = requestAnimationFrame(() => {
            const collapsed = measureCollapsedHeight();
            collapsedVhRef.current = collapsed;
            if (wantsFullOpen) updateHeightVh(MAX_HEIGHT_VH);
            else if (freshOpen) updateHeightVh(measureDefaultHeight());
        });
        return () => cancelAnimationFrame(raf);
        // fullOpenNonce bumpas i samma commit som selectedEvent sätts (djup-
        // länken) — den behöver inte trigga effekten själv.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent]);

    // Reset pagination and scroll position when the active event changes.
    // Höjden hanteras separat i ankar-effekten ovan så Nästa/Föregående bevarar
    // det användaren själv dragit till.
    useEffect(() => {
        setNearbyVisibleCount(NEARBY_PAGE_SIZE);
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        updateDragX(0);
        setIsAnimating(true);
        setCardRevealStep(0); // Återställ bildremsa vid nytt event
        setCardView('info'); // Nytt event öppnar alltid i infovyn (chatt/lista är per event)
    }, [selectedEvent?.id]);

    // Växla mellan infovyn och chatt-/listvyn. På väg IN i en vy: väx kortet
    // till full höjd och börja från toppen så sektionen syns direkt. På väg UT
    // behålls höjden — användaren står redan där hen vill. Pillarna växlar
    // också direkt mellan varandra (chatt → lista utan mellansteg via infovyn).
    const handleToggleView = (view: 'chat' | 'nearby') => {
        setCardView(prev => {
            const next = prev === view ? 'info' : view;
            if (next !== 'info') {
                setIsAnimating(true);
                updateHeightVh(MAX_HEIGHT_VH);
                if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
            }
            return next;
        });
    };

    // Uppdatera "nu" var 30:e sekund så statusbadgar håller sig fräscha.
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(t);
    }, []);

    // ── Scroll-coach: nudge → hint → klart ──────────────────────────────────────
    // Fas 'nudge' (bara innan man scrollat FÖRSTA gången någonsin): kortet studsar
    // (efter 5 s stilla vid toppen) för att signalera "det finns mer nedåt". Vid
    // första scrollen (>8 px) sparas nudge-flaggan permanent — kortet studsar
    // aldrig igen, på något kort. Fas 'hint': "scrolla ner"-pilen visas direkt på
    // varje kort tills observern nedan släcker allt (≥4 event i närheten sedda).
    useEffect(() => {
        const sc = scrollContainerRef.current;
        if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current);
        setScrollNudgeActive(false);

        // Ingen coach om: redan klar tidigare, inget event öppet, eller ingen container.
        if (coachDoneRef.current || !selectedEvent || !sc) { setCoachStage('off'); return; }

        // Färskt kort → studsa bara om man ALDRIG scrollat förr, annars direkt pil.
        setCoachStage(nudgeDoneRef.current ? 'hint' : 'nudge');

        // Studsa när innehållet är scrollbart och man står kvar vid toppen —
        // aldrig mer när första-scrollen är förbrukad.
        const armNudge = () => {
            if (nudgeDoneRef.current) return;
            if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current);
            scrollNudgeTimerRef.current = setTimeout(() => {
                if (sc.scrollTop < 5 && sc.scrollHeight > sc.clientHeight + 10) {
                    setScrollNudgeActive(true); // en studs; onAnimationEnd re-armar via nedan
                }
            }, 5000);
        };
        armNudge();

        const onScroll = () => {
            // Nått botten (t.ex. event utan grannar → ingen lista/ankare) räknas
            // också som "framme" — annars kunde coachen aldrig bli klar där.
            if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 40) {
                finishCoach();
                return;
            }
            // Första scrollen NÅGONSIN förbrukar studsen permanent och tänder pilen.
            if (sc.scrollTop > 8) {
                if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current);
                setScrollNudgeActive(false);
                if (!nudgeDoneRef.current) finishNudge();
                setCoachStage(stage => (stage === 'nudge' ? 'hint' : stage));
            } else {
                armNudge(); // tillbaka vid toppen → studsa igen (no-op efter första scrollen)
            }
        };
        sc.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            sc.removeEventListener('scroll', onScroll);
            if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent?.id]);

    // Nudgen är en engångsanimation — re-arma nästa studs medan vi är kvar i
    // nudge-fasen (onAnimationEnd nollställer scrollNudgeActive).
    useEffect(() => {
        if (coachStage !== 'nudge' || scrollNudgeActive || nudgeDoneRef.current) return;
        const sc = scrollContainerRef.current;
        if (!sc) return;
        if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current);
        scrollNudgeTimerRef.current = setTimeout(() => {
            if (sc.scrollTop < 5 && sc.scrollHeight > sc.clientHeight + 10) setScrollNudgeActive(true);
        }, 4500);
        return () => { if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current); };
    }, [coachStage, scrollNudgeActive]);

    // Rensa nudge-timer vid unmount.
    useEffect(() => () => { if (scrollNudgeTimerRef.current) clearTimeout(scrollNudgeTimerRef.current); }, []);

    // Avstånd från ANVÄNDARENS position (kartans plats-prick) till det valda
    // eventet — visas i kortets inforad. undefined när positionen är okänd
    // eller eventet saknar riktiga koordinater (0,0-sentinel).
    const distanceFromUserKm = useMemo(() => {
        if (!userPos || !selectedEvent || !hasValidCoords(selectedEvent)) return undefined;
        return haversineKm(userPos.lat, userPos.lng, selectedEvent.lat, selectedEvent.lng);
    }, [userPos, selectedEvent]);

    // Sortera övriga event efter avstånd från valt event (närmst först).
    const nearbyEvents = useMemo(() => {
        if (!selectedEvent) return [] as { evt: LinkEvent; distanceKm: number | null }[];
        const anchorHasCoords = hasValidCoords(selectedEvent);
        const list = events
            .filter(e => e.id !== selectedEvent.id && !discardedEventIds.has(e.id))
            .map(evt => {
                const distanceKm = anchorHasCoords && hasValidCoords(evt)
                    ? haversineKm(selectedEvent.lat, selectedEvent.lng, evt.lat, evt.lng)
                    : null;
                return { evt, distanceKm };
            })
            // Bara event vi faktiskt kan placera OCH som ligger inom rimligt
            // avstånd. Okänt avstånd (null) är för missvisande att visa, och
            // felgeokodat skräp (t.ex. Australien) ska aldrig hamna i "i närheten".
            .filter(n => n.distanceKm !== null && n.distanceKm <= MAX_NEARBY_DISTANCE_KM);
        list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
        return list;
    }, [events, selectedEvent, discardedEventIds]);

    // Dela upp närliggande event: kommande (ej passerade) visas direkt, medan de
    // som redan varit läggs under en hopfällbar flik. now gör att gränsen flyttar
    // sig i takt med klockan (uppdateras var 30:e sekund).
    const upcomingNearby = useMemo(() => {
        const kept = nearbyEvents.filter(n => {
            const status = getEventStatus(n.evt.time, now, n.evt.hasSpecificTime !== false);
            if (status === 'past') return false;
            // Imminent (Pågår/Snart, <1h): dölj det man inte hinner till (>7 mil).
            // Okänt avstånd (null) får vara kvar — vi kan inte avgöra.
            if (status === 'ongoing' || status === 'soon') {
                if (n.distanceKm !== null && n.distanceKm > MAX_IMMINENT_DISTANCE_KM) return false;
            }
            return true;
        });
        // Imminenta (Pågår/Snart) först, sedan Senare — vardera närmast först.
        const isImminent = (n: { evt: LinkEvent }) => {
            const s = getEventStatus(n.evt.time, now, n.evt.hasSpecificTime !== false);
            return s === 'ongoing' || s === 'soon';
        };
        return [...kept].sort((a, b) => {
            const rank = (isImminent(a) ? 0 : 1) - (isImminent(b) ? 0 : 1);
            if (rank !== 0) return rank;
            return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        });
    }, [nearbyEvents, now]);
    const pastNearby = useMemo(
        () => nearbyEvents.filter(n => getEventStatus(n.evt.time, now, n.evt.hasSpecificTime !== false) === 'past'),
        [nearbyEvents, now]
    );
    // INFOVYNS lista längst ner är bildflödet (Josef 26/8 kväll): bara event
    // med bild, bilderna tvingade på. Lista-toggeln i headern visar ALLA
    // event, med bildtoggeln (default av).
    const imagesOnlyList = cardView !== 'nearby';
    const listedUpcoming = imagesOnlyList ? upcomingNearby.filter(n => !!n.evt.coverImage) : upcomingNearby;
    const listedPast = imagesOnlyList ? pastNearby.filter(n => !!n.evt.coverImage) : pastNearby;

    // Scroll-coachens "nått fram"-observer: separat från nudge-fasen så att
    // listuppdateringar ("Visa fler"/ny data) inte nollställer coachen. Ligger
    // efter nearbyEvents-deklarationen (deps läser dess längd). Ankaret sitter
    // efter det 4:e eventet — syns det har man scrollat ner och sett ≥4 event.
    useEffect(() => {
        if (coachDoneRef.current || !selectedEvent) return;
        const sc = scrollContainerRef.current;
        const marker = coachMarkerRef.current;
        if (!sc || !marker || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(
            entries => { if (entries.some(e => e.isIntersecting)) finishCoach(); },
            { root: sc, threshold: 0.01 },
        );
        io.observe(marker);
        return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent?.id, nearbyEvents.length]);

    // Event på EXAKT samma plats (koordinat) som det valda — multi-event-högen.
    // Driver pagern ("3/7") på kortets platsrad. Ordnad efter tid för stabil numrering.
    const sameSpotGroup = useMemo(() => {
        if (!selectedEvent || !hasValidCoords(selectedEvent)) return [] as LinkEvent[];
        const spotKey = (e: LinkEvent) => `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
        const k = spotKey(selectedEvent);
        return events
            .filter(e => hasValidCoords(e) && spotKey(e) === k && !discardedEventIds.has(e.id))
            .sort((a, b) => a.time.getTime() - b.time.getTime());
    }, [events, selectedEvent, discardedEventIds]);
    const sameSpotIndex = selectedEvent ? sameSpotGroup.findIndex(e => e.id === selectedEvent.id) : -1;
    // Stega till nästa event i högen (wrap). Kameran står kvar — samma plats ändå.
    const handleSameSpotNext = () => {
        if (sameSpotGroup.length < 2) return;
        const idx = sameSpotIndex < 0 ? 0 : sameSpotIndex;
        onNavigate?.();
        onSelectEvent(sameSpotGroup[(idx + 1) % sameSpotGroup.length]);
    };

    // ── Förladda kommande event-bilder ──────────────────────────────────────
    // "Nästa" landar nästan alltid på det geografiskt närmaste icke-besökta
    // eventet. Vi simulerar de kommande hoppen (utan att röra state) och värmer
    // upp deras cover-bilder + favicon i webbläsarens cache redan medan du tittar
    // på nuvarande kort. När du sedan klickar Nästa är bilden redan nedladdad och
    // kortet visas direkt — istället för att hämta bilden on-demand.
    useEffect(() => {
        if (!selectedEvent || typeof window === 'undefined') return;

        const PRELOAD_COUNT = 4;
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        const pool = nextCandidatePool(anchor);
        const simVisited = new Set(visitedEventIds);
        let current: LinkEvent = selectedEvent;
        const upcoming: LinkEvent[] = [];

        for (let i = 0; i < PRELOAD_COUNT; i++) {
            simVisited.add(current.id);
            let next = findNearestEvent(anchor, pool, discardedEventIds, simVisited);
            if (!next) {
                // Allt besökt — börja om från ankaret (matchar pickNext-logiken).
                simVisited.clear();
                simVisited.add(anchor.id);
                simVisited.add(current.id);
                next = findNearestEvent(anchor, pool, discardedEventIds, simVisited)
                    ?? findNearestEvent(anchor, events, discardedEventIds, simVisited);
            }
            if (!next || upcoming.some(e => e.id === next!.id)) break;
            upcoming.push(next);
            current = next;
        }

        // Värm också upp de närmaste i listan (för swipe / "nära dig"-klick).
        const candidates = [...upcoming, ...nearbyEvents.slice(0, 3).map(n => n.evt)];

        const seen = new Set<string>();
        for (const evt of candidates) {
            if (seen.has(evt.id)) continue;
            seen.add(evt.id);
            if (evt.coverImage) {
                const img = new window.Image();
                img.src = evt.coverImage;
            }
            try {
                const host = new URL(evt.url).hostname;
                const fav = new window.Image();
                fav.src = `https://icons.duckduckgo.com/ip3/${host}.ico`;
            } catch { /* ogiltig URL — hoppa över favicon */ }
        }
    }, [selectedEvent?.id, anchorId, events, discardedEventIds, visitedEventIds, nearbyEvents]);

    // Kandidat-pool för "Nästa": klickade man på ett KOMMANDE event hoppar
    // Nästa aldrig till event som redan har varit — de är inte aktuella att
    // besöka. Klickade man däremot på ett event som redan HAR varit stegas
    // ALLA event igenom. Ankaret klassas mot KLICK-tidpunkten (anchorSetAtRef)
    // så regeln inte byts mitt i kedjan när klockan passerar ankarets egen
    // gräns; pool-medlemmarna filtreras däremot mot levande `now` (event som
    // hinner bli "har varit" medan man bläddrar faller bort).
    const nextCandidatePool = (anchor: LinkEvent): LinkEvent[] => {
        const anchorPast = getEventStatus(anchor.time, anchorSetAtRef.current, anchor.hasSpecificTime !== false) === 'past';
        if (anchorPast) return events;
        const isPast = (e: LinkEvent) => getEventStatus(e.time, now, e.hasSpecificTime !== false) === 'past';
        return events.filter(e => !isPast(e));
    };

    /**
     * Plocka nästa event utifrån ankaret (spiral utåt i avstånd).
     * Lägger nuvarande event i visited och letar närmaste-till-ankaret som inte är besökt.
     * När alla är besökta — nollställ visited och börja om.
     */
    const pickNext = (current: LinkEvent): LinkEvent | null => {
        const anchor = events.find(e => e.id === anchorId) ?? current;
        const pool = nextCandidatePool(anchor);

        const newVisited = new Set(visitedEventIds);
        
        // Lägg till alla event på samma koordinat till besökta så Nästa-knappen 
        // hoppar till nästa destination direkt i stället för att stega igenom 
        // varje enskilt event på samma plats.
        const currentKey = current.lat && current.lng ? `${current.lat.toFixed(4)},${current.lng.toFixed(4)}` : null;
        if (currentKey) {
            for (const e of events) {
                if (e.lat && e.lng) {
                    const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
                    if (k === currentKey) {
                        newVisited.add(e.id);
                    }
                }
            }
        } else {
            newVisited.add(current.id);
        }

        let next = findNearestEvent(anchor, pool, discardedEventIds, newVisited);
        if (!next) {
            // Allt slut — börja om från ankaret. Ankaret OCH kortet man står på
            // exkluderas (annars kan varvet "hoppa" till nuvarande kort = no-op,
            // och fallbacken nedan nås aldrig).
            newVisited.clear();
            newVisited.add(anchor.id);
            newVisited.add(current.id);
            next = findNearestEvent(anchor, pool, discardedEventIds, newVisited)
                // Degenererat läge: inga andra kommande event finns alls —
                // ta vad som finns hellre än en död Nästa-knapp.
                ?? findNearestEvent(anchor, events, discardedEventIds, newVisited);
        }
        setVisitedEventIds(newVisited);
        if (next) expectedNextIdRef.current = next.id;
        return next;
    };

    const THRESHOLD = 100; // Pixels to trigger a swipe action

    // Sätts när en press blir en riktig drag (>5px). Används för att INTE
    // navigera när man dragit i Föregående/Nästa-knappen i stället för klickat.
    const didDragRef = useRef(false);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        didDragRef.current = false;

        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('input')) {
            return;
        }

        // Firefox avfyrar pointerdown även för klick PÅ EN SCROLLBAR (Chrome
        // undertrycker dem). Utan vakten blev ett drag i den inre scrollistens
        // tumme samtidigt ett kortdrag: innehållet scrollade OCH kortet ändrade
        // höjd ("scrollen ur synk, rutan komprimeras" — Firefox/desktop-rapport
        // 6/8). Scrollbar-klick träffar det scrollbara elementet självt, i
        // gutter-zonen UTANFÖR client-ytan → släpp gesten till scrollbaren.
        if (target.scrollHeight > target.clientHeight || target.scrollWidth > target.clientWidth) {
            const r = target.getBoundingClientRect();
            if (e.clientX >= r.left + target.clientLeft + target.clientWidth
                || e.clientY >= r.top + target.clientTop + target.clientHeight) {
                return;
            }
        }

        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragDirection.current = 'none';
        startX.current = e.clientX;
        startY.current = e.clientY;
        startHeightVh.current = heightVhRef.current;
        startDragX.current = dragXRef.current;
        // Mät botten-gränsen (sträcket under tid/plats) färskt vid drag-start så
        // den är korrekt även efter att fönstret ändrat storlek.
        collapsedVhRef.current = measureCollapsedHeight();
        setExitX(null); // Reset any exit animation
        setIsAnimating(false);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

        const deltaX = e.clientX - startX.current;
        const deltaY = startY.current - e.clientY; // drag up is positive deltaY

        if (dragDirection.current === 'none') {
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);
            if (absX > 5 || absY > 5) {
                if (absY > absX) {
                    dragDirection.current = 'vertical';
                } else if (!gameMode) {
                    // I spelläget är svep åt sidan avstängt (annars skulle man råka
                    // byta/spara mål-eventet) — bara vertikal drag (storlek/stäng).
                    dragDirection.current = 'horizontal';
                }
                if (dragDirection.current !== 'none') didDragRef.current = true;
            }
        }

        if (dragDirection.current === 'vertical') {
            const deltaVh = (deltaY / window.innerHeight) * 100;
            // Fritt nedåt: under peek-gränsen fortsätter kortet glida ner mot
            // botten — släpper man tillräckligt långt ner stängs det (se
            // onPointerUp). Uppåt klampas vid MAX_HEIGHT_VH.
            const newHeight = Math.max(3, Math.min(MAX_HEIGHT_VH, startHeightVh.current + deltaVh));
            updateHeightVh(newHeight);
        } else if (dragDirection.current === 'horizontal') {
            updateDragX(startDragX.current + deltaX);
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        isDragging.current = false;
        
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }

        setIsAnimating(true);

        if (dragDirection.current === 'vertical') {
            const h = heightVhRef.current;
            const collapsed = collapsedVhRef.current;
            if (h < collapsed - DISMISS_BELOW_VH) {
                // Släppt långt under peek-gränsen → kortet glider ner och
                // stängs helt (avmarkerar eventet, precis som ett kartklick).
                updateHeightVh(2);
                if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
                dismissTimerRef.current = setTimeout(() => onSelectEvent(null), 260);
            } else if (h < collapsed) {
                // Strax under gränsen → snäpp tillbaka till peek-läget.
                updateHeightVh(collapsed);
            } else if (h > startHeightVh.current) {
                // UPPÅT-drag → snäpp ända till MAX, oavsett hur kort svepet
                // var. Det infriar löftet "ETT svep växer kortet hela vägen
                // upp och NÄSTA svep scrollar": ett släpp på t.ex. 70vh
                // lämnade annars kortet i touch-action:none-zonen (< MAX-5)
                // där svep på innehållet bara fortsatte växa/stå still —
                // långa beskrivningar gick då inte att scrolla alls.
                updateHeightVh(MAX_HEIGHT_VH);
            } else {
                // Neddrag: stanna på exakt den höjd användaren dragit till.
                updateHeightVh(h);
            }
        } else if (dragDirection.current === 'horizontal') {
            const currentDragX = dragXRef.current;
            if (currentDragX > THRESHOLD) {
                handleSwipeOut('right');
            } else if (currentDragX < -THRESHOLD) {
                handleSwipeOut('left');
            } else {
                updateDragX(0);
            }
        } else {
            // Tap utan rörelse (dragDirection === 'none') → toggla mellan öppet
            // och hopfällt. Så man kan stänga den uppfällda bilden genom att
            // klicka var som helst på kortet. Knappar/länkar ignoreras redan i
            // onPointerDown så de fortsätter fungera som vanligt. Öppning mäts så
            // bara första raden av beskrivningen visas (inte ända ner till knappen);
            // hopfällning går tillbaka till DEFAULT-höjden (header + bildremsa,
            // exakt samma som när kortet öppnas) — inte ända ner till peek-strecket,
            // som kändes som att kortet åkte för långt ner. Drag-ner-gesten kan
            // fortfarande gå hela vägen ner till peek/stängning (se ovan).
            // I chatt-/listvyn görs inget: ett tap i sektionen (t.ex. på en
            // bubbla eller mellan listraderna) ska inte fälla ihop kortet mitt
            // i läsningen.
            if (cardView === 'info') {
                updateHeightVh(heightVhRef.current > 50 ? measureDefaultHeight() : measureOpenHeight());
            }
        }

        dragDirection.current = 'none';
    };

    // Låt Föregående/Nästa-knapparna OCKSÅ dra kortet (samma vertikal/horisontell
    // gest) utan att förlora klick-funktionen. Vi återanvänder samma drag-refs och
    // kort-släpp-logik; ett rent klick (ingen rörelse) går vidare till onClick.
    const onButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        didDragRef.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragDirection.current = 'none';
        startX.current = e.clientX;
        startY.current = e.clientY;
        startHeightVh.current = heightVhRef.current;
        startDragX.current = dragXRef.current;
        collapsedVhRef.current = measureCollapsedHeight();
        setExitX(null);
        setIsAnimating(false);
    };
    const onButtonPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        onPointerMove(e as unknown as React.PointerEvent<HTMLDivElement>);
    };
    const onButtonPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (dragDirection.current === 'none') {
            // Rent klick — städa bara upp och låt onClick sköta navigeringen.
            isDragging.current = false;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
            return;
        }
        onPointerUp(e as unknown as React.PointerEvent<HTMLDivElement>);
    };

    const pushHistory = (id: string) => {
        setHistoryStack(prev => [...prev, id]);
    };

    const handleSwipeOut = (direction: 'left' | 'right') => {
        if (!selectedEvent) return;

        // Svep höger = SPARA, och gilla kräver konto sedan 22/8. Utloggad:
        // låt onSaveEvent öppna inloggningsmodalen (den äger gaten) men snäpp
        // TILLBAKA kortet — flög det ut här hade eventet försvunnit ur leken
        // utan att ha sparats, och man landat i modalen på ett tomt kort.
        if (direction === 'right' && !currentUserUid) {
            onSaveEvent(selectedEvent.id);
            updateDragX(0);
            return;
        }

        // Animate off screen
        setExitX(direction === 'right' ? window.innerWidth : -window.innerWidth);

        // Trigger save or discard state immediately
        if (direction === 'right') {
            onSaveEvent(selectedEvent.id);
        } else {
            onDiscardEvent(selectedEvent.id);
        }

        const previousId = selectedEvent.id;

        // Wait for animation, then change event
        setTimeout(() => {
            if (events.length === 0) return;

            // Svep = gren-byte: släng ev. framåt-historik och hoppa till det
            // geografiskt närmaste icke-besökta eventet.
            setForwardStack([]);
            const next = pickNext(selectedEvent);
            if (next) pushHistory(previousId);
            onNavigate?.(); // kameran ska stå kvar — vi fokuserar inte det nya eventet
            onSelectEvent(next);

            // Reset position immediately for the new card (height bevaras —
            // det här är en Nästa-navigering, inte en ny ankare).
            setExitX(null);
            updateDragX(0);
        }, 200); // 200ms matches the CSS transition
    };

    // Bakåt-knapp: gå till eventet vi tittade på innan vi gick vidare, och lägg
    // det nuvarande på framåt-stacken så Nästa kan spela upp samma ordning igen.
    const handleHistoryBack = () => {
        if (didDragRef.current) { didDragRef.current = false; return; }
        if (historyStack.length === 0 || !selectedEvent) return;
        const prevId = historyStack[historyStack.length - 1];
        const prevEvent = events.find(e => e.id === prevId);
        setHistoryStack(prev => prev.slice(0, -1));
        setForwardStack(prev => [...prev, selectedEvent.id]);
        if (prevEvent) {
            // Intern navigering → behåll ankare/besökt (markeras som "väntat").
            expectedNextIdRef.current = prevEvent.id;
            onNavigate?.(); // kameran står kvar — vi flyger inte till föregående event
            onSelectEvent(prevEvent);
        }
        setExitX(null);
        updateDragX(0);
    };

    const handleNextOnly = () => {
        if (didDragRef.current) { didDragRef.current = false; return; }
        if (!selectedEvent || events.length === 0) return;

        // Har vi backat? Spela då upp framåt-stacken i SAMMA ordning igen i
        // stället för att räkna fram ett nytt närmaste event.
        let next: LinkEvent | null = null;
        if (forwardStack.length > 0) {
            const fwdId = forwardStack[forwardStack.length - 1];
            next = events.find(e => e.id === fwdId) ?? null;
            setForwardStack(prev => prev.slice(0, -1));
            if (next) expectedNextIdRef.current = next.id; // intern navigering — behåll ankare
        }
        // Tom framåt-stack (eller eventet finns inte längre) → vanligt pickNext.
        if (!next) next = pickNext(selectedEvent);
        if (next) pushHistory(selectedEvent.id);
        onNavigate?.(); // kameran står kvar — vi fokuserar inte det nya eventet
        onSelectEvent(next);

        setExitX(null);
        updateDragX(0);
    };

    // OBS: ingen early-return när dagen saknar event — då försvann hela
    // bottenraden inkl. dagväljaren och man satt fast på en tom dag.
    // window-accessen skyddas i stället (sidan prerendras; ingen drag där).
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1000;

    // Calculate dynamic rotation based on drag
    const rotation = (dragX / vw) * 20; // Max 20 degrees rotation

    // Calculate opacity (slightly fades out at edges)
    const opacity = 1 - Math.abs(dragX / vw) * 0.5;

    // Föregående event i bakåt-stacken — visas som emoji-bricka (= bakåt-knapp)
    // till vänster om Nästa, så man ser vilket event man går TILLBAKA till.
    const backEventId = historyStack[historyStack.length - 1];
    const backEvent = backEventId ? events.find(e => e.id === backEventId) : undefined;

    // Antal event i föregående events grupp (om det var en multibricka)
    const backEventGroupCount = useMemo(() => {
        if (!backEvent || !backEvent.lat || !backEvent.lng) return 1;
        const key = `${backEvent.lat.toFixed(4)},${backEvent.lng.toFixed(4)}`;
        return events.filter(e => {
            if (!e.lat || !e.lng) return false;
            const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
            return k === key;
        }).length;
    }, [backEvent, events]);

    // Nästa event — SAMMA val som handleNextOnly gör (framåt-stacken först,
    // annars närmaste obesökta), men helt ren (inga setState/refs) så den kan
    // visas som emoji-bricka = en förhandsvisning av vart Nästa tar dig.
    const nextEvent = useMemo<LinkEvent | null>(() => {
        if (!selectedEvent || events.length === 0) return null;
        // Har vi backat? Nästa spelar upp framåt-stacken i samma ordning igen.
        if (forwardStack.length > 0) {
            const fwd = events.find(e => e.id === forwardStack[forwardStack.length - 1]);
            if (fwd) return fwd;
        }
        // Annars: samma logik som pickNext, utan sidoeffekter.
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        const pool = nextCandidatePool(anchor);
        const simVisited = new Set(visitedEventIds);
        const curKey = selectedEvent.lat && selectedEvent.lng
            ? `${selectedEvent.lat.toFixed(4)},${selectedEvent.lng.toFixed(4)}` : null;
        if (curKey) {
            for (const e of events) {
                if (e.lat && e.lng && `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` === curKey) simVisited.add(e.id);
            }
        } else {
            simVisited.add(selectedEvent.id);
        }
        let next = findNearestEvent(anchor, pool, discardedEventIds, simVisited);
        if (!next) {
            simVisited.clear();
            simVisited.add(anchor.id);
            simVisited.add(selectedEvent.id);
            next = findNearestEvent(anchor, pool, discardedEventIds, simVisited)
                ?? findNearestEvent(anchor, events, discardedEventIds, simVisited);
        }
        return next;
    }, [selectedEvent, events, forwardStack, anchorId, visitedEventIds, discardedEventIds, now]);

    // Antal event i nästa events grupp (om det är en multibricka)
    const nextEventGroupCount = useMemo(() => {
        if (!nextEvent || !nextEvent.lat || !nextEvent.lng) return 1;
        const key = `${nextEvent.lat.toFixed(4)},${nextEvent.lng.toFixed(4)}`;
        return events.filter(e => {
            if (!e.lat || !e.lng) return false;
            return `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` === key;
        }).length;
    }, [nextEvent, events]);

    return (
        <>
        {/* Nedre rad — ALLTID synlig (verktyg till vänster, Nästa till höger om kort finns) */}
        {/* z-[1250]: kortet ligger över ALLT kartkrom — kategorikolumnen (1150),
            stadsrutan (1090), navbaren (1160). Bara modaler (1300) går över. */}
        <div className="fixed bottom-0 left-0 right-0 z-[1250] flex flex-col items-center px-4 pointer-events-none" style={{ minHeight: '100vh', justifyContent: 'flex-end' }}>
            <div className="w-full max-w-4xl flex justify-between items-center mb-4">

                {/* Vänster: verktygs-pill (dagväljaren är flyttad till toppen). */}
                <div className="flex items-center gap-2 pointer-events-auto">
                    {/* Ingen separat återställ-knapp — "Idag" ligger ett tryck
                        bort i dagväljaren och tomma dagar har en "Visa idag"-länk.
                        Verktygen (sol/fokus/moln-hämtning) bor i EN gemensam pill
                        i stället för separata flytande knappar — färre element på
                        raden, samma funktioner. */}
                    {(onSunClick || onRecenter || (mainCloudOffScreen && onRecallMainCloud)) && (
                        <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-md rounded-full shadow-xl border border-white/50 p-1 h-[38px] box-border">
                            {onSunClick && (
                                <button
                                    onClick={onSunClick}
                                    className="w-[30px] h-[30px] rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors"
                                    title="Lys upp kartan"
                                    aria-label="Lys upp kartan"
                                >
                                    <Sun size={16} className="text-amber-500" />
                                </button>
                            )}
                            {onRecenter && (
                                <button
                                    type="button"
                                    onClick={onRecenter}
                                    className={`relative overflow-hidden w-[30px] h-[30px] rounded-full flex items-center justify-center transition-colors ${
                                        recenterBlink && !slingshotReady && !slingshotEngaged ? 'feature-blink-white' : ''
                                    } ${
                                        slingshotEngaged
                                            ? 'bg-[#006AA7] ring-2 ring-sky-300'
                                            : slingshotReady
                                                ? 'ring-2 ring-sky-300 animate-pulse'
                                                : 'hover:bg-slate-100'
                                    }`}
                                    title={slingshotEngaged ? 'Klicka för att avfyra slangbellan' : slingshotReady ? 'Klicka för att arma slangbellan' : 'Visa molnet på kartan'}
                                    aria-label={slingshotEngaged ? 'Avfyra slangbella' : slingshotReady ? 'Arma slangbella' : 'Visa molnet på kartan'}
                                >
                                    {/* Slangbella-mätare: fylls vit när läget är ready (steg 1).
                                        När armad (engaged) inverteras knappen istället → ikonen blir vit på blå. */}
                                    {slingshotReady && !slingshotEngaged && (
                                        <span className="absolute inset-0 bg-white rounded-full animate-in fade-in zoom-in duration-200 pointer-events-none" />
                                    )}
                                    <LocateFixed size={16} className={`relative ${slingshotEngaged ? 'text-white' : 'text-[#006AA7]'}`} />
                                </button>
                            )}
                            {mainCloudOffScreen && onRecallMainCloud && (
                                <button
                                    onClick={onRecallMainCloud}
                                    className="relative w-[30px] h-[30px] rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors animate-in fade-in zoom-in duration-200"
                                    title="Hämta tillbaka molnet"
                                    aria-label="Hämta tillbaka molnet"
                                >
                                    {recallMainBlink && (
                                        <span className="absolute inset-0 rounded-full animate-recall-pulse pointer-events-none" />
                                    )}
                                    <svg viewBox="0 0 24 24" width="16" height="16" className="relative text-sky-500" fill="currentColor">
                                        <path d="M19.36 10.04a7 7 0 0 0-13.36 1.4A4.5 4.5 0 0 0 6.5 20h12a4 4 0 0 0 .86-7.96Z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    )}
                    {/* Sol-molnet har ingen egen recall-knapp — sol-knappen hämtar
                        tillbaka det. Bara EN moln-knapp (för info-molnet). */}
                </div>

                {/* Höger: träff-räknare (flipper) + emoji + bakåt + Nästa. Emoji/bakåt
                    sitter längst till vänster i gruppen och Nästa växer (flex-1) så den
                    blir så bred som möjligt. Gruppen tar hela bredden (flex-1) bredvid
                    verktygspillen. Bakåt/Nästa döljs i spelläget — då ska man inte kunna
                    navigera bort målet. */}
                <div className="flex-1 min-w-0 ml-2 flex items-center gap-2 pointer-events-auto">
                    {pinShotHits > 0 && (
                        <div className="flex items-center gap-1.5 bg-amber-400 text-slate-900 font-black rounded-full shadow-xl border border-white/30 px-3.5 h-[38px] text-[13px] tabular-nums box-border whitespace-nowrap">
                            🎯 {pinShotHits} träff{pinShotHits === 1 ? '' : 'ar'}
                        </div>
                    )}
                    {selectedEvent && !gameMode && (
                        <>
                            {/* Föregående-knapp: ALLTID synlig längst till vänster i
                                gruppen, som motpol till Nästa. Finns historik visar den
                                föregående events emoji + bakåt-pil och tar en tillbaka;
                                är man på första eventet (inget före än) visas en dämpad
                                bakåt-pil. */}
                            <button
                                type="button"
                                onClick={handleHistoryBack}
                                onPointerDown={onButtonPointerDown}
                                onPointerMove={onButtonPointerMove}
                                onPointerUp={onButtonPointerUp}
                                onPointerCancel={onButtonPointerUp}
                                disabled={!backEvent}
                                aria-label={backEvent ? `Gå tillbaka till ${backEvent.title}` : 'Inget föregående event'}
                                title={backEvent ? `Gå tillbaka till ${backEvent.title}` : 'Inget föregående event än'}
                                className={`relative shrink-0 bg-white/30 backdrop-blur-md rounded-full shadow-xl border border-white/50 h-[38px] w-[38px] flex items-center justify-center leading-none box-border select-none transition-all ${
                                    backEvent
                                        ? 'hover:bg-white/50 hover:scale-105 active:scale-95 cursor-pointer text-xl'
                                        : 'opacity-40 cursor-not-allowed'
                                }`}
                            >
                                {backEvent ? (
                                    <>
                                        {eventEmoji(backEvent)}
                                        {/* Liten bakåt-pil så det syns att brickan tar en tillbaka. */}
                                        <span aria-hidden className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-[#006AA7] text-white border border-white flex items-center justify-center">
                                            <ArrowLeft size={10} />
                                        </span>
                                        {/* Siffra för hur många event gruppen innehåller */}
                                        {backEventGroupCount > 1 && (
                                            <span aria-hidden className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 text-white border border-white flex items-center justify-center text-[9px] font-black leading-none">
                                                {backEventGroupCount}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <ArrowLeft size={18} className="text-[#006AA7]" />
                                )}
                            </button>
                            {/* Nästa — hela flex-1-ytan är klickbar, men det SYNLIGA är
                                en solid flaggblå kapsel i högerkanten (samma gradient +
                                inre ljuskant som ANMÄL-knappen). Den genomskinliga
                                urstansade SVG-varianten TOGS BORT (Josef 21/8: "den
                                behöver synas lite mer" — kartan genom bokstäverna gjorde
                                den nästan osynlig över ljusa kvarter). Precis som
                                Föregående-knappen är den en förhandsvisning: man ser
                                vilket event man går VIDARE till (emoji + pil + antal). */}
                            <button
                                type="button"
                                onClick={handleNextOnly}
                                onPointerDown={onButtonPointerDown}
                                onPointerMove={onButtonPointerMove}
                                onPointerUp={onButtonPointerUp}
                                onPointerCancel={onButtonPointerUp}
                                aria-label={nextEvent ? `Närmaste härifrån: ${nextEvent.title}` : 'Närmaste event i närheten'}
                                title={nextEvent ? `Närmaste härifrån: ${nextEvent.title}` : 'Närmaste event i närheten'}
                                className="group/nasta relative min-w-0 h-[38px] box-border flex items-center justify-end flex-1 bg-transparent"
                            >
                                <span className="flex items-center gap-2 h-[38px] pl-4 pr-1.5 rounded-full bg-gradient-to-r from-[#0077BC] to-[#005590] text-white shadow-md shadow-sky-900/30 ring-1 ring-inset ring-white/25 transition-all group-hover/nasta:from-[#0083CE] group-hover/nasta:to-[#00619F] group-hover/nasta:shadow-lg group-active/nasta:scale-[0.97]">
                                    <span className="text-[12px] font-black uppercase tracking-widest leading-none">NÄSTA</span>
                                    {/* Emoji för nästa event + liten framåt-pil. */}
                                    {nextEvent ? (
                                        <span aria-hidden className="relative flex items-center justify-center w-8 h-8 text-lg leading-none">
                                            {eventEmoji(nextEvent)}
                                            {/* Liten framåt-pil så det syns att brickan tar en vidare. */}
                                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#006AA7] text-white border border-white flex items-center justify-center">
                                                <ArrowRight size={10} />
                                            </span>
                                            {/* Siffra för hur många event gruppen innehåller */}
                                            {nextEventGroupCount > 1 && (
                                                <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-slate-800 text-white border border-white flex items-center justify-center text-[9px] font-black leading-none">
                                                    {nextEventGroupCount}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span aria-hidden className="flex items-center justify-center w-7 h-7">
                                            <ArrowRight size={16} />
                                        </span>
                                    )}
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Draggable bottom sheet card container — visas bara när ett event är valt */}
            {selectedEvent ? (
            <div className="w-full max-w-4xl">
            <div
                className={`relative w-full max-w-4xl pointer-events-auto flex flex-col bg-card rounded-t-[2rem] shadow-[0_-12px_60px_rgba(0,0,0,0.3)] overflow-hidden border border-border/10${scrollNudgeActive ? ' scroll-nudge-anim' : ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onAnimationEnd={(e) => { if (e.animationName === 'scroll-nudge') setScrollNudgeActive(false); }}
                style={{
                    // Höjden går via --sheet-h så scroll-nudge-animationen kan
                    // växa kortet från samma basvärde (botten förblir förankrad).
                    ['--sheet-h' as string]: `${heightVh}vh`,
                    height: 'var(--sheet-h)',
                    transform: `translateX(${exitX !== null ? exitX : dragX}px) rotate(${rotation}deg)`,
                    opacity: exitX !== null ? 0 : opacity,
                    transition: isAnimating ? 'transform 200ms ease-out, opacity 200ms ease-out, height 350ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
                }}
            >
                {/* Drag-grip-zon — luftig så grip-indikatorn syns tydligt och får
                    plats. Hela zonen är grabbable och tar pekare själv (h-6 = 24px).
                    Zonen ligger nu absolute överst och är transparent för att låta
                    bilden i LinkEventCard scrolla hela vägen upp under den. */}
                <div
                    className="absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing select-none z-[45] bg-transparent"
                    style={{ touchAction: 'none' }}
                />

                {/* Absolut drag-indikator: två parallella streck för tydligare
                    "dra upp/ner"-affordance. Ligger ovanpå kortet (absolute) så den
                    inte adderar någon höjd/padding. pointer-events-none → drag går
                    rakt igenom till kortet. */}
                <div className="absolute top-2 left-0 right-0 z-40 flex flex-col items-center justify-center gap-1 pointer-events-none">
                    <div className="h-1 w-10 rounded-full bg-slate-400/90 dark:bg-slate-500/90" />
                    <div className="h-1 w-10 rounded-full bg-slate-400/90 dark:bg-slate-500/90" />
                </div>

                {/* Visual feedback overlays during drag (Tinder swipe overlays) */}
                {dragX > 20 && (
                    <div className="absolute top-16 left-6 z-50 bg-green-500 text-white font-bold text-lg px-4 py-1.5 rounded-xl border border-green-400/60 transform -rotate-12 shadow-lg pointer-events-none" style={{ opacity: Math.min(0.9, dragX / 120) }}>
                        SPARA
                    </div>
                )}
                {dragX < -20 && (
                    <div className="absolute top-16 right-6 z-50 bg-slate-700 text-white font-bold text-lg px-4 py-1.5 rounded-xl border border-slate-600/60 transform rotate-12 shadow-lg pointer-events-none" style={{ opacity: Math.min(0.9, Math.abs(dragX) / 120) }}>
                        NÄSTA
                    </div>
                )}

                {/* Scrollable content container */}
                <div
                    ref={scrollContainerRef}
                    className="flex-1 w-full overflow-y-auto overscroll-none bg-card custom-scrollbar"
                    style={{
                        // Innehållet scrollar FÖRST när kortet vuxit till nästan
                        // helskärm (≥90vh). Under det tar kortets drag-handler
                        // gesten → hela behållaren åker upp/ner i stället för att
                        // scrolla innehållet. touch-action låses vid gest-start,
                        // så ETT svep växer kortet hela vägen upp och NÄSTA svep
                        // scrollar den nedre delen.
                        touchAction: heightVh < MAX_HEIGHT_VH - 5 ? 'none' : 'pan-y'
                    }}
                >
                    <LinkEventCard
                        linkEvent={selectedEvent}
                        isAdmin={false}
                        distance={distanceFromUserKm}
                        showFullAddress
                        // Djuplänksöppningen (helskärm) startar med ALLT uppfällt —
                        // ett 100vh-kort med bara headern vore mest tomyta. Läses
                        // vid mount; nonce-förbrukningen (ref-skrivningen) sker i
                        // ankar-effekten ovan.
                        initialRevealStep={fullOpenNonce > consumedFullOpenNonceRef.current ? 2 : 0}
                        groupIndex={sameSpotIndex < 0 ? 0 : sameSpotIndex}
                        groupTotal={sameSpotGroup.length}
                        onGroupNext={handleSameSpotNext}
                        onRevealStepChange={(step) => {
                            setCardRevealStep(step);
                            // Steg 1 (bild + trunkad beskr): öppna till första beskrivningsraden
                            // Steg 2 (allt): behåll användarens höjd eller öppna fullt.
                            // Endast vid en färsk öppning (från stängt/dragit ner), inte vid byte av event.
                            if (step >= 1 && isFreshOpenRef.current && heightVhRef.current < 50) {
                                setIsAnimating(true);
                                requestAnimationFrame(() => updateHeightVh(measureOpenHeight()));
                            }
                        }}
                        saved={savedEventIds?.has(selectedEvent.id) ?? false}
                        onToggleSave={savedEventIds && onUnsaveEvent
                            ? () => (savedEventIds.has(selectedEvent.id)
                                ? onUnsaveEvent(selectedEvent.id)
                                : onSaveEvent(selectedEvent.id))
                            : undefined}
                        // Sitt eget event — eller ett tips som lämnats utan konto.
                        // Anonyma tips saknar ägare som kan städa upp efter sig,
                        // så vem som helst får plocka bort dem om någon spammar.
                        canDelete={!!(selectedEvent.userCreated
                            && (selectedEvent.anonTip
                                || (currentUserUid && selectedEvent.hostUid === currentUserUid)))}
                        onDeleteOwn={onDeleteOwnEvent ? () => onDeleteOwnEvent(selectedEvent.id) : undefined}
                        // Boost: alla inloggade får boosta ALLA event — användarskapade
                        // (5/8) OCH skrapade (18/8: featuredUntil för skrapade bor i
                        // eventBoosts-overlayn, se createBoostCheckout/boostTargetRef).
                        // Nivån väljs i kortets BoostTierPicker (ägs av BOOST_TIERS).
                        onBoost={onBoostOwnEvent ? (tier) => onBoostOwnEvent(selectedEvent.id, tier) : undefined}
                        // Chatt-knappen i knappraden BORTTAGEN (Josef 21/8) —
                        // chatten nås genom att scrolla ner i kortet, den
                        // ligger direkt under eventinfon. Lista-toggeln bara
                        // när närhetslistan har innehåll.
                        activityView={false}
                        nearbyView={cardView === 'nearby'}
                        onToggleNearbyView={nearbyEvents.length > 0 ? () => handleToggleView('nearby') : undefined}
                        hasStar={starredEventIds?.has(selectedEvent.id) ?? false}
                        // Passerade event kan inte stjärnmärkas — stjärnan vore
                        // förbrukad direkt (den lyser bara tills eventet varit).
                        canPlaceStar={canPlaceStar && !isEventPast(selectedEvent, Date.now())}
                        onPlaceStar={onPlaceStar ? () => onPlaceStar(selectedEvent.id) : undefined}
                    />
                    {/* Chatt per event — alla kan läsa, skriva kräver konto.
                        (Livebilder-panelen borttagen 5/8 på ägarens beslut.)
                        Döljs i listvyn så närhetslistan hamnar direkt under
                        headern. */}
                    {onRequireLogin && cardView !== 'nearby' && (
                        <div className="px-4 md:px-6 pb-4 flex flex-col gap-3">
                            <EventChatPanel eventId={selectedEvent.id} eventTitle={selectedEvent.title} onRequireLogin={onRequireLogin} />
                        </div>
                    )}
                    {/* Direkt till närhetslistan — "Tips för dig"-sektionen togs
                        bort 2026-07-13 (ägarbeslut: onödig, folk vill se Fler
                        event i närheten direkt när de scrollar). Döljs i
                        chatt-vyn (som visar bara header + chatt); i listvyn
                        hamnar den i stället direkt under headern. */}
                    {cardView !== 'chat' && nearbyEvents.length > 0 && (
                        <NearbyEventsList
                            upcomingItems={listedUpcoming.slice(0, nearbyVisibleCount)}
                            upcomingTotal={listedUpcoming.length}
                            pastItems={listedPast}
                            now={now}
                            onSelect={evt => onSelectEvent(evt)}
                            onLoadMore={() => setNearbyVisibleCount(c => c + NEARBY_PAGE_SIZE)}
                            coachMarkerRef={coachMarkerRef}
                            imagesOnly={imagesOnlyList}
                            showImages={showImages}
                            onToggleImages={toggleImages}
                        />
                    )}
                </div>

                {/* Scroll-coach: "scrolla ner"-pilen visas DIREKT när ett kort är
                    öppet (både nudge- och hint-fasen — ägarbeslut 2026-07-29:
                    bannern ska synas från början, inte först efter första
                    scrollen). Släcks när man scrollat ner till närhetslistan och
                    sett ≥4 event — engångs, aldrig igen när man klarat det en
                    gång. 25/8: samma guldkant + skimmer som "Evenemang stad för
                    stad"-knappen, och KLICKBAR — trycket scrollar direkt ner
                    till närhetslistan (coach-markören, vilket också släcker
                    coachen via observern). Wrappern är pointer-events-none så
                    ytan runt pillen inte fångar scroll/tap.
                    Bara i infovyn — i listvyn ÄR man redan i närhetslistan och
                    i chatt-vyn finns ingen lista att scrolla till. */}
                {coachStage !== 'off' && cardView === 'info' && (
                    <div className="absolute inset-x-0 bottom-4 z-[60] flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <button
                            type="button"
                            onClick={() => coachMarkerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            className="city-cta gold-glow-pulse pointer-events-auto relative overflow-hidden flex items-center gap-2 rounded-full bg-gradient-to-r from-[#006AA7] via-[#005590] to-[#003C66] border-2 border-[#FECC02] text-white text-xs font-black px-4 py-2 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                            <span>Scrolla ner — fler event i närheten</span>
                            <ChevronDown size={15} className="animate-bounce text-[#FECC02]" />
                        </button>
                    </div>
                )}
            </div>
            </div>
            ) : (
                /* Håll reglaget på 30% höjd från botten när inget kort visas.
                   Innan datan laddats → "Laddar event…" (det vore fel att påstå
                   att dagen är tom när vi inte vet än). Tom dag/period därefter
                   → liten hint så man inte tror att appen är trasig. */
                <div style={{ height: '30vh' }} className="w-full flex-shrink-0 flex items-start justify-center pointer-events-none">
                    {!eventsLoaded ? (
                        /* "Laddar event…" centreras mitt på skärmen (egen fixed-
                           overlay som bryter sig ur botten-arket) — 30vh-spacern
                           ovan står kvar så reglagets layout är oförändrad. */
                        <div className="fixed inset-0 z-[1250] flex items-center justify-center pointer-events-none">
                            <div role="status" className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 px-5 py-3 flex items-center gap-2.5 animate-in fade-in zoom-in duration-300">
                                <span className="w-4 h-4 rounded-full border-2 border-[#006AA7] border-t-transparent animate-spin shrink-0" aria-hidden />
                                <p className="text-sm font-bold text-slate-700">Laddar event…</p>
                            </div>
                        </div>
                    ) : (eventsSettled && events.length === 0) && (
                        <div role="status" className="pointer-events-auto bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 px-5 py-3 flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="text-sm font-bold text-slate-700">
                                Inga event {dayRangeDays > 1 ? 'den här perioden' : 'den här dagen'} 😴
                            </p>
                            {(dayOffset !== 0 || dayRangeDays !== 1) && (
                                <button
                                    type="button"
                                    onClick={() => onDayRangeChange(0, 1)}
                                    className="text-xs font-black uppercase tracking-widest text-[#006AA7] hover:text-[#005590] transition-colors"
                                >
                                    Visa idag
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
        </>
    );
}
