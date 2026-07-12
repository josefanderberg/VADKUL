import type { EventWish } from '../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../utils/categories';
import { db } from '../lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, Timestamp, updateDoc } from 'firebase/firestore';

/** En önskan lever så här länge — därefter filtreras den bort ur karthämtningen. */
export const WISH_LIFETIME_DAYS = 14;

const toDate = (v: unknown): Date =>
    v instanceof Timestamp ? v.toDate() : new Date(v as string | number | Date);

/**
 * Önskningar ("någon borde ordna X här") bor i en EGEN collection eventWishes —
 * de blandas ALDRIG in i linkEvents, aggregaten eller "Nästa"-poolen. Hämtas i
 * en egen poll (samma mönster som fetchUserCreatedEvents) och renderas som egna
 * drömska brickor på kartan.
 */
export const wishService = {
    /**
     * Skapa en önskan (kräver inloggning — Firestore-reglerna verifierar
     * uid == auth.uid). expiresAt = createdAt + 14 dagar sätts här på klienten.
     */
    async createWish(input: {
        title: string; category: EventCategoryType; description?: string;
        lat: number; lng: number; uid: string; hostName: string;
    }): Promise<EventWish> {
        if (!db) throw new Error('Firestore ej initierad');
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + WISH_LIFETIME_DAYS * 86_400_000);
        const payload = {
            title: input.title.trim(),
            category: input.category || 'other',
            description: input.description?.trim() || '',
            lat: input.lat,
            lng: input.lng,
            uid: input.uid,
            hostName: input.hostName,
            createdAt: Timestamp.fromDate(createdAt),
            expiresAt: Timestamp.fromDate(expiresAt),
            fulfilled: false,
        };
        const ref = await addDoc(collection(db, 'eventWishes'), payload);
        return { ...payload, id: ref.id, createdAt, expiresAt };
    },

    /**
     * Alla AKTIVA önskningar: ej uppfyllda, ej utgångna. Hela collectionen läses
     * och filtreras på klienten (volymen är liten och det slipper composite-
     * index för fulfilled+expiresAt) — samma enkla mönster som användarevent-
     * hämtningen i linkEventService.
     */
    async fetchActiveWishes(): Promise<EventWish[]> {
        try {
            if (!db) return [];
            const snap = await getDocs(collection(db, 'eventWishes'));
            const now = Date.now();
            return snap.docs
                .map((d) => {
                    const v = d.data() as Record<string, unknown>;
                    const catKey = typeof v.category === 'string' && v.category in EVENT_CATEGORIES
                        ? (v.category as EventCategoryType) : 'other';
                    return {
                        id: d.id,
                        title: typeof v.title === 'string' ? v.title : '',
                        category: catKey,
                        description: typeof v.description === 'string' ? v.description : '',
                        lat: Number(v.lat) || 0,
                        lng: Number(v.lng) || 0,
                        uid: typeof v.uid === 'string' ? v.uid : '',
                        hostName: typeof v.hostName === 'string' && v.hostName ? v.hostName : 'VADKUL-användare',
                        createdAt: toDate(v.createdAt ?? Date.now()),
                        expiresAt: toDate(v.expiresAt ?? Date.now()),
                        fulfilled: v.fulfilled === true,
                    } as EventWish;
                })
                .filter((w) => w.title && !w.fulfilled && w.expiresAt.getTime() > now);
        } catch (e) {
            console.warn('Kunde inte hämta önskningar:', e);
            return [];
        }
    },

    /**
     * Markera en önskan som uppfylld — kallas när någon (inloggad, vem som
     * helst) skapat eventet av den. Reglerna tillåter ENBART fältet fulfilled
     * → true, inget annat.
     */
    async markFulfilled(id: string): Promise<void> {
        if (!db) throw new Error('Firestore ej initierad');
        await updateDoc(doc(db, 'eventWishes', id), { fulfilled: true });
    },

    /** Ta bort sin EGEN önskan (reglerna verifierar ägarskap). */
    async deleteWish(id: string): Promise<void> {
        if (!db) throw new Error('Firestore ej initierad');
        await deleteDoc(doc(db, 'eventWishes', id));
    },
};
