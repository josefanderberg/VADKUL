'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { EventWish, LinkEvent } from '@/types';
import { linkEventService } from '@/services/linkEventService';
import { wishService, WISH_LIFETIME_DAYS } from '@/services/wishService';
import { startEventBoostCheckout, confirmEventBoost, type BoostTier } from '@/services/boostService';
import FloatingNavbar, { getDayLabel } from '@/components/v2/FloatingNavbar';
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
import { X, ImagePlus, Building2, Info, ChevronLeft, ChevronRight, CalendarDays, ArrowLeftRight, ZoomIn, Lock } from 'lucide-react';
import { EVENT_CATEGORIES, EventCategoryType, SPECIAL_CATEGORY_KEYS } from '@/utils/categories';
import { classifySource } from '@/utils/sources';
import { familyIsOptIn } from '@/utils/familyFilter';
import { defaultSpecialCategories, specialDefaultsKey } from '@/utils/categoryDefaults';
import { searchCities, CITY_POINTS, type CityPoint } from '@/utils/cityPoints';
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

// Städer som visas i stads-bildspelet vid start (samma lista som cityData,
// men bara klient-säkra värden — inga fs/promises). Zoomen är anpassad för
// att ge en bra cityvy: zoom 11 ≈ en innerstad på desktop.
// Ordningen här spelar ingen roll — TOUR_CITIES nedan lägger om dem till en
// resrutta där varje hopp går till den närmaste ostädade staden.
const TOUR_CITY_POINTS: { name: string; lat: number; lng: number }[] = [
    { name: 'Stockholm', lat: 59.33, lng: 18.06 },
    { name: 'Göteborg', lat: 57.71, lng: 11.97 },
    { name: 'Malmö', lat: 55.60, lng: 13.00 },
    { name: 'Uppsala', lat: 59.86, lng: 17.64 },
    { name: 'Linköping', lat: 58.41, lng: 15.62 },
    { name: 'Örebro', lat: 59.27, lng: 15.21 },
    { name: 'Västerås', lat: 59.61, lng: 16.55 },
    { name: 'Helsingborg', lat: 56.05, lng: 12.69 },
    { name: 'Norrköping', lat: 58.59, lng: 16.19 },
    { name: 'Jönköping', lat: 57.78, lng: 14.16 },
    { name: 'Umeå', lat: 63.83, lng: 20.26 },
    { name: 'Lund', lat: 55.70, lng: 13.19 },
    { name: 'Borås', lat: 57.72, lng: 12.94 },
    { name: 'Sundsvall', lat: 62.39, lng: 17.31 },
    { name: 'Gävle', lat: 60.67, lng: 17.14 },
    { name: 'Halmstad', lat: 56.67, lng: 12.86 },
    { name: 'Växjö', lat: 56.88, lng: 14.81 },
    { name: 'Karlstad', lat: 59.40, lng: 13.51 },
    { name: 'Luleå', lat: 65.58, lng: 22.15 },
    { name: 'Kalmar', lat: 56.66, lng: 16.36 },
    { name: 'Östersund', lat: 63.18, lng: 14.64 },
    { name: 'Visby', lat: 57.64, lng: 18.30 },
];
/**
 * Lägger städerna i en RUNDRESA i stället för listordning, så bildspelet rör
 * sig granne för granne genom landet i stället för att kasta sig
 * Stockholm → Göteborg → Malmö → Uppsala. Två vinster: man tappar inte
 * orienteringen, och korta hopp betyder att kart-tiles och event runt nästa
 * stad i stort sett redan är hämtade — den tonar in snabbare.
 *
 * Girig närmaste-granne + 2-opt (byter ut två korsande sträckor mot de raka).
 * Bara greedy lämnar en efterbliven stad kvar på slutet med ett tokhopp över
 * halva landet; 2-opt får bort det. 22 städer → körs en gång vid modulladdning,
 * försumbart. Sista staden vänder tillbaka till den första — rutten är en loop.
 */
