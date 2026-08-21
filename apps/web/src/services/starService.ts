// src/services/starService.ts
// Stjärn-gåvan ⭐ — tack-kampanjen till de första användarna. En gåvolänk
// (/?stjarna=<KOD>) ger EN stjärna som kan sättas på valfritt event; eventet
// lyser sedan för ALLA på kartan tills det passerat. Spärren är per (konto,
// kod) sedan 22/8 — olika länkar ger alltså fler stjärnor till samma konto,
// och de staplas (starsAvailable).
//
// All skrivning går via Cloud Functions (redeemStarGift/placeStar) — Firestore-
// reglerna blockerar klientskrivning av både eventStars-collectionen och
// users stjärn-fält, så gåvan inte går att förfalska. Klienten läser bara.
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const starService = {
  /**
   * Lyssna på ALLA stjärnmärkta event (eventStars är liten — max en stjärna
   * per tidig användare, ~100 dokument). Callbacken får ett Set med eventId:n
   * som kartan/kortet överlagrar på befintlig eventdata — stjärnan bor alltså
   * ALDRIG i aggregaten (de byggs 1 gång/dygn + CDN-cachas och skulle släpa).
   */
  subscribeStarredEventIds(cb: (ids: Set<string>) => void): () => void {
    return onSnapshot(
      collection(db, 'eventStars'),
      (snap) => {
        const ids = new Set<string>();
        snap.forEach((d) => {
          const eventId = (d.data() as { eventId?: unknown }).eventId;
          if (typeof eventId === 'string') ids.add(eventId);
        });
        cb(ids);
      },
      (err) => console.warn('Kunde inte läsa stjärnmärkta event:', err),
    );
  },

  /** Lös in gåvolänkens kampanjkod (kräver inloggning — funktionen verifierar).
   *  starsAvailable = antal stjärnor kontot har kvar att sätta EFTER anropet
   *  (även när success=false, dvs. koden redan var inlöst). */
  async redeemStarGift(code: string): Promise<{ success: boolean; status?: 'unused' | 'placed'; message: string; starsAvailable?: number }> {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      const fn = httpsCallable<{ code: string }, { success: boolean; status?: 'unused' | 'placed'; message: string; starsAvailable?: number }>(functions, 'redeemStarGift');
      const result = await fn({ code });
      return result.data;
    } catch (e: unknown) {
      console.error('Kunde inte lösa in stjärnan:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Kunde inte hämta stjärnan. Försök igen.' };
    }
  },

  /** Sätt EN av sina oplacerade stjärnor på ett event. Går inte att ångra.
   *  starsLeft = antal kvar efter placeringen. */
  async placeStar(eventId: string): Promise<{ success: boolean; message: string; starsLeft?: number }> {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      const fn = httpsCallable<{ eventId: string }, { success: boolean; message: string; starsLeft?: number }>(functions, 'placeStar');
      const result = await fn({ eventId });
      return result.data;
    } catch (e: unknown) {
      console.error('Kunde inte placera stjärnan:', e);
      return { success: false, message: e instanceof Error ? e.message : 'Kunde inte sätta stjärnan. Försök igen.' };
    }
  },
};
