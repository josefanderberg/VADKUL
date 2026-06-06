import type { LinkEvent } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

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

function mapDestinationsToLinkEvents(events: any[]): LinkEvent[] {
    return events.map((evt: any) => ({
        id: evt.id,
        url: evt.id,
        title: evt.title,
        time: new Date(evt.time),
        createdAt: new Date(),
        locationName: evt.locationName,
        lat: evt.lat,
        lng: evt.lng,
        hostName: '',
        category: evt.category || 'other',
        coverImage: '',
        description: '',
        attendees: 0,
        isLocationVerified: evt.isLocationVerified || false
    }));
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

    // Skapa nytt link event
    async create(linkEvent: Omit<LinkEvent, 'id' | 'createdAt'>) {
        const res = await fetch('/api/link-events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            method: 'DELETE'
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
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
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
            headers: { 'Content-Type': 'application/json' },
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
