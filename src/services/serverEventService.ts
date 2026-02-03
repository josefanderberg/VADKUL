import { initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { AppEvent } from '../types';

// NOTE: For this simple proof of concept and migration, we might not have a service account key file locally.
// If we don't have credentials, we can try to rely on default application credentials or
// strictly for SEO purposes, we might need a workaround if we can't fully auth.
// However, Firestore Client SDK *can* be used in Next.js Server Components if we are careful about caching options.
// But `firebase-admin` is the robust way.
//
// ERROR HANDLING STRATEGY:
// If we lack credentials (common in dev/migrated projects), we catch the error and return partial data or null.

// Initialize Firebase Admin
function getAdminDb() {
    if (!getApps().length) {
        // Försök hämta nyckel från miljövariabler (Prod / Vercel)
        const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (serviceAccountKey) {
            try {
                // Notera: JSON.parse kan behöva hantera både strängifierad JSON och base64 encoding beroende på hur man sparar den
                // Men oftast kopierar man in hela JSON-objektet i Vercel.
                const serviceAccount = JSON.parse(serviceAccountKey);
                initializeApp({ credential: cert(serviceAccount) });
            } catch (e) {
                console.error("Fel vid parsning av FIREBASE_SERVICE_ACCOUNT_KEY", e);
            }
        } else {
            // Fallback för lokal dev utan nyckel (kommer ofta misslyckas med att läsa DB om man inte har Google Cloud CLI inloggat)
            try {
                initializeApp();
            } catch (e) {
                console.warn("Firebase Admin failed to initialize.", e);
                return null;
            }
        }
    }
    return getFirestore();
}

export const serverEventService = {
    async getEventById(id: string): Promise<AppEvent | null> {
        try {
            const db = getAdminDb();
            if (!db) return null;

            const doc = await db.collection('events').doc(id).get();
            if (!doc.exists) return null;

            const data = doc.data();
            if (!data) return null;

            // Convert Firestore timestamps to dates/strings as needed to match AppEvent
            return {
                id: doc.id,
                ...data,
                // Handle Timestamp conversion if needed
                time: data.time?.toDate ? data.time.toDate() : new Date(data.time),
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined
            } as unknown as AppEvent;
        } catch (error) {
            console.error("Error fetching event server-side:", error);
            // Fallback: If admin fails (e.g. no auth), we return null
            // The client-side fetch will still show the content, just SEO tags will be generic.
            return null;
        }
    }
};
