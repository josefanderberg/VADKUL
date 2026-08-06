'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { EventWish, LinkEvent } from '@/types';
import { linkEventService } from '@/services/linkEventService';
import { wishService, WISH_LIFETIME_DAYS } from '@/services/wishService';
import { startEventBoostCheckout } from '@/services/boostService';
import FloatingNavbar from '@/components/v2/FloatingNavbar';
import CategoryFilter from '@/components/v2/CategoryFilter';
import AuthModal from '@/components/v2/AuthModal';
import LatestCommentBubble from '@/components/v2/LatestCommentBubble';
import EventCard from '@/components/v2/EventCard';
import SearchResults from '@/components/v2/SearchResults';
import SavedPanel from '@/components/v2/SavedPanel';
import ProfilePanel from '@/components/v2/ProfilePanel';
import WelcomeOverlay from '@/components/v2/WelcomeOverlay';
import { userService } from '@/services/userService';
import { starService } from '@/services/starService';
import { storageService } from '@/services/storageService';
import { recordEventView } from '@/services/eventStatsService';
import { X, ImagePlus } from 'lucide-react';
import { EVENT_CATEGORIES, EventCategoryType, SPECIAL_CATEGORY_KEYS } from '@/utils/categories';
import { classifySource } from '@/utils/sources';
import { isEventPast } from '@/components/v2/v2MapBricka';
import { useAuth } from '@/context/AuthContext';
import { useSaveUserCity } from '@/hooks/useSaveUserCity';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getNotisStatus, enableEventReminders } from '@/utils/fcm';
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

/**
 * Vid dagbyte: välj eventet som ligger närmast en geo-PUNKT (kartans mitt — det
 * man tittar på just nu) i stället för det tidigare eventet. Då slipper man flyga
 * iväg till en annan stad bara för att den nya dagen råkar ha sitt närmaste event
 * (relativt det gamla) någon annanstans. Faller tillbaka till första event om
 * punkten saknas eller inget event för dagen har koords.
 */
/**
 * Normalisera tips-länken: protokoll saknas → https:// läggs på, sedan måste
 * det bli en riktig http(s)-URL med punkt i domänen ("aftonbladet" räcker inte,
 * "javascript:…" stoppas). null = ogiltig → Skapa-knappen hålls inaktiv.
 */
const normalizeTipUrl = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const u = new URL(withProto);
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname.includes('.')) return null;
        return u.toString();
    } catch { return null; }
};

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

// ── Veckovyn (zoom-gatad period) ─────────────────────────────────────────────
// Principen: "ju närmare du zoomar i rummet, desto längre får du zooma ut i
// tiden". Veckoalternativet i dagväljaren låses upp först på stadsnivå, och i
// veckoläge geo-avgränsas eventlistan kring kartans mitt — annars vore en
// vecka × hela Sverige tusentals brickor (kartan kör medvetet ingen
// klustring). Zoom 9 ≈ en stad med omnejd i mobilviewporten.
const WEEK_VIEW_MIN_ZOOM = 9;
// Intervall från så här många dagar räknas som "veckoläge" (helgen = 3 dagar
// ska INTE geo-avgränsas eller zoom-gatas — den har alltid funkat nationellt).
const WEEK_RANGE_MIN_DAYS = 5;
// Radie kring kartans mitt i veckoläge. 60 km täcker viewporten vid zoom 9
// med marginal ("staden + omnejd").
const WEEK_AREA_RADIUS_KM = 60;

