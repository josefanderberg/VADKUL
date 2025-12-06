// src/services/userService.ts
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
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
  }
};