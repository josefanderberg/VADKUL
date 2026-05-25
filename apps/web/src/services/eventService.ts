import type { AppEvent } from '../types';
import { calculateDistance } from '../utils/mapUtils';

export const eventService = {
    // Hämta alla event
    async getAll(): Promise<AppEvent[]> {
        try {
            const res = await fetch('/api/events?all=true');
            if (!res.ok) throw new Error('Failed to fetch events');
            const data = await res.json();
            return data.map((evt: any) => ({
                ...evt,
                time: new Date(evt.time),
                createdAt: evt.createdAt ? new Date(evt.createdAt) : undefined
            }));
        } catch (error) {
            console.error("Error fetching events:", error);
            return [];
        }
    },

    // Hämta events inom en radie (Geo-querying lokalt i minnet)
    async getEventsInBounds(center: [number, number], radiusInMeters: number): Promise<AppEvent[]> {
        try {
            // Hämta alla framtida event
            const res = await fetch('/api/events');
            if (!res.ok) throw new Error('Failed to fetch events in bounds');
            const data = await res.json();
            
            const events = data.map((evt: any) => ({
                ...evt,
                time: new Date(evt.time),
                createdAt: evt.createdAt ? new Date(evt.createdAt) : undefined
            }));

            // Filtrera efter avstånd lokalt (super-snabbt eftersom det körs på klienten i minnet)
            return events.filter((event: AppEvent) => {
                if (!event.lat || !event.lng) return false;
                const distanceInKm = calculateDistance(center[0], center[1], event.lat, event.lng);
                const distanceInM = distanceInKm * 1000;
                return distanceInM <= radiusInMeters;
            });
        } catch (error) {
            console.error("Error fetching events in bounds:", error);
            return [];
        }
    },

    // Hämta events där jag är värd
    async getHostedEvents(uid: string): Promise<AppEvent[]> {
        try {
            const events = await this.getAll();
            return events.filter(e => e.host?.uid === uid);
        } catch (error) {
            console.error("Error fetching hosted events:", error);
            return [];
        }
    },

    // Hämta ett specifikt event
    async getById(id: string): Promise<AppEvent | null> {
        try {
            const res = await fetch(`/api/events?id=${encodeURIComponent(id)}`);
            if (!res.ok) {
                if (res.status === 404) return null;
                throw new Error('Failed to fetch event');
            }
            const evt = await res.json();
            return {
                ...evt,
                time: new Date(evt.time),
                createdAt: evt.createdAt ? new Date(evt.createdAt) : undefined
            };
        } catch (error) {
            console.error("Error fetching event:", error);
            return null;
        }
    },

    // Skapa ett event
    async create(event: Omit<AppEvent, 'id'>) {
        const res = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to create event');
        }
        return await res.json(); // Returnerar { success: true, id }
    },

    // Uppdatera ett event
    async update(event: AppEvent) {
        const res = await fetch(`/api/events?id=${encodeURIComponent(event.id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to update event');
        }
        return await res.json();
    },

    // Ta bort ett event
    async delete(id: string) {
        const res = await fetch(`/api/events?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to delete event');
        }
        return await res.json();
    },

    // Uppdatera endast deltagare
    async updateAttendees(eventId: string, attendees: any[]) {
        const event = await this.getById(eventId);
        if (event) {
            event.attendees = attendees;
            return await this.update(event);
        }
        throw new Error('Event not found to update attendees');
    },

    // Öka antal visningar
    async incrementViews(id: string) {
        try {
            const event = await this.getById(id);
            if (event) {
                event.views = (event.views || 0) + 1;
                await this.update(event);
            }
        } catch (error) {
            console.error('Failed to increment views in SQLite:', error);
        }
    },

    // Synka värd-profil data
    async updateEventsHostData(uid: string, hostData: { name: string; photoURL: string | null; verified: boolean }) {
        try {
            const hosted = await this.getHostedEvents(uid);
            const updates = hosted.map(event => {
                event.host = {
                    ...event.host,
                    name: hostData.name,
                    photoURL: hostData.photoURL,
                    verified: hostData.verified
                };
                return this.update(event);
            });
            await Promise.all(updates);
            console.log(`Synced host data for ${hosted.length} events in SQLite.`);
        } catch (error) {
            console.error("Failed to sync host data to SQLite events:", error);
            throw error;
        }
    },

    // Geo-migrering (Ej längre nödvändig i SQLite men behålls för kompatibilitet)
    async migrateEventsToGeo() {
        return 0;
    }
};