import {
  collection, getDocs, addDoc, doc, updateDoc, getDoc, Timestamp,
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
          time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time)
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
          time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time)
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
          time: data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time)
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
      time: Timestamp.fromDate(event.time)
    };
    return await addDoc(collection(db, COLLECTION), payload);
  },

  // Uppdatera
  async update(event: AppEvent) {
    const ref = doc(db, COLLECTION, event.id);
    // Vi plockar bort id innan vi sparar till Firestore
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...data } = event;

    await updateDoc(ref, {
      ...data,
      time: Timestamp.fromDate(event.time)
    });
  }
};