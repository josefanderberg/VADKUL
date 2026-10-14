import type { EventWish } from '../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../utils/categories';
import { db } from '../lib/firebase';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, Timestamp, updateDoc, where } from 'firebase/firestore';

/** En önskan lever så här länge, därefter filtreras den bort ur karthämtningen.
 *  14 dagar t.o.m. 22/9, sedan 7 (Josef: "det räcker typ"). */
export const WISH_LIFETIME_DAYS = 7;

/**
 * Kartans önskningspoll (app/(v2)/page.tsx), bara medan fliken syns
 * (utils/visiblePoll). Var 30 s utan visibility-vakt t.o.m. 14/10: varje varv
 * kostar minst ett Firestore-read, och önskningar skapas några i veckan.
 * Egna nyskapade slås in lokalt direkt, så takten märks bara för andras.
 */
export const WISH_POLL_MS = 5 * 60_000;

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
     * uid == auth.uid). expiresAt = createdAt + WISH_LIFETIME_DAYS sätts här på klienten.
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
     * Alla AKTIVA önskningar: ej uppfyllda, ej utgångna. Utgångna sållas på
     * servern (expiresAt > nu, enfältsindexet räcker - ingen composite för
     * fulfilled+expiresAt), resten på klienten. Förr lästes HELA collectionen
     * varje varv, så kostnaden växte med varje önskan som någonsin skapats.
     * Både webben och appen skriver expiresAt som Timestamp, så filtret
     * missar inga.
     */
    async fetchActiveWishes(): Promise<EventWish[]> {
        try {
            if (!db) return [];
            const snap = await getDocs(query(
                collection(db, 'eventWishes'),
                where('expiresAt', '>', Timestamp.now()),
                limit(500),
            ));
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
                // Även createdAt-gränsen: önskningar skapade medan livslängden
                // var 14 dagar bär ett expiresAt som ligger för långt fram.
                .filter((w) => w.title && !w.fulfilled && w.expiresAt.getTime() > now
                    && w.createdAt.getTime() + WISH_LIFETIME_DAYS * 86_400_000 > now);
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
