import type { LinkEvent } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getAuthHeaders } from '../lib/authHeaders';

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
                } as LinkEvent;
            })
            .filter((e) => e.title && e.time >= cutoff && !(e as any).hidden);
    } catch (e) {
        console.warn('Kunde inte hämta användarskapade event:', e);
        return [];
    }
}

async function fetchLayer(layerName: 'destinations' | 'cards' | 'descriptions'): Promise<any> {
    // 1. Try Firestore Client SDK first
    try {
        if (db) {
            const docRef = doc(db, 'aggregatedEvents', layerName);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                const data: any = snapshot.data();
                if (data) {
                    // Shardad: index-doc har shardCount men ingen events/data.
                    // Slå ihop alla shards.
                    if (typeof data.shardCount === 'number' && data.shardCount > 0) {
                        return await fetchShards(layerName, data.shardCount, data.updatedAt);
                    }
                    return data;
                }
            }
        }
    } catch (e) {
        console.warn(`Firestore read failed for layer "${layerName}". Falling back to static JSON:`, e);
    }

    // 2. Fallback to fetching static JSON from the public directory
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

/** Hämta och slå ihop shards parallellt (cards_0…cards_N eller descriptions_0…) */
async function fetchShards(layerName: string, shardCount: number, updatedAt: any): Promise<any> {
    if (!db) return null;
    const refs = Array.from({ length: shardCount }, (_, i) => doc(db, 'aggregatedEvents', `${layerName}_${i}`));
    const snaps = await Promise.all(refs.map((r) => getDoc(r)));

    if (layerName === 'descriptions') {
        // Slå ihop data-objekt
        const data: Record<string, string> = {};
        for (const s of snaps) {
            if (s.exists()) Object.assign(data, (s.data() as any).data || {});
        }
        return { updatedAt, data };
    }
    // cards / destinations: slå ihop events-array
    const events: any[] = [];
    for (const s of snaps) {
        if (s.exists()) events.push(...((s.data() as any).events || []));
    }
    return { updatedAt, events };
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
    // Hämta link events
    async getAll(onlyFuture = true): Promise<LinkEvent[]> {
        try {
            // First load destinations and cards in parallel
            const [destData, cardsData] = await Promise.all([
                fetchLayer('destinations'),
                fetchLayer('cards')
            ]);

            if (!destData) return [];

            let events = mapDestinationsToLinkEvents(destData.events || []);

            if (cardsData) {
                events = mergeCardsWithDestinations(events, cardsData.events || []);
            }

            // Fetch descriptions in background or in parallel if needed
            const descData = await fetchLayer('descriptions');
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
     */
    async createUserEvent(input: {
        title: string; time: Date; lat: number; lng: number;
        locationName?: string; category?: string; description?: string;
        hostName: string; hostUid: string;
    }): Promise<string> {
        if (!db) throw new Error('Firestore ej initierad');
        const ref = await addDoc(collection(db, 'linkEvents'), {
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
            url: '',
            isLocationVerified: true,
            createdAt: serverTimestamp(),
        });
        return ref.id;
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
    subscribeToAll(onlyFuture: boolean, callback: (events: LinkEvent[]) => void): () => void {
        let active = true;

        async function loadProgressively() {
            try {
                // 1. Fetch and render Destinations instantly
                const destData = await fetchLayer('destinations');
                if (!active || !destData) return;

                let events = mapDestinationsToLinkEvents(destData.events || []);
                callback(events);

                // 2. Fetch and merge Cards
                const cardsData = await fetchLayer('cards');
                if (!active) return;

                if (cardsData) {
                    events = mergeCardsWithDestinations(events, cardsData.events || []);
                    callback(events);
                }

                // 3. Fetch and merge Descriptions
                const descData = await fetchLayer('descriptions');
                if (!active) return;

                if (descData && descData.data) {
                    events = mergeDescriptionsWithEvents(events, descData.data);
                    callback(events);
                }

                // 4. Användarskapade event (bor bara i Firestore, inte i aggregaten)
                const userEvents = await fetchUserCreatedEvents();
                if (!active) return;
                if (userEvents.length) {
                    const known = new Set(events.map((e) => e.id));
                    events = [...events, ...userEvents.filter((e) => !known.has(e.id))]
                        .sort((a, b) => a.time.getTime() - b.time.getTime());
                    callback(events);
                }
            } catch (err) {
                console.error("Error loading events progressively:", err);
                // Fallback to standard SQLite getAll
                if (active) {
                    linkEventService.getAll(onlyFuture).then(evts => {
                        if (active) callback(evts);
                    });
                }
            }
        }

        loadProgressively();

        // Polla var 30:e sekund för progressiva lager
        const intervalId = setInterval(() => {
            loadProgressively();
        }, 30000);

        // Returnera avprenumerations-funktion för att stänga polling-intervallet vid unmount
        return () => {
            active = false;
            clearInterval(intervalId);
        };
    }
};
