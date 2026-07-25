import { collection, getDocs, query, orderBy, limit, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FeedbackItem, LinkEvent } from '../types';

/** Avsändarens kontaktuppgifter — så vi vet vem vi ska återkoppla till. */
export interface FeedbackContact {
    name?: string | null;
    email?: string | null;
}

/**
 * Lägg kontaktraden SIST i message-texten. Reglerna tillåter bara formen
 * {rating, message, createdAt, userAgent?, userId?} — egna name/email-fält
 * hade krävt en regeldeploy (och brutit feedbacken tills den gjorts). I texten
 * följer kontakten med till admin-vyn gratis. Basen kapas FÖRE hopslagningen
 * så kontaktraden aldrig klipps bort av längdtaket (reglerna kräver < 2000).
 */
function withContact(message: string, contact?: FeedbackContact): string {
    const name = contact?.name?.trim();
    const email = contact?.email?.trim();
    if (!name && !email) return message.slice(0, 1900);
    const line = `\n— Kontakt: ${[name, email].filter(Boolean).join(' · ')}`.slice(0, 200);
    return message.slice(0, 1900 - line.length) + line;
}

export const feedbackService = {
    /**
     * Rapportera ett event (fel info / finns inte / olämpligt). Återanvänder
     * feedback-collectionen — reglerna tillåter anonym create med exakt formen
     * {rating, message, createdAt, userAgent?, userId?} så ingen regeländring
     * behövs. Admin läser rapporterna i samma flöde som övrig feedback.
     */
    async reportEvent(evt: LinkEvent, reason: string, userId?: string, contact?: FeedbackContact): Promise<void> {
        const payload: Record<string, unknown> = {
            rating: 1,
            message: withContact(`[EVENTRAPPORT] ${reason} — "${evt.title}" (id: ${evt.id})${evt.url ? ` ${evt.url}` : ''}`, contact),
            createdAt: Timestamp.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : 'okänd',
        };
        if (userId) payload.userId = userId;
        await addDoc(collection(db, 'feedback'), payload);
    },

    /**
     * Allmän feedback / problemrapport från profilen. Skriver samma form som
     * reportEvent ({rating, message, createdAt, userAgent?, userId?}) så
     * Firestore-reglerna redan tillåter den — ingen regeländring behövs. Admin
     * läser den i samma flöde som övrig feedback.
     */
    async submitFeedback(message: string, userId?: string, contact?: FeedbackContact): Promise<void> {
        const payload: Record<string, unknown> = {
            // Regeln kräver rating 1–5 (se firestore.rules). Allmän feedback har ingen
            // betygsskala → neutralt 3; meddelandet (prefixat [FEEDBACK]) bär innehållet.
            rating: 3,
            message: withContact(`[FEEDBACK] ${message}`, contact),
            createdAt: Timestamp.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : 'okänd',
        };
        if (userId) payload.userId = userId;
        await addDoc(collection(db, 'feedback'), payload);
    },

    async getRecentFeedback(limitCount: number = 5): Promise<FeedbackItem[]> {
        try {
            const feedbackRef = collection(db, 'feedback');
            const q = query(feedbackRef, orderBy('createdAt', 'desc'), limit(limitCount));
            const querySnapshot = await getDocs(q);

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FeedbackItem));
        } catch (error) {
            console.error("Error fetching feedback:", error);
            return [];
        }
    }
};
