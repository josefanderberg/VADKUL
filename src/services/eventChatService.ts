import { 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp 
  } from 'firebase/firestore';
  import { db } from '../lib/firebase';
  import type { ChatMessage } from '../types'; // <-- Lade till "type" här  
  export const eventChatService = {
    // Lyssna på meddelanden i realtid
    subscribeToMessages: (eventId: string, callback: (msgs: ChatMessage[]) => void) => {
      const q = query(
        collection(db, 'events', eventId, 'messages'),
        orderBy('createdAt', 'asc')
      );
  
      return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ChatMessage[];
        callback(messages);
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