const orderCitiesByProximity = (cities: { name: string; lat: number; lng: number }[]) => {
    // Platt approximation — bra nog på Sverige-skala och vi ska bara jämföra.
    const dist = (a: typeof cities[0], b: typeof cities[0]) => {
        const dy = a.lat - b.lat;
        const dx = (a.lng - b.lng) * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
        return Math.hypot(dy, dx);
    };
    const remaining = cities.slice(1);
    const route = [cities[0]];
    while (remaining.length) {
        const from = route[route.length - 1];
        let best = 0;
        let bestDist = Infinity;
        remaining.forEach((c, i) => {
            const d = dist(from, c);
            if (d < bestDist) { bestDist = d; best = i; }
        });
        route.push(remaining.splice(best, 1)[0]);
    }
    const n = route.length;
    for (let pass = 0, improved = true; improved && pass < 20; pass++) {
        improved = false;
        for (let i = 1; i < n - 1; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = route[i - 1], b = route[i], x = route[j], y = route[(j + 1) % n];
                if (dist(a, b) + dist(x, y) > dist(a, x) + dist(b, y) + 1e-9) {
                    route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
    }
    // Loopen kan köras åt båda hållen. Välj hållet där de första hoppen är
    // kortast — då börjar rundan i den täta delen av landet (där det också
    // finns mest event) och sparar de långa norrlandssträckorna till senare.
    const headLength = (r: typeof route) =>
        r.slice(0, Math.ceil(n / 3)).reduce((sum, c, i) => (i ? sum + dist(r[i - 1], c) : 0), 0);
    const reversed = [route[0], ...route.slice(1).reverse()];
    return headLength(reversed) < headLength(route) ? reversed : route;
};
const TOUR_CITIES = orderCitiesByProximity(TOUR_CITY_POINTS);

/**
 * Vilken stad i rutten ligger närmast en punkt? Används när bildspelet startas
 * om från användarens egen position: vi visar trakten man faktiskt är i, och
 * låter sedan rundan fortsätta från grannstaden i stället för att kasta sig
 * tillbaka till den stad rutten råkade stå på när man stoppade.
 */
const nearestTourCityIndex = (lat: number, lng: number) => {
    let best = 0;
    let bestDist = Infinity;
    TOUR_CITIES.forEach((c, i) => {
        const dy = c.lat - lat;
        const dx = (c.lng - lng) * Math.cos((((c.lat + lat) / 2) * Math.PI) / 180);
        const d = Math.hypot(dy, dx);
        if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
};

/**
 * Närmsta ORT ur den stora söklistan (CITY_POINTS, ~290 orter — samma lista
 * som stadssökets navigationer). Stadsrutan högst upp visar den här ortens
 * namn och FÖLJER KARTAN när man drar (Josef 10/8) — bor man i Hudiksvall ska
 * rutan säga Hudiksvall, inte närmsta storstad ur bildspelsrundan. Samma
 * uppslag används när skylt-knappen fäster kameran vid närmsta stad.
 */
const nearestCityPoint = (lat: number, lng: number): CityPoint => {
    let best = CITY_POINTS[0];
    let bestDist = Infinity;
    for (const c of CITY_POINTS) {
        const dy = c.lat - lat;
        const dx = (c.lng - lng) * Math.cos((((c.lat + lat) / 2) * Math.PI) / 180);
        const d = Math.hypot(dy, dx);
        if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
};

// Under den här zoomnivån är "en stad" fel abstraktion — vyn täcker halva
// landskap och mer. Stadsrutan skriver då "Sverige" i stället för att låtsas
// att man tittar på orten som råkar ligga närmast mitten.
const CITY_NAME_MIN_ZOOM = 8;
// ...och ligger närmsta ort längre bort än så här från kartmitten (inzoomad i
// ödemark) är ortsnamnet också en lögn — "Sverige" där med.
const CITY_NAME_MAX_KM = 60;

// Zoomnivå bildspelet landar på. Lagom utzoomat: hela staden PLUS en bit
// omland, så man ser att det finns något runtomkring också. Måste ligga över
// WEEK_VIEW_MIN_ZOOM (9) — annars slår zoom-vakten av veckoläget direkt och
// blinket blir en no-op.
const TOUR_ZOOM = 10;
// Landningspulsen (se effekten i komponenten): hur länge efter landningen
// veckan visas, och hur länge den står kvar innan vi går tillbaka till dagen.
// Fördröjningen ska räcka för att kameran ska ha landat och stadsöverlägget
// tonat bort — annars pulsar den bakom en heltäckande fade. Hålltiden ska
// räcka för att hinna se att kartan fylls på, men inte kännas som ett läge man
// fastnat i.
const TOUR_PULSE_DELAY_MS = 1400;
const TOUR_PULSE_HOLD_MS = 2200;
// Under den här zoomnivån döljs vägskyltarna. Utzoomat ligger grannstäderna
// redan i vyn — skyltarna skulle bara peka på det man ser, och en 150 px platta
// täcker då ett halvt landskap.
// Hur länge vi väntar in platstjänsten innan bildspelet startar. Får svar
// komma → rundan börjar i staden man är NÄRMAST; inget svar (nekad/långsam) →
// vi faller tillbaka på rundans första stad så sidan inte står och hänger.
const TOUR_GPS_WAIT_MS = 2500;
// (TOUR_CLICK_GRACE_MS är borttagen 9/8 — ett klick ur bildspelet räknar inte
// längre om dag/vecka-valet, vyn fryser på den fas som visas.)

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

// Lokal dag → "YYYY-MM-DD" för date-fältet (toISOString hade gett UTC-dygnet,
// fel efter midnatt svensk tid).
const toInputDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

/**
 * Fel vid event-skapande → begriplig svenska.
 *
 * Två krav drar åt olika håll. Tipsaren måste förstå VAD som gick fel — den
 * gamla enda texten ("Kunde inte skapa eventet") gjorde att folk gav upp och
 * aldrig hörde av sig, så vi upptäckte inte att tips utan konto var trasigt.
 * Samtidigt får varken toasten eller konsollen avslöja hur backend är riggad.
 * Därför: fasta texter härifrån, aldrig serverns egna meddelanden.
 */
const createEventErrorText = (code: string): string => {
    // Anonym session nekad → tips utan konto är avstängt i Auth. Bara en
    // tipsare UTAN konto kan träffa den här; inloggade går aldrig den vägen.
    if (code.includes('admin-restricted-operation') || code.includes('operation-not-allowed'))
        return 'Just nu går det inte att tipsa utan konto. Logga in — eller mejla tipset till hej@vadkul.se så lägger vi in det åt dig.';
    if (code.includes('network-request-failed') || code.includes('unavailable') || code.includes('deadline-exceeded'))
        return 'Ingen kontakt med servern — kolla uppkopplingen och försök igen.';
    if (code.includes('permission-denied') || code.includes('unauthenticated'))
        return 'Eventet nekades. Kolla att titel, tid och plats är ifyllda — hjälper det inte, mejla hej@vadkul.se.';
    if (code.includes('resource-exhausted') || code.includes('too-many-requests'))
        return 'För många försök just nu — vänta en minut och försök igen.';
    return 'Kunde inte skapa eventet. Försök igen.';
};

/**
 * Plocka ut felkoden — och BARA koden. Ett Firebase-fel bär med sig
 * serverns meddelande, ibland hela payloaden och stacken; åker det rakt ut i
 * webbläsarkonsollen blir supportspåret en läcka. Koden tvättas mot en
 * teckenmask så att ett oväntat fel inte kan skriva fritext till konsollen.
 */
const createEventErrorCode = (err: unknown): string => {
    const raw = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    return /^[a-z][a-z0-9/_-]{2,48}$/i.test(raw) ? raw : 'okänt';
};

const pickNearestToPoint =(point: { lat: number; lng: number } | null, dayEvents: LinkEvent[]): LinkEvent | null => {
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
/** Hur länge actionrutan är på väg upp mot plusset. Delas med CSS-animationen
 *  .action-intro-out (globals.css) — håll dem i synk från ETT ställe. */
const ACTION_INTRO_FLY_MS = 420;
/** Paus mellan att välkomstrutan stängs och att actionrutan glider upp. Ska
 *  räcka för att stadshoppet ska hinna landa — man ska ha SETT var man hamnade
 *  innan nästa ruta kommer (Josef 14/8). */
const ACTION_INTRO_DELAY_MS = 2000;
/** Hur länge plusset blinkar efter hem-flygningen. Måste matcha antalet varv i
 *  .plus-hint-pulse (globals.css): 3 × 1,1 s. */
const PLUS_HINT_MS = 3400;
/**
 * "Varje torsdag kl 19:00" — veckodagen och tiden en serie skulle ärva från
 * det valda datumet. Tar datetime-local-strängen rakt av (den är redan lokal
 * tid); ogiltig sträng ger tom text så etiketten aldrig visar "Invalid Date".
 */
const weeklyLabelFor = (datetimeLocal: string): string => {
    const d = new Date(datetimeLocal);
    if (isNaN(d.getTime())) return '';
    const weekday = d.toLocaleDateString('sv-SE', { weekday: 'long' });
    const time = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    return `Varje ${weekday} kl ${time}`;
};
// Radie för "i närheten" i tom-läget: hur långt bort ett event får ligga och
// ändå räknas som att det händer något där man tittar. 2,5 mil ≈ en småstad
// med kringliggande byar (Hudiksvall + Forsa/Hög/Iggesund). Används numera BARA
// som golv i tom-läget — själva frågan ställs mot kartans faktiska vy, se
// eventInView nedan.
const NEARBY_EMPTY_KM = 25;
// Radie kring en SÖKT stads centrum när träfflistan räknar "X event den
// närmaste veckan". Samma 2,5 mil som tom-lägets närhetsgolv — orten plus dess
// byar (Hudiksvall + Forsa/Hög/Iggesund). Siffran är alltså en CIRKEL kring
// centrum, medan stadsrutan man möts av efter hoppet räknar kartans rektangel:
// de landar nära varandra men behöver inte bli exakt lika.
const CITY_SEARCH_RADIUS_KM = NEARBY_EMPTY_KM;
// Intervall från så här många dagar räknas som "veckoläge" (helgen = 3 dagar
// ska INTE geo-avgränsas eller zoom-gatas — den har alltid funkat nationellt).
const WEEK_RANGE_MIN_DAYS = 5;
// Radie kring kartans mitt i veckoläge. 60 km täcker viewporten vid zoom 9
// med marginal ("staden + omnejd").
// Minsta radie veckovyn ritar kring kartans mitt. Vyn styr annars (se
// weekAreaKey) — golvet finns bara så en hårt inzoomad vy inte tömmer kartan
// på allt som ligger några kvarter bort.
const WEEK_AREA_MIN_RADIUS_KM = 60;

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
    // Spegel: effekter som inte ska köras om vid varje eventbyte (t.ex. dag/
    // vecka-växlingen) behöver bara veta OM ett kort är uppe.
    const selectedEventRef = useRef<LinkEvent | null>(null);
    selectedEventRef.current = selectedEvent;
    const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
    const [discardedEventIds, setDiscardedEventIds] = useState<Set<string>>(new Set());
    const [dayOffset, setDayOffset] = useState(0);
    // Antal dagar i det visade intervallet: 1 = en dag (default), 3 = fre–sön osv.
    const [dayRangeDays, setDayRangeDays] = useState(1);
    // Spegel för bildspelets blink-effekt — den ska läsa nuvarande fas utan att
    // starta om intervallet varje gång fasen växlar (den skriver ju själv fasen).
    const dayRangeDaysRef = useRef(dayRangeDays);
    dayRangeDaysRef.current = dayRangeDays;
    const [cardExpanded, setCardExpanded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Bumpas när sökrutan ska fällas ihop utifrån (man valde en stad ur
    // träfflistan) — se closeSearchNonce i FloatingNavbar.
    const [closeSearchNonce, setCloseSearchNonce] = useState(0);
    // Panel med sparade event (öppnas från Sparade-raden i profilpanelen).
    const [savedPanelOpen, setSavedPanelOpen] = useState(false);
    // Profilpanelen (profilknappen, inloggad) — allt konto-relaterat på kartan.
    const [profilePanelOpen, setProfilePanelOpen] = useState(false);
    // Kategorifilter (flerval). Tomt NORMAL-val = visa alla kategorier; opt-in-
    // källorna (Svenska kyrkan/PRO) räknas separat och göms om de inte står i
    // seten. Startläget är BESÖKARENS (utloggad ⇒ båda källorna på,
    // utils/categoryDefaults) — hydreringen nedan skriver över det med
    // profilens standardläge så fort ett konto landat.
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
        () => new Set(defaultSpecialCategories({ loggedIn: false })),
    );
    // Profilens ålder, sparad vid hydreringen: behövs för att kunna räkna fram
    // standardläget igen (Rensa-knappen) utan att läsa om user-dokumentet.
    const profileAgeRef = useRef<unknown>(undefined);
    // Sparade kartfilter (inloggade): users/{uid}.mapCategories. catPrefsUid =
    // uid vars sparade filter hydrerats (läses EN gång per konto);
    // lastSavedCatsRef = senast sparade/laddade värdet (sorterad nyckel) så vi
    // bara skriver vid faktiska ändringar; urlHadCategoriesRef = en delad
    // ?kategori=-länk vinner över det sparade.
    const [catPrefsUid, setCatPrefsUid] = useState<string | null>(null);
    const lastSavedCatsRef = useRef<string | null>(null);
    const urlHadCategoriesRef = useRef(false);
    // Familj & barn som opt-in (profilregeln i utils/familyFilter): inloggad
    // vuxen utan barn ⇒ 'family' göms tills 🧸-cirkeln kryssas i, och cirkeln
    // ligger då bland opt-in-raderna (Svenska kyrkan/PRO). Sätts vid
    // prefs-hydreringen nedan, nollas vid utloggning.
    const [familyOptIn, setFamilyOptIn] = useState(false);
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
    // Kartans SYNLIGA ruta (null tills kartan rapporterat). Tom-läget frågar mot
    // den i stället för en fast radie: "inget här" ska betyda "jag ser inget",
    // och vad man ser beror på hur långt man zoomat.
    const [mapBounds, setMapBounds] = useState<{ west: number; south: number; east: number; north: number } | null>(null);
    // True när kartan faktiskt MÅLAT ut prickarna (speglar V2Map:s symbolsPainted).
    // Tom-läget håller tyst tills dess — annars hann prompten påstå "inget här"
    // medan ladda-pillen fortfarande sa "Ritar ut eventen…".
    const [mapPainted, setMapPainted] = useState(false);
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
    // FÖRVALT är 'tip': de allra flesta som öppnar rutan tipsar om något de
    // sett, och tips kräver inget konto — att landa i "Jag arrangerar" mötte
    // dem med en inloggningsspärr för ett läge de inte var ute efter.
    const [newEventRole, setNewEventRole] = useState<'host' | 'tip'>('tip');
    const [newEventRepeatWeekly, setNewEventRepeatWeekly] = useState(false); // veckovis serie
    // Hur många veckor serien pågår (inkl. första gången). null = tills vidare.
    const [newEventRepeatWeeks, setNewEventRepeatWeeks] = useState<number | null>(null);
    const [newEventUrl, setNewEventUrl] = useState('');   // tips: länk till källan (valfri)
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
        setNewEventRole('tip');
        setNewEventRepeatWeekly(false);
        setNewEventRepeatWeeks(null);
        setNewEventUrl('');
        setNewEventHost('');
        setCreateKind('event');
        setFulfillingWish(null);
        setRepicking(false);
    }, []);

    /**
     * Öppna skapa-/tipsa-formuläret på KARTANS MITT, med tiden förifylld till
     * nästa hela timme. Två vägar hit: bekräfta-knappen i slutet av placerings-
     * varvet (plusset), och onboardingens actionruta — den ska landa direkt i
     * rätt formulär i stället för att bara stänga sig och lämna en i
     * placeringsläget (Josef 14/8: "vi kan ju lika väl hamna på den rätta
     * rutan"). Platsen går att flytta efteråt via "Ändra plats" i formuläret.
     */
    const openCreateFormHere = useCallback(() => {
        const here = mapCenterRef.current;
        if (!here) return;
        setPickedLocation(here);
        // Förifyll nästa hela timme idag — lokal tid i datetime-local-format.
        const t = new Date(); t.setMinutes(0, 0, 0); t.setHours(t.getHours() + 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        setNewEventTime(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`);
        setCreationMode('editing');
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
    const { user, loading: authLoading, ensureTipIdentity } = useAuth();
    const [authModal, setAuthModal] = useState<{ open: boolean; reason?: string }>({ open: false });
    const openLogin = useCallback((reason?: string) => setAuthModal({ open: true, reason }), []);

    // True när funktions-väskan (uppe till vänster i V2Map) är utfälld.
    // Bara SETTERN används numera: värdet läste skylt-gaten, som är borta.
    // Rapporten från V2Map behålls så en återupplivad skylt-gate har den kvar.
    const [, setFuncBagOpen] = useState(false);
    // True när multi-event-listan är öppen (klick på en bricka med flera event).
    // Vägskyltarna göms då — de svävar fritt över kartan och skulle annars
    // hamna ovanpå listan.
    const [groupListOpen, setGroupListOpen] = useState(false);
    // (Emoji-raden under stadsrutan (CategoryMix) är BORTTAGEN 10/8 — dess jobb
    // görs nu av kategorikolumnen till höger, som står öppen och visar antal
    // per kategori i vyn. mixPick/highlightEmoji-kopplingen försvann med den.)
    // Onboarding-rutan. Startar STÄNGD — den öppnas från info-knappen nere till
    // vänster i stället för att möta besökaren vid varje sidladdning.
    const [welcomeOpen, setWelcomeOpen] = useState(false);
    // Onboarding vid start IGEN (Josef 11/8, ersätter 9/8-beslutet): utloggade
    // möts av intron vid sidladdning, inloggade slipper den. Vi väntar in
    // auth-svaret innan vi öppnar — annars blinkar rutan förbi för inloggade
    // medan sessionen återställs. Auto-öppnas EN gång per sidladdning; efter
    // stängning (eller utloggning) kommer den bara tillbaka via info-knappen.
    //
    // welcomeDone = grinden som släpper bildspelets AUTO-LANDNING. Landningen
    // får INTE gata på welcomeOpen direkt: i commiten där authLoading flippar
    // körs den här effekten och landnings-effekten i SAMMA pass, och landningen
    // läser då fortfarande welcomeOpen=false → den kapade touren innan rutan
    // hann öppnas (Josef 11/8: ingen glid + ~50 seed-brickor = hopp hem bakom
    // modalen). Grinden öppnas först när rutan KLICKATS NER — eller direkt för
    // inloggade, som aldrig får rutan.
    const [welcomeDone, setWelcomeDone] = useState(false);
    // STEG 2 i onboardingen: en liten ruta med de tre sakerna man själv kan göra
    // (tipsa / önska / skapa). Den kommer EFTER att stadshoppet landat och
    // ligger LÅGT på skärmen, så staden man hamnat i syns med sina event bakom
    // (Josef 14/8). Klickar man utanför flyger rutan upp MOT skapa-knappen uppe
    // till vänster, som samtidigt tänds: det är där de bor i fortsättningen.
    // Flyttas knappen igen måste .action-intro-fly-home i globals.css flyttas
    // med — annars pekar hela steget åt fel håll.
    const [actionIntroPending, setActionIntroPending] = useState(false);
    const [actionIntroOpen, setActionIntroOpen] = useState(false);
    // Rutan kommer INTE i samma andetag som välkomstrutan stängs (Josef 14/8):
    // först får stadshoppet landa så man ser var man hamnat, sedan glider den
    // upp. Fördröjningen är räknad från stängningen och täcker hoppet.
    useEffect(() => {
        if (!actionIntroPending) return;
        const t = setTimeout(() => { setActionIntroOpen(true); setActionIntroPending(false); }, ACTION_INTRO_DELAY_MS);
        return () => clearTimeout(t);
    }, [actionIntroPending]);
    // Sant medan plusset blinkar (efter att actionrutan flugit hem). Sidan äger
    // tidtagningen — navbaren bara läser flaggan, så den slipper egen state.
    const [plusHint, setPlusHint] = useState(false);
    // Sant medan hem-flygningen spelas. Rutan avmonteras FÖRST när animationen
    // är klar — rycker vi bort den direkt syns ingen rörelse alls, och då är
    // steget bara en ruta som försvinner.
    const [actionIntroFlyingHome, setActionIntroFlyingHome] = useState(false);
    const dismissActionIntro = useCallback(() => {
        setActionIntroFlyingHome(true);
        setPlusHint(true);                     // plusset tänds MEDAN rutan är på väg
        setTimeout(() => {
            setActionIntroOpen(false);
            setActionIntroFlyingHome(false);
        }, ACTION_INTRO_FLY_MS);
        setTimeout(() => setPlusHint(false), PLUS_HINT_MS);
    }, []);
    // Escape stänger actionrutan på samma sätt som ett klick utanför — samma
    // väg ut, samma blink på plusset.
    useEffect(() => {
        if (!actionIntroOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismissActionIntro(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [actionIntroOpen, dismissActionIntro]);
    // Kromet (navbar, kategorikolumn, stadsruta …) ligger nere BARA under
    // välkomstrutan. Actionrutan i steg 2 kommer först när man landat i sin
    // stad, och då ska allt annat redan vara på plats — inklusive plusset uppe
    // till höger, som rutan ska flyga hem till.
    const chromeHidden = welcomeOpen;
    const welcomeAutoShownRef = useRef(false);
    useEffect(() => {
        if (authLoading || welcomeAutoShownRef.current) return;
        welcomeAutoShownRef.current = true;
        if (user) { setWelcomeDone(true); return; }
        setWelcomeOpen(true);
    }, [authLoading, user]);

    // Zoom-knappen i Nästa-pillen bumpar denna → V2Map zoomar in på det valda
    // eventet (klicket gör samtidigt "Nästa" i EventCard, så man landar inzoomad
    // på nästa event).
    const [zoomToEventTrigger, setZoomToEventTrigger] = useState(0);
    // Zooma ut-knappen i Nästa-pillen — bumpar denna trigger.
    const [zoomOutTrigger, setZoomOutTrigger] = useState(0);

    // ── Stads-bildspelet ──────────────────────────────────────────────────────
    // Kör automatiskt vid sidladdning tills användaren interagerar med kartan.
    // tourCityIndexRef = vilken stad vi står på (index i TOUR_CITIES).
    // cityTourTarget = skickas ner till V2Map som hopp-instruktion; ny nyckel per stad.
    // tourPlaying = false när användaren stoppat bildspelet genom att röra kartan.
    // Inaktivt om djuplänken ?plats= används — användaren har redan valt stad.
    //
    // BLINKET: så fort vi landat i en stad växlar vyn fram och tillbaka mellan
    // VALD DAG (dayRangeDays 1) och HELA VECKAN (7). Veckans event blinkar
    // alltså till med jämna mellanrum — man ser direkt att staden har mer på
    // gång än bara idag, utan att dagens brickor drunknar i en vecka på en gång.
    // Klick på en bricka avgör vilken vy man landar i (se handleSelectEventFromMap).
    // Startar alltid false så serverns HTML och första klient-renderingen är
    // identiska (annars hydration-mismatch på navbarens play-knapp).
    // Auto-starten nedan läser ?plats= och slår på bildspelet direkt vid mount.
    const [tourPlaying, setTourPlaying] = useState(false);
    // Vilken stad vi står på just nu. Ren ref — inget i JSX:en läser den, så
    // den behöver inte trigga omrendering (och kartan skulle rita om i onödan).
    const tourCityIndexRef = useRef(0);
    const [cityTourTarget, setCityTourTarget] = useState<{ lat: number; lng: number; zoom: number; key: number; cityName: string } | null>(null);
    const tourKeyRef = useRef(0); // unik nyckel per hopp-anrop
    // Läses av effekter som inte ska störa (eller störas av) bildspelet.
    const tourPlayingRef = useRef(tourPlaying);
    tourPlayingRef.current = tourPlaying;
    // (signsOn-staten låg här: skyltarna var avstängda tills man tryckte på
    // skylt-knappen. Knappen är borttagen 14/8 och skyltarna därmed släckta —
    // se signpostsHidden längre ner.)
    // (Tidsstämpeln för "när bildspelet stoppades" är borta 9/8: den fanns bara
    // för att låta ett klick precis efter stoppet räkna om dag/vecka-valet, och
    // nu fryser vyn i stället på den fas som visas.)
    // (GPS-spegeln som låg här är borttagen 10/8: play startar numera i staden
    // närmast KARTMITTEN, inte närmast telefonen. GPS-positionen används bara
    // av auto-starten, som läser userPos-state:en direkt.)

    /** Flyg till en punkt och sätt om reveal-ankaret (nyckeln måste ändras —
     *  utan nytt hopp tänds inga brickor, bara nål-prickar). */
    const flyToPoint = useCallback((lat: number, lng: number, label: string) => {
        tourKeyRef.current += 1;
        setCityTourTarget({ lat, lng, zoom: TOUR_ZOOM, key: tourKeyRef.current, cityName: label });
    }, []);

    const flyToCity = useCallback((index: number) => {
        const city = TOUR_CITIES[index];
        flyToPoint(city.lat, city.lng, city.name);
    }, [flyToPoint]);

    // Auto-start: slå på bildspelet vid mount. VAR rundan börjar avgörs av
    // effekten längre ner (den behöver userPos, som deklareras senare i filen):
    // vi börjar DÄR ANVÄNDAREN ÄR (Josef 9/8) i stället för alltid Stockholm.
    // Inaktivt om djuplänken ?plats= används — användaren har redan valt stad.
    // tourAutoStartedRef = rundan har fått sin startpunkt (en gång per besök).
    const tourAutoStartedRef = useRef(false);
    // Sant när rundan startade UTAN att vi visste var användaren var (platsrutan
    // stod fortfarande uppe när väntetiden gick ut). Då är startstaden en
    // gissning — kommer positionen in senare flyttar vi dit på riktigt.
    const tourStartedBlindRef = useRef(false);
    // Sant när vi väntat klart på platstjänsten — då startar vi ändå.
    const [tourGpsWaitOver, setTourGpsWaitOver] = useState(false);
    useEffect(() => {
        // Gäller även ?event= (stadssidornas eventklick + delade länkar):
        // användaren har redan valt vart hen ska, och auto-landningen ryckte
        // annars bort vyn till hemstaden när välkomstrutan stängdes — eventet
        // man just öppnat "försvann". Djuplänks-effekten landar i stället
        // kameran vid eventet när det hittats.
        const params = new URLSearchParams(window.location.search);
        if (params.has('plats') || params.has('event')) {
            tourAutoStartedRef.current = true;
            return;
        }
        setTourPlaying(true);
        const t = setTimeout(() => setTourGpsWaitOver(true), TOUR_GPS_WAIT_MS);
        return () => clearTimeout(t);
    }, []);

    // LANDNINGSPULSEN. KAMERAN FLYTTAR SIG INTE AV SIG SJÄLV: vi stannar i
    // staden vi landat i. Vidare går man via vägskyltarna på kartan — annars
    // rycktes man iväg mitt i att man tittade.
    //
    // När vi landat visas HELA VECKAN en gång, sedan tillbaka till dagen man
    // stod på. Sen står vyn still (Josef 9/8). Det gamla blinket pulsade var
    // annan sekund i all evighet, och priset var högt: det skrev dayRangeDays
    // på en timer, så varenda annan funktion fick försvara sig mot ett värde
    // som byttes under fötterna på den (dagchipen, kategorichipsen, ?dagar=,
    // zoom-vakten, "vilken fas stannade jag i"). Budskapet — "det finns mer i
    // veckan än idag" — är EN mening, och stadsrutan säger det redan
    // stillastående med båda talen samtidigt. Pulsen är bara knuffen som får
    // en att titta på den.
    //
    // tourCycleNonce startar om pulsen när man klickat sig vidare via en skylt
    // eller tryckt play.
    const [tourCycleNonce, setTourCycleNonce] = useState(0);
    // Sant när användaren själv valt period i stadsrutan. Då ska pulsen hålla
    // sig borta — annars hade den kastat tillbaka valet ett par sekunder senare.
    // Nollas vid varje ny stad (se startCityPulse).
    const [pulseSuppressed, setPulseSuppressed] = useState(false);
    // Är veckoläget upplåst (zoom-gate)? Speglas i en ref eftersom
    // handleToggleTourRange nedan behöver den, medan själva värdet räknas ut
    // långt senare i filen (det beror på mapZoom).
    const weekUnlockedRef = useRef(false);
    useEffect(() => {
        if (!tourPlaying || pulseSuppressed) return;
        // Står man redan på veckan finns inget att visa — och vi ska definitivt
        // inte kasta ner en till dagsvyn (man behåller den fas man valt).
        const back = dayRangeDaysRef.current;
        if (back >= WEEK_RANGE_MIN_DAYS) return;
        // Först efter att kameran landat (hoppet ligger ~300 ms bakom
        // stadsöverlägget) — annars pulsar den bakom en heltäckande fade.
        const show = setTimeout(() => setDayRangeDays(7), TOUR_PULSE_DELAY_MS);
        const hide = setTimeout(() => setDayRangeDays(back), TOUR_PULSE_DELAY_MS + TOUR_PULSE_HOLD_MS);
        // Avbryter man (rör kartan, eller väljer period själv) rivs timrarna →
        // man blir kvar i exakt den fas som visades i det ögonblicket.
        return () => { clearTimeout(show); clearTimeout(hide); };
    }, [tourPlaying, tourCycleNonce, pulseSuppressed]);

    /** Ny stad → kör pulsen igen, och glöm ett tidigare eget periodval. */
    const startCityPulse = useCallback(() => {
        setPulseSuppressed(false);
        setTourCycleNonce(n => n + 1);
    }, []);

    /**
     * Klick på stadsrutan under bildspelet: växla mellan vald dag och hela
     * veckan (Josef 10/8) — man ska kunna byta period utan att lämna bildspelet.
     *
     * Stoppar därför INTE bildspelet, till skillnad från dagväljaren och det
     * bara kartklicket: rutan renderas bara medan bildspelet rullar, så ett
     * stopp hade fått knappen att försvinna i samma sekund som man tryckte på
     * den. Däremot tystas landningspulsen — ett eget val ska inte kastas om
     * ett par sekunder senare.
     *
     * Veckoläget är zoom-gatat (utzoomad vecka = tusentals brickor): är det
     * låst gör klicket ingenting, i stället för att slå om och genast slås
     * tillbaka av zoom-vakten.
     */
    const handleToggleTourRange = useCallback(() => {
        const toWeek = dayRangeDaysRef.current < WEEK_RANGE_MIN_DAYS;
        if (toWeek && !weekUnlockedRef.current) return;
        setPulseSuppressed(true);
        startTransition(() => setDayRangeDays(toWeek ? 7 : 1));
    }, []);

    /**
     * Pilarna vid stadsnamnet: stega en dag fram/tillbaka UTAN att lämna
     * bildspelet (Josef 10/8) — man ska kunna planera framåt i staden man står
     * i, inte tvingas stoppa rundan och leta upp dagväljaren. Dagväljaren i
     * navbaren göms ju medan bildspelet kör.
     *
     * Perioden behålls: står man på hela veckan blir det veckan som börjar den
     * nya dagen. Bakåt bottnar på idag — vi visar inte passerade dygn.
     * Som stadsrutans egen växel tystar den landningspulsen (ett eget val ska
     * inte kastas om ett par sekunder senare) och stoppar INTE bildspelet.
     */
    const handleTourDayStep = useCallback((delta: number) => {
        setPulseSuppressed(true);
        startTransition(() => setDayOffset(o => Math.max(0, o + delta)));
    }, []);

    // Kalenderknappen på stadsrutan (Josef 10/8; alltid-synlig 18/8): sitter
    // ALLTID uppe vid stadsnamnets rad — den byter inte längre plats med
    // bakåtpilen — och öppnar MÅNADSKALENDERN direkt. De gamla snabbvalen
    // (Idag/Imorgon/veckodagarna i navbarens dagväljare) är borta;
    // specifika datum väljer man här.
    // Precis som dagpilarna stoppar valet inte skyltläget, det tystar bara
    // landningspulsen.
    // TRYCKYTAN ÄR SJÄLVA DATE-FÄLTET (Josef 21/8): det ligger osynligt
    // OVANPÅ ikonen i stället för under en knapp. iOS öppnar bara
    // månadskalendern från en äkta tapp på fältet — showPicker() saknas/failar
    // tyst där, och programmatiska focus()/click() öppnar aldrig pickern, så
    // knapp-varianten gav en död kalenderknapp på iPhone. På desktop räcker
    // inte klicket på fältet (det bara fokuserar), därför showPicker() i
    // fältets egen onClick.
    const calendarInputRef = useRef<HTMLInputElement>(null);
    // TOGGLE (Josef 21/8): ett tryck på kalenderknappen när pickern är UPPE
    // ska STÄNGA den, inte öppna om den. Native-pickern har inget "är
    // öppen?"-API och inget stängningsevent — vi bokför själva med
    // calendarPickerOpen: sätts av klicket som öppnar, nollas av fältets
    // blur (iOS-popovern blurrar fältet när den avvisas; på desktop blurrar
    // utanförklicket som stänger popupen). MEDAN pickern är öppen stängs
    // date-fältets pointer-events av och ikonen tar över tryckytan som
    // STÄNG-knapp (blur fäller popovern) — annars träffar avvisnings-tappen
    // själva fältet och iOS öppnar pickern på nytt i samma tryck.
    const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
    const openMonthCalendar = useCallback(() => {
        const el = calendarInputRef.current;
        // focus FÖRST: showPicker() fokuserar INTE fältet (desktop), och utan
        // fokus är blur() i pick-/stängvägarna en no-op → guldet fastnade PÅ
        // efter ett datumval och nästa klick bara släckte det (Josef 21/8).
        // Med fokus släcker även ett klick utanför via blur-eventet.
        el?.focus({ preventScroll: true });
        // Ofarligt no-op där showPicker saknas eller kalendern redan öppnas
        // nativt av tappen (iOS).
        try { el?.showPicker(); } catch { /* nativt beteende räcker */ }
        setCalendarPickerOpen(true);
        // Kalenderklicket hoppar samtidigt HEM TILL IDAG (Josef 21/8) —
        // snabbaste vägen tillbaka, och pickern som öppnas står då på dagens
        // datum. Vill man till ett annat datum väljer man det direkt i den.
        setPulseSuppressed(true);
        startTransition(() => {
            setDayOffset(0);
            setDayRangeDays(1);
        });
    }, []);
    const closeMonthCalendar = useCallback(() => {
        // blur stänger iOS-popovern; på desktop är popupen redan stängd av
        // utanförklicket och blur är ofarligt. Nolla ALLTID bokföringen här —
        // blur-EVENTET uteblir om fältet inte längre är fokuserat (t.ex.
        // Esc-stängd popup), och då satt knappen annars fast i "öppen"
        // (fältet pointer-events-none) och blev död för alltid.
        calendarInputRef.current?.blur();
        setCalendarPickerOpen(false);
    }, []);
    // Fältets värde FÖLJER vald dag (controlled). Med gamla defaultValue stod
    // kalendern kvar på "idag" fast man pilat fram — och ett tapp på dagens
    // datum gav då ingen change-händelse alls (samma värde), så det gick inte
    // att hoppa hem till idag utan att studsa via en annan dag först.
    const calendarValue = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        return toInputDate(d);
    }, [dayOffset]);
    const handleCalendarPick = useCallback((value: string) => {
        if (!value) return;
        const picked = new Date(`${value}T00:00:00`);
        if (Number.isNaN(picked.getTime())) return;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const offset = Math.round((picked.getTime() - startOfToday.getTime()) / 86_400_000);
        if (offset < 0) return; // passerade dygn visas inte — pickern står kvar så man kan välja om
        // Valt datum = klart: fäll pickern (iOS-popovern blir annars stående
        // över kartan man just hoppat i) och släck guldet DIREKT — blur-
        // eventet uteblir om fältet inte var fokuserat, och då lyste knappen
        // kvar som "öppen" fast pickern stängts (Josef 21/8).
        calendarInputRef.current?.blur();
        setCalendarPickerOpen(false);
        setPulseSuppressed(true);
        startTransition(() => {
            setDayOffset(offset);
            setDayRangeDays(1);
        });
    }, []);

    // Stopp-callback från V2Map: användaren drog/klickade → pausa bildspelet.
    // Blinket slutar där det står — dayRangeDays rörs INTE här, så den fas man
    // ser i stoppögonblicket är den man blir kvar i.
    const handleMapUserInteraction = useCallback(() => {
        // Har man tagit i kartan är vyn ens egen — en sen platsuppgift får inte
        // rycka iväg kameran efteråt.
        tourStartedBlindRef.current = false;
        if (!tourPlayingRef.current) return;
        setTourPlaying(false);
    }, []);

    // (handleToggleSigns låg här — skylt-knappens av/på plus hoppet till
    // närmsta ort. Knappen är borttagen 14/8, se signpostsHidden.)

    // Vägskyltarna på kartan (CitySignposts) — ersätter den gamla "Nästa
    // stad"-knappen (Josef 9/8). I stället för att bli slängd till nästa stad i
    // en rutt man inte ser väljer man själv väderstreck, som vid en vägkorsning.
    // Hoppet fungerar likadant som bildspelets egna stadsbyte: ny dag-vy, ny
    // stad i rundan, och klockan nollställd så staden får sin fulla tid.
    // Bildspelet startar/fortsätter alltid efter ett skylt-hopp — skylten ÄR
    // "vidare"-knappen nu.
    const handlePickSignpostCity = useCallback((city: { lat: number; lng: number; name: string }, index: number) => {
        tourAutoStartedRef.current = true;   // auto-starten ska inte flyga om
        tourStartedBlindRef.current = false; // eget val — ingen efterhämtning
        // Vyn följer med till nästa stad: står man på hela veckan när man
        // klickar skylten ska veckan gälla där också (Josef 9/8).
        tourCityIndexRef.current = index;
        flyToPoint(city.lat, city.lng, city.name);
        startCityPulse();
        setTourPlaying(true);
    }, [flyToPoint, startCityPulse]);

    /**
     * Vald stad ur SÖKRUTAN (10/8, efter användarkommentar: "Jag saknar en
     * sökruta för stad" — vägen till sin egen ort gick via att skrolla
     * Sverigekartan och zooma in för hand).
     *
     * Landar precis som ett skylt-hopp: samma kamerahopp, stadsrutan med
     * namn + antal idag/i veckan, landningspulsen som visar vad veckan har,
     * och vägskyltar mot grannstäderna. Skillnaden är bara hur man kom dit.
     * Sökrutan fälls ihop (annars täcker den kartan man just bad om) och
     * söktexten nollas så träfflistan stänger.
     *
     * Orten behöver inte ligga i bildspelets rutt — rundan fortsätter från
     * den TOUR_CITIES-stad som ligger närmast, så play/skyltar pekar rätt.
     */
    const handlePickSearchCity = useCallback((city: CityPoint) => {
        tourAutoStartedRef.current = true;
        tourStartedBlindRef.current = false;
        tourCityIndexRef.current = nearestTourCityIndex(city.lat, city.lng);
        setSearchQuery('');
        setCloseSearchNonce(n => n + 1);
        flyToPoint(city.lat, city.lng, city.name);
        startCityPulse();
        setTourPlaying(true);
    }, [flyToPoint, startCityPulse]);



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
        // Enda stället där "Jag arrangerar" är rätt förval: man svarar på en
        // önskan genom att själv ordna eventet. Sätts uttryckligen eftersom
        // skapa-rutan annars öppnar i tips-läget.
        setNewEventRole('host');
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
    //
    // RADIEN FÖLJER VYN (Josef 9/8): den täcker vyns halva diagonal, avrundad
    // uppåt till jämna 5 km. Förut var den fast 60 km — mindre än en bred
    // laptopvy — så kartan kunde rita FÄRRE event än talet påstod. Nu är den
    // ett rent tak för hur mycket som ritas, aldrig en egen "räknearea":
    // allt man kan se ryms alltid innanför den.
    // Både mitten och radien rundas (weekAreaKey) så listan inte räknas om —
    // och markörerna inte omsyncas — för varje liten panorering.
    //
    // MITTEN TAS UR STADSHOPPET, inte ur kartan, medan bildspelet rullar
    // (Josef 10/8): mapCenter kommer först med kartans 'moveend', och det
    // ligger ~300–500 ms efter klicket (V2Map hoppar bakom stadsöverlägget och
    // moveend är dessutom throttlad). Klickade man en vägskylt i VECKOLÄGE låg
    // 60 km-fönstret alltså kvar runt FÖRRA staden när kameran landade — den
    // nya staden hade inga event i listan, och eftersom avslöjningen seedas i
    // samma ögonblick som hoppet tändes inga brickor alls. Man fick klicka
    // tillbaka till "Idag" (som saknar geo-fönster) för att se något. I
    // dagsläget märktes ingenting, för då finns ingen radie att ligga fel.
    // Under bildspelet ÄR stadens centrum det man tittar på, så vi använder det
    // direkt — då är eventen på plats redan innan kameran hoppar.
    const weekAreaCenter = (tourPlaying && cityTourTarget)
        ? { lat: cityTourTarget.lat, lng: cityTourTarget.lng }
        : mapCenter;
    // Radien mäts ur RUTANS EGEN halva diagonal (mitt→hörn på samma bounds),
    // inte från weekAreaCenter till rutans hörn. Under ett stadshopp beskriver
    // rutan fortfarande förra staden, och avståndet dit kunde vara hundratals
    // km — det hade dragit in halva landet i veckovyn i stället för stadens
    // omnejd. Spannet är detsamma i båda städerna på samma zoom.
    const viewRadiusKm = mapBounds
        ? haversineKm(
            (mapBounds.south + mapBounds.north) / 2, (mapBounds.west + mapBounds.east) / 2,
            mapBounds.north, mapBounds.east)
        : 0;
    // EFFEKTIV period för DATAT, härledd synkront ur zoomen (Josef 11/8):
    // zoom-vakten nedan (useEffect) flippar dayRangeDays→1 först EN RENDER
    // EFTER att mapZoom/mapBounds landat. I den mellanrendern var veckoläget
    // kvar med vyns nya jätteradie → tusentals obakade veckoikoner började
    // bakas (sekunder) bara för att slängas när vakten slog till. Symtomen:
    // zooma ut mycket → bara det gamla lilla området hade prickar, resten av
    // landet kom "efter lång tid". Genom att derivera perioden här går datat
    // rakt till dagläget (som saknar geo-fönster → alla prickar nationellt)
    // i samma render som zoomen passerar gränsen; vakten normaliserar sedan
    // bara STATEN (chips/URL) utan att datat rör sig igen.
    const weekZoomLocked = mapZoom !== null && mapZoom < WEEK_VIEW_MIN_ZOOM - 0.5;
    // ── INTRO-LÄGET ────────────────────────────────────────────────────────
    // Medan välkomstrutan står uppe ligger kartkromet nere och kartan reser
    // söder→norr bakom den. Perioden lämnas OFÖRÄNDRAD (dagens event): ett
    // nationellt sjudagarsfönster blev ~6 000 markörer att strömma ut och var
    // precis det som gjorde starten seg (Josef 13/8).
    // `mapCenter` i villkoret är inte kosmetik: prop:en går false→true EN gång,
    // och hade den flippat innan kartan monterats hade resan aldrig startat.
    const introMapMode = welcomeOpen && !!mapCenter && !tourAutoStartedRef.current;
    const effectiveRangeDays = dayRangeDays >= WEEK_RANGE_MIN_DAYS && weekZoomLocked ? 1 : dayRangeDays;
    const weekAreaKey = effectiveRangeDays >= WEEK_RANGE_MIN_DAYS && weekAreaCenter
        ? `${Math.round(weekAreaCenter.lat * 20) / 20}:${Math.round(weekAreaCenter.lng * 20) / 20}:${
            Math.max(WEEK_AREA_MIN_RADIUS_KM, Math.ceil(viewRadiusKm / 5) * 5)
        }`
        : null;
    const filteredEvents = useMemo(() => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setDate(endOfDay.getDate() + (effectiveRangeDays - 1));
        endOfDay.setHours(23, 59, 59, 999);

        const inRange = events.filter(evt => evt.time >= startOfDay && evt.time <= endOfDay);
        if (!weekAreaKey) return inRange;

        // Veckoläge: behåll bara event inom radien kring kartans (rundade)
        // mitt. Event utan koordinater släpps igenom — de kan ändå inte ritas
        // som brickor och ska inte försvinna ur sök/listor.
        const [cLat, cLng, radiusKm] = weekAreaKey.split(':').map(Number);
        return inRange.filter(evt =>
            !hasValidCoords(evt) || haversineKm(cLat, cLng, evt.lat, evt.lng) <= radiusKm
        );
    }, [events, dayOffset, effectiveRangeDays, weekAreaKey]);

    // Zoomar man ut ur områdesvyn medan veckoläget är på → tillbaka till en
    // dag (offset behålls). 0.5 zoomstegs hysteres mot upplåsningsgränsen så
    // det inte flappar precis på tröskeln. Datat har redan bytt via
    // effectiveRangeDays ovan — det här normaliserar bara staten (chips/URL).
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
            prevDayKey.current = dayKey;
            // Bildspelets blink växlar dag↔vecka en gång i halvsekunden. Det ska bara
            // ändra vad kartan VISAR — inte öppna ett eventkort per blink.
            if (tourPlayingRef.current) return;
            // Har man INGET kort uppe ska ett dag/vecka-byte inte trolla fram
            // ett (Josef 9/8) — kartan ska bara byta vad den visar. Kort öppnas
            // när man själv klickar på en bricka. Har man däremot ett kort uppe
            // följer det med till den nya dagen (närmast kartans mitt).
            if (selectedEventRef.current) {
                setSelectedEvent(pickNearestToPoint(mapCenterRef.current, filteredEvents));
            }
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

    // Skapa event på riktigt: skrivs till Firestore (reglerna begränsar formen)
    // och dyker upp direkt på kartan via optimistisk insättning (pollen plockar
    // sedan upp samma event från Firestore inom 30 s).
    //
    // KONTO krävs för att ARRANGERA (man visas upp som värd). Att TIPSA går
    // utan — då hämtas ett uid från en anonym session i stället. Det var den
    // enskilt största spärren: nästan alla tips som kommer in i FB-grupperna
    // skrivs av folk som aldrig hade skapat ett konto för att lämna dem.
    const handleCreateEvent = useCallback(async () => {
        if (!pickedLocation || !newEventTitle.trim() || !newEventTime) return;
        // Tips FÅR ha en länk till källan men måste inte — de flesta tips
        // (återkommande pubquiz, bygdegårdsfester) har ingen sida att peka på.
        // Är fältet ifyllt men obegripligt säger vi till i stället för att tyst
        // slänga det.
        const isTip = newEventRole === 'tip';
        const tipUrl = isTip ? normalizeTipUrl(newEventUrl) : null;
        if (isTip && newEventUrl.trim() && !tipUrl) {
            toast.error('Länken går inte att tolka — ta bort den eller skriv hela adressen.');
            return;
        }
        if (!isTip && !user) { openLogin('Logga in för att skapa event'); return; }

        setCreatingEvent(true);
        try {
            // Tips utan konto → anonymt uid. Reglerna kräver fortfarande
            // hostUid == request.auth.uid, så formkraven är oförändrade.
            const authorUid = isTip ? await ensureTipIdentity() : user!.uid;
            // Utan inloggat konto blir tips-identiteten en anonym session.
            // Märk tipset därefter — det är märkningen som gör att vem som
            // helst får plocka bort det igen (spam har ingen ägare som städar).
            // Läses ur `user` och inte ur isAnonymousSession: den senare hinner
            // inte uppdateras när ensureTipIdentity precis skapat sessionen.
            const isAnonTip = isTip && !user;
            const time = new Date(newEventTime);
            // Tips: värden är arrangören man tipsar om (angivet namn, annars
            // länkens domän, annars okänd) — ALDRIG tipsarens eget namn.
            // Eget event: som förut.
            const hostName = isTip
                ? (newEventHost.trim()
                    || (tipUrl ? new URL(tipUrl).hostname.replace(/^www\./, '') : 'Okänd arrangör'))
                : (user!.displayName || user!.email || 'VADKUL-användare');
            // Ladda upp ev. eventbild först så URL:en kan sparas på eventet.
            let coverImage = '';
            if (newEventImage) {
                try {
                    coverImage = await storageService.uploadFile(`event-images/${authorUid}/`, newEventImage);
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
                hostUid: authorUid,
                coverImage,
                url: tipUrl ?? '',
                isTip,
                anonTip: isAnonTip,
                repeatWeekly: newEventRepeatWeekly,
                repeatWeeks: newEventRepeatWeekly ? newEventRepeatWeeks ?? undefined : undefined,
            });
            const created: LinkEvent = {
                id: docId, url: tipUrl ?? '', title: newEventTitle.trim(), time, createdAt: new Date(),
                locationName: newEventPlace.trim(), lat: pickedLocation.lat, lng: pickedLocation.lng,
                hostName,
                category: newEventCategory, coverImage, description: newEventDescription.trim(), attendees: 0,
                isLocationVerified: true, userCreated: true, isTip, anonTip: isAnonTip,
                repeatWeekly: newEventRepeatWeekly,
                repeatWeeks: newEventRepeatWeekly ? newEventRepeatWeeks ?? undefined : undefined,
                hostUid: authorUid,
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
            // Bara koden till konsollen — inte hela felobjektet (se helpern).
            const code = createEventErrorCode(err);
            console.warn('[event] skapandet stoppades:', code);
            toast.error(createEventErrorText(code));
        } finally {
            setCreatingEvent(false);
        }
    }, [pickedLocation, newEventTitle, newEventTime, newEventCategory, newEventPlace, newEventDescription, newEventImage, newEventRole, newEventUrl, newEventHost, newEventRepeatWeekly, newEventRepeatWeeks, user, ensureTipIdentity, openLogin, fulfillingWish, resetCreateFlow]);

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

    // Ta bort ett användarskapat event: Firestore-delete (reglerna avgör vem
    // som får) + optimistisk borttagning ur kartan/kortleken. Sitt eget alltid
    // — och ANONYMA TIPS får vem som helst plocka bort, eftersom de saknar
    // ägare som kan städa upp efter sig om någon spammar.
    const handleDeleteOwnEvent = useCallback(async (eventId: string) => {
        try {
            // Reglerna kräver ett uid även för den öppna raderingen, och en
            // besökare som aldrig tipsat har ingen session alls. Hämta en först
            // — är man redan inloggad återanvänds det uid:t oförändrat.
            await ensureTipIdentity();
            // Ett tillfälle i en veckoserie har id "<docId>__2026-08-13" och
            // motsvarar inget eget dokument — dokumentet är seriens bas. Skala
            // av datumsuffixet före raderingen, annars försöker vi ta bort ett
            // dokument som inte finns och hela serien blir kvar på kartan.
            const docId = eventId.split('__')[0];
            await linkEventService.deleteUserEvent(docId);
            // ...och städa bort ALLA tillfällen som hör till dokumentet, inte
            // bara det man råkade ha framme.
            const belongsToDeleted = (id: string) => id === docId || id.startsWith(`${docId}__`);
            myCreatedRef.current = myCreatedRef.current.filter(e => !belongsToDeleted(e.id));
            lastUserEventsRef.current = lastUserEventsRef.current.filter(e => !belongsToDeleted(e.id));
            setEvents(prev => prev.filter(e => !belongsToDeleted(e.id)));
            setSelectedEvent(prev => (prev && belongsToDeleted(prev.id) ? null : prev));
            setSavedEventIds(prev => {
                const stale = [...prev].filter(belongsToDeleted);
                if (stale.length === 0) return prev;
                const next = new Set(prev);
                stale.forEach(id => next.delete(id));
                return next;
            });
            toast.success('Eventet är borttaget.');
        } catch (err) {
            const code = createEventErrorCode(err);
            console.warn('[event] raderingen stoppades:', code);
            toast.error(code.includes('permission-denied')
                ? 'Du får inte ta bort det här eventet.'
                : 'Kunde inte ta bort eventet. Försök igen.');
        }
    }, [ensureTipIdentity]);

    // Boosta ett event: startar Stripe Checkout (redirect). featuredUntil sätts
    // först av backend efter genomförd betalning — aldrig härifrån.
    // Nivån (1 dag/vecka/månad) väljs i kortets BoostTierPicker — hit kommer
    // bara det färdiga valet; priset ägs av Stripe/backend (tier → belopp).
    const handleBoostOwnEvent = useCallback(async (eventId: string, tier: BoostTier) => {
        // Utloggad (eller anonym tips-session — `user` är null då) → inloggnings-
        // modalen, inte ett rött fel. Köpet måste knytas till ett konto man kan
        // komma tillbaka till, men den som just tryckt "Boosta" är den mest
        // köpbenägna personen på sajten — hen ska inte mötas av en återvändsgränd.
        if (!user) { openLogin('Logga in för att boosta eventet'); return; }
        try {
            const t = toast.loading('Öppnar betalning…');
            await startEventBoostCheckout(eventId, tier); // redirectar vid succé
            toast.dismiss(t);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Kunde inte starta boost.');
        }
    }, [user, openLogin]);

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
        // Gilla kräver konto (Josef 22/8). Navbar-hjärtat är borttaget, så en
        // utloggad gillning hade landat i en localStorage-låda utan väg
        // tillbaka — Sparat-panelen nås numera bara från profilpanelen.
        // Gäller ALLA vägar in hit: hjärtat på kortet OCH svep höger (SPARA).
        if (!user) { openLogin('Logga in för att gilla event'); return; }
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

    // Opt-in-källor (Svenska kyrkan/PRO) har väldigt många event och är
    // avstängda som default: deras event GÖMS tills användaren själv kryssar i
    // källan. Övriga (normala) kategorier behåller "tom = visa alla". Därför
    // delar vi upp valet — opt-in-källorna ska inte räknas in i normal-valet
    // (annars skulle en ikryssad källa dölja alla andra event).
    const selectedNormal = useMemo(
        // I familj-opt-in-läget behandlas 'family' som en opt-in-källa och ska
        // därför inte heller räknas in i normal-valet (ett ikryssat 🧸 skulle
        // annars dölja alla andra kategorier).
        () => new Set([...selectedCategories].filter(id =>
            !SPECIAL_CATEGORY_KEYS.has(id) && !(familyOptIn && id === 'family'))),
        [selectedCategories, familyOptIn],
    );
    const matchesFilter = useCallback((evt: LinkEvent) => {
        // Användarskapade event är sajtens kärna → de syns ALLTID och kringgår
        // hela kategori-/källfiltret: de göms aldrig av ett aktivt kategori-val
        // och ligger aldrig i opt-in-källorna (Svenska kyrkan/PRO), så
        // deras opt-in-beteende påverkas inte.
        if (evt.userCreated) return true;
        const src = classifySource(evt.url || evt.id);
        // Special-källa: syns bara om den är ikryssad (ingår inte i "visa alla").
        if (src) return selectedCategories.has(src);
        // Familj & barn: opt-in för inloggade vuxna utan barn i profilen
        // (utils/familyFilter). Bara exakt kategori 'family' berörs — breda
        // event som passar både barn och vuxna klassas som music/party av
        // pipelinen och göms aldrig här.
        if (familyOptIn && evt.category === 'family') return selectedCategories.has('family');
        // Normalt event: tomt normal-val = visa alla, annars matcha kategori.
        if (selectedNormal.size === 0) return true;
        const catKey = evt.category && evt.category in EVENT_CATEGORIES ? evt.category : 'other';
        return selectedNormal.has(catKey);
    }, [selectedCategories, selectedNormal, familyOptIn]);

    // Kategorifiltret appliceras sist i kedjan: dag → sök → kategori.
    const visibleEvents = useMemo(
        () => searchFilteredEvents.filter(matchesFilter),
        [searchFilteredEvents, matchesFilter],
    );

    // Antal synliga event för dagen (efter kategori-/källfilter). Speglar kartan.
    const dayEventCount = visibleEvents.length;

    /**
     * STADSTRÄFFAR i sökrutan. Söker man "Hudiksvall" vill man till Hudiksvall
     * — inte bläddra i en lista med enskilda event (användarkommentar 10/8).
     * Ligger därför överst i träfflistan, före eventen.
     *
     * Antalet gäller den närmaste veckan inom CITY_SEARCH_RADIUS_KM från
     * centrum: man ska kunna se om det är värt att åka dit INNAN man klickar,
     * och en tunn ort ska säga det rakt ut i stället för att låta en flyga till
     * en tom karta. Räknebasen är densamma som dagchipens siffra — utan eget
     * kategori-val räknas allt med (även de dolda opt-in-källorna), annars
     * speglar den filtret. Tills aggregaten landat är antalet null ("Räknar…"),
     * annars hade en halvfylld lista påstått att orten var tom.
     */
    const cityHits = useMemo(() => {
        const matches = searchCities(searchQuery);
        if (matches.length === 0) return [];
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 7);
        const pool = eventsSettled
            ? (selectedCategories.size === 0 ? events : events.filter(matchesFilter))
                .filter(evt => hasValidCoords(evt) && evt.time >= start && evt.time < end)
            : null;
        return matches.map(city => ({
            city,
            weekCount: pool
                ? pool.filter(evt => haversineKm(city.lat, city.lng, evt.lat, evt.lng) <= CITY_SEARCH_RADIUS_KM).length
                : null,
        }));
    }, [searchQuery, events, eventsSettled, selectedCategories, matchesFilter]);

    /**
     * "Syns det något i vyn?" — enda geo-testet tom-läget behöver. Ett event
     * räknas som synligt om det ligger i kartans ruta ELLER inom NEARBY_EMPTY_KM
     * från mitten. Golvet finns för att en hårt inzoomad vy (kvarteret) annars
     * skulle skrika "inget här" fast spelningen ligger tre gator bort.
     */
    const eventInView = useCallback((evt: LinkEvent) => {
        if (!hasValidCoords(evt)) return false;
        if (mapCenter && haversineKm(mapCenter.lat, mapCenter.lng, evt.lat, evt.lng) <= NEARBY_EMPTY_KM) return true;
        if (!mapBounds) return false;
        return evt.lat >= mapBounds.south && evt.lat <= mapBounds.north
            && evt.lng >= mapBounds.west && evt.lng <= mapBounds.east;
    }, [mapCenter, mapBounds]);

    /**
     * "Här händer ingenting"-läget: noll synliga event i den vy man tittar på.
     * Det är i den sekunden en uppmaning att tipsa faktiskt biter — besvikelsen
     * är precis nyss uppstådd och gäller en konkret plats och dag. En permanent
     * banner eller ringar runt knappar blir folk blinda för på tre besök; det
     * här syns bara när det är sant.
     *
     * Frågan ställs mot kartans FAKTISKA ruta (eventInView), inte mot en fast
     * radie. Den fasta radien var fel åt båda hållen: i nationell översikt låg
     * det per definition inget inom 2,5 mil från mitten, så prompten slog till
     * direkt när sidan öppnades — mitt över en karta full av markörer; och en
     * zoomgrind i stället gjorde att den aldrig dök upp där den behövs.
     *
     * Laddningsgrinden är två signaler, inte en: eventsSettled (det DEFINITIVA
     * "aggregaten är hämtade"-beskedet — dayCountReady duger inte, den tänds
     * redan vid första delbatchen) OCH mapPainted (prickarna är utritade).
     * Utan den andra hann prompten påstå "inget här" medan ladda-pillen
     * fortfarande sa "Ritar ut eventen…". Utöver det: håll tyst så fort något
     * annat pågår — skapa-flödet, ett öppet kort eller en aktiv sökning.
     */
    const nearbyIsEmpty = useMemo(() => {
        if (!eventsSettled || !mapPainted) return false;
        // Under bildspelet skulle prompten blinka in och ut i takt med
        // dag↔vecka-växlingen (en småstad är ofta tom just idag men inte i
        // veckan). Håll tyst — besökaren har inte valt den här platsen.
        if (tourPlaying) return false;
        if (!mapCenter && !mapBounds) return false;
        if (creationMode !== 'idle' || selectedEvent || selectedWish) return false;
        if (searchQuery.trim()) return false;
        return !visibleEvents.some(eventInView);
    }, [eventsSettled, mapPainted, mapCenter, mapBounds, eventInView, creationMode, selectedEvent, selectedWish, searchQuery, visibleEvents, tourPlaying]);

    // Veckoalternativet (dagväljaren, veckogenvägen i navbaren och erbjudandet
    // i tom-läget) låses upp först när man zoomat in till stadsnivå — se
    // konstantblocket ovanför HomePage. Definieras här uppe eftersom
    // nearbyThisWeekCount/canOfferWeek nedan läser den.
    const weekUnlocked = mapZoom !== null && mapZoom >= WEEK_VIEW_MIN_ZOOM;
    // Spegel för handleToggleTourRange (stadsrutans klick) — den är deklarerad
    // långt ovanför, uppe i bildspels-blocket.
    weekUnlockedRef.current = weekUnlocked;

    /**
     * Hur många event finns i närheten den KOMMANDE VECKAN, oavsett vald dag?
     * Det är skillnaden mellan "här händer ingenting" och "här händer inget
     * just idag" — i en småstad är dagsvyn ofta tom medan veckan har ett
     * tiotal, och då är rätt svar att vidga tiden, inte att be om tips.
     * Räknas på samma källfilter som kartan, så siffran vi lovar är den man
     * faktiskt får se.
     */
    const nearbyThisWeekCount = useMemo(() => {
        const from = Date.now();
        const to = from + 7 * 86_400_000;
        return events.filter(evt =>
            evt.time.getTime() >= from && evt.time.getTime() <= to
            && matchesFilter(evt)
            && eventInView(evt),
        ).length;
    }, [events, eventInView, matchesFilter]);

    /** Går det att erbjuda veckan? Bara inzoomad (samma grind som dagväljaren). */
    const canOfferWeek = weekUnlocked && dayRangeDays !== 7 && nearbyThisWeekCount > 0;

    /**
     * Är stadsrutans växel låst just nu? Sant bara på väg TILL veckan medan man
     * är utzoomad — tillbaka till dagen går alltid. Styr hjälpraden i rutan:
     * den ska inte lova "tryck för att växla" när klicket inte gör något.
     */
    const tourRangeToggleLocked = dayRangeDays < WEEK_RANGE_MIN_DAYS && !weekUnlocked;

    /** Dagen prompten pratar om — "idag"/"imorgon", annars veckodagen. */
    const promptDayLabel = useMemo(() => {
        if (dayOffset === 0) return 'idag';
        if (dayOffset === 1) return 'imorgon';
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        return `på ${d.toLocaleDateString('sv-SE', { weekday: 'long' })}`;
    }, [dayOffset]);

    /**
     * Öppna skapa-modalen direkt i TIPS-läge på den plats man tittar på.
     * Går via 'editing' (inte 'placing') — platsen är redan känd, och ett
     * extra placerings-varv mellan besvikelse och formulär tappar folk.
     */
    const startTipHere = useCallback(() => {
        if (!mapCenterRef.current) return;
        setFulfillingWish(null);
        setCreateKind('event');
        setNewEventRole('tip');
        setPickedLocation(mapCenterRef.current);
        setNewEventTitle('');
        setNewEventPlace('');
        setNewEventDescription('');
        setNewEventUrl('');
        setNewEventHost('');
        setNewEventCategory('other');
        const t = new Date();
        t.setDate(t.getDate() + dayOffset);
        t.setMinutes(0, 0, 0);
        if (dayOffset !== 0) t.setHours(18);
        else t.setHours(t.getHours() + 1);
        const pad = (n: number) => String(n).padStart(2, '0');
        setNewEventTime(`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`);
        setCreationMode('editing');
    }, [dayOffset]);

    // Antal event totalt för idag (oavsett filter) för välkomstmodalen
    const todayEventCount = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        return events.filter(evt => evt.time >= startOfToday && evt.time <= endOfToday).length;
    }, [events]);

    // Antal event den närmaste veckan (oavsett filter) — välkomstmodalens
    // huvudsiffra (Josef 11/8): dagssiffran sålde inte databasens storlek,
    // veckovolymen gör det.
    const weekEventCount = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return events.filter(evt => evt.time >= start && evt.time < end).length;
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

    /**
     * ENDA GEO-REGELN I HELA GRÄNSSNITTET (Josef 9/8): varje tal räknar det som
     * ligger i KARTANS RUTA. Utzoomad över Sverige ÄR vyn Sverige och talet blir
     * landets; över Växjö blir det Växjös. Inget läge att hålla reda på, och
     * arean går att kontrollera med ögonen — den ÄR skärmen.
     *
     * Förut betydde samma siffra tre olika saker: hela Sverige i dagsläget,
     * 60 km-radie i veckoläget och vyn under bildspelet — "8 idag" blev "908
     * idag" så fort man stängde av bildspelet, utan att något flyttat sig.
     *
     * Event utan koordinater räknas inte: de kan inte ligga i en vy.
     */
    const inMapView = useCallback((evt: LinkEvent) => (
        !!mapBounds && hasValidCoords(evt)
        && evt.lat! >= mapBounds.south && evt.lat! <= mapBounds.north
        && evt.lng! >= mapBounds.west && evt.lng! <= mapBounds.east
    ), [mapBounds]);

    // Vilken stad kartrutan senast MÄTTES under — stadsrutans vakt mot att visa
    // förra stadens siffror under den nya stadens namn (se areaCounts).
    // Samma värde ⇒ React bailar ur utan omrendering, så en zoom eller
    // panorering kostar ingenting extra.
    const [boundsCityKey, setBoundsCityKey] = useState<number | null>(null);
    const cityTourKeyRef = useRef<number | null>(null);
    cityTourKeyRef.current = cityTourTarget?.key ?? null;
    useEffect(() => { setBoundsCityKey(cityTourKeyRef.current); }, [mapBounds]);

    // ── Stadsrutan + kategorikolumnen ────────────────────────────────────────
    /**
     * Stadsrutans BÅDA siffror (vald dag och hela veckan). Räknas ALLTID —
     * rutan står numera uppe hela tiden (Josef 10/8), oavsett om skyltarna är
     * på — och oberoende av pulsen; bara markeringen flyttar sig mellan dem.
     *
     * Geo-avgränsningen är KARTANS RUTA — samma `inMapView` som allt annat,
     * så siffran alltid betyder "det du ser". Utzoomad över Sverige ÄR vyn
     * Sverige och talen blir landets.
     *
     * Räknas ur RÅA `events`, inte ur dagens/veckans redan filtrerade listor:
     * veckolistan bär kartans render-tak kring kartans mitt, och den mitten är
     * under flygningen fortfarande förra staden — det fick siffran att blinka
     * "0 event" varje gång kameran lyfte.
     */
    const areaCounts = useMemo(() => {
        if (!mapBounds) return null;
        // Kartrutan hinner efter kameran vid ett stadsbyte (hoppet ligger
        // ~300 ms bakom stadsöverlägget och moveend är debouncat) — då beskriver
        // den fortfarande FÖRRA staden. Visa "…" tills rutan mätts under den
        // stad som står i rubriken. Zoom och panorering rör inte nyckeln, så
        // siffrorna får uppdatera sig fritt medan man utforskar.
        if (cityTourTarget && boundsCityKey !== cityTourTarget.key) return null;
        const start = new Date();
        start.setDate(start.getDate() + dayOffset);
        start.setHours(0, 0, 0, 0);
        const until = (days: number) => {
            const end = new Date(start);
            end.setDate(end.getDate() + (days - 1));
            end.setHours(23, 59, 59, 999);
            // Utan kategori-val räknas opt-in-källorna med — man ska se hur
            // mycket som faktiskt händer; med eget val speglas filtret.
            return events.filter(evt =>
                evt.time >= start && evt.time <= end
                && (selectedCategories.size === 0 || matchesFilter(evt))
                && inMapView(evt),
            );
        };
        return { day: until(1).length, week: until(7).length };
    }, [cityTourTarget, mapBounds, boundsCityKey, inMapView, dayOffset, events, selectedCategories, matchesFilter]);

    /**
     * Stadsnamnet i rutan FÖLJER KARTAN (Josef 10/8): närmsta ort ur den stora
     * söklistan (CITY_POINTS, ~290 orter), uppdaterat vid varje moveend — drar
     * man kartan till Söderhamn ska det stå Söderhamn. Utzoomad förbi stadsnivå
     * (eller inzoomad i ödemark) finns ingen ärlig stad — då står det
     * "Sverige". Mitt i ett stadshopp är MÅLET sanningen: kartmitten beskriver
     * då fortfarande förra staden.
     */
    const liveCityName = useMemo(() => {
        if (cityTourTarget && boundsCityKey !== cityTourTarget.key) return cityTourTarget.cityName;
        if (!mapCenter || mapZoom === null) return null;
        if (mapZoom < CITY_NAME_MIN_ZOOM) return 'Sverige';
        const city = nearestCityPoint(mapCenter.lat, mapCenter.lng);
        if (haversineKm(mapCenter.lat, mapCenter.lng, city.lat, city.lng) > CITY_NAME_MAX_KM) return 'Sverige';
        return city.name;
    }, [cityTourTarget, boundsCityKey, mapCenter, mapZoom]);

    // Kategorikolumnen till höger sammanfattar det man SER: dagens (+ sök-
    // filtrerade) event inom kartans ruta — FÖRE kategorifiltret, så en
    // urkryssad kategori fortfarande syns (urblekt) och går att kryssa i igen.
    const categoryPanelEvents = useMemo(
        () => searchFilteredEvents.filter(inMapView),
        [searchFilteredEvents, inMapView],
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
    // Rensa-krysset heter "Visa alla" — då måste det landa i STANDARDLÄGET, inte
    // i tom set: för en besökare (och för 65+) ingår opt-in-källorna i "allt",
    // och ett tomt set hade tvärtom SLÄCKT dem. Under 65 ⇒ tomt som förut.
    const handleClearCategories = useCallback(
        () => startTransition(() => setSelectedCategories(
            new Set(defaultSpecialCategories({ loggedIn: !!user, age: profileAgeRef.current })),
        )),
        [user],
    );

    // Byt visad dag/intervall — från dagväljaren eller återställningsknappen.
    // Ett medvetet dagval är att ta över rodret: stoppa bildspelet, annars
    // skulle nästa blink skriva över valet efter någon sekund.
    const handleDayRangeChange = useCallback((offset: number, days: number) => {
        if (tourPlayingRef.current) setTourPlaying(false);
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

    /**
     * Kartklick UNDER (eller precis efter) bildspelet. Klicket stoppar blinket
     * och vyn FRYSER PÅ DEN FAS SOM VISAS (Josef 9/8) — står det "Idag" blir det
     * idag, står det "Hela veckan" blir det veckan. Vi räknar alltså inte längre
     * om vyn efter det klickade eventets datum: brickan man petar på hör per
     * definition till den fas som just då ritas, så omräkningen kunde bara
     * flytta en till en vy man inte bett om.
     */
    const handleSelectEventFromMap = useCallback((evt: LinkEvent | null) => {
        selectEventSmooth(evt);
    }, [selectEventSmooth]);

    // Sök-, sparat- och profilpanelen delar plats under navbaren — en i taget.
    useEffect(() => {
        if (searchQuery.trim()) { setSavedPanelOpen(false); setProfilePanelOpen(false); }
    }, [searchQuery]);
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

    // ── Var bildspelet BÖRJAR ────────────────────────────────────────────────
    // Där användaren är, inte Stockholm (Josef 9/8). Ligger här nere för att
    // effekten behöver userPos; själva bildspelet bor långt ovanför.
    // Startar när kartan är igång (mapCenter satt) OCH vi antingen vet var
    // användaren är eller väntat klart på platstjänsten. Rundan fortsätter
    // sedan från staden närmast en själv.
    useEffect(() => {
        if (tourAutoStartedRef.current) return;
        if (!tourPlaying) return;                       // stoppad innan vi hann starta
        // Grinden: håll kvar Sverige-vyn tills välkomstrutan KLICKATS NER
        // (welcomeDone sätts vid stängning, eller direkt för inloggade) —
        // kartan glider långsamt inåt bakom rutan (introGlide i V2Map) så
        // besökaren ser eventmängden över hela landet. OBS: gata inte på
        // welcomeOpen/authLoading — de hann vara false i samma commit som
        // auth-svaret landade, och landningen kapade då touren bakom modalen.
        if (!welcomeDone) return;
        if (!mapCenter) return;                         // kartan inte klar än
        if (!userPos && !tourGpsWaitOver) return;       // ge platstjänsten en chans
        tourAutoStartedRef.current = true;
        if (userPos) {
            // ORTEN man är närmast (stora CITY_POINTS-listan) — inte den råa
            // GPS-punkten och inte närmsta storstad ur rundan. Samma regel som
            // skylt-knappen, så första besöket och en omstart landar likadant:
            // bor man i Hudiksvall ska rutan säga Hudiksvall.
            const city = nearestCityPoint(userPos.lat, userPos.lng);
            tourCityIndexRef.current = nearestTourCityIndex(city.lat, city.lng);
            flyToPoint(city.lat, city.lng, city.name);
        } else {
            // Blindstart: vi hann inte få svar från platstjänsten (rutan står
            // ofta kvar och väntar på ett tryck). Effekten nedan flyttar oss
            // hem så fort svaret kommer.
            tourStartedBlindRef.current = true;
            flyToCity(0);
        }
    }, [tourPlaying, mapCenter, userPos, tourGpsWaitOver, welcomeDone, flyToCity, flyToPoint]);

    // Efterhämtning: trycker man "Tillåt" i platsrutan EFTER att rundan redan
    // startat blint ska man flyttas hem direkt (Josef 9/8 — man blev kvar i
    // gissningsstaden). Bara om bildspelet fortfarande rullar orört: har man
    // själv rört kartan, valt en vägskylt eller tryckt play är staden ett eget
    // val och ska inte ryckas undan (de nollar flaggan).
    useEffect(() => {
        if (!userPos || !tourStartedBlindRef.current) return;
        if (!tourPlaying) { tourStartedBlindRef.current = false; return; }
        tourStartedBlindRef.current = false;
        // Samma orts-uppslag som auto-starten: hem = närmsta ORT, inte storstad.
        const city = nearestCityPoint(userPos.lat, userPos.lng);
        tourCityIndexRef.current = nearestTourCityIndex(city.lat, city.lng);
        flyToPoint(city.lat, city.lng, city.name);
        startCityPulse();                // staden får sin fulla tid från nu
    }, [userPos, tourPlaying, flyToPoint, startCityPulse]);

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

    // ── Återkomst från Stripe: /?boost_session=cs_… ─────────────────────────
    // Stripe skickar tillbaka webbläsaren hit efter betalningen. confirmBoost
    // hämtar sessionen från Stripe, kräver payment_status === 'paid' och sätter
    // featuredUntil — betalningen verifieras alltså i backend, aldrig här.
    // Parametern städas ur URL:en direkt (kvittot i backend gör en omladdning
    // ofarlig, men en ren adress är bättre att dela vidare).
    const pendingBoostSessionRef = useRef<string | null>(null);
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get('boost_session');
        if (!sessionId) return;
        pendingBoostSessionRef.current = sessionId;
        params.delete('boost_session');
        const qs = params.toString();
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }, []);
    useEffect(() => {
        const sessionId = pendingBoostSessionRef.current;
        if (!sessionId) return;
        // Vänta tills Firebase återställt sessionen — anropet kräver inloggning,
        // och `user` är null under restoren.
        if (authLoading || !user) return;
        pendingBoostSessionRef.current = null;
        const t = toast.loading('Aktiverar boosten…');
        confirmEventBoost(sessionId)
            .then(res => {
                toast.dismiss(t);
                if (res.applied) {
                    // Nivåns längd (1/7/30 dagar) ägs av backend och är okänd
                    // här efter redirecten — håll bekräftelsen generell.
                    toast.success('Boostat! Eventet lyfts fram på kartan. 🚀');
                } else if (res.alreadyApplied) {
                    toast.success('Boosten är redan aktiverad. 🚀');
                } else {
                    toast('Betalningen är inte klar än — boosten aktiveras så fort den går igenom.');
                }
            })
            .catch(err => {
                toast.dismiss(t);
                console.error(err);
                toast.error(err instanceof Error ? err.message : 'Kunde inte aktivera boosten.');
            });
    }, [user, authLoading]);

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
        // Landa där eventet ÄR — som ett skylt-hopp (samma kamerahopp OCH
        // reveal-ankare, annars står staden med bara nål-prickar). Rundan är
        // avstängd (?event= i auto-start-effekten), men pekas mot eventets
        // stad så play/skyltarna fortsätter rätt om man trycker.
        if (hasValidCoords(target)) {
            const city = nearestCityPoint(target.lat!, target.lng!);
            tourCityIndexRef.current = nearestTourCityIndex(city.lat, city.lng);
            flyToPoint(target.lat!, target.lng!, city.name);
        }
    }, [flyToPoint]);

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
        // Bildspelets blink är ingen användarhandling — skriv inte ?dagar=7 till
        // adressfältet vid varje blink. tourPlaying i deps gör att URL:en
        // skrivs ikapp i samma sekund bildspelet stoppas.
        if (tourPlayingRef.current) return;
        const params = new URLSearchParams();
        // Skriv INTE valt event till URL:en — då återöppnades det senast valda
        // eventet vid varje omladdning (oönskat). Delning av ett specifikt event
        // sker i stället explicit via Dela-knappen (bygger /?event=<id>), och den
        // inkommande ?event=-läsningen ovan öppnar det hos mottagaren.
        if (dayOffset !== 0) params.set('dag', String(dayOffset));
        if (dayRangeDays > 1) params.set('dagar', String(dayRangeDays));
        // Skriv INTE standardläget till adressen. Annars hade varje besökare
        // fått ?kategori=pro,svenskakyrkan i URL:en direkt vid ankomst, och
        // delade länkar burit med sig ett filter ingen valt — som dessutom
        // låser mottagarens hydrering (urlHadCategoriesRef vinner över profilen).
        const catsKey = [...selectedCategories].sort().join(',');
        if (selectedCategories.size > 0 && catsKey !== specialDefaultsKey({ loggedIn: false })) {
            params.set('kategori', [...selectedCategories].join(','));
        }
        const qs = params.toString();
        window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    }, [dayOffset, dayRangeDays, selectedCategories, tourPlaying]);

    // ── Sparade kategorifilter (inloggade) ──────────────────────────────────
    // Aktiverar man t.ex. Svenska kyrkan eller PRO ska valet överleva nästa
    // besök — annars "försvinner" de eventen varje gång (Sundsvall-tråden 6/8).
    // Hydrering: läs users/{uid}.mapCategories EN gång per konto, efter att en
    // ev. inkommande ?kategori=-länk applicerats (länken vinner och blir då
    // baslinje — den skriver INTE över det sparade förrän man själv ändrar).
    //
    // PROFILSTYRT STANDARDLÄGE (bara när mapCategories aldrig sparats):
    // 65+ (age) ⇒ PRO på (annars opt-in). Manual vinner alltid — samma
    // princip som citySource: att mapCategories FINNS (även som tom array =
    // aktivt "visa alla") betyder att användaren rört filtret, och då rör
    // automatiken det aldrig igen. Defaulterna blir därför BASLINJE utan att
    // sparas: först när användaren själv togglar något skiljer sig valet från
    // baslinjen och spar-effekten nedan skriver det som ett manuellt val.
    // Profiländringar (man fyller 65) slår alltså igenom vid nästa besök —
    // tills man rört filtret själv.
    //
    // FAMILJ & BARN styrs INTE via kategorivalet utan via opt-in-LÄGET
    // (familyOptIn ovan): vuxen utan barn ⇒ kategorin göms tills 🧸 kryssas i;
    // förälder/ung/utloggad ⇒ kategorin syns som vanligt utan att vara "vald".
    // (Gamla modellen förvalde 'family' för föräldrar — det gömde alla ANDRA
    // kategorier, eftersom ett icke-tomt normal-val betyder "visa bara dessa".)
    useEffect(() => {
        if (!user || !eventsLoaded || catPrefsUid === user.uid) return;
        let cancelled = false;
        (async () => {
            let baseline = [...selectedCategories].sort().join(',');
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                const data = snap.exists()
                    ? snap.data() as { mapCategories?: unknown; hasChildren?: unknown; age?: unknown }
                    : null;
                // Opt-in-läget följer alltid profilen — även när en inkommande
                // ?kategori=-länk vinner över det sparade kategorivalet.
                if (!cancelled) setFamilyOptIn(familyIsOptIn(data));
                profileAgeRef.current = data?.age;
                if (!urlHadCategoriesRef.current) {
                    if (Array.isArray(data?.mapCategories)) {
                        const valid = data.mapCategories.filter((k): k is string =>
                            typeof k === 'string' && (k in EVENT_CATEGORIES || SPECIAL_CATEGORY_KEYS.has(k)));
                        baseline = [...valid].sort().join(',');
                        // Sätts ÄVEN när listan är tom: staten startar i
                        // BESÖKARLÄGET (opt-in-källorna på), och ett sparat
                        // aktivt "visa alla" måste kunna släcka dem igen.
                        if (!cancelled) setSelectedCategories(new Set(valid));
                    } else {
                        // Aldrig rört filtret → profilens standardläge:
                        // 65+ ⇒ Svenska kyrkan + PRO på, annars opt-in som förut
                        // (utils/categoryDefaults). Sätts ovillkorligt av samma
                        // skäl som ovan — en 40-åring ska INTE ärva besökarens
                        // förvalda källor bara för att defaulten är tom.
                        const defaults = defaultSpecialCategories({ loggedIn: true, age: data?.age });
                        baseline = [...defaults].sort().join(',');
                        if (!cancelled) setSelectedCategories(new Set(defaults));
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

    // Utloggning ⇒ tillbaka till BESÖKARLÄGET: familj-opt-in nollas (besökare
    // ska alltid se familjeeventen) och opt-in-källorna slås på igen. Körs även
    // vid mount medan Firebase återställer sessionen — då är läget redan
    // besökarens, så det är en no-op. catPrefsUid nollas så att en ny
    // inloggning hydrerar om profilens standardläge i stället för att ärva
    // besökarens källor.
    useEffect(() => {
        if (user) return;
        setFamilyOptIn(false);
        setSelectedCategories(new Set(defaultSpecialCategories({ loggedIn: false })));
        setCatPrefsUid(null);
        lastSavedCatsRef.current = null;
        profileAgeRef.current = undefined;
    }, [user]);

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
        // Landar aggregaten mitt i bildspelets vecko-fas är dayRangeDays 7 just
        // då — vänta på nästa blink (dag-fasen) i stället för att bränna det
        // enda beslutstillfället på ett läge som inte är användarens.
        if (tourPlayingRef.current && dayRangeDays !== 1) return;
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
    const handleMapCenterChange = useCallback((
        lat: number,
        lng: number,
        zoom?: number,
        bounds?: { west: number; south: number; east: number; north: number },
    ) => {
        setMapCenter({ lat, lng });
        if (typeof zoom === 'number') setMapZoom(zoom);
        if (bounds) setMapBounds(bounds);
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
            {/* Blå pill i hörnet — större/tydligare CTA (användaren ville synas
                mer) med ett glest ljussvep (.city-cta, se globals.css). Lika hög
                som dagväljar-chippen (h-10, ägarbeslut 2026-07-12 — sajtens enda
                stad-för-stad-länk, en navbar-dubblett provades och togs bort).
                Täcker fortfarande attributions-i:et: den är nu större än förut,
                så spannet från hörnet växer bara → i:et förblir dolt. */}
            {/* ── KARTKROMET LIGGER NERE MEDAN VÄLKOMSTRUTAN ÄR UPPE ──────────
                Josef 13/8: "vi behöver inte ha några knappar eller något över
                kartan förrän welcome-modalen försvinner". Bakom rutan ska det
                bara vara karta och prickar — resan genom Sverige är budskapet,
                och varje knapp drar bort blicken från den. Allt monteras när
                rutan stängs (och deras egna fade-in-animationer spelar då upp,
                så kromet tonar in i stället för att smälla fram). */}
            {!chromeHidden && (
            <a
                href="/evenemang"
                className="city-cta gold-glow-pulse absolute bottom-3 right-3 z-[40] overflow-hidden rounded-full bg-gradient-to-r from-[#006AA7] via-[#005590] to-[#003C66] border-2 border-[#FECC02] px-4 h-10 flex items-center gap-2 text-xs font-black text-white shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 backdrop-blur-md group"
            >
                <Building2 size={16} className="text-[#FECC02] shrink-0 group-hover:rotate-6 transition-transform duration-200" />
                <span>Evenemang stad för stad</span>
            </a>
            )}

            {/* 1. Svävande transparent Navbar överst */}
            {!chromeHidden && (
            <FloatingNavbar
                creationMode={creationMode}
                createEventEnabled={shopFlags.createEvent}
                onStartCreate={() => setCreationMode('placing')}
                onConfirmPlacement={openCreateFormHere}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                closeSearchNonce={closeSearchNonce}
                onLoginClick={() => openLogin()}
                onOpenProfile={handleToggleProfile}
                plusHint={plusHint}
            />
            )}

            {/* 1b. Kategorikolumnen till höger — ÖPPEN som default och visar
                bara kategorier som syns i KARTANS RUTA, med antal per kategori
                (ersätter emoji-raden under stadsrutan, Josef 10/8). Filtrerar
                kartan + kortleken; lager-knappen gömmer kolumnen. */}
            {!chromeHidden && (
            <CategoryFilter
                events={categoryPanelEvents}
                selected={selectedCategories}
                onToggle={handleToggleCategory}
                onClear={handleClearCategories}
                familyOptIn={familyOptIn}
            />
            )}

            {/* 1b1. Stadsrutan — står ALLTID uppe (Josef 10/8): den stängs inte
                längre av när man rör kartan, och den ÄGER hela dag-
                navigeringen sedan navbarens dagchip togs bort.
                NAMNET FÖLJER KARTAN: närmsta ort ur stora söklistan
                (liveCityName; "Sverige" utzoomat/i ödemark) — drar man kartan
                byts namnet på plats vid varje moveend.
                TVÅ RADER (Josef 9/8): "Idag" och "Hela veckan" står alltid kvar
                med var sitt antal ur kartans ruta — bara markeringen flyttar
                sig mellan dem. Etiketten längst åt VÄNSTER och antalet längst
                åt HÖGER på sin rad (som en kvittorad).
                HELA RUTAN ÄR EN KNAPP (Josef 10/8): ett klick växlar mellan
                vald dag och hela veckan.
                DAGPILARNA är HELA SIDOKOLUMNER på plattan (Josef 21/8: de
                gamla 32px-cirklarna var för svåra att träffa på mobil) och
                stegar en dag fram/tillbaka.
                Bakåtpilen finns bara när det FINNS en dag att gå tillbaka till
                (idag är botten). KALENDERKNAPPEN sitter i plattans övre
                vänstra hörn och hoppar ut till VÄNSTER OM rutan när
                bakåtpilen finns — fast bara från sm:, på mobil krockar det
                hörnet med navbarens vänsterkolumn (Josef 21/8, se 2b) — och
                öppnar månadskalendern direkt för ett specifikt datum. Knapparna ligger absolut placerade OVANPÅ
                rutknappen i stället för inuti den: en <button> i en <button>
                är ogiltig HTML. px-9 på plattan ger dem plats utan att rutan
                (168 px innehåll + padding) växer förbi den smalaste mobilvyn
                innanför px-16-marginalerna.
                Mörk platta i stället för bara text: kartan är ljus och vit
                skugg-text blir gröt över ljusa kvarter. px-16 håller rutan fri
                från knappkolumnerna i hörnen.
                key på HOPP-nyckeln → rutan tonar in på nytt vid stadshopp
                (vägskylt/sök/skyltknappen) men inte vid egen panorering — då
                byts bara namnet. */}
{!chromeHidden && liveCityName && (
    <div className="fixed inset-x-0 top-6 z-[1090] flex justify-center px-16 pointer-events-none">
        <div key={cityTourTarget?.key ?? 0} className="relative animate-in fade-in slide-in-from-top-2 duration-500">
            {/* Bara spans inuti knappen — <p>/<div> är ogiltigt innehåll i en
                <button> och bryter både validering och en del skärmläsare. */}
            <button
                type="button"
                onClick={handleToggleTourRange}
                aria-label={dayRangeDays >= WEEK_RANGE_MIN_DAYS
                    ? `Visa bara ${getDayLabel(dayOffset, 1).toLowerCase()} i ${liveCityName}`
                    : tourRangeToggleLocked
                        ? `Zooma in för att visa hela veckan i ${liveCityName}`
                        : `Visa hela veckan i ${liveCityName}`}
                aria-disabled={tourRangeToggleLocked || undefined}
                title={tourRangeToggleLocked
                    ? 'Zooma in för att kunna visa hela veckan'
                    : 'Växla mellan dagen och hela veckan'}
                className="pointer-events-auto flex flex-col items-center gap-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-900/90 backdrop-blur-md px-9 py-3 shadow-2xl border border-white/10 transition-colors active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-[#FECC02]/70"
            >
                {/* 1. Stadsnamn högst upp — följer kartan (liveCityName).
                       sm:leading-none MÅSTE upprepas: sm:text-2xl sätter om
                       line-height till 32px i breakpointen och vinner annars
                       över bara leading-none — då glider raderna under ner
                       8 px på desktop och plattan växer i onödan. (Dagpilarna
                       är sedan 21/8 fulla sidokolumner och bryr sig inte om
                       radhöjden.) */}
                <span className="block first-letter:uppercase text-xl sm:text-2xl font-black tracking-tight text-white leading-none sm:leading-none">
                    {liveCityName}
                </span>

                {/* 2. En rad per period: ord till vänster, antal till höger.
                       Fast bredd så siffran alltid står i samma högerkant —
                       annars vandrar den i sidled när "9" blir "128".
                       RADERNA ÄR RITADE SOM EN VÄXELREGLAGE-KONTROLL (Josef
                       13/8: "det ska vara tydligt att man klickar på rutan för
                       att växla"): en infälld spårplatta med två segment, det
                       valda som fylld gul platta med mörk text. Bara färgad
                       text räckte inte — det lästes som en informationsruta,
                       inte som något man kan trycka på. Hjälpraden under
                       säger det rakt ut för den som ändå tvekar. */}
                <span className="flex w-[168px] flex-col gap-0.5 rounded-xl bg-white/[0.07] p-0.5 ring-1 ring-inset ring-white/10">
                    {([
                        { label: getDayLabel(dayOffset, 1), days: 1, count: areaCounts?.day },
                        { label: 'Hela veckan', days: 7, count: areaCounts?.week },
                    ] as const).map(row => {
                        const active = row.days >= WEEK_RANGE_MIN_DAYS
                            ? dayRangeDays >= WEEK_RANGE_MIN_DAYS
                            : dayRangeDays < WEEK_RANGE_MIN_DAYS;
                        return (
                            <span
                                key={row.days}
                                className={`flex items-center justify-between gap-2 rounded-[10px] px-2 py-1.5 transition-colors duration-300 ${
                                    active ? 'bg-[#FECC02] shadow-sm' : ''
                                }`}
                            >
                                <span
                                    className={`whitespace-nowrap text-[11px] font-black uppercase tracking-[0.12em] leading-none transition-colors duration-300 ${active ? 'text-slate-900' : 'text-white/45'}`}
                                >
                                    {row.label}
                                </span>
                                <span
                                    className={`shrink-0 tabular-nums text-base font-extrabold leading-none transition-colors duration-300 ${active ? 'text-slate-900' : 'text-white/55'}`}
                                >
                                    {eventsLoaded && dayCountReady && typeof row.count === 'number' ? row.count : '…'}
                                </span>
                            </span>
                        );
                    })}
                </span>

                {/* 3. Tryckhänvisningen. Liten och lugn, men uttalad — den är
                       enda stället som säger att rutan är en växel.
                       LOVA INTE EN VÄXEL SOM INTE FINNS (Josef 14/8): veckan är
                       zoom-gatad (weekUnlocked), och utzoomad gör klicket
                       ingenting — då säger raden i stället vad man ska göra för
                       att få växeln, alltså zooma in. Står man redan på veckan
                       går det alltid att gå tillbaka till dagen, så då är det
                       bara vägen TILL veckan som kan vara låst. */}
                <span className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.14em] text-white/45">
                    {tourRangeToggleLocked ? (
                        <>
                            <ZoomIn size={11} strokeWidth={3} className="shrink-0" />
                            Zooma in för att växla
                        </>
                    ) : (
                        <>
                            <ArrowLeftRight size={11} strokeWidth={3} className="shrink-0" />
                            Tryck för att växla
                        </>
                    )}
                </span>
            </button>

            {/* 2c. DAGPILARNA — HELA SIDOKOLUMNER (Josef 21/8: 32px-cirklarna
                   var för svåra att träffa på mobil), spegelvända och lika
                   höga. Bakåtpilen äger HELA sin kolumn från sm: —
                   kalenderknappen hoppar ut ur vägen när pilen finns; på
                   mobil ligger den kvar ovanpå pilens topp (se 2b, sist i
                   DOM = tar tappen i sitt hörn). De gamla
                   uppmätta top-värdena (18/8) behövs inte längre. Syskon till
                   rutknappen (inte barn) — nästlade knappar är ogiltig HTML.
                   Bakåtpilen bara när det finns en dag kvar bakåt (idag är
                   botten). */}
            {dayOffset > 0 && (
                <button
                    type="button"
                    onClick={() => handleTourDayStep(-1)}
                    aria-label={`Visa ${getDayLabel(dayOffset - 1, 1).toLowerCase()}`}
                    title={getDayLabel(dayOffset - 1, 1)}
                    className="pointer-events-auto absolute left-0.5 inset-y-0.5 flex w-8 items-center justify-center rounded-[14px] bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[#FECC02]/70"
                >
                    <ChevronLeft size={18} strokeWidth={2.5} />
                </button>
            )}
            <button
                type="button"
                onClick={() => handleTourDayStep(1)}
                aria-label={`Visa ${getDayLabel(dayOffset + 1, 1).toLowerCase()}`}
                title={getDayLabel(dayOffset + 1, 1)}
                className="pointer-events-auto absolute right-0.5 inset-y-0.5 flex w-8 items-center justify-center rounded-[14px] bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-colors active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-[#FECC02]/70"
            >
                <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            {/* 2b. KALENDERKNAPPEN — i plattans övre vänstra HÖRN (top-0.5)
                   när man står på idag; när bakåtpilen finns (dayOffset > 0)
                   HOPPAR den direkt (ingen animation, Josef 21/8) ut till
                   vänster UTANFÖR rutan — MEN BARA FRÅN sm: (sm:-left-9).
                   PÅ MOBIL LIGGER DEN KVAR I HÖRNET OVANPÅ PILEN: navbarens
                   vänsterkolumn (profil/hjärta/plus, top-6 z-[1160]) står i
                   samma hörn ÖVER stadsrutans lager, och luckan mellan den och
                   plattan är bara några px — utflyttad hamnade kalendern under
                   profilknappen och gick inte att trycka på (buggen 21/8).
                   UTANFÖR plattan (sm+) får den en egen mörk platta (slate +
                   ring + blur) — white/15 försvinner mot den ljusa kartan.
                   GULDCIRKEL = pickern är ÖPPEN (samma guld som
                   växelreglaget), i alla positioner.
                   Syskon till rutknappen (inte barn) — nästlade knappar är
                   ogiltig HTML.
                   DATE-FÄLTET ÄR TRYCKYTAN (Josef 21/8): osynligt OVANPÅ
                   ikonen, för iOS öppnar kalendern bara vid en äkta tapp på
                   själva fältet (se openMonthCalendar). Fältet är också det
                   fokuserbara elementet — ikonen under är ren dekor och får
                   hover/fokus-ringen via peer. VÄRDET följer vald dag så
                   kalendern markerar rätt dag och "idag" går att välja när man
                   pilat fram (samma värde ger annars ingen change-händelse).
                   TOGGLE: medan pickern är öppen (calendarPickerOpen) byter
                   fältet och ikonen roller — fältet släpper pointer-events och
                   ikonen blir stäng-knapp (se kommentaren vid
                   calendarPickerOpen). */}
            <input
                ref={calendarInputRef}
                type="date"
                aria-label="Välj datum i kalendern"
                title="Välj datum"
                min={toInputDate(new Date())}
                value={calendarValue}
                onClick={openMonthCalendar}
                onBlur={() => setCalendarPickerOpen(false)}
                onChange={e => handleCalendarPick(e.target.value)}
                className={`peer absolute top-0.5 h-8 w-8 cursor-pointer opacity-0 ${dayOffset > 0 ? 'left-0.5 sm:-left-9' : 'left-0.5'} ${calendarPickerOpen ? 'pointer-events-none' : 'pointer-events-auto'}`}
            />
            <span
                aria-hidden="true"
                onClick={closeMonthCalendar}
                className={`absolute top-0.5 flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#FECC02]/70 ${dayOffset > 0 ? 'left-0.5 sm:-left-9' : 'left-0.5'} ${calendarPickerOpen
                    ? 'pointer-events-auto cursor-pointer bg-[#FECC02] text-slate-900 active:scale-95'
                    : dayOffset > 0
                        ? 'pointer-events-none bg-white/15 text-white/90 peer-hover:bg-white/25 peer-hover:text-white peer-active:scale-95 sm:bg-slate-900/80 sm:text-white/85 sm:ring-1 sm:ring-white/10 sm:backdrop-blur-md sm:peer-hover:bg-slate-900/95 sm:peer-hover:text-white'
                        : 'pointer-events-none bg-white/15 text-white/90 peer-hover:bg-white/25 peer-hover:text-white peer-active:scale-95'}`}
            >
                <CalendarDays size={16} strokeWidth={2.5} />
            </span>

            {/* (Emoji-raden som låg här under rutan är BORTTAGEN 10/8 — dess
                jobb görs av kategorikolumnen till höger, som visar antal per
                kategori i vyn och dessutom filtrerar på riktigt.) */}
        </div>
    </div>
)}

            {/* 1b2. Senaste kommentaren på sajten — bubbla under navbaren.
                Klick hoppar till kommentarens event (samma väg som sök/sparat).
                Ligger nere medan välkomstrutan är uppe, som allt annat krom. */}
            {!chromeHidden && <LatestCommentBubble events={events} onPick={jumpToEvent} />}

            {/* 1c. Sökträffar: STÄDER överst (klick flyger dit) och därunder
                event ur alla kommande dagar (klick hoppar till eventets dag). */}
            <SearchResults
                query={searchQuery}
                results={visibleEvents}
                onPick={jumpToEvent}
                cities={cityHits}
                onPickCity={handlePickSearchCity}
            />

            {/* 1d. Sparade event — öppnas från profilpanelens Sparade-rad */}
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
                allEvents={events}
                onPickEvent={jumpToEvent}
                onDeleteEvent={handleDeleteOwnEvent}
                savedCount={activeSavedCount}
                onOpenSaved={() => { setProfilePanelOpen(false); setSavedPanelOpen(true); }}
            />

            {/* 2. Fullskärmskarta underst */}
            <V2MapDynamic
                events={visibleEvents}
                selectedEvent={selectedEvent}
                onSelectEvent={handleSelectEventFromMap}
                savedEventIds={savedEventIds}
                discardedEventIds={discardedEventIds}
                cardExpanded={cardExpanded}
                onCenterChange={handleMapCenterChange}
                eventsLoaded={eventsLoaded}
                eventsSettled={eventsSettled}
                // Första prick-rundan målad → släpp cards/descriptions-hämtningen
                // (de ska inte konkurrera med tiles + prickar om bandbredden).
                onFirstPaint={linkEventService.releaseHeavyLayers}
                // Prickarna utritade → tom-läget får äntligen uttala sig.
                onPaintedChange={setMapPainted}
                zoomToEventTrigger={zoomToEventTrigger}
                zoomOutTrigger={zoomOutTrigger}
                daySwitchNonce={daySwitchNonce}
                navSelectNonce={navSelectNonce}
                onFeatureFlagsChange={handleFeatureFlagsChange}
                onActivateMultiplayer={handleActivateMultiplayer}
                onFuncBagOpenChange={setFuncBagOpen}
                onGroupListOpenChange={setGroupListOpen}
                // Vägskyltarna mot närmaste städer — så byter man stad numera
                // (Josef 9/8). De renderas inuti kartan för att kunna sitta
                // fast i marken; sidan skickar bara ner städerna och hoppet.
                signpostCities={TOUR_CITIES}
                onPickSignpost={handlePickSignpostCity}
                // SKYLTARNA ÄR SLÄCKTA (Josef 14/8). Skylt-knappen i navbaren är
                // borttagen — skapa-knappen tog dess plats — och utan den finns
                // ingen väg att tända dem. Kopplingen (städerna + hoppet) ligger
                // kvar så en ny knapp bara behöver sätta det här till sitt gamla
                // villkor: !signsOn || !tourPlaying || chromeHidden || okänd/för
                // låg zoom (< SIGNPOST_MIN_ZOOM) || creationMode !== 'idle' ||
                // cardExpanded || groupListOpen || savedPanelOpen ||
                // profilePanelOpen || funcBagOpen || pågående sökning.
                signpostsHidden
                // Bart DUBBELklick/-tapp på kartan (inte bricka, inte dragning):
                // växlar — om varken ett eventkort eller multi-event-listan är
                // uppe — vyn mellan vald dag och hela veckan (Josef 9/8; krav på
                // dubbelklick 18/8 — enkelklicket växlade av misstag vid varje
                // inzoomat kartklick). Ligger inget i vägen är kartan i sig
                // växeln. Veckovyn kräver att man är tillräckligt inzoomad
                // (zoom-vakten stänger annars av den direkt), så utzoomad gör
                // klicket ingenting.
                // (Skylt-togglingen som också låg här är borttagen 10/8 —
                // skyltarna följer bildspelet, se signpostsHidden ovan.)
                onMapTap={() => {
                    if (selectedEvent || selectedWish || groupListOpen) return;
                    const toWeek = dayRangeDays < WEEK_RANGE_MIN_DAYS;
                    if (toWeek && !weekUnlocked) return;
                    handleDayRangeChange(dayOffset, toWeek ? 7 : 1);
                }}
                onUserPosChange={setUserPos}
                starredEventIds={starredEventIds}
                wishes={wishes}
                onSelectWish={handleSelectWish}
                wishCardOpen={!!selectedWish}
                cityTourTarget={cityTourTarget}
                // Långsam resa söder→norr på samma höjd medan välkomstrutan är
                // uppe — landningen hålls av gaten i tour-starten så hela
                // landets eventmängd hinner ses. Kameran äger sig själv under
                // resan (ingen GPS-punkt inblandad); false så fort rutan stängts
                // (eller vid ?plats-djuplänk, som äger kameran) → resan avbryts
                // och stadshoppet tar över.
                introGlide={introMapMode}
                onUserInteraction={handleMapUserInteraction}
            />



            {/* Modal för att skapa ELLER önska event — skriver till Firestore
                (kräver konto). Göms under "Ändra plats"-varvet (repicking) så
                kartan går att panorera; formulär-staten lever kvar. */}
            {creationMode === 'editing' && pickedLocation && !repicking && (
                <div
                    // z-[1300] = modal-lagret (AuthModal, grupplistan) — måste
                    // ligga över eventkortet som numera är z-[1250].
                    className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                    // Klick på bakgrunden stänger modalen (samma städning som
                    // Avbryt/Escape). Bara träffar PÅ överlägget självt räknas —
                    // klick inuti dialogen bubblar hit men filtreras bort här.
                    onMouseDown={(e) => { if (e.target === e.currentTarget) resetCreateFlow(); }}
                >
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
                                {newEventRole === 'host' && (
                                    <p className="text-xs text-slate-500">
                                        Ditt event får en egen bricka på kartan och syns direkt
                                        för alla som tittar här — gratis synlighet för det du
                                        ordnar, med dig som arrangör.
                                    </p>
                                )}
                                {newEventRole === 'tip' && (
                                    <p className="text-xs text-slate-500">
                                        Tipsa om ett event som redan finns — du står inte som
                                        arrangör. Kräver inget konto, och länk behövs bara om
                                        det finns en sida att peka på.
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
                        {/* Tips: länken till källan (VALFRI — de flesta tips som kommer
                            in har ingen sida att peka på) + arrangörens namn (valfritt;
                            annars visas länkens domän, eller "Okänd arrangör"). */}
                        {createKind === 'event' && newEventRole === 'tip' && (
                            <>
                                <input
                                    type="url"
                                    value={newEventUrl}
                                    onChange={e => setNewEventUrl(e.target.value)}
                                    placeholder="Länk till eventet (valfritt)"
                                    aria-label="Länk till eventet (valfritt)"
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
                        {/* Veckovis serie. Veckodag och klockslag ärvs från "När?",
                            så rutan visas först när en tid är vald — annars går det
                            inte att säga vilken dag den återkommer. */}
                        {createKind === 'event' && newEventTime && (
                            <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={newEventRepeatWeekly}
                                    onChange={e => setNewEventRepeatWeekly(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 accent-green-600 shrink-0"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-slate-800">
                                        Återkommer varje vecka
                                    </span>
                                    <span className="block text-xs font-normal text-slate-500">
                                        {weeklyLabelFor(newEventTime)} — t.ex. pubquiz eller
                                        träningstider. Ändrar du tiden senare gäller det alla
                                        kommande gånger.
                                    </span>
                                    {/* Hur länge serien pågår. Tills vidare är förval —
                                        det är beteendet serier alltid haft. Väljs ett antal
                                        slutar serien efter sista tillfället och försvinner
                                        då från kartan av sig själv. */}
                                    {newEventRepeatWeekly && (
                                        <span className="mt-2 flex items-center gap-2 text-xs font-normal text-slate-600" onClick={e => e.preventDefault()}>
                                            Hur länge?
                                            <select
                                                value={newEventRepeatWeeks ?? ''}
                                                onChange={e => setNewEventRepeatWeeks(e.target.value ? Number(e.target.value) : null)}
                                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-green-500 focus:outline-none"
                                            >
                                                <option value="">Tills vidare</option>
                                                <option value="2">2 veckor</option>
                                                <option value="4">4 veckor</option>
                                                <option value="6">6 veckor</option>
                                                <option value="8">8 veckor</option>
                                                <option value="12">12 veckor</option>
                                            </select>
                                        </span>
                                    )}
                                </span>
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
                            rows={5}
                            // Höjden: shrink-0 + min-h hindrar att flex-kolumnen
                            // (modalen är max-h-[90vh] överflödesrullad) klämmer
                            // ihop rutan på mobil. field-sizing:content låter den
                            // växa med texten i webbläsare som stödjer det —
                            // taket är max-h, och resize-y funkar som reserv.
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 leading-relaxed focus:border-green-500 focus:outline-none resize-y shrink-0 min-h-[9.5rem] max-h-[50vh] [field-sizing:content]"
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
                        {/* Tips går utan konto — då är detta en lugnande upplysning
                            i stället för en spärr, och tonas ner därefter. */}
                        {!user && (
                            createKind === 'event' && newEventRole === 'tip' ? (
                                <p className="text-xs font-semibold text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                                    Du behöver inget konto för att tipsa. 💡
                                </p>
                            ) : (
                                <p className="text-xs font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                                    {createKind === 'wish'
                                        ? 'Du behöver logga in för att önska — det fixar vi i nästa steg.'
                                        : 'Du behöver logga in för att skapa eventet — det fixar vi i nästa steg.'}
                                </p>
                            )
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
                                    // Länken är valfri för tips — men är fältet ifyllt
                                    // med något otolkbart ska man rätta det först.
                                    || (createKind === 'event' && newEventRole === 'tip'
                                        && !!newEventUrl.trim() && !normalizeTipUrl(newEventUrl))
                                    || creatingEvent}
                                onClick={createKind === 'wish' ? handleCreateWish : handleCreateEvent}
                                className={`px-5 py-2 rounded-full text-white font-bold disabled:opacity-40 transition-colors ${createKind === 'wish' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-green-600 hover:bg-green-500'}`}
                            >
                                {/* Tips kräver inget konto → aldrig "Logga in &"-varianten
                                    där. Önska och arrangera gör det fortfarande. */}
                                {creatingEvent
                                    ? (createKind === 'wish' ? 'Önskar…' : 'Skapar…')
                                    : createKind === 'event' && newEventRole === 'tip'
                                    ? 'Tipsa 💡'
                                    : user
                                    ? (createKind === 'wish' ? 'Önska ✨' : 'Skapa')
                                    : (createKind === 'wish' ? 'Logga in & önska' : 'Logga in & skapa')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tomt här: noll event inom 2,5 mil från det man tittar på. Frågan
                ställs bara i det läget — se nearbyIsEmpty. Sitter ovanför
                navbaren så den inte skymmer kartan man just letade i. */}
            {nearbyIsEmpty && (
                <div className="fixed inset-x-0 bottom-24 z-[1150] flex justify-center px-4 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-white/50 px-4 py-3 max-w-md">
                        <span className="text-2xl" aria-hidden>{canOfferWeek ? '📅' : '🤷'}</span>
                        <div className="min-w-0">
                            {/* Finns det event i närheten senare i veckan är det svaret
                                — inte en tiggarfråga om tips. Först när veckan OCKSÅ
                                är tom är platsen faktiskt otäckt, och då är tipset
                                det enda vettiga att be om. */}
                            {canOfferWeek ? (
                                <>
                                    <p className="text-sm font-bold text-slate-800">
                                        Inget här {promptDayLabel} — men {nearbyThisWeekCount} i veckan.
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Kartan visar en dag i taget. Vidga till hela veckan
                                        så syns de direkt.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-sm font-bold text-slate-800">
                                        Inget här {promptDayLabel}.
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Vet du något som händer? Tipsa — det tar en halvminut
                                        och kräver inget konto.
                                    </p>
                                </>
                            )}
                        </div>
                        {canOfferWeek ? (
                            <button
                                type="button"
                                onClick={() => handleDayRangeChange(0, 7)}
                                className="shrink-0 px-4 py-2 rounded-full bg-[#006AA7] text-white text-sm font-bold hover:bg-[#00589a] transition-colors"
                            >
                                Visa veckan
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={startTipHere}
                                className="shrink-0 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-bold hover:bg-green-500 transition-colors"
                            >
                                Tipsa 💡
                            </button>
                        )}
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

            {/* Onboarding — auto-öppnas vid sidladdning för UTLOGGADE (gaten
                ligger vid welcomeAutoShownRef ovan); inloggade slipper den.
                Kan alltid öppnas igen från info-knappen nere till vänster. */}
            {welcomeOpen && (
                <WelcomeOverlay
                    onCreateAccount={() => openLogin('Skapa ett gratis konto — spara event och skapa egna')}
                    todayEventCount={todayEventCount}
                    weekEventCount={weekEventCount}
                    soonEventCount={soonEventCount}
                    onClose={() => { setWelcomeOpen(false); setWelcomeDone(true); setActionIntroPending(true); }}
                />
            )}

            {/* STEG 2: de tre sakerna man själv kan göra. Egen liten ruta efter
                välkomstrutan (Josef 14/8) — inte fler punkter inuti den, den var
                redan full. Kommer först när stadshoppet landat, och sitter LÅGT:
                staden man hamnat i ska synas med sina event ovanför rutan.
                Duken är därför en svag gradient underifrån i stället för en
                heltäckande skugga — den får inte släcka kartan den just visat.
                Klick UTANFÖR = "jag fattar" → rutan flyger upp mot det gröna
                plusset, som samtidigt blinkar till. Det är hela poängen med
                steget: man ska veta VAR de finns sen. */}
            {actionIntroOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Vad vill du göra?"
                    /* Under hem-flygningen tar rutan inte längre emot klick:
                       valde man en åtgärd ligger formuläret redan bakom, och
                       duken hade svalt de första klicken i det. */
                    className={`fixed inset-0 z-[1500] flex items-end justify-center p-4 pb-[76px] ${
                        actionIntroFlyingHome ? 'pointer-events-none' : ''
                    }`}
                >
                    <div
                        className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent animate-in fade-in duration-300"
                        onClick={dismissActionIntro}
                    />
                    <div className={`action-intro-card relative w-full max-w-[340px] rounded-[26px] bg-white p-5 shadow-2xl ${
                        actionIntroFlyingHome ? 'action-intro-out' : ''
                    }`}>
                        <p className="text-center text-[17px] font-black text-slate-900">Du kan fylla på kartan</p>
                        <p className="mt-1 mb-4 text-center text-[12.5px] font-semibold leading-snug text-slate-500">
                            Saknas något? Lägg in det själv — det tar en halv minut.
                        </p>

                        <div className="flex flex-col gap-2">
                            {[
                                {
                                    key: 'tip' as const,
                                    emoji: '📣',
                                    title: 'Tipsa om ett event',
                                    hint: 'Något du sett — inget konto behövs',
                                    locked: false,
                                    onPick: () => { setCreateKind('event'); setNewEventRole('tip'); },
                                },
                                {
                                    key: 'wish' as const,
                                    emoji: '✨',
                                    title: 'Önska ett event',
                                    hint: 'Något du vill skulle hända här',
                                    locked: true,
                                    onPick: () => { setCreateKind('wish'); setNewEventRole('tip'); },
                                },
                                {
                                    key: 'host' as const,
                                    emoji: '📅',
                                    title: 'Skapa eget event',
                                    hint: 'Du är arrangören',
                                    locked: true,
                                    onPick: () => { setCreateKind('event'); setNewEventRole('host'); },
                                },
                            ].map(action => (
                                <button
                                    key={action.key}
                                    type="button"
                                    onClick={() => {
                                        action.onPick();
                                        // Rakt in i RÄTT formulär, på kartans mitt —
                                        // inte bara stänga och lämna en i
                                        // placeringsläget (Josef 14/8). Platsen går
                                        // att flytta i efterhand via "Ändra plats".
                                        dismissActionIntro();
                                        openCreateFormHere();
                                    }}
                                    className="group flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-3 py-2.5 text-left transition-all hover:border-[#006AA7] hover:shadow-md active:scale-[0.98] outline-none focus-visible:ring-4 focus-visible:ring-[#006AA7]/40"
                                >
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-[20px] transition-transform group-hover:scale-110">
                                        {action.emoji}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className="text-[14px] font-extrabold text-slate-900">{action.title}</span>
                                            {/* Kräver konto = ett litet grått lås, inget mer.
                                                De färgade "KONTO"-brickorna gjorde raderna
                                                rosa och blå utan att säga mer (Josef 14/8). */}
                                            {action.locked && (
                                                <Lock size={12} className="shrink-0 text-slate-400" aria-label="Kräver konto" />
                                            )}
                                        </span>
                                        <span className="block truncate text-[11.5px] font-semibold text-slate-500">{action.hint}</span>
                                    </span>
                                    <ChevronRight size={16} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-400" />
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={dismissActionIntro}
                            className="mt-3 w-full rounded-xl py-2 text-[12.5px] font-bold text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                        >
                            Bara titta först
                        </button>
                    </div>
                </div>
            )}

            {/* Info-knappen — öppnar onboarding-rutan när man själv vill ha den.
                Nere till vänster, i samma rad som "Evenemang stad för stad"-
                pillen i motsatta hörnet (Josef 9/8). Under kortet i
                z-ordningen så den aldrig lägger sig över ett uppfällt event. */}
            {!chromeHidden && (
                <button
                    type="button"
                    onClick={() => setWelcomeOpen(true)}
                    aria-label="Om VADKUL"
                    title="Om VADKUL"
                    className="fixed bottom-3 left-3 z-[950] h-9 w-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-white/50 text-[#006AA7] hover:bg-white transition-colors"
                >
                    <Info size={18} />
                </button>
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
