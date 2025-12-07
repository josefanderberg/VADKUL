// src/services/friendService.ts
import { doc, updateDoc } from 'firebase/firestore'; // <-- ÄNDRING: Tog bort onödig 'getDoc' och 'setDoc'
import { db } from '../lib/firebase';
// Importera typer vid behov
// import { UserProfile } from '../types'; 
// OBS: Vi antar att 'db' är importerat från '../lib/firebase'

export const friendService = {
  
  /**
   * Skickar en vänförfrågan från senderId till recipientId.
   * Lägger till pending request i mottagarens dokument.
   */
  async sendRequest(senderId: string, recipientId: string, senderName: string) {
    // 1. Markera förfrågan som skickad hos mottagaren (Recipient)
    const recipientRef = doc(db, 'users', recipientId);
    await updateDoc(recipientRef, {
      // Lägg till senderId i en lista över väntande förfrågningar
      incomingFriendRequests: {
        [senderId]: {
            name: senderName,
            sentAt: new Date().toISOString()
        }
      }
    });

    // 2. Markera förfrågan som väntande hos avsändaren (Sender) (Valfritt, men bra för UI)
    const senderRef = doc(db, 'users', senderId);
    await updateDoc(senderRef, {
        outgoingFriendRequests: {
            [recipientId]: true // Markera att förfrågan har skickats
        }
    });

    return true;
  },

  /**
   * Accepterar en vänförfrågan och skapar en ömsesidig vänrelation.
   */
  async acceptRequest(userId: string, requesterId: string) {
    const userRef = doc(db, 'users', userId);
    const requesterRef = doc(db, 'users', requesterId);

    // 1. Lägg till varandra i vänlistorna (Anta att vi använder arrayUnion i verkligheten)
    await updateDoc(userRef, {
        friends: { [requesterId]: true },
        // Ta bort förfrågan från inkommande lista
        incomingFriendRequests: { [requesterId]: false } // Mockad borttagning
    });
    
    await updateDoc(requesterRef, {
        friends: { [userId]: true },
        // Ta bort förfrågan från utgående lista
        outgoingFriendRequests: { [userId]: false } // Mockad borttagning
    });

    return true;
  },

  /**
   * Tar bort en vän.
   */
  async removeFriend(userId: string, friendId: string) {
    const userRef = doc(db, 'users', userId);
    const friendRef = doc(db, 'users', friendId);

    // 1. Ta bort från bådas vänlistor
    await updateDoc(userRef, {
        friends: { [friendId]: false } // Mockad borttagning
    });
    
    await updateDoc(friendRef, {
        friends: { [userId]: false } // Mockad borttagning
    });

    return true;
  },
  
  /**
   * Kontrollerar vänstatus mellan två användare.
   * Returnerar: 'friend', 'pending' (request skickad av A), 'received' (request skickad av B), eller 'none'
   */
  // <-- ÄNDRING: Tog bort oanvända parametrar för att undvika TS-varningar i mock-tjänsten.
  // Funktionen är mockad och behöver inte parametrarna just nu.
  async getFriendshipStatus(): Promise<'friend' | 'pending' | 'received' | 'none'> { 
    // I en riktig app skulle detta slå mot Firestore/Backend för att kolla 3 saker.
    
    // Vi returnerar 'none' i denna mock-tjänst tills logiken i PublicProfile.tsx 
    // faktiskt sätter isFriend/friendRequestSent till true via handlarna.
    return 'none'; 
  },
};