export default function HomePage() {
    const [events, setEvents] = useState<LinkEvent[]>([]);
    // True så fort första Firestore-svaret kommit in. Molnet (som visar
    // "X unika event idag") väntar på detta så det inte hinner poppa fram med 0
    // event innan databasen svarat.
    const [eventsLoaded, setEventsLoaded] = useState(false);
    // Skiljt från eventsLoaded: sant först vid det DEFINITIVA aggregat-beskedet.
    // Styr "Inga event den här dagen" så den inte blinkar förbi i introt medan
    // event fortfarande strömmar in (loadern är redan borta då).
    const [eventsSettled, setEventsSettled] = useState(false);
    // Sant när AGGREGATEN (de scrapade eventen) landat — användar-eventen kommer
    // via en egen snabbare poll FÖRE aggregaten, och utan denna spärr visade
    // dagväljar-badgen "1 event" (bara sajtens egna) i flera sekunder innan den
    // hoppade till dagens riktiga antal. Badgen visar "…" tills detta är sant.
    const [dayCountReady, setDayCountReady] = useState(false);
    // filteredEvents är en useMemo längre ner (synkron med events).
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
    // Profilpanelen (profilknappen, inloggad) — allt konto-relaterat på kartan.
    const [profilePanelOpen, setProfilePanelOpen] = useState(false);
    // Kategorifilter (flerval). Tom set = visa alla kategorier.
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    // Sparade kartfilter (inloggade): users/{uid}.mapCategories. catPrefsUid =
    // uid vars sparade filter hydrerats (läses EN gång per konto);
    // lastSavedCatsRef = senast sparade/laddade värdet (sorterad nyckel) så vi
    // bara skriver vid faktiska ändringar; urlHadCategoriesRef = en delad
    // ?kategori=-länk vinner över det sparade.
    const [catPrefsUid, setCatPrefsUid] = useState<string | null>(null);
    const lastSavedCatsRef = useRef<string | null>(null);
    const urlHadCategoriesRef = useRef(false);
    // "offset:days"-nyckel för att skilja dag-/intervallbyten från eventuppdateringar.
    const prevDayKey = useRef(`${dayOffset}:${dayRangeDays}`);
    // Bumpas vid dagbyte → V2Map låter bli att flytta kameran till det nyvalda eventet.
    const [daySwitchNonce, setDaySwitchNonce] = useState(0);
    // Bumpas vid intern kort-navigering (Nästa/Föregående/svep) → kameran står kvar
    // på kartan, vi flyger inte till eventet man bläddrar fram till.
    const [navSelectNonce, setNavSelectNonce] = useState(0);
    // Create-event-flöde: 'idle' = inget pågår, 'placing' = center-pinne synlig på kartan,
    // 'editing' = modal öppen med formulär. (Drop-animationen körs internt i FloatingNavbar.)
    const [creationMode, setCreationMode] = useState<'idle' | 'placing' | 'editing'>('idle');
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const mapCenterRef = useRef(mapCenter);
    mapCenterRef.current = mapCenter;
    // Kartans zoomnivå (null tills kartan rapporterat). Driver veckovyns
    // upplåsning: "ju närmare du zoomar i rummet, desto längre får du zooma
    // ut i tiden" — veckan över hela Sverige vore tusentals brickor (kartan
    // kör medvetet ingen klustring).
    const [mapZoom, setMapZoom] = useState<number | null>(null);
    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('');           // datetime-local-sträng
    const [newEventCategory, setNewEventCategory] = useState<EventCategoryType>('other');
    const [newEventPlace, setNewEventPlace] = useState('');         // platsnamn, valfritt
    const [newEventDescription, setNewEventDescription] = useState(''); // valfri
    const [newEventImage, setNewEventImage] = useState<File | null>(null);
    const [newEventImagePreview, setNewEventImagePreview] = useState('');
    const [creatingEvent, setCreatingEvent] = useState(false);
    // 💡 Tips-läget i skapa-flödet: man lägger in ett event man KÄNNER TILL men
    // inte arrangerar (folk hör ofta av sig och vill få event inlagda). Eventet
    // sparas med länk till källan och presenteras som ett vanligt länk-event —
    // tipsaren står ALDRIG som arrangör/värd. 'host' = eget event som förut.
    const [newEventRole, setNewEventRole] = useState<'host' | 'tip'>('host');
    const [newEventUrl, setNewEventUrl] = useState('');   // tips: länk till källan (krävs)
    const [newEventHost, setNewEventHost] = useState('');  // tips: arrangörens namn (valfritt)
    // ── Önska-funktionen ✨ ──────────────────────────────────────────────────
    // Modalen har två lägen: skapa ett riktigt event ELLER önska ett ("någon
    // borde ordna X här"). En önskan har bara titel/kategori/beskrivning —
    // ingen tid, ingen bild — och lever i 14 dagar eller tills någon skapar
    // eventet av den. Bara inloggade får önska (spärren ligger vid Spara,
    // precis som för skapa event).
    const [createKind, setCreateKind] = useState<'event' | 'wish'>('event');
    // Önskan som ett "Skapa det här eventet"-klick utgick ifrån: modalen är då
    // förifylld från den, och när eventet skapas kvitteras önskan (fulfilled).
    const [fulfillingWish, setFulfillingWish] = useState<EventWish | null>(null);
    // "Ändra plats"-varvet: modalen göms, en center-pin + bekräfta-pill visas
    // och kartan kan panoreras. Bekräfta → pickedLocation = kartans mitt.
    const [repicking, setRepicking] = useState(false);
    // Aktiva önskningar (egen 30 s-poll — blandas ALDRIG in i events-listan,
    // aggregaten eller "Nästa"-poolen). selectedWish = öppet önske-kort.
    const [wishes, setWishes] = useState<EventWish[]>([]);
    const [selectedWish, setSelectedWish] = useState<EventWish | null>(null);
    // Sessionens egna nyskapade önskningar (syns direkt, innan pollen hunnit
    // hämta dem — samma idé som myCreatedRef för event) respektive lokalt
    // uppfyllda/raderade (göms direkt, även om en redan startad poll hinner
    // svara med dem).
    const myWishesRef = useRef<EventWish[]>([]);
    const goneWishIdsRef = useRef<Set<string>>(new Set());

    // Gemensam nollställning av HELA skapa/önska-flödet — delas av Avbryt,
    // Escape och lyckad skapning så inget läge (t.ex. fulfillingWish) lever kvar.
    const resetCreateFlow = useCallback(() => {
        setCreationMode('idle');
        setPickedLocation(null);
        setNewEventTitle('');
        setNewEventTime('');
        setNewEventCategory('other');
        setNewEventPlace('');
        setNewEventDescription('');
        setNewEventImage(null);
        setNewEventImagePreview('');
        setNewEventRole('host');
        setNewEventUrl('');
        setNewEventHost('');
        setCreateKind('event');
        setFulfillingWish(null);
        setRepicking(false);
    }, []);

    // Escape stänger skapa event-modalen (samma städning som Avbryt-knappen) —
    // standardbeteende för dialoger, viktigt för tangentbordsanvändare. Mitt i
    // ett "Ändra plats"-varv backar Escape bara till formuläret.
    useEffect(() => {
        if (creationMode !== 'editing') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (repicking) { setRepicking(false); return; }
            resetCreateFlow();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [creationMode, repicking, resetCreateFlow]);

    // Inloggning i modal — man lämnar aldrig kartan. reason visas i modalen.
    const { user, loading: authLoading } = useAuth();
    const [authModal, setAuthModal] = useState<{ open: boolean; reason?: string }>({ open: false });
    const openLogin = useCallback((reason?: string) => setAuthModal({ open: true, reason }), []);

    // True när funktions-väskan (uppe till vänster i V2Map) är utfälld.
    const [funcBagOpen, setFuncBagOpen] = useState(false);

    // Zoom-knappen i Nästa-pillen bumpar denna → V2Map zoomar in på det valda
    // eventet (klicket gör samtidigt "Nästa" i EventCard, så man landar inzoomad
    // på nästa event).
    const [zoomToEventTrigger, setZoomToEventTrigger] = useState(0);
    // Zooma ut-knappen i Nästa-pillen — bumpar denna trigger.
    const [zoomOutTrigger, setZoomOutTrigger] = useState(0);

    // Shop-flaggor från V2Map. När användaren avaktiverar "Sol" eller "Fokus" i
    // funktioner-shoppen försvinner respektive knapp ur EventCard (vi skickar
    // helt enkelt inte ner callbacken — kortet renderar inte knappen utan den).
    // createEvent styr om +-knappen i navbaren renderas; multiplayer används som
    // gate för delade event m.m. (bara visning av status tills vidare).
    const [shopFlags, setShopFlags] = useState<{ createEvent: boolean; multiplayer: boolean }>({
        createEvent: true, multiplayer: false
    });
    const handleFeatureFlagsChange = useCallback((flags: { createEvent: boolean; multiplayer: boolean }) => {
        setShopFlags(prev =>
            prev.createEvent === flags.createEvent && prev.multiplayer === flags.multiplayer
                ? prev : flags
        );
    }, []);
    // Multiplayer aktiveras via en kontoregistrering — i modalen, på kartan
    // (gamla /login-sidan är skrotad). Efteråt togglar man badgen i väskan.
    const handleActivateMultiplayer = useCallback(() => {
        openLogin('Skapa ett konto för att aktivera multiplayer');
    }, [openLogin]);

    // Användarskapade event ska ALLTID vara kvar på kartan. Pollen är progressiv:
    // stegen destinationer → kort → beskrivningar saknar användarevent (bara sista
    // steget har dem), så utan skydd blinkar egna event bort ~var 30:e sekund.
    // myCreatedRef = den här sessionens optimistiskt skapade event (syns direkt,
    // innan pollen hunnit hämta dem). lastUserEventsRef = senast kända DB-set av
    // användarevent. Båda slås in i varje callback (id-dedup → `fetched` vinner).
    const myCreatedRef = useRef<LinkEvent[]>([]);
    const lastUserEventsRef = useRef<LinkEvent[]>([]);
    // Real-time Firestore listener — uppdaterar kartan direkt när scraper hittar events
    useEffect(() => {
        const unsubscribe = linkEventService.subscribeToAll(true, (fetched) => {
            const fetchedUser = fetched.filter(e => e.userCreated);
            if (fetchedUser.length) lastUserEventsRef.current = fetchedUser;
            const seen = new Set(fetched.map(e => e.id));
            const extras: LinkEvent[] = [];
            for (const e of [...myCreatedRef.current, ...lastUserEventsRef.current]) {
                if (!seen.has(e.id)) { seen.add(e.id); extras.push(e); }
            }
            const sorted = [...fetched, ...extras].sort((a, b) => a.time.getTime() - b.time.getTime());
            setEvents(sorted);
            // Så fort FÖRSTA batchen med event finns → sluta visa "Laddar event…".
            // Datan är på kartan (nålarna syns), och det är allt introt behöver — vi
            // väntar inte på det avslutande aggregat-beskedet nedan (det dröjer och
            // påverkar inte det man redan ser). Blink-skyddet mot "Inga event" är
            // kvar: vi tänder bara tidigt när det FAKTISKT finns event (sorted > 0);
            // en äkta tom dag väntar fortf. på det definitiva beskedet.
            if (sorted.length > 0) setEventsLoaded(true);
            // Aggregaten med i batchen (något icke-användarskapat event) → dagens
            // riktiga antal är här; badgen får byta "…" mot siffran.
            if (fetched.some(e => !e.userCreated)) setDayCountReady(true);
        }, () => {
            // DEFINITIVT "laddat"-besked: första aggregat-laddningen är klar (datan
            // finns, eller så är det en äkta tom dag). Först nu får popupar visas —
            // aldrig medan datan fortfarande hämtas (då blinkade "Inga event den här
            // dagen" förbi med 0/halvladdad data).
            setEventsLoaded(true);
            setEventsSettled(true);
            // Definitivt besked = även en äkta tom dag (0 aggregat-event) räknas
            // som "siffran är klar" — annars stod badgen på "…" för evigt.
            setDayCountReady(true);
        });
        // Säkerhetsnät om nätverket HÄNGER (fetch som aldrig resolvar → ingen signal):
        // efter 15 s räknas det ändå som laddat så spinnern inte snurrar för evigt.
        const hangGuard = setTimeout(() => { setEventsLoaded(true); setEventsSettled(true); setDayCountReady(true); }, 15000);
        return () => { unsubscribe(); clearTimeout(hangGuard); };
    }, []);

    // Önskningarna: EGEN poll (samma mönster som användarevent-hämtningen i
    // linkEventService — de bor bara i Firestore). Servicen filtrerar redan
    // bort uppfyllda + utgångna; här slås sessionens egna nyskapade in (syns
    // direkt) och lokalt uppfyllda/raderade hålls borta även om en poll som
    // startade före skrivningen hinner svara med dem.
    useEffect(() => {
        let active = true;
        const load = async () => {
            const fetched = await wishService.fetchActiveWishes();
            if (!active) return;
            const nowMs = Date.now();
            const seen = new Set(fetched.map(w => w.id));
            const extras = myWishesRef.current.filter(w => !seen.has(w.id) && w.expiresAt.getTime() > nowMs);
            setWishes([...fetched, ...extras].filter(w => !goneWishIdsRef.current.has(w.id)));
        };
        load();
        const iv = setInterval(load, 30000);
        return () => { active = false; clearInterval(iv); };
    }, []);

    // Håll det ÖPPNA kortet i synk med den progressiva laddningen: cards-/
    // descriptions-lagren mergar in NYA, rikare objekt (bild/värd/pris/
    // beskrivning) i events-listan — men selectedEvent pekade kvar på det
    // GAMLA magra objektet från urvalsögonblicket. Ett kort som öppnats före
    // mergen (djuplänk, tidigt kartklick) stod då för alltid utan bild och med
    // "Ingen beskrivning tillgänglig". Peka om till färska objektet per id.
    useEffect(() => {
        setSelectedEvent(prev => {
            if (!prev) return prev;
            const fresh = events.find(e => e.id === prev.id);
            return fresh && fresh !== prev ? fresh : prev;
        });
    }, [events]);

    // Klick på en önske-bricka på kartan (null = tom karta-klick → stäng kortet).
    // Önske-kortet ersätter eventkortet — de ska aldrig ligga öppna samtidigt.
    // Mitt i skapa-flödet ("Ändra plats"-varvet håller kartan klickbar) ignoreras
    // önske-klick så kortet inte krockar med modalen/bekräfta-pillen.
    const handleSelectWish = useCallback((wish: EventWish | null) => {
        if (wish && creationMode === 'editing') return;
        setSelectedWish(wish);
        if (wish) setSelectedEvent(null);
    }, [creationMode]);

    // Väljs ett event någon annan väg (kortbläddring, sök, sparat-listan) ska
    // önske-kortet också stängas — samma "en i taget"-regel som ovan.
    useEffect(() => {
        if (selectedEvent) setSelectedWish(null);
    }, [selectedEvent]);

    // Ta bort sin EGEN önskan (kryss i önske-kortet; reglerna verifierar ägarskap).
    const handleDeleteWish = useCallback(async (wishId: string) => {
        try {
            await wishService.deleteWish(wishId);
            goneWishIdsRef.current.add(wishId);
            myWishesRef.current = myWishesRef.current.filter(w => w.id !== wishId);
            setWishes(prev => prev.filter(w => w.id !== wishId));
            setSelectedWish(prev => (prev?.id === wishId ? null : prev));
            toast.success('Önskan är borttagen.');
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte ta bort önskan.');
        }
    }, []);

    // "Skapa det här eventet" på ett önske-kort → öppna vanliga skapa-modalen
    // med titel/kategori/beskrivning/plats FÖRIFYLLDA från önskan (allt
    // justerbart — platsen via "Ändra plats"-varvet). Tiden förifylls som i
    // +-flödet (nästa hela timme) eftersom önskningar saknar tid.
    const startFulfillWish = useCallback((wish: EventWish) => {
        setSelectedWish(null);
        setFulfillingWish(wish);
        setCreateKind('event');
        setPickedLocation({ lat: wish.lat, lng: wish.lng });
        setNewEventTitle(wish.title);
        setNewEventCategory(wish.category in EVENT_CATEGORIES ? wish.category : 'other');
        setNewEventDescription(wish.description || '');
        setNewEventPlace('');
        const t = new Date(); t.setMinutes(0, 0, 0); t.setHours(t.getHours() + 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        setNewEventTime(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`);
        setCreationMode('editing');
    }, []);

    // Filtrera events för vald dag ELLER valt intervall (t.ex. helgen = fre–sön).
    // useMemo (inte state-i-effekt) → listan är ALLTID i synk med events inom
    // samma render. Annars fanns ett mellanläge där eventsLoaded blivit true men
    // dagens lista ännu var tom → "Inga event" hann blinka förbi innan datan
    // filtrerats klart.
    //
    // VECKOVYN är geo-avgränsad: från WEEK_RANGE_MIN_DAYS dagar filtreras
    // eventen dessutom till en radie kring kartans mitt. Utan avgränsningen
    // vore en vecka × hela Sverige tusentals brickor (ingen klustring).
    // Centrum rundas till ~5 km-rutor (weekAreaKey) så listan inte räknas om
    // — och markörerna inte omsyncas — för varje liten panorering.
    const weekAreaKey = dayRangeDays >= WEEK_RANGE_MIN_DAYS && mapCenter
        ? `${Math.round(mapCenter.lat * 20) / 20}:${Math.round(mapCenter.lng * 20) / 20}`
        : null;
    const filteredEvents = useMemo(() => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setDate(endOfDay.getDate() + (dayRangeDays - 1));
        endOfDay.setHours(23, 59, 59, 999);

        const inRange = events.filter(evt => evt.time >= startOfDay && evt.time <= endOfDay);
        if (!weekAreaKey) return inRange;

        // Veckoläge: behåll bara event inom radien kring kartans (rundade)
        // mitt. Event utan koordinater släpps igenom — de kan ändå inte ritas
        // som brickor och ska inte försvinna ur sök/listor.
        const [cLat, cLng] = weekAreaKey.split(':').map(Number);
        return inRange.filter(evt =>
            !hasValidCoords(evt) || haversineKm(cLat, cLng, evt.lat, evt.lng) <= WEEK_AREA_RADIUS_KM
        );
    }, [events, dayOffset, dayRangeDays, weekAreaKey]);

    // Zoomar man ut ur områdesvyn medan veckoläget är på → tillbaka till en
    // dag (offset behålls). 0.5 zoomstegs hysteres mot upplåsningsgränsen så
    // det inte flappar precis på tröskeln.
    useEffect(() => {
        if (dayRangeDays >= WEEK_RANGE_MIN_DAYS && mapZoom !== null && mapZoom < WEEK_VIEW_MIN_ZOOM - 0.5) {
            setDayRangeDays(1);
        }
    }, [mapZoom, dayRangeDays]);

    // När dagen/intervallet byts: välj eventet närmast KARTANS MITT (det man
    // tittar på) och be V2Map att INTE flytta kameran — vi vill stanna kvar i
    // vyn i stället för att flyga iväg till en annan stad. (Bara vid byte,
    // inte vid varje Firestore-uppdatering.)
    useEffect(() => {
        const dayKey = `${dayOffset}:${dayRangeDays}`;
        if (prevDayKey.current !== dayKey) {
            setSelectedEvent(pickNearestToPoint(mapCenterRef.current, filteredEvents));
            prevDayKey.current = dayKey;
            setDaySwitchNonce(n => n + 1);
        }
    }, [filteredEvents, dayOffset, dayRangeDays]);

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
        // Tips ("jag arrangerar inte själv") kräver en giltig länk till källan —
        // det är länken som gör att eventet presenteras som ett vanligt länk-
        // event i stället för med tipsaren som värd.
        const isTip = newEventRole === 'tip';
        const tipUrl = isTip ? normalizeTipUrl(newEventUrl) : null;
        if (isTip && !tipUrl) { toast.error('Lägg in en giltig länk till eventet — t.ex. arrangörens sida.'); return; }
        if (!user) { openLogin(isTip ? 'Logga in för att tipsa om event' : 'Logga in för att skapa event'); return; }
        setCreatingEvent(true);
        try {
            const time = new Date(newEventTime);
            // Tips: värden är arrangören man tipsar om (angivet namn, annars
            // länkens domän) — aldrig tipsarens eget namn. Eget event: som förut.
            const hostName = isTip
                ? (newEventHost.trim() || new URL(tipUrl!).hostname.replace(/^www\./, ''))
                : (user.displayName || user.email || 'VADKUL-användare');
            // Ladda upp ev. eventbild först så URL:en kan sparas på eventet.
            let coverImage = '';
            if (newEventImage) {
                try {
                    coverImage = await storageService.uploadFile(`event-images/${user.uid}/`, newEventImage);
                } catch (e) {
                    console.warn('Kunde inte ladda upp eventbilden — skapar utan bild:', e);
                }
            }
            const docId = await linkEventService.createUserEvent({
                title: newEventTitle,
                time,
                lat: pickedLocation.lat,
                lng: pickedLocation.lng,
                locationName: newEventPlace,
                description: newEventDescription,
                category: newEventCategory,
                hostName,
                hostUid: user.uid,
                coverImage,
                url: tipUrl ?? '',
            });
            const created: LinkEvent = {
                id: docId, url: tipUrl ?? '', title: newEventTitle.trim(), time, createdAt: new Date(),
                locationName: newEventPlace.trim(), lat: pickedLocation.lat, lng: pickedLocation.lng,
                hostName,
                category: newEventCategory, coverImage, description: newEventDescription.trim(), attendees: 0,
                isLocationVerified: true, userCreated: true, hostUid: user.uid,
            } as LinkEvent;
            // Behåll i sessions-listan så pollen inte rensar bort det (se myCreatedRef).
            myCreatedRef.current = [...myCreatedRef.current, created];
            setEvents(prev => [...prev, created].sort((a, b) => a.time.getTime() - b.time.getTime()));
            // Hoppa till eventets dag så det garanterat ligger inom dag-filtret —
            // annars syns det inte om det skapades för en annan dag än den visade.
            const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
            const startEvt = new Date(time); startEvt.setHours(0, 0, 0, 0);
            const dayOffsetForEvent = Math.round((startEvt.getTime() - startToday.getTime()) / 86_400_000);
            setDayOffset(dayOffsetForEvent);
            setDayRangeDays(1);
            setSelectedEvent(created);
            // Skapades eventet AV EN ÖNSKAN → kvittera den (fulfilled=true) så
            // önske-brickan försvinner från kartan för alla. Optimistiskt lokalt
            // först; själva skrivningen är best-effort (eventet är redan skapat
            // — en misslyckad kvittens ska inte fälla flödet, önskan dör ändå
            // av sig själv via expiresAt).
            if (fulfillingWish) {
                const wishId = fulfillingWish.id;
                goneWishIdsRef.current.add(wishId);
                myWishesRef.current = myWishesRef.current.filter(w => w.id !== wishId);
                setWishes(prev => prev.filter(w => w.id !== wishId));
                setSelectedWish(prev => (prev?.id === wishId ? null : prev));
                wishService.markFulfilled(wishId).catch(err =>
                    console.warn('Kunde inte kvittera önskan som uppfylld:', err));
            }
            toast.success(fulfillingWish
                ? 'Önskan uppfylld — eventet är skapat och syns på kartan! ✨🎉'
                : isTip
                ? 'Tack för tipset — eventet syns nu på kartan! 💡'
                : 'Eventet är skapat och syns på kartan! 🎉');
            resetCreateFlow();
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte skapa eventet. Försök igen.');
        } finally {
            setCreatingEvent(false);
        }
    }, [pickedLocation, newEventTitle, newEventTime, newEventCategory, newEventPlace, newEventDescription, newEventImage, newEventRole, newEventUrl, newEventHost, user, openLogin, fulfillingWish, resetCreateFlow]);

    // Önska ett event: kräver konto (samma spärr som skapa), skrivs till den
    // EGNA collectionen eventWishes (aldrig linkEvents) och dyker upp direkt
    // på kartan via optimistisk insättning (pollen tar sedan över).
    const handleCreateWish = useCallback(async () => {
        if (!pickedLocation || !newEventTitle.trim()) return;
        if (!user) { openLogin('Logga in för att önska ett event'); return; }
        setCreatingEvent(true);
        try {
            const created = await wishService.createWish({
                title: newEventTitle,
                category: newEventCategory,
                description: newEventDescription,
                lat: pickedLocation.lat,
                lng: pickedLocation.lng,
                uid: user.uid,
                hostName: user.displayName || user.email || 'VADKUL-användare',
            });
            myWishesRef.current = [...myWishesRef.current, created];
            setWishes(prev => [...prev, created]);
            toast.success(`Önskan är ute på kartan! ✨ Den syns i ${WISH_LIFETIME_DAYS} dagar — eller tills någon skapar eventet.`);
            resetCreateFlow();
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte spara önskan. Försök igen.');
        } finally {
            setCreatingEvent(false);
        }
    }, [pickedLocation, newEventTitle, newEventCategory, newEventDescription, user, openLogin, resetCreateFlow]);

    // Ta bort sitt EGET användarskapade event: Firestore-delete (reglerna
    // verifierar ägarskap) + optimistisk borttagning ur kartan/kortleken.
    const handleDeleteOwnEvent = useCallback(async (eventId: string) => {
        try {
            await linkEventService.deleteUserEvent(eventId);
            myCreatedRef.current = myCreatedRef.current.filter(e => e.id !== eventId);
            lastUserEventsRef.current = lastUserEventsRef.current.filter(e => e.id !== eventId);
            setEvents(prev => prev.filter(e => e.id !== eventId));
            setSelectedEvent(prev => (prev?.id === eventId ? null : prev));
            setSavedEventIds(prev => {
                if (!prev.has(eventId)) return prev;
                const next = new Set(prev);
                next.delete(eventId);
                return next;
            });
            toast.success('Eventet är borttaget.');
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte ta bort eventet.');
        }
    }, []);

    // Boosta sitt EGET event: startar Stripe Checkout (redirect). featuredUntil
    // sätts först av backend efter genomförd betalning — aldrig härifrån.
    const handleBoostOwnEvent = useCallback(async (eventId: string) => {
        try {
            const t = toast.loading('Öppnar betalning…');
            await startEventBoostCheckout(eventId); // redirectar vid succé
            toast.dismiss(t);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Kunde inte starta boost.');
        }
    }, []);

    // Notis-nudge vid första gillningen (en gång per enhet): påminnelserna når
    // bara konton med en sparad FCM-token, och tillstånds-frågan måste komma
    // från en riktig tap — gilla-tappen är den. Bara när frågan går att ställa
    // ('default') och användaren är inloggad (token sparas per konto); annars
    // finns vägen kvar via profilpanelens notis-rad.
    const notisNudgeShownRef = useRef(false);
    const maybeNudgeNotiser = useCallback(() => {
        if (notisNudgeShownRef.current || !user) return;
        if (localStorage.getItem('vadkul_notis_nudge_done')) return;
        if (getNotisStatus() !== 'default') return;
        notisNudgeShownRef.current = true;
        localStorage.setItem('vadkul_notis_nudge_done', '1');
        const uid = user.uid;
        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="text-sm font-bold">
                    Vill du få en påminnelse 1 h innan dina gillade event börjar?
                </span>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const res = await enableEventReminders(uid);
                            if (res === 'on') toast.success('Notiser på!');
                            else if (res === 'denied') toast.error('Notiser är blockerade — tillåt dem för vadkul.se i webbläsarens inställningar.');
                            else toast.error('Kunde inte aktivera notiser. Försök igen.');
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#006AA7] hover:bg-[#005590] text-white text-xs font-black transition-colors"
                    >
                        Ja, aktivera notiser
                    </button>
                    <button
                        type="button"
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3.5 py-1.5 rounded-full text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
                    >
                        Nej tack
                    </button>
                </div>
            </div>
        ), { duration: 12000, icon: '🔔' });
    }, [user]);

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
        maybeNudgeNotiser();
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

    // Opt-in-källor (Korpen/Svenska kyrkan/PRO) har väldigt många event och är
    // avstängda som default: deras event GÖMS tills användaren själv kryssar i
    // källan. Övriga (normala) kategorier behåller "tom = visa alla". Därför
    // delar vi upp valet — opt-in-källorna ska inte räknas in i normal-valet
    // (annars skulle en ikryssad källa dölja alla andra event).
    const selectedNormal = useMemo(
        () => new Set([...selectedCategories].filter(id => !SPECIAL_CATEGORY_KEYS.has(id))),
        [selectedCategories],
    );
    const matchesFilter = useCallback((evt: LinkEvent) => {
        // Användarskapade event är sajtens kärna → de syns ALLTID och kringgår
        // hela kategori-/källfiltret: de göms aldrig av ett aktivt kategori-val
        // och ligger aldrig i opt-in-källorna (Korpen/Svenska kyrkan/PRO), så
        // deras opt-in-beteende påverkas inte.
        if (evt.userCreated) return true;
        const src = classifySource(evt.url || evt.id);
        // Special-källa: syns bara om den är ikryssad (ingår inte i "visa alla").
        if (src) return selectedCategories.has(src);
        // Normalt event: tomt normal-val = visa alla, annars matcha kategori.
        if (selectedNormal.size === 0) return true;
        const catKey = evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other';
        return selectedNormal.has(catKey);
    }, [selectedCategories, selectedNormal]);

    // Kategorifiltret appliceras sist i kedjan: dag → sök → kategori.
    const visibleEvents = useMemo(
        () => searchFilteredEvents.filter(matchesFilter),
        [searchFilteredEvents, matchesFilter],
    );

    // Antal synliga event för dagen (efter kategori-/källfilter). Speglar kartan.
    const dayEventCount = visibleEvents.length;

    // Antal event totalt för idag (oavsett filter) för välkomstmodalen
    const todayEventCount = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        return events.filter(evt => evt.time >= startOfToday && evt.time <= endOfToday).length;
    }, [events]);

    // Antal event som börjar inom 1 timme (för välkomstmodalen)
    const soonEventCount = useMemo(() => {
        const now = Date.now();
        const oneHourFromNow = now + 60 * 60 * 1000;
        return events.filter(evt => {
            const timeMs = evt.time.getTime();
            return timeMs > now && timeMs <= oneHourFromNow;
        }).length;
    }, [events]);

    // Siffran vid dag-väljaren: som DEFAULT en total som INKLUDERAR opt-in-
    // källorna (PRO/Svenska kyrkan/Korpen) så man ser hur mycket som faktiskt
    // händer den dagen — även om de är dolda på kartan. Så fort man filtrerar
    // speglar den i stället filtret: källorna räknas bara med om man valt dem
    // manuellt i kategorimenyn (då ingår de redan i visibleEvents).
    const dayTotalCount = useMemo(
        () => (selectedCategories.size === 0 ? searchFilteredEvents.length : visibleEvents.length),
        [selectedCategories, searchFilteredEvents, visibleEvents],
    );

    // Dag-/kategori-/eventval renderar om stora träd (kortet, listorna) och
    // triggar kartans GL-uppdateringar — som transitions är omrenderingen
    // avbrytbar och blockerar inte tappen (INP på kartsidan låg >500 ms mobil).
    const [, startTransition] = useTransition();

    const handleToggleCategory = useCallback((id: string) => {
        startTransition(() => setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        }));
    }, []);
    const handleClearCategories = useCallback(() => startTransition(() => setSelectedCategories(new Set())), []);

    // Byt visad dag/intervall — från dagväljaren eller återställningsknappen.
    const handleDayRangeChange = useCallback((offset: number, days: number) => {
        startTransition(() => {
            setDayOffset(offset);
            setDayRangeDays(days);
        });
    }, []);

    // Eventval (kartklick, Nästa/Föregående, sök/sparat) — samma transition-
    // skäl. Nonce-bumpar och panelstängningar förblir urgenta (billiga) så
    // suppress-refarna hinner armeras innan valet landar.
    const selectEventSmooth = useCallback((evt: LinkEvent | null) => {
        startTransition(() => setSelectedEvent(evt));
    }, []);

    // Sök-, sparat- och profilpanelen delar plats under navbaren — en i taget.
    useEffect(() => {
        if (searchQuery.trim()) { setSavedPanelOpen(false); setProfilePanelOpen(false); }
    }, [searchQuery]);
    const handleToggleSaved = useCallback(() => {
        setSavedPanelOpen(o => !o);
        setProfilePanelOpen(false);
        setSearchQuery('');
    }, []);
    const handleToggleProfile = useCallback(() => {
        setProfilePanelOpen(o => !o);
        setSavedPanelOpen(false);
        setSearchQuery('');
    }, []);

    // Användarens egna skapade event — visas i profilpanelen.
    const myEvents = useMemo(
        () => (user ? events.filter(e => e.userCreated && e.hostUid === user.uid) : []),
        [events, user]
    );

    // Aktivt sparade = sparade event som ÄNNU INTE passerat (samma isEventPast-
    // gräns som SavedPanel/kartan: start + 1 h, kl 20 för event utan klockslag).
    // Passerade sparade räknas som HISTORIK och ska inte blåsa upp
    // hjärt-badgen / "Sparade event"-räknaren — de ligger under Historik i panelen.
    const activeSavedCount = useMemo(() => {
        const nowMs = Date.now();
        let n = 0;
        for (const e of events) {
            if (savedEventIds.has(e.id) && !isEventPast(e, nowMs)) n++;
        }
        return n;
    }, [events, savedEventIds]);

    // Användarens GPS-position — rapporteras upp från kartan (den blå plats-
    // pricken; tyst hämtning vid start + "Min plats"-knappen). EventCard visar
    // avståndet från den till det valda eventet. null tills positionen är känd.
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

    // Spegla närmaste stad till users/{uid} (max 1 gång/dygn) — underlag för
    // stadssegmenterade medlemsutskick. Manuellt vald stad i profilen vinner.
    useSaveUserCity(userPos);

    // Hoppa till ett specifikt event (från sökträff eller sparat-listan): byt
    // till eventets dag, välj det (kameran flyger dit) och stäng panelen.
    // prevDayKey markeras som hanterad så dagbytes-heuristiken inte byter bort
    // vårt val mot närmaste-event-logiken.
    const jumpToEvent = useCallback((evt: LinkEvent) => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const offset = Math.floor((evt.time.getTime() - startOfToday.getTime()) / 86_400_000);
        prevDayKey.current = `${offset}:1`;
        // Panelerna stängs urgent (direkt visuell respons); dag+val är den
        // tunga omrenderingen och körs som transition.
        setSearchQuery('');
        setSavedPanelOpen(false);
        setProfilePanelOpen(false);
        startTransition(() => {
            setDayOffset(offset);
            setDayRangeDays(1);
            setSelectedEvent(evt);
        });
    }, []);

    // Ta bort från sparade (hjärtat på kortet eller krysset i sparat-listan).
    const handleUnsaveEvent = useCallback((eventId: string) => {
        setSavedEventIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
        });
    }, []);

    // ── Stjärn-gåvan ⭐: /?stjarna=<KOD> ─────────────────────────────────────
    // Tack-kampanj till de första användarna: EN gemensam gåvolänk ger varje
    // konto EN stjärna som sätts på valfritt event — eventet lyser då (guld-
    // bricka + alltid synlig, som userCreated) för ALLA tills det passerat.
    // All skrivning sker i Cloud Functions (redeemStarGift/placeStar);
    // klienten läser bara eventStars + sitt eget starGift-fält.
    //
    // Vilka event som har en stjärna — litet live-set som överlagras på kartan
    // och kortet (stjärnan bor ALDRIG i aggregaten: de byggs 1 gång/dygn +
    // CDN-cachas och skulle släpa upp till ett dygn).
    const [starredEventIds, setStarredEventIds] = useState<Set<string>>(new Set());
    useEffect(() => starService.subscribeStarredEventIds(setStarredEventIds), []);

    // Egen stjärn-status: 'none' = ingen (eller utloggad), 'unused' = hämtad
    // men inte satt, 'placed' = förbrukad. Läses från users/{uid} vid inloggning
    // och uppdateras optimistiskt efter lyckade funktionsanrop.
    const [starGiftStatus, setStarGiftStatus] = useState<'none' | 'unused' | 'placed'>('none');
    useEffect(() => {
        if (!user) { setStarGiftStatus('none'); return; }
        let cancelled = false;
        userService.getUserProfile(user.uid).then(profile => {
            if (cancelled || !profile) return;
            setStarGiftStatus(profile.starGift === 'unused' ? 'unused'
                : profile.starGift === 'placed' ? 'placed' : 'none');
        }).catch(err => console.warn('Kunde inte läsa stjärn-status:', err));
        return () => { cancelled = true; };
    }, [user]);

    // Gåvolänken läses EN gång vid mount (samma anda som ?event=-hanteringen
    // nedan, men oberoende av eventsLoaded — inlösen behöver ingen eventdata).
    // Koden parkeras i en ref och parametern städas ur URL:en direkt så en
    // omladdning inte försöker igen. Utloggad → login-modalen med förklaring;
    // inlösen-effekten nedan fyrar sedan så fort user landat.
    const pendingStarCodeRef = useRef<string | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('stjarna');
        if (!code) return;
        pendingStarCodeRef.current = code;
        params.delete('stjarna');
        const qs = params.toString();
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!pendingStarCodeRef.current) return;
        // Vänta tills Firebase återställt sessionen — annars öppnas login-
        // modalen i onödan för redan inloggade (user är null under restoren).
        if (authLoading) return;
        if (!user) {
            // Visa login-modalen (en gång räcker — koden ligger kvar i refen
            // och effekten körs om när user loggat in).
            openLogin('Logga in för att hämta din stjärna ⭐');
            return;
        }
        const code = pendingStarCodeRef.current;
        pendingStarCodeRef.current = null;
        (async () => {
            const res = await starService.redeemStarGift(code);
            if (res.success) {
                setStarGiftStatus('unused');
                toast.success('Du har en stjärna! Öppna ett event och tryck på ⭐ bredvid hjärtat.', { duration: 8000, icon: '⭐' });
            } else {
                // Redan hämtad/placerad eller ogiltig kod — statusen från
                // profilhämtningen ovan gäller; visa bara beskedet.
                toast(res.message, { icon: '⭐', duration: 6000 });
            }
        })();
    }, [user, authLoading, openLogin]);

    // Sätt stjärnan (bekräftelsedialogen bor i LinkEventCard). Optimistisk
    // uppdatering av båda staten — eventStars-lyssnaren bekräftar strax efter.
    const handlePlaceStar = useCallback(async (eventId: string) => {
        if (!user) { openLogin('Logga in för att sätta din stjärna ⭐'); return; }
        const res = await starService.placeStar(eventId);
        if (res.success) {
            setStarGiftStatus('placed');
            setStarredEventIds(prev => {
                const next = new Set(prev);
                next.add(eventId);
                return next;
            });
            toast.success('Din stjärna sitter! ⭐ Eventet lyser nu för alla.', { duration: 6000 });
        } else {
            toast.error(res.message);
        }
    }, [user, openLogin]);

    // ── Delbara länkar: ?event=<id>&dag=<n>&kategori=<a,b> ──────────────────
    // Läses EN gång när eventlistan först landat; därefter speglas valt event/
    // dag/kategorier till URL:en med replaceState (ingen history-spam, ingen
    // Next-navigation). Att dela länken återskapar exakt vy.
    const urlApplied = useRef(false);
    // Sant när en delad länk styrde dag eller event — då ska auto-hoppet till
    // Imorgon (nedan) aldrig lägga sig i.
    const deepLinkedRef = useRef(false);
    // Djuplänkat event-id som ännu inte HITTATS i listan. Laddningen är
    // progressiv (dagens slice → fulla lagret → cards/desc + user-events i egen
    // poll) — vid kall last landar eventsLoaded ofta med BARA dagens event, och
    // ett stadsside-klick på en annan dags event fanns då inte ännu. Förr
    // gjordes uppslaget en enda gång ⇒ kortet öppnades bara ibland (varm cache).
    // Nu ligger id:t kvar här och prövas om vid varje events-uppdatering tills
    // det hittas eller datat är definitivt klart (eventsSettled).
    const pendingEventIdRef = useRef<string | null>(null);

    // Öppna det djuplänkade eventet: härled eventets dag så dagfiltret inte
    // gömmer det — och markera dagbytet som "redan hanterat" så day-switch-
    // effekten inte byter bort vårt val mot närmaste-event-heuristiken.
    const applyDeepLinkedEvent = useCallback((target: LinkEvent) => {
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        const offset = Math.floor((target.time.getTime() - startOfToday.getTime()) / 86_400_000);
        prevDayKey.current = `${offset}:1`;
        setDayOffset(offset);
        setSelectedEvent(target);
    }, []);

    useEffect(() => {
        if (!eventsLoaded || urlApplied.current) return;
        urlApplied.current = true;

        const params = new URLSearchParams(window.location.search);
        const kategori = params.get('kategori');
        if (kategori) {
            const valid = kategori.split(',').filter(k => k in EVENT_CATEGORIES || SPECIAL_CATEGORY_KEYS.has(k));
            if (valid.length) {
                setSelectedCategories(new Set(valid));
                urlHadCategoriesRef.current = true;
            }
        }
        const dag = parseInt(params.get('dag') ?? '', 10);
        const dagar = parseInt(params.get('dagar') ?? '', 10);
        const eventId = params.get('event');
        // Redan ett event-ID i länken (hittat eller ej) räknas som djuplänk —
        // auto-hoppet till Imorgon får inte flytta dagen medan vi väntar på
        // att eventet ska dyka upp i en senare batch.
        if (eventId || !Number.isNaN(dag) || !Number.isNaN(dagar)) deepLinkedRef.current = true;
        const target = eventId ? events.find(e => e.id === eventId) : undefined;
        if (target) {
            applyDeepLinkedEvent(target);
        } else if (eventId) {
            pendingEventIdRef.current = eventId;
        }
        if (!target && !Number.isNaN(dag)) {
            setDayOffset(dag);
            if (!Number.isNaN(dagar) && dagar > 1) setDayRangeDays(Math.min(dagar, 31));
        }
    }, [eventsLoaded, events, applyDeepLinkedEvent]);

    // Andra chansen (och tredje…): pröva det väntande djuplänks-id:t mot varje
    // ny events-batch. Först när datat är DEFINITIVT klart (eventsSettled =
    // fulla aggregatlagret hämtat; user-events-queryn är i praktiken alltid
    // före) och eventet ändå saknas ger vi upp — med besked i stället för den
    // gamla tysta tomma kartan.
    useEffect(() => {
        const id = pendingEventIdRef.current;
        if (!id) return;
        const target = events.find(e => e.id === id);
        if (target) {
            pendingEventIdRef.current = null;
            applyDeepLinkedEvent(target);
        } else if (eventsSettled) {
            pendingEventIdRef.current = null;
            toast('Eventet i länken kunde inte hittas — det kan ha passerat eller tagits bort.', { icon: '🤷' });
        }
    }, [events, eventsSettled, applyDeepLinkedEvent]);

    useEffect(() => {
        if (!urlApplied.current) return;   // skriv inte förrän ev. inkommande länk applicerats
        const params = new URLSearchParams();
        // Skriv INTE valt event till URL:en — då återöppnades det senast valda
        // eventet vid varje omladdning (oönskat). Delning av ett specifikt event
        // sker i stället explicit via Dela-knappen (bygger /?event=<id>), och den
        // inkommande ?event=-läsningen ovan öppnar det hos mottagaren.
        if (dayOffset !== 0) params.set('dag', String(dayOffset));
        if (dayRangeDays > 1) params.set('dagar', String(dayRangeDays));
        if (selectedCategories.size > 0) params.set('kategori', [...selectedCategories].join(','));
        const qs = params.toString();
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }, [dayOffset, dayRangeDays, selectedCategories]);

    // ── Sparade kategorifilter (inloggade) ──────────────────────────────────
    // Aktiverar man t.ex. Svenska kyrkan eller PRO ska valet överleva nästa
    // besök — annars "försvinner" de eventen varje gång (Sundsvall-tråden 6/8).
    // Hydrering: läs users/{uid}.mapCategories EN gång per konto, efter att en
    // ev. inkommande ?kategori=-länk applicerats (länken vinner och blir då
    // baslinje — den skriver INTE över det sparade förrän man själv ändrar).
    useEffect(() => {
        if (!user || !eventsLoaded || catPrefsUid === user.uid) return;
        let cancelled = false;
        (async () => {
            let baseline = [...selectedCategories].sort().join(',');
            try {
                if (!urlHadCategoriesRef.current) {
                    const snap = await getDoc(doc(db, 'users', user.uid));
                    const saved = snap.exists() ? (snap.data() as { mapCategories?: unknown }).mapCategories : null;
                    if (Array.isArray(saved)) {
                        const valid = saved.filter((k): k is string =>
                            typeof k === 'string' && (k in EVENT_CATEGORIES || SPECIAL_CATEGORY_KEYS.has(k)));
                        baseline = [...valid].sort().join(',');
                        if (!cancelled && valid.length) setSelectedCategories(new Set(valid));
                    }
                }
            } catch { /* best-effort — kartan störs aldrig av prefs */ }
            if (!cancelled) {
                lastSavedCatsRef.current = baseline;
                setCatPrefsUid(user.uid);
            }
        })();
        return () => { cancelled = true; };
    }, [user, eventsLoaded, catPrefsUid, selectedCategories]);

    // Spara (debounce): först efter hydrering, och bara när valet faktiskt
    // skiljer sig från senast sparade — även tömning sparas (aktivt avval).
    useEffect(() => {
        if (!user || catPrefsUid !== user.uid) return;
        const key = [...selectedCategories].sort().join(',');
        if (key === lastSavedCatsRef.current) return;
        const t = setTimeout(() => {
            setDoc(doc(db, 'users', user.uid), { mapCategories: [...selectedCategories] }, { merge: true })
                .then(() => { lastSavedCatsRef.current = key; })
                .catch(() => { /* best-effort */ });
        }, 1200);
        return () => clearTimeout(t);
    }, [selectedCategories, user, catPrefsUid]);

    // ── Auto-hopp till Imorgon när dagens tidssatta utbud redan varit ────────
    // Sent på kvällen är nästan alla "Idag"-event släckta (past-dämpade 50 %-
    // brickor): allt med klockslag startade för över en timme sedan och kvar
    // finns bara heldagsposter utan specifik tid. Då är Imorgon en vettigare
    // startvy än en karta full av släckta brickor. Beslutet tas EN gång, när
    // aggregaten landat (dayCountReady), och bara i orört default-läge:
    // aldrig när en delad länk styrt dag/event, användaren hunnit byta dag
    // eller redan har ett event öppet.
    const autoDayBumped = useRef(false);
    useEffect(() => {
        if (autoDayBumped.current || !dayCountReady) return;
        autoDayBumped.current = true;
        if (deepLinkedRef.current || dayOffset !== 0 || dayRangeDays !== 1 || selectedEvent) return;
        const now = Date.now();
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        const liveSpecificToday = events.some(e =>
            e.time >= start && e.time <= end &&
            e.hasSpecificTime !== false &&
            !isEventPast(e, now),
        );
        if (!liveSpecificToday) setDayOffset(1);
    }, [dayCountReady, events, dayOffset, dayRangeDays, selectedEvent]);

    // ── Visningsräknare ──────────────────────────────────────────────────────
    // Ett "visat event" = kortet öppnas, oavsett väg hit: kartklick, sök,
    // sparat-listan, Nästa-bläddring eller delad länk (/?event= och /e/[slug]
    // studsar båda in här med kortet öppet). Fire-and-forget till
    // eventStats/{slug} i Firestore; dedupe per event & session så samma kort
    // inte räknas om under ett besök.
    const viewedEventIdsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const id = selectedEvent?.id;
        if (!id || viewedEventIdsRef.current.has(id)) return;
        viewedEventIdsRef.current.add(id);
        recordEventView(id);
    }, [selectedEvent]);

    // Index för valt event i sökresultaten (null = inget valt eller inte i listan)
    const currentEventIndex = selectedEvent
        ? visibleEvents.findIndex(e => e.id === selectedEvent.id)
        : -1;

    // Stabil referens så V2Map:s useEffect inte loopar.
    const handleMapCenterChange = useCallback((lat: number, lng: number, zoom?: number) => {
        setMapCenter({ lat, lng });
        if (typeof zoom === 'number') setMapZoom(zoom);
    }, []);

    // Veckoalternativet i dagväljaren låses upp först när man zoomat in till
    // stadsnivå (se konstantblocket ovanför HomePage).
    const weekUnlocked = mapZoom !== null && mapZoom >= WEEK_VIEW_MIN_ZOOM;

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

    return (
        <main className="relative w-screen h-screen overflow-hidden bg-slate-100">
            {/* 0. SEO/crawl (server-HTML — client-komponenter SSR:as, bara kartan
                är ssr:false): sr-only-H1 ger sidan en rubrik även utan JS, och
                den diskreta länken är Googles (enda) crawlbara väg från sajtens
                starkaste sida in i /evenemang-hierarkin (stad → kategori).
                Utan den nås stadssidorna bara via sitemapen = noll intern
                länkkraft. Ligger som OVERLAY rakt ÖVER kartans attributions-"i"
                i högra hörnet (användarbeslut 2026-07-09: täck i:et) — solid
                bakgrund + z-index över kartkontrollerna. */}
            <h1 className="sr-only">Hitta evenemang och saker att göra nära dig — hela Sverige på en karta</h1>
            {/* Blå pill i hörnet — större/tydligare CTA (användaren ville synas
                mer) med ett glest ljussvep (.city-cta, se globals.css). Lika hög
                som dagväljar-chippen (h-10, ägarbeslut 2026-07-12 — sajtens enda
                stad-för-stad-länk, en navbar-dubblett provades och togs bort).
                Täcker fortfarande attributions-i:et: den är nu större än förut,
                så spannet från hörnet växer bara → i:et förblir dolt. */}
            <a
                href="/evenemang"
                className="city-cta absolute bottom-2 right-2 z-[40] overflow-hidden rounded-full bg-[#006AA7] px-4 h-10 flex items-center text-xs font-black text-white shadow-lg hover:bg-[#005590] hover:shadow-xl transition-colors"
            >
                Evenemang stad för stad
            </a>

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
                onOpenProfile={handleToggleProfile}
                savedCount={activeSavedCount}
                onToggleSaved={handleToggleSaved}
                dayOffset={dayOffset}
                dayRangeDays={dayRangeDays}
                onDayRangeChange={handleDayRangeChange}
                weekUnlocked={weekUnlocked}
                dayCount={dayTotalCount}
                eventsLoaded={eventsLoaded}
                dayCountReady={dayCountReady}
            />

            {/* 1b. Kategorichips under navbaren — filtrerar kartan + kortleken.
                Kategoriantal räknas ur de sökfiltrerade eventen så de matchar kartan. */}
            <CategoryFilter
                events={searchFilteredEvents}
                selected={selectedCategories}
                onToggle={handleToggleCategory}
                onClear={handleClearCategories}
            />

            {/* 1b2. Senaste kommentaren på sajten — bubbla under navbaren.
                Klick hoppar till kommentarens event (samma väg som sök/sparat). */}
            <LatestCommentBubble events={events} onPick={jumpToEvent} />

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

            {/* 1e. Profilen — allt konto-relaterat utan att lämna kartan */}
            <ProfilePanel
                open={profilePanelOpen}
                onClose={() => setProfilePanelOpen(false)}
                myEvents={myEvents}
                onPickEvent={jumpToEvent}
                onDeleteEvent={handleDeleteOwnEvent}
                savedCount={activeSavedCount}
                onOpenSaved={() => { setProfilePanelOpen(false); setSavedPanelOpen(true); }}
            />

            {/* 2. Fullskärmskarta underst */}
            <V2MapDynamic
                events={visibleEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={selectEventSmooth}
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
                cardExpanded={cardExpanded}
                onCenterChange={handleMapCenterChange}
                eventsLoaded={eventsLoaded}
                eventsSettled={eventsSettled}
                // Första prick-rundan målad → släpp cards/descriptions-hämtningen
                // (de ska inte konkurrera med tiles + prickar om bandbredden).
                onFirstPaint={linkEventService.releaseHeavyLayers}
                zoomToEventTrigger={zoomToEventTrigger}
                zoomOutTrigger={zoomOutTrigger}
                daySwitchNonce={daySwitchNonce}
                navSelectNonce={navSelectNonce}
                onFeatureFlagsChange={handleFeatureFlagsChange}
                onActivateMultiplayer={handleActivateMultiplayer}
                onFuncBagOpenChange={setFuncBagOpen}
                onUserPosChange={setUserPos}
                starredEventIds={starredEventIds}
                wishes={wishes}
                onSelectWish={handleSelectWish}
            />



            {/* Modal för att skapa ELLER önska event — skriver till Firestore
                (kräver konto). Göms under "Ändra plats"-varvet (repicking) så
                kartan går att panorera; formulär-staten lever kvar. */}
            {creationMode === 'editing' && pickedLocation && !repicking && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-event-title"
                        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
                    >
                        <h2 id="create-event-title" className="text-xl font-bold text-slate-800">
                            {fulfillingWish ? 'Skapa eventet av önskan' : createKind === 'wish' ? 'Önska event' : 'Skapa event'}
                        </h2>
                        {/* Läge: skapa på riktigt eller önska. Gömd när modalen öppnats
                            från en önskan ("Skapa det här eventet") — då skapar man. */}
                        {!fulfillingWish && (
                            <div className="flex rounded-full bg-slate-100 p-1 text-sm font-bold" role="tablist" aria-label="Skapa eller önska">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={createKind === 'event'}
                                    onClick={() => setCreateKind('event')}
                                    className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${createKind === 'event' ? 'bg-green-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Skapa event
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={createKind === 'wish'}
                                    onClick={() => setCreateKind('wish')}
                                    className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${createKind === 'wish' ? 'bg-violet-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    ✨ Önska event
                                </button>
                            </div>
                        )}
                        {createKind === 'wish' && (
                            <p className="text-xs text-slate-500">
                                Önska något du vill skulle hända här — kanske skapar någon det!
                                Önskan syns på kartan i {WISH_LIFETIME_DAYS} dagar eller tills eventet blir av.
                            </p>
                        )}
                        {/* Skapa-läget: arrangerar du själv, eller TIPSAR du om ett
                            event som redan finns? Tips kräver en länk till källan
                            och visas som ett vanligt länk-event — tipsaren står
                            aldrig som arrangör eller värd. */}
                        {createKind === 'event' && (
                            <div className="flex flex-col gap-2">
                                <div className="flex rounded-full bg-slate-100 p-1 text-xs font-bold" role="radiogroup" aria-label="Arrangerar du eller tipsar du?">
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={newEventRole === 'host'}
                                        onClick={() => setNewEventRole('host')}
                                        className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${newEventRole === 'host' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        Jag arrangerar
                                    </button>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={newEventRole === 'tip'}
                                        onClick={() => setNewEventRole('tip')}
                                        className={`flex-1 px-3 py-1.5 rounded-full transition-colors ${newEventRole === 'tip' ? 'bg-white text-slate-800 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        💡 Jag tipsar bara
                                    </button>
                                </div>
                                {newEventRole === 'tip' && (
                                    <p className="text-xs text-slate-500">
                                        Tipsa om ett event som redan finns — du står inte som
                                        arrangör. Eventet visas som ett vanligt event med din
                                        länk som källa, och anmälan sker där.
                                    </p>
                                )}
                            </div>
                        )}
                        {fulfillingWish && (
                            <p className="text-xs font-semibold text-violet-700 bg-violet-50 rounded-lg px-3 py-2">
                                ✨ Förifyllt från {fulfillingWish.hostName}s önskan — justera fritt, även platsen.
                            </p>
                        )}
                        {/* Platsen är redan vald (kartans mitt/önskans plats) — koordinaterna
                            visas inte; vill man flytta gör man ett nytt placerings-varv. */}
                        <button
                            type="button"
                            onClick={() => setRepicking(true)}
                            className="self-start text-xs font-bold text-[#006AA7] hover:underline"
                        >
                            📍 Ändra plats på kartan
                        </button>
                        <input
                            type="text"
                            value={newEventTitle}
                            onChange={e => setNewEventTitle(e.target.value)}
                            placeholder={createKind === 'wish' ? 'Vad önskar du hände här?' : 'Namn på event'}
                            aria-label={createKind === 'wish' ? 'Vad önskar du hände här?' : 'Namn på event'}
                            autoFocus
                            maxLength={120}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                        />
                        {/* Tips: länken till källan (obligatorisk — det är den som gör
                            eventet till ett vanligt länk-event) + arrangörens namn
                            (valfritt; annars visas länkens domän som värd). */}
                        {createKind === 'event' && newEventRole === 'tip' && (
                            <>
                                <input
                                    type="url"
                                    value={newEventUrl}
                                    onChange={e => setNewEventUrl(e.target.value)}
                                    placeholder="Länk till eventet — t.ex. arrangörens sida"
                                    aria-label="Länk till eventet"
                                    inputMode="url"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    maxLength={500}
                                    className={`w-full px-4 py-3 rounded-xl border bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none ${
                                        newEventUrl.trim() && !normalizeTipUrl(newEventUrl)
                                            ? 'border-amber-400 focus:border-amber-500'
                                            : 'border-slate-200 focus:border-green-500'
                                    }`}
                                />
                                <input
                                    type="text"
                                    value={newEventHost}
                                    onChange={e => setNewEventHost(e.target.value)}
                                    placeholder="Arrangör — t.ex. Borås Stad (valfritt)"
                                    aria-label="Arrangör (valfritt)"
                                    maxLength={80}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                                />
                            </>
                        )}
                        {/* En önskan har ingen tid — bara skapa-läget frågar När. */}
                        {createKind === 'event' && (
                            <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
                                När?
                                <input
                                    type="datetime-local"
                                    value={newEventTime}
                                    onChange={e => setNewEventTime(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-normal text-base focus:border-green-500 focus:outline-none"
                                />
                            </label>
                        )}
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
                        {createKind === 'event' && (
                            <input
                                type="text"
                                value={newEventPlace}
                                onChange={e => setNewEventPlace(e.target.value)}
                                placeholder="Plats — t.ex. Vasaparken (valfritt)"
                                aria-label="Plats (valfritt)"
                                maxLength={120}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                            />
                        )}
                        <textarea
                            value={newEventDescription}
                            onChange={e => setNewEventDescription(e.target.value)}
                            placeholder={createKind === 'wish' ? 'Beskriv önskan — vad borde hända? (valfritt)' : 'Beskrivning — vad händer? (valfritt)'}
                            aria-label="Beskrivning (valfritt)"
                            maxLength={1000}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none resize-none"
                        />
                        {/* Bild på eventet (valfritt) — laddas upp till Storage vid Skapa.
                            En önskan har ingen bild. */}
                        {createKind === 'event' && (
                        <div>
                            <input
                                id="new-event-image"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    if (!file) return;
                                    if (!file.type.startsWith('image/')) { toast.error('Välj en bildfil.'); return; }
                                    setNewEventImage(file);
                                    setNewEventImagePreview(URL.createObjectURL(file));
                                }}
                            />
                            {newEventImagePreview ? (
                                <div className="relative">
                                    <img src={newEventImagePreview} alt="Förhandsvisning" className="w-full h-36 object-cover rounded-xl border border-slate-200" />
                                    <button
                                        type="button"
                                        onClick={() => { setNewEventImage(null); setNewEventImagePreview(''); }}
                                        aria-label="Ta bort bild"
                                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor="new-event-image"
                                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm font-semibold cursor-pointer hover:border-green-500 hover:text-green-600 transition-colors"
                                >
                                    <ImagePlus size={18} /> Lägg till bild (valfritt)
                                </label>
                            )}
                        </div>
                        )}
                        {!user && (
                            <p className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                                {createKind === 'wish'
                                    ? 'Du behöver logga in för att önska — det fixar vi i nästa steg.'
                                    : newEventRole === 'tip'
                                    ? 'Du behöver logga in för att tipsa — det fixar vi i nästa steg.'
                                    : 'Du behöver logga in för att skapa eventet — det fixar vi i nästa steg.'}
                            </p>
                        )}
                        <div className="flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={resetCreateFlow}
                                className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 transition-colors font-semibold"
                            >
                                Avbryt
                            </button>
                            <button
                                type="button"
                                disabled={!newEventTitle.trim()
                                    || (createKind === 'event' && !newEventTime)
                                    || (createKind === 'event' && newEventRole === 'tip' && !normalizeTipUrl(newEventUrl))
                                    || creatingEvent}
                                onClick={createKind === 'wish' ? handleCreateWish : handleCreateEvent}
                                className={`px-5 py-2 rounded-full text-white font-bold disabled:opacity-40 transition-colors ${createKind === 'wish' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-green-600 hover:bg-green-500'}`}
                            >
                                {creatingEvent
                                    ? (createKind === 'wish' ? 'Önskar…' : 'Skapar…')
                                    : user
                                    ? (createKind === 'wish' ? 'Önska ✨' : createKind === 'event' && newEventRole === 'tip' ? 'Tipsa 💡' : 'Skapa')
                                    : (createKind === 'wish' ? 'Logga in & önska' : createKind === 'event' && newEventRole === 'tip' ? 'Logga in & tipsa' : 'Logga in & skapa')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* "Ändra plats"-varvet: modalen gömd, kartan fri att panorera.
                Center-pinnen visar var platsen hamnar (kartans mitt) och pillen
                bekräftar/avbryter. Formuläret väntar orört under tiden. */}
            {creationMode === 'editing' && repicking && (
                <>
                    <div aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 z-[1190] -translate-x-1/2 -translate-y-[85%] text-4xl drop-shadow-lg">📍</div>
                    <div className="fixed inset-x-0 bottom-24 z-[1190] flex justify-center px-4 pointer-events-none">
                        <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-md shadow-xl border border-white/50 pl-4 pr-2 py-2">
                            <span className="text-sm font-semibold text-slate-700">Panorera kartan till rätt plats</span>
                            <button
                                type="button"
                                onClick={() => { if (mapCenterRef.current) setPickedLocation(mapCenterRef.current); setRepicking(false); }}
                                className="px-4 py-1.5 rounded-full bg-green-600 text-white text-sm font-bold hover:bg-green-500 transition-colors"
                            >
                                Välj här
                            </button>
                            <button
                                type="button"
                                onClick={() => setRepicking(false)}
                                className="px-3 py-1.5 rounded-full text-slate-500 text-sm font-semibold hover:bg-slate-100 transition-colors"
                            >
                                Avbryt
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Önske-kortet: klick på en önske-bricka på kartan. Litet kort med
                titel/kategori/önskare + "Skapa det här eventet" (förifyller
                skapa-modalen och kvitterar önskan när eventet skapats). */}
            {selectedWish && (
                <div className="fixed inset-x-0 bottom-24 z-[1150] flex justify-center px-4 pointer-events-none">
                    <div className="pointer-events-auto w-full max-w-sm rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-violet-200 p-4 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black px-2 py-0.5">✨ Önskemål</span>
                            <button
                                type="button"
                                onClick={() => setSelectedWish(null)}
                                aria-label="Stäng"
                                className="w-7 h-7 -mt-1 -mr-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
                            >
                                <X size={15} />
                            </button>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 leading-snug">{selectedWish.title}</h3>
                        <p className="text-xs text-slate-500">
                            {(EVENT_CATEGORIES[selectedWish.category] ?? EVENT_CATEGORIES.other).emoji}{' '}
                            {(EVENT_CATEGORIES[selectedWish.category] ?? EVENT_CATEGORIES.other).label}
                            {' · '}Önskat av {selectedWish.hostName}
                        </p>
                        {selectedWish.description && (
                            <p className="text-sm text-slate-600 whitespace-pre-line">{selectedWish.description}</p>
                        )}
                        <button
                            type="button"
                            onClick={() => startFulfillWish(selectedWish)}
                            className="mt-1 w-full px-4 py-2.5 rounded-full bg-violet-600 text-white font-bold hover:bg-violet-500 transition-colors"
                        >
                            Skapa det här eventet
                        </button>
                        {user?.uid === selectedWish.uid && (
                            <button
                                type="button"
                                onClick={() => handleDeleteWish(selectedWish.id)}
                                className="self-center text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors"
                            >
                                Ta bort min önskan
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Inloggning/registrering — utan att lämna kartan */}
            <AuthModal
                open={authModal.open}
                reason={authModal.reason}
                onClose={() => setAuthModal({ open: false })}
            />

            {/* Onboarding — bara för utloggade. Vänta in authLoading: under
                Firebase-sessionsrestoren är user null även för inloggade, och
                utan väntan skulle overlayn blinka fram för dem (t.ex. via
                delade eventlänkar som /evenemang/malmö).
                (PWA-installbannern monteras globalt i Providers, inte här.) */}
            {!authLoading && !user && (
                <WelcomeOverlay
                    onCreateAccount={() => openLogin('Skapa ett gratis konto — spara event och skapa egna')}
                    todayEventCount={todayEventCount}
                    soonEventCount={soonEventCount}
                />
            )}

            {/* 3. Dra-och-släpp (Tinder-style) kort längst ner */}
            <EventCard
                events={visibleEvents}
                dayCount={dayEventCount}
                eventsLoaded={eventsLoaded}
                eventsSettled={eventsSettled}
                selectedEvent={selectedEvent}
                onSelectEvent={selectEventSmooth}
                onSaveEvent={handleSaveEvent}
                onDiscardEvent={handleDiscardEvent}
                discardedEventIds={discardedEventIds}
                savedEventIds={savedEventIds}
                userPos={userPos}
                onUnsaveEvent={handleUnsaveEvent}
                onCardExpandedChange={setCardExpanded}
                onNavigate={() => setNavSelectNonce(n => n + 1)}
                onZoomToSelected={() => setZoomToEventTrigger(t => t + 1)}
                onZoomOut={() => setZoomOutTrigger(t => t + 1)}
                dayOffset={dayOffset}
                dayRangeDays={dayRangeDays}
                onDayRangeChange={handleDayRangeChange}
                onRequireLogin={() => openLogin('Logga in för att chatta')}
                currentUserUid={user?.uid}
                onDeleteOwnEvent={handleDeleteOwnEvent}
                onBoostOwnEvent={handleBoostOwnEvent}
                starredEventIds={starredEventIds}
                canPlaceStar={starGiftStatus === 'unused'}
                onPlaceStar={handlePlaceStar}
            />

        </main>
    );
}
