// src/types/index.ts
import { Timestamp } from 'firebase/firestore';
import type { EventCategoryType } from '../utils/categories';

export interface UserProfile {
  uid: string; // Koppling till Auth
  email: string;
  displayName: string;
  age: number;
  birthDate?: string; // <--- NY: Födelsedatum (YYYY-MM-DD)
  bio?: string; // <--- NY: Biografi
  photoURL?: string | null; // <--- NY: Profilbild (separat från verifiering)
  isVerified: boolean;
  verificationImage?: string | null; // Base64 sträng av bilden
  verificationStatus?: 'none' | 'pending' | 'verified' | 'rejected'; // <--- NY: Status för verifiering
  rejectionReason?: string | null; // <--- NY: Anledning till nekad verifiering
  createdAt: Date;
  rating?: number;       // Medelbetyg (0-5)
  ratingCount?: number;  // Antal omdömen
  inviteCount?: number;  // <--- NY: Antal inbjudna
  invitedBy?: string;    // <--- NY: Vem bjöd in mig?
}

export interface UserReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerImage?: string;
  rating: number; // 1-5
  comment: string;
  createdAt: Timestamp;
  eventId?: string; // Koppla till event om möjligt
}

export interface ChatMessage {
  id?: string;
  senderId: string;     // Vem skickade?
  senderName?: string;  // Visningsnamn
  senderImage?: string | null;
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
  displayName?: string; // <--- LÄGG TILL DENNA RAD
  initials: string;
  verified: boolean;
  rating: number;
  email: string;
  photoURL?: string | null;
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
  photoURL?: string | null;
  status: 'confirmed' | 'pending'; // <--- NY: Status
}

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  location: EventLocation;
  lat: number;
  lng: number;
  time: Date;
  type: EventCategoryType;
  price: number;
  minParticipants: number;
  maxParticipants: number;
  minAge: number;
  maxAge: number;
  ageCategory: string;
  host: EventHost;
  attendees: EventAttendee[];
  coverImage?: string;
  requiresApproval: boolean; // <--- NY: Kräv godkännande
  createdAt?: Date; // <--- NY: Skapad datum
  visibility?: 'public' | 'hidden'; // <--- NY: Synlighet
  customCategory?: string; // <--- NY: Anpassad kategori (t.ex. "Kalmar Nation")
  views: number; // <--- NY: Antal visningar
}

export interface AppNotification {
  id: string;
  recipientId: string; // Vem ska ha notisen?
  senderId?: string;   // Vem skickade den? (valfritt)
  senderName?: string; // Namn för visning
  senderImage?: string | null;
  type: 'join' | 'leave' | 'chat' | 'system';
  message: string;
  link?: string;       // Vart ska man hamna om man klickar?
  read: boolean;       // Har användaren sett den?
  createdAt: any;      // Timestamp
}

export interface FirestoreEventData extends Omit<AppEvent, 'id' | 'time' | 'createdAt'> {
  time: Timestamp;
  createdAt?: Timestamp;
  views: number;
}

export interface FeedbackItem {
  id: string;
  rating: number;
  message: string;
  createdAt: Timestamp;
  userAgent?: string;
  userId?: string;
}