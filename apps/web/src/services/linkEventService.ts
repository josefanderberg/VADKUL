import { expandSeries, isSeriesEvent, normalizeRepeatDays } from '../utils/weeklySeries';
import type { LinkEvent } from '../types';
import { db } from '../lib/firebase';
import { doc, collection, query, where, getDocs, getCountFromServer, addDoc, deleteDoc, setDoc, updateDoc, deleteField, onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';
import { decideUserEventPoll } from '../utils/userEventPoll';
import { getAuthHeaders } from '../lib/authHeaders';
import { applyVenueFixInPlace } from '../data/venueFixes';
import { buildCardIndex } from '../utils/eventKey';
import { timelineWindowRange, type TimelineWindowRange } from '../utils/timelineWindow';
import { tilesForBounds, boundsCoveredBy, composeAreaRows, descBucketFor, type Bounds } from '../utils/eventTiles';
import { apiEventToLinkEvent } from '../utils/eventSeed';

/**
 * Är eventet boostat just nu? Sant om featuredUntil finns och ligger i framtiden.
 * Delad av kartan (pin-utseende) och sorteringen så att en passerad boost
 * automatiskt slutar gälla utan någon städning.
 */
export function isEventFeatured(e: { featuredUntil?: Date } | null | undefined): boolean {
    return !!e?.featuredUntil && e.featuredUntil.getTime() > Date.now();
}

/**
 * Ska eventet synas VARJE dag, inte bara sin egen? Det är själva boost-löftet
 * (99 kr/vecka): alla andra event visas bara den dag de händer, men ett
 * boostat event ligger kvar på kartan ALLA dagar t.o.m. featuredUntil —
 * annars köper arrangören en vecka och syns en enda kväll av den.
 *
 * Två villkor: boosten är aktiv OCH eventets egen dag har inte passerat.
 * Dagen efter eventet är det färdigspelat och ska bort oavsett hur många
 * boostdagar som råkar återstå — en boost gör inte ett passerat event
 * odödligt. (Under själva eventdagen gäller samma regel som för alla event:
 * det ligger kvar dagen ut, ev. nedtonat som "har varit".)
 */
export function isBoostShownEveryDay(
    e: { featuredUntil?: Date; time: Date } | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!e?.featuredUntil || e.featuredUntil.getTime() <= now.getTime()) return false;
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    return e.time.getTime() >= startOfToday.getTime();
}

/** Lättviktig anmälan (RSVP) på ett event — bor i linkEvents/{id}/attendees/{uid}. */
export interface RsvpAttendee {
    uid: string;
    name: string;
    photoURL?: string | null;
}

/**
 * Användarskapade event bor BARA i Firestore (scraper-pipelinens aggregat
 * byggs från SQLite och känner inte till dem) — de hämtas i samma 30s-poll
 * som lagren och slås ihop med kartdatat.
 */
/**
 * Boost-overlay för SKRAPADE event: eventBoosts/{slug} skrivs av backend
 * efter en betald boost — skrapade event har inget linkEvents-dokument att
 * sätta featuredUntil på (aggregatedEvents är stängd för klientläsning).
 * Returnerar eventId (källans URL = aggregat-eventets id) → featuredUntil
 * för alla AKTIVA boostar. Kollektionen är en handfull små dokument som
 * mest — ingen egress-fälla.
 */
async function fetchActiveBoosts(): Promise<Map<string, Date>> {
    const out = new Map<string, Date>();
    try {
        if (!db) return out;
        const q = query(collection(db, 'eventBoosts'), where('featuredUntil', '>', Timestamp.now()));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
            const v: any = d.data();
            const until = v.featuredUntil instanceof Timestamp ? v.featuredUntil.toDate() : null;
            if (typeof v.eventId === 'string' && v.eventId && until) out.set(v.eventId, until);
        }
    } catch (e) {
        // Overlayn är ren kosmetik ovanpå kartdatan — ett hämtfel får aldrig
        // stoppa event-flödet, boosten dyker upp vid nästa poll i stället.
        console.warn('Kunde inte hämta boost-overlayn:', e);
    }
    return out;
}

/**
 * ETT read oavsett hur många event som finns: Firestore debiterar en läsning
 * per påbörjade 1 000 indexposter för count(). Probe:n som låter pollen slippa
 * hämta hela listan var 30:e sekund — se utils/userEventPoll för hela bakgrunden.
 *
 * null = frågan gick inte fram ("vet inte"), ALDRIG "noll event".
 */
async function fetchUserCreatedCount(): Promise<number | null> {
    try {
        if (!db) return null;
        const q = query(collection(db, 'linkEvents'), where('userCreated', '==', true));
        const snap = await getCountFromServer(q);
        return snap.data().count;
    } catch (e) {
        console.warn('Kunde inte räkna användarskapade event:', e);
        return null;
    }
}

/**
 * `total` = antalet DOKUMENT frågan matchade — inte längden på `events`, som är
 * både filtrerad och serie-expanderad. Det är `total` som count()-probe:n
 * jämförs mot, så de två måste räkna exakt samma sak.
 *
 * `total: null` betyder att hämtningen misslyckades. Anroparen skiljer det från
 * en tom databas (`total: 0`) och behåller då eventen den redan visar.
 */
async function fetchUserCreatedEvents(): Promise<{ events: LinkEvent[]; total: number | null }> {
    try {
        if (!db) return { events: [], total: null };
        const q = query(collection(db, 'linkEvents'), where('userCreated', '==', true));
        const snap = await getDocs(q);
        const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
        const events = snap.docs
            .map((d) => {
                const v: any = d.data();
                const time = v.time instanceof Timestamp ? v.time.toDate() : new Date(v.time);
                // featuredUntil sätts bara av servern (Stripe-betalning). Läs som Date.
                const featuredUntil = v.featuredUntil instanceof Timestamp
                    ? v.featuredUntil.toDate()
                    : (v.featuredUntil ? new Date(v.featuredUntil) : undefined);
                return {
                    id: d.id,
                    url: v.url || '',
                    title: v.title || '',
                    time,
                    createdAt: new Date(),
                    locationName: v.locationName || '',
                    lat: Number(v.lat) || 0,
                    lng: Number(v.lng) || 0,
                    hostName: v.hostName || 'VADKUL-användare',
                    category: v.category || 'other',
                    emoji: v.emoji || undefined,
                    coverImage: v.coverImage || '',
                    description: v.description || '',
                    // Lästes inte tidigare: entré/pris på ett användarskapat
                    // event föll bort tyst hela vägen till kortet.
                    price: v.price ?? undefined,
                    attendees: 0,
                    isLocationVerified: true,
                    hasSpecificTime: deriveHasSpecificTime(time),
                    userCreated: true,
                    isTip: !!v.isTip,
                    anonTip: !!v.anonTip,
                    repeatWeekly: !!v.repeatWeekly,
                    repeatWeeks: typeof v.repeatWeeks === 'number' && v.repeatWeeks >= 1
                        ? Math.floor(v.repeatWeeks) : undefined,
                    // Utan den här raden föll rytmen bort vid inläsning: en
                    // varannan vecka-serie skrevs rätt till Firestore men
                    // vecklades ut VARJE vecka så fort sidan laddades om.
                    repeatIntervalWeeks: typeof v.repeatIntervalWeeks === 'number' && v.repeatIntervalWeeks >= 2
                        ? Math.floor(v.repeatIntervalWeeks) : undefined,
                    // Dagsserie (22/9). Samma lärdom som rytmen ovan: ett fält
                    // som skrivs men inte mappas in här finns inte för kartan.
                    repeatDays: normalizeRepeatDays(v.repeatDays) ?? undefined,
                    hostUid: v.hostUid || undefined,
                    featuredUntil,
                    // Utan den här raden är hidden-filtret nedan verkningslöst:
                    // fältet mappades aldrig in, så ett gömt userCreated-event
                    // visades ändå (upptäckt vid Hemse Torgdag-dubbletten 11/9).
                    hidden: !!v.hidden,
                } as LinkEvent;
            })
            // Serier filtreras INTE på cutoff här: en veckoserie som startade
            // för ett halvår sedan är fortfarande aktuell, det är bara basens
            // datum som ligger bakåt. expandSeries hoppar fram till nästa
            // kommande tillfälle (en dagsserie vars första dag var igår har
            // kvar resten av dagarna). Engångsevent filtreras som förut.
            .filter((e) => e.title && !(e as any).hidden && (isSeriesEvent(e) || e.time >= cutoff))
            .flatMap((e) => (isSeriesEvent(e) ? expandSeries(e, cutoff) : [e]));
        return { events, total: snap.size };
    } catch (e) {
        console.warn('Kunde inte hämta användarskapade event:', e);
        return { events: [], total: null };
    }
}

