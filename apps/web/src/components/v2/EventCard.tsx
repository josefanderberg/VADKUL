'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, Fragment } from 'react';
import { isVadkulHostedEvent, LinkEvent } from '../../types';
import { normalizePriceLabel } from '../../utils/priceLabel';
import { dupKey, groupListDuplicates } from '../../utils/groupDups';
import { NO_TIME_PAST_HOUR, isEventPast } from './v2MapBricka';
import { type BoostTier } from '../../services/boostService';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import LinkEventCard from '../ui/LinkEventCard';
import EventChatPanel from './EventChatPanel';
import EventCardGroupList from './EventCardGroupList';
import { chooserDefaultTargetPx } from '@/utils/chooserSheetHeight';
import { sheetStops, nextStopAbove, nextStopBelow, snapUp, snapDown } from '@/utils/sheetSnap';
import { ArrowRight, ArrowLeft, ChevronRight, ChevronDown, CalendarDays, MapPin, Sun, LocateFixed, Clock, Ticket, Users, Image as ImageIcon, ImageOff } from 'lucide-react';

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

/** En rad i närhetslistan: eventet + ev. dagens dubbletter — samma titel
 *  ELLER omslagsbild under samma dag (grupperat i EventCard via
 *  utils/groupDups, samma regel som stadssidornas daglista, Josef 1/9).
 *  Dubbletterna radas upp bakom radens utfällning (NearbyDupList). */
type NearbyItem = {
    evt: LinkEvent;
    distanceKm: number | null;
    dups?: { evt: LinkEvent; distanceKm: number | null }[];
};

