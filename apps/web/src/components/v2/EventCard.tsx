'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, Fragment, type ReactNode } from 'react';
import { isVadkulHostedEvent, LinkEvent, type EventRsvpStatus } from '../../types';
import EventRsvpFooter, { EventRsvpTopBar } from './EventRsvpFooter';
import CardMoreRows, { type OrganizerRowData } from './CardMoreRows';
import { Search, ListFilter as FilterIcon, X as XIcon } from 'lucide-react';
import { eventOutlink } from '@/utils/eventExpand';
import { isAffiliateUrl } from '@/utils/affiliateLink';
import { isTicketmasterEvent } from '@/utils/ticketmasterEvent';
import { recordEventClick } from '@/services/eventStatsService';
import { normalizePriceLabel } from '../../utils/priceLabel';
import { dupKey, groupListDuplicates } from '../../utils/groupDups';
import { NO_TIME_PAST_HOUR, isEventPast } from './v2MapBricka';
import { type BoostTier } from '../../services/boostService';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import LinkEventCard from '../ui/LinkEventCard';
import EventChatPanel from './EventChatPanel';
import EventCardGroupList from './EventCardGroupList';
import { categoryLabel } from './v2MapLabel';
import { eventDays, isPopularListed, LIST_HORIZON_DAYS, takeRows } from '@/utils/popularList';
import { splitDaysIntoRings } from '@/utils/listZoomRings';
import { linkEventService } from '@/services/linkEventService';
import { sheetStops, nextStopAbove, nextStopBelow, snapRelease } from '@/utils/sheetSnap';
import { ArrowRight, ArrowLeft, ChevronRight, ChevronDown, CalendarDays, MapPin, Sun, LocateFixed, Clock, Ticket, Users, Image as ImageIcon, ImageOff, Heart, List, ZoomOut } from 'lucide-react';

// Listflikarnas horisont (LIST_HORIZON_DAYS, utils/popularList). Kartan laddar
// bara tidsfönstret (14 dagar, utils/timelineWindow); resten hämtas när man
// scrollar förbi det (requestFullTimeline).

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
    /** FLIKARNA (Josef 23/9, 24/9): "Närmsta månaden" = alla event i kartans
     *  ruta de närmaste 30 dagarna (hette "Alla"/"2 veckor" en stund 24/9),
     *  "🔥 Populärt" = de populära av dem — båda från den visade dagen och
     *  framåt, dag för dag. Den gamla "I närheten"-listan (närmast det valda
     *  eventet) ersattes 24/9: siffran och ordningen stämde inte med "i
     *  närheten". Utelämnad onTabChange = gamla närhetslistan utan flikrad. */
    tab?: ListTab;
    onTabChange?: (tab: ListTab) => void;
    /** Antal EVENT per flik (alla dagar från den visade) — flikarnas siffror. */
    allCount?: number;
    popularCount?: number;
    /** Aktiva flikens dagar, redan kapade till synligt antal rader. `ring`
     *  = listans zoomring (8/10): > 0 = kom in när kartan zoomade ut. */
    days?: { dayOffset: number; ring?: number; rows: NearbyItem[] }[];
    /** Antal event per zoomring i aktiva fliken (avdelarnas "N fler"). */
    ringCounts?: number[];
    /** LISTAN ZOOMAR UT (ägarbeslut 8/10): botten zoomar ut kartan i stället
     *  för att ta slut. Utelämnad = "Det var den närmaste månaden". */
    listZoom?: ListZoomEnd;
    daysHasMore?: boolean;
    onLoadMoreDays?: () => void;
    /** Slut på laddade rader men kartan har bara tidsfönstret inne — listans
     *  botten hämtar resten av tidslinjen i stället för att säga "slut". */
    onLoadLaterDays?: () => void;
    /** Hjärtat uppe till höger på varje rad (Josef 28/9) — samma spara-
     *  toggle som kortets hjärta. Utelämnade → inga hjärtan på raderna. */
    savedIds?: Set<string>;
    onToggleSave?: (eventId: string) => void;
    /** DE PÅSLAGNA FILTREN I FLIKRADEN (ägarbeslut 7/10 sent, Josef: "jämte
     *  månadens / populära. då ska det ju synas de kategorier man har
     *  iklickade. eller den filter knappen så man kan lägga till andra"):
     *  en liten blå bricka per vald kategori/källa (tryck = släpp den) och
     *  filtersymbolen, som fäller ut samma kategorirad direkt under flikraden.
     *  Utelämnade filterChips (sökarket - där står raden redan fast) = varken
     *  brickor eller symbol. */
    activeFilters?: ActiveFilter[];
    onRemoveFilter?: (key: string) => void;
    filterChips?: ReactNode;
}

/** Ett påslaget kartfilter som bricka i listans flikrad (7/10 sent). */
export type ActiveFilter = { key: string; emoji: string; label: string };

type ListTab = 'all' | 'popular';

type ListZoomEnd = {
    /** ready = botten zoomar ut av sig själv när man scrollat dit,
     *  zooming = kartan zoomar ut just nu, idle = senaste steget gav inget
     *  nytt (än) - bara knappen, inget auto-steg. */
    state: 'ready' | 'zooming' | 'idle';
    onZoomOut: () => void;
    /** Auto-stegets grind: man har scrollat VIDARE sedan förra steget. */
    canAuto: () => boolean;
};

/** LISTANS BOTTEN ZOOMAR UT (ägarbeslut 8/10, Josef: "när man scrollat ner
 *  i listan för man redan sett allt denna månaden på eventkorten. Då ska ju
 *  kartan zooma ut"): samma observer-grepp som AutoLoadMore, men steget tas
 *  bara när botten glider IN i bild och man scrollat sedan förra steget -
 *  ett steg som gav få rader (botten kvar i bild) kedjar inte vidare av sig
 *  självt. Knappen är reserv, och vägen vidare när ett steg inte gav något. */
