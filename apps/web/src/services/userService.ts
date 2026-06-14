// src/services/userService.ts
import { doc, setDoc, getDoc, Timestamp, runTransaction, collection, query, orderBy, limit, getDocs, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

export const userService = {
  // Skapa eller uppdatera användarprofil i databasen
  async createUserProfile(uid: string, data: Omit<UserProfile, 'uid' | 'createdAt'> & { referrerUid?: string }) {
    const userRef = doc(db, 'users', uid);

    // Sanitize data: Remove undefined values which Firestore doesn't support
    // (We allow null for explicit clearing if supported by types, but remove undefined)
    const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined && key !== 'referrerUid') { // Exclude referrerUid from being saved directly
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    // Prepare payload
    const payload = {
      ...sanitizedData,
      uid,
      createdAt: Timestamp.now(),
      inviteCount: 0 // Initiera räknare
    };

    // Om vi har en referrer, spara det
    if (data.referrerUid) {
      payload.invitedBy = data.referrerUid;
    }

    await setDoc(userRef, payload, { merge: true });

    // Om referrer finns, öka deras räknare
    if (data.referrerUid) {
      const referrerRef = doc(db, 'users', data.referrerUid);
      // Använd updateDoc för att inte skriva över hela dokumentet, och increment
      // Vi bryr oss inte om att vänta på denna (fire and forget) eller så gör vi det?
      // Bäst att vänta för att undvika race-conditions i tester, men för UI är det inte så noga.
      // Sätt det i en try-catch så det inte stoppar registreringen om det failar.
      try {
        await updateDoc(referrerRef, {
          inviteCount: increment(1)
        });
      } catch (e) {
        console.error("Failed to increment referrer count", e);
      }
    }
  },

  // Hämta profil
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      return {
        ...data,
        uid: snap.id,
        createdAt: data.createdAt?.toDate()
      } as UserProfile;
    }
    return null;
    return null;
  },

  // Byt visningsnamn i users-dokumentet (Auth-profilen uppdateras i AuthContext).
  async updateDisplayName(uid: string, name: string): Promise<void> {
    await setDoc(doc(db, 'users', uid), { displayName: name.trim() }, { merge: true });
  },

  // Spegla profilbilds-URL:en till users-dokumentet (Auth-profilen sätts i
  // AuthContext) så andra ytor som läser users/{uid} ser samma bild.
  async updatePhotoURL(uid: string, photoURL: string): Promise<void> {
    await setDoc(doc(db, 'users', uid), { photoURL }, { merge: true });
  },

  // Radera users-dokumentet (vid kontoradering). Kräver att reglerna släpper
  // igenom owner-delete — misslyckas det fortsätter Auth-raderingen ändå.
  async deleteUserDoc(uid: string): Promise<void> {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', uid));
  },

  // Sparade event (hjärtan): läses vid inloggning och slås ihop med localStorage.
  async getSavedEventIds(uid: string): Promise<string[]> {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      const ids = snap.exists() ? (snap.data() as any).savedEventIds : null;
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
    } catch (e) {
      console.warn('Kunde inte läsa sparade event:', e);
      return [];
    }
  },

  // Spegla hela sparlistan till users/{uid}. Cap:ad så dokumentet hålls litet.
  async setSavedEventIds(uid: string, ids: string[]): Promise<void> {
    await setDoc(doc(db, 'users', uid), { savedEventIds: ids.slice(-500) }, { merge: true });
  },

  // Lägg till eller uppdatera omdöme
  async addReview(targetUid: string, review: { rating: number; comment: string; reviewer: UserProfile }) {
    const userRef = doc(db, 'users', targetUid);
    const reviewRef = doc(db, 'users', targetUid, 'reviews', review.reviewer.uid); // Använd ID för att garantera ett omdöme per pers

    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const reviewDoc = await transaction.get(reviewRef);

      if (!userDoc.exists()) throw new Error("Användaren finns inte");

      const userData = userDoc.data() as UserProfile;
      let currentRating = userData.rating || 0;
      let currentCount = userData.ratingCount || 0;

      // Om omdöme redan finns, dra bort gamla värdet först
      if (reviewDoc.exists()) {
        const oldData = reviewDoc.data();
        const oldRating = oldData.rating || 0;

        // Backa ut gamla betyget
        // (Snitt * antal) - gammalt = Total
        const totalScore = (currentRating * currentCount) - oldRating;

        // Uppdatera snitt (antalet är samma)
        // (Total + nytt) / antal
        currentRating = (totalScore + review.rating) / currentCount;
      } else {
        // Nytt omdöme
        const totalScore = currentRating * currentCount;
        currentCount += 1;
        currentRating = (totalScore + review.rating) / currentCount;
      }

      // 1. Skapa/Uppdatera review
      transaction.set(reviewRef, {
        reviewerId: review.reviewer.uid,
        reviewerName: review.reviewer.displayName,
        reviewerImage: review.reviewer.photoURL || null,
        rating: review.rating,
        comment: review.comment,
        createdAt: Timestamp.now()
      });

      // 2. Uppdatera användaren
      transaction.update(userRef, {
        rating: currentRating,
        ratingCount: currentCount
      });
    });
  },

  // Kolla om användaren redan har recenserat
  async hasUserReviewed(targetUid: string, reviewerUid: string): Promise<boolean> {
    const docRef = doc(db, 'users', targetUid, 'reviews', reviewerUid);
    const snap = await getDoc(docRef);
    return snap.exists();
  },

  // Hämta omdömen (valfritt, men bra för listan)
  async getReviews(targetUid: string) {
    const q = query(collection(db, 'users', targetUid, 'reviews'), orderBy('createdAt', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Lös in kod (Via Cloud Function för säkerhet)
  async redeemCode(uid: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');

      const redeemFn = httpsCallable<{ code: string }, { success: boolean, message: string }>(functions, 'redeemCode');
      const result = await redeemFn({ code });

      return result.data;
    } catch (e: any) {
      console.error("Redeem error:", e);
      return { success: false, message: e.message || 'Kunde inte lösa in koden.' };
    }
  }
};