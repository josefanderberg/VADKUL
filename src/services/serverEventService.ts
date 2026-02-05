import { AppEvent } from '../types';
import { db as clientDb } from '@/lib/firebase';
import { doc as clientDoc, getDoc as clientGetDoc } from 'firebase/firestore';

// Initialize Firebase Admin (Dynamic Import to avoid bundling issues)
function getAdminDb() {
    try {
        // Use standard require to bypass webpack/turbopack hashing
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getApps, initializeApp, cert } = require('firebase-admin/app');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getFirestore } = require('firebase-admin/firestore');

        if (!getApps().length) {
            let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

            if (!serviceAccountKey) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const fs = require('fs');
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const path = require('path');
                    const filePath = path.join(process.cwd(), 'service-account.json');
                    if (fs.existsSync(filePath)) {
                        console.log("Found local service-account.json, using it.");
                        const fileContent = fs.readFileSync(filePath, 'utf8');
                        serviceAccountKey = fileContent;
                    }
                } catch (e) {
                    // Ignore
                }
            }

            if (serviceAccountKey) {
                try {
                    const serviceAccount = JSON.parse(serviceAccountKey);
                    initializeApp({ credential: cert(serviceAccount) });
                } catch (e) {
                    console.error("Fel vid parsning av credentials", e);
                }
            } else {
                console.log("No credentials found, skipping Admin SDK init.");
                return null;
            }
        }
        return getFirestore();
    } catch (e) {
        console.error("Failed to load firebase-admin:", e);
        return null; // Fallback to client SDK
    }
}

export const serverEventService = {
    async getEventById(id: string): Promise<AppEvent | null> {
        // 1. Try Firebase Admin SDK
        try {
            const db = getAdminDb();
            if (db) {
                const doc = await db.collection('events').doc(id).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data) {
                        return {
                            id: doc.id,
                            ...data,
                            time: data.time?.toDate ? data.time.toDate() : new Date(data.time),
                            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined
                        } as unknown as AppEvent;
                    }
                } else {
                    // Document does not exist in Admin SDK, return null immediately (don't try client)
                    return null;
                }
            }
        } catch (error) {
            // In dev environment without credentials, this is expected.
            // console.warn("Firebase Admin SDK failed (likely missing credentials). Falling back to Client SDK...", error);
        }

        // 2. Fallback to Firebase Client SDK
        try {
            // Note: clientDb is initialized in @/lib/firebase
            const docRef = clientDoc(clientDb, "events", id);
            const snapshot = await clientGetDoc(docRef);

            if (!snapshot.exists()) {
                return null;
            }

            const data = snapshot.data();
            return {
                id: snapshot.id,
                ...data,
                // Client SDK Timestamps also have toDate()
                time: data.time?.toDate ? data.time.toDate() : new Date(data.time),
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : undefined
            } as unknown as AppEvent;

        } catch (clientError) {
            console.error("Error fetching event with Client SDK fallback:", clientError);
            return null;
        }
    }
};
