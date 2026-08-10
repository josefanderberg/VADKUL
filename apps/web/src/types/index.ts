// src/types/index.ts
import type { Timestamp } from 'firebase/firestore';
import type { EventCategoryType } from '../utils/categories';

export interface UserProfile {
  uid: string; // Koppling till Auth
  email: string;
  displayName: string;
  age: number;
  gender?: string; // Kön från registreringen ('kvinna'|'man'|'annat'|'vill_ej_ange') — statistikunderlag
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
  redeemedCodes?: string[]; // <--- NY: Inlösta koder (kampanjkoder)
  savedEventIds?: string[]; // Sparade event (hjärtan) — synkas mellan enheter
  reviretHue?: number; // <--- NY: vald spelfärg (färgton 0–359) för Reviret/topplistan
  /** Stjärn-gåvan ⭐: 'unused' = inlöst men inte satt, 'placed' = förbrukad.
   *  SERVERGIVET fält — skrivs enbart av Cloud-funktionerna redeemStarGift/
   *  placeStar (reglerna blockerar klientskrivning). */
  starGift?: 'unused' | 'placed';
  /** Eventet stjärnan sitter på (satt när starGift === 'placed'). */
  starEventId?: string;
  /** Användarens stad (för stadssegmenterade utskick). city = visningsnamn,
   *  citySlug = slug ur CITIES (cityUtils). */
  city?: string;
  citySlug?: string;
  /** 'gps' = härledd ur kartpositionen (uppdateras automatiskt),
   *  'manual' = valt/rensat i profilen eller vid registrering — skrivs
   *  aldrig över av GPS-vägen. */
  citySource?: 'gps' | 'manual';
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
  geohash?: string; // <--- NY: Geofire hash
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

export interface LinkEvent {
  id: string;
  title: string;
  url: string;
  time: Date;
  hasSpecificTime?: boolean; // <--- NY: Anger om en specifik tid hämtades
  createdAt: Date;
  locationName: string;
  extractedAddress?: string;
  geocodedQuery?: string;
  lat: number;
  lng: number;
  hostName: string;
  category?: EventCategoryType;
  coverImage?: string;
  description?: string;
  price?: number | string;
  isLocationVerified?: boolean;
  attendees?: number;
  /** Per-event-emoji från AI-audit (🧘/🏃 osv) — föredras framför kategori-default på kartpinnen. */
  emoji?: string;
  /** Användarskapade event: skaparens uid — styr "Ta bort eventet" på kortet. */
  hostUid?: string;
  /**
   * Skapat av en användare på VADKUL. TVÅ sorter, särskilda på url-fältet:
   *   • utan url  = EGET event ("jag arrangerar") — grön VADKUL-profil, RSVP på sidan.
   *   • med url   = TIPS ("jag vet att det här händer men arrangerar inte") —
   *     presenteras som ett vanligt länk-event (favicon-värd, ANMÄL-länk ut)
   *     så tipsaren aldrig ser ut som arrangör. Se isVadkulHostedEvent.
   * userCreated/hostUid gäller BÅDA sorterna (ägarskap, ta bort-rätt, reglerna).
   */
  userCreated?: boolean;
  /**
   * Uttryckligt tips ("jag vet att det här händer men arrangerar inte").
   * Behövdes när tips slutade kräva länk: url-fältet ensamt kunde inte längre
   * skilja ett länklöst TIPS från ett EGET event, och ett tips som råkade
   * klassas som eget hade fått grön VADKUL-profil med anmälan på sidan —
   * precis det som aldrig får hända (tipsaren är inte arrangör).
   * Äldre tips saknar fältet men har url, så url-regeln nedan täcker dem.
   */
  isTip?: boolean;
  /**
   * Tipset lämnades UTAN konto (anonym session). Sätts av reglerna i takt med
   * sessionen — den som är inloggad kan inte märka sitt tips som anonymt, och
   * den som inte är det kan inte slippa märkningen.
   *
   * Konsekvensen är att VEM SOM HELST får radera tipset: ett anonymt tips har
   * ingen ägare som kan städa upp efter sig, så spam måste kunna plockas bort
   * av den som råkar se den. Vill man ha kontroll över sitt eget tips får man
   * logga in när man lämnar det — då gäller vanligt ägarskap.
   */
  anonTip?: boolean;
  /**
   * Återkommer varje vecka på samma veckodag och klockslag som `time`.
   * Lagras som en REGEL på ett enda dokument — inte som N kopior. Klienten
   * veckla ut den till konkreta tillfällen vid inläsning (expandWeekly), så
   * en ändring av tid eller titel slår igenom på alla framtida tillfällen och
   * kartan slipper tolv dokument per pubquiz.
   */
  repeatWeekly?: boolean;
  /**
   * Sätts BARA på utvecklade tillfällen av en veckoserie: id:t på dokumentet
   * tillfället kommer från. Tillfällena har egna id ("<docId>__2026-08-13")
   * eftersom kartan, dedupen i emit() och React-nycklarna kräver unika id —
   * men allt som rör själva dokumentet (ta bort, äga, redigera) måste gå på
   * seriesId, annars pekar det på ett dokument som inte finns.
   */
  seriesId?: string;
  /**
   * Boostat ("featured") event: visas prioriterat på kartan t.o.m. denna tid.
   * Sätts ENBART av servern (Cloud Function) efter en verifierad Stripe-betalning —
   * aldrig av klienten. Saknas/passerat datum = vanligt event.
   */
  featuredUntil?: Date;
}

/**
 * Värdas eventet av en VADKUL-användare? (Skapat här UTAN extern länk — anmälan
 * sker på sidan.) Falskt för TIPS (användarskapat MED länk) och skrapade event:
 * de presenteras som vanliga länk-event. Styr all grön "eget event"-presentation
 * (badge, brickfärg, värd-avatar, platsradens layout) — ägarskap (ta bort/boosta)
 * går däremot fortsatt på userCreated + hostUid.
 */
export function isVadkulHostedEvent(e: Pick<LinkEvent, 'userCreated' | 'url' | 'isTip'>): boolean {
  return !!e.userCreated && !e.url && !e.isTip;
}

export interface FirestoreLinkEventData extends Omit<LinkEvent, 'id' | 'time' | 'createdAt' | 'featuredUntil'> {
  time: Timestamp;
  createdAt: Timestamp;
  featuredUntil?: Timestamp;
}

/**
 * En ÖNSKAN om ett event ("någon borde ordna X här") — egen collection
 * eventWishes, HELT skild från linkEvents/aggregaten/"Nästa"-poolen.
 * Ingen tid, ingen bild. Lever i 14 dagar (expiresAt) eller tills någon
 * skapat eventet av den (fulfilled=true) — därefter försvinner den från kartan.
 */
export interface EventWish {
  id: string;
  title: string;
  category: EventCategoryType;
  description?: string;
  lat: number;
  lng: number;
  /** Önskarens uid — styr "Ta bort önskan" (bara sin egen). */
  uid: string;
  hostName: string;
  createdAt: Date;
  expiresAt: Date;
  fulfilled?: boolean;
}