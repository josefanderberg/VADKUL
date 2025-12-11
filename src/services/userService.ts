// src/services/userService.ts
import { doc, setDoc, getDoc, Timestamp, runTransaction, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../types';

export const userService = {
  // Skapa eller uppdatera användarprofil i databasen
  async createUserProfile(uid: string, data: Omit<UserProfile, 'uid' | 'createdAt'>) {
    const userRef = doc(db, 'users', uid);

    await setDoc(userRef, {
      ...data,
      uid,
      createdAt: Timestamp.now(),
      isVerified: true
    }, { merge: true });
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
  }
};