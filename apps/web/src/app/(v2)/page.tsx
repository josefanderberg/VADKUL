'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LinkEvent } from '@/types';
import { linkEventService } from '@/services/linkEventService';
import { startEventBoostCheckout } from '@/services/boostService';
import FloatingNavbar from '@/components/v2/FloatingNavbar';
import CategoryFilter from '@/components/v2/CategoryFilter';
import AuthModal from '@/components/v2/AuthModal';
import EventCard from '@/components/v2/EventCard';
import SearchResults from '@/components/v2/SearchResults';
import SavedPanel from '@/components/v2/SavedPanel';
import ProfilePanel from '@/components/v2/ProfilePanel';
import WelcomeOverlay from '@/components/v2/WelcomeOverlay';
import { userService } from '@/services/userService';
import { storageService } from '@/services/storageService';
import { X, ImagePlus } from 'lucide-react';
import { EVENT_CATEGORIES, EventCategoryType, SPECIAL_CATEGORY_KEYS } from '@/utils/categories';
import { classifySource } from '@/utils/sources';
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
    const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('');           // datetime-local-sträng
    const [newEventCategory, setNewEventCategory] = useState<EventCategoryType>('other');
    const [newEventPlace, setNewEventPlace] = useState('');         // platsnamn, valfritt
    const [newEventDescription, setNewEventDescription] = useState(''); // valfri
    const [newEventImage, setNewEventImage] = useState<File | null>(null);
    const [newEventImagePreview, setNewEventImagePreview] = useState('');
    const [creatingEvent, setCreatingEvent] = useState(false);

    // Escape stänger skapa event-modalen (samma städning som Avbryt-knappen) —
    // standardbeteende för dialoger, viktigt för tangentbordsanvändare.
    useEffect(() => {
        if (creationMode !== 'editing') return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setCreationMode('idle');
            setPickedLocation(null);
            setNewEventTitle('');
            setNewEventTime('');
            setNewEventPlace('');
            setNewEventDescription('');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [creationMode]);

    // Inloggning i modal — man lämnar aldrig kartan. reason visas i modalen.
    const { user } = useAuth();
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

    // Filtrera events för vald dag ELLER valt intervall (t.ex. helgen = fre–sön).
    // useMemo (inte state-i-effekt) → listan är ALLTID i synk med events inom
    // samma render. Annars fanns ett mellanläge där eventsLoaded blivit true men
    // dagens lista ännu var tom → "Inga event" hann blinka förbi innan datan
    // filtrerats klart.
    const filteredEvents = useMemo(() => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setDate(endOfDay.getDate() + (dayRangeDays - 1));
        endOfDay.setHours(23, 59, 59, 999);

        return events.filter(evt => evt.time >= startOfDay && evt.time <= endOfDay);
    }, [events, dayOffset, dayRangeDays]);

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
        if (!user) { openLogin('Logga in för att skapa event'); return; }
        setCreatingEvent(true);
        try {
            const time = new Date(newEventTime);
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
                hostName: user.displayName || user.email || 'VADKUL-användare',
                hostUid: user.uid,
                coverImage,
            });
            const created: LinkEvent = {
                id: docId, url: '', title: newEventTitle.trim(), time, createdAt: new Date(),
                locationName: newEventPlace.trim(), lat: pickedLocation.lat, lng: pickedLocation.lng,
                hostName: user.displayName || user.email || 'VADKUL-användare',
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
            toast.success('Eventet är skapat och syns på kartan! 🎉');
            setCreationMode('idle');
            setPickedLocation(null);
            setNewEventTitle('');
            setNewEventTime('');
            setNewEventCategory('other');
            setNewEventPlace('');
            setNewEventDescription('');
            setNewEventImage(null);
            setNewEventImagePreview('');
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte skapa eventet. Försök igen.');
        } finally {
            setCreatingEvent(false);
        }
    }, [pickedLocation, newEventTitle, newEventTime, newEventCategory, newEventPlace, newEventDescription, newEventImage, user, openLogin]);

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

    // Aktivt sparade = sparade event som ÄNNU INTE passerat (samma 1 h-gräns som
    // SavedPanel). Passerade sparade räknas som HISTORIK och ska inte blåsa upp
    // hjärt-badgen / "Sparade event"-räknaren — de ligger under Historik i panelen.
    const activeSavedCount = useMemo(() => {
        const cutoff = Date.now() - 60 * 60 * 1000;
        let n = 0;
        for (const e of events) {
            if (savedEventIds.has(e.id) && e.time.getTime() >= cutoff) n++;
        }
        return n;
    }, [events, savedEventIds]);

    // Kategorier användaren visat intresse för = kategorierna på de event man
    // sparat (över alla dagar, därför hela `events` och inte bara dagens vy).
    // Driver EventCards "Tips för dig". Tom tills man gillat sitt första event.
    const interestedCategories = useMemo(() => {
        const cats = new Set<EventCategoryType>();
        for (const e of events) {
            if (savedEventIds.has(e.id) && e.category) cats.add(e.category);
        }
        return cats;
    }, [events, savedEventIds]);

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
        setProfilePanelOpen(false);
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
            const valid = kategori.split(',').filter(k => k in EVENT_CATEGORIES || SPECIAL_CATEGORY_KEYS.has(k));
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
            {/* Mått valda för att HELT täcka attributions-i:et (24px-knapp med
                10px marginal = spannet 10–34px från hörnet): bottom/right 8px +
                py-1.5 ger ~8–34px — inget av i:et sticker fram. */}
            <a
                href="/evenemang"
                className="absolute bottom-2 right-2 z-[40] rounded-full bg-white px-3 py-1.5 text-[10px] font-medium text-slate-600 shadow-md hover:text-slate-900 hover:shadow-lg"
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
                onSelectEvent={setSelectedEvent}
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
                cardExpanded={cardExpanded}
                onCenterChange={handleMapCenterChange}
                eventsLoaded={eventsLoaded}
                eventsSettled={eventsSettled}
                zoomToEventTrigger={zoomToEventTrigger}
                zoomOutTrigger={zoomOutTrigger}
                daySwitchNonce={daySwitchNonce}
                navSelectNonce={navSelectNonce}
                onFeatureFlagsChange={handleFeatureFlagsChange}
                onActivateMultiplayer={handleActivateMultiplayer}
                onFuncBagOpenChange={setFuncBagOpen}
            />



            {/* Modal för att skapa event — skriver till Firestore (kräver konto). */}
            {creationMode === 'editing' && pickedLocation && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-event-title"
                        className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4"
                    >
                        <h2 id="create-event-title" className="text-xl font-bold text-slate-800">Skapa event</h2>
                        <p className="text-xs text-slate-500 tabular-nums">
                            📍 {pickedLocation.lat.toFixed(5)}, {pickedLocation.lng.toFixed(5)}
                        </p>
                        <input
                            type="text"
                            value={newEventTitle}
                            onChange={e => setNewEventTitle(e.target.value)}
                            placeholder="Namn på event"
                            aria-label="Namn på event"
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
                        <input
                            type="text"
                            value={newEventPlace}
                            onChange={e => setNewEventPlace(e.target.value)}
                            placeholder="Plats — t.ex. Vasaparken (valfritt)"
                            aria-label="Plats (valfritt)"
                            maxLength={120}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none"
                        />
                        <textarea
                            value={newEventDescription}
                            onChange={e => setNewEventDescription(e.target.value)}
                            placeholder="Beskrivning — vad händer? (valfritt)"
                            aria-label="Beskrivning (valfritt)"
                            maxLength={1000}
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-green-500 focus:outline-none resize-none"
                        />
                        {/* Bild på eventet (valfritt) — laddas upp till Storage vid Skapa. */}
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
                                    setNewEventPlace('');
                                    setNewEventDescription('');
                                    setNewEventImage(null);
                                    setNewEventImagePreview('');
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

            {/* Onboarding vid första besöket — en skärm, sen ut på kartan.
                (PWA-installbannern monteras globalt i Providers, inte här.) */}
            <WelcomeOverlay
                onCreateAccount={() => openLogin('Skapa ett gratis konto — spara event och skapa egna')}
                todayEventCount={todayEventCount}
                soonEventCount={soonEventCount}
            />

            {/* 3. Dra-och-släpp (Tinder-style) kort längst ner */}
            <EventCard
                events={visibleEvents}
                dayCount={dayEventCount}
                eventsLoaded={eventsLoaded}
                eventsSettled={eventsSettled}
                selectedEvent={selectedEvent}
                onSelectEvent={setSelectedEvent}
                onSaveEvent={handleSaveEvent}
                onDiscardEvent={handleDiscardEvent}
                discardedEventIds={discardedEventIds}
                savedEventIds={savedEventIds}
                interestedCategories={interestedCategories}
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
            />

        </main>
    );
}