/**
 * Statisk-JSON-först med FÖRSPRÅNG: har API-routen inte svarat inom så här
 * många ms hämtas deploy-snapshoten /events-destinations.json parallellt och
 * ritar kartan så länge. Snapshoten är en ren CDN-fil (ingen funktion, ingen
 * Firestore) — vid CDN-miss + kallstart kunde routen ta 10–30 s och kartan
 * stod tom hela tiden. Färska svaret ersätter snapshoten när det landar.
 * Fördröjningen gör att varma besökare (CDN-träff, svar < ~1 s) aldrig laddar
 * datan dubbelt (~1,5 MB gzippad extra-egress annars).
 */
const STATIC_HEADSTART_MS = 1500;

/**
 * Snabbstart: DAGENS destinations-slice (?from/to = lokal midnatt→midnatt som
 * UTC-ISO). ~1 400 event i stället för 22 000+ → ~90 % mindre nedladdning och
 * parse, så första markörerna kan ritas långt före fulla lagret. Alla besökare
 * i samma tidszon bygger identiska from/to-strängar → CDN:en cachar EN slice
 * per dag. Fel/tomt svar → null (kartan väntar på fulla lagret som förut).
 */
async function fetchTodaySlice(): Promise<any[] | null> {
    try {
        // Boot-scriptet i (v2)/layout.tsx startar hämtningen redan i HTML-
        // parsningen (långt före hydreringen) — återanvänd dess promise om den
        // finns OCH gäller idag (dagstämpeln skyddar mot en flik som legat över
        // midnatt). Annars egen hämtning med exakt samma URL-form.
        const w = window as unknown as { __vadkulTodaySlice?: Promise<{ events?: unknown[] } | null>; __vadkulTodaySliceDay?: string };
        const from = new Date(); from.setHours(0, 0, 0, 0);
        let data: { events?: unknown[] } | null;
        if (w.__vadkulTodaySlice && w.__vadkulTodaySliceDay === from.toDateString()) {
            data = await w.__vadkulTodaySlice;
        } else {
            const to = new Date(); to.setHours(23, 59, 59, 999);
            const res = await fetch(`/api/events/destinations?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
            if (!res.ok) return null;
            data = await res.json();
        }
        if (!data?.events?.length) return null;
        return data.events;
    } catch {
        return null;
    }
}

// Dagens STATISKA slice — /events-today.json är en ren Hosting-CDN-fil (bakad
// vid deploy av scripts/build-events-today.mjs), så den svarar på ~300 ms även
// när API-funktionen kallstartar (40 s-fallet). day-fältet valideras mot svensk
// dag (samma definition som bakningen) — en fil från igår (besök före morgon-
// deployen) slängs och API-slicen får ta det.
const STOCKHOLM_DAY_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }); // → 'ÅÅÅÅ-MM-DD'

async function fetchTodayStatic(): Promise<any[] | null> {
    try {
        const w = window as unknown as { __vadkulTodayStatic?: Promise<{ day?: string; events?: unknown[] } | null> };
        const data = w.__vadkulTodayStatic
            ? await w.__vadkulTodayStatic
            : await fetch('/events-today.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
        if (!data?.events?.length) return null;
        if (data.day !== STOCKHOLM_DAY_FMT.format(new Date())) return null; // förlegad fil
        return data.events;
    } catch {
        return null;
    }
}

// ── Tunga lagren hålls tillbaka tills kartan målat ──────────────────────────
// cards + descriptions (~flera MB gzippat) ska inte konkurrera med karttiles
// och prick-utritningen om bandbredd på smala mobilnät. Kartan släpper gaten
// via releaseHeavyLayers() (V2Map:s onFirstPaint när första målnings-rundan
// är klar); säkerhetsnätet släpper ändå efter HEAVY_GATE_MAX_MS om kartan
// aldrig målar (WebGL-fel, dold flik, sida utan karta). Gaten är engångs —
// pollarna (5 min) passerar en redan-släppt gate utan kostnad.
const HEAVY_GATE_MAX_MS = 8000;
let heavyGate: Promise<void> | null = null;
let releaseHeavyGate: (() => void) | null = null;
function awaitHeavyLayersGate(): Promise<void> {
    if (!heavyGate) {
        heavyGate = new Promise<void>((res) => {
            releaseHeavyGate = res;
            setTimeout(res, HEAVY_GATE_MAX_MS);
        });
    }
    return heavyGate;
}
/** Släpp gaten NU — även innan laddaren hunnit fram till await:en (djuplänk:
 *  kortet öppnas före första målningen, och releaseHeavyGate är null tills
 *  gaten initierats). Executor kör synkront, så release finns direkt efter. */
function releaseHeavyGateNow() {
    awaitHeavyLayersGate();
    releaseHeavyGate?.();
}

// ── Beskrivningar: EN hink i taget, först när ett kort öppnas ──────────────
// descriptions-lagret är det största (~2 MB brotli för 47k event) men en
// besökare läser bara de kort hen öppnar. I stället för hela lagret hämtas
// HINKEN eventet ligger i (utils/eventTiles: DESC_BUCKETS hinkar på id:ts
// hash, ~90 beskrivningar / några kB) — fasta URL:er, så CDN:en delar dem
// mellan besökare. LinkEventCard begär sitt event (requestDescriptionFor),
// EventCard förhämtar de närmaste Nästa-målen (prefetchDescriptions).
// Hinkarna mergas in i kartans event av den aktiva prenumerationen.
const descBuckets = new Map<number, Record<string, string>>();
const descBucketInflight = new Map<number, Promise<void>>();
// Den aktiva prenumerationens merge-krok (sätts i subscribeToAll).
let onDescriptionsLanded: ((data: Record<string, string>) => void) | null = null;

/** GET + JSON med ett omtag vid nätfel/5xx (kallstart som klipper svaret).
 *  4xx är ett definitivt besked (okänd ruta, eventet finns inte) — inget
 *  omtag; `definitive` skiljer det från "gick inte fram". */
async function fetchJsonWithStatus(url: string): Promise<{ data: any; definitive: boolean }> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data) return { data, definitive: true };
            } else if (res.status >= 400 && res.status < 500) {
                return { data: null, definitive: true };
            }
        } catch { /* omtag nedan */ }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    return { data: null, definitive: false };
}

async function fetchJsonTwice(url: string): Promise<any> {
    return (await fetchJsonWithStatus(url)).data;
}

function loadDescBucket(bucket: number, fallbackId?: string): Promise<void> {
    if (descBuckets.has(bucket)) return Promise.resolve();
    const existing = descBucketInflight.get(bucket);
    if (existing) return existing;
    const p = (async () => {
        const data = await fetchJsonTwice(`/api/events/descriptions?bucket=${bucket}`);
        let out: Record<string, string> = data?.data && typeof data.data === 'object' ? data.data : {};
        if (!data && fallbackId) {
            // Hinken gick inte att få (routen nere): djuplänks-API:t bär hela
            // beskrivningen för ett enskilt event. Hinken räknas INTE som
            // laddad — nästa kort i samma hink försöker igen.
            const one = await fetchJsonTwice(`/api/event?id=${encodeURIComponent(fallbackId)}`);
            const text = typeof one?.event?.description === 'string' ? one.event.description : '';
            out = text ? { [fallbackId]: text } : {};
        } else {
            descBuckets.set(bucket, out);
        }
        if (Object.keys(out).length) onDescriptionsLanded?.(out);
    })().finally(() => { descBucketInflight.delete(bucket); });
    descBucketInflight.set(bucket, p);
    return p;
}

// ── Kortlagret hämtas först när det BEHÖVS ─────────────────────────────────
// cards (~1 MB brotli) bär bara kortfälten: bild, värd, pris, anmälda och
// affiliate-länken. Markörer, räknare, dagslistor och kategorifilter bygger
// helt på destinations — så lagret laddas inte alls vid start utan begärs av
// (1) LinkEventCard vid mount och (2) sökningen (eventSearch matchar hostName
// + kortets url) vid första söktermen. Besökare som bara tittar på kartan
// laddar aldrig lagret. Gaten är engångs; pollarna tar med lagret först efter
// begäran. I rutläget gäller samma sak per ruta.
let cardsRequested = false;
let releaseCardsGate: (() => void) | null = null;
const cardsGate = new Promise<void>((res) => { releaseCardsGate = res; });
// ── Tidsfönstret: hela tidslinjen hämtas först när den BEHÖVS ──────────────
// Standardlasten är de närmaste TIMELINE_WINDOW_DAYS dagarna (58 % av eventen,
// 1,21 mot 1,66 MB — och framför allt: säsongsscheman som skrapas in månader i
// förväg landar i en svans som aldrig laddas). Fulla lagret begärs av sidan
// via requestFullTimeline()/ensureTimelineCovers(): sökning (går över alla
// dagar), datumbläddring nära fönsterkanten och djuplänk bortom fönstret.
// (Aktiva boostar utanför fönstret hämtas styckvis, se ensureEvents.) Gaten
// är engångs, som de andra. I rutläget gäller den rutornas tidslinje.
let fullTimelineRequested = false;
let releaseTimelineGate: (() => void) | null = null;
const timelineGate = new Promise<void>((res) => { releaseTimelineGate = res; });
// Epoch-ms för slutet på den data som faktiskt är laddad — null = hela
// tidslinjen. UI:t läser den via timelineHorizonMs() (varje full-landning
// följs av emit → re-render, så en getter räcker).
let loadedHorizonMs: number | null = null;

let signalCardsSettled: (() => void) | null = null;
// Kortet visar bild-skelett tills ett cards-svar behandlats - sedan finns
// bilden eller saknas den på riktigt.
const cardsSettled = new Promise<void>((res) => { signalCardsSettled = res; });

// Synkron spegel av löftet: destinations-lagret sätter coverImage till ''
// (inte undefined), så ett kort som öppnas EFTER att lagret landat kan inte
// skilja "laddar" från "saknas" på värdet - det frågar den här i stället
// (annars blinkar skelettet en frame i onödan).
let cardsHaveSettled = false;
cardsSettled.then(() => { cardsHaveSettled = true; });

// ── RUTLÄGET: bara området runt kartan, inte hela landet ───────────────────
// (utils/eventTiles + docs/egress-optimering.md.) Kartsidan slår på läget
// (subscribeToAll med { area: true }) och berättar var kartan är
// (setDataArea). Den aktiva prenumerationen hämtar de FASTA rutorna som täcker
// området; landslagret (gamla vägen) tas bara när något verkligen behöver
// hela Sverige: sökning, arrangörsfiltret, sparade-listan — eller en vy som
// är för bred för rutor (> MAX_AREA_TILES), efter en kort fördröjning så att
// första besökets Sverige-översikt (innan GPS-hoppet landar) inte drar hem
// landet i onödan.
interface AreaController {
    want(tiles: string[]): void;
    goNationwide(): Promise<void>;
    covers(b: Bounds): boolean;
    /** Ett tidigare krav (full tidslinje, kortlagret) har tillkommit. */
    refresh(): void;
}
let activeArea: AreaController | null = null;
// Senast begärda rutor — läggs på en prenumeration som startar efteråt.
let lastAreaTiles: string[] | null = null;
let nationwideWanted = false;
let nationwideLanded = false;
let wideTimer: ReturnType<typeof setTimeout> | null = null;
let areaEverSet = false;
// Bred vy (för många rutor) innan något område alls satts = första besökets
// Sverige-översikt; GPS-/blindhoppet landar inom ~2,5 s (TOUR_GPS_WAIT_MS i
// page.tsx). Efter det: en kort paus så att en utzoomning man ångrar inte
// laddar landet.
const FIRST_WIDE_VIEW_DELAY_MS = 4000;
const WIDE_VIEW_DELAY_MS = 700;
// Ingen setDataArea alls inom så här lång tid (kartan kom aldrig igång, eller
// en sida som inte rapporterar området) → landslagret, som förut.
const AREA_SILENCE_MS = 6000;

// ── Enskilda event utanför det laddade datat (ensureEvents) ────────────────
// Sparade event i en annan stad, djuplänkens event och aktiva boostar
// bortom fönstret: hämtas ett och ett ur /api/event (CDN-cachat per id) i
// stället för att dra hem hela landet eller hela tidslinjen.
const extraEvents = new Map<string, LinkEvent>();
const extraMisses = new Set<string>();
const extraInflight = new Map<string, Promise<void>>();
const EXTRA_MAX = 200;
// Den aktiva prenumerationens koll "finns id:t redan?" + emit (subscribeToAll).
let knownEventIds: (() => Set<string>) | null = null;
let onExtrasLanded: (() => void) | null = null;

async function fetchLayer(layerName: 'destinations' | 'cards'): Promise<any> {
    // 1. CDN-cachad server-route FÖRST (gzippad ~5:1, delas mellan alla
    // besökare via Hosting-CDN:en). 30s-pollen är också gratis här:
    // max-age=300 → webbläsaren svarar ur egen HTTP-cache utan nätverk i 5 min.
    // Vid kallstart direkt efter en deploy kan svaret komma trunkerat
    // (funktions-timeouten klipper strömmen mitt i → res.json() kastar
    // "Unterminated string"). Ett omtag träffar då nästan alltid ett komplett,
    // CDN-cachat svar.
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(`/api/events/${layerName}`);
            if (res.ok) {
                const data = await res.json();
                if (data) return data;
            }
        } catch (e) {
            if (attempt === 1) {
                console.warn(`API-route för lagret "${layerName}" svarade inte (2 försök), tar deploy-snapshoten:`, e);
            }
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }

    // OBS: den gamla väg 2 (Firestore Client SDK direkt) är BORTTAGEN och
    // Firestore-reglerna nekar numera klientläsning av aggregatedEvents.
    // Direktläsningarna drog ~26 MB okomprimerad internet-egress per omgång
    // (~9 GiB/dag totalt, fakturerat under "App Engine") — därav spärren.

    // 2. Sista utväg: statisk JSON från public-mappen (ögonblicksbild från
    // senaste deployen — kan vara dagar gammal, men kartan är aldrig tom).
    try {
        const res = await fetch(`/events-${layerName}.json`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error(`Static JSON fetch failed for layer "${layerName}":`, e);
    }

    return null;
}

/**
 * Fönster-slicen av destinations (?from/to ur timelineWindowRange — samma
 * kvantiserade form som dagsslicen, så CDN:en cachar EN per dygn). Samma
 * tvåförsöks-mönster som fetchLayer; null → anroparen tar fulla lagret
 * (som också är fallbacken när routen saknar slice-stödets nya spann).
 */
async function fetchTimelineWindow(range: TimelineWindowRange): Promise<any> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(`/api/events/destinations?from=${encodeURIComponent(range.fromIso)}&to=${encodeURIComponent(range.toIso)}`);
            if (res.ok) {
                const data = await res.json();
                if (data?.events?.length) return data;
            }
        } catch { /* omtag nedan */ }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
}

/**
 * Midnatt lokal tid = källan hade bara ett datum, inget klockslag (scraperns
 * egen heuristik speglad) — fallback för äldre aggregat-lager som saknar
 * den exporterade hasSpecificTime-flaggan.
 */
function deriveHasSpecificTime(t: Date): boolean {
    return !(t.getHours() === 0 && t.getMinutes() === 0);
}

/** Exporterad flagga vinner; härled bara när lagret är gammalt och saknar den. */
function hasSpecificTimeOf(evt: any, time: Date): boolean {
    return typeof evt.hasSpecificTime === 'boolean'
        ? evt.hasSpecificTime
        : deriveHasSpecificTime(time);
}

function mapDestinationsToLinkEvents(events: any[]): LinkEvent[] {
    return events.map((evt: any) => {
        // Verifierade venue-koordinater tvingas SIST i kedjan också (Piteå
        // 5/9): täcker även cachade/gamla API-svar och deploy-snapshoten.
        applyVenueFixInPlace(evt);
        const time = new Date(evt.time);
        // Slutdatum (flerdagarsevent) — pipelinen validerar redan, men en
        // trasig/omvänd sträng ska inte ge kortet ett bakvänt spann.
        const end = evt.endDate ? new Date(evt.endDate) : null;
        const endDate = end && !isNaN(end.getTime()) && end.getTime() > time.getTime() ? end : undefined;
        // Sanera koordinater redan här: en projicerad koord (lat=6129956) som
        // slinker förbi pipelinens vakt får annars Maplibre att kasta och
        // släcker hela kartan. Ogiltigt → 0,0 ("oplacerad", döljs på kartan).
        const validCoord =
            Number.isFinite(evt.lat) && Number.isFinite(evt.lng) &&
            evt.lat >= -90 && evt.lat <= 90 && evt.lng >= -180 && evt.lng <= 180;
        return {
            id: evt.id,
            url: evt.id,
            title: evt.title,
            time,
            createdAt: new Date(),
            locationName: evt.locationName,
            lat: validCoord ? evt.lat : 0,
            lng: validCoord ? evt.lng : 0,
            hostName: '',
            category: evt.category || 'other',
            coverImage: '',
            description: '',
            attendees: 0,
            isLocationVerified: evt.isLocationVerified || false,
            emoji: evt.emoji || undefined,
            pop: evt.pop || undefined,
            firstSeen: typeof evt.fs === 'string' ? evt.fs : undefined,
            hasSpecificTime: hasSpecificTimeOf(evt, time),
            endDate,
        };
    });
}

/**
 * Slår ihop kortlagret med destinations. Klarar BÅDA aggregatformaten — se
 * buildCardIndex: det slanka kortet bär `h` (hash av url), det gamla `id`.
 *
 * Defaultarna nedan (`?? ''`, `?? 0`, `!!`) återställer exakt de värden det
 * gamla lagret skickade explicit. Det slanka lagret utelämnar tomma fält för
 * att spara bytes, så utan dem skulle `''` tyst bli `undefined` för
 * konsumenter som skiljer på de två.
 */
function mergeCardsWithDestinations(destEvents: LinkEvent[], cards: any[]): LinkEvent[] {
    const lookup = buildCardIndex(cards);

    return destEvents.map(evt => {
        const card = lookup(evt.id);
        if (!card) return evt;
        return {
            ...evt,
            coverImage: card.coverImage ?? '',
            hostName: card.hostName ?? '',
            attendees: card.attendees ?? 0,
            price: card.price ?? '',
            isLocationVerified: !!card.isLocationVerified,
            isHostVerified: !!card.isHostVerified,
            url: card.url || evt.url
        };
    });
}

function mergeDescriptionsWithEvents(events: LinkEvent[], descMap: Record<string, string>): LinkEvent[] {
    return events.map(evt => {
        const desc = descMap[evt.id];
        if (!desc) return evt;
        return {
            ...evt,
            description: desc
        };
    });
}

export const linkEventService = {
    /** Kartan har målat första prick-rundan → cards/descriptions får hämtas
     *  (se awaitHeavyLayersGate). Idempotent; säkerhetsnätet släpper ändå. */
    releaseHeavyLayers() { releaseHeavyGateNow(); },

    /** Hela tidslinjen behövs (sökning, bläddring bortom fönstret, boost/
     *  djuplänk utanför). Idempotent; pollarna går över till fulla lagret. */
    requestFullTimeline() {
        if (fullTimelineRequested) return;
        fullTimelineRequested = true;
        releaseTimelineGate?.();
        activeArea?.refresh();
    },

    /** Slutet (epoch-ms) på laddad tidslinje — null när allt är inne. UI:t
     *  behandlar dagar bortom horisonten som "laddar", inte som tomma. */
    timelineHorizonMs(): number | null {
        return loadedHorizonMs;
    },

    /** Begär fulla tidslinjen om `date` ligger bortom (eller inom 3 dygns
     *  marginal från) den laddade horisonten — förhämtningen ska vara klar
     *  innan användaren hinner fram till kanten. */
    ensureTimelineCovers(date: Date) {
        if (loadedHorizonMs !== null && date.getTime() > loadedHorizonMs - 3 * 86_400_000) {
            linkEventService.requestFullTimeline();
        }
    },

    /** Kortfälten behövs (kort öppnat, eller sökning — den matchar värd +
     *  kortets url). Idempotent; pollarna tar med lagret efter begäran.
     *  Löftet löser ut när första svaret behandlats (även tomt), så kortet
     *  kan skilja "bilden hämtas" från "har ingen bild".
     *  Släpper också målnings-gaten: ett öppet kort (eller en påbörjad
     *  sökning) är AKTIV läsning — bild/beskrivning ska inte vänta ut
     *  kartans första målning (upp till 8 s), som kortet ändå skymmer.
     *  Landade lagren sent hann man scrolla ner i kortets lista, och
     *  beskrivningen tryckte ner raderna mitt framför ögonen (Josef 28/9). */
    requestCards(): Promise<void> {
        const first = !cardsRequested;
        cardsRequested = true;
        releaseCardsGate?.();
        releaseHeavyGateNow();
        if (first) activeArea?.refresh();
        return cardsSettled;
    },

    /** Synkron spegel av requestCards-löftet - för pending-initialiserare
     *  (destinations-lagret sätter coverImage till '', inte undefined). */
    cardsSettledNow(): boolean {
        return cardsHaveSettled;
    },

    /** Har beskrivningen för `id` hämtats (eller visat sig saknas)? Synkron —
     *  för kortets pending-initialiserare (destinations sätter description
     *  till '', inte undefined, så värdet ensamt säger inget). */
    descriptionSettledFor(id: string): boolean {
        return descBuckets.has(descBucketFor(id));
    },

    /** Ett eventkort visar `id` → hämta hinken med dess beskrivning.
     *  Idempotent per hink. Löftet löser ut när svaret behandlats (även
     *  tomt/misslyckat), så kortet kan skilja "hämtas" från "saknas". */
    requestDescriptionFor(id: string): Promise<void> {
        return loadDescBucket(descBucketFor(id), id);
    },

    /** Förhämta hinkarna för event man troligen öppnar härnäst (Nästa-målen),
     *  så beskrivningen redan finns när kortet byter event. */
    prefetchDescriptions(ids: readonly string[]) {
        const seen = new Set<number>();
        for (const id of ids) {
            const b = descBucketFor(id);
            if (seen.has(b) || seen.size >= 3) continue;
            seen.add(b);
            void loadDescBucket(b);
        }
    },

    /** Kartans dataområde (rutläget): bounds = allt kartan kan behöva visa
     *  närmast — vyn + veckovyns cirkel, eller målet för ett stadshopp innan
     *  kameran flugit dit. Rutorna läggs till (släpps aldrig); en vy som är
     *  för bred för rutor ger landslagret efter en kort paus. */
    setDataArea(b: Bounds) {
        const tiles = tilesForBounds(b, 0);
        if (tiles === null) {
            if (!wideTimer && !nationwideWanted) {
                wideTimer = setTimeout(() => {
                    wideTimer = null;
                    void linkEventService.requestNationwide();
                }, areaEverSet ? WIDE_VIEW_DELAY_MS : FIRST_WIDE_VIEW_DELAY_MS);
            }
            return;
        }
        if (wideTimer) { clearTimeout(wideTimer); wideTimer = null; }
        areaEverSet = true;
        lastAreaTiles = lastAreaTiles ? Array.from(new Set([...lastAreaTiles, ...tiles])) : tiles;
        activeArea?.want(tiles);
    },

    /** Förhämtning INNAN kartan rapporterat sin vy: första besökets
     *  blindstartsstad (ingen sparad stad, ingen ?plats=). Begär områdets
     *  rutor som setDataArea, men rör INTE wide-fallbackens tillstånd
     *  (areaEverSet/wideTimer) - kartans Sverige-översikt vid load ska
     *  fortfarande få hela FIRST_WIDE_VIEW_DELAY_MS på sig innan landet
     *  hämtas. Att rutorna begärs gör samtidigt att tyst-fallbacken
     *  (AREA_SILENCE_MS -> hela landet, ~1 MB) aldrig går av bara för att
     *  kartan laddar långsamt (långsam mobil, WebGL-strul). Landar kameran
     *  sedan i en annan stad läggs dess rutor till som vanligt - det här är
     *  en liten, begränsad förhämtning, aldrig ett fel. */
    seedArea(b: Bounds) {
        const tiles = tilesForBounds(b, 0);
        if (tiles === null) return;
        lastAreaTiles = lastAreaTiles ? Array.from(new Set([...lastAreaTiles, ...tiles])) : tiles;
        activeArea?.want(tiles);
    },

    /** HELA Sverige behövs (sökning, arrangörsfiltret, sparade-listan).
     *  Idempotent. Löser ut när landslagret (och kortlagret, om det är
     *  begärt) landat — direkt utanför rutläget. */
    requestNationwide(): Promise<void> {
        nationwideWanted = true;
        if (wideTimer) { clearTimeout(wideTimer); wideTimer = null; }
        return activeArea ? activeArea.goNationwide() : Promise.resolve();
    },

    /** Är datat för vyn hämtat? Utanför rutläget alltid sant (då styr bara
     *  eventsSettled + tidshorisonten). I rutläget: landslagret är inne,
     *  eller varje ruta vyn rör är hämtad. Läses per render, som
     *  timelineHorizonMs — varje landning följs av en emit. */
    isAreaLoaded(b: Bounds | null | undefined): boolean {
        if (!activeArea || !b) return true;
        return activeArea.covers(b);
    },

    /** Antal event per svensk dag för HELA landet (välkomstrutan) — kartan
     *  laddar bara sitt område och kan inte räkna landet själv. null vid fel. */
    async fetchNationalDayCounts(): Promise<Record<string, number> | null> {
        const data = await fetchJsonTwice('/api/events/destinations?counts=day');
        return data?.perDay && typeof data.perDay === 'object' ? data.perDay : null;
    },

    /** Är landslagret inne (eller rutläget av)? */
    isNationwide(): boolean {
        return !activeArea || nationwideLanded;
    },

    /**
     * Se till att de här eventen finns i kartans data även om deras ruta eller
     * dag inte är hämtad: sparade event i en annan stad, djuplänkens event,
     * boostar bortom fönstret. Okända id:n hämtas ett och ett ur /api/event
     * (CDN-cachat per id) och läggs in tills de dyker upp i lagren. Löser ut
     * med de event som hittades (redan kända ingår inte — läs dem ur listan).
     * Användarskapade event finns aldrig i /api/event (de bor i Firestore och
     * hämtas redan för hela landet) — de är redan kända.
     */
    async ensureEvents(ids: readonly string[]): Promise<Map<string, LinkEvent>> {
        const known = knownEventIds?.() ?? new Set<string>();
        // Bara SKRAPADE event (id = källans url): användarskapade hämtas redan
        // för hela landet av Firestore-pollen — en styckhämtad kopia hade
        // saknat serie-expansionen och skuggat pollens färskare version.
        const todo = ids
            .filter((id) => id && id.includes('://') && !known.has(id) && !extraEvents.has(id) && !extraMisses.has(id))
            .slice(0, 50);
        await Promise.all(todo.map((id) => {
            const existing = extraInflight.get(id);
            if (existing) return existing;
            const p = (async () => {
                const { data, definitive } = await fetchJsonWithStatus(`/api/event?id=${encodeURIComponent(id)}`);
                const evt = data?.event ? apiEventToLinkEvent(data.event, id) : null;
                if (evt && extraEvents.size < EXTRA_MAX) extraEvents.set(id, evt);
                // Bara ett riktigt "finns inte" minns — ett nätfel frågas om nästa gång.
                else if (!evt && definitive) extraMisses.add(id);
            })().finally(() => { extraInflight.delete(id); });
            extraInflight.set(id, p);
            return p;
        }));
        if (todo.length) onExtrasLanded?.();
        const out = new Map<string, LinkEvent>();
        for (const id of ids) {
            const e = extraEvents.get(id);
            if (e) out.set(id, e);
        }
        return out;
    },

    // Hämta link events
    async getAll(onlyFuture = true): Promise<LinkEvent[]> {
        try {
            // Destinations + cards parallellt. Beskrivningarna kommer inte
            // härifrån — de hämtas per hink när ett kort öppnas.
            const [destData, cardsData] = await Promise.all([
                fetchLayer('destinations'),
                cardsRequested ? fetchLayer('cards') : Promise.resolve(null),
            ]);

            if (!destData) return [];

            let events = mapDestinationsToLinkEvents(destData.events || []);

            if (cardsData) {
                events = mergeCardsWithDestinations(events, cardsData.events || []);
            }

            return events;
        } catch (error) {
            console.error("Error in linkEventService.getAll:", error);
            // Fallback to SQLite API
            try {
                const res = await fetch(`/api/link-events${onlyFuture ? '' : '?all=true'}`);
                if (res.ok) {
                    const data = await res.json();
                    return data.map((evt: any) => ({
                        ...evt,
                        time: new Date(evt.time),
                        createdAt: new Date(evt.createdAt)
                    }));
                }
            } catch (fallbackErr) {
                console.error("SQLite API fallback failed:", fallbackErr);
            }
            return [];
        }
    },

    /**
     * Skapa ett ANVÄNDAR-event direkt mot Firestore (reglerna kräver
     * userCreated=true + hostUid=eget uid och begränsar fälten). Returnerar
     * dokument-id:t — eventet syns på kartan vid nästa poll (≤30 s).
     * `url` sätts BARA av tips-flödet ("jag arrangerar inte själv") — den gör
     * att eventet presenteras som ett vanligt länk-event, se isVadkulHostedEvent.
     */
    async createUserEvent(input: {
        title: string; time: Date; lat: number; lng: number;
        locationName?: string; category?: string; description?: string;
        /** Färdig etikett ("120 kr", "Gratis") — normaliseras i formuläret. */
        price?: string;
        hostName: string; hostUid: string; coverImage?: string; url?: string;
        isTip?: boolean; anonTip?: boolean; repeatWeekly?: boolean;
        repeatWeeks?: number;
        /** 2 = varannan vecka; utelämnad/1 = varje vecka. */
        repeatIntervalWeeks?: number;
        /** Dagsserie: antal dagar i rad (2-14). Vinner över repeatWeekly. */
        repeatDays?: number;
    }): Promise<string> {
        if (!db) throw new Error('Firestore ej initierad');
        const payload: Record<string, unknown> = {
            title: input.title.trim(),
            time: Timestamp.fromDate(input.time),
            lat: input.lat,
            lng: input.lng,
            locationName: input.locationName?.trim() || '',
            category: input.category || 'other',
            description: input.description?.trim() || '',
            hostName: input.hostName,
            hostUid: input.hostUid,
            userCreated: true,
            status: 'published',
            hidden: 0,
            url: input.url || '',
            isLocationVerified: true,
            createdAt: serverTimestamp(),
        };
        // Lägg bara med coverImage när det faktiskt finns en bild — då fungerar
        // event UTAN bild även innan de uppdaterade Firestore-reglerna deployats.
        if (input.coverImage) payload.coverImage = input.coverImage;
        // Samma sak för priset: tomt fält betyder "vet inte / står inget", och
        // det är INTE detsamma som gratis. Utan fältet visar korten inget
        // pris-chip alls, precis som för skrapade event utan pris.
        if (input.price) payload.price = input.price.slice(0, 40);
        // Bara på faktiska tips — annars skulle varje eget event bära ett
        // isTip: false som reglernas hasOnly-lista måste känna till i onödan.
        if (input.isTip) payload.isTip = true;
        // Måste sättas exakt när sessionen är anonym — reglerna jämför fältet
        // mot sign_in_provider och avvisar skrivningen om de inte stämmer.
        // Det är märkningen som gör tipset raderbart för vem som helst.
        if (input.anonTip) payload.anonTip = true;
        // Dagsserie: bara antalet dagar skrivs. Den utesluter veckoserien, så
        // ett dokument bär aldrig båda.
        const repeatDays = normalizeRepeatDays(input.repeatDays);
        if (repeatDays !== null) {
            payload.repeatDays = repeatDays;
        } else if (input.repeatWeekly) {
            payload.repeatWeekly = true;
            // Bara med när ägaren valt en begränsning — utelämnat = tills
            // vidare, och gamla Firestore-regler (utan repeatWeeks i hasOnly)
            // fortsätter acceptera obegränsade serier tills nya är deployade.
            if (input.repeatWeeks && input.repeatWeeks >= 1) {
                payload.repeatWeeks = Math.floor(input.repeatWeeks);
            }
            // Rytm: bara varannan vecka (2) skrivs — varje vecka är seriens
            // default och ska inte bära ett fält (bytes + rules-enkelhet).
            if (input.repeatIntervalWeeks === 2) {
                payload.repeatIntervalWeeks = 2;
            }
        }
        try {
            const ref = await addDoc(collection(db, 'linkEvents'), payload);
            return ref.id;
        } catch (e: any) {
            // Reglernas hasOnly-lista avvisar HELA skrivningen om den känner
            // igen ett fält den inte har — och rules deployas separat från
            // bundlen. Faller skapandet på just priset släpper vi priset och
            // sparar eventet ändå: ett event utan pris-etikett är oändligt
            // mycket bättre än "kunde inte skapa" för alla som fyller i rutan
            // i fönstret innan de nya reglerna är ute.
            if (e?.code === 'permission-denied' && payload.price !== undefined) {
                console.warn('[event] pris avvisat av reglerna — sparar utan pris (deploya rules)');
                delete payload.price;
                const ref = await addDoc(collection(db, 'linkEvents'), payload);
                return ref.id;
            }
            throw e;
        }
    },

    // ── Anmälningar (RSVP) ────────────────────────────────────────────────
    // Anmälan bor i linkEvents/{eventId}/attendees/{uid} → ett konto = en anmälan.
    async rsvp(eventId: string, attendee: RsvpAttendee): Promise<void> {
        if (!db) throw new Error('Firestore ej initierad');
        await setDoc(doc(db, 'linkEvents', eventId, 'attendees', attendee.uid), {
            uid: attendee.uid,
            name: attendee.name,
            photoURL: attendee.photoURL ?? null,
            createdAt: serverTimestamp(),
        });
    },
    async cancelRsvp(eventId: string, uid: string): Promise<void> {
        if (!db) throw new Error('Firestore ej initierad');
        await deleteDoc(doc(db, 'linkEvents', eventId, 'attendees', uid));
    },
    /** Live-lyssnare på vilka som anmält sig. Returnerar avprenumerations-funktion. */
    subscribeAttendees(eventId: string, callback: (attendees: RsvpAttendee[]) => void): () => void {
        if (!db) { callback([]); return () => {}; }
        return onSnapshot(
            collection(db, 'linkEvents', eventId, 'attendees'),
            (snap) => {
                const list = snap.docs.map((d) => {
                    const v = d.data() as { uid?: string; name?: string; photoURL?: string | null; createdAt?: Timestamp };
                    return {
                        uid: v.uid || d.id,
                        name: v.name || 'Anonym',
                        photoURL: v.photoURL ?? null,
                        _t: v.createdAt instanceof Timestamp ? v.createdAt.toMillis() : 0,
                    };
                });
                list.sort((a, b) => a._t - b._t);
                callback(list.map(({ _t, ...rest }) => rest));
            },
            (err) => { console.warn('Kunde inte lyssna på anmälningar:', err); callback([]); }
        );
    },

    /**
     * Uppdatera ett eget användarskapat event (reglerna släpper bara igenom
     * hostUid == auth.uid, och aldrig boost-fälten). Tomma valfria fält
     * RADERAS ur dokumentet (deleteField) — "inget pris" ska betyda inget
     * pris-chip, inte en kvarglömd gammal etikett. `updatedAt` stämplas som
     * scraperns stamped(): utan den missar den inkrementella SQLite-syncen
     * ändringen (create går på createdAt och är redan täckt).
     */
    async updateUserEvent(id: string, input: {
        title: string; time: Date; lat: number; lng: number;
        locationName?: string; category?: string; description?: string;
        price?: string; hostName: string; coverImage?: string; url?: string;
        isTip?: boolean; repeatWeekly?: boolean; repeatWeeks?: number;
        /** 2 = varannan vecka; utelämnad/1 = varje vecka. */
        repeatIntervalWeeks?: number;
        /** Dagsserie: antal dagar i rad (2-14). Vinner över repeatWeekly. */
        repeatDays?: number;
    }): Promise<void> {
        const repeatDays = normalizeRepeatDays(input.repeatDays);
        // En dagsserie städar bort veckoseriens fält (och tvärtom) så att ett
        // event som byter rytm aldrig bär båda.
        const weekly = repeatDays === null && !!input.repeatWeekly;
        if (!db) throw new Error('Firestore ej initierad');
        const payload: Record<string, unknown> = {
            title: input.title.trim(),
            time: Timestamp.fromDate(input.time),
            lat: input.lat,
            lng: input.lng,
            locationName: input.locationName?.trim() || '',
            category: input.category || 'other',
            description: input.description?.trim() || '',
            hostName: input.hostName,
            url: input.url || '',
            price: input.price ? input.price.slice(0, 40) : deleteField(),
            coverImage: input.coverImage || deleteField(),
            isTip: input.isTip ? true : deleteField(),
            repeatWeekly: weekly ? true : deleteField(),
            repeatWeeks: weekly && input.repeatWeeks && input.repeatWeeks >= 1
                ? Math.floor(input.repeatWeeks)
                : deleteField(),
            repeatIntervalWeeks: weekly && input.repeatIntervalWeeks === 2
                ? 2
                : deleteField(),
            repeatDays: repeatDays ?? deleteField(),
            updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, 'linkEvents', id), payload);
    },

    /**
     * Ta bort ett eget användarskapat event. Firestore-reglerna släpper bara
     * igenom delete när hostUid == auth.uid — så fel användare stoppas där.
     */
    async deleteUserEvent(id: string): Promise<void> {
        if (!db) throw new Error('Firestore ej initierad');
        await deleteDoc(doc(db, 'linkEvents', id));
    },

    // Skapa nytt link event
    async create(linkEvent: Omit<LinkEvent, 'id' | 'createdAt'>) {
        const res = await fetch('/api/link-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify(linkEvent)
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to create link event');
        }
        return await res.json();
    },

    // Ta bort link event
    async delete(id: string) {
        const res = await fetch(`/api/link-events?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { ...(await getAuthHeaders()) }
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to delete link event');
        }
        return await res.json();
    },

    // Uppdatera link event
    async update(id: string, updates: Partial<Omit<LinkEvent, 'id' | 'createdAt'>>) {
        const res = await fetch(`/api/link-events?id=${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to update link event');
        }
        return await res.json();
    },

    // Bulk create
    async bulkCreate(linkEvents: Omit<LinkEvent, 'id' | 'createdAt'>[]): Promise<number> {
        if (linkEvents.length === 0) return 0;
        
        const res = await fetch('/api/link-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
                action: 'bulkCreate',
                events: linkEvents
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to bulk create link events');
        }

        const data = await res.json();
        return data.count || linkEvents.length;
    },

    // Bulk delete
    async bulkDelete(eventIds: string[]): Promise<number> {
        if (eventIds.length === 0) return 0;

        const res = await fetch('/api/link-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
            body: JSON.stringify({
                action: 'bulkDelete',
                ids: eventIds
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to bulk delete link events');
        }

        const data = await res.json();
        return data.count || eventIds.length;
    },

    // Polling-baserad realtidslyssnare för SQLite (ersätter Firestore onSnapshot)
    subscribeToAll(
        onlyFuture: boolean,
        callback: (events: LinkEvent[]) => void,
        // Anropas EN gång när den första aggregat-laddningen är klar (destinations-
        // lagret hämtat, oavsett om det var tomt eller ej). Ger UI:t ett DEFINITIVT
        // "laddat"-besked i stället för att gissa med timers → "Inga event den här
        // dagen" kan aldrig blinka förbi innan datan faktiskt hämtats.
        onInitialLoad?: () => void,
        // area: RUTLÄGET (kartsidan) — bara rutorna runt setDataArea-området,
        // landslagret först när requestNationwide/en för bred vy kräver det.
        opts?: { area?: boolean },
    ): () => void {
        let active = true;
        let baseEvents: LinkEvent[] = [];   // sammanslagna aggregat-lager (utan user-events)
        let userEvents: LinkEvent[] = [];   // senast hämtade användarskapade event
        let boostOverlay: Map<string, Date> = new Map(); // skrapat eventId → featuredUntil (eventBoosts)
        // Engångsvakt: gatens efterhäng får bara kopplas en gång per
        // prenumeration (varje 5-min-poll går annars in här på nytt och
        // staplar identiska hämtningar som alla fyrar när gaten släpps).
        let cardsWaiterAttached = false;
        let timelineWaiterAttached = false;
        // Senast hämtade kortlager + beskrivningshinkar: när destinations BYTS
        // UT (fönster → full tidslinje, ruta → land) måste mergen göras om —
        // annars tappade alla event sina bilder/beskrivningar i bytet.
        let latestCards: any[] | null = null;
        let latestDescs: Record<string, string> | null = null;
        for (const data of descBuckets.values()) latestDescs = { ...(latestDescs ?? {}), ...data };
        const withMerges = (evts: LinkEvent[]): LinkEvent[] => {
            let out = evts;
            if (latestCards) out = mergeCardsWithDestinations(out, latestCards);
            if (latestDescs) out = mergeDescriptionsWithEvents(out, latestDescs);
            return out;
        };
        let initialLoadSignaled = false;
        const signalInitialLoad = () => {
            if (initialLoadSignaled || !active) return;
            initialLoadSignaled = true;
            onInitialLoad?.();
            ensureBoostedEvents();
        };
        // Boost-löftet ("syns varje dag t.o.m. featuredUntil") får inte klippas
        // av fönstret eller rutorna: ett boostat event som lagren inte bär
        // (bortom horisonten, eller i en annan del av landet) hämtas styckvis
        // (ensureEvents) — förut drog det hem HELA tidslinjen åt alla besökare.
        // Boostarna är en handfull; väntar in första laddningen så att event
        // som ändå är på väg i lagren inte hämtas dubbelt.
        function ensureBoostedEvents() {
            if (!initialLoadSignaled || !boostOverlay.size) return;
            const known = new Set(baseEvents.map((e) => e.id));
            const missing = [...boostOverlay.keys()].filter((id) => !known.has(id));
            if (missing.length) void linkEventService.ensureEvents(missing);
        }

        // Slå ihop bas-lager + användarevent och skicka till UI:t.
        function emit() {
            // Boost-overlayn först: featuredUntil läggs på matchande aggregat-
            // event (skrapade boostar bor i eventBoosts, inte på eventet), så
            // guldnål/stickyness/sortering funkar exakt som för boostade
            // användarevent. Utgångna boostar filtreras här — ingen städning.
            let base = baseEvents;
            // Styckhämtade event (ensureEvents) som lagren inte bär — än.
            if (extraEvents.size) {
                const known = new Set(base.map((e) => e.id));
                const add: LinkEvent[] = [];
                for (const e of extraEvents.values()) if (!known.has(e.id)) add.push(e);
                if (add.length) base = [...base, ...add];
            }
            if (boostOverlay.size) {
                const nowMs = Date.now();
                base = base.map((e) => {
                    const until = boostOverlay.get(e.id);
                    return until && until.getTime() > nowMs ? { ...e, featuredUntil: until } : e;
                });
            }
            if (!userEvents.length) { callback(base); return; }
            const known = new Set(base.map((e) => e.id));
            const merged = [...base, ...userEvents.filter((e) => !known.has(e.id))]
                // Boostade event först, därefter kronologiskt som tidigare.
                .sort((a, b) => {
                    const fa = isEventFeatured(a) ? 1 : 0;
                    const fb = isEventFeatured(b) ? 1 : 0;
                    if (fa !== fb) return fb - fa;
                    return a.time.getTime() - b.time.getTime();
                });
            callback(merged);
        }

        // Aggregat-lagren (destinations/cards/descriptions). Tack vare index-doc-
        // cachen i fetchLayer kostar en OFÖRÄNDRAD poll bara 3 reads (en index-doc
        // per lager) i stället för ~51 — shards läses bara om vid ny updatedAt.
        async function loadAggregates() {
            // Statisk-JSON-först (bara FÖRSTA laddningen, inte pollarna): svarar
            // API-routen inte inom STATIC_HEADSTART_MS ritas kartan från deploy-
            // snapshoten så länge — se konstantens kommentar. Snapshoten kan vara
            // några dagar gammal men innehåller framtida event, så dagens prickar
            // finns i stort sett där; färska svaret ersätter när det landar.
            let staticTimer: ReturnType<typeof setTimeout> | null = null;
            let realDestLanded = false;
            const cancelStaticFirst = () => {
                realDestLanded = true;
                if (staticTimer) { clearTimeout(staticTimer); staticTimer = null; }
            };
            if (!baseEvents.length) {
                // Dagens event från TVÅ källor parallellt med fulla lagret.
                // Prioritetsstege (högre ersätter lägre, fulla API-svaret slår
                // allt via realDestLanded): 1 = statisk dagsfil (snabbast,
                // CDN-fil, opåverkad av kallstart), 2 = API-slicen (färskast).
                // Den fulla statiska snapshoten (1,5 s-timern) tar bara helt
                // omålad karta — har dagens prickar redan ritats laddar vi inte
                // 1,5 MB till i onödan (fulla API-svaret är ändå på väg).
                let todayLevel = 0;
                fetchTodayStatic().then((slice) => {
                    if (!active || realDestLanded || todayLevel >= 1 || baseEvents.length || !slice) return;
                    todayLevel = 1;
                    baseEvents = mapDestinationsToLinkEvents(slice);
                    emit();
                });
                fetchTodaySlice().then((slice) => {
                    // Ersätter den statiska dagsfilen (färskare data) men ALDRIG
                    // den fulla snapshoten (baseEvents utan todayLevel = alla
                    // dagar målade — en dagsslice vore en nedgradering).
                    if (!active || realDestLanded || todayLevel >= 2 || !slice) return;
                    if (baseEvents.length && todayLevel === 0) return;
                    todayLevel = 2;
                    baseEvents = mapDestinationsToLinkEvents(slice);
                    emit();
                });
                staticTimer = setTimeout(async () => {
                    try {
                        const res = await fetch('/events-destinations.json');
                        if (!res.ok) return;
                        const data = await res.json();
                        // Hann riktiga svaret/dagsprickarna före (eller är vi
                        // nedstängda)? Rör inget — se prioritetsstegen ovan.
                        if (!active || realDestLanded || baseEvents.length || !data?.events?.length) return;
                        baseEvents = mapDestinationsToLinkEvents(data.events);
                        emit();
                    } catch { /* snapshot saknas/trasig → vänta på riktiga svaret */ }
                }, STATIC_HEADSTART_MS);
            }
            try {
                // 1. Destinations FÖRST och ENSAMT — markörerna behöver bara det
                // här lagret, och på smala mobilnät ska det inte konkurrera om
                // bandbredd med de två större lagren. Ritas direkt när det landat.
                // TIDSFÖNSTRET: standard är de närmaste dagarnas slice; fulla
                // lagret bara när det begärts (eller slicen felar — hellre
                // allt än inget). Pollarna går samma väg, så en redan begärd
                // full tidslinje förblir full.
                const range = timelineWindowRange();
                let destData: any = null;
                if (!fullTimelineRequested) {
                    destData = await fetchTimelineWindow(range);
                    if (destData) loadedHorizonMs = range.toMs;
                }
                if (!destData) {
                    destData = await fetchLayer('destinations');
                    if (destData) loadedHorizonMs = null;
                }
                cancelStaticFirst();
                if (!active || !destData) return;

                baseEvents = withMerges(mapDestinationsToLinkEvents(destData.events || []));
                nationwideLanded = true;
                emit();

                // Full tidslinje på begäran: engångs-waiter (som cards/desc).
                // Landningen ERSÄTTER destinations och gör om lagermergen.
                if (loadedHorizonMs !== null && !timelineWaiterAttached) {
                    timelineWaiterAttached = true;
                    timelineGate.then(async () => {
                        if (!active) return;
                        const full = await fetchLayer('destinations');
                        if (active && full?.events?.length) {
                            loadedHorizonMs = null;
                            baseEvents = withMerges(mapDestinationsToLinkEvents(full.events));
                            emit();
                        }
                    });
                }

                // Definitivt "laddat" REDAN HÄR — dagens lista är komplett
                // (fönstret börjar alltid på dagens midnatt, så "idag" finns
                // fullt ut även i fönsterläget; dagar bortom horisonten
                // hanteras av sidans eventsSettledForView-vakt). Måste dessutom
                // ligga FÖRE gaten nedan: pill-latchen i V2Map kräver settled,
                // och gaten släpps av kartans första målning — signalerades
                // settled först i finally (efter cards/descriptions) vore det
                // moment 22 och allt väntade ut säkerhetsnätet.
                signalInitialLoad();

                // 2. Cards — men först när kartan målat klart (eller
                // säkerhetsnätet gått): ska inte konkurrera med tiles + prickar
                // om bandbredden. Hämtas inte alls om det inte begärts (se
                // kort-gaten). Beskrivningarna går egen väg (hinkar per kort).
                await awaitHeavyLayersGate();
                if (!active) return;
                const cardsData = cardsRequested ? await fetchLayer('cards') : null;
                if (!active) return;
                if (cardsRequested) {
                    if (cardsData) {
                        const cardEvents = cardsData.events || [];
                        latestCards = cardEvents;
                        baseEvents = mergeCardsWithDestinations(baseEvents, cardEvents);
                        emit();
                    }
                    // Även tomt/misslyckat svar räknas som "avgjort" - kortets
                    // bild-skelett ska inte pulsera för evigt; nästa poll
                    // försöker om.
                    signalCardsSettled?.();
                } else if (!cardsWaiterAttached) {
                    cardsWaiterAttached = true;
                    cardsGate.then(async () => {
                        if (!active) return;
                        try {
                            const cd = await fetchLayer('cards');
                            if (active && cd) {
                                const cardEvents = cd.events || [];
                                latestCards = cardEvents;
                                baseEvents = mergeCardsWithDestinations(baseEvents, cardEvents);
                                emit();
                            }
                        } finally {
                            signalCardsSettled?.();
                        }
                    });
                }
            } catch (err) {
                console.error("Error loading events progressively:", err);
                // Fallback to standard SQLite getAll
                if (active) {
                    linkEventService.getAll(onlyFuture).then((evts) => {
                        if (!active) return;
                        // Tom fallback får inte radera snapshot-prickarna som
                        // statisk-JSON-först redan hunnit rita.
                        if (!evts.length && baseEvents.length) return;
                        baseEvents = evts;
                        if (evts.length) nationwideLanded = true;
                        emit();
                    });
                }
            } finally {
                // Fel-/fallbackvägarna ska inte lämna en väntande snapshot-hämtning
                // efter sig (lyckade vägen har redan avbrutit den vid destinations).
                cancelStaticFirst();
                // Destinations-lagret (steg 1) är hämtat här — det innehåller ALLA
                // event med tider, så dagens lista är komplett. Signalera "laddat"
                // (en gång) även om lagret var tomt (äkta tom dag/databas).
                signalInitialLoad();
            }
        }

        // Användarskapade event bor bara i Firestore (inte i aggregaten) → egen,
        // tätare poll så att nyskapade event syns snabbt. Boost-overlayn åker
        // med i samma poll: en nyss betald boost på ett skrapat event ska synas
        // inom ~30 s efter Stripe-återkomsten, och queryn är försumbar bredvid
        // user-event-hämtningen.
        // Vad den senaste FULLA hämtningen såg. Styr count()-probe:n nedan.
        let lastUserCount: number | null = null;
        let lastUserFullFetchMs: number | null = null;
        let userPollInFlight = false;

        async function loadUserEvents() {
            const [u, boosts] = await Promise.all([fetchUserCreatedEvents(), fetchActiveBoosts()]);
            if (!active) return;
            // total === null = hämtningen gick inte fram. Behåll eventen vi
            // redan visar (ett tappat nätvarv ska inte tömma kartan) och lämna
            // räknaren okänd, så nästa varv hämtar om i stället för att tro
            // att listan blivit tom.
            if (u.total !== null) {
                userEvents = u.events;
                lastUserCount = u.total;
                lastUserFullFetchMs = Date.now();
            }
            boostOverlay = boosts;
            ensureBoostedEvents();
            emit();
        }

        /**
         * Ett pollvarv. Kostar ETT read (count) i stället för ett per event,
         * och hämtar hela listan bara när antalet faktiskt ändrats — alltså
         * när någon skapat eller tagit bort ett event.
         *
         * Varför: den gamla pollen läste ALLA userCreated-event var 30:e
         * sekund = ~6 400 reads i timmen per öppen flik, ~90 % av kontots
         * 400 000 reads/dygn (mätt 20/9). Se utils/userEventPoll.
         */
        async function pollUserEvents() {
            if (!active || userPollInFlight) return;
            // Dold flik kostar ingenting alls. Utan den här raden pollade en
            // glömd flik vidare i evighet — det var natt-golvet i mätningen.
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            userPollInFlight = true;
            try {
                const probedCount = await fetchUserCreatedCount();
                if (!active) return;
                const decision = decideUserEventPoll({
                    nowMs: Date.now(),
                    lastFullFetchMs: lastUserFullFetchMs,
                    lastCount: lastUserCount,
                    probedCount,
                });
                if (decision === 'full') await loadUserEvents();
            } finally {
                userPollInFlight = false;
            }
        }

        // ── Rutläget (opts.area) ─────────────────────────────────────────────
        // Rader per ruta, rå destinations-form (mappas i recomposeArea).
        const areaMode = !!opts?.area;
        let nationwide = !areaMode;                    // landslagrets väg (från start, eller begärd)
        let nationwidePromise: Promise<void> | null = null;
        const tileDest = new Map<string, any[]>();
        const tileCards = new Map<string, any[]>();
        const tileFull = new Set<string>();            // rutor hämtade med HELA tidslinjen
        const tileWindow = new Map<string, string>();  // fönstrets fromIso vid hämtningen (dygnsbytet)
        const wanted = new Set<string>();
        let todayRows: any[] = [];                      // dagens landsslice: första målningen
        let todayRowsDay: string | null = null;         // svensk dag slicen gäller
        let areaSyncing = false;
        let areaSyncAgain = false;
        let silenceTimer: ReturnType<typeof setTimeout> | null = null;
        let coverMemo: { key: string; result: boolean } | null = null;

        function tileUrl(layer: 'destinations' | 'cards', tile: string, full: boolean, range: TimelineWindowRange) {
            return full
                ? `/api/events/${layer}?tile=${tile}`
                : `/api/events/${layer}?from=${encodeURIComponent(range.fromIso)}&to=${encodeURIComponent(range.toIso)}&tile=${tile}`;
        }

        function recomposeArea(range: TimelineWindowRange) {
            // Landslagret har tagit över — rutorna får inte skriva över det.
            if (nationwideLanded) return;
            const cards: any[] = [];
            for (const c of tileCards.values()) cards.push(...c);
            if (tileCards.size) latestCards = cards;
            baseEvents = withMerges(mapDestinationsToLinkEvents(composeAreaRows(todayRows, tileDest)));
            const allFull = tileDest.size > 0 && [...tileDest.keys()].every((t) => tileFull.has(t));
            loadedHorizonMs = fullTimelineRequested && allFull ? null : range.toMs;
            coverMemo = null;
        }

        /** Hämta det som saknas för de önskade rutorna (refreshAll = pollen:
         *  allt om, ETag/304 gör oförändrade rutor nästan gratis). Körs en åt
         *  gången; krav som tillkommer under tiden tas i ett varv till. */
        async function syncArea(refreshAll = false) {
            if (nationwide || !active) return;
            if (areaSyncing) { areaSyncAgain = true; return; }
            areaSyncing = true;
            try {
                let refresh = refreshAll;
                do {
                    areaSyncAgain = false;
                    const range = timelineWindowRange();
                    const full = fullTimelineRequested;
                    const withCards = cardsRequested;
                    const jobs = [...wanted].map((tile) => {
                        const needDest = refresh || !tileDest.has(tile)
                            || (full ? !tileFull.has(tile) : (!tileFull.has(tile) && tileWindow.get(tile) !== range.fromIso));
                        const needCards = withCards && (needDest || !tileCards.has(tile));
                        return { tile, needDest, needCards };
                    }).filter((j) => j.needDest || j.needCards);
                    refresh = false;
                    if (!jobs.length) break;
                    const results = await Promise.all(jobs.map(async (j) => {
                        const [d, c] = await Promise.all([
                            j.needDest ? fetchJsonTwice(tileUrl('destinations', j.tile, full, range)) : Promise.resolve(null),
                            j.needCards ? fetchJsonTwice(tileUrl('cards', j.tile, full, range)) : Promise.resolve(null),
                        ]);
                        return { ...j, d, c };
                    }));
                    if (!active || nationwide) return;
                    let failed = false;
                    for (const r of results) {
                        if (r.needDest) {
                            if (!r.d) { failed = true; continue; }
                            tileDest.set(r.tile, Array.isArray(r.d.events) ? r.d.events : []);
                            tileWindow.set(r.tile, range.fromIso);
                            if (full) tileFull.add(r.tile); else tileFull.delete(r.tile);
                        }
                        // Misslyckat kortsvar: rutan står utan kort tills nästa
                        // varv/poll — "avgjort" ändå, så skelettet inte pulserar.
                        if (r.needCards && r.c) tileCards.set(r.tile, Array.isArray(r.c.events) ? r.c.events : []);
                    }
                    recomposeArea(range);
                    emit();
                    if (withCards) signalCardsSettled?.();
                    if (failed) {
                        // Rutvägen svarar inte (routen nere, kallstart som
                        // klipper svaret) → landslagrets väg, som har den
                        // statiska reserven. Hellre allt än tomt.
                        void goNationwide();
                        return;
                    }
                    if ([...wanted].every((t) => tileDest.has(t))) signalInitialLoad();
                } while (areaSyncAgain);
            } finally {
                areaSyncing = false;
            }
        }

        function goNationwide(): Promise<void> {
            if (!nationwidePromise) {
                nationwide = true;
                if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
                nationwidePromise = loadAggregates();
            }
            return nationwidePromise;
        }

        // Dagens landsslice (statisk fil + API, som förut) ritar första
        // prickarna innan området är känt — och står kvar UTANFÖR de laddade
        // rutorna (composeAreaRows), så dagens prickar finns över hela landet.
        function startTodaySlices() {
            let todayLevel = 0;
            const take = (level: number) => (rows: any[] | null) => {
                if (!active || !rows || todayLevel >= level || nationwideLanded) return;
                todayLevel = level;
                todayRows = rows;
                todayRowsDay = STOCKHOLM_DAY_FMT.format(new Date());
                recomposeArea(timelineWindowRange());
                emit();
            };
            fetchTodayStatic().then(take(1));
            fetchTodaySlice().then(take(2));
        }

        const controller: AreaController = {
            want(tiles) {
                if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; }
                let added = false;
                for (const t of tiles) if (!wanted.has(t)) { wanted.add(t); added = true; }
                if (added) void syncArea();
            },
            goNationwide,
            covers(b) {
                if (nationwideLanded) return true;
                const key = `${b.west}|${b.south}|${b.east}|${b.north}`;
                if (coverMemo?.key === key) return coverMemo.result;
                const result = boundsCoveredBy(b, new Set(tileDest.keys()));
                coverMemo = { key, result };
                return result;
            },
            // En mikrotask senare: sökningen/arrangörsfiltret begär kort +
            // full tidslinje + landet i SAMMA tick — landsbegäran ska hinna
            // före, annars hämtades rutornas kort i onödan först.
            refresh() { queueMicrotask(() => { void syncArea(); }); },
        };

        // Beskrivningshinkar och styckhämtade event landar via modulens krokar.
        onDescriptionsLanded = (data) => {
            if (!active) return;
            latestDescs = { ...(latestDescs ?? {}), ...data };
            baseEvents = mergeDescriptionsWithEvents(baseEvents, data);
            emit();
        };
        knownEventIds = () => {
            const ids = new Set(baseEvents.map((e) => e.id));
            for (const e of userEvents) ids.add(e.id);
            return ids;
        };
        onExtrasLanded = () => { if (active) emit(); };

        // Initial laddning.
        if (areaMode) {
            nationwideLanded = false;
            activeArea = controller;
            startTodaySlices();
            if (nationwideWanted) void goNationwide();
            else if (lastAreaTiles) controller.want(lastAreaTiles);
            else {
                silenceTimer = setTimeout(() => {
                    silenceTimer = null;
                    if (active && !wanted.size) void goNationwide();
                }, AREA_SILENCE_MS);
            }
        } else {
            loadAggregates();
        }
        loadUserEvents();

        // Aggregaten ändras ~1×/dygn (efter scrape) → glesa pollen till 5 min;
        // ETag/304 gör dessutom oförändrade pollar nästan gratis. Rutläget
        // frågar om sina rutor (och byter fönster vid dygnsskiftet).
        const aggregateInterval = setInterval(() => {
            if (nationwide) { void loadAggregates(); return; }
            // Dygnsskiftet: gårdagens "idag"-slice får inte ligga kvar som
            // prickar utanför rutorna (rutorna själva byter fönster nedan).
            if (todayRowsDay && todayRowsDay !== STOCKHOLM_DAY_FMT.format(new Date())) {
                todayRows = [];
                todayRowsDay = null;
            }
            void syncArea(true);
        }, 5 * 60 * 1000);
        // Användarevent kan dyka upp när som helst → behåll snabb 30 s-takt.
        // Takten är kvar, det är KOSTNADEN per varv som är borta.
        const userInterval = setInterval(pollUserEvents, 30000);

        // Flik som kommer tillbaka i förgrunden ska visa färskt direkt i
        // stället för att vänta ut nästa tick (och säkerhetsnätet i
        // decideUserEventPoll ser till att en länge dold flik hämtar om helt).
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') void pollUserEvents();
        };
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibilityChange);
        }

        // Returnera avprenumerations-funktion för att stänga polling-intervallen vid unmount
        return () => {
            active = false;
            clearInterval(aggregateInterval);
            clearInterval(userInterval);
            if (silenceTimer) clearTimeout(silenceTimer);
            if (activeArea === controller) activeArea = null;
            onDescriptionsLanded = null;
            knownEventIds = null;
            onExtrasLanded = null;
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', onVisibilityChange);
            }
        };
    }
};
