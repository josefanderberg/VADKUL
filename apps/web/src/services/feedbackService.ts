import { collection, getDocs, query, orderBy, limit, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FeedbackItem, LinkEvent } from '../types';

export const feedbackService = {
    /**
     * Rapportera ett event (fel info / finns inte / olämpligt). Återanvänder
     * feedback-collectionen — reglerna tillåter anonym create med exakt formen
     * {rating, message, createdAt, userAgent?, userId?} så ingen regeländring
     * behövs. Admin läser rapporterna i samma flöde som övrig feedback.
     */
    async reportEvent(evt: LinkEvent, reason: string, userId?: string): Promise<void> {
        const payload: Record<string, unknown> = {
            rating: 1,
            message: `[EVENTRAPPORT] ${reason} — "${evt.title}" (id: ${evt.id})${evt.url ? ` ${evt.url}` : ''}`.slice(0, 1900),
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
