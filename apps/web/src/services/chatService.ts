// src/services/chatService.ts
import {
  collection, addDoc, query, where, orderBy,
  onSnapshot, Timestamp, doc, setDoc, updateDoc, limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ChatMessage, ChatRoom, UserProfile } from '../types';


export const chatService = {
  async createOrGetChat(currentUser: UserProfile, targetUser: { uid: string, name: string, image?: string }) {
    const sortedIds = [currentUser.uid, targetUser.uid].sort();
    const chatId = sortedIds.join('_');

    const chatRef = doc(db, 'chats', chatId);

    // VIKTIGT: Använd || null för bilder. Firestore kraschar av 'undefined'.
    await setDoc(chatRef, {
      id: chatId,
      participants: [currentUser.uid, targetUser.uid],
      participantDetails: {
        [currentUser.uid]: {
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL || null // <-- FIXAD
        },
        [targetUser.uid]: {
          displayName: targetUser.name,
          photoURL: targetUser.image || null // <-- FIXAD
        }
      },
      lastUpdated: Timestamp.now(),
    }, { merge: true });

    return chatId;
  },

  // Skicka meddelande
  async sendMessage(chatId: string, senderId: string, text: string) {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatRef = doc(db, 'chats', chatId);

    const now = Timestamp.now();

    // 1. Lägg till meddelandet i sub-collection
    await addDoc(messagesRef, {
      senderId,
      text,
      createdAt: now
    });

    // 2. Uppdatera "senaste meddelande" på själva chatten (för listan)
    await updateDoc(chatRef, {
      lastMessage: text,
      lastUpdated: now
    });
  },

  // Lyssna på mina aktiva chattar (för listan)
  subscribeToChats(userId: string, callback: (chats: ChatRoom[]) => void) {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('lastUpdated', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatRoom));
      callback(chats);
    });
  },

  // Lyssna på meddelanden i en specifik chatt
  subscribeToMessages(chatId: string, callback: (msgs: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(20) // Begränsa antal meddelanden för att spara reads
    );

    return onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ChatMessage));
      callback(msgs);
    });
  }
};