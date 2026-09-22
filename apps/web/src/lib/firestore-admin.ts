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
import { getAuth, Auth } from 'firebase-admin/auth';
import path from 'path';
import fs from 'fs';

let _db: Firestore | null = null;

/** Initiera Admin-appen en gång (ADC i prod, service-account lokalt). */
function ensureAdminApp(): boolean {
    // Kolla efter DEFAULT-appen specifikt: i prod skapar firebase-frameworks
    // (Hosting-wrappern) en NAMNGIVEN admin-app ('firebase-frameworks') vid
    // uppstart. Ett `getApps().length > 0` hoppade då över init av
    // default-appen → getFirestore() kastade → naken 500 på alla admin-routes.
    if (getApps().some(a => a.name === '[DEFAULT]')) return true;

    try {
        // Lokal dev: leta efter service-account.json i scraper-mappen
        const candidates = [
            path.resolve(process.cwd(), '../scraper/service-account.json'),
            path.resolve(process.cwd(), 'apps/scraper/service-account.json'),
        ];

        for (const p of candidates) {
            if (fs.existsSync(p)) {
                // fs + JSON.parse i st.f. require(): webpack skriver om dynamiska
                // require-anrop så de kraschar i runtime i Next-bundlad kod.
                initializeApp({ credential: cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
                return true;
            }
        }

        // Firebase App Hosting / Cloud Run: använd ADC
        initializeApp();
        return true;
    } catch (e) {
        console.error('[firestore-admin] Init error:', e);
        return false;
    }
}

export function getAdminDb(): Firestore | null {
    if (_db) return _db;
    if (!ensureAdminApp()) return null;
    // try/catch: ett kast här bubblar annars ut UR anropande routes utan egen
    // vakt → naken 500. null → routes svarar 503 och klienter tar reservvägen.
    try {
        _db = getFirestore();
    } catch (e) {
        console.error('[firestore-admin] getFirestore:', e);
        return null;
    }
    return _db;
}

export function getAdminAuth(): Auth | null {
    if (!ensureAdminApp()) return null;
    try {
        return getAuth();
    } catch (e) {
        console.error('[firestore-admin] getAuth:', e);
        return null;
    }
}
