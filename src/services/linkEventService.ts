import {
    collection, getDocs, addDoc, doc, deleteDoc, Timestamp,
    query, where, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { LinkEvent, FirestoreLinkEventData } from '../types';

const COLLECTION = 'linkEvents';

export const linkEventService = {
    // Hämta alla aktiva link events (framtida events)
    async getAll(): Promise<LinkEvent[]> {
        try {
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Start of today

            const q = query(
                collection(db, COLLECTION),
                where("time", ">=", Timestamp.fromDate(now))
            );
            const snap = await getDocs(q);
            return snap.docs.map(doc => {
                const data = doc.data() as FirestoreLinkEventData;
                return {
                    ...data,
                    id: doc.id,
                    time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time),
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
                };
            });
        } catch (error) {
            console.error("Error fetching link events:", error);
            return [];
        }
    },

    // Skapa nytt link event
    async create(linkEvent: Omit<LinkEvent, 'id' | 'createdAt'>) {
        const payload = {
            ...linkEvent,
            time: Timestamp.fromDate(linkEvent.time),
            createdAt: Timestamp.now()
        };
        return await addDoc(collection(db, COLLECTION), payload);
    },

    // Ta bort link event
    async delete(id: string) {
        const ref = doc(db, COLLECTION, id);
        await deleteDoc(ref);
    },

    // Bulk create - Skapa flera events samtidigt (atomic operation)
    async bulkCreate(linkEvents: Omit<LinkEvent, 'id' | 'createdAt'>[]): Promise<number> {
        if (linkEvents.length === 0) return 0;

        const batch = writeBatch(db);
        const collectionRef = collection(db, COLLECTION);

        linkEvents.forEach(event => {
            const docRef = doc(collectionRef); // Auto-generate ID
            const payload = {
                ...event,
                time: Timestamp.fromDate(event.time),
                createdAt: Timestamp.now()
            };
            batch.set(docRef, payload);
        });

        await batch.commit();
        return linkEvents.length;
    },

    // Bulk delete - Ta bort flera events samtidigt (atomic operation)
    async bulkDelete(eventIds: string[]): Promise<number> {
        if (eventIds.length === 0) return 0;

        const batch = writeBatch(db);

        eventIds.forEach(id => {
            const docRef = doc(db, COLLECTION, id);
            batch.delete(docRef);
        });

        await batch.commit();
        return eventIds.length;
    }
};
