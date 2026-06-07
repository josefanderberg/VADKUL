/**
 * waitlistService — "ställ dig i kö" för funktioner som inte byggts än.
 *
 * Skriver till Firestore-collection `waitlist` (anonym tillåten, shape-begränsad
 * av reglerna). Lokalt minns vi vad användaren ställt sig i kö för så UI kan
 * visa "Du står i kö".
 */

import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const JOINED_PREFIX = 'vadkul_waitlist_';

export const waitlistService = {
    async join(
        featureId: string,
        opts: { uid?: string | null; email?: string | null } = {},
    ): Promise<void> {
        if (!db) throw new Error('Databasen är inte tillgänglig');
        await addDoc(collection(db, 'waitlist'), {
            featureId,
            uid: opts.uid ?? null,
            email: opts.email ?? null,
            createdAt: Timestamp.now(),
        });
        try {
            window.localStorage.setItem(JOINED_PREFIX + featureId, '1');
        } catch {
            /* ignorera */
        }
    },

    hasJoined(featureId: string): boolean {
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem(JOINED_PREFIX + featureId) === '1';
        } catch {
            return false;
        }
    },
};
