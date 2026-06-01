/**
 * firestore-admin.ts
 *
 * Server-side Firebase Admin SDK för Next.js API-routes.
 *
 * Miljöer:
 *   - Firebase App Hosting (prod) → Application Default Credentials (ADC) automatiskt
 *   - Lokal dev                   → service-account.json från scraper-mappen
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import path from 'path';
import fs from 'fs';

let _db: Firestore | null = null;

export function getAdminDb(): Firestore | null {
    if (_db) return _db;

    if (getApps().length === 0) {
        try {
            // Lokal dev: leta efter service-account.json i scraper-mappen
            const candidates = [
                path.resolve(process.cwd(), '../scraper/service-account.json'),
                path.resolve(process.cwd(), 'apps/scraper/service-account.json'),
            ];

            let initialized = false;
            for (const p of candidates) {
                if (fs.existsSync(p)) {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    initializeApp({ credential: cert(require(p)) });
                    initialized = true;
                    break;
                }
            }

            if (!initialized) {
                // Firebase App Hosting / Cloud Run: använd ADC
                initializeApp();
            }
        } catch (e) {
            console.error('[firestore-admin] Init error:', e);
            return null;
        }
    }

    _db = getFirestore();
    return _db;
}
