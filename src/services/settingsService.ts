import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GlobalSettings {
    showHallOfFame: boolean;
}

const SETTINGS_DOC_ID = 'global';
const COLLECTION_NAME = 'settings';

export const settingsService = {
    // Get settings once (with cache)
    async getGlobalSettings(): Promise<GlobalSettings> {
        // 1. Try cache first for speed
        try {
            const cached = localStorage.getItem('vadkul_settings_global');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            // Ignore storage error
        }

        // 2. Fetch fresh
        try {
            const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as GlobalSettings;
                localStorage.setItem('vadkul_settings_global', JSON.stringify(data));
                return data;
            } else {
                return { showHallOfFame: true };
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            return { showHallOfFame: true };
        }
    },

    // Update settings
    async updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
        const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
        // Optimistic update of cache
        const currentCache = localStorage.getItem('vadkul_settings_global');
        if (currentCache) {
            const parsed = JSON.parse(currentCache);
            localStorage.setItem('vadkul_settings_global', JSON.stringify({ ...parsed, ...settings }));
        }

        await setDoc(docRef, settings, { merge: true });
    },

    // Subscribe to settings changes
    subscribe(callback: (settings: GlobalSettings) => void) {
        const docRef = doc(db, COLLECTION_NAME, SETTINGS_DOC_ID);
        return onSnapshot(docRef,
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as GlobalSettings;
                    // Update cache
                    localStorage.setItem('vadkul_settings_global', JSON.stringify(data));
                    callback(data);
                } else {
                    callback({ showHallOfFame: true });
                }
            },
            (error) => {
                console.warn("Settings listener failed (permissions?):", error);

                // Try to fallback to cache if listener fails
                const cached = localStorage.getItem('vadkul_settings_global');
                if (cached) {
                    callback(JSON.parse(cached));
                } else {
                    callback({ showHallOfFame: true });
                }
            }
        );
    },

    // Synchronous getter for initial state
    getCachedSettings(): GlobalSettings | null {
        try {
            const cached = localStorage.getItem('vadkul_settings_global');
            return cached ? JSON.parse(cached) : null;
        } catch {
            return null;
        }
    }
};
