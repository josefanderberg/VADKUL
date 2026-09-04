import {
  collection,
  addDoc,
  doc,
  setDoc,
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
/**
 * Chatt för KART-event (linkEvents). Deras id:n är URL:er (innehåller '/',
 * ogiltigt i dokument-id) — nyckeln URL-enkodas och chatten bor i den egna
 * kollektionen eventChats/{nyckel}/messages (firestore.rules 8b: läsning
 * fortfarande öppen på REGELNIVÅ, skrivning kräver konto). UI:t låser chatten
 * bakom inloggning sedan 31/8 — EventChatPanel startar ingen prenumeration
 * alls för utloggade, så subscribeToMessages anropas bara med konto.
 */
const chatKeyFor = (eventId: string) => encodeURIComponent(eventId).slice(0, 1400);

export const linkEventChatService = {
  subscribeToMessages: (eventId: string, callback: (msgs: ChatMessage[]) => void) => {
    const q = query(
      collection(db, 'eventChats', chatKeyFor(eventId), 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      callback(messages.reverse());
    });
  },

  sendMessage: async (eventId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>, eventTitle?: string) => {
    await addDoc(collection(db, 'eventChats', chatKeyFor(eventId), 'messages'), {
      ...message,
      createdAt: serverTimestamp()
    });
    // Spegla till latestActivity/latestComment — kart-bubblan "senaste
    // kommentaren" lyssnar på DET dokumentet (en collectionGroup-query över
    // alla messages skulle kräva en group-regel som även öppnar privata
    // chats/*/messages — därför denna spegel i stället). Best-effort:
    // meddelandet ÄR redan skickat, spegeln får aldrig fälla det.
    try {
      await setDoc(doc(db, 'latestActivity', 'latestComment'), {
        senderId: message.senderId,
        senderName: message.senderName || 'Deltagare',
        text: message.text,
        eventId,
        eventTitle: eventTitle || '',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Kunde inte uppdatera senaste-kommentaren:', e);
    }
  }
};