interface NearbyEventsListProps {
    /** Kommande (ej passerade) RADER (grupperade), redan sliced till synligt antal. */
    upcomingItems: NearbyItem[];
    /** Totalt antal RADER — pagineringens "Visa fler"-gräns. */
    upcomingTotal: number;
    /** Totalt antal EVENT (rader + deras dubbletter) — rubrikens siffra. */
    upcomingCount: number;
    /** Rader som redan varit — visas under en hopfällbar flik. */
    pastItems: NearbyItem[];
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
        <div ref={holderRef} className={`overflow-hidden bg-slate-200 dark:bg-zinc-800 ${className ?? ''}`}>
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

/** "kl 10:30" för utfällningens variantrader — bara för event med klockslag. */
const dupClock = (evt: LinkEvent): string | null =>
    evt.hasSpecificTime !== false
        ? new Date(evt.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
        : null;

// Utfällningen på en GRUPPRAD i närhetslistan — samma mönster som stads-
// sidornas DupList: bara det som skiljer sig (titeln när den avviker från
// radens, tid, plats). Variantklick väljer eventet precis som radklicket.
// Ligger UTANFÖR radens knapp (klick ska fälla ut, inte välja).
function NearbyDupList({ dups, repTitle, onSelect, className }: {
    dups: NonNullable<NearbyItem['dups']>;
    repTitle: string;
    onSelect: (evt: LinkEvent) => void;
    className?: string;
}) {
    const repKey = dupKey(repTitle);
    return (
        <details className={`group/dups ${className ?? ''}`}>
            <summary className="inline-flex items-center gap-1 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[11px] font-black text-[#006AA7] dark:text-sky-400 hover:underline">
                <ChevronDown size={12} strokeWidth={3} className="transition-transform group-open/dups:rotate-180" aria-hidden />
                {dups.length === 1 ? '+1 tillfälle till' : `+${dups.length} fler tider & platser`}
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-slate-200 dark:border-zinc-800 pl-3">
                {dups.map(d => {
                    const clock = dupClock(d.evt);
                    return (
                        <li key={d.evt.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(d.evt)}
                                className="flex items-center gap-x-2 max-w-full text-left text-[11px] font-bold text-slate-500 dark:text-zinc-400 hover:text-[#006AA7] dark:hover:text-sky-400 transition-colors"
                            >
                                {dupKey(d.evt.title) !== repKey && (
                                    <span className="min-w-0 shrink truncate font-black text-slate-700 dark:text-zinc-300">{d.evt.title}</span>
                                )}
                                {clock && <span className="shrink-0 tabular-nums">kl {clock}</span>}
                                <span className="min-w-0 shrink truncate">{d.evt.locationName}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </details>
    );
}

function NearbyRow({ evt, distanceKm, now, onSelect, showImages = true, hideWithoutImage = false, dups }: {
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
    /** Dagens dubbletter (se NearbyItem) — ger ×N-brickan + utfällningen. */
    dups?: NearbyItem['dups'];
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
        <div className="flex items-center gap-x-2 text-[11px] font-bold text-slate-500 dark:text-zinc-400 overflow-hidden">
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
                    className="w-full text-left hover:bg-white dark:hover:bg-zinc-800/60 transition-colors"
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
                            {dups && dups.length > 0 && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-[10px] font-black text-white tabular-nums" title={`${dups.length + 1} tillfällen`}>
                                    ×{dups.length + 1}
                                </span>
                            )}
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
                {dups && dups.length > 0 && (
                    <NearbyDupList dups={dups} repTitle={evt.title} onSelect={onSelect} className="px-4 md:px-6 pb-2.5 -mt-0.5" />
                )}
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
                className="w-full text-left px-4 md:px-6 py-2.5 flex items-center gap-3 hover:bg-white dark:hover:bg-zinc-800/60 transition-colors"
            >
                <span
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-lg leading-none ${
                        isVadkulHostedEvent(evt)
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-400/80'
                            : 'bg-slate-100 dark:bg-zinc-800'
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
                        {dups && dups.length > 0 && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 tabular-nums" title={`${dups.length + 1} tillfällen`}>
                                ×{dups.length + 1}
                            </span>
                        )}
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
            {dups && dups.length > 0 && (
                <NearbyDupList dups={dups} repTitle={evt.title} onSelect={onSelect} className="pl-16 pr-4 md:pl-[4.5rem] md:pr-6 pb-2.5 -mt-1" />
            )}
        </li>
    );
}

function NearbyEventsList({ upcomingItems, upcomingTotal, upcomingCount, pastItems, now, onSelect, onLoadMore, coachMarkerRef, imagesOnly = false, showImages, onToggleImages }: NearbyEventsListProps) {
    const [showPast, setShowPast] = useState(false);
    // I bildflödes-läget (imagesOnly) ignoreras valet — bilderna är PÅ.
    const effectiveShowImages = imagesOnly || showImages;
    // Ankaret sätts efter det 4:e eventet (0-indexerat: 3) — eller sista raden
    // om listan är kortare — så "ser minst 4"-villkoret blir sant först när man
    // scrollat ända ner hit.
    const markerIdx = Math.min(3, upcomingItems.length - 1);
    return (
        <div className="w-full bg-slate-50 dark:bg-zinc-900/40 border-t border-border">
            <div className="px-4 md:px-6 py-3 sticky top-0 bg-slate-50/95 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-border z-10 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Fler event i närheten · {upcomingCount}
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
                                : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
                        }`}
                    >
                        {showImages ? <ImageIcon size={12} /> : <ImageOff size={12} />}
                        Bilder
                    </button>
                )}
            </div>

            <ul className="divide-y divide-border">
                {upcomingItems.map(({ evt, distanceKm, dups }, i) => (
                    <Fragment key={evt.id}>
                        <NearbyRow evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} dups={dups} />
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
                        className="w-full px-4 md:px-6 py-3 flex items-center justify-between text-left hover:bg-white dark:hover:bg-zinc-800/60 transition-colors"
                        aria-expanded={showPast}
                    >
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Har varit · {pastItems.reduce((sum, it) => sum + 1 + (it.dups?.length ?? 0), 0)}
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-slate-400 transition-transform duration-200 ${showPast ? 'rotate-180' : ''}`}
                        />
                    </button>
                    {showPast && (
                        <ul className="divide-y divide-border opacity-70">
                            {pastItems.map(({ evt, distanceKm, dups }) => (
                                <NearbyRow key={evt.id} evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} dups={dups} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

/** En post i kortets bakåt-/framåthistorik: eventet OCH dagen det låg på,
 *  så Bakåt/Nästa kan ta en över ett dagbyte (Josef 2/9: "klickar man på
 *  Nästa så man byter dag ska man kunna klicka på tillbaka-knappen igen").
 *  Eventobjektet sparas hellre än bara id:t — en annan dags event finns
 *  inte i `events` (dagens lista) och behövs ändå för emoji-förhandsvisningen. */
type NavEntry = { evt: LinkEvent; dayOffset: number };

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
    /** VÄLJARLÄGET (Josef 31/8 — ersätter multi-event-listan som svävade över
     *  kartan): klickade man en bricka med FLERA event skickar kartan upp
     *  gruppen hit, och kortets INNEHÅLL byts ut mot en väljarlista
     *  (EventCardGroupList) tills man valt. null/tom = vanligt kortinnehåll. */
    groupChoice?: LinkEvent[] | null;
    /** Radklicket i väljarlistan — sidan väljer eventet OCH nollar groupChoice
     *  så kortet går över till vanligt innehåll. */
    onPickFromGroup?: (evt: LinkEvent) => void;
    /** ETT STEG TILLBAKA till multievent-listan man valde ur (Josef 1/9).
     *  Sätts av sidan bara när det FINNS en grupp att gå tillbaka till och
     *  listan inte redan visas — undefined = ingen pil i kortets header. */
    onBackToGroup?: () => void;
    /** Antal event i den gruppen — bara för pilens title/aria ("tillbaka till
     *  de 5 eventen här"), inte för någon logik. */
    backToGroupCount?: number;
    /** Framåt-navigering (Nästa-knappen/svepet) som landar på en plats med
     *  FLERA event öppnar väljarlistan där också (Josef 31/8: "kommer man
     *  till ett multi-event ska listan dyka upp så man får välja") — samma
     *  handleSelectGroup som kartans multibrick-klick (grupp + rep sätts
     *  atomiskt). Bakåt-knappen väljer direkt som förut — dit man backar har
     *  man redan valt. */
    onSelectGroup?: (group: LinkEvent[], rep: LinkEvent) => void;
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
    /** "I BILD"-VAKTEN (Josef 2/9: "kartan ska aldrig hoppa iväg"): Nästa och
     *  svepet väljer bara bland event som SYNS på skärmen — inom kartrutan
     *  och ovanför kortet. Sidan äger kartrutan (utils/viewportTour), kortet
     *  får bara predikatet. Utelämnad = alla event räknas som i bild. */
    inView?: (evt: LinkEvent) => boolean;
    /** Nästa dag (offset) som HAR event i bild, eller null när inget mer
     *  finns inom datahorisonten. Är eventen i bild genomgångna går Nästa
     *  dit i stället för att börja om — knappen visar dagens namn som
     *  förhandsvisning; null släcker knappen. */
    nextDayOffset?: number | null;
    /** Stega dagen (delta i dagar) — dagväljarens pilhandler, så landnings-
     *  pulsen tystas på samma sätt som vid ett manuellt dagsteg. Med
     *  `selectEventId` ska sidan landa på JUST det eventet (Bakåt/Nästa över
     *  ett dagbyte); utan väljer den närmast kartans mitt bland dem i bild. */
    onDayStep?: (delta: number, selectEventId?: string) => void;
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

export default function EventCard({ events, dayCount, eventsLoaded = true, eventsSettled = true, selectedEvent, onSelectEvent, groupChoice = null, onPickFromGroup, onBackToGroup, backToGroupCount = 0, onSelectGroup, onSaveEvent, onDiscardEvent, discardedEventIds, savedEventIds, userPos, onUnsaveEvent, onCardExpandedChange, onNavigate, pinShotHits = 0, dayOffset, dayRangeDays = 1, onDayRangeChange, inView, nextDayOffset = null, onDayStep, onSunClick, mainCloudOffScreen, sunCloudOffScreen, onRecallMainCloud, onRecallSunCloud, recallMainBlink, onRecenter, recenterBlink, slingshotReady, slingshotEngaged, gameMode = false, onRequireLogin, currentUserUid, onDeleteOwnEvent, onBoostOwnEvent, starredEventIds, canPlaceStar = false, onPlaceStar, fullOpenNonce = 0 }: EventCardProps) {
    // Peek-höjd när kortet öppnas från stängt läge eller när användaren väljer
    // ett nytt ankar-event på kartan. Navigering med Nästa/Föregående bevarar
    // den höjd användaren själv dragit till.
    const PEEK_HEIGHT_VH = 22;
    // Hur snabbt HJULET ändrar kortets höjd (1 = rått 1:1 px→vh). Gäller bara
    // hjul/styrplatta, aldrig fingerdrag — se onWheel.
    const SHEET_WHEEL_GAIN = 1.8;
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
    // Minsta nedåtdrag (i vh) för att ett släpp ska räknas som ett medvetet
    // "scrolla ner"-snäpp (helskärm → default, default → stängt; se
    // onPointerUp) — kortare ryck studsar tillbaka dit gesten började.
    const SNAP_PULL_MIN_VH = 6;
    // Kortets TAK: hur högt det får växa. INTE hela vägen upp längre (Josef
    // 31/8, ersätter 26/8-beslutet "kortet ska kunna fylla skärmen"): NÄSTA-
    // knappen, som ligger på raden ovanför kortet, ska hamna i LINJE MED
    // SÖKKNAPPEN i navbaren.
    //
    // Räkningen: navbaren sitter på top-6 (24 px) och sökknappen är dess
    // första element (h-10) → dess överkant ligger 24 px ner. Knappraden över
    // kortet är 38 px hög (verktygspillen/Nästa är h-[38px]) och har mb-4
    // (16 px) ner till kortet. Kortets överkant måste alltså stanna
    // 24 + 38 + 16 = 78 px under skärmtoppen, så raden hamnar på 24 px.
    const CARD_TOP_GAP_PX = 78;
    // Taket måste räknas i px och översättas till vh — en fast vh-siffra
    // träffar bara EN skärmhöjd (78 px är ~10 vh på mobil men ~7 vh på en hög
    // desktopskärm). Samma px→vh-omräkning som mät-hjälparna nedan gör.
    const [viewportH, setViewportH] = useState(0);
    useEffect(() => {
        const read = () => setViewportH(window.innerHeight);
        read();
        window.addEventListener('resize', read);
        return () => window.removeEventListener('resize', read);
    }, []);
    // 90 tills vi mätt (SSR + första målningen) — nära nog på en vanlig telefon
    // och rättas i samma andetag av effekten ovan.
    const MAX_HEIGHT_VH = viewportH ? 100 - (CARD_TOP_GAP_PX / viewportH) * 100 : 90;
    // Hjul-lyssnaren registreras en gång per öppnat kort ([hasSelectedEvent])
    // och skulle annars frysa taket från den renderingen — läs det via ref.
    const maxVhRef = useRef(MAX_HEIGHT_VH);
    maxVhRef.current = MAX_HEIGHT_VH;
    // Djuplänksöppningen (?event= från stadssidorna): INTE hela skärmen —
    // en kartremsa ska synas ovanför så man ser att man landat på kartan
    // (Josef 30/8). Användaren kan själv dra upp till MAX_HEIGHT_VH.
    const DEEPLINK_HEIGHT_VH = 80;
    // VÄLJARLISTANS öppningshöjd (Josef 2/9: "multieventet blir inte alls lika
    // högt"). Listan saknar data-peek-boundary och föll ner på peek-höjden
    // 22 vh. Det vanliga kortet öppnar på header + 60 px bildremsa ≈ 285 px
    // (mobil; 291 px på md): pt-10 40 + knapprad 40 + titelrad 57 + tidsrad 36
    // + Värd/Pris 52 + 60. Listan visar så många HELA rader som ryms inom
    // budgeten (3 rader i dagsläget, dagrubrik + 2 rader i veckovyn — se
    // chooserDefaultTargetPx) — ingen halv rad i vikningen, samma korthöjd.
    const CHOOSER_DEFAULT_MAX_PX = 300;

    // VÄLJARLÄGET (Josef 31/8): en multi-brickas grupp har skickats upp och
    // inget val är gjort än — kortets innehåll är väljarlistan i stället för
    // eventet (sidan nollar groupChoice vid valet/när valet lämnar gruppen).
    const chooserActive = !!(groupChoice && groupChoice.length > 1 && onPickFromGroup);
    // Hjul-/touch-lyssnarna registreras en gång per öppnat kort
    // ([hasSelectedEvent]) och pekar-handlers avgör i händelseögonblicket —
    // läs läget via ref så de aldrig ser en gammal rendering. Speglas i en
    // layout-effekt (före paint) i stället för under render, så en avbruten
    // transition-rendering aldrig hinner skriva ett läge som inte committas.
    const chooserActiveRef = useRef(chooserActive);
    useLayoutEffect(() => { chooserActiveRef.current = chooserActive; }, [chooserActive]);

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
    // heightVh (state) är bara RENDER-TRIGGER + tröskelvakt (cardExpanded).
    // heightVhRef är SANNINGEN och läses direkt i style-objektet — så en render
    // som råkar ske mitt i en gest aldrig skriver tillbaka ett gammalt värde.
    const [heightVh, setHeightVh] = useState(PEEK_HEIGHT_VH);
    // grip-zonen (h-6 = 24px) ovanför scroll-containern.
    const heightVhRef = useRef(PEEK_HEIGHT_VH);
    const sheetRef = useRef<HTMLDivElement | null>(null);
    /**
     * live = mitt i en pågående gest (hjul/drag). Då skrivs höjden DIREKT till
     * DOM via --sheet-h i stället för via setState (Josef 31/8: "det känns
     * sticky"). En setState per wheel-tick renderade om HELA kortet —
     * närhetslistan med bilder, chatten, allt — 60–120 gånger i sekunden, och
     * det var motståndet man kände: innehållsscrollen går på kompositor-tråden
     * medan kortets höjd fick betala en full React-render per pixel.
     * Vid gestens slut committas värdet med setHeightVh (commitHeight) så
     * cardExpanded-tröskeln och resten av React ser samma sanning.
     */
    const updateHeightVh = (vh: number, live = false) => {
        heightVhRef.current = vh;
        if (live) {
            sheetRef.current?.style.setProperty('--sheet-h', `${vh}vh`);
            return;
        }
        setHeightVh(vh);
    };
    // (Efterhandssynken för hjulet — commitHeightSoon, 140 ms efter tystnad —
    //  är borta sedan 2/9: hjulet snäpper stopp för stopp via setState och
    //  har ingen live-fas längre. Bara fingerdraget skriver live, och det
    //  committar i onPointerUp.)


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
    const [historyStack, setHistoryStack] = useState<NavEntry[]>([]);
    // Framåt-stack: event vi backat ur. Nästa spelar upp dem i samma ordning igen
    // (som webbläsarens framåt-knapp) i stället för att räkna fram ett nytt event.
    const [forwardStack, setForwardStack] = useState<NavEntry[]>([]);

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
    // ARMERAT DAGBYTE (Josef 2/9): Nästa/Bakåt har just bett sidan byta dag,
    // och nästa "externa" val är LANDNINGEN på den dagen — inte ett kart-
    // klick. Ankar-effekten ser då att dagen bytt sedan armeringen och låter
    // bakåt-/framåtstackarna stå kvar (ny dag = ny runda: ankare + besökt
    // nollas ändå). Tidsfönstret skyddar mot att en landning som aldrig kom
    // (sidan valde samma event) armerar ett riktigt kartklick långt senare.
    const dayStepRef = useRef<{ fromOffset: number; armedAt: number } | null>(null);
    const DAY_STEP_LANDING_MS = 3000;
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
        // VÄLJARLISTAN (multievent): ingen peek-markör — mät radernas under-
        // kanter och ta så många hela rader som ryms i CHOOSER_DEFAULT_MAX_PX,
        // så kortet öppnar lika högt som ett vanligt event (Josef 2/9).
        const groupList = sc.querySelector('[data-group-list]') as HTMLElement | null;
        if (groupList) {
            const scRect = sc.getBoundingClientRect();
            // Innehållets topp i viewport-koordinater (oberoende av scroll).
            const contentTop = scRect.top - sc.scrollTop;
            const rowBottoms = Array.from(sc.querySelectorAll<HTMLElement>('[data-group-row]'))
                .map(row => row.getBoundingClientRect().bottom - contentTop);
            const contentHeight = groupList.getBoundingClientRect().bottom - contentTop;
            const targetPx = chooserDefaultTargetPx(rowBottoms, contentHeight, CHOOSER_DEFAULT_MAX_PX);
            const vh = (targetPx / window.innerHeight) * 100;
            return Math.max(PEEK_HEIGHT_VH, Math.min(80, Math.round(vh)));
        }
        const peek = sc.querySelector('[data-peek-boundary]') as HTMLElement | null;
        if (!peek) return measureCollapsedHeight();
        const scRect = sc.getBoundingClientRect();
        const peekRect = peek.getBoundingClientRect();
        const targetPx = (peekRect.bottom - scRect.top) + sc.scrollTop + 60;
        const vh = (targetPx / window.innerHeight) * 100;
        return Math.max(PEEK_HEIGHT_VH, Math.min(80, Math.round(vh)));
    };
    // ── Kortets STOPP (Josef 2/9: "två nya sticky-positioner") ─────────────
    // Default-höjden (header + bildremsa), TAPP-HÖJDEN (bild + första
    // beskrivningsraden — "täcker typ halva skärmen") och TAKET. Hjul och drag
    // stannar på dem i tur och ordning, och först på taket scrollar innehållet
    // (touch-action pan-y / hjulets fallthrough). Nedåt samma stopp baklänges,
    // sist stängs kortet. Mäts färskt per gest — bild- och headerhöjd varierar.
    // Väljarlistan har ingen tapp-höjd (ingen beskrivning att mäta mot).
    // Toleransen: ett läge inom 4 vh från ett stopp räknas som "på" det.
    const SNAP_TOLERANCE_VH = 4;
    const sheetStopsNow = (): number[] => sheetStops([
        measureDefaultHeight(),
        ...(chooserActiveRef.current ? [] : [measureOpenHeight()]),
        maxVhRef.current,
    ], SNAP_TOLERANCE_VH);
    // Live-ref så drag-handlern (onPointerMove) alltid läser senaste mätta
    // botten-gränsen utan att bindas om. Default = konstanten tills vi mätt.
    const collapsedVhRef = useRef(COLLAPSED_HEIGHT_VH);
    // Timer för stängningsanimationen (drag-ner-förbi-peek → glid ner → stäng).
    const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); }, []);

    /** Stäng kortet helt: glid ner + avmarkera eventet. Delas av drag-ner-
     *  släppet och hjul-snäppet — samma glid, samma 260 ms. */
    const closeCard = () => {
        updateHeightVh(2);
        if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = setTimeout(() => onSelectEvent(null), 260);
    };
    // Hjul-lyssnaren registreras en gång per öppnat kort och skulle annars
    // stänga mot den renderingens onSelectEvent — läs via ref.
    const closeCardRef = useRef(closeCard);
    closeCardRef.current = closeCard;

    // ── Hjul-snäppets gest-grind (se onWheel) ───────────────────────────────
    // Spänd = nästa svep får utföra ETT snäpp: uppåt ett stopp upp (default →
    // tapp-höjden → taket, Josef 2/9), nedåt vid innehållstoppen ett stopp ner
    // (sist stängs kortet). En styrplattas tröghetssvans sprutar wheel-
    // händelser långt efter själva svepet — utan grinden faller ETT svep
    // genom alla stopp. Grinden återspänns när hjulet varit tyst
    // WHEEL_SNAP_QUIET_MS. wheelHoldAtMaxRef: precis snäppt till TAKET — då
    // sväljs resten av samma gest så innehållet inte börjar scrolla förrän
    // nästa gest ("stanna innan vi börjar scrolla inom själva kortet").
    const wheelSnapArmedRef = useRef(true);
    const wheelHoldAtMaxRef = useRef(false);
    const wheelRearmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const WHEEL_SNAP_QUIET_MS = 350;
    const scheduleWheelRearm = () => {
        if (wheelRearmTimerRef.current) clearTimeout(wheelRearmTimerRef.current);
        wheelRearmTimerRef.current = setTimeout(() => {
            wheelSnapArmedRef.current = true;
            wheelHoldAtMaxRef.current = false;
        }, WHEEL_SNAP_QUIET_MS);
    };
    useEffect(() => () => { if (wheelRearmTimerRef.current) clearTimeout(wheelRearmTimerRef.current); }, []);
    // NY-GEST-DETEKTORN (Josef 2/9: "direkt efter ett stopp går det inte att
    // scrolla — man måste flytta pekaren först"). Styrplattans tröghetssvans
    // rullar i upp till ~1,5 s efter ett svep, och varje händelse sköt upp
    // återspänningen — ett NYTT svep som började medan svansen ännu rullade
    // smälte ihop med den och svaldes. (Att röra pekaren = röra plattan =
    // svansen dör → 350 ms tystnad → grinden spänns; därav "flytta musen".)
    // Svansen avtar monotont: ett nytt svep syns som ett HOPP i storlek
    // (> WHEEL_NEW_GESTURE_GAIN × förra händelsen) eller ett riktningsbyte,
    // och återspänner då grinden direkt. Hoppet räknas först efter
    // WHEEL_SNAP_COOLDOWN_MS från senaste snäpp — fingerfasen av SAMMA svep
    // växer också och ska inte kedja två stopp. Riktningsbyte gäller alltid.
    const wheelTrackRef = useRef({ lastAbs: 0, lastSign: 0, snappedAt: 0 });
    const WHEEL_SNAP_COOLDOWN_MS = 400;
    const WHEEL_NEW_GESTURE_GAIN = 1.5;
    /** Ett snäpp utfört: lås grinden, notera tidpunkten, boka återspänning. */
    const consumeWheelGate = () => {
        wheelSnapArmedRef.current = false;
        wheelTrackRef.current.snappedAt = performance.now();
        scheduleWheelRearm();
    };

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
        let touchStartY = 0;
        const onTouchStart = (e: TouchEvent) => {
            // BARA textfälten lämnas åt webbläsaren (markera text, flytta
            // markören) — knappar/länkar är DRAGYTA, samma filosofi som
            // onPointerDown (Josef 31/8). 'button' låg tidigare i exkluderingen
            // och då fanns i väljarlistan (enbart knapprader) ingen yta alls
            // att dra ner kortet från i helskärm på touch: pan-y åt gesten →
            // pointercancel → kortet "fastnade" på 1–2 px (iPhone-rapport
            // 1/9). Ett rent tapp gör ingen touchmove-preventDefault, så
            // radklicken lever som vanligt; ett riktigt drag sväljs ändå av
            // didDragRef i sheet-rotens onClickCapture.
            const target = e.target as HTMLElement;
            // < 1: scrollTop kan vara bråkdel nära toppen (Firefox/iOS).
            startedAtTop = sc.scrollTop < 1
                && !target.closest('input, textarea, select');
            touchStartY = e.touches[0].clientY;
            pullingRef.current = false;
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!startedAtTop) return;
            const dy = e.touches[0].clientY - touchStartY;
            if (!pullingRef.current) {
                if (dy > 4 && sc.scrollTop < 1) pullingRef.current = true; // neddrag vid toppen → ta över
                else if (dy < -4) { startedAtTop = false; return; }        // uppdrag → vanlig innehållsscroll
            }
            if (pullingRef.current && e.cancelable) e.preventDefault();
        };
        const onTouchEnd = () => { pullingRef.current = false; };
        sc.addEventListener('touchstart', onTouchStart, { passive: true });
        sc.addEventListener('touchmove', onTouchMove, { passive: false });
        sc.addEventListener('touchend', onTouchEnd, { passive: true });
        sc.addEventListener('touchcancel', onTouchEnd, { passive: true });
        return () => {
            sc.removeEventListener('touchstart', onTouchStart);
            sc.removeEventListener('touchmove', onTouchMove);
            sc.removeEventListener('touchend', onTouchEnd);
            sc.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [hasSelectedEvent]);

    // ── Mus-/styrplatte-hjul: scrolla för att VÄXA hela behållaren ───────────
    // Förut kunde man bara DRA kortet med handtaget för att förstora det — ett
    // hjul-/tvåfingerscroll gjorde inget (touch-action gäller bara touch, inte
    // hjul). Hjulet tar kortet upp STOPP FÖR STOPP (Josef 2/9): default →
    // tapp-höjden → taket, ett steg per gest; först på taket scrollar
    // innehållet. Scrollar man tillbaka vid innehållstoppen går det samma
    // stopp nedåt, och sist stängs kortet. (Den kontinuerliga växten mot
    // helskärm, 31/8–2/9, är ersatt av stoppen.)
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
            // GAIN (Josef 31/8): rått 1:1 px→vh kändes segt jämfört med
            // innehållsscrollen bredvid — den flyttar text några rader, medan
            // kortet ska resa 50+ vh på samma gest. Förstärkningen gäller BARA
            // kortets storleksändring; innehållsscrollen rörs inte (vi
            // preventDefault:ar bara i de två grenarna nedan).
            const deltaVh = (px / window.innerHeight) * 100 * SHEET_WHEEL_GAIN;
            // Ny gest mitt i tröghetssvansen? (Se wheelTrackRef.) Då spänns
            // grinden och taket-hållet släpps direkt — utan att vänta på
            // tystnad som aldrig kommer medan svansen rullar.
            const track = wheelTrackRef.current;
            const absPx = Math.abs(px);
            const sign = Math.sign(px);
            const flipped = sign !== 0 && track.lastSign !== 0 && sign !== track.lastSign;
            const jumped = absPx > track.lastAbs * WHEEL_NEW_GESTURE_GAIN + 2;
            if (flipped || (jumped && performance.now() - track.snappedAt > WHEEL_SNAP_COOLDOWN_MS)) {
                wheelSnapArmedRef.current = true;
                wheelHoldAtMaxRef.current = false;
            }
            track.lastAbs = absPx;
            if (sign !== 0) track.lastSign = sign;
            // VÄLJARLISTAN (Josef 2/9): kortet står STILL och listan scrollar
            // upp under överkanten — hjulet växer inte kortet här. Vill man
            // ha det större drar man i handtaget.
            const chooser = chooserActiveRef.current;
            // Scrolla "in i" kortet (fingrar upp / hjul ner) under taket → ETT
            // STOPP UPP (Josef 2/9): default → tapp-höjden → taket. Grinden
            // slukar tröghetssvansen så ett svep aldrig kedjar genom flera
            // stopp. Landar vi på taket hålls resten av gesten (hold nedan) så
            // innehållet inte börjar scrolla förrän nästa gest.
            if (deltaVh > 0 && h < maxVhRef.current && !chooser) {
                e.preventDefault();
                if (!wheelSnapArmedRef.current) { scheduleWheelRearm(); return; }
                consumeWheelGate();
                setIsAnimating(true);
                const target = nextStopAbove(sheetStopsNow(), h, SNAP_TOLERANCE_VH);
                updateHeightVh(target);
                if (target >= maxVhRef.current - 0.5) wheelHoldAtMaxRef.current = true;
                return;
            }
            // Scrolla tillbaka vid innehållets topp → ETT STOPP NER i stället
            // för att glida (Josef 1/9, utökat 2/9 med tapp-höjden): taket →
            // tapp-höjden → default, och nästa svep därifrån stänger kortet
            // helt. Grinden (wheelSnapArmedRef) slukar tröghetssvansen så ett
            // enda svep aldrig kedjar genom flera steg.
            // < 1 (inte <= 0): Firefox rapporterar BRÅKDELS-scrollTop (0.5 osv)
            // nära toppen — med <= 0 fastnade hjulet i en död zon där varken
            // innehållet eller kortet rörde sig.
            if (deltaVh < 0 && sc.scrollTop < 1) {
                e.preventDefault();
                if (!wheelSnapArmedRef.current) { scheduleWheelRearm(); return; }
                consumeWheelGate();
                setIsAnimating(true);
                const target = nextStopBelow(sheetStopsNow(), h, SNAP_TOLERANCE_VH);
                if (target !== null) updateHeightVh(target);
                else closeCardRef.current();
                return;
            }
            // Precis snäppt till taket: svälj resten av samma gest (Josef 2/9:
            // "stanna innan vi börjar scrolla inom själva eventkortet").
            if (deltaVh > 0 && wheelHoldAtMaxRef.current) {
                e.preventDefault();
                scheduleWheelRearm();
                return;
            }
            // annars: helskärm + innehållet scrollar → låt hjulet scrolla normalt.
            // I väljarlistan spänner innehållsscrollen AV snäpp-grinden: en
            // styrplatte-flick som rullar listan tillbaka till toppen får inte
            // fortsätta rakt in i stäng-snäppet ovan på sin tröghetssvans.
            // Grinden återspänns efter WHEEL_SNAP_QUIET_MS tystnad — ett nytt,
            // medvetet uppåtsvep vid toppen stänger som vanligt. (Bara när
            // listan faktiskt kan scrolla; en kort lista lämnar grinden spänd.)
            if (chooser && sc.scrollHeight - sc.clientHeight > 1) {
                wheelSnapArmedRef.current = false;
                scheduleWheelRearm();
            }
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
        const step = dayStepRef.current;
        const isDayStepLanding = !!step && step.fromOffset !== dayOffset
            && Date.now() - step.armedAt < DAY_STEP_LANDING_MS;
        if (isPickNext) {
            // Intern navigering (Nästa/Bakåt) drev fram detta event — behåll
            // ankare, besökt-set OCH bakåt/framåt-stackarna.
            expectedNextIdRef.current = null;
        } else if (isDayStepLanding) {
            // LANDNINGEN efter ett dagbyte via Nästa/Bakåt (Josef 2/9): sidan
            // valde eventet åt oss. Ny dag = ny runda — nytt ankare och tomt
            // besökt-set — men bakåt-/framåtstackarna står KVAR så man kan gå
            // tillbaka över dagbytet (och framåt igen).
            dayStepRef.current = null;
            setAnchorId(selectedEvent.id);
            anchorSetAtRef.current = Date.now();
            setVisitedEventIds(new Set());
        } else {
            // Användaren valde ett nytt event (kartkick / första valet) → ny
            // ankare och en helt ny browsing-gren: nollställ besökt + historik.
            dayStepRef.current = null;
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
            if (wantsFullOpen) updateHeightVh(DEEPLINK_HEIGHT_VH);
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

    // Väljarlistan börjar alltid från toppen (Josef 2/9): kortet kan ha stått
    // nedscrollat i ett vanligt event när multibrickan klickades, eller när
    // man backar till listan via pilen — annars låg listan kvar mitt i.
    useEffect(() => {
        if (!chooserActive) return;
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, [chooserActive]);

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
    // Dubblettgruppering (Josef 1/9 — samma regel som stadssidornas daglista,
    // utils/groupDups): samma titel ELLER omslagsbild under samma dag = EN rad,
    // övriga tillfällen bakom radens utfällning. Grupperas EFTER bildfiltret så
    // bildflödets grupper bara bär bildsatta event. rows = RADER (pagineringen),
    // count = EVENT (rubrikens siffra).
    const groupNearby = (items: { evt: LinkEvent; distanceKm: number | null }[]) => {
        const wrapped = items.map(it => ({ title: it.evt.title, coverImage: it.evt.coverImage || undefined, time: it.evt.time, it }));
        const rows: NearbyItem[] = groupListDuplicates(wrapped).map(g => ({
            ...g.rep.it,
            ...(g.dups.length > 0 ? { dups: g.dups.map(d => d.it) } : {}),
        }));
        return { rows, count: items.length };
    };
    const listedUpcoming = useMemo(
        () => groupNearby(imagesOnlyList ? upcomingNearby.filter(n => !!n.evt.coverImage) : upcomingNearby),
        // groupNearby är en ren lokal hjälpare — medvetet utanför deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [upcomingNearby, imagesOnlyList]
    );
    const listedPast = useMemo(
        () => groupNearby(imagesOnlyList ? pastNearby.filter(n => !!n.evt.coverImage) : pastNearby),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pastNearby, imagesOnlyList]
    );

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
    // i bild-vakten läses via ref här: kartrutan byts vid varje panorering
    // (~5 ggr/s) och förvärmningen ska inte starta om för det.
    const inViewRef = useRef(inView);
    inViewRef.current = inView;
    useEffect(() => {
        if (!selectedEvent || typeof window === 'undefined') return;

        const PRELOAD_COUNT = 4;
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        // Samma pool som Nästa: bara event i bild.
        const pool = visiblePool(anchor, inViewRef.current);
        const simVisited = new Set(visitedEventIds);
        let current: LinkEvent = selectedEvent;
        const upcoming: LinkEvent[] = [];

        for (let i = 0; i < PRELOAD_COUNT; i++) {
            simVisited.add(current.id);
            const next = findNearestEvent(anchor, pool, discardedEventIds, simVisited);
            // Slut i bild → inget varv till (Nästa går till nästa dag i stället).
            if (!next || upcoming.some(e => e.id === next.id)) break;
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

    /** Nästa-poolen SOM SYNS: tids-/ankarregeln ovan OCH i bild (inView —
     *  inom kartrutan, ovanför kortet; Josef 2/9). Utan predikat räknas allt
     *  som synligt. Predikatet går att skicka in (förvärmningen läser det
     *  via ref). */
    const visiblePool = (anchor: LinkEvent, isInView: ((evt: LinkEvent) => boolean) | undefined = inView): LinkEvent[] => {
        const pool = nextCandidatePool(anchor);
        return isInView ? pool.filter(isInView) : pool;
    };

    /**
     * Plocka nästa event utifrån ankaret (spiral utåt i avstånd) BLAND DEM I
     * BILD. Lägger nuvarande plats i visited och letar närmaste-till-ankaret
     * som inte är besökt. null = alla i bild är genomgångna — då är det
     * dagbytets tur (handleNextOnly/handleSwipeOut), inte ett nytt varv:
     * omstarten från ankaret är RIVEN 2/9 (Josef: "har man gått igenom alla
     * ska vi automatiskt gå till nästa dag").
     */
    const pickNext = (current: LinkEvent): LinkEvent | null => {
        const anchor = events.find(e => e.id === anchorId) ?? current;
        const pool = visiblePool(anchor);

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

        const next = findNearestEvent(anchor, pool, discardedEventIds, newVisited);
        setVisitedEventIds(newVisited);
        if (next) expectedNextIdRef.current = next.id;
        return next;
    };

    /** Alla event på samma koordinat som evt (4 decimaler — samma hopning som
     *  kartans multibrickor och räknarna nedan). */
    const groupAt = (evt: LinkEvent): LinkEvent[] => {
        if (!evt.lat || !evt.lng) return [evt];
        const key = `${evt.lat.toFixed(4)},${evt.lng.toFixed(4)}`;
        return events.filter(e => e.lat && e.lng && `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` === key);
    };
    /** Framåt-navigeringens val: landar man på en MULTIPLATS öppnas kortets
     *  väljarlista (onSelectGroup — grupp + rep atomiskt via sidan), annars
     *  väljs eventet direkt. (Josef 31/8 — samma beteende som multibrick-
     *  klicket på kartan.) */
    const selectNextTarget = (next: LinkEvent | null) => {
        if (next && onSelectGroup) {
            const group = groupAt(next);
            if (group.length > 1) {
                onSelectGroup(group, next);
                return;
            }
        }
        onSelectEvent(next);
    };
    /** Alla event i bild genomgångna → nästa dag som HAR något i bild (sidan
     *  räknar fram den: nextDayOffset; tomma dagar hoppas över). Kortet
     *  följer med dit via sidans dagbytes-effekt, som väljer eventet närmast
     *  kartans mitt bland dem i bild — kameran står still. Sant om ett
     *  dagbyte utlöstes; falskt när ingen dag finns kvar. */
    const advanceToNextDay = (): boolean => {
        if (nextDayOffset == null || !onDayStep || !selectedEvent) return false;
        // Dagbytet är ett steg i historiken: eventet man lämnar (och dess dag)
        // läggs bakåt, så Bakåt tar en tillbaka över dagbytet (Josef 2/9).
        pushHistory({ evt: selectedEvent, dayOffset });
        setForwardStack([]);
        stepToDay(nextDayOffset);
        return true;
    };
    /** Be sidan byta dag och armera landningen (se dayStepRef). Med
     *  selectEventId landar dagbytet på just det eventet (Bakåt/Nästa över
     *  ett dagbyte), annars på närmaste i bild. */
    const stepToDay = (toOffset: number, selectEventId?: string) => {
        dayStepRef.current = { fromOffset: dayOffset, armedAt: Date.now() };
        onDayStep?.(toOffset - dayOffset, selectEventId);
    };

    const THRESHOLD = 100; // Pixels to trigger a swipe action

    // Sätts när en press blir en riktig drag (>5px). Används för att INTE
    // navigera när man dragit i Föregående/Nästa-knappen i stället för klickat.
    const didDragRef = useRef(false);
    // Elementet som bär pointer-capturen för kortets pågående gest: kortet
    // självt, ELLER knappen/länken gesten började på (se onPointerDown — det
    // är så ett rent klick på knappen överlever). null = ingen gest.
    const dragCaptureElRef = useRef<HTMLElement | null>(null);
    // Sant när gesten började på en knapp/länk — då ska tap-utan-rörelse INTE
    // toggla kortets höjd (knappens eget onClick är tappens betydelse).
    const dragFromInteractiveRef = useRef(false);
    // Sant medan den native touch-lyssnaren (dra-ner-vid-scroll-toppen) har
    // tagit över gesten från innehållsscrollen — då får kortets drag driva
    // höjden även i väljarlistan (se contentTouchLockRef).
    const pullingRef = useRef(false);
    // VÄLJARLISTAN på touch (Josef 2/9): innehållet äger den vertikala gesten
    // (touch-action pan-y) så listan scrollar medan kortet står still. Men
    // webbläsaren skickar några pointermove INNAN den tar över panoreringen
    // (och sedan pointercancel) — utan låset växte kortet några px på dem och
    // snäppte sedan till MAX i cancel-släppet. Sätts i onPointerDown för
    // touch/penna som börjar i scrollinnehållet; handtaget överst är fort-
    // farande touch-action:none och drar kortet som vanligt.
    const contentTouchLockRef = useRef(false);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        didDragRef.current = false;

        const target = e.target as HTMLElement;
        // Textfält behåller sina egna pekgester (markera text, flytta
        // markören) — kortet ska inte börja åka för att man drar i chattfältet.
        if (target.closest('input, textarea, select')) {
            return;
        }
        // KNAPPAR OCH LÄNKAR ÄR OCKSÅ DRAGYTA (Josef 31/8: "det måste man
        // kunna oavsett var man börjar dra i eventkortet" — förr dog gesten
        // helt på Anmäl/chatten/listan och kortet gick varken att dra eller
        // scrolla därifrån). Tricket är VAR pointer-capturen sätts: på det
        // interaktiva elementet SJÄLVT, inte på kortet. Då pekar pointerup
        // fortfarande på knappen och ett RENT klick (ingen rörelse) når dess
        // onClick som vanligt — capture på kortet hade retargetat bort
        // klicket. Händelserna bubblar ändå hit upp, så drag-logiken nedan
        // är densamma; blir gesten ett drag sväljer onClickCapture på kortet
        // knappens efterföljande klick (didDragRef).
        // `summary` räknas också (Josef 2/9): närhetslistans grupprader
        // ("+7 fler tider & platser") fälls ut med <details>/<summary>. Utan
        // den här raden togs capturen på KORTET, klicket retargetades bort
        // från summaryn (listan öppnades aldrig) och tappen togglade kortets
        // höjd i stället — "kortet går ner men de 7 andra visas inte".
        const interactive = target.closest('button, a, summary') as HTMLElement | null;

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

        contentTouchLockRef.current = chooserActiveRef.current
            && e.pointerType !== 'mouse'
            && !!scrollContainerRef.current?.contains(target);

        const captureEl = interactive ?? e.currentTarget;
        captureEl.setPointerCapture(e.pointerId);
        dragCaptureElRef.current = captureEl;
        dragFromInteractiveRef.current = interactive != null;
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
        // Capturen kan sitta på en knapp/länk i stället för kortet (se
        // onPointerDown) — fråga elementet som faktiskt bär den.
        if (!dragCaptureElRef.current?.hasPointerCapture(e.pointerId)) return;

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
            // Väljarlistan på touch: höjden rörs bara om den native touch-
            // lyssnaren tagit över gesten (neddrag vid scroll-toppen) — annars
            // är det innehållet som ska scrolla, inte kortet som ska växa.
            if (contentTouchLockRef.current && !pullingRef.current) return;
            const deltaVh = (deltaY / window.innerHeight) * 100;
            // Fritt nedåt: under peek-gränsen fortsätter kortet glida ner mot
            // botten — släpper man tillräckligt långt ner stängs det (se
            // onPointerUp). Uppåt klampas vid MAX_HEIGHT_VH.
            const newHeight = Math.max(3, Math.min(MAX_HEIGHT_VH, startHeightVh.current + deltaVh));
            // live: fingret äger höjden direkt, ingen React-render per pixel.
            // Ingen gain här — vid drag SKA kortet följa fingret 1:1.
            updateHeightVh(newHeight, true);
        } else if (dragDirection.current === 'horizontal') {
            updateDragX(startDragX.current + deltaX);
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        isDragging.current = false;

        const captureEl = dragCaptureElRef.current ?? e.currentTarget;
        if (captureEl.hasPointerCapture(e.pointerId)) {
            captureEl.releasePointerCapture(e.pointerId);
        }
        dragCaptureElRef.current = null;

        setIsAnimating(true);

        if (dragDirection.current === 'vertical') {
            const h = heightVhRef.current;
            const collapsed = collapsedVhRef.current;
            if (h < collapsed - DISMISS_BELOW_VH) {
                // Släppt långt under peek-gränsen → kortet glider ner och
                // stängs helt (avmarkerar eventet, precis som ett kartklick).
                closeCard();
            } else if (h < collapsed) {
                // Strax under gränsen → snäpp tillbaka till peek-läget.
                updateHeightVh(collapsed);
            } else if (h > startHeightVh.current) {
                // UPPÅT-drag → snäpp till närmaste STOPP ovanför startläget
                // (Josef 2/9: default → tapp-höjden → taket): ett kort ryck
                // tar ett steg, ett långt drag landar där fingret släppte.
                // Släppet hamnar alltid PÅ ett stopp, aldrig mitt emellan —
                // så kortet inte blir kvar i touch-action:none-zonen (< MAX-5)
                // där svep på innehållet varken scrollar eller växer. Först
                // på taket scrollar innehållet (nästa svep).
                updateHeightVh(snapUp(sheetStopsNow(), startHeightVh.current, h, SNAP_TOLERANCE_VH));
            } else {
                // Neddrag → stoppen baklänges (Josef 1/9, utökat 2/9): taket →
                // tapp-höjden → default, och från default (eller lägre) stängs
                // kortet helt. Korta ryck studsar tillbaka dit gesten började
                // — ett darr på fingret ska inte stänga kortet. (Ett släpp
                // långt under peek har redan stängts av grenarna ovan.)
                if (startHeightVh.current - h < SNAP_PULL_MIN_VH) {
                    updateHeightVh(startHeightVh.current);
                } else {
                    const target = snapDown(sheetStopsNow(), startHeightVh.current, h, SNAP_TOLERANCE_VH);
                    if (target !== null) updateHeightVh(target);
                    else closeCard();
                }
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
            // Började tappen på en knapp/länk är knappens onClick tappens hela
            // betydelse — höjdtoggeln ska inte också slå till.
            if (cardView === 'info' && !dragFromInteractiveRef.current) {
                updateHeightVh(heightVhRef.current > 50 ? measureDefaultHeight() : measureOpenHeight());
            }
        }

        dragFromInteractiveRef.current = false;
        dragDirection.current = 'none';
    };

    // Låt Föregående/Nästa-knapparna OCKSÅ dra kortet (samma vertikal/horisontell
    // gest) utan att förlora klick-funktionen. Vi återanvänder samma drag-refs och
    // kort-släpp-logik; ett rent klick (ingen rörelse) går vidare till onClick.
    const onButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        didDragRef.current = false;
        contentTouchLockRef.current = false;
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

    const pushHistory = (entry: NavEntry) => {
        setHistoryStack(prev => [...prev, entry]);
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

        // Wait for animation, then change event
        setTimeout(() => {
            if (events.length === 0) return;

            // Svep = gren-byte: släng ev. framåt-historik och hoppa till det
            // geografiskt närmaste icke-besökta eventet.
            setForwardStack([]);
            const next = pickNext(selectedEvent);
            // Reset position immediately for the new card (height bevaras —
            // det här är en Nästa-navigering, inte en ny ankare).
            setExitX(null);
            updateDragX(0);
            if (!next) {
                // Sista i bild bortsvept → nästa dag (sidan väljer kortet där);
                // finns ingen dag kvar stängs kortet — det finns inget att visa.
                if (!advanceToNextDay()) onSelectEvent(null);
                return;
            }
            pushHistory({ evt: selectedEvent, dayOffset });
            onNavigate?.(); // kameran ska stå kvar — vi fokuserar inte det nya eventet
            selectNextTarget(next); // multiplats → kortets väljarlista
        }, 200); // 200ms matches the CSS transition
    };

    // Bakåt-knapp: gå till eventet vi tittade på innan vi gick vidare, och lägg
    // det nuvarande på framåt-stacken så Nästa kan spela upp samma ordning igen.
    const handleHistoryBack = () => {
        if (didDragRef.current) { didDragRef.current = false; return; }
        if (historyStack.length === 0 || !selectedEvent) return;
        const entry = historyStack[historyStack.length - 1];
        setHistoryStack(prev => prev.slice(0, -1));
        setForwardStack(prev => [...prev, { evt: selectedEvent, dayOffset }]);
        if (entry.dayOffset !== dayOffset) {
            // BAKÅT ÖVER ETT DAGBYTE (Josef 2/9): tillbaka till den dagen, och
            // sidan landar på eventet man stod på där (finns det inte längre:
            // närmast kartans mitt i bild). Landningen behåller stackarna, så
            // Nästa tar en framåt över dagbytet igen.
            if (onDayStep) stepToDay(entry.dayOffset, entry.evt.id);
            setExitX(null);
            updateDragX(0);
            return;
        }
        const prevEvent = events.find(e => e.id === entry.evt.id);
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
        // stället för att räkna fram ett nytt närmaste event — men bara om
        // eventet fortfarande är I BILD (man kan ha panorerat sedan man
        // backade); annars slängs stacken och Nästa räknar fram som vanligt.
        let next: LinkEvent | null = null;
        if (forwardStack.length > 0) {
            const top = forwardStack[forwardStack.length - 1];
            if (top.dayOffset !== dayOffset && onDayStep) {
                // FRAMÅT ÖVER ETT DAGBYTE (man backade över det): eventet man
                // står på läggs bakåt, dagen byts och sidan landar på just det
                // event man var på där.
                pushHistory({ evt: selectedEvent, dayOffset });
                setForwardStack(prev => prev.slice(0, -1));
                stepToDay(top.dayOffset, top.evt.id);
                return;
            }
            const fwd = top.dayOffset === dayOffset ? events.find(e => e.id === top.evt.id) ?? null : null;
            if (fwd && (!inView || inView(fwd))) {
                next = fwd;
                setForwardStack(prev => prev.slice(0, -1));
                expectedNextIdRef.current = fwd.id; // intern navigering — behåll ankare
            } else {
                setForwardStack([]);
            }
        }
        // Tom framåt-stack (eller eventet finns inte längre) → vanligt pickNext.
        if (!next) next = pickNext(selectedEvent);
        if (!next) {
            // Alla i bild genomgångna → nästa dag (Josef 2/9). Knappen är
            // släckt när ingen dag finns kvar, så grenen är då oåtkomlig.
            advanceToNextDay();
            return;
        }
        pushHistory({ evt: selectedEvent, dayOffset });
        onNavigate?.(); // kameran står kvar — vi fokuserar inte det nya eventet
        selectNextTarget(next); // multiplats → kortets väljarlista

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
    const backEntry: NavEntry | undefined = historyStack[historyStack.length - 1];
    const backEvent = backEntry?.evt;
    // Ligger föregående event på en ANNAN dag tar Bakåt en över dagbytet —
    // titeln säger vilken dag, så det inte kommer som en överraskning.
    const backCrossDay = !!backEntry && backEntry.dayOffset !== dayOffset;
    const backTitle = backEvent
        ? `Gå tillbaka till ${backEvent.title}${backCrossDay ? ` (${getDayLabel(backEntry!.dayOffset, dayRangeDays).toLowerCase()})` : ''}`
        : null;

    // Antal event i föregående events grupp (om det var en multibricka).
    // Räknas bara på dagens lista — över ett dagbyte visas ingen siffra.
    const backEventGroupCount = useMemo(() => {
        if (!backEvent || backCrossDay || !backEvent.lat || !backEvent.lng) return 1;
        const key = `${backEvent.lat.toFixed(4)},${backEvent.lng.toFixed(4)}`;
        return events.filter(e => {
            if (!e.lat || !e.lng) return false;
            const k = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
            return k === key;
        }).length;
    }, [backEvent, backCrossDay, events]);

    // Nästa event — SAMMA val som handleNextOnly gör (framåt-stacken först,
    // annars närmaste obesökta), men helt ren (inga setState/refs) så den kan
    // visas som emoji-bricka = en förhandsvisning av vart Nästa tar dig.
    const nextEvent = useMemo<LinkEvent | null>(() => {
        if (!selectedEvent || events.length === 0) return null;
        // Har vi backat? Nästa spelar upp framåt-stacken i samma ordning igen
        // — om eventet fortfarande är i bild (samma vakt som handleNextOnly).
        if (forwardStack.length > 0) {
            const top = forwardStack[forwardStack.length - 1];
            // Över ett dagbyte: ingen emoji — knappen visar dagens namn i
            // stället (nextDayLabel), och trycket byter dag.
            if (top.dayOffset !== dayOffset) return null;
            const fwd = events.find(e => e.id === top.evt.id);
            if (fwd && (!inView || inView(fwd))) return fwd;
        }
        // Annars: samma logik som pickNext, utan sidoeffekter.
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        const pool = visiblePool(anchor);
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
        // null = alla i bild genomgångna → knappen visar nästa dag i stället.
        return findNearestEvent(anchor, pool, discardedEventIds, simVisited);
    }, [selectedEvent, events, forwardStack, dayOffset, anchorId, visitedEventIds, discardedEventIds, now, inView]);

    // Antal event i nästa events grupp (om det är en multibricka)
    const nextEventGroupCount = useMemo(() => {
        if (!nextEvent || !nextEvent.lat || !nextEvent.lng) return 1;
        const key = `${nextEvent.lat.toFixed(4)},${nextEvent.lng.toFixed(4)}`;
        return events.filter(e => {
            if (!e.lat || !e.lng) return false;
            return `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` === key;
        }).length;
    }, [nextEvent, events]);

    // Nästa-knappens tre lägen (Josef 2/9): (1) event i bild kvar → emoji-
    // förhandsvisning som förut; (2) eventen i bild slut men en dag med
    // event i bild finns → NÄSTA DAGS NAMN på knappen ("IMORGON", "TORSDAG"),
    // trycket byter dag; (3) ingen dag kvar → släckt knapp.
    // Har man backat över ett dagbyte ligger DEN dagen överst i framåtstacken
    // och vinner över den beräknade nästa dagen — Nästa spelar upp samma väg.
    const forwardTop: NavEntry | undefined = forwardStack[forwardStack.length - 1];
    const nextStepDayOffset = forwardTop && forwardTop.dayOffset !== dayOffset ? forwardTop.dayOffset : nextDayOffset;
    const nextDayLabel = !nextEvent && nextStepDayOffset != null ? getDayLabel(nextStepDayOffset, dayRangeDays) : null;
    const nextDisabled = !nextEvent && nextStepDayOffset == null;
    const nextTitle = nextEvent
        ? `Närmaste i bild: ${nextEvent.title}`
        : nextDayLabel
            ? `Alla event i bild är genomgångna — gå vidare till ${nextDayLabel.toLowerCase()}`
            : 'Inga fler event i bild';

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
                    sitter längst till vänster i gruppen och Nästa skjuts ut i högerkanten
                    (ml-auto). Gruppen tar hela bredden (flex-1) bredvid verktygspillen men
                    är pointer-events-none — bara knapparna själva tar klick, tomrummet
                    emellan går till kartan. Bakåt/Nästa döljs i spelläget — då ska man inte
                    kunna navigera bort målet. */}
                <div className="flex-1 min-w-0 ml-2 flex items-center gap-2 pointer-events-none">
                    {pinShotHits > 0 && (
                        <div className="pointer-events-auto flex items-center gap-1.5 bg-amber-400 text-slate-900 font-black rounded-full shadow-xl border border-white/30 px-3.5 h-[38px] text-[13px] tabular-nums box-border whitespace-nowrap">
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
                                aria-label={backTitle ?? 'Inget föregående event'}
                                title={backTitle ?? 'Inget föregående event än'}
                                className={`pointer-events-auto relative shrink-0 bg-white/30 backdrop-blur-md rounded-full shadow-xl border border-white/50 h-[38px] w-[38px] flex items-center justify-center leading-none box-border select-none transition-all ${
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
                            {/* Nästa — knappen ÄR kapseln: ytan till vänster om den
                                var tidigare klickbar (flex-1) men revs 31/8 (Josef:
                                "det ska bara vara på nästa-knappen"), så kartklick i
                                tomrummet går fram. Kapseln är solid flaggblå i
                                högerkanten (samma gradient +
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
                                disabled={nextDisabled}
                                aria-label={nextTitle}
                                title={nextTitle}
                                className={`group/nasta pointer-events-auto relative shrink-0 ml-auto h-[38px] box-border flex items-center bg-transparent${nextDisabled ? ' opacity-40 cursor-not-allowed' : ''}`}
                            >
                                {/* DAGBYTES-LÄGET: samma blå kapsel men med GUL RAM (Josef
                                    2/9: "skit i det att den byter färg, lägg en gul ram i
                                    stället") + kalender-ikon i stället för eventets emoji.
                                    Ägarbeslut — den vita omfärgningen byggdes och revs
                                    samma kväll. */}
                                <span className={`flex items-center gap-2 h-[38px] pl-4 pr-1.5 rounded-full bg-gradient-to-r from-[#0077BC] to-[#005590] text-white shadow-md shadow-sky-900/30 ring-inset transition-all group-hover/nasta:from-[#0083CE] group-hover/nasta:to-[#00619F] group-hover/nasta:shadow-lg group-active/nasta:scale-[0.97] ${
                                    nextDayLabel ? 'ring-2 ring-[#FECC02]' : 'ring-1 ring-white/25'
                                }`}>
                                    {/* Eventen i bild slut → nästa dags namn i stället för NÄSTA,
                                        så man ser att trycket byter dag (se nextDayLabel). */}
                                    <span className="text-[12px] font-black uppercase tracking-widest leading-none">{nextDayLabel ?? 'NÄSTA'}</span>
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
                                    ) : nextDayLabel ? (
                                        <span aria-hidden className="flex items-center justify-center w-7 h-7">
                                            <CalendarDays size={16} />
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
                ref={sheetRef}
                className={`relative w-full max-w-4xl pointer-events-auto flex flex-col bg-card rounded-t-[2rem] shadow-[0_-12px_60px_rgba(0,0,0,0.3)] overflow-hidden border border-border/10${scrollNudgeActive ? ' scroll-nudge-anim' : ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                // Blev gesten ett drag skickar webbläsaren ÄNDÅ ett click till
                // knappen/länken den började på (capturen sitter på elementet
                // självt, se onPointerDown) — svälj det i capture-fasen så ett
                // kortdrag från Anmäl/chatten aldrig också ÖPPNAR dem.
                onClickCapture={(e) => {
                    if (didDragRef.current) {
                        didDragRef.current = false;
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }}
                onAnimationEnd={(e) => { if (e.animationName === 'scroll-nudge') setScrollNudgeActive(false); }}
                style={{
                    // Höjden går via --sheet-h så scroll-nudge-animationen kan
                    // växa kortet från samma basvärde (botten förblir förankrad).
                    ['--sheet-h' as string]: `${heightVhRef.current}vh`,
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
                    <div className="h-1 w-10 rounded-full bg-slate-400/90 dark:bg-zinc-500/90" />
                    <div className="h-1 w-10 rounded-full bg-slate-400/90 dark:bg-zinc-500/90" />
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
                        // VÄLJARLISTAN (Josef 2/9): alltid pan-y — svepet
                        // scrollar listan upp under överkanten, kortet står
                        // still (se contentTouchLockRef för pointer-sidan).
                        touchAction: !chooserActive && heightVhRef.current < MAX_HEIGHT_VH - 5 ? 'none' : 'pan-y'
                    }}
                >
                    {/* VÄLJARLÄGET: innehållet ÄR väljarlistan tills man valt
                        (Josef 31/8) — sen renderas det vanliga kortet nedan. */}
                    {chooserActive && groupChoice ? (
                        <EventCardGroupList
                            events={groupChoice}
                            selectedEvent={selectedEvent}
                            onSelect={onPickFromGroup!}
                        />
                    ) : (<>
                    <LinkEventCard
                        linkEvent={selectedEvent}
                        isAdmin={false}
                        distance={distanceFromUserKm}
                        showFullAddress
                        // Djuplänksöppningen (DEEPLINK_HEIGHT_VH) startar med ALLT
                        // uppfällt — ett nästan-fullhöjdskort med bara headern vore
                        // mest tomyta. Läses vid mount; nonce-förbrukningen (ref-
                        // skrivningen) sker i ankar-effekten ovan.
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
                        // Tillbaka-pilen sitter FÖRE Lista-knappen i headern.
                        // Bara i infovyn: står man i närhetslistan är "tillbaka"
                        // tvetydigt (två listor), och där finns Lista-toggeln
                        // som väg ut.
                        onBackToGroup={cardView === 'info' ? onBackToGroup : undefined}
                        backToGroupCount={backToGroupCount}
                        nearbyView={cardView === 'nearby'}
                        onToggleNearbyView={nearbyEvents.length > 0 ? () => handleToggleView('nearby') : undefined}
                        hasStar={starredEventIds?.has(selectedEvent.id) ?? false}
                        // Passerade event kan inte stjärnmärkas — stjärnan vore
                        // förbrukad direkt (den lyser bara tills eventet varit).
                        canPlaceStar={canPlaceStar && !isEventPast(selectedEvent, Date.now())}
                        onPlaceStar={onPlaceStar ? () => onPlaceStar(selectedEvent.id) : undefined}
                    />
                    {/* Chatt per event — KRÄVER KONTO för att ens läsas
                        (Josef 31/8): utloggade ser en låst rad "Logga in för
                        att se chatten" som öppnar auth-modalen.
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
                    {/* Djuplänks-glappet (?event= från stadssidorna): kortet
                        öppnar på sitt seed-data långt innan Sverige-lagren
                        laddat, så närhetslistan är tom en stund. Visa sektionen
                        som laddande i stället för att den poppar in ur
                        ingenstans — försvinner när listan fyllts, eller tyst
                        när det definitiva beskedet säger att inget finns nära. */}
                    {cardView !== 'chat' && nearbyEvents.length === 0 && !eventsSettled && (
                        <div className="w-full bg-slate-50 dark:bg-zinc-900/40 border-t border-border">
                            <div className="px-4 md:px-6 py-3 flex items-center gap-2.5">
                                <span aria-hidden className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-zinc-600 border-t-[#006AA7] dark:border-t-sky-400 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Letar event i närheten…
                                </span>
                            </div>
                        </div>
                    )}
                    {cardView !== 'chat' && nearbyEvents.length > 0 && (
                        <NearbyEventsList
                            upcomingItems={listedUpcoming.rows.slice(0, nearbyVisibleCount)}
                            upcomingTotal={listedUpcoming.rows.length}
                            upcomingCount={listedUpcoming.count}
                            pastItems={listedPast.rows}
                            now={now}
                            onSelect={evt => onSelectEvent(evt)}
                            onLoadMore={() => setNearbyVisibleCount(c => c + NEARBY_PAGE_SIZE)}
                            coachMarkerRef={coachMarkerRef}
                            imagesOnly={imagesOnlyList}
                            showImages={showImages}
                            onToggleImages={toggleImages}
                        />
                    )}
                    </>)}
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
                {coachStage !== 'off' && cardView === 'info' && !chooserActive && (
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
