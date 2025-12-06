// src/services/chatService.ts
import { 
    collection, addDoc, query, where, orderBy, 
    onSnapshot, Timestamp, doc, setDoc, updateDoc 
  } from 'firebase/firestore';
  import { db } from '../lib/firebase';
  import type { ChatMessage, ChatRoom, UserProfile } from '../types';
  
  export const chatService = {
    // Starta en ny chatt eller hämta befintlig
    async createOrGetChat(currentUser: UserProfile, targetUser: { uid: string, name: string, image?: string }) {
      // 1. Kolla om chatten redan finns
      // (Enklast i NoSQL är att ha ett ID som är kombinationen av båda UIDs, sorterat)
      const sortedIds = [currentUser.uid, targetUser.uid].sort();
      const chatId = sortedIds.join('_');
      
      const chatRef = doc(db, 'chats', chatId);
      
      // Vi använder setDoc med { merge: true } så vi inte skriver över om den finns
      await setDoc(chatRef, {
        id: chatId,
        participants: [currentUser.uid, targetUser.uid],
        participantDetails: {
          [currentUser.uid]: {
            displayName: currentUser.displayName,
            photoURL: currentUser.verificationImage
          },
          [targetUser.uid]: {
            displayName: targetUser.name,
            photoURL: targetUser.image
          }
        },
        lastUpdated: Timestamp.now(),
        // Sätt inte lastMessage om den redan finns, då skrivs den över
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
        orderBy('createdAt', 'asc')
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