// src/services/notificationService.ts
import {
  collection, addDoc, query, where, orderBy,
  onSnapshot, Timestamp, doc, updateDoc, writeBatch, getDocs, limit, setDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AppNotification } from '../types';

const COLLECTION = 'notifications';

export const notificationService = {
  // Skicka en notis
  async send(notification: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) {
    // Skicka inte notis till sig själv
    if (notification.recipientId === notification.senderId) return;

    await addDoc(collection(db, COLLECTION), {
      ...notification,
      read: false,
      createdAt: Timestamp.now()
    });
  },

  // Lyssna på mina notiser (Realtime)
  subscribe(userId: string, callback: (notifs: AppNotification[]) => void) {
    const q = query(
      collection(db, COLLECTION),
      where('recipientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(20) // Begränsa till 20 senaste notiserna
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      } as AppNotification));
      callback(data);
    });
  },

  // Markera en som läst (när man klickar på den)
  async markAsRead(id: string) {
    const ref = doc(db, COLLECTION, id);
    await updateDoc(ref, { read: true });
  },

  // Markera ALLA som lästa (knapp i menyn)
  async markAllAsRead(userId: string) {
    const q = query(
      collection(db, COLLECTION),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
  },

  // Markera specifikt chatt-notiser som lästa från en viss avsändare
  async markChatNotificationsAsRead(recipientId: string, senderId: string) {
    const q = query(
      collection(db, COLLECTION),
      where('recipientId', '==', recipientId),
      where('senderId', '==', senderId),
      where('type', '==', 'chat'),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
  },

  // ===== FCM TOKEN MANAGEMENT =====

  /**
   * Save FCM token for a user.
   *
   * createdAt = när tokenen först sparades på kontot från den här enheten,
   * lastSeenAt = senaste besöket som bekräftade den. Förut skrevs createdAt om
   * vid VARJE besök, så en gammal token såg nyskapad ut (utredningen 21/9).
   * merge: en omsparning rör inte createdAt. Gå via saveDeviceToken i
   * utils/fcm - den vet om tokenen är ny och städar roterade tokens.
   */
  async saveFCMToken(userId: string, token: string, opts: { isNew: boolean } = { isNew: true }) {
    const tokenRef = doc(db, 'fcmTokens', userId, 'tokens', token);
    const now = Timestamp.now();
    await setDoc(tokenRef, {
      token,
      lastSeenAt: now,
      ...(opts.isNew ? { createdAt: now } : {}),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    }, { merge: true });
  },

  /**
   * Delete FCM token for a user
   */
  async deleteFCMToken(userId: string, token: string) {
    const tokenRef = doc(db, 'fcmTokens', userId, 'tokens', token);
    await deleteDoc(tokenRef);
  },

  /**
   * Get all FCM tokens for a user
   */
  async getFCMTokens(userId: string): Promise<string[]> {
    const tokensRef = collection(db, 'fcmTokens', userId, 'tokens');
    const snapshot = await getDocs(tokensRef);
    return snapshot.docs.map(doc => doc.data().token);
  }
};