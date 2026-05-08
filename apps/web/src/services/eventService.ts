import {
  collection, getDocs, addDoc, doc, updateDoc, getDoc, deleteDoc, Timestamp,
  query, where, increment, orderBy, startAt, endAt
} from 'firebase/firestore';
import { geohashForLocation, geohashQueryBounds, distanceBetween } from 'geofire-common';
import { db } from '../lib/firebase';
import type { AppEvent, FirestoreEventData } from '../types'; // OBS: "import type"

const COLLECTION = 'events';

export const eventService = {
  // Hämta alla
  async getAll(): Promise<AppEvent[]> {
    try {
      // Filter: Only fetch events that have not ended yet (or start in future)
      // Note: "time" is the start time. We want events where time >= now.
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today

      const q = query(
        collection(db, COLLECTION),
        where("time", ">=", Timestamp.fromDate(now))
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
      console.error("Error fetching events:", error);
      return [];
    }
  },

  // Hämta events inom en radie (Geo-querying)
  async getEventsInBounds(center: [number, number], radiusInMeters: number): Promise<AppEvent[]> {
    try {
      const bounds = geohashQueryBounds(center, radiusInMeters);
      const promises = [];
      const now = new Date(); // Filter events from start of today
      now.setHours(0, 0, 0, 0);

      for (const b of bounds) {
        const q = query(
          collection(db, COLLECTION),
          orderBy('geohash'),
          startAt(b[0]),
          endAt(b[1])
          // Note: We can't composite query 'geohash' + 'time' easily without specific indexes for every combination.
          // Instead, we fetch purely by geohash and filter time/distance in memory.
        );
        promises.push(getDocs(q));
      }

      const snapshots = await Promise.all(promises);
      const matchingDocs: AppEvent[] = [];
      const seenIds = new Set<string>();

      for (const snap of snapshots) {
        for (const doc of snap.docs) {
          if (seenIds.has(doc.id)) continue;

          const data = doc.data() as FirestoreEventData;

          // 1. Client-side Time Filter (Events from today onwards)
          const eventTime = data.time instanceof Timestamp ? data.time.toDate() : new Date(data.time);
          if (eventTime < now) continue;

          // 2. Client-side Distance Filter
          // Lat/Lng are required for distance calc
          const lat = data.lat;
          const lng = data.lng;

          if (!lat || !lng) continue;

          const distanceInKm = distanceBetween([lat, lng], center);
          const distanceInM = distanceInKm * 1000;

          if (distanceInM <= radiusInMeters) {
            seenIds.add(doc.id);
            matchingDocs.push({
              ...data,
              id: doc.id,
              time: eventTime,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt || 0) : undefined)
            });
          }
        }
      }

      return matchingDocs;

    } catch (error) {
      console.error("Error fetching events in bounds:", error);
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
    const hash = geohashForLocation([event.lat, event.lng]);
    const payload = {
      ...event,
      views: 0,
      geohash: hash,
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

    // Recalculate geohash if lat/lng changed (always calculating to be safe)
    const hash = geohashForLocation([event.lat, event.lng]);

    // Sanitize data: Remove undefined fields and convert Dates to Timestamps
    const payload: any = { ...data, geohash: hash };

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
  },

  // Uppdatera ENDAST deltagare (för att matcha säkerhetsregler)
  async updateAttendees(eventId: string, attendees: any[]) {
    const ref = doc(db, COLLECTION, eventId);
    await updateDoc(ref, { attendees });
  },

  async incrementViews(id: string) {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, {
      views: increment(1)
    });
  },

  // Uppdatera host-data på alla events när användaren byter profil
  async updateEventsHostData(uid: string, hostData: { name: string; photoURL: string | null; verified: boolean }) {
    try {
      // 1. Hämta alla events där jag är värd
      const q = query(collection(db, COLLECTION), where("host.uid", "==", uid));
      const snap = await getDocs(q);

      if (snap.empty) return;

      // 2. Uppdatera alla (batch hade varit bättre men loop funkar för nu och är enklare med typerna)
      const updates = snap.docs.map(docSnapshot => {
        const eventData = docSnapshot.data() as FirestoreEventData;
        const ref = doc(db, COLLECTION, docSnapshot.id);

        return updateDoc(ref, {
          host: {
            ...eventData.host,
            name: hostData.name,
            photoURL: hostData.photoURL,
            verified: hostData.verified
          }
        });
      });

      await Promise.all(updates);
      console.log(`Updated host data for ${updates.length} events.`);

    } catch (error) {
      console.error("Failed to sync host data to events:", error);
      throw error;
    }
  },

  // Migrera events för att lägga till geohash
  async migrateEventsToGeo() {
    try {
      const snap = await getDocs(collection(db, COLLECTION));
      console.log(`Checking ${snap.size} events for missing geohash...`);
      let updated = 0;

      const updates = snap.docs.map(async (docSnap) => {
        const data = docSnap.data();
        // Om geohash saknas men lat/lng finns
        if (!data.geohash && data.lat && data.lng) {
          const hash = geohashForLocation([data.lat, data.lng]);
          await updateDoc(doc(db, COLLECTION, docSnap.id), { geohash: hash });
          updated++;
        }
      });

      await Promise.all(updates);
      return updated;
    } catch (error) {
      console.error("Migration failed:", error);
      throw error;
    }
  }
};