function ListEndZoom({ state, onZoomOut, canAuto, bare = false }: ListZoomEnd & { bare?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const autoRef = useRef<() => void>(() => {});
    useEffect(() => {
        autoRef.current = () => { if (state === 'ready' && canAuto()) onZoomOut(); };
    });
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(
            entries => { if (entries.some(e => e.isIntersecting)) autoRef.current(); },
            { rootMargin: '0px 0px 120px 0px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref} className={`px-4 md:px-6 flex flex-col items-center gap-2 ${bare ? 'pb-5' : 'py-4 border-t border-border'}`}>
            {state === 'zooming' ? (
                <span role="status" className="inline-flex items-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest text-[#006AA7] dark:text-sky-400">
                    <span aria-hidden className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-zinc-600 border-t-[#006AA7] dark:border-t-sky-400 animate-spin" />
                    Zoomar ut…
                </span>
            ) : (
                <>
                    {!bare && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {state === 'idle' ? 'Inget nytt runtomkring än' : 'Det var den närmaste månaden här'}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onZoomOut}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#006AA7] text-white px-4 py-2 text-[11px] font-black uppercase tracking-widest hover:bg-[#005590] active:scale-95 transition"
                    >
                        <ZoomOut size={13} strokeWidth={2.5} aria-hidden />
                        {state === 'idle' ? 'Zooma ut mer' : 'Zooma ut · fler runtomkring'}
                    </button>
                </>
            )}
        </div>
    );
}

/** Avdelaren där listans nästa zoomring börjar (8/10, "visa på när de
 *  börjar"): samma formspråk som kartans zoom-ut-banner - vågräta streck
 *  som växer ut från mitten och "{DAG} IGEN", för listan börjar om från den
 *  visade dagen med eventen som kom in runtomkring. */
function ZoomRingDivider({ count, dayOffset }: { count: number; dayOffset: number }) {
    return (
        <div
            role="separator"
            aria-label={`Kartan zoomade ut - ${count} fler event runtomkring, från ${getDayLabel(dayOffset).toLowerCase()} igen`}
            className="px-4 md:px-6 pt-5 pb-3 flex items-center gap-3 border-t border-border"
        >
            <span aria-hidden className="zoomout-line zoomout-line-l flex-1 h-[3px] rounded-full bg-[#006AA7] dark:bg-sky-400" />
            <span aria-hidden className="shrink-0 flex flex-col items-center gap-1 rounded-2xl bg-slate-900 dark:bg-zinc-800 text-white px-4 py-2 shadow-lg">
                <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest leading-none">
                    <ZoomOut size={14} strokeWidth={2.5} />
                    Zoomade ut
                </span>
                <span className="text-[12px] font-black uppercase tracking-wider leading-none text-[#FECC02] whitespace-nowrap">
                    {getDayLabel(dayOffset)} igen · {count} fler
                </span>
            </span>
            <span aria-hidden className="zoomout-line zoomout-line-r flex-1 h-[3px] rounded-full bg-[#006AA7] dark:bg-sky-400" />
        </div>
    );
}

/** Laddar nästa sida automatiskt när den skymtar fram (rootMargin = lite
 *  före botten) — flikarnas daglistor ska bara fortsätta framåt i dagarna
 *  när man scrollar. Knappen under är reserv för webbläsare utan observern. */
function AutoLoadMore({ onLoadMore, label = 'Visa fler' }: { onLoadMore: () => void; label?: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const cbRef = useRef(onLoadMore);
    cbRef.current = onLoadMore;
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const io = new IntersectionObserver(
            entries => { if (entries.some(e => e.isIntersecting)) cbRef.current(); },
            { rootMargin: '300px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);
    return (
        <div ref={ref} className="px-4 md:px-6 py-3 flex justify-center border-t border-border">
            <button
                type="button"
                onClick={onLoadMore}
                className="text-[11px] font-black uppercase tracking-widest text-[#006AA7] hover:text-[#005590] px-4 py-2"
            >
                {label}
            </button>
        </div>
    );
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
 *  bildlänk rapporteras uppåt via onFailed (raden avgör om den faller
 *  tillbaka till sin bildlösa layout - bara om ingen ser bytet). */
function LazyRowImage({ src, alt, className, onFailed }: {
    src: string;
    alt: string;
    className?: string;
    onFailed?: () => void;
}) {
    const holderRef = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    // Trasig länk: ramen står kvar tom (raden avgör om den ska bort, se
    // NearbyRow) - ingen trasig-bild-ikon i den.
    const [failed, setFailed] = useState(false);
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
            {inView && !failed && (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onError={() => { setFailed(true); onFailed?.(); }}
                    className="w-full h-full object-cover animate-in fade-in duration-300"
                />
            )}
        </div>
    );
}

/** Omslagsbilder som redan felat den här sessionen - nästa rad med samma länk
 *  (ny lista, annan flik) renderas bildlös från start i stället för att
 *  försöka igen och byta layout framför ögonen. */
const failedCoverImages = new Set<string>();

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

function NearbyRow({ evt, distanceKm, now, onSelect, showImages = true, hideWithoutImage = false, dups, saved = false, onToggleSave }: {
    evt: LinkEvent;
    distanceKm: number | null;
    now: number;
    onSelect: (evt: LinkEvent) => void;
    /** Hjärtat uppe till höger (Josef 28/9). Ligger som SYSKON till radens
     *  <button> (absolut positionerat) — knapp-i-knapp är ogiltig HTML. */
    saved?: boolean;
    onToggleSave?: () => void;
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
    // Trasig bildlänk (Josef 29/9: "eventen i listan hoppar runt igen" -
    // bl.a. ~540 biblioteksevent med https://…:80/-bilder som aldrig laddar).
    // Bilden hämtas först när raden närmar sig, så felet kom ofta när raden
    // redan syntes: den försvann (bildflödet) eller krympte till kompakt-
    // läget, och allt under hoppade ~145 px. Nu faller raden bara tillbaka
    // när den fortfarande ligger UNDER kortets synliga yta (ingen ser
    // bytet); annars står bildramen kvar tom i samma höjd. En redan känd
    // trasig länk (failedCoverImages) renderas bildlös direkt vid mount.
    const rowRef = useRef<HTMLLIElement>(null);
    const [imgFailed, setImgFailed] = useState<'no' | 'fallback' | 'keepFrame'>(
        () => (evt.coverImage && failedCoverImages.has(evt.coverImage) ? 'fallback' : 'no'),
    );
    const handleImgFailed = () => {
        if (evt.coverImage) failedCoverImages.add(evt.coverImage);
        const li = rowRef.current;
        const viewBottom = li?.closest('[data-card-scroll]')?.getBoundingClientRect().bottom ?? window.innerHeight;
        setImgFailed(li && li.getBoundingClientRect().top >= viewBottom ? 'fallback' : 'keepFrame');
    };
    const hasImage = showImages && !!evt.coverImage && imgFailed !== 'fallback';
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

    // Hjärtat (spara-toggeln) uppe till höger — utanför radknappen och
    // absolut positionerat, med mörk platta på bilden och naket i den
    // kompakta layouten.
    const heartBtn = (over: boolean) => onToggleSave && (
        <button
            type="button"
            aria-pressed={saved}
            aria-label={saved ? 'Ta bort från sparade' : 'Spara eventet'}
            title={saved ? 'Ta bort från sparade' : 'Spara eventet'}
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            className={`absolute top-2 right-2.5 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                over
                    ? `bg-black/40 backdrop-blur-sm ${saved ? 'text-red-500' : 'text-white hover:text-red-400'}`
                    : saved ? 'text-red-500' : 'text-slate-400 dark:text-zinc-500 hover:text-red-500'
            }`}
        >
            <Heart size={15} className={saved ? 'fill-current' : ''} />
        </button>
    );

    // Rad MED bild: bilden kant till kant överst. Titeln ligger OVANPÅ bilden
    // (emojin till vänster på samma rad) och status-badgen i bildens höger-
    // kant — allt på en mörk gradient så texten alltid är läsbar, även på
    // ljusa bilder/platshållaren. Inforaden ligger under bilden.
    if (hasImage) {
        return (
            <li ref={rowRef} className="relative">
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
                            onFailed={handleImgFailed}
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
                            {/* KATEGORIN nere till höger på bilden (Josef 16/9).
                                KORTFORMEN — samma enda ord som står under
                                eventmarkörerna på kartan (categoryLabel), inte
                                EVENT_CATEGORIES långa etiketter: samma sak ska
                                heta samma sak på båda ytorna. Samma glas-pill
                                som ×N-brickan, sist i raden = längst till höger. */}
                            <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/25 backdrop-blur-sm text-[10px] font-black uppercase tracking-wider text-white whitespace-nowrap">
                                {categoryLabel(evt.category)}
                            </span>
                        </div>
                    </div>
                    <div className="px-4 md:px-6 py-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">{infoRow}</div>
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                    </div>
                </button>
                {heartBtn(true)}
                {dups && dups.length > 0 && (
                    <NearbyDupList dups={dups} repTitle={evt.title} onSelect={onSelect} className="px-4 md:px-6 pb-2.5 -mt-0.5" />
                )}
            </li>
        );
    }

    // Rad UTAN bild: kompakt som förut — emoji-bricka till vänster, titel +
    // badges, inforaden under. Höger padding lämnar plats åt hjärtat.
    return (
        <li ref={rowRef} className="relative">
            <button
                type="button"
                onClick={() => onSelect(evt)}
                className={`w-full text-left pl-4 md:pl-6 py-2.5 flex items-center gap-3 hover:bg-white dark:hover:bg-zinc-800/60 transition-colors ${onToggleSave ? 'pr-11 md:pr-12' : 'pr-4 md:pr-6'}`}
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

function NearbyEventsList({ upcomingItems, upcomingTotal, upcomingCount, pastItems, now, onSelect, onLoadMore, coachMarkerRef, imagesOnly = false, showImages, onToggleImages, tab = 'all', onTabChange, allCount = 0, popularCount = 0, days = [], ringCounts = [], listZoom, daysHasMore = false, onLoadMoreDays, onLoadLaterDays, savedIds, onToggleSave, activeFilters = [], onRemoveFilter, filterChips }: NearbyEventsListProps) {
    const [showPast, setShowPast] = useState(false);
    // Kategoriraden utfälld under flikraden (filtersymbolen, 7/10 sent).
    const [chipsOpen, setChipsOpen] = useState(false);
    // I bildflödes-läget (imagesOnly) ignoreras valet — bilderna är PÅ.
    const effectiveShowImages = imagesOnly || showImages;
    // Ankaret sätts efter det 4:e eventet (0-indexerat: 3) — eller sista raden
    // om listan är kortare — så "ser minst 4"-villkoret blir sant först när man
    // scrollat ända ner hit.
    const markerIdx = Math.min(3, upcomingItems.length - 1);
    return (
        <div className="w-full bg-slate-50 dark:bg-zinc-900/40 border-t border-border">
            {/* Flikraden har FAST höjd (h-11) i flikläget: dagrubrikerna nedan
                är sticky top-11 och ska fästa exakt under den — ändras höjden
                här måste top-11 följa med. */}
            {/* sticky top-0 fäster vid scrollcontainerns PADDING-kant — pt-6
                (grip-zonen) ingår, så raden hamnar precis under den solida
                zonen. top-6 gav dubbel offset (glipa där innehåll syntes).
                --card-sticky-top = toppradens höjd när den syns (emoji +
                titel + svarsknapparna, 7/10 sent) - flikraden fäster under
                den; 0 annars. */}
            <div data-tab-zone className={`px-4 md:px-6 sticky top-[var(--card-sticky-top,0px)] bg-slate-50/95 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-border z-10 flex items-center justify-between gap-3 ${onTabChange ? 'h-11' : 'py-3'}`}>
                {/* Flikarna + de påslagna filtren rullar i sidled när raden
                    blir trång; filtersymbolen och bildknappen står kvar. */}
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
                {onTabChange ? (
                    <div
                        role="tablist"
                        aria-label="Lista"
                        className="flex items-center gap-1 rounded-full bg-slate-200/70 dark:bg-zinc-800 p-0.5 shrink-0"
                        // Klick i den grå containerns kant/glipa (utanför själva
                        // pillret) ska räknas som flikklick (Josef 28/9) —
                        // närmaste fliken på X-led får det.
                        onClick={(e) => {
                            const t = e.target as HTMLElement;
                            if (t.closest('button')) return;
                            const btns = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button[role="tab"]'));
                            const best = btns.reduce<{ el: HTMLElement; d: number } | null>((acc, b) => {
                                const r = b.getBoundingClientRect();
                                const d = e.clientX < r.left ? r.left - e.clientX
                                    : e.clientX > r.right ? e.clientX - r.right : 0;
                                return !acc || d < acc.d ? { el: b, d } : acc;
                            }, null);
                            best?.el.click();
                        }}
                    >
                        {([
                            // "Närmsta månaden" fick inte plats bredvid Populärt
                            // + bildknappen på mobil (173 px) — slutraden säger det.
                            ['all', 'Månaden', allCount],
                            ['popular', '🔥 Populärt', popularCount],
                        ] as const).map(([key, label, count]) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={tab === key}
                                onClick={() => onTabChange(key)}
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${
                                    tab === key
                                        ? key === 'popular'
                                            ? 'bg-white dark:bg-zinc-700 text-[#c2410c] dark:text-orange-300 shadow-sm'
                                            : 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white shadow-sm'
                                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                                }`}
                            >
                                {label} · {count}
                            </button>
                        ))}
                    </div>
                ) : (
                    <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Fler event i närheten · {upcomingCount}
                    </span>
                )}
                {filterChips && activeFilters.map(f => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => onRemoveFilter?.(f.key)}
                        aria-label={`Släpp filtret ${f.label}`}
                        title={`Visar bara ${f.label.toLowerCase()} - tryck för att släppa`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#006AA7] text-white pl-2 pr-1.5 py-1 text-[10px] font-black uppercase tracking-wider whitespace-nowrap hover:bg-[#005590] active:scale-95 transition"
                    >
                        <span aria-hidden className="normal-case">{f.emoji}</span>
                        {f.label}
                        <XIcon size={10} strokeWidth={3} aria-hidden />
                    </button>
                ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                {filterChips && (
                    <button
                        type="button"
                        onClick={() => setChipsOpen(o => !o)}
                        aria-pressed={chipsOpen}
                        aria-label={chipsOpen ? 'Dölj kategorierna' : 'Filtrera på kategori'}
                        title={chipsOpen ? 'Dölj kategorierna' : 'Filtrera på kategori'}
                        className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                            chipsOpen || activeFilters.length > 0
                                ? 'bg-[#006AA7] text-white'
                                : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-[#006AA7]'
                        }`}
                    >
                        <FilterIcon size={13} strokeWidth={2.5} aria-hidden />
                    </button>
                )}
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
                        {/* Klartext på knappen (Josef 27/9: "skriv visa bilder
                            på den knappen, så blir det tydligare" — river
                            24/9-beslutet att bara ikonen får plats bredvid
                            flikraden; flikraden scrollar i sidled om det blir
                            trångt). */}
                        <span className="whitespace-nowrap">{showImages ? 'Dölj bilder' : 'Visa bilder'}</span>
                    </button>
                )}
                </div>
            </div>
            {/* Filtersymbolens kategorirad - SAMMA rad som kortets och
                sökarkets (sidan bygger den), utanför sticky-zonen så
                dagrubrikernas top-11 fortfarande stämmer. */}
            {chipsOpen && filterChips && (
                <div className="bg-white/70 dark:bg-zinc-900/60 border-b border-border">{filterChips}</div>
            )}

            {onTabChange ? (
                <>
                    {days.length === 0 && (
                        <p className="px-4 md:px-6 py-6 text-center text-xs font-bold text-slate-500">
                            {tab === 'popular'
                                ? 'Inga populära event i kartans vy just nu. Zooma ut eller flytta kartan.'
                                : 'Inga fler event i kartans vy just nu. Zooma ut eller flytta kartan.'}
                        </p>
                    )}
                    {days.map((day, di) => {
                        // Coach-ankaret efter 4:e raden i hela listan (över dagsgränser).
                        const before = days.slice(0, di).reduce((n, d) => n + d.rows.length, 0);
                        const ring = day.ring ?? 0;
                        // Första dagen i en ny zoomring: avdelaren före den.
                        const ringStart = ring > 0 && (di === 0 || (days[di - 1].ring ?? 0) !== ring);
                        return (
                            <Fragment key={`${ring}:${day.dayOffset}`}>
                            {ringStart && <ZoomRingDivider count={ringCounts[ring] ?? 0} dayOffset={day.dayOffset} />}
                            <section>
                                {/* Klistrad dagrubrik (Josef 27/9: "den dagen man
                                    är på ska stanna i toppen tills man scrollar
                                    ner till nästa dag") — samma grepp som väljar-
                                    listans dagrubriker: sticky mot kortets
                                    scrollcontainer, hålls kvar av sin egen
                                    <section> och knuffas ut av nästa dags rubrik.
                                    top-11 = flikradens fasta höjd (h-11, sticky
                                    top-0 z-10 ovanför; offsets räknas från
                                    padding-kanten så grip-zonens pt-6 ingår);
                                    z-[9] så rubriken glider IN UNDER flikraden
                                    när den knuffas ut. Plus toppradens höjd
                                    (--card-sticky-top) när den syns. */}
                                <h3 className="sticky top-[calc(var(--card-sticky-top,0px)_+_2.75rem)] z-[9] bg-slate-50/95 dark:bg-zinc-900/90 backdrop-blur-sm px-4 md:px-6 pt-3 pb-2 border-b border-border flex items-center gap-2">
                                    {/* Blått streck + tydlig dagtext (Josef 28/9:
                                        "typ som på stadssidorna så man ser dagar
                                        lite tydligare") — samma formspråk som
                                        stadssidornas dagrubriker. -ml-3 = streckets
                                        bredd + gapet: strecket hänger i vänster-
                                        marginalen så dagTEXTEN står i linje med
                                        radernas innehåll (Josef: "Onsdag i linje
                                        med allt annat, strecket åt vänster"). */}
                                    <span aria-hidden className="shrink-0 -ml-3 h-4 w-1 rounded-full bg-[#006AA7] dark:bg-sky-400" />
                                    <span className="text-sm font-black text-slate-900 dark:text-zinc-100">
                                        {getDayLabel(day.dayOffset)}
                                    </span>
                                </h3>
                                <ul className="divide-y divide-border">
                                    {day.rows.map(({ evt, distanceKm, dups }, i) => (
                                        <Fragment key={evt.id}>
                                            <NearbyRow evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} dups={dups} saved={!!savedIds?.has(evt.id)} onToggleSave={onToggleSave ? () => onToggleSave(evt.id) : undefined} />
                                            {before + i === 3 && coachMarkerRef && (
                                                <li ref={coachMarkerRef} aria-hidden className="h-px" />
                                            )}
                                        </Fragment>
                                    ))}
                                </ul>
                            </section>
                            </Fragment>
                        );
                    })}
                    {daysHasMore && onLoadMoreDays && <AutoLoadMore onLoadMore={onLoadMoreDays} />}
                    {!daysHasMore && onLoadLaterDays && <AutoLoadMore onLoadMore={onLoadLaterDays} label="Hämtar fler dagar…" />}
                    {!daysHasMore && !onLoadLaterDays && (listZoom ? (
                        // Botten zoomar ut kartan (8/10) - också under en tom
                        // flik, där texten ovan redan säger "Zooma ut".
                        <ListEndZoom {...listZoom} bare={days.length === 0} />
                    ) : days.length > 0 && (
                        <p className="px-4 md:px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border-t border-border">
                            Det var den närmaste månaden
                        </p>
                    ))}
                </>
            ) : (<>
            <ul className="divide-y divide-border">
                {upcomingItems.map(({ evt, distanceKm, dups }, i) => (
                    <Fragment key={evt.id}>
                        <NearbyRow evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} dups={dups} saved={!!savedIds?.has(evt.id)} onToggleSave={onToggleSave ? () => onToggleSave(evt.id) : undefined} />
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
                                <NearbyRow key={evt.id} evt={evt} distanceKm={distanceKm} now={now} onSelect={onSelect} showImages={effectiveShowImages} hideWithoutImage={imagesOnly} dups={dups} saved={!!savedIds?.has(evt.id)} onToggleSave={onToggleSave ? () => onToggleSave(evt.id) : undefined} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
            </>)}
        </div>
    );
}

/** En post i kortets bakåt-/framåthistorik: eventet OCH dagen det låg på,
 *  så Bakåt/Nästa kan ta en över ett dagbyte (Josef 2/9: "klickar man på
 *  Nästa så man byter dag ska man kunna klicka på tillbaka-knappen igen").
 *  Eventobjektet sparas hellre än bara id:t — en annan dags event finns
 *  inte i `events` (dagens lista) och behövs ändå för emoji-förhandsvisningen. */
type NavEntry = { evt: LinkEvent; dayOffset: number; spot?: ListSpot };

/** VAR MAN STOD I KORTETS LISTA när man valde ett event ur den (ägarbeslut
 *  8/10, Josef: "så att man kan gå tillbaka och se precis där man var
 *  någonstans i listan, så man kan fortsätta sin sökning"). Bakåt och
 *  "← tillbaka till listan" lägger tillbaka väljarlistan (om den var
 *  framme), fliken, de laddade sidorna, zoomringarna, vyn och scrollen. */
type ListSpot = {
    /** Eventet som valdes ur listan - listpilen visas bara på det. */
    pickedId: string;
    scrollTop: number;
    daysVisible: number;
    tab: ListTab;
    rings: ReadonlySet<string>[];
    view: 'info' | 'chat' | 'nearby';
    /** Multieventets väljarlista som var framme, annars null. */
    group: LinkEvent[] | null;
    /** Arkets höjd - bara sökarkets post (där öppnas arket igen). */
    heightVh?: number;
};

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
    /** Redigera sitt eget event — öppnar skapa-formuläret förifyllt (6/9). */
    onEditOwnEvent?: (evt: LinkEvent) => void;
    /** Boosta (featura) ett event — startar Stripe Checkout på vald nivå
     *  (nivåerna ägs av BOOST_TIERS; väljs i kortets BoostTierPicker). */
    onBoostOwnEvent?: (eventId: string, tier: BoostTier) => void;
    /** Värdnamnet i kortet filtrerar kartan till arrangörens event (29/9). */
    onSelectOrganizer?: (slug: string, name: string) => void;
    /** Göm "Inga event den här dagen"-rutan (arrangörsläget, 30/9). */
    hideEmptyHint?: boolean;
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
    /** Underlaget till listans flikar (Alla · 🔥 Populärt): eventen i KARTANS
     *  RUTA som passerar kartans filter, ALLA dagar inom datahorisonten (sidan
     *  äger vyn). Kortet delar dem i dagar från den visade dagen och framåt
     *  (utils/popularList). Utelämnad = gamla närhetslistan utan flikrad. */
    viewEvents?: LinkEvent[];
    /** KOMMER/INTRESSERAD-FOOTERN (6/10, spår 3): eget svar för det VALDA
     *  eventet + handlers. Utan onSetRsvp → ingen footer. */
    myRsvp?: EventRsvpStatus | null;
    onSetRsvp?: (evt: LinkEvent, status: EventRsvpStatus) => void;
    /** Bjud med någon: sätter Kommer + öppnar delningsarket (sidan äger flödet). */
    onInviteFriend?: (evt: LinkEvent) => void;
    /** Inbjudningsbannern (?inb=1&fran=): visas när eventId matchar det valda. */
    cardInvite?: { eventId: string; fran: string | null } | null;
    onDismissInvite?: () => void;
    /** "Fler från samma arrangör"-raden (6/10) — sidan räknar fram den över
     *  ALLA laddade dagar (kortets events-prop är dagfiltrerad). */
    organizerRow?: OrganizerRowData | null;
    /** Kategorichipsen i kortet (6/10): SAMMA filter som kartan/sökpanelen —
     *  sidan skickar en färdig CategoryChipRow (tone="light"), så kortet
     *  varken räknar eller håller eget state. */
    filterChips?: ReactNode;
    /** Kartfiltret är på (kategorier/🔥/källa) — sök/filter-ikonen i kortets
     *  knapprad lyser blått även med blocket stängt (7/10). */
    cardFilterOn?: boolean;
    /** Stadssidelänken under arrangörsraden — samma mål som topplattan. */
    cityLink?: { href: string; label: string };
    /** SÖKARKET (7/10 kväll, Josef: "ha en vanlig filtersymbol där. om man
     *  klickar på den öppnar eventkortet, men bara med sök och att vi visa
     *  filterna och inga event"): filterknappen uppe till höger öppnar arket
     *  — sökfältet + kategorichipsen utan något valt event; träffarna
     *  (listan) dyker upp först när man söker. Stängs av sidan när ett event
     *  väljs. */
    searchSheet?: boolean;
    onCloseSearchSheet?: () => void;
    /** 🔥-filtret är på (popularOnly) — kopplar listan till Populärt-fliken
     *  (7/10 kväll, Josef: "den filterknappen där det står populära = hur
     *  många som står åt höger om månaden"). */
    popularFilterOn?: boolean;
    /** Påslagna kategorier/källa som brickor i listans flikrad (7/10 sent,
     *  se NearbyEventsList) - sidan bygger listan, kortet släpper via
     *  onRemoveFilter. */
    activeFilters?: ActiveFilter[];
    onRemoveFilter?: (key: string) => void;
    /** NÄSTA ZOOMAR UT (ägarbeslut 7/10 sent): eventen i bild är genomgångna
     *  men perioden har obesökta event utanför bild → sidan zoomar ut kartan
     *  kring samma mitt tills målet syns (utils/viewportTour) och blinkar
     *  dagplattan. Utelämnad = rakt till nästa dag som förut. */
    onZoomOutTo?: (target: LinkEvent) => void;
    /** LISTAN ZOOMAR UT (ägarbeslut 8/10): listans botten zoomar ut kartan
     *  kring samma mitt (sidan väljer hur långt) och listan fortsätter med
     *  de nya eventen under en avdelare (utils/listZoomRings). Utelämnad =
     *  listan slutar som förut (utzoomat förbi golvet). */
    onListZoomOut?: (popularTab: boolean) => void;
    /** Öppnar sökarket igen (sidans openSearchSheet) - ← ☰ på en träff man
     *  valt ur arket tar en tillbaka till sökningen (8/10). */
    onOpenSearchSheet?: () => void;
}

export default function EventCard({ events, dayCount, eventsLoaded = true, eventsSettled = true, selectedEvent, onSelectEvent, groupChoice = null, onPickFromGroup, onBackToGroup, backToGroupCount = 0, onSelectGroup, onSaveEvent, onDiscardEvent, discardedEventIds, savedEventIds, userPos, onUnsaveEvent, onCardExpandedChange, onNavigate, pinShotHits = 0, dayOffset, dayRangeDays = 1, onDayRangeChange, inView, nextDayOffset = null, onDayStep, onSunClick, mainCloudOffScreen, sunCloudOffScreen, onRecallMainCloud, onRecallSunCloud, recallMainBlink, onRecenter, recenterBlink, slingshotReady, slingshotEngaged, gameMode = false, onRequireLogin, currentUserUid, onDeleteOwnEvent, onEditOwnEvent, onBoostOwnEvent, onSelectOrganizer, hideEmptyHint = false, starredEventIds, canPlaceStar = false, onPlaceStar, fullOpenNonce = 0, viewEvents, myRsvp = null, onSetRsvp, onInviteFriend, cardInvite = null, onDismissInvite, organizerRow = null, cityLink, filterChips, cardFilterOn = false, searchSheet = false, onCloseSearchSheet, popularFilterOn = false, activeFilters, onRemoveFilter, onZoomOutTo, onListZoomOut, onOpenSearchSheet }: EventCardProps) {
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
    // Reservvärde för kompaktlägets höjd (se measureCompactHeight) när
    // sträcket under tid/plats inte går att mäta.
    const COLLAPSED_HEIGHT_VH = 22;
    // Minsta nedåtdrag (i vh) för att ett släpp ska räknas som ett medvetet
    // "scrolla ner"-snäpp (helskärm → default, default → kompakt, kompakt →
    // stängt; se onPointerUp) - kortare ryck studsar tillbaka dit gesten
    // började.
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
    // 22 vh. Det vanliga kortet öppnar på header + bildremsa ≈ 335 px
    // (mobil): luft 28 (grip-zonen 24 + pt-1) + knapprad 40 + titelrad 57 +
    // tidsrad 36 + Värd/Pris 52 + remsan 122 (DEFAULT_STRIP_PX; 60 → 110 den
    // 16/9, 122 den 30/9 när luften överst minskade 12 px - Josef: "så de
    // ändå behåller höjden"). Listan öppnar
    // på EXAKT den höjden (Josef 16/9: "samma höjd som när man öppnar ett
    // vanligt") — hela-rader-snäppet (2/9) landade på 290 px eftersom
    // raderna slutar på 290/353, och en halv rad i vikningen visar dessutom
    // att listan går att scrolla. Ryms hela listan blir kortet lägre.
    // Tillbaka på 335 sedan 7/10: kortsöket är ihopfällt bakom ikonen i
    // knappraden som default, så det vanliga kortets öppningshöjd är åter
    // header + bildremsa (16/9-måttet).
    const CHOOSER_DEFAULT_PX = 335;
    // Bildremsan under Värd/Pris-raden i standardhöjden (se measureDefaultHeight).
    const DEFAULT_STRIP_PX = 122;

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

    // SÖKARKET (7/10 kväll): filterknappen uppe till höger öppnar kortet UTAN
    // event — bara sökfältet + chipsen, listan först när man söker. Samma
    // ark/gester som vanliga kortet; ref-spegel av samma skäl som chooserns.
    const searchOnly = searchSheet && !selectedEvent;
    const searchOnlyRef = useRef(searchOnly);
    useLayoutEffect(() => { searchOnlyRef.current = searchOnly; }, [searchOnly]);
    // Sökarkets öppningshöjd: sökraden + chipsraden, inget mer ("inga event").
    const SEARCH_SHEET_PX = 190;
    const searchSheetVh = () =>
        Math.max(PEEK_HEIGHT_VH, Math.min(60, Math.round((SEARCH_SHEET_PX / window.innerHeight) * 100)));

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
    // SIDOPANELSLÄGET (ägarbeslut 6/10, Josef: "på datorn när man har den
    // tillräckligt bred skärm så bara sätt eventkortet på sidan"): på
    // xl-skärmar (≥1280 px) dockar kortet som en HÖG PANEL till vänster i
    // stället för bottenark i mitten. Drag- och hjulsnäppen är AV (gesterna
    // returnerar tidigt; updateHeightVh klampar upp alla öppningshöjder, bara
    // stängningen släpps igenom) — innehållet scrollar direkt, och stads-/
    // arrangörslänkarna (CardMoreRows) nås utan att dra upp något.
    const SIDE_HEIGHT_VH = 80;
    const [sideMode, setSideMode] = useState(false);
    const sideModeRef = useRef(false);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1280px)');
        const apply = () => { sideModeRef.current = mq.matches; setSideMode(mq.matches); };
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
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
        // Sidopanelen (xl): kortet står alltid högt — alla öppnings- och
        // snäpphöjder klampas upp till panelhöjden; bara stängningen (≤8 vh,
        // closeCard:s glid) släpps igenom.
        if (sideModeRef.current && vh > 8) vh = Math.max(vh, SIDE_HEIGHT_VH);
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
    // Listans flik (Josef 23/9). Följer med mellan event — väljer man något
    // ur Populärt ska listan under det nya kortet fortfarande vara Populärt.
    const [listTab, setListTab] = useState<ListTab>('all');
    const [daysVisibleCount, setDaysVisibleCount] = useState(NEARBY_PAGE_SIZE);
    // LISTAN ZOOMAR UT (ägarbeslut 8/10): frysta id-mängder, en per
    // utzoomning från listans botten (utils/listZoomRings). Nollas med
    // eventet - nästa kort börjar om på kartans nya zoomsteg.
    const [listRings, setListRings] = useState<ReadonlySet<string>[]>([]);
    // Var man stod i SÖKARKETS lista när man valde en träff (8/10) - ← ☰ på
    // det valda eventet öppnar arket igen där (sökord, lista, scroll, höjd).
    const [searchReturn, setSearchReturn] = useState<ListSpot | null>(null);
    const [listZoomPending, setListZoomPending] = useState(false);
    // scrollTop vid senaste steget: auto-steget kräver att man scrollat
    // VIDARE sedan dess, annars kunde ett steg som gav få rader (botten
    // fortfarande i bild) kedja vidare utan att man rört listan.
    const listZoomScrollRef = useRef(0);
    // 🔥-CHIPPET STYR FLIKEN (7/10 kväll, Josef: "den filterknappen där det
    // står populära = hur många som står åt höger om månaden" — chipvalet
    // smalnade bara kartan, listans Månaden-flik stod orörd och chippet såg
    // trasigt ut): slås 🔥 på hoppar listan till Populärt-fliken, släpps det
    // tillbaka till Månaden. Flikens egna knappar funkar som vanligt emellan.
    useEffect(() => {
        setListTab(popularFilterOn ? 'popular' : 'all');
        setDaysVisibleCount(NEARBY_PAGE_SIZE);
    }, [popularFilterOn]);
    // Kortlagret (bilder, värd, pris) hämtas först när ett kort öppnas. Innan
    // det landat har bara användarevent en bild, så bildflödet ritades först
    // med en handfull av dem och byttes sedan ut HELT ~1 s senare (uppmätt
    // 29/9: "Temakurs …" → "Trädgårdsdagar …"). Listan väntar in lagret och
    // visar "Letar fler event…" så länge - en gång per session.
    const [cardsReady, setCardsReady] = useState(() => linkEventService.cardsSettledNow());
    // Sökarket räknas som öppet kort: listan som dyker upp vid sökning ska ha
    // kortlagrets bilder/värdar precis som vanliga listan.
    const cardOpen = !!selectedEvent || searchOnly;
    useEffect(() => {
        if (cardsReady || !cardOpen) return;
        let alive = true;
        linkEventService.requestCards().then(() => { if (alive) setCardsReady(true); });
        // Säkerhetsnät: aggregatens felväg (catch → getAll) signalerar aldrig
        // kortlagret - hellre en lista som byggs om en gång än en evig snurra.
        const safety = setTimeout(() => { if (alive) setCardsReady(true); }, 8000);
        return () => { alive = false; clearTimeout(safety); };
    }, [cardsReady, cardOpen]);
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
    // VAL UR KORTETS LISTA (8/10): ett nytt ankare som ett kartklick
    // ("LISTVAL = SOM ETT KARTKLICK", 7/10), men bakåt-stacken står kvar -
    // dess översta post bär var man stod i listan (ListSpot).
    const listPickIdRef = useRef<string | null>(null);
    // Bakåt till en ListSpot väntar på att eventet (och ev. väljarlistan)
    // landat innan listan läggs tillbaka - se återställnings-effekten.
    const pendingSpotRef = useRef<{ evtId: string; spot: ListSpot; groupAsked: boolean; armedAt: number; search?: boolean } | null>(null);
    // VAL UR SÖKARKET (8/10): kortet öppnas på arkets höjd i stället för att
    // hoppa ner till default-höjden ("då ska ju inte det fönstret man är på
    // ändras i höjd led"), och ← ☰ tar en tillbaka till sökningen.
    const searchPickIdRef = useRef<string | null>(null);
    const restoreRafRef = useRef(0);
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

    // KOMPAKTLÄGET = kortets lägsta stopp (Josef 30/9: "dra ner det så inte
    // arrangören syns, men drar man ner så det sträcket mellan arrangören och
    // tiden försvinner över kanten, så ska den försvinna"): kortets nedre kant
    // på sträcket (border-linjen) under tid + plats - knapprad, titel och
    // tid/plats syns, Värd/Pris-raden är dold under kanten. Samma höjd är
    // stänggränsen: släpps kortet med sträcket under kanten stängs det (se
    // snapRelease i utils/sheetSnap). Mäter var linjen ligger (data-peek-
    // boundary i LinkEventCard) relativt scroll-innehållet, vars topp är
    // kortets överkant (grip-zonen ligger i dess pt-6). null = inget sträck
    // att mäta mot (väljarlistan) → inget kompaktläge.
    const measureCompactHeight = (): number | null => {
        if (chooserActiveRef.current) return null;
        const sc = scrollContainerRef.current;
        if (!sc) return null;
        const line = sc.querySelector('[data-peek-boundary]') as HTMLElement | null;
        if (!line) return null;
        const scRect = sc.getBoundingClientRect();
        const lineRect = line.getBoundingClientRect();
        // Linjens topp relativt scroll-innehållets topp (oberoende av nuvarande
        // korthöjd/scroll).
        const lineTopWithinContent = (lineRect.top - scRect.top) + sc.scrollTop;
        const vh = (lineTopWithinContent / window.innerHeight) * 100;
        // Taket 60 (inte peek-höjdens 22 som förr): på en kort skärm eller med
        // härkomst-raden ligger sträcket högre än 22 vh, och då hade stoppet
        // skurit av tidsraden.
        return Math.max(10, Math.min(60, Math.round(vh)));
    };
    const measureCollapsedHeight = (): number => measureCompactHeight() ?? COLLAPSED_HEIGHT_VH;

    // Sidopanelen: när läget slås PÅ (skärmen breddas eller ett kort öppnas
    // på bred skärm) reser sig kortet till panelhöjden direkt — klampen i
    // updateHeightVh håller den sedan.
    useEffect(() => {
        if (!sideMode || !selectedEvent) return;
        setIsAnimating(true);
        updateHeightVh(Math.max(heightVhRef.current, SIDE_HEIGHT_VH));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sideMode, selectedEvent]);

    // ANMÄL/BOKA i footern (ägarbeslut 7/10: "fixa så anmäl är direkt i
    // anslutning till det" — pillret i knappraden är borttaget): samma
    // schema-vakt (eventOutlink) och klickstatistik som knappradens knapp
    // hade. Guld för Ticketmaster (1/9-beslutet). null = inget utlänks-CTA
    // (VADKUL-värdade event anmäls i kortet).
    const footerCta = useMemo(() => {
        if (!selectedEvent?.url) return null;
        const href = eventOutlink(selectedEvent.id, selectedEvent.url);
        if (!href) return null;
        const gold = isTicketmasterEvent(selectedEvent);
        // Annons-märkningen (affiliate) bor i footern sedan den breda CTA:n
        // i kortet revs (7/10 kväll).
        return { href, gold, label: gold ? 'BOKA' : 'ANMÄL', affiliate: isAffiliateUrl(selectedEvent.url) };
    }, [selectedEvent]);
    // Klickstatistiken för ANMÄL/BOKA - samma för raden i kortet och toppraden.
    const recordCtaClick = () => {
        if (!selectedEvent) return;
        recordEventClick({
            id: selectedEvent.id,
            url: selectedEvent.url,
            title: selectedEvent.title,
            hostName: selectedEvent.hostName,
        });
    };

    // KOMMER/INTRESSERAD-FOOTERN (6/10) visas i infovyn när kortet står ÖVER
    // kompaktläget: i kompaktläget skulle plattan täcka tid/plats-raden som
    // stoppet finns till för att visa (30/9-beslutet). heightVh är den
    // committade höjden (uppdateras när gesten tystnat), så footern blinkar
    // inte under själva draget.
    const rsvpFooterVisible = useMemo(() => {
        if (!selectedEvent || !onSetRsvp || chooserActive || cardView !== 'info') return false;
        const compact = measureCompactHeight();
        return compact === null ? heightVh > 26 : heightVh > compact + 3;
        // measureCompactHeight läser DOM — heightVh i deps räcker som trigger,
        // sträcket flyttar sig bara när innehållet byts (selectedEvent).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, onSetRsvp, chooserActive, cardView, heightVh]);

    // TOPPRADEN (EventRsvpTopBar, ägarbeslut 7/10 sent: "längst uppe om man
    // scrollat förbi ett eventkort. då ska fortfarande intresserad, kommer,
    // .... Alla de ska synas, samt emojin och titeln ska vara kvar"): tänds
    // när svarsradens plats i kortet (ankaret precis före den) scrollat upp
    // under grip-zonen, och står kvar genom chatt, arrangörsrad och listan.
    // Raden i kortet är sticky bottom-0 och toppraden tänds först när dess
    // plats passerat överkanten - de två syns aldrig samtidigt. Höjden
    // (ResizeObserver i toppraden) blir --card-sticky-top på scrollcontainern
    // så listans flikrad + dagrubriker fäster UNDER toppraden i stället för
    // att gömma sig bakom den.
    const rsvpAnchorRef = useRef<HTMLDivElement | null>(null);
    const [rsvpBarOn, setRsvpBarOn] = useState(false);
    const [rsvpBarH, setRsvpBarH] = useState(0);
    useEffect(() => {
        setRsvpBarOn(false);
        const sc = scrollContainerRef.current;
        if (!sc || !rsvpFooterVisible) return;
        let raf = 0;
        const check = () => {
            raf = 0;
            const anchor = rsvpAnchorRef.current;
            if (!anchor) { setRsvpBarOn(false); return; }
            // 24 = grip-zonens höjd (scrollcontainerns pt-6): det som ligger
            // där under är redan täckt.
            const top = anchor.getBoundingClientRect().top - sc.getBoundingClientRect().top;
            setRsvpBarOn(top <= 24);
        };
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
        check();
        sc.addEventListener('scroll', onScroll, { passive: true });
        return () => {
            sc.removeEventListener('scroll', onScroll);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [selectedEvent?.id, rsvpFooterVisible]);

    // Default-höjd när ett kort öppnas: visa HELA headern (titel, tid, plats,
    // värd, pris) + en remsa av bilden — så man direkt ser värden OCH lite av
    // bilden. Mäts mot Värd/Pris-radens botten (data-peek-boundary) + ~110px ner
    // i innehållet (bilden ligger direkt under), eftersom header-höjden varierar.
    // Remsan var 60 px t.o.m. 15/9 — Josef 16/9: "typ 70px högre upp, så man ser
    // lite mer", justerat samma dag till "ta 335px istället" (= remsan 110 px,
    // kortet ≈335 px totalt på mobil). 30/9 minskades luften ovanför
    // knappraden 12 px och remsan växte lika mycket (DEFAULT_STRIP_PX 122) -
    // kortet står kvar på 335 px (Josef). Ändrar du den måste
    // CHOOSER_DEFAULT_PX följa med: väljarlistan ska öppna lika högt som
    // ett vanligt event.
    const measureDefaultHeight = (): number => {
        // SÖKARKET: fast öppningshöjd (sökrad + chips) — inget event att mäta.
        if (searchOnlyRef.current) return searchSheetVh();
        const sc = scrollContainerRef.current;
        if (!sc) return OPEN_HEIGHT_VH;
        // VÄLJARLISTAN (multievent): ingen peek-markör — öppna på
        // CHOOSER_DEFAULT_PX, så kortet står lika högt som ett vanligt event
        // (Josef 2/9 + 16/9). Gäller även korta listor (2 rader, eller 1 kvar
        // när de andra har varit) - Josef 24/9: "ska alltid öppnas lika högt
        // som ett vanligt event". Kortet krymper alltså INTE till listans botten.
        if (sc.querySelector('[data-group-list]')) {
            const vh = (CHOOSER_DEFAULT_PX / window.innerHeight) * 100;
            return Math.max(PEEK_HEIGHT_VH, Math.min(80, Math.round(vh)));
        }
        const peek = sc.querySelector('[data-peek-boundary]') as HTMLElement | null;
        if (!peek) return measureCollapsedHeight();
        const scRect = sc.getBoundingClientRect();
        const peekRect = peek.getBoundingClientRect();
        const targetPx = (peekRect.bottom - scRect.top) + sc.scrollTop + DEFAULT_STRIP_PX;
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
    // KOMPAKTLÄGET (30/9, se measureCompactHeight) är det lägsta stoppet:
    // taket → tapp-höjden → default → kompakt → stängt, med hjul som drag.
    const SNAP_TOLERANCE_VH = 4;
    const sheetStopsNow = (): number[] => sheetStops([
        measureCompactHeight() ?? NaN,
        measureDefaultHeight(),
        // Väljarlistan och sökarket har ingen tapp-höjd (ingen beskrivning).
        ...(chooserActiveRef.current || searchOnlyRef.current ? [] : [measureOpenHeight()]),
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
        dismissTimerRef.current = setTimeout(() => {
            onSelectEvent(null);
            // Sökarket stängs samma väg (drag ner/hjul) — no-op annars.
            onCloseSearchSheet?.();
        }, 260);
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
    // "Kort uppe" för gest-lyssnarna: även sökarket (utan valt event) ska
    // kunna dras/stängas och snäppa mellan sina stopp.
    const hasSelectedEvent = selectedEvent !== null || searchOnly;
    useEffect(() => {
        if (!hasSelectedEvent) return;
        const sc = scrollContainerRef.current;
        if (!sc) return;
        let startedAtTop = false;
        let touchStartY = 0;
        // UNDER TAKET DRAR SVEPET KORTET (Josef 10/9, iPhone): det låg förr i
        // en DYNAMISK touch-action på scrollbehållaren (none under taket, pan-y
        // på taket). iOS WebKit tillämpar inte alltid en sådan ändring på redan
        // ritat innehåll — på taket gick det att scrolla från bilden men
        // "nästan aldrig" från beskrivningstexten eller Anmäl-knappen (gamla
        // none låg kvar där tills området ritades om). Nu är touch-action
        // ALLTID pan-y och det här beslutet fattas i JS: vid gest-START (som
        // förr) avgörs om svepet ska dra kortet, och då hindrar preventDefault
        // webbläsaren från att scrolla — pointermove driver kortet, samma
        // mekanism som dra-ner-vid-toppen nedan. (Gäller ÄVEN väljarlistan
        // sedan 7/10 kväll — 2/9-undantaget är ersatt.)
        let dragsSheet = false;
        // Gesten började i en sidledsrullande rad (HScrollRow, 16/9) som
        // faktiskt rullar över. Då avgörs vid första rörelsen: vågrätt →
        // webbläsaren panorerar raden (ingen preventDefault, touch-action
        // pan-x), lodrätt → kortet dras som vanligt.
        let inHScroll = false;
        let hscrollDecided = false;
        let hscrollOwns = false;
        let touchStartX = 0;
        const onTouchStart = (e: TouchEvent) => {
            // maxVhRef, inte MAX_HEIGHT_VH: effekten binds en gång per valt
            // event, taket följer viewporten (rotation/storlek).
            // Sidopanelen (xl, 6/10): svep scrollar alltid innehållet — drar
            // aldrig panelen (touchskärm på bred laptop/surfplatta).
            // VÄLJARLISTAN DRAR OCKSÅ KORTET sedan 7/10 kväll (Josef: "när
            // man scrollar efter man klickat på ett multi event så ska ju
            // hela det fönstret åka upp. precis som ett vanligt eventkort
            // gör") — 2/9-beslutet "kortet står still, listan scrollar" är
            // ERSATT: chooser-undantaget som stod här är borta.
            dragsSheet = !sideModeRef.current && heightVhRef.current < maxVhRef.current - 5;
            const row = (e.target as HTMLElement).closest('[data-hscroll]') as HTMLElement | null;
            inHScroll = !!row && row.scrollWidth > row.clientWidth + 1;
            hscrollDecided = false;
            hscrollOwns = false;
            touchStartX = e.touches[0].clientX;
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
            if (inHScroll) {
                if (!hscrollDecided) {
                    const dx = Math.abs(e.touches[0].clientX - touchStartX);
                    const dy = Math.abs(e.touches[0].clientY - touchStartY);
                    if (dx <= 4 && dy <= 4) return; // oavgjort ännu — rör inte gesten
                    hscrollDecided = true;
                    hscrollOwns = dx > dy;
                }
                if (hscrollOwns) return; // radens egen rullning, låt webbläsaren ha den
            }
            if (dragsSheet) { if (e.cancelable) e.preventDefault(); return; }
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
            // Sidopanelen (xl, 6/10): inga hjulsnäpp — hjulet scrollar
            // innehållet direkt, som i vilken panel som helst.
            if (sideModeRef.current) return;
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
            // (VÄLJARLISTANS hjul-undantag — "kortet står still, listan
            // scrollar", 2/9 — är ERSATT 7/10 kväll: hjulet stegar kortet
            // genom stoppen även där, precis som ett vanligt kort. Chooserns
            // stopp är default → taket; tapp-höjden finns inte utan
            // beskrivning, se sheetStopsNow.)
            // Scrolla "in i" kortet (fingrar upp / hjul ner) under taket → ETT
            // STOPP UPP (Josef 2/9): default → tapp-höjden → taket. Grinden
            // slukar tröghetssvansen så ett svep aldrig kedjar genom flera
            // stopp. Landar vi på taket hålls resten av gesten (hold nedan) så
            // innehållet inte börjar scrolla förrän nästa gest.
            if (deltaVh > 0 && h < maxVhRef.current) {
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
            // för att glida (Josef 1/9, utökat 2/9 med tapp-höjden och 30/9
            // med kompaktläget): taket → tapp-höjden → default → kompakt, och
            // nästa svep därifrån stänger kortet helt. Grinden (wheelSnapArmedRef) slukar tröghetssvansen så ett
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
            // annars: helskärm + innehållet scrollar → låt hjulet scrolla
            // normalt. (Väljarlistans egen av-spänning av snäpp-grinden är
            // borta med 2/9-undantaget — samma grind-beteende som vanliga
            // kortet gäller överallt.)
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
        const isListPick = listPickIdRef.current === selectedEvent.id;
        listPickIdRef.current = null;
        const isSearchPick = searchPickIdRef.current === selectedEvent.id;
        searchPickIdRef.current = null;
        if (isPickNext) {
            // Intern navigering (Nästa/Bakåt) drev fram detta event — behåll
            // ankare, besökt-set OCH bakåt/framåt-stackarna.
            expectedNextIdRef.current = null;
        } else if (isDayStepLanding || isListPick) {
            // LANDNINGEN efter ett dagbyte via Nästa/Bakåt (Josef 2/9): sidan
            // valde eventet åt oss. Ny dag = ny runda — nytt ankare och tomt
            // besökt-set — men bakåt-/framåtstackarna står KVAR så man kan gå
            // tillbaka över dagbytet (och framåt igen). Samma för ett VAL UR
            // KORTETS LISTA (8/10): nytt ankare som ett kartklick, men
            // stacken behålls - den bär var man stod i listan (ListSpot).
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
            // Ett nytt val utifrån (kartklick) lämnar sökningen - inte
            // träffen man just valde ur sökarket.
            if (!isSearchPick) setSearchReturn(null);
        }

        setIsAnimating(true);
        setCardRevealStep(0); // Återställ till komprimerat läge vid nytt event
        // Default-höjd när kortet öppnas från stängt läge: mäts färskt så
        // bildremsan syns (men inte hela bilden). Byter man event medan kortet
        // redan är öppet behålls höjden (inget hopp).
        // Ett kort som var på väg ner i en stängning (höjd under peek-gränsen)
        // räknas också som ny öppning — annars öppnas det nya eventet osynligt.
        // En träff ur sökarket är INTE en ny öppning: arket står redan uppe
        // och kortet tar över på samma höjd (8/10, "mer statiskt").
        const freshOpen = !isSearchPick && (prevId === null || heightVhRef.current < collapsedVhRef.current);
        isFreshOpenRef.current = freshOpen;
        // Stod kortet i KOMPAKTLÄGET (30/9) följer läget med till nästa event
        // i stället för den råa höjden: sträcket sitter olika högt beroende på
        // härkomst-raden, så samma vh hade skurit av tidsraden eller visat en
        // flik av arrangören. Blir nästa vy väljarlistan (inget kompaktläge)
        // öppnar den på sin vanliga höjd.
        const wasCompact = !freshOpen && Math.abs(heightVhRef.current - collapsedVhRef.current) < 1;
        // Helskärmsbegäran (djuplänken från stadssidorna): förbrukas här, en
        // gång per bump — efterföljande kartklick öppnar som vanligt. En
        // djuplänk är explicit navigering, så den vinner även om ett kort
        // redan råkade vara öppet (då är freshOpen false).
        const wantsFullOpen = fullOpenNonce > consumedFullOpenNonceRef.current;
        if (wantsFullOpen) consumedFullOpenNonceRef.current = fullOpenNonce;
        const raf = requestAnimationFrame(() => {
            const compact = measureCompactHeight();
            collapsedVhRef.current = compact ?? COLLAPSED_HEIGHT_VH;
            if (wantsFullOpen) updateHeightVh(DEEPLINK_HEIGHT_VH);
            else if (freshOpen) updateHeightVh(measureDefaultHeight());
            else if (wasCompact) updateHeightVh(compact ?? measureDefaultHeight());
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
        setDaysVisibleCount(NEARBY_PAGE_SIZE);
        setListRings([]);
        setListZoomPending(false);
        listZoomScrollRef.current = 0;
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        updateDragX(0);
        setIsAnimating(true);
        setCardRevealStep(0); // Återställ bildremsa vid nytt event
        setCardView('info'); // Nytt event öppnar alltid i infovyn (chatt/lista är per event)
    }, [selectedEvent?.id]);

    // Väljarlistan börjar alltid från toppen (Josef 2/9): kortet kan ha stått
    // nedscrollat i ett vanligt event när multibrickan klickades, eller när
    // man backar till listan via pilen — annars låg listan kvar mitt i.
    // Undantag sedan 8/10: Bakåt till en ListSpot lägger tillbaka scrollen
    // (effekten nedan körs efter den här).
    useEffect(() => {
        if (!chooserActive) return;
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }, [chooserActive]);

    // TILLBAKA TILL DÄR MAN VAR I LISTAN (8/10): Bakåt till en ListSpot.
    // Ligger EFTER nollställningarna ovan (eventbytet, väljarlistans topp-
    // scroll) så de körs först i samma commit och det här vinner. Scrollen
    // sätts när innehållet hunnit bli så högt (kortlagret, sidorna) - griper
    // man själv i listan under tiden släpps återställningen.
    const restoreScrollTo = (target: number) => {
        cancelAnimationFrame(restoreRafRef.current);
        const started = performance.now();
        let expected = scrollContainerRef.current?.scrollTop ?? 0;
        const tick = () => {
            const sc = scrollContainerRef.current;
            if (!sc || Math.abs(sc.scrollTop - expected) > 4) return;
            const max = sc.scrollHeight - sc.clientHeight;
            if (max >= target - 2 || performance.now() - started > 2000) {
                sc.scrollTop = Math.min(target, Math.max(0, max));
                return;
            }
            expected = sc.scrollTop;
            restoreRafRef.current = requestAnimationFrame(tick);
        };
        restoreRafRef.current = requestAnimationFrame(tick);
    };
    useEffect(() => () => cancelAnimationFrame(restoreRafRef.current), []);
    useEffect(() => {
        const p = pendingSpotRef.current;
        if (!p || !selectedEvent) return;
        if (Date.now() - p.armedAt > DAY_STEP_LANDING_MS) { pendingSpotRef.current = null; return; }
        if (selectedEvent.id !== p.evtId) return;
        if (p.spot.group && !chooserActive) {
            // Landade via ett dagbyte: väljarlistan måste upp igen först.
            if (!p.groupAsked && onSelectGroup) {
                p.groupAsked = true;
                onSelectGroup(p.spot.group, selectedEvent);
            }
            return;
        }
        pendingSpotRef.current = null;
        setListTab(p.spot.tab);
        setDaysVisibleCount(p.spot.daysVisible);
        setListRings(p.spot.rings);
        if (!chooserActive) setCardView(p.spot.view);
        restoreScrollTo(p.spot.scrollTop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, chooserActive]);

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

    // KORTSÖKET (ägarbeslut 6/10: "högst upp på eventkorten, så man direkt
    // kan söka efter event i listan"): fritextfilter över listan under kortet
    // — titel, plats och värd. Att skriva växlar till listvyn så träffarna
    // syns direkt; termen följer med till stadssidan som ?q= (CardMoreRows).
    // Lever kvar vid eventbyte (man bläddrar bland sina träffar) och nollas
    // när kortet stängs.
    const [cardSearchQ, setCardSearchQ] = useState('');
    // SEDAN 7/10 KVÄLL är fältet ett riktigt input DIREKT I KNAPPRADEN
    // (ägarbeslut: "sök rutan ska vara lite bredare och inte en knapp, utan
    // direkt input. sen ska en kategorier symbl visas under") - ersätter
    // samma morgons sök/filter-ikon. Fältet tar ikonens plats, så kortets
    // default-höjd står kvar på 335. cardSearchOpen = sökningen är IGÅNG
    // (fältet har fått fokus): då visas kategorichipsen under knappraden.
    // Stängs bara av ✕ eller när kortet stängs - inte vid blur, för ett
    // tryck på ett chip blurrar fältet först och hade släckt raden under
    // fingret.
    const [cardSearchOpen, setCardSearchOpen] = useState(false);
    const cardSearchInputRef = useRef<HTMLInputElement>(null);
    const handleCloseCardSearch = () => {
        // Sökarket (utan valt event): ✕ med text rensar bara — chipsen ÄR
        // arkets innehåll och står kvar; ✕ utan text stänger hela arket.
        if (searchOnlyRef.current) {
            if (cardSearchQ.trim()) handleCardSearch('');
            else closeCard();
            return;
        }
        // Stänga = släpp sökningen (chips-filtret lever sitt eget liv och
        // syns som brickor under dagplattan).
        handleCardSearch('');
        setCardSearchOpen(false);
        cardSearchInputRef.current?.blur();
    };
    useEffect(() => {
        // Rensa först när HELA arket är stängt — sökarket (filterknappen uppe
        // till höger) lever utan valt event och ska behålla termen.
        if (!selectedEvent && !searchSheet) { setCardSearchQ(''); setCardSearchOpen(false); setSearchReturn(null); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, searchSheet]);
    // SÖKARKETS ÖPPNING (7/10 kväll): fast höjd (sökrad + chips), chipsen
    // framme direkt ("att vi visa filterna"), INGEN autofokus — mobil-
    // tangentbordet ska inte ligga över chipsen (samma skäl som 6/10-
    // filterknappens skipFocus).
    useEffect(() => {
        if (!searchOnly) return;
        // Tillbaka till sökningen (← ☰, 8/10): samma höjd som när man valde
        // träffen; lista och scroll läggs tillbaka av effekten längre ner.
        const back = pendingSpotRef.current?.search ? pendingSpotRef.current.spot : null;
        setCardSearchOpen(true);
        if (!back) setCardView('info');
        setIsAnimating(true);
        const raf = requestAnimationFrame(() => {
            // Är kartfiltret redan på visas träfflistan direkt (7/10 kväll)
            // — då öppnar arket fullhöjt så listan faktiskt syns.
            updateHeightVh(back?.heightVh ?? (cardFilterOn ? maxVhRef.current : searchSheetVh()));
            if (!back && scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        });
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchOnly]);
    // KATEGORIVAL I SÖKARKET (7/10 kväll, Josef: "om jag klickar på filter
    // knappen och sedan en kategori. då ska ju listan med de eventen visas
    // under. nu ändras det ju bara på kartan"): ett chipval växer arket till
    // full höjd så träfflistan syns; släpps sista filtret (och ingen
    // sökterm står kvar) krymper arket tillbaka.
    useEffect(() => {
        if (!searchOnlyRef.current) return;
        setIsAnimating(true);
        if (cardFilterOn) updateHeightVh(maxVhRef.current);
        else if (!cardSearchQ.trim()) updateHeightVh(searchSheetVh());
        // Bara filterväxlingen ska styra här — söktermen har sin egen väg
        // (handleCardSearch/handleToggleView).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cardFilterOn]);
    const cardQNorm = cardSearchQ.trim().toLowerCase();
    const matchesCardSearch = useMemo(() => {
        if (!cardQNorm) return null;
        return (e: LinkEvent) =>
            e.title.toLowerCase().includes(cardQNorm)
            || (e.locationName ?? '').toLowerCase().includes(cardQNorm)
            || (e.hostName ?? '').toLowerCase().includes(cardQNorm);
    }, [cardQNorm]);
    const handleCardSearch = (value: string) => {
        setCardSearchQ(value);
        // Första tecknet: öppna listvyn (full höjd) så träffarna syns direkt.
        if (value.trim() && !cardSearchQ.trim() && cardView !== 'nearby') handleToggleView('nearby');
        // Tömd sökning lämnar listvyn (höjden behålls) — Lista-ikonen i
        // knappraden är BORTTAGEN (6/10), så rensningen är vägen tillbaka.
        if (!value.trim() && cardSearchQ.trim()) {
            if (cardView === 'nearby') setCardView('info');
            // Sökarket: tillbaka till arkets egen höjd — utan event finns
            // inget kort att stå kvar fullhöjt på.
            if (searchOnlyRef.current) {
                setIsAnimating(true);
                updateHeightVh(searchSheetVh());
            }
        }
    };

    // Sortera övriga event efter avstånd från valt event (närmst först).
    const nearbyEvents = useMemo(() => {
        if (!selectedEvent) return [] as { evt: LinkEvent; distanceKm: number | null }[];
        const anchorHasCoords = hasValidCoords(selectedEvent);
        const list = events
            .filter(e => e.id !== selectedEvent.id && !discardedEventIds.has(e.id)
                && (!matchesCardSearch || matchesCardSearch(e)))
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
    }, [events, selectedEvent, discardedEventIds, matchesCardSearch]);

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
    // SÖKARKET ÄR UNDANTAGET (7/10 kväll, Josef: "hur går detta ihop?
    // månaden och de som visas bland kategorierna alltså summan" — chipsen
    // räknar ALLA event i vyn, men bildflödet räknade bara bildraderna i
    // flikarna, så Månaden·6 stod mot Socialt 13 och Populärt·0 mot 🔥 6):
    // i arket visas ALLTID hela listan (med bildtoggeln), så flikarnas tal
    // går ihop med chipsens.
    const imagesOnlyList = cardView !== 'nearby' && !searchOnly;
    // Dubblettgruppering (Josef 1/9 — samma regel som stadssidornas daglista,
    // utils/groupDups): samma titel ELLER omslagsbild under samma dag = EN rad,
    // övriga tillfällen bakom radens utfällning. Grupperas EFTER bildfiltret så
    // bildflödets grupper bara bär bildsatta event. rows = RADER (pagineringen),
    // count = EVENT (rubrikens siffra).
    const groupNearby = (items: { evt: LinkEvent; distanceKm: number | null }[]) => {
        const wrapped = items.map(it => ({ title: it.evt.title, coverImage: it.evt.coverImage || undefined, time: it.evt.time, locationName: it.evt.locationName, it }));
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

    // Listans FLIKAR (Josef 23/9 + 24/9): Alla = alla event i kartans ruta,
    // 🔥 Populärt = de populära av dem — båda från den visade dagen och
    // framåt, dag för dag. Avståndet på raderna räknas från användaren när
    // positionen är känd (listan är "vad händer där jag tittar", inte "nära
    // det här eventet"), annars från det valda eventet.
    const tabDays = useMemo(() => {
        const empty = { days: [] as { dayOffset: number; rows: NearbyItem[] }[], count: 0 };
        if (!viewEvents) return { all: empty, popular: empty };
        const nowDate = new Date(now);
        const from = userPos ?? (selectedEvent && hasValidCoords(selectedEvent) ? { lat: selectedEvent.lat, lng: selectedEvent.lng } : null);
        const kept = viewEvents.filter(e => !discardedEventIds.has(e.id) && e.id !== selectedEvent?.id
            && (!matchesCardSearch || matchesCardSearch(e)));
        const build = (include?: (e: LinkEvent) => boolean) => {
            const days = eventDays(kept, Math.max(0, dayOffset), nowDate, e => isEventPast(e, now), include).map(day => {
                const items = day.events.map(evt => ({
                    evt,
                    distanceKm: from && hasValidCoords(evt) ? haversineKm(from.lat, from.lng, evt.lat, evt.lng) : null,
                }));
                return {
                    dayOffset: day.dayOffset,
                    rows: groupNearby(imagesOnlyList ? items.filter(n => !!n.evt.coverImage) : items).rows,
                };
            // Fliken heter "Närmsta månaden" (Josef 24/9: hinta att vi
            // fokuserar på närtid) — samma horisont för båda flikarna.
            }).filter(day => day.rows.length > 0 && day.dayOffset < LIST_HORIZON_DAYS);
            const count = days.reduce((n, d) => n + d.rows.reduce((m, r) => m + 1 + (r.dups?.length ?? 0), 0), 0);
            return { days, count };
        };
        return { all: build(), popular: build(e => isPopularListed(e, now)) };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewEvents, discardedEventIds, selectedEvent, dayOffset, now, userPos, imagesOnlyList, matchesCardSearch]);
    const activeTabDays = tabDays[listTab].days;
    const activeTabRowTotal = useMemo(() => activeTabDays.reduce((n, d) => n + d.rows.length, 0), [activeTabDays]);
    // Zoomringarna (8/10): det som fanns före varje utzoomning står kvar
    // överst, de nya under sin avdelare - dag för dag från den visade dagen.
    const ringTabDays = useMemo(
        () => splitDaysIntoRings(activeTabDays, listRings, r => [r.evt.id, ...(r.dups ?? []).map(d => d.evt.id)]),
        [activeTabDays, listRings],
    );
    const ringCounts = useMemo(() => {
        const counts = listRings.map(() => 0).concat(0);
        for (const d of ringTabDays) counts[d.ring] += d.rows.reduce((m, r) => m + 1 + (r.dups?.length ?? 0), 0);
        return counts;
    }, [ringTabDays, listRings]);
    const visibleTabDays = useMemo(() => takeRows(ringTabDays, daysVisibleCount), [ringTabDays, daysVisibleCount]);
    // Listans botten: frys det listan visat som en ring och be sidan zooma
    // ut. Ringen fryser HELA rutans id:n (alla dagar och flikar), så det
    // man redan haft i listan aldrig hamnar under avdelaren.
    const handleListZoomOut = () => {
        if (!onListZoomOut || !viewEvents || listZoomPending) return;
        setListRings(r => [...r, new Set(viewEvents.map(e => e.id))]);
        setListZoomPending(true);
        listZoomScrollRef.current = scrollContainerRef.current?.scrollTop ?? 0;
        onListZoomOut(listTab === 'popular');
    };
    // Sökarket öppnas/stängs utan att eventet byts - ringarna börjar om där
    // också, annars stod en gammal avdelare kvar i nästa sökning.
    useEffect(() => {
        setListRings([]);
        setListZoomPending(false);
        listZoomScrollRef.current = 0;
    }, [searchOnly]);
    // TILLBAKA TILL SÖKNINGEN (8/10): ligger efter nollställningarna
    // (eventbytet, ringarna ovan) så listans läge vinner i samma commit.
    useEffect(() => {
        const p = pendingSpotRef.current;
        if (!searchOnly || !p?.search) return;
        pendingSpotRef.current = null;
        setSearchReturn(null);
        setListTab(p.spot.tab);
        setDaysVisibleCount(p.spot.daysVisible);
        setListRings(p.spot.rings);
        setCardView(p.spot.view);
        restoreScrollTo(p.spot.scrollTop);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchOnly]);
    // Kartan zoomar 0,9 s + listans lugnade ruta 0,6 s - sedan står den nya
    // ringen (eller inget nytt än) i listan.
    useEffect(() => {
        if (!listZoomPending) return;
        const t = setTimeout(() => setListZoomPending(false), 2200);
        return () => clearTimeout(t);
    }, [listZoomPending]);
    const listZoomEnd: ListZoomEnd | undefined = onListZoomOut && viewEvents ? {
        state: listZoomPending ? 'zooming'
            : listRings.length > 0 && ringCounts[listRings.length] === 0 ? 'idle' : 'ready',
        onZoomOut: handleListZoomOut,
        canAuto: () => (scrollContainerRef.current?.scrollTop ?? 0) > listZoomScrollRef.current + 40,
    } : undefined;
    const handleListTab = (tab: ListTab) => {
        setListTab(tab);
        setDaysVisibleCount(NEARBY_PAGE_SIZE);
    };

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
    // cardsReady: listan (och därmed markören) monteras först när kortlagret landat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent?.id, nearbyEvents.length, listTab, tabDays.all.count, cardsReady]);

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
        // Beskrivningarna hämtas hinkvis per kort — förhämta Nästa-målens
        // hinkar så texten redan finns när kortet byter event.
        linkEventService.prefetchDescriptions(
            candidates.filter(e => !e.userCreated && !e.description).map(e => e.id),
        );

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
     * zoom-ut-stegets tur (zoomOutStep, 7/10 sent) och sist dagbytets
     * (handleNextOnly/handleSwipeOut), inte ett nytt varv:
     * omstarten från ankaret är RIVEN 2/9 (Josef: "har man gått igenom alla
     * ska vi automatiskt gå till nästa dag").
     */
    const pickNext = (current: LinkEvent): LinkEvent | null => {
        const anchor = events.find(e => e.id === anchorId) ?? current;
        const pool = visiblePool(anchor);
        const newVisited = withSpotVisited(current);
        const next = findNearestEvent(anchor, pool, discardedEventIds, newVisited);
        setVisitedEventIds(newVisited);
        if (next) expectedNextIdRef.current = next.id;
        return next;
    };

    /** Besökt-mängden MED platsen man står på: alla event på samma koordinat
     *  räknas som besökta, så Nästa hoppar till nästa destination direkt i
     *  stället för att stega igenom varje enskilt event på samma plats. Ren -
     *  delas av pickNext, förhandsvisningen och zoom-ut-steget. */
    const withSpotVisited = (current: LinkEvent): Set<string> => {
        const out = new Set(visitedEventIds);
        const currentKey = current.lat && current.lng ? `${current.lat.toFixed(4)},${current.lng.toFixed(4)}` : null;
        if (currentKey) {
            for (const e of events) {
                if (e.lat && e.lng && `${e.lat.toFixed(4)},${e.lng.toFixed(4)}` === currentKey) out.add(e.id);
            }
        } else {
            out.add(current.id);
        }
        return out;
    };

    /** ZOOM-UT-MÅLET (ägarbeslut 7/10 sent, Josef: "när vi har gått genom
     *  alla de som vi inom det området där vi är. då ska ju kartan automatiskt
     *  zooma ut, men börja om på vilken dag man är på"): närmaste OBESÖKTA
     *  event i perioden UTANFÖR bild - samma tids-/ankarregel som Nästa-
     *  poolen, bara med koordinater (det ska gå att zooma ut till det).
     *  null = perioden är genomgången även utanför bild → nästa dag som förut. */
    const zoomOutTargetFrom = (anchor: LinkEvent, visited: Set<string>): LinkEvent | null => {
        if (!inView || !onZoomOutTo) return null;
        const pool = nextCandidatePool(anchor).filter(e => hasValidCoords(e) && !inView(e));
        return findNearestEvent(anchor, pool, discardedEventIds, visited);
    };

    // Bannern "ZOOMAR UT · IDAG IGEN" över kartan (7/10 sent, Josef: "gör
    // det tydligt att vi zoomas ut på kartan. som en streck horisontellt och
    // man ser att det är idag igen, fast de man inte gått genom än"):
    // remaining = obesökta event kvar i perioden, målet inräknat.
    const [zoomOutBanner, setZoomOutBanner] = useState<{ nonce: number; remaining: number } | null>(null);
    useEffect(() => {
        if (!zoomOutBanner) return;
        const t = setTimeout(() => setZoomOutBanner(null), 2800);
        return () => clearTimeout(t);
    }, [zoomOutBanner]);

    /** Eventen i bild är genomgångna → ZOOMA UT till närmaste obesökta i
     *  perioden (samma dag - "börja om på vilken dag man är på"), välj det
     *  och visa bannern. Kartan zoomar kring SAMMA mitt (sidan,
     *  onZoomOutTo) - den panorerar fortfarande aldrig. Sant om steget togs;
     *  falskt när inget obesökt finns kvar ens utanför bild. */
    const zoomOutStep = (): boolean => {
        if (!selectedEvent || !onZoomOutTo) return false;
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        const visited = withSpotVisited(selectedEvent);
        const target = zoomOutTargetFrom(anchor, visited);
        if (!target) return false;
        const remaining = nextCandidatePool(anchor)
            .filter(e => !visited.has(e.id) && !discardedEventIds.has(e.id)).length;
        pushHistory({ evt: selectedEvent, dayOffset });
        setForwardStack([]);
        expectedNextIdRef.current = target.id; // intern navigering — behåll ankaret
        // Ny nonce = ny key = animationen och timern börjar om.
        setZoomOutBanner(prev => ({ nonce: (prev?.nonce ?? 0) + 1, remaining }));
        onNavigate?.(); // kameran panorerar inte - zoomen sköts av sidan
        onZoomOutTo(target);
        selectNextTarget(target); // multiplats → kortets väljarlista
        setExitX(null);
        updateDragX(0);
        return true;
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
    // SIDSVEPET ÄR AV (ägarbeslut 16/9: "ta bort/avaktivera den swipe-
    // effekten, alltså swipe höger-vänster — vi tar bort det så länge, så
    // allt bara hålls still"). Tid/plats-raden och värdnamnet rullar numera i
    // sidled inne i kortet (HScrollRow), och ett Tinder-svep som kastar hela
    // kortet åt sidan slogs med den gesten. Ett vågrätt drag är nu en död
    // gest: kortet står still och tappen räknas inte som klick. Logiken
    // (handleSwipeOut: höger = spara, vänster = nästa) står kvar bakom
    // flaggan tills beslutet omprövas.
    const SIDE_SWIPE_ENABLED: boolean = false;

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
    // höjden (se contentTouchLockRef).
    const pullingRef = useRef(false);
    // Låset som höll VÄLJARLISTANS kort stilla på touch (2/9: "kortet står
    // still, listan scrollar") är AVVÄPNAT 7/10 kväll (Josef: "hela det
    // fönstret åka upp. precis som ett vanligt eventkort") — multievent drar
    // kortet som alla andra. Refen står kvar (läses i onPointerMove och
    // nollas i onButtonPointerDown) men sätts aldrig längre.
    const contentTouchLockRef = useRef(false);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        // Sidopanelen (xl, 6/10): ingen drag-gest alls — panelen står där den
        // står, klick och innehållsscroll fungerar som i en vanlig panel.
        if (sideModeRef.current) return;
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
        // `[data-cover-zone]` likaså (14/9): omslagsbildens klickyta i
        // LinkEventCard öppnar helskärmsbilden — utan den retargetades
        // klicket bort och tappen fällde ihop kortet ("eventkortet åker ner
        // när jag klickar på bilden, så den öppnar aldrig"). Drag från
        // bilden fungerar som från knappar: händelserna bubblar hit ändå.
        // `[data-tab-zone]` (28/9): flikraden Månaden/Populärt — en miss
        // bredvid flikpillren fällde ihop kortet ("nu måste man träffa
        // direkt på texten"). Hela raden räknas som interaktiv (tap-toggeln
        // hoppar över den) och tablistens onClick routar kantklick till
        // närmaste flik.
        const interactive = target.closest('button, a, summary, [data-cover-zone], [data-tab-zone]') as HTMLElement | null;

        // SIDLEDSRULLANDE RADER (HScrollRow, 16/9): tid/plats-raden och
        // värdnamnet rullar i sidled inne i kortet. Med MUS drar raden sig
        // själv (pointer-capture på raden) — tog kortet gesten här hade
        // radens pointermove aldrig nått fram. Bara rader som faktiskt
        // rullar över släpps; en kort rad är vanlig kortyta. Touch går
        // som vanligt hit (webbläsaren panorerar raden via touch-action
        // pan-x, och touch-lyssnaren låter bli preventDefault för ett
        // vågrätt svep i raden — se onTouchMove).
        if (e.pointerType === 'mouse') {
            const row = target.closest('[data-hscroll]') as HTMLElement | null;
            if (row && row.scrollWidth > row.clientWidth + 1) return;
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

        // (Väljarlistans touch-lås sattes här 2/9-7/10 — avväpnat, se
        // contentTouchLockRef-kommentaren: multievent drar kortet som
        // vanligt numera.)
        contentTouchLockRef.current = false;

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
            // (Väljarlistans touch-lås är avväpnat 7/10 kväll — villkoret är
            // numera alltid falskt och står kvar som säkerhetsnät.)
            if (contentTouchLockRef.current && !pullingRef.current) return;
            const deltaVh = (deltaY / window.innerHeight) * 100;
            // Fritt nedåt: under peek-gränsen fortsätter kortet glida ner mot
            // botten — släpper man tillräckligt långt ner stängs det (se
            // onPointerUp). Uppåt klampas vid MAX_HEIGHT_VH.
            const newHeight = Math.max(3, Math.min(MAX_HEIGHT_VH, startHeightVh.current + deltaVh));
            // live: fingret äger höjden direkt, ingen React-render per pixel.
            // Ingen gain här — vid drag SKA kortet följa fingret 1:1.
            updateHeightVh(newHeight, true);
        } else if (dragDirection.current === 'horizontal' && SIDE_SWIPE_ENABLED) {
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
            // Uppåt → närmaste STOPP ovanför startläget (Josef 2/9: default →
            // tapp-höjden → taket): ett kort ryck tar ett steg, ett långt drag
            // landar där fingret släppte. Släppet hamnar alltid PÅ ett stopp,
            // aldrig mitt emellan, så kortet inte blir kvar i touch-action:
            // none-zonen (< MAX-5) där svep på innehållet varken scrollar
            // eller växer. Först på taket scrollar innehållet (nästa svep).
            // Nedåt → stoppen baklänges: taket → tapp-höjden → default →
            // KOMPAKTLÄGET (30/9). Har sträcket under tid/plats gått under
            // skärmkanten stängs kortet i stället (Josef 30/9: "drar man ner
            // så det sträcket mellan arrangören och tiden försvinner över
            // kanten, så ska den försvinna"). Korta ryck studsar tillbaka dit
            // gesten började - ett darr på fingret ska inte stänga kortet.
            const target = snapRelease(sheetStopsNow(), startHeightVh.current, h, measureCompactHeight(), SNAP_PULL_MIN_VH, SNAP_TOLERANCE_VH);
            if (target !== null) updateHeightVh(target);
            else closeCard();
        } else if (dragDirection.current === 'horizontal') {
            const currentDragX = dragXRef.current;
            if (!SIDE_SWIPE_ENABLED) {
                // Död gest (se flaggan): kortet har inte rört sig — inget att
                // snäppa tillbaka, och inget spara/nästa.
            } else if (currentDragX > THRESHOLD) {
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
            // pointercancel (webbläsaren tog gesten — t.ex. sidledsrullningen
            // i tid/plats-raden, 16/9) är aldrig ett tap.
            if (cardView === 'info' && !searchOnlyRef.current && !dragFromInteractiveRef.current && e.type !== 'pointercancel') {
                // Gränsen är kortets EGEN default-höjd, inte en fast 50 vh
                // (Josef 16/9: "när kortet täcker halva skärmen går den inte
                // ner"): tapp-höjden ligger själv runt halva skärmen, så med
                // 50 vh skickade ett tap där kortet till den höjd det redan
                // stod på — ingenting hände. Nu fäller ett tap ihop kortet
                // från ALLA lägen ovanför default, och fäller ut det från
                // default. Mäts färskt: default varierar med header/bild.
                const defaultVh = measureDefaultHeight();
                updateHeightVh(
                    heightVhRef.current > defaultVh + SNAP_TOLERANCE_VH
                        ? defaultVh
                        : measureOpenHeight(),
                );
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
        const sameEvent = entry.evt.id === selectedEvent.id;
        setHistoryStack(prev => prev.slice(0, -1));
        // Valde man representanten själv ur väljarlistan är "tillbaka" bara
        // listan igen - inget att spela upp framåt.
        if (!sameEvent) setForwardStack(prev => [...prev, { evt: selectedEvent, dayOffset }]);
        // Posten bär var man stod i listan: lägg tillbaka den när eventet
        // landat (återställnings-effekten efter väljarlistans topp-scroll).
        pendingSpotRef.current = entry.spot
            ? { evtId: entry.evt.id, spot: entry.spot, groupAsked: false, armedAt: Date.now() }
            : null;
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
        if (prevEvent && entry.spot?.group && onSelectGroup) {
            // Väljarlistan var framme: grupp + representant atomiskt via
            // sidan, precis som multibrick-klicket.
            pendingSpotRef.current!.groupAsked = true;
            // Ankar-effekten körs bara om eventOBJEKTET byts - armera inte
            // en flagga som annars blir liggande till ett senare kartklick.
            if (prevEvent !== selectedEvent) expectedNextIdRef.current = prevEvent.id;
            onNavigate?.();
            onSelectGroup(entry.spot.group, prevEvent);
        } else if (prevEvent && !sameEvent) {
            // Intern navigering → behåll ankare/besökt (markeras som "väntat").
            expectedNextIdRef.current = prevEvent.id;
            onNavigate?.(); // kameran står kvar — vi flyger inte till föregående event
            onSelectEvent(prevEvent);
        } else {
            pendingSpotRef.current = null;
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
            // Alla i bild genomgångna → ZOOMA UT till fler obesökta samma
            // dag (7/10 sent); först när perioden är slut även utanför bild
            // går Nästa till nästa dag (Josef 2/9). Knappen är släckt när
            // ingen dag finns kvar, så grenen är då oåtkomlig.
            if (zoomOutStep()) return;
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
    // TILLBAKA TILL LISTAN i navraden (vid 1/2-pagern, till vänster om
    // NÄSTA) - bara i infovyn, där "tillbaka" bara kan betyda en sak. Sedan
    // 8/10 även efter ett val ur listan UNDER kortet (inte bara ur
    // väljarlistan), och då tar den en till exakt samma ställe i listan
    // (ListSpot). Utan en sådan post: sidans gamla väg till väljarlistan.
    const listReturnEntry = backEntry?.spot && backEntry.spot.pickedId === selectedEvent?.id ? backEntry : undefined;
    // Träffen man valde ur sökarket: pilen tar en tillbaka till sökningen.
    const searchReturnHere = !listReturnEntry && !!searchReturn && !!onOpenSearchSheet
        && searchReturn.pickedId === selectedEvent?.id;
    const showBackToGroup = !chooserActive && cardView === 'info'
        && (!!listReturnEntry || searchReturnHere || !!onBackToGroup);
    const backToListCount = listReturnEntry ? (listReturnEntry.spot!.group?.length ?? 0)
        : searchReturnHere ? 0 : backToGroupCount;
    const handleBackToList = () => {
        if (listReturnEntry) handleHistoryBack();
        else if (searchReturnHere && searchReturn) {
            if (didDragRef.current) { didDragRef.current = false; return; }
            pendingSpotRef.current = { evtId: '', spot: searchReturn, groupAsked: false, armedAt: Date.now(), search: true };
            onOpenSearchSheet?.();
        }
        else onBackToGroup?.();
    };
    // EN PIL TILLBAKA (ägarbeslut 8/10, Josef: "det ska bara vara en pil
    // tillbaka om man går ifrån ett multi event och ska tillbaka till listan
    // man var på. alltså inte med en sådan emoji i"): leder Bakåt till samma
    // ställe i listan som ← ☰, göms emoji-brickan - bara pilen står kvar.
    const hideHistoryBack = showBackToGroup && (!!listReturnEntry || (searchReturnHere && !backEvent));

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
        // null = alla i bild genomgångna → knappen visar zoom-ut eller nästa dag.
        return findNearestEvent(anchor, pool, discardedEventIds, withSpotVisited(selectedEvent));
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
    const forwardCrossDay = !!forwardTop && forwardTop.dayOffset !== dayOffset;
    const nextStepDayOffset = forwardCrossDay ? forwardTop!.dayOffset : nextDayOffset;
    // FJÄRDE LÄGET (7/10 sent): eventen i bild slut men perioden har
    // obesökta utanför bild → "ZOOMA UT" med målets emoji; trycket zoomar ut
    // och väljer det (zoomOutStep). Vinner över nästa dag - utom när man
    // backat över ett dagbyte (framåtstacken spelar upp samma väg).
    const zoomOutPreview = useMemo<LinkEvent | null>(() => {
        if (!selectedEvent || nextEvent || forwardCrossDay) return null;
        const anchor = events.find(e => e.id === anchorId) ?? selectedEvent;
        return zoomOutTargetFrom(anchor, withSpotVisited(selectedEvent));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEvent, nextEvent, forwardCrossDay, events, anchorId, visitedEventIds, discardedEventIds, now, inView, onZoomOutTo]);
    const nextDayLabel = !nextEvent && !zoomOutPreview && nextStepDayOffset != null ? getDayLabel(nextStepDayOffset, dayRangeDays) : null;
    const nextDisabled = !nextEvent && !zoomOutPreview && nextStepDayOffset == null;
    const nextTitle = nextEvent
        ? `Närmaste i bild: ${nextEvent.title}`
        : zoomOutPreview
            ? `Alla event i bild är genomgångna - zooma ut till fler ${getDayLabel(dayOffset, dayRangeDays).toLowerCase()} (${zoomOutPreview.title})`
            : nextDayLabel
                ? `Alla event i bild är genomgångna — gå vidare till ${nextDayLabel.toLowerCase()}`
                : 'Inga fler event i bild';

    // LISTVAL = SOM ETT KARTKLICK (7/10 kväll, Josef: "om jag väljer ett
    // event som är som alternativ i sök eventkortet. Då ska ju den jag
    // väljer bli i sin kategorifärg och så som när det är klickat på
    // kartan"): ligger raden på en ANNAN dag än kartan visar finns eventet
    // inte i kartans dagslager — markören kunde aldrig tändas/väljas och
    // valet såg "färglöst" ut. Stega dagen dit och låt sidan landa på just
    // det eventet (samma väg som Bakåt/Nästa över ett dagbyte) — då får
    // markören den valda kategorifärgade looken som vanligt. Inom den
    // visade perioden väljs direkt som förut. Delas av listan,
    // arrangörsraden och väljarlistans fortsättning.
    const rememberListSpot = (picked: LinkEvent) => {
        if (!selectedEvent) {
            // SÖKARKET (8/10): inget event att backa till - posten bor i
            // searchReturn och ← ☰ öppnar arket igen.
            if (searchOnly) {
                setSearchReturn({
                    pickedId: picked.id,
                    scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
                    daysVisible: daysVisibleCount,
                    tab: listTab,
                    rings: listRings,
                    view: cardView,
                    group: null,
                    heightVh: heightVhRef.current,
                });
                searchPickIdRef.current = picked.id;
            }
            return;
        }
        pushHistory({
            evt: selectedEvent,
            dayOffset,
            spot: {
                pickedId: picked.id,
                scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
                daysVisible: daysVisibleCount,
                tab: listTab,
                rings: listRings,
                view: cardView,
                group: chooserActive && groupChoice ? groupChoice : null,
            },
        });
        setForwardStack([]); // ny gren, som Nästa efter ett Bakåt
        // Representanten själv ur väljarlistan byter inget event - då körs
        // ingen ankar-effekt som kan förbruka flaggan.
        if (picked !== selectedEvent) listPickIdRef.current = picked.id;
    };
    const handleListPick = (evt: LinkEvent) => {
        rememberListSpot(evt);
        if (evt.time && onDayStep) {
            const a = new Date(evt.time); a.setHours(0, 0, 0, 0);
            const b = new Date(now); b.setHours(0, 0, 0, 0);
            const offset = Math.round((a.getTime() - b.getTime()) / 86_400_000);
            const inShown = offset >= dayOffset && offset < dayOffset + dayRangeDays;
            if (!inShown && offset >= 0) {
                stepToDay(offset, evt.id);
                return;
            }
        }
        onSelectEvent(evt);
    };

    // KORTSÖKET + FILTERSYMBOLEN (7/10 kväll, Josef: "visa filtersymbolen
    // jämte sökrutan i eventkortet"): fältet + en filterknapp som öppnar/
    // stänger kategorichipsen utan att fokusera fältet (inget tangentbord
    // över chipsen). Delas av knappraden (LinkEventCard-slotten) och
    // sökarket. stopPropagation: ett tryck här ska inte fälla ut kortet.
    const searchFieldNode = (
        <div
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 max-w-xs flex items-center gap-1.5"
        >
            <div className="flex-1 min-w-0 flex items-center gap-2 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-border focus-within:border-[#006AA7] px-3 transition-colors">
                <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
                <input
                    ref={cardSearchInputRef}
                    type="text"
                    value={cardSearchQ}
                    onChange={e => handleCardSearch(e.target.value)}
                    onFocus={() => setCardSearchOpen(true)}
                    placeholder="Sök event i listan…"
                    aria-label="Sök event i listan under kortet"
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400"
                />
                {cardSearchQ && (
                    <button
                        type="button"
                        onClick={handleCloseCardSearch}
                        aria-label="Rensa sökningen"
                        className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <XIcon size={14} />
                    </button>
                )}
            </div>
            {/* Filtersymbolen: blå fylld när chipsen är framme eller kartans
                filter är på (kategorier/🔥/källa — arrangörsfiltret har sin
                egen banner). */}
            <button
                type="button"
                onClick={() => setCardSearchOpen(o => !o)}
                aria-pressed={cardSearchOpen}
                aria-label={cardSearchOpen ? 'Dölj filtren' : 'Visa filtren'}
                title={cardSearchOpen ? 'Dölj filtren' : 'Filtrera på kategori'}
                className={`shrink-0 h-8 w-8 rounded-full border flex items-center justify-center transition-colors active:scale-95 ${
                    cardSearchOpen || cardFilterOn
                        ? 'bg-[#006AA7] border-[#006AA7] text-white'
                        : 'bg-white dark:bg-zinc-800 border-border text-slate-500 dark:text-zinc-400 hover:text-[#006AA7] hover:border-sky-200'
                }`}
            >
                <FilterIcon size={14} strokeWidth={2.5} aria-hidden />
            </button>
        </div>
    );

    // Kategorichipsen under sökraden — samma nod i knappraden (belowToolbar)
    // och i sökarket.
    const filterChipsRow = cardSearchOpen && filterChips
        ? <div className="-mx-4 md:-mx-6 -mt-2 mb-1">{filterChips}</div>
        : null;

    // ARRANGÖREN PÅ PLATSEN (7/10 kväll, Josef: "Om det är en arrangör som är
    // på den platsen så ska arrangörssidolistan visas"): delar HELA högen
    // värd med representanten visas arrangörsraden (+ stadssideknappen)
    // direkt under väljarlistan — inuti dess wrapper, så platsrubriken står
    // kvar tills raden scrollat förbi.
    const chooserOrganizerRow = useMemo(() => {
        if (!chooserActive || !groupChoice || !organizerRow) return null;
        const host = (groupChoice[0].hostName ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!host) return null;
        const sameHost = groupChoice.every(ev => (ev.hostName ?? '').replace(/\s+/g, ' ').trim().toLowerCase() === host);
        return sameHost ? organizerRow : null;
    }, [chooserActive, groupChoice, organizerRow]);

    // Listan under kortet visas i: väljarläget (7/10: "listan går att
    // fortsätta bläddra i, utan att välja dem i början"), vanliga kortet
    // (utom chatt-vyn) och sökarket SÅ FORT man sökt ELLER valt ett filter
    // (Josef 7/10 kväll: "om jag klickar på filter knappen och sedan en
    // kategori. då ska ju listan med de eventen visas under") — "inga event"
    // gäller bara det orörda arket. viewEvents är redan kartfiltrerade, så
    // listan visar precis kategorins event.
    const listVisible = chooserActive
        || (selectedEvent ? cardView !== 'chat' : searchOnly && (!!cardQNorm || cardFilterOn));
    // SIDONAVEN (ägarbeslut 7/10 kväll, Josef: "den nästa knappen när man är
    // på en dator. den kan vara åt höger om den fönstret som är åt vänster.
    // längst ner. sen de andra knapparna ... de kan vara ovanpå nästaknappen"):
    // i sidopanelsläget lämnar navraden platsen ovanför kortet och blir en
    // KOLUMN till höger om panelen, nederkant mot skärmens botten - Nästa
    // längst ner, bakåt/lista/pager staplade ovanför. Smala knappar ovanför
    // Nästa (≤ 62 px) går fria från den skärmcentrerade dagväljaren även på
    // en 1280 px-skärm; Nästa själv står under väljarens bottom-[92px].
    const sideNav = sideMode && !!selectedEvent;
    // ml-auto knuffar ut gruppen i högerkanten på raden - i kolumnen hade den
    // högerställt knapparna mot den bredaste, så den släpps där.
    const navMlAuto = sideNav ? '' : ' ml-auto';

    return (
        <>
        {/* ZOOM-UT-BANNERN (7/10 sent): vågräta streck som växer ut från
            mitten + "ZOOMAR UT / {DAG} IGEN · N KVAR" - kartan zoomar ut
            samtidigt och dagplattan blinkar. Tonar ut av sig själv
            (zoomout-banner i globals.css); i sidopanelsläget över kartytan
            till höger om panelen. */}
        {zoomOutBanner && (
            <div
                key={zoomOutBanner.nonce}
                role="status"
                aria-live="polite"
                className={`zoomout-banner pointer-events-none fixed top-[34%] z-[1250] flex items-center gap-3 ${sideMode && selectedEvent ? 'left-[432px] right-6' : 'inset-x-4'}`}
            >
                <span aria-hidden className="zoomout-line zoomout-line-l flex-1 h-[3px] rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)]" />
                <span className="shrink-0 flex flex-col items-center gap-1 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-white/15 text-white px-4 py-2 shadow-2xl">
                    <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest leading-none">
                        <ZoomOut size={14} strokeWidth={2.5} aria-hidden />
                        Zoomar ut
                    </span>
                    <span className="text-[13px] font-black uppercase tracking-wider leading-none text-[#FECC02] whitespace-nowrap">
                        {getDayLabel(dayOffset, dayRangeDays)} igen · {zoomOutBanner.remaining} kvar
                    </span>
                </span>
                <span aria-hidden className="zoomout-line zoomout-line-r flex-1 h-[3px] rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)]" />
            </div>
        )}
        {/* Nedre rad — ALLTID synlig (verktyg till vänster, Nästa till höger om kort finns) */}
        {/* z-[1250]: kortet ligger över ALLT kartkrom — kategorikolumnen (1150),
            stadsrutan (1090), navbaren (1160). Bara modaler (1300) går över. */}
        {/* SIDOPANELEN (6/10): på xl med öppet kort dockar hela kolumnen
            (navrad + kort) till VÄNSTER som en 400 px panel i stället för
            centrerat bottenark — kartan ligger fri till höger. */}
        <div className={`fixed bottom-0 left-0 right-0 z-[1250] flex flex-col ${sideMode && selectedEvent ? 'items-start' : 'items-center'} px-4 pointer-events-none`} style={{ minHeight: '100vh', justifyContent: 'flex-end' }}>
            <div className={sideNav
                // 432 = kolumnens px-4 (16) + panelen (400) + luft (16).
                ? 'absolute bottom-4 left-[432px] flex flex-col items-start gap-2'
                : 'w-full max-w-4xl flex justify-between items-center mb-4'}>

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
                <div className={`${sideNav ? 'flex-col items-start' : 'flex-1 min-w-0 ml-2 items-center'} flex gap-2 pointer-events-none`}>
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
                                bakåt-pil. UNDANTAG 8/10: leder den till samma ställe
                                i listan som ← ☰ göms den (hideHistoryBack) - en pil. */}
                            {!hideHistoryBack && (
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
                            )}
                            {/* MULTIEVENT-PAGERN "1/11 →" (flyttad hit 16/9): satt
                                tidigare på kortets platsrad och trängde undan tid,
                                avstånd och plats på mobil. Här står den direkt till
                                vänster om NÄSTA — samma glaslook som bakåtknappen, och
                                ml-auto flyttar med till den när pagern syns så paret
                                sitter ihop i högerkanten. Döljs i väljarläget: då ÄR
                                kortets innehåll listan över högen. */}
                            {/* TILLBAKA TILL MULTIEVENT-LISTAN (Josef 1/9) - DIREKT
                                TILL VÄNSTER OM 1/2-PAGERN sedan 7/10 kväll ("där
                                uppe vid 1/2 åt vänster direkt om den"); satt förut
                                i kortets knapprad, där kortsöket nu tar plats.
                                Spegelbild av pagern: [← lista] [1/2 →] [NÄSTA].
                                Bara i infovyn: i listvyn är "tillbaka" tvetydigt
                                (två listor). Neutral glas-look - en väg, inte ett
                                läge. ml-auto sitter på den första synliga av de
                                tre så gruppen håller ihop i högerkanten. */}
                            {showBackToGroup && (
                                <button
                                    type="button"
                                    onClick={handleBackToList}
                                    onPointerDown={onButtonPointerDown}
                                    onPointerMove={onButtonPointerMove}
                                    onPointerUp={onButtonPointerUp}
                                    onPointerCancel={onButtonPointerUp}
                                    aria-label={backToListCount > 1
                                        ? `Tillbaka till de ${backToListCount} eventen på platsen`
                                        : searchReturnHere ? 'Tillbaka till sökningen' : 'Tillbaka till listan'}
                                    title={backToListCount > 1
                                        ? `Tillbaka till de ${backToListCount} eventen på platsen`
                                        : searchReturnHere ? 'Tillbaka till sökningen' : 'Tillbaka till listan'}
                                    className={`pointer-events-auto shrink-0${navMlAuto} h-[38px] px-3 flex items-center gap-1 bg-white/30 backdrop-blur-md rounded-full shadow-xl border border-white/50 text-[#006AA7] box-border select-none hover:bg-white/50 active:scale-95 transition-all`}
                                >
                                    <ArrowLeft size={13} strokeWidth={2.5} className="shrink-0" />
                                    <List size={15} strokeWidth={2.5} className="shrink-0" />
                                </button>
                            )}
                            {!chooserActive && sameSpotGroup.length > 1 && (
                                <button
                                    type="button"
                                    onClick={handleSameSpotNext}
                                    onPointerDown={onButtonPointerDown}
                                    onPointerMove={onButtonPointerMove}
                                    onPointerUp={onButtonPointerUp}
                                    onPointerCancel={onButtonPointerUp}
                                    aria-label={`Nästa av ${sameSpotGroup.length} event på samma plats`}
                                    title="Fler event på samma plats"
                                    className={`pointer-events-auto shrink-0${showBackToGroup ? '' : navMlAuto} h-[38px] px-3 flex items-center gap-1 bg-white/30 backdrop-blur-md rounded-full shadow-xl border border-white/50 text-[#006AA7] box-border select-none hover:bg-white/50 active:scale-95 transition-all`}
                                >
                                    <span className="text-[12px] font-black tabular-nums leading-none">
                                        {(sameSpotIndex < 0 ? 0 : sameSpotIndex) + 1}/{sameSpotGroup.length}
                                    </span>
                                    <ArrowRight size={13} className="shrink-0" />
                                </button>
                            )}
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
                                className={`group/nasta pointer-events-auto relative shrink-0 h-[38px] box-border flex items-center bg-transparent${(!chooserActive && sameSpotGroup.length > 1) || showBackToGroup ? '' : navMlAuto}${nextDisabled ? ' opacity-40 cursor-not-allowed' : ''}`}
                            >
                                {/* DAGBYTES-LÄGET: samma blå kapsel men med GUL RAM (Josef
                                    2/9: "skit i det att den byter färg, lägg en gul ram i
                                    stället") + kalender-ikon i stället för eventets emoji.
                                    Ägarbeslut — den vita omfärgningen byggdes och revs
                                    samma kväll. */}
                                <span className={`flex items-center gap-2 h-[38px] pl-4 pr-1.5 rounded-full bg-gradient-to-r from-[#0077BC] to-[#005590] text-white shadow-md shadow-sky-900/30 ring-inset transition-all group-hover/nasta:from-[#0083CE] group-hover/nasta:to-[#00619F] group-hover/nasta:shadow-lg group-active/nasta:scale-[0.97] ${
                                    nextDayLabel ? 'ring-2 ring-[#FECC02]' : zoomOutPreview ? 'ring-2 ring-white/80' : 'ring-1 ring-white/25'
                                }`}>
                                    {/* Eventen i bild slut → ZOOMA UT (fler samma dag
                                        utanför bild, 7/10 sent) eller nästa dags namn,
                                        så man ser vad trycket gör (se nextDayLabel). */}
                                    <span className="text-[12px] font-black uppercase tracking-widest leading-none">{zoomOutPreview ? 'ZOOMA UT' : nextDayLabel ?? 'NÄSTA'}</span>
                                    {/* Emoji för nästa event + liten framåt-pil. */}
                                    {zoomOutPreview ? (
                                        <span aria-hidden className="relative flex items-center justify-center w-8 h-8 text-lg leading-none">
                                            {eventEmoji(zoomOutPreview)}
                                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#006AA7] text-white border border-white flex items-center justify-center">
                                                <ZoomOut size={10} />
                                            </span>
                                        </span>
                                    ) : nextEvent ? (
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

            {/* Draggable bottom sheet card container — visas när ett event är
                valt ELLER sökarket (filterknappen uppe till höger) är öppet. */}
            {selectedEvent || searchOnly ? (
            <div className={`w-full ${sideMode ? 'max-w-[400px]' : 'max-w-4xl'}`}>
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
                    Zonen ligger absolute överst och är SOLID (Josef 28/9: "den
                    vita marginalen ska inte försvinna"): scrollat innehåll
                    försvinner UNDER den i stället för att glida upp bakom
                    strecken — som täckte flikradens text när den var
                    transparent. Scrollcontainern kompenserar med pt-6 så inget
                    innehåll ligger gömt bakom zonen i viloläget, och kortets
                    stickies fäster på top-6 (under zonen). z-[39]: över
                    innehållets stickies (z-10/z-20), under strecken (z-40). */}
                <div
                    className="absolute top-0 left-0 right-0 h-6 cursor-grab active:cursor-grabbing select-none z-[39] bg-card"
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

                {/* SÖKARKETS FASTA HUVUD (7/10 kväll, Josef: "då ska ju sök
                    och de filter vara sticky i toppen. så man kan filtrera
                    lättare"): sök + chips ligger UTANFÖR scrollcontainern, i
                    arkets flöde under grip-zonen — träfflistan scrollar under
                    medan raden står kvar, och listans egna stickies (flikrad/
                    dagrubriker) fäster vid containerns topp precis under.
                    pt-6 klarar den solida grip-zonen; containern släpper sin
                    pt-6 i det här läget (paddingTop-overriden nedan). */}
                {searchOnly && (
                    <div className="shrink-0 bg-card pt-6 px-4 md:px-6 pb-2 border-b border-border">
                        <div className="flex justify-between items-center gap-2 mb-2">
                            {searchFieldNode}
                        </div>
                        {filterChipsRow}
                    </div>
                )}

                {/* Scrollable content container */}
                <div
                    ref={scrollContainerRef}
                    // data-card-scroll: listraderna mäter synlig botten härifrån
                    // (NearbyRow, trasiga bildlänkar).
                    data-card-scroll
                    // pt-6 = grip-zonens höjd: innehållet börjar under den
                    // solida zonen i viloläget och scrollar in UNDER den.
                    className="flex-1 w-full overflow-y-auto overscroll-none bg-card custom-scrollbar pt-6"
                    style={{
                        // Sökarket: huvudet (sök + chips) ovanför bär redan
                        // pt-6 mot grip-zonen — containern ska börja direkt.
                        ...(searchOnly ? { paddingTop: 0 } : null),
                        // (pb-56:an för overlay-footern är borta 7/10 kväll —
                        // raden bor i flödet och tar sin egen plats.)
                        // Toppradens höjd när den syns: listans flikrad och
                        // dagrubriker fäster under den (NearbyEventsList).
                        ...({ '--card-sticky-top': rsvpBarOn ? `${rsvpBarH}px` : '0px' } as React.CSSProperties),
                        // Innehållet scrollar FÖRST när kortet vuxit till taket.
                        // Under det tar kortets drag-handler gesten → hela
                        // behållaren åker upp/ner i stället för att scrolla
                        // innehållet; ETT svep växer kortet hela vägen upp och
                        // NÄSTA svep scrollar den nedre delen. Beslutet fattas
                        // vid gest-start i touch-lyssnaren (dragsSheet) — INTE
                        // här: en touch-action som växlar none ↔ pan-y fastnade
                        // på iPhone över text och knappar (Josef 10/9).
                        // (Väljarlistan följer samma regler som vanliga
                        // kortet sedan 7/10 kväll — svepet växer arket genom
                        // stoppen, innehållet scrollar först på taket.)
                        touchAction: 'pan-y'
                    }}
                >
                    {/* VÄLJARLÄGET: innehållet ÄR väljarlistan tills man valt
                        (Josef 31/8) — sen renderas det vanliga kortet nedan.
                        Sedan 7/10 kväll fortsätter den VANLIGA listan under
                        högen (gemensamma blocken längst ner), och delar hela
                        platsen värd visas arrangörsraden emellan. */}
                    {chooserActive && groupChoice ? (
                        <EventCardGroupList
                            events={groupChoice}
                            selectedEvent={selectedEvent}
                            onSelect={(evt) => { rememberListSpot(evt); onPickFromGroup!(evt); }}
                            moreRows={chooserOrganizerRow && cityLink ? (
                                <CardMoreRows
                                    organizerRow={chooserOrganizerRow}
                                    onSelect={handleListPick}
                                    cityLink={cityLink}
                                    cityCount={tabDays.all.count}
                                    searchQ={cardSearchQ}
                                />
                            ) : null}
                        />
                    ) : !selectedEvent ? (
                        /* SÖKARKET: sök + chips bor i det FASTA huvudet
                           ovanför scrollcontainern (7/10 kväll, "sticky i
                           toppen") — här finns inget kortinnehåll; träff-
                           listan (gemensamma blocken nedan) dyker upp så
                           fort man sökt eller valt ett filter. */
                        null
                    ) : (<>
                    {/* TOPPRADEN (emoji + titel + alla svarsknappar) när
                        svarsraden scrollat förbi - se rsvpBarOn. Ett sticky
                        h-0-ankare FÖRST i innehållet med raden absolut i sig:
                        den tar ingen plats i flödet (inget hopp när den
                        tänds) och står kvar i toppen hela vägen ner genom
                        listan. top-0 = under grip-zonen (sticky räknar från
                        containerns padding-kant, se NearbyEventsList).
                        z-30: över listans flikrad/dagrubriker, under
                        grip-zonen (39). */}
                    {rsvpBarOn && rsvpFooterVisible && onSetRsvp && (
                        <div className="sticky top-0 z-30 h-0">
                            <div className="absolute inset-x-0 top-0">
                                <EventRsvpTopBar
                                    event={selectedEvent}
                                    myRsvp={myRsvp}
                                    onSetRsvp={(status) => onSetRsvp(selectedEvent, status)}
                                    onInvite={() => onInviteFriend?.(selectedEvent)}
                                    cta={footerCta}
                                    onVisitCta={recordCtaClick}
                                    onHeight={setRsvpBarH}
                                />
                            </div>
                        </div>
                    )}
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
                        // Redigera är snävare än radera: bara ägaren (anonyma
                        // tips får raderas av alla, men inte skrivas om).
                        canEdit={!!(selectedEvent.userCreated && currentUserUid
                            && selectedEvent.hostUid === currentUserUid)}
                        onEditOwn={onEditOwnEvent ? () => onEditOwnEvent(selectedEvent) : undefined}
                        // Boost: alla inloggade får boosta ALLA event — användarskapade
                        // (5/8) OCH skrapade (18/8: featuredUntil för skrapade bor i
                        // eventBoosts-overlayn, se createBoostCheckout/boostTargetRef).
                        // Nivån väljs i kortets BoostTierPicker (ägs av BOOST_TIERS).
                        onBoost={onBoostOwnEvent ? (tier) => onBoostOwnEvent(selectedEvent.id, tier) : undefined}
                        onSelectOrganizer={onSelectOrganizer}
                        // Chatt-knappen i knappraden BORTTAGEN (Josef 21/8) —
                        // chatten nås genom att scrolla ner i kortet, den
                        // ligger direkt under eventinfon. Lista-toggeln bara
                        // när närhetslistan har innehåll.
                        activityView={false}
                        // (Tillbaka-pilen till multievent-listan satt här i
                        // headern t.o.m. 7/10 - nu i navraden vid 1/2-pagern.)
                        nearbyView={cardView === 'nearby'}
                        // LISTA-IKONEN BORTTAGEN (ägarbeslut 6/10, Josef: "då
                        // ska den lista-ikonen försvinna, och man ska se
                        // kategorierna") — in i listan via kortsöket/scrollen,
                        // ut genom att rensa sökningen. Kategorichipsen under
                        // sökfältet ersätter ikonens jobb.
                        onToggleNearbyView={undefined}
                        // KORTSÖKET direkt i knappraden (7/10 kväll) + FILTER-
                        // SYMBOLEN bredvid fältet (samma kväll) — delad nod
                        // med sökarket, se searchFieldNode. Inte sticky:
                        // flikraden (top-0) och dagrubrikerna (top-11) äger
                        // sticky-kedjan, och att skriva växlar ändå till
                        // listvyn med scrollen i topp.
                        searchField={searchFieldNode}
                        // KATEGORICHIPSEN under knappraden när sökningen är
                        // igång eller filterknappen tryckts (6/10-raden): SAMMA
                        // filter som kartan - ett val här smalnar listan
                        // nedanför OCH kartan bakom. Sidan äger raden
                        // (filterChips), kortet bara visar den.
                        belowToolbar={filterChipsRow}
                        hasStar={starredEventIds?.has(selectedEvent.id) ?? false}
                        // Passerade event kan inte stjärnmärkas — stjärnan vore
                        // förbrukad direkt (den lyser bara tills eventet varit).
                        canPlaceStar={canPlaceStar && !isEventPast(selectedEvent, Date.now())}
                        onPlaceStar={onPlaceStar ? () => onPlaceStar(selectedEvent.id) : undefined}
                    />
                    {/* KOMMER/INTRESSERAD + BJUD MED + ANMÄL - MELLAN
                        BESKRIVNINGEN OCH CHATTEN (7/10 sent, Josef:
                        "intresserad, kommer.... att de är mellan beskrivning
                        och chatt"; var precis före listan). Fortfarande
                        sticky bottom-0 (samma kvälls "lossna ifrån sin
                        stickiness" när man når raden): fast i arkets botten
                        tills man scrollat fram till raden under
                        beskrivningen, där den släpper. Passerar den
                        överkanten tar toppraden över (ankaret nedan mäts av
                        rsvpBarOn-effekten). Gömd i kompaktläget och
                        chatt-/listvyn (rsvpFooterVisible). */}
                    {rsvpFooterVisible && onSetRsvp && (<>
                        <div ref={rsvpAnchorRef} aria-hidden className="h-0" />
                        <EventRsvpFooter
                            event={selectedEvent}
                            myRsvp={myRsvp}
                            onSetRsvp={(status) => onSetRsvp(selectedEvent, status)}
                            onInvite={() => onInviteFriend?.(selectedEvent)}
                            invite={cardInvite && cardInvite.eventId === selectedEvent.id ? { fran: cardInvite.fran } : null}
                            onDismissInvite={onDismissInvite}
                            onRequireLogin={onRequireLogin}
                            cta={footerCta}
                            onVisitCta={recordCtaClick}
                        />
                    </>)}
                    {/* Chatt per event — KRÄVER KONTO för att ens läsas
                        (Josef 31/8): utloggade ser en låst rad "Logga in för
                        att se chatten" som öppnar auth-modalen.
                        (Livebilder-panelen borttagen 5/8 på ägarens beslut.)
                        DIREKT UNDER SVARSRADEN sedan 7/10 sent (före det
                        direkt under eventinfon, Josef 7/10 kväll: "chatten
                        ska vara direkt under ... inte efter de event av samma
                        arrangör") - arrangörsraden ligger kvar efter.
                        PUBLIK + PRIVAT sedan samma kväll (två block, se
                        EventChatPanel). Döljs i listvyn så träfflistan
                        hamnar direkt under sökraden. */}
                    {onRequireLogin && cardView !== 'nearby' && (
                        <div className="px-4 md:px-6 pt-3 pb-4 flex flex-col gap-3">
                            <EventChatPanel
                                eventId={selectedEvent.id}
                                eventTitle={selectedEvent.title}
                                userCreated={selectedEvent.userCreated}
                                invite={cardInvite && cardInvite.eventId === selectedEvent.id ? { fran: cardInvite.fran } : null}
                                onRequireLogin={onRequireLogin}
                            />
                        </div>
                    )}
                    {/* FLER FRÅN SAMMA ARRANGÖR + stadssideknappen (6/10;
                        EFTER chatten sedan 7/10 kväll) — bara i infovyn; i
                        listvyn dominerar listan. */}
                    {cardView === 'info' && cityLink && (
                        <CardMoreRows
                            organizerRow={organizerRow}
                            onSelect={handleListPick}
                            cityLink={cityLink}
                            cityCount={tabDays.all.count}
                            searchQ={cardSearchQ}
                        />
                    )}
                    {/* (Svarsraden låg här, precis före listan, 7/10 kväll -
                        flyttad upp mellan beskrivningen och chatten.) */}
                    </>)}
                    {/* Direkt till närhetslistan — "Tips för dig"-sektionen togs
                        bort 2026-07-13 (ägarbeslut: onödig, folk vill se Fler
                        event i närheten direkt när de scrollar). Döljs i
                        chatt-vyn (som visar bara header + chatt); i listvyn
                        hamnar den i stället direkt under sökraden. GEMENSAM för
                        alla tre lägen sedan 7/10 kväll (listVisible): vanliga
                        kortet, väljarläget ("listan går att fortsätta bläddra
                        i") och sökarket så fort man sökt. */}
                    {/* Djuplänks-glappet (?event= från stadssidorna): kortet
                        öppnar på sitt seed-data långt innan Sverige-lagren
                        laddat, så närhetslistan är tom en stund. Visa sektionen
                        som laddande i stället för att den poppar in ur
                        ingenstans — försvinner när listan fyllts, eller tyst
                        när det definitiva beskedet säger att inget finns nära.
                        Samma rad står också tills kortlagret landat (cardsReady),
                        så listan ritas EN gång med rätt innehåll. */}
                    {listVisible && ((nearbyEvents.length === 0 && !eventsSettled) || !cardsReady) && (
                        <div className="w-full bg-slate-50 dark:bg-zinc-900/40 border-t border-border">
                            <div className="px-4 md:px-6 py-3 flex items-center gap-2.5">
                                <span aria-hidden className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 dark:border-zinc-600 border-t-[#006AA7] dark:border-t-sky-400 animate-spin" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Letar fler event…
                                </span>
                            </div>
                        </div>
                    )}
                    {listVisible && cardsReady && (nearbyEvents.length > 0 || tabDays.all.count > 0) && (
                        <NearbyEventsList
                            upcomingItems={listedUpcoming.rows.slice(0, nearbyVisibleCount)}
                            upcomingTotal={listedUpcoming.rows.length}
                            upcomingCount={listedUpcoming.count}
                            pastItems={listedPast.rows}
                            now={now}
                            onSelect={handleListPick}
                            onLoadMore={() => setNearbyVisibleCount(c => c + NEARBY_PAGE_SIZE)}
                            coachMarkerRef={coachMarkerRef}
                            imagesOnly={imagesOnlyList}
                            showImages={showImages}
                            onToggleImages={toggleImages}
                            tab={listTab}
                            onTabChange={viewEvents ? handleListTab : undefined}
                            allCount={tabDays.all.count}
                            popularCount={tabDays.popular.count}
                            days={visibleTabDays}
                            ringCounts={ringCounts}
                            listZoom={listZoomEnd}
                            daysHasMore={daysVisibleCount < activeTabRowTotal}
                            onLoadMoreDays={() => setDaysVisibleCount(c => c + NEARBY_PAGE_SIZE)}
                            // Bara tidsfönstret inne → listans botten hämtar resten
                            // (bara för den som faktiskt scrollar dit — egress).
                            onLoadLaterDays={linkEventService.timelineHorizonMs() !== null ? () => linkEventService.requestFullTimeline() : undefined}
                            // Radernas hjärtan — samma spara-toggle och inloggnings-
                            // grind som kortets (onSaveEvent äger gaten).
                            savedIds={savedEventIds}
                            onToggleSave={savedEventIds && onUnsaveEvent
                                ? (id) => (savedEventIds.has(id) ? onUnsaveEvent(id) : onSaveEvent(id))
                                : undefined}
                            // Filtren i flikraden (7/10 sent) - inte i sökarket,
                            // där står kategoriraden redan fast i huvudet.
                            activeFilters={activeFilters}
                            onRemoveFilter={onRemoveFilter}
                            filterChips={searchOnly ? undefined : filterChips}
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
                {/* (EventRsvpFooter som overlay låg här 6/10-7/10 - den bor
                    nu STICKY i scrollflödet mellan beskrivningen och
                    chatten, plus toppraden när den scrollat förbi.) */}
                {coachStage !== 'off' && cardView === 'info' && !chooserActive && (
                    <div className={`absolute inset-x-0 ${rsvpFooterVisible ? 'bottom-16' : 'bottom-4'} z-[60] flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                        <button
                            type="button"
                            onClick={() => coachMarkerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                            className="city-cta gold-glow-pulse pointer-events-auto relative overflow-hidden flex items-center gap-2 rounded-full bg-gradient-to-r from-[#006AA7] via-[#005590] to-[#003C66] border-2 border-[#FECC02] text-white text-xs font-black px-4 py-2 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                            <span>Scrolla ner för fler event</span>
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
                    ) : (eventsSettled && events.length === 0 && !hideEmptyHint) && (
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
