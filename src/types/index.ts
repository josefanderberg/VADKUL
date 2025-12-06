// src/types/index.ts
import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string; // Koppling till Auth
  email: string;
  displayName: string;
  age: number;
  isVerified: boolean;
  verificationImage?: string; // Base64 sträng av bilden
  createdAt: Date;
}

export interface ChatMessage {
  id?: string;
  senderId: string;     // Vem skickade?
  text: string;
  createdAt: Timestamp; // Firestore timestamp
}

export interface ChatRoom {
  id: string;
  participants: string[]; // ['mitt-uid', 'annat-uid']
  participantDetails: {   // Spara namn/bild så vi slipper hämta dem hela tiden
    [uid: string]: {
      displayName: string;
      photoURL?: string;
    }
  };
  lastMessage: string;
  lastUpdated: Timestamp;
}

export interface EventHost {
  uid: string; 
  name: string;
  initials: string;
  verified: boolean;
  rating: number;
  email: string;
}

export interface EventLocation {
  name: string;
  distance: number;
}

// NY: För att kunna klicka på deltagare måste vi spara mer än bara email
export interface EventAttendee {
  uid: string;
  email: string;
  displayName: string;
}

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  location: EventLocation;
  lat: number;
  lng: number;
  time: Date;
  type: string;
  price: number;
  minParticipants: number;
  maxParticipants: number;
  minAge: number;
  maxAge: number;
  ageCategory: string;
  host: EventHost;
  attendees: EventAttendee[]; // <--- ÄNDRAT FRÅN string[] TILL EventAttendee[]
}

export interface AppNotification {
  id: string;
  recipientId: string; // Vem ska ha notisen?
  senderId?: string;   // Vem skickade den? (valfritt)
  senderName?: string; // Namn för visning
  senderImage?: string;// Bild för visning
  type: 'join' | 'leave' | 'chat' | 'system';
  message: string;
  link?: string;       // Vart ska man hamna om man klickar?
  read: boolean;       // Har användaren sett den?
  createdAt: any;      // Timestamp
}

export interface FirestoreEventData extends Omit<AppEvent, 'id' | 'time'> {
  time: Timestamp;
}