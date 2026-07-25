import type { LinkEvent } from '../types';
import { db } from '../lib/firebase';
import { doc, collection, query, where, getDocs, addDoc, deleteDoc, setDoc, onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getAuthHeaders } from '../lib/authHeaders';

/**
 * Är eventet boostat just nu? Sant om featuredUntil finns och ligger i framtiden.
 * Delad av kartan (pin-utseende) och sorteringen så att en passerad boost
 * automatiskt slutar gälla utan någon städning.
 */
export function isEventFeatured(e: { featuredUntil?: Date } | null | undefined): boolean {
    return !!e?.featuredUntil && e.featuredUntil.getTime() > Date.now();
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
async function fetchUserCreatedEvents(): Promise<LinkEvent[]> {
    try {
        if (!db) return [];
        const q = query(collection(db, 'linkEvents'), where('userCreated', '==', true));
        const snap = await getDocs(q);
        const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
        return snap.docs
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
                    coverImage: '',
                    description: v.description || '',
                    attendees: 0,
                    isLocationVerified: true,
                    hasSpecificTime: deriveHasSpecificTime(time),
                    userCreated: true,
                    hostUid: v.hostUid || undefined,
                    featuredUntil,
                } as LinkEvent;
            })
            .filter((e) => e.title && e.time >= cutoff && !(e as any).hidden);
    } catch (e) {
        console.warn('Kunde inte hämta användarskapade event:', e);
        return [];
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
async function fetchTodaySlice(): Promise<LinkEvent[] | null> {
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
        return mapDestinationsToLinkEvents(data.events);
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

async function fetchTodayStatic(): Promise<LinkEvent[] | null> {
    try {
        const w = window as unknown as { __vadkulTodayStatic?: Promise<{ day?: string; events?: unknown[] } | null> };
        const data = w.__vadkulTodayStatic
            ? await w.__vadkulTodayStatic
            : await fetch('/events-today.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
        if (!data?.events?.length) return null;
        if (data.day !== STOCKHOLM_DAY_FMT.format(new Date())) return null; // förlegad fil
        return mapDestinationsToLinkEvents(data.events);
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

async function fetchLayer(layerName: 'destinations' | 'cards' | 'descriptions'): Promise<any> {
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
        const time = new Date(evt.time);
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
            hasSpecificTime: hasSpecificTimeOf(evt, time),
        };
    });
}

function mergeCardsWithDestinations(destEvents: LinkEvent[], cards: any[]): LinkEvent[] {
    const cardMap = new Map<string, any>();
    cards.forEach(c => cardMap.set(c.id, c));

    return destEvents.map(evt => {
        const card = cardMap.get(evt.id);
        if (!card) return evt;
        return {
            ...evt,
            coverImage: card.coverImage,
            hostName: card.hostName,
            attendees: card.attendees,
            price: card.price ?? '',
            isLocationVerified: card.isLocationVerified,
            isHostVerified: card.isHostVerified,
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
    releaseHeavyLayers() { releaseHeavyGate?.(); },

    // Hämta link events
    async getAll(onlyFuture = true): Promise<LinkEvent[]> {
        try {
            // Alla tre lagren parallellt — descriptions hämtades tidigare SERIELLT
            // efter de andra två, vilket bara adderade väntetid före första kartritningen.
            const [destData, cardsData, descData] = await Promise.all([
                fetchLayer('destinations'),
                fetchLayer('cards'),
                fetchLayer('descriptions'),
            ]);

            if (!destData) return [];

            let events = mapDestinationsToLinkEvents(destData.events || []);

            if (cardsData) {
                events = mergeCardsWithDestinations(events, cardsData.events || []);
            }

            if (descData && descData.data) {
                events = mergeDescriptionsWithEvents(events, descData.data);
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
        hostName: string; hostUid: string; coverImage?: string; url?: string;
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
        const ref = await addDoc(collection(db, 'linkEvents'), payload);
        return ref.id;
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
    ): () => void {
        let active = true;
        let baseEvents: LinkEvent[] = [];   // sammanslagna aggregat-lager (utan user-events)
        let userEvents: LinkEvent[] = [];   // senast hämtade användarskapade event
        let initialLoadSignaled = false;
        const signalInitialLoad = () => {
            if (initialLoadSignaled || !active) return;
            initialLoadSignaled = true;
            onInitialLoad?.();
        };

        // Slå ihop bas-lager + användarevent och skicka till UI:t.
        function emit() {
            if (!userEvents.length) { callback(baseEvents); return; }
            const known = new Set(baseEvents.map((e) => e.id));
            const merged = [...baseEvents, ...userEvents.filter((e) => !known.has(e.id))]
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
                    baseEvents = slice;
                    emit();
                });
                fetchTodaySlice().then((slice) => {
                    // Ersätter den statiska dagsfilen (färskare data) men ALDRIG
                    // den fulla snapshoten (baseEvents utan todayLevel = alla
                    // dagar målade — en dagsslice vore en nedgradering).
                    if (!active || realDestLanded || todayLevel >= 2 || !slice) return;
                    if (baseEvents.length && todayLevel === 0) return;
                    todayLevel = 2;
                    baseEvents = slice;
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
                const destData = await fetchLayer('destinations');
                cancelStaticFirst();
                if (!active || !destData) return;

                baseEvents = mapDestinationsToLinkEvents(destData.events || []);
                emit();

                // Definitivt "laddat" REDAN HÄR — destinations innehåller alla
                // event med tider, så dagens lista är komplett. Måste dessutom
                // ligga FÖRE gaten nedan: pill-latchen i V2Map kräver settled,
                // och gaten släpps av kartans första målning — signalerades
                // settled först i finally (efter cards/descriptions) vore det
                // moment 22 och allt väntade ut säkerhetsnätet.
                signalInitialLoad();

                // 2+3. Cards + descriptions PARALLELLT (laddades förr i serie =
                // onödigt lång svans innan bilder/arrangörer/beskrivningar fanns)
                // — men först när kartan målat klart (eller säkerhetsnätet gått):
                // de ska inte konkurrera med tiles + prickar om bandbredden.
                await awaitHeavyLayersGate();
                if (!active) return;
                const [cardsData, descData] = await Promise.all([
                    fetchLayer('cards'),
                    fetchLayer('descriptions'),
                ]);
                if (!active) return;
                if (cardsData) {
                    baseEvents = mergeCardsWithDestinations(baseEvents, cardsData.events || []);
                    emit();
                }
                if (descData && descData.data) {
                    baseEvents = mergeDescriptionsWithEvents(baseEvents, descData.data);
                    emit();
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
        // tätare poll så att nyskapade event syns snabbt.
        async function loadUserEvents() {
            const u = await fetchUserCreatedEvents();
            if (!active) return;
            userEvents = u;
            emit();
        }

        // Initial: ladda allt direkt.
        loadAggregates();
        loadUserEvents();

        // Aggregaten ändras ~1×/dygn (efter scrape) → glesa pollen till 5 min;
        // index-doc-cachen gör dessutom oförändrade pollar nästan gratis.
        const aggregateInterval = setInterval(loadAggregates, 5 * 60 * 1000);
        // Användarevent kan dyka upp när som helst → behåll snabb 30 s-poll.
        const userInterval = setInterval(loadUserEvents, 30000);

        // Returnera avprenumerations-funktion för att stänga polling-intervallen vid unmount
        return () => {
            active = false;
            clearInterval(aggregateInterval);
            clearInterval(userInterval);
        };
    }
};
