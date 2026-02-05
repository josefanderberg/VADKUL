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
        // Försök hämta nyckel från miljövariabler (Prod / Vercel)
        let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        // Om ingen miljövariabel, försök läsa lokal fil (Dev)
        if (!serviceAccountKey) {
            try {
                // Vi använder require för att läsa filen synkront om den finns
                // Detta fungerar i Node/Next.js server miljö
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const fs = require('fs');
                const path = require('path');
                const filePath = path.join(process.cwd(), 'service-account.json');
                if (fs.existsSync(filePath)) {
                    console.log("Found local service-account.json, using it.");
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    serviceAccountKey = fileContent;
                }
            } catch (e) {
                // Ignore error, file might not exist
            }
        }

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
            // Fallback för lokal dev utan nyckel (eller Vercel utan separat service account)
            // Vi MÅSTE ange projectId explicit för att undvika "Unable to detect a Project Id" error som slöar ner allt.
            try {
                // Använd samma ID som i klient-configen (finns i src/lib/firebase.ts)
                const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'vadkul-f2cb2';
                console.log(`Initializing Firebase Admin with projectId: ${projectId}`);

                initializeApp({
                    projectId: projectId
                });
            } catch (e) {
                console.warn("Firebase Admin failed to initialize.", e);
                return null;
            }
        }
    }
    try {
        return getFirestore();
    } catch (e) {
        // Om vi inte har credentials (t.ex. lokal miljö utan GOOGLE_APPLICATION_CREDENTIALS)
        // så kastar getFirestore() ett fel. Vi fångar det här och returnerar null.
        console.warn("Failed to get Firestore instance (likely missing credentials):", e);
        return null;
    }
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
