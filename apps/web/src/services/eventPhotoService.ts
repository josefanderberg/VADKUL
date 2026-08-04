import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  limit,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { storageService } from './storageService';
import type { EventPhoto } from '../types';

/** Samma nyckel-trick som eventChats: kart-eventens id:n är URL:er (innehåller
 *  '/', ogiltigt som doc-id) → URL-enkoda. Nyckeln lagras i FÄLTET eventKey
 *  (equality-query, inget doc-id-behov och ingen composite-index). */
const photoKeyFor = (eventId: string) => encodeURIComponent(eventId).slice(0, 1400);

/** Nettopoäng ur voters-mappen (upp = +1, ned = −1). */
export const photoScore = (photo: EventPhoto): number =>
  Object.values(photo.voters ?? {}).reduce((sum, v) => sum + v, 0);

export const eventPhotoService = {
  /** Livebilderna för ett event, live. Sorteras poäng-fallande (flest upp-
   *  röster överst), lika poäng → nyast först. Sortering på klienten så
   *  where-queryn förblir equality-only (ingen composite-index att deploya). */
  subscribeToPhotos(eventId: string, callback: (photos: EventPhoto[]) => void) {
    const q = query(
      collection(db, 'eventPhotos'),
      where('eventKey', '==', photoKeyFor(eventId)),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      const photos = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as EventPhoto[];
      photos.sort((a, b) => {
        const diff = photoScore(b) - photoScore(a);
        if (diff !== 0) return diff;
        return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
      });
      callback(photos);
    });
  },

  /** Ladda upp en bild till Storage (event-images/<uid>/live/ — befintlig
   *  storage-regel: ägaren skriver, alla läser) och registrera den i Firestore. */
  async addPhoto(
    eventId: string,
    eventTitle: string,
    user: { uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null },
    file: File
  ): Promise<void> {
    const url = await storageService.uploadFile(`event-images/${user.uid}/live/`, file);
    await addDoc(collection(db, 'eventPhotos'), {
      eventKey: photoKeyFor(eventId),
      eventId,
      eventTitle,
      uid: user.uid,
      userName: user.displayName || user.email || 'Anonym',
      userImage: user.photoURL || null,
      url,
      voters: {},
      createdAt: serverTimestamp(),
    });
  },

  /** Rösta upp (1) / ned (-1) eller ångra (null). En röst per användare —
   *  reglerna låser voters-diffen till ens EGEN uid-nyckel. */
  async vote(photoId: string, uid: string, value: 1 | -1 | null): Promise<void> {
    await updateDoc(doc(db, 'eventPhotos', photoId), {
      [`voters.${uid}`]: value === null ? deleteField() : value,
    });
  },

  /** Ta bort sin egen bild (Firestore-dokumentet; Storage-filen lämnas —
   *  samma mönster som event-cover-bilder). */
  async deletePhoto(photoId: string): Promise<void> {
    await deleteDoc(doc(db, 'eventPhotos', photoId));
  },
};
