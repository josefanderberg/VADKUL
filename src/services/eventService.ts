import {
  collection, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc, Timestamp,
  query, where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AppEvent, FirestoreEventData } from '../types'; // OBS: "import type"

const COLLECTION = 'events';

export const eventService = {
  // Hämta alla
  async getAll(): Promise<AppEvent[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      return snap.docs.map(doc => {
        const data = doc.data() as FirestoreEventData;
        return {
          ...data,
          id: doc.id,
          time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined)
        };
      });
    } catch (error) {
      console.error("Error fetching events:", error);
      return [];
    }
  },

  // Hämta events där jag är värd (Optimerad)
  async getHostedEvents(uid: string): Promise<AppEvent[]> {
    try {
      const q = query(
        collection(db, COLLECTION),
        where("host.uid", "==", uid)
        // orderBy("time", "desc") // Kräver index om host.uid blandas med timesortering, avvaktar
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => {
        const data = doc.data() as FirestoreEventData;
        return {
          ...data,
          id: doc.id,
          time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined)
        };
      });
    } catch (error) {
      console.error("Error fetching hosted events:", error);
      return [];
    }
  },

  // Hämta en
  async getById(id: string): Promise<AppEvent | null> {
    try {
      const ref = doc(db, COLLECTION, id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as FirestoreEventData;
        return {
          ...data,
          id: snap.id,
          time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined)
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching event:", error);
      return null;
    }
  },

  // Skapa
  async create(event: Omit<AppEvent, 'id'>) {
    const payload = {
      ...event,
      time: Timestamp.fromDate(event.time),
      createdAt: Timestamp.now() // Use client-side timestamp for simplicity effectively matching server
    };
    return await addDoc(collection(db, COLLECTION), payload);
  },

  // Uppdatera
  async update(event: AppEvent) {
    const ref = doc(db, COLLECTION, event.id);
    // Vi plockar bort id innan vi sparar till Firestore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...data } = event;

    // Sanitize data: Remove undefined fields and convert Dates to Timestamps
    const payload: any = { ...data };

    // Convert known dates
    payload.time = Timestamp.fromDate(event.time);
    if (event.createdAt) {
      payload.createdAt = Timestamp.fromDate(event.createdAt);
    } else {
      delete payload.createdAt; // Ensure it's not undefined
    }

    // Helper to recursively clean undefined from objects/arrays if needed, 
    // but for now shallow cleanup for top-level undefined is likely what's needed for 'createdAt' if it's on the root.
    // However, the error said "found in field createdAt in document events/...". 
    // If it's a root field, the above handles it.
    // If it's inside 'attendees' array, we need deep sanitization or fix the caller.
    // Given the error message "found in field createdAt", it usually refers to top-level or specific path.
    // If it was nested, it might say "attendees[0].createdAt".
    // Let's assume top level for now, but also clean up the payload object.

    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    await updateDoc(ref, payload);
  },

  // Ta bort
  async delete(id: string) {
    const ref = doc(db, COLLECTION, id);
    await deleteDoc(ref);
  }
};