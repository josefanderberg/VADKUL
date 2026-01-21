import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FeedbackItem } from '../types';

export const feedbackService = {
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
