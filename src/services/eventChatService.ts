import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatMessage } from '../types'; // <-- Lade till "type" här  
export const eventChatService = {
  // Lyssna på meddelanden i realtid
  subscribeToMessages: (eventId: string, callback: (msgs: ChatMessage[]) => void) => {
    // Vi vill ha de 50 SENASTE meddelandena.
    // Rätt sätt: orderBy desc, limit 50, och sen vänd listan rätt.
    const q = query(
      collection(db, 'events', eventId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      // Vänd tillbaka ordningen så de kommer kronologiskt (äldst -> nyast)
      callback(messages.reverse());
    });
  },

  // Skicka meddelande
  sendMessage: async (eventId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'events', eventId, 'messages'), {
      ...message,
      createdAt: serverTimestamp() // Låt servern sätta tiden
    });
  